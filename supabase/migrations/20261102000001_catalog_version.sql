-- A fingerprint of the shared catalogues, so phones keep a copy and only
-- download them again when something changed (a seed.sql run, a migration).

create or replace function public.catalog_version()
returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'products', md5(coalesce((select string_agg(p::text, '|' order by p.id)
                              from public.products p where p.household_id is null), '')),
    'ingredients', md5(coalesce((select string_agg(c::text, '|' order by c.name)
                                 from public.ingredient_catalog c), ''))
  )
$$;
