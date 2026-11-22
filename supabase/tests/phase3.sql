-- Run with psql -v ON_ERROR_STOP=1 as postgres on an isolated seeded local database.
begin;
insert into auth.users (id) values
  ('a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000003');
update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000003';

insert into public.settings (
  id, delivery_fee_vnd, free_delivery_threshold_vnd, pickup_address, bank_bin, bank_account_number, bank_account_name
) values (1, 15000, 150000, 'QUAN THU', '970436', '0000000000', 'TAI KHOAN MAU')
on conflict (id) do update set bank_bin = excluded.bank_bin, bank_account_number = excluded.bank_account_number,
  bank_account_name = excluded.bank_account_name;

do $$
declare
  cart jsonb;
  order_code text;
  late_code text;
  cron_code text;
  retry_key uuid := gen_random_uuid();
begin
  select jsonb_build_array(jsonb_build_object('variant_id', v.id, 'quantity', 1, 'expected_price', v.price_vnd,
    'sugar_level', '50%', 'ice_level', 'Ít đá')) into strict cart
  from public.product_variants v join public.products p on p.id = v.product_id
  where p.slug = 'tra-sua-tran-chau' and v.size = 'M';

  order_code := public.create_order(retry_key, 'Khách Thử', '0900000000', 'pickup', '', '', cart, 0,
    'a0000000-0000-4000-8000-000000000001', 'vietqr');
  if order_code <> public.create_order(retry_key, 'Khách Thử', '0900000000', 'pickup', '', '', cart, 0,
    'a0000000-0000-4000-8000-000000000001', 'vietqr') then raise exception 'Sai mã khi gửi lại'; end if;
  begin
    perform public.create_order(retry_key, 'Khách Thử', '0900000000', 'pickup', '', '', cart, 0,
      'a0000000-0000-4000-8000-000000000002', 'vietqr');
    raise check_violation;
  exception when raise_exception then
    if sqlerrm <> 'invalid_order' then raise; end if;
  end;
  if not exists (select 1 from public.orders o join public.payments p on p.order_id = o.id
    where o.code = order_code and o.status = 'awaiting_payment'
    and o.payment_expires_at = o.created_at + interval '30 minutes'
    and p.bank_account_number = '0000000000' and p.bank_account_name = 'TAI KHOAN MAU'
    and p.transfer_reference = replace(order_code, '-', '') and p.amount_vnd = o.total_vnd) then
    raise exception 'Sai thời hạn hoặc thông tin thanh toán';
  end if;

  late_code := public.create_order(gen_random_uuid(), 'Khách Thử', '0900000000', 'pickup', '', '', cart, 0, null, 'vietqr');
  cron_code := public.create_order(gen_random_uuid(), 'Khách Thử', '0900000000', 'pickup', '', '', cart, 0, null, 'vietqr');
  update public.orders set payment_expires_at = clock_timestamp() where code in (late_code, cron_code);
  perform set_config('test.phase3.order_code', order_code, true);
  perform set_config('test.phase3.late_code', late_code, true);
  perform set_config('test.phase3.cron_code', cron_code, true);
end;
$$;

set local role anon;
do $$
begin
  begin
    perform code from public.orders;
    raise exception 'Khách vãng lai đọc được đơn';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_transition_order(current_setting('test.phase3.order_code'), 'confirm_payment', '');
    raise exception 'Khách vãng lai gọi được hàm admin';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('product-images', 'guest-test.png');
    raise exception 'Khách vãng lai tải được ảnh';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
do $$
begin
  if exists (select 1 from public.orders where code = current_setting('test.phase3.order_code')) then
    raise exception 'Khách đọc được đơn của người khác';
  end if;
  if exists (select 1 from public.payments) or exists (select 1 from public.order_items) then
    raise exception 'Khách đọc được thanh toán hoặc món của đơn khác';
  end if;
  if exists (select 1 from public.admin_order_signal) then raise exception 'Khách nhận được tín hiệu admin'; end if;
  begin
    perform public.admin_transition_order(current_setting('test.phase3.order_code'), 'confirm_payment', '');
    raise exception 'Khách gọi được hàm admin';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_save_product(null, null, '', '', '', true, true, true, true, null, 0, null);
    raise exception 'Khách gọi được hàm lưu món';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('product-images', 'customer-test.png');
    raise exception 'Khách tải được ảnh';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
do $$
begin
  if not exists (select 1 from public.orders where code = current_setting('test.phase3.order_code')) then
    raise exception 'Chủ đơn không đọc được đơn của mình';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000003', true);
do $$
declare
  order_code text := current_setting('test.phase3.order_code');
  test_category uuid;
  test_product uuid;
  medium_id uuid;
begin
  if not exists (select 1 from public.admin_order_signal where order_count >= 3) then raise exception 'Thiếu tín hiệu admin'; end if;
  if public.admin_transition_order(order_code, 'completed', '') then raise exception 'Cho phép bỏ qua bước'; end if;
  if not public.admin_transition_order(order_code, 'confirm_payment', '') then raise exception 'Không xác nhận được trước hạn'; end if;
  if public.admin_transition_order(current_setting('test.phase3.late_code'), 'confirm_payment', '') then
    raise exception 'Cho phép xác nhận sau hạn';
  end if;
  if not public.admin_transition_order(order_code, 'cancelled', 'Kiểm thử đối soát') then raise exception 'Không hủy được đơn'; end if;
  if not exists (select 1 from public.payments p join public.orders o on o.id = p.order_id
    where o.code = order_code and p.status = 'paid' and p.confirmed_by = auth.uid()) then
    raise exception 'Không giữ tiền đã xác nhận';
  end if;
  insert into storage.objects (bucket_id, name) values ('product-images', 'admin-test.png');
  select category_id into strict test_category from public.products where slug = 'tra-sua-tran-chau';
  perform public.admin_save_product(null, test_category, 'Nước Thử', 'nuoc-thu', '', true, true, false, false, 'admin-test.png', 10000, 20000);
  select id into strict test_product from public.products where slug = 'nuoc-thu';
  select id into strict medium_id from public.product_variants where product_id = test_product and size = 'M';
  perform public.admin_save_product(test_product, test_category, 'Nước Thử', 'nuoc-thu', '', false, true, false, false, null, 12000, null);
  if not exists (select 1 from public.product_variants where id = medium_id and price_vnd = 12000) or
    not exists (select 1 from public.product_variants where product_id = test_product and size = 'L' and not is_available) or
    not exists (select 1 from public.products where id = test_product and not is_active and image_path = 'admin-test.png') then
    raise exception 'Lưu thay đổi làm mất ảnh hoặc size hiện có';
  end if;
end;
$$;

reset role;
select public.expire_vietqr_orders();
do $$
begin
  if (select count(*) from public.orders o join public.payments p on p.order_id = o.id
    where o.code in (current_setting('test.phase3.late_code'), current_setting('test.phase3.cron_code'))
      and o.status = 'cancelled' and p.status = 'expired') <> 2 then
    raise exception 'Đơn quá hạn chưa hủy hoặc thanh toán chưa hết hạn';
  end if;
end;
$$;
rollback;
