begin;

drop function public.create_order(uuid, text, text, public.fulfillment_method, text, text, jsonb, integer);

create function public.create_order(
  p_idempotency_key uuid,
  p_customer_name text,
  p_phone text,
  p_fulfillment public.fulfillment_method,
  p_address text,
  p_note text,
  p_items jsonb,
  p_expected_fee integer,
  p_user_id uuid,
  p_method public.payment_method
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
  v_owner uuid;
  v_bin text;
  v_account text;
  v_name text;
  v_created timestamptz;
begin
  if p_idempotency_key is null or p_method is null then
    raise exception 'invalid_order';
  end if;

  -- Serialize the first write and retries for this checkout, even across workers.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select code, user_id into v_code, v_owner
    from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if v_owner is distinct from p_user_id then raise exception 'invalid_order'; end if;
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

  select delivery_fee_vnd, free_delivery_threshold_vnd, pickup_address, bank_bin, bank_account_number, bank_account_name
    into v_fee, v_threshold, v_pickup, v_bin, v_account, v_name from public.settings where id = 1 for share;
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

  if p_method = 'vietqr' and (
    coalesce(v_bin, '') !~ '^[0-9]{6}$'
    or coalesce(v_account, '') !~ '^[0-9]{4,19}$'
    or coalesce(v_name, '') !~ '^[A-Z0-9 .''-]{2,70}$'
    or v_subtotal + v_fee <= 0
  ) then raise exception 'vietqr_unavailable'; end if;

  v_created := clock_timestamp();

  -- Use eight UUID bytes, skipping the version and variant bytes.
  loop
    v_random := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    select 'MN-' || string_agg(substr(v_alphabet, 1 + get_byte(v_random, idx) % length(v_alphabet), 1), '' order by position)
      into v_code from unnest(array[0, 1, 2, 3, 4, 5, 9, 10]) with ordinality as bytes(idx, position);
    insert into public.orders (
      code, idempotency_key, user_id, customer_name, phone, fulfillment_method,
      delivery_address, pickup_address, customer_note, subtotal_vnd, delivery_fee_vnd, total_vnd, status, created_at, payment_expires_at
    ) values (
      v_code, p_idempotency_key, p_user_id, p_customer_name, p_phone, p_fulfillment,
      case when p_fulfillment = 'delivery' then p_address end,
      case when p_fulfillment = 'pickup' then v_pickup end,
      nullif(p_note, ''), v_subtotal, v_fee, v_subtotal + v_fee,
      case when p_method = 'vietqr' then 'awaiting_payment'::public.order_status else 'confirmed'::public.order_status end,
      v_created, case when p_method = 'vietqr' then v_created + interval '30 minutes' end
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

  insert into public.payments (
    order_id, method, status, amount_vnd, bank_bin, bank_account_number, bank_account_name, transfer_reference
  ) values (
    v_order_id, p_method, 'pending', v_subtotal + v_fee,
    case when p_method = 'vietqr' then v_bin end,
    case when p_method = 'vietqr' then v_account end,
    case when p_method = 'vietqr' then v_name end,
    case when p_method = 'vietqr' then replace(v_code, '-', '') end
  );
  return v_code;
end;
$$;

revoke all on function public.create_order(uuid, text, text, public.fulfillment_method, text, text, jsonb, integer, uuid, public.payment_method)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, public.fulfillment_method, text, text, jsonb, integer, uuid, public.payment_method)
  to service_role;

create index orders_created_idx on public.orders (created_at desc, id desc);
create index orders_status_created_idx on public.orders (status, created_at desc, id desc);

create function public.expire_vietqr_orders()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
  v_now timestamptz := clock_timestamp();
begin
  with expired as (
    update public.orders set status = 'cancelled', cancelled_at = v_now,
      cancel_reason = 'Đơn đã hủy do quá hạn thanh toán'
    where status = 'awaiting_payment' and payment_expires_at <= v_now
    returning id
  )
  update public.payments set status = 'expired'
  from expired where order_id = expired.id and method = 'vietqr' and status = 'pending';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.expire_vietqr_orders() from public, anon, authenticated;

create function public.admin_transition_order(p_code text, p_action text, p_reason text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_now timestamptz;
  v_next public.order_status;
begin
  if not private.is_admin() then raise insufficient_privilege; end if;
  -- Both workflows lock orders before modifying the corresponding payment.
  select * into v_order from public.orders where code = p_code for update;
  if not found then return false; end if;
  v_now := clock_timestamp();
  if v_order.status = 'awaiting_payment' and v_order.payment_expires_at <= v_now then
    update public.orders set status = 'cancelled', cancelled_at = v_now,
      cancel_reason = 'Đơn đã hủy do quá hạn thanh toán' where id = v_order.id;
    update public.payments set status = 'expired'
    where order_id = v_order.id and method = 'vietqr' and status = 'pending';
    return false;
  end if;
  select * into v_payment from public.payments where order_id = v_order.id for update;
  if not found then return false; end if;

  if p_action = 'confirm_payment' and v_order.status = 'awaiting_payment'
    and v_payment.method = 'vietqr' and v_payment.status = 'pending' then
    v_next := 'confirmed';
    update public.payments set status = 'paid', paid_at = v_now, confirmed_by = auth.uid() where id = v_payment.id;
  elsif p_action = 'preparing' and v_order.status = 'confirmed' then
    v_next := 'preparing';
  elsif p_action = 'out_for_delivery' and v_order.status = 'preparing' and v_order.fulfillment_method = 'delivery' then
    v_next := 'out_for_delivery';
  elsif p_action = 'ready_for_pickup' and v_order.status = 'preparing' and v_order.fulfillment_method = 'pickup' then
    v_next := 'ready_for_pickup';
  elsif p_action = 'completed' and v_order.status in ('out_for_delivery', 'ready_for_pickup') then
    v_next := 'completed';
    if v_payment.method = 'cod' and v_payment.status = 'pending' then
      update public.payments set status = 'paid', paid_at = v_now, confirmed_by = auth.uid() where id = v_payment.id;
    end if;
  elsif p_action = 'cancelled' and v_order.status not in ('completed', 'cancelled')
    and length(btrim(p_reason)) between 1 and 300 then
    v_next := 'cancelled';
    update public.payments set status = 'cancelled' where id = v_payment.id and status = 'pending';
  else
    return false;
  end if;
  update public.orders set status = v_next,
    cancelled_at = case when v_next = 'cancelled' then v_now end,
    cancel_reason = case when v_next = 'cancelled' then btrim(p_reason) end
  where id = v_order.id;
  return true;
end;
$$;
revoke all on function public.admin_transition_order(text, text, text) from public, anon, authenticated;
grant execute on function public.admin_transition_order(text, text, text) to authenticated;

create table public.admin_order_signal (
  id smallint primary key check (id = 1),
  order_count bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.admin_order_signal (id) values (1);
alter table public.admin_order_signal enable row level security;
revoke all on public.admin_order_signal from anon, authenticated;
grant select on public.admin_order_signal to authenticated;
create policy admin_order_signal_read on public.admin_order_signal for select to authenticated using (private.is_admin());

create function private.signal_admin_order()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from changed_orders) then
    update public.admin_order_signal set
      order_count = order_count + case when tg_op = 'INSERT' then (select count(*) from changed_orders) else 0 end,
      updated_at = clock_timestamp() where id = 1;
  end if;
  return null;
end;
$$;
create trigger signal_admin_insert after insert on public.orders
referencing new table as changed_orders for each statement execute function private.signal_admin_order();
create trigger signal_admin_update after update on public.orders
referencing new table as changed_orders for each statement execute function private.signal_admin_order();

alter publication supabase_realtime add table public.admin_order_signal;

commit;
