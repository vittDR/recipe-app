-- "Traybake" is folded into "oven": what matters is that the dish goes in the
-- oven, not what it sits on. The traybake words now land on the oven tag, and
-- recipes tagged traybake are tagged oven instead (once).

update public.tag_catalog
set aliases = array(
  select distinct a from unnest(aliases || array['traybake', 'tray bake', 'sheet pan', 'sheet-pan', 'sheet pan dinner', 'à la plaque', 'plaque au four']) a
)
where name = 'oven' and household_id is null;

delete from public.tag_catalog where name = 'traybake' and household_id is null;

update public.recipes r set tags = (
  select array_agg(t order by first) from (
    select case when t = 'traybake' then 'oven' else t end as t, min(ord) as first
    from unnest(r.tags) with ordinality u(t, ord)
    group by 1
  ) x
)
where 'traybake' = any(r.tags);
