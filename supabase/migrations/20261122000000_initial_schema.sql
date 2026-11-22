create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.profile_role as enum ('admin', 'customer');
create type public.product_size as enum ('M', 'L');
create type public.fulfillment_method as enum ('delivery', 'pickup');
create type public.order_status as enum (
  'awaiting_payment', 'confirmed', 'preparing', 'out_for_delivery',
  'ready_for_pickup', 'completed', 'cancelled'
);
create type public.payment_method as enum ('cod', 'vietqr');
create type public.payment_status as enum ('pending', 'paid', 'expired', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.profile_role not null default 'customer',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null,
  image_path text,
  is_active boolean not null default true,
  is_available boolean not null default true,
  allow_sugar boolean not null default true,
  allow_ice boolean not null default true,
  search_text text not null,
  search_vector tsvector not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  size public.product_size not null,
  price_vnd integer not null check (price_vnd >= 0),
  is_available boolean not null default true,
  unique (product_id, size)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid references public.profiles (id) on delete set null,
  guest_secret_hash text,
  idempotency_key uuid not null unique,
  customer_name text not null,
  phone text not null check (phone ~ '^0[0-9]{9}$'),
  fulfillment_method public.fulfillment_method not null,
  delivery_address text,
  pickup_address text,
  customer_note text,
  subtotal_vnd integer not null check (subtotal_vnd >= 0),
  delivery_fee_vnd integer not null check (delivery_fee_vnd >= 0),
  total_vnd integer not null check (total_vnd >= 0),
  status public.order_status not null,
  payment_expires_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_vnd::bigint = subtotal_vnd::bigint + delivery_fee_vnd),
  check (
    (fulfillment_method = 'delivery' and nullif(btrim(delivery_address), '') is not null and pickup_address is null)
    or (fulfillment_method = 'pickup' and nullif(btrim(pickup_address), '') is not null
      and delivery_address is null and delivery_fee_vnd = 0)
  ),
  check (status <> 'awaiting_payment' or payment_expires_at is not null)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  variant_id uuid not null references public.product_variants (id),
  product_name text not null,
  size public.product_size not null,
  unit_price_vnd integer not null check (unit_price_vnd >= 0),
  quantity integer not null check (quantity > 0),
  sugar_level text,
  ice_level text
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id),
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount_vnd integer not null check (amount_vnd >= 0),
  bank_bin text,
  bank_account_number text,
  bank_account_name text,
  transfer_reference text unique,
  paid_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (method <> 'vietqr' or (
    nullif(btrim(bank_bin), '') is not null
    and nullif(btrim(bank_account_number), '') is not null
    and nullif(btrim(bank_account_name), '') is not null
    and nullif(btrim(transfer_reference), '') is not null
  ))
);

