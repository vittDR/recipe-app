-- Recipe lines the ingredient catalogue doesn't know, most used first. Run in
-- SQL Editor; each name is a candidate catalogue ingredient (with FR/EN/IT
-- names, aisle and nutrition) in seed.sql. Until then the line points at a
-- matching product, or at an item the household got automatically.
select i.name,
       count(*) as lines,
       count(distinct i.recipe_id) as recipes,
       coalesce(p.name_fr, '—') as product,
       case when p.household_id is null then 'shared' else 'household' end as product_kind,
       min(i.raw_text) as example
from public.recipe_ingredients i
left join public.ingredient_catalog c on c.name = i.name
left join public.products p on p.id = i.product_id
where c.name is null
group by i.name, p.name_fr, p.household_id
order by lines desc, i.name;
