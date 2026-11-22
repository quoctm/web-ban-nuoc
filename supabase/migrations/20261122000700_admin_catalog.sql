begin;

create function public.admin_save_product(
  p_id uuid, p_category uuid, p_name text, p_slug text, p_description text,
  p_active boolean, p_available boolean, p_sugar boolean, p_ice boolean,
  p_image text, p_medium integer, p_large integer
)
returns void language plpgsql security invoker set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_admin() then raise insufficient_privilege; end if;
  if p_id is null then
    insert into public.products (category_id, name, slug, description, is_active, is_available, allow_sugar, allow_ice, image_path)
    values (p_category, p_name, p_slug, p_description, p_active, p_available, p_sugar, p_ice, p_image)
    returning id into v_id;
  else
    update public.products set category_id = p_category, name = p_name, slug = p_slug,
      description = p_description, is_active = p_active, is_available = p_available,
      allow_sugar = p_sugar, allow_ice = p_ice, image_path = coalesce(p_image, image_path)
    where id = p_id returning id into v_id;
    if not found then raise no_data_found; end if;
  end if;
  insert into public.product_variants (product_id, size, price_vnd) values (v_id, 'M', p_medium)
  on conflict (product_id, size) do update set price_vnd = excluded.price_vnd, is_available = true;
  if p_large is null then
    update public.product_variants set is_available = false where product_id = v_id and size = 'L';
  else
    insert into public.product_variants (product_id, size, price_vnd) values (v_id, 'L', p_large)
    on conflict (product_id, size) do update set price_vnd = excluded.price_vnd, is_available = true;
  end if;
end;
$$;
revoke all on function public.admin_save_product(uuid, uuid, text, text, text, boolean, boolean, boolean, boolean, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_save_product(uuid, uuid, text, text, text, boolean, boolean, boolean, boolean, text, integer, integer)
  to authenticated;

commit;