create table public.settings (
  id smallint primary key check (id = 1),
  delivery_fee_vnd integer not null check (delivery_fee_vnd >= 0),
  free_delivery_threshold_vnd integer not null check (free_delivery_threshold_vnd >= 0),
  pickup_address text not null,
  bank_bin text not null,
  bank_account_number text not null,
  bank_account_name text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table public.checkout_rate_limits (
  subject_hash text not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null check (expires_at > window_start),
  primary key (subject_hash, window_start)
);

create index products_category_idx on public.products (category_id);
create index products_search_vector_idx on public.products using gin (search_vector);
create index products_search_text_idx on public.products using gin (search_text extensions.gin_trgm_ops);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_payment_expiry_idx on public.orders (payment_expires_at) where status = 'awaiting_payment';
create index order_items_order_idx on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (variant_id);
create index checkout_rate_limits_expiry_idx on public.checkout_rate_limits (expires_at);

create function public.normalize_menu_text(value text)
returns text language sql stable strict set search_path = ''
as $$
  select btrim(regexp_replace(
    extensions.unaccent('extensions.unaccent'::regdictionary, translate(lower(value), 'đ', 'd')),
    '[[:space:]]+', ' ', 'g'
  ));
$$;

create function public.set_product_search()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.search_text := public.normalize_menu_text(new.name || ' ' || new.description);
  new.search_vector :=
    setweight(to_tsvector('pg_catalog.simple', public.normalize_menu_text(new.name)), 'A') ||
    setweight(to_tsvector('pg_catalog.simple', public.normalize_menu_text(new.description)), 'B');
  return new;
end;
$$;

create trigger products_set_search before insert or update on public.products
for each row execute function public.set_product_search();

create function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.settings for each row execute function public.set_updated_at();

create function public.create_customer_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger auth_user_create_profile after insert on auth.users
for each row execute function public.create_customer_profile();

insert into public.profiles (id) select id from auth.users on conflict do nothing;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;
revoke all on function public.create_customer_profile() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.set_product_search() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;
alter table public.checkout_rate_limits enable row level security;

revoke all on public.profiles, public.categories, public.products, public.product_variants,
  public.orders, public.order_items, public.payments, public.settings, public.checkout_rate_limits
  from anon, authenticated;

grant select on public.categories, public.products, public.product_variants to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_variants to authenticated;
grant select on public.profiles, public.order_items, public.payments, public.settings to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select (
  id, code, user_id, customer_name, phone, fulfillment_method, delivery_address,
  pickup_address, customer_note, subtotal_vnd, delivery_fee_vnd, total_vnd, status,
  payment_expires_at, cancelled_at, cancel_reason, created_at, updated_at
) on public.orders to authenticated;
grant insert, update on public.settings to authenticated;
grant all on public.profiles, public.categories, public.products, public.product_variants,
  public.orders, public.order_items, public.payments, public.settings, public.checkout_rate_limits
  to service_role;

create policy profiles_read_own on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select private.is_admin()));
create policy profiles_edit_display_name on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy categories_read_public on public.categories for select to anon, authenticated using (is_active);
create policy products_read_public on public.products for select to anon, authenticated
using (is_active and exists (
  select 1 from public.categories where id = category_id and is_active
));
create policy variants_read_public on public.product_variants for select to anon, authenticated
using (is_available and exists (
  select 1 from public.products p
  join public.categories c on c.id = p.category_id
  where p.id = product_id and p.is_active and c.is_active
));
create policy categories_admin on public.categories for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy products_admin on public.products for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy variants_admin on public.product_variants for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy orders_read_own on public.orders for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy order_items_read_order on public.order_items for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id));
create policy payments_read_order on public.payments for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id));
create policy settings_admin on public.settings for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create function public.search_menu(p_query text default '', p_category text default null)
returns setof public.products
language sql stable security invoker set search_path = ''
as $$
  with term as (
    select public.normalize_menu_text(left(coalesce(p_query, ''), 80)) as text
  ), query as (
    select text, plainto_tsquery('pg_catalog.simple', text) as words from term
  )
  select p.*
  from public.products p
  join public.categories c on c.id = p.category_id
  cross join query q
  where p.is_active and c.is_active
    and (p_category is null or c.slug = p_category)
    and (
      q.text = '' or p.search_vector @@ q.words
      or (length(q.text) >= 3 and p.search_text operator(extensions.%>) q.text)
    )
  order by
    case when q.text <> '' then public.normalize_menu_text(p.name) = q.text else false end desc,
    case when q.text <> '' then ts_rank(p.search_vector, q.words) else 0 end desc,
    case when length(q.text) >= 3 then extensions.word_similarity(q.text, p.search_text) else 0 end desc,
    c.sort_order, p.slug, p.id;
$$;

grant usage on schema extensions to anon, authenticated;
revoke all on function public.normalize_menu_text(text) from public;
grant execute on function public.normalize_menu_text(text) to anon, authenticated, service_role;
revoke all on function public.search_menu(text, text) from public;
grant execute on function public.search_menu(text, text) to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_admin on storage.objects for all to authenticated
using (bucket_id = 'product-images' and (select private.is_admin()))
with check (bucket_id = 'product-images' and (select private.is_admin()));
