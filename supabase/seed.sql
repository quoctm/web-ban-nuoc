begin;

insert into public.categories (slug, name, sort_order)
values
  ('tra-sua', 'Trà sữa', 1),
  ('ca-phe', 'Cà phê', 2),
  ('nuoc-ep', 'Nước ép', 3),
  ('nuoc-dong-chai', 'Nước đóng chai', 4)
on conflict (slug) do nothing;

with menu (category_slug, name, slug, description, price_m, price_l) as (
  values
    ('tra-sua', 'Trà sữa trân châu', 'tra-sua-tran-chau', 'Trà đen pha sữa thơm, thêm trân châu đường đen dai mềm.', 39000, 49000),
    ('tra-sua', 'Trà sữa ô long', 'tra-sua-o-long', 'Ô long rang thơm hòa với sữa, hậu vị thanh.', 42000, 52000),
    ('tra-sua', 'Trà sữa matcha', 'tra-sua-matcha', 'Matcha chát nhẹ, cân bằng với vị sữa béo.', 45000, 55000),
    ('tra-sua', 'Trà sữa khoai môn', 'tra-sua-khoai-mon', 'Khoai môn thơm bùi pha cùng sữa tươi.', 43000, 53000),
    ('tra-sua', 'Trà sữa lài', 'tra-sua-lai', 'Trà lài ướp hoa nhẹ, dịu vị với sữa.', 39000, 49000),
    ('ca-phe', 'Cà phê sữa đá', 'ca-phe-sua-da', 'Cà phê phin đậm vị với sữa đặc và đá viên.', 32000, 42000),
    ('ca-phe', 'Bạc xỉu', 'bac-xiu', 'Sữa tươi và sữa đặc với một chút cà phê phin.', 35000, 45000),
    ('ca-phe', 'Cà phê đen đá', 'ca-phe-den-da', 'Cà phê phin nguyên chất, thơm rang và đậm hậu vị.', 29000, 39000),
    ('ca-phe', 'Cà phê muối', 'ca-phe-muoi', 'Cà phê phin phủ lớp kem muối mịn.', 42000, 52000),
    ('ca-phe', 'Cà phê dừa', 'ca-phe-dua', 'Cà phê hòa cùng cốt dừa béo thơm.', 45000, 55000),
    ('nuoc-ep', 'Nước cam ép', 'nuoc-cam-ep', 'Cam tươi ép theo từng ly, chua ngọt tự nhiên.', 45000, 55000),
    ('nuoc-ep', 'Nước ép ổi', 'nuoc-ep-oi', 'Ổi hồng ép tươi, thơm dịu và thanh mát.', 40000, 50000),
    ('nuoc-ep', 'Nước ép dứa', 'nuoc-ep-dua', 'Dứa chín ép tươi, vị chua nhẹ và ngọt hậu.', 40000, 50000),
    ('nuoc-ep', 'Nước ép dưa hấu', 'nuoc-ep-dua-hau', 'Dưa hấu ép tươi, vị ngọt nhẹ và mát.', 39000, 49000),
    ('nuoc-ep', 'Nước ép táo', 'nuoc-ep-tao', 'Táo đỏ ép tươi, hương thơm và hậu vị thanh.', 45000, 55000),
    ('nuoc-dong-chai', 'Nước khoáng', 'nuoc-khoang', 'Nước khoáng đóng chai, có hai dung tích.', 12000, 18000),
    ('nuoc-dong-chai', 'Nước khoáng có ga', 'nuoc-khoang-co-ga', 'Nước khoáng có ga nhẹ, uống lạnh.', 19000, 29000),
    ('nuoc-dong-chai', 'Trà xanh đóng chai', 'tra-xanh-dong-chai', 'Trà xanh giải nhiệt, đóng chai tiện mang theo.', 18000, 25000),
    ('nuoc-dong-chai', 'Nước dừa đóng chai', 'nuoc-dua-dong-chai', 'Nước dừa dịu ngọt, ngon khi uống lạnh.', 24000, 34000),
    ('nuoc-dong-chai', 'Soda chanh đóng chai', 'soda-chanh-dong-chai', 'Soda chanh có ga, vị chanh tươi mát.', 22000, 32000)
), inserted as (
  insert into public.products (category_id, name, slug, description, allow_sugar, allow_ice)
  select c.id, m.name, m.slug, m.description, c.slug <> 'nuoc-dong-chai', c.slug <> 'nuoc-dong-chai'
  from menu m join public.categories c on c.slug = m.category_slug
  on conflict (slug) do nothing
  returning id, slug
), target_products as (
  select id, slug from inserted
  union all
  select p.id, p.slug from public.products p join menu m on m.slug = p.slug
)
insert into public.product_variants (product_id, size, price_vnd)
select p.id, v.size::public.product_size, v.price
from target_products p join menu m on m.slug = p.slug
cross join lateral (values ('M', m.price_m), ('L', m.price_l)) as v(size, price)
on conflict (product_id, size) do nothing;

commit;
