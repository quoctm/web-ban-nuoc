create or replace function public.search_menu(p_query text default '', p_category text default null)
returns setof public.products
language sql stable security invoker set search_path = ''
as $$
  with term as (
    select public.normalize_menu_text(left(coalesce(p_query, ''), 120)) as original
  ), tokens as (
    -- Only ASCII letters and digits can reach to_tsquery as lexemes.
    select original, btrim(regexp_replace(original, '[^a-z0-9]+', ' ', 'g')) as text
    from term
  ), query as (
    select original, text,
      case when text <> '' then to_tsquery('pg_catalog.simple', replace(text, ' ', ' & ') || ':*') end as words
    from tokens
  )
  select p.*
  from public.products p
  join public.categories c on c.id = p.category_id
  cross join query q
  where p.is_active and c.is_active
    and (p_category is null or c.slug = p_category)
    and (
      q.original = '' or p.search_vector @@ q.words
      or (length(q.text) >= 3 and p.search_text operator(extensions.%>) q.text)
    )
  order by
    case when q.text <> '' then public.normalize_menu_text(p.name) = q.text else false end desc,
    coalesce(ts_rank(p.search_vector, q.words), 0) desc,
    case when length(q.text) >= 3 then extensions.word_similarity(q.text, p.search_text) else 0 end desc,
    c.sort_order, p.slug, p.id;
$$;
