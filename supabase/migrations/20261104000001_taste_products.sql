-- Love / never rules point at catalogue items, like recipe ingredients and
-- list lines: a rule on "champignons" matches every recipe whose ingredients
-- are that product, whatever language the recipe was written in. Rules
-- without a product (older free text: a tag like "curry", a word of the
-- title) still match as text.

alter table public.taste_rules
  add column product_id uuid references public.products (id) on delete cascade;

-- Older free-text rules that name a product become that product's rule.
-- Recipe tags ("soup", "curry") stay text: they mean the dish, not the item.
update public.taste_rules r
set product_id = public.find_product(
  (select m.household_id from public.household_members m where m.user_id = r.user_id limit 1), r.value)
where r.kind in ('never', 'love')
  and r.product_id is null
  and not exists (select 1 from public.recipes x where lower(r.value) = any (x.tags));
