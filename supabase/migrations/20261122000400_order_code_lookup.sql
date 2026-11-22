begin;

drop function public.create_order(uuid, text, text, text, public.fulfillment_method, text, text, jsonb, integer);

create function public.create_order(
  p_idempotency_key uuid,
  p_customer_name text,
  p_phone text,
  p_fulfillment public.fulfillment_method,
  p_address text,
  p_note text,
  p_items jsonb,
  p_expected_fee integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_order_id uuid;
  v_items jsonb;
  v_subtotal bigint;
  v_fee integer;
  v_threshold integer;
  v_pickup text;
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_random bytea;
begin
  if p_idempotency_key is null then
    raise exception 'invalid_order';
  end if;

  -- Serialize the first write and retries for this checkout, even across workers.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select code into v_code
    from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return v_code;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_order';
  end if;
  if jsonb_array_length(p_items) not between 1 and 100
    or exists (
      select 1
      from jsonb_to_recordset(p_items) as i(variant_id uuid, quantity integer, expected_price integer)
      where i.variant_id is null or i.quantity is null or i.quantity not between 1 and 99
        or i.expected_price is null or i.expected_price < 0
    ) or exists (
      select 1 from jsonb_to_recordset(p_items) as i(variant_id uuid, sugar_level text, ice_level text)
      group by i.variant_id, i.sugar_level, i.ice_level having count(*) > 1
    ) then
    raise exception 'invalid_order';
  end if;

  with current_items as (
    select v.id as variant_id, p.name as product_name, v.size, v.price_vnd as unit_price_vnd,
      i.quantity, i.sugar_level, i.ice_level
    from jsonb_to_recordset(p_items)
      as i(variant_id uuid, quantity integer, sugar_level text, ice_level text, expected_price integer)
    join public.product_variants v on v.id = i.variant_id
    join public.products p on p.id = v.product_id
    join public.categories c on c.id = p.category_id
    where v.is_available and p.is_active and p.is_available and c.is_active
      and ((p.allow_sugar and i.sugar_level in ('0%', '30%', '50%', '70%', '100%'))
        or (not p.allow_sugar and i.sugar_level is null))
      and ((p.allow_ice and i.ice_level in ('Không đá', 'Ít đá', 'Đá thường'))
        or (not p.allow_ice and i.ice_level is null))
      and v.price_vnd = i.expected_price
    for share of v, p, c
  )
  select jsonb_agg(current_items), sum(unit_price_vnd::bigint * quantity)
    into v_items, v_subtotal from current_items;

  if coalesce(jsonb_array_length(v_items), 0) <> jsonb_array_length(p_items) then
    raise exception 'cart_changed';
  end if;

  select delivery_fee_vnd, free_delivery_threshold_vnd, pickup_address
    into v_fee, v_threshold, v_pickup from public.settings where id = 1 for share;
  if not found then
    v_fee := 15000;
    v_threshold := 150000;
    v_pickup := 'Cập nhật trong trang quản trị';
  end if;
  if p_fulfillment = 'pickup' or v_subtotal >= v_threshold then
    v_fee := 0;
  end if;
  if v_fee is distinct from p_expected_fee then
    raise exception 'cart_changed';
  end if;
  if v_subtotal + v_fee > 2147483647 then
    raise exception 'invalid_order';
  end if;

  -- Use eight UUID bytes, skipping the version and variant bytes.
  loop
    v_random := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    select 'MN-' || string_agg(substr(v_alphabet, 1 + get_byte(v_random, idx) % length(v_alphabet), 1), '' order by position)
      into v_code from unnest(array[0, 1, 2, 3, 4, 5, 9, 10]) with ordinality as bytes(idx, position);
    insert into public.orders (
      code, idempotency_key, customer_name, phone, fulfillment_method,
      delivery_address, pickup_address, customer_note, subtotal_vnd, delivery_fee_vnd, total_vnd, status
    ) values (
      v_code, p_idempotency_key, p_customer_name, p_phone, p_fulfillment,
      case when p_fulfillment = 'delivery' then p_address end,
      case when p_fulfillment = 'pickup' then v_pickup end,
      nullif(p_note, ''), v_subtotal, v_fee, v_subtotal + v_fee, 'confirmed'
    ) on conflict (code) do nothing returning id into v_order_id;
    exit when v_order_id is not null;
  end loop;

  insert into public.order_items (
    order_id, variant_id, product_name, size, unit_price_vnd, quantity, sugar_level, ice_level
  )
  select v_order_id, variant_id, product_name, size, unit_price_vnd, quantity, sugar_level, ice_level
  from jsonb_to_recordset(v_items) as i(
    variant_id uuid, product_name text, size public.product_size, unit_price_vnd integer,
    quantity integer, sugar_level text, ice_level text
  );

  insert into public.payments (order_id, method, status, amount_vnd)
  values (v_order_id, 'cod', 'pending', v_subtotal + v_fee);
  return v_code;
end;
$$;

revoke all on function public.create_order(uuid, text, text, public.fulfillment_method, text, text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, public.fulfillment_method, text, text, jsonb, integer)
  to service_role;

commit;
