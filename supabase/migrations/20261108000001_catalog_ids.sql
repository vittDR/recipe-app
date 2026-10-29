-- Fixed ids for the catalogue, so its items are the same rows in every
-- environment and are easy to tell from items households create. Catalogue
-- ingredients get an id; the shared product of an ingredient takes that same
-- id, and the shared everyday products get their own. The values are set in
-- seed.sql. Ingredients added later (from the app) get a random id.

alter table public.ingredient_catalog add column if not exists id uuid not null default gen_random_uuid();
alter table public.ingredient_catalog add constraint ingredient_catalog_id_key unique (id);

-- Products already in use take their fixed id; what points at them follows.
alter table public.recipe_ingredients drop constraint recipe_ingredients_product_id_fkey,
  add constraint recipe_ingredients_product_id_fkey foreign key (product_id)
    references public.products (id) on delete set null on update cascade;
alter table public.grocery_items drop constraint grocery_items_product_id_fkey,
  add constraint grocery_items_product_id_fkey foreign key (product_id)
    references public.products (id) on delete set null on update cascade;
alter table public.household_products drop constraint household_products_product_id_fkey,
  add constraint household_products_product_id_fkey foreign key (product_id)
    references public.products (id) on delete cascade on update cascade;
alter table public.taste_rules drop constraint taste_rules_product_id_fkey,
  add constraint taste_rules_product_id_fkey foreign key (product_id)
    references public.products (id) on delete cascade on update cascade;

-- Same as before, and a catalogue ingredient's product has the ingredient's id.
create or replace function public.sync_products_from_catalog()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  update public.products p set ingredient = c.name
  from public.ingredient_catalog c
  where p.household_id is null and p.ingredient is null
    and not exists (select 1 from public.products q where q.ingredient = c.name)
    and p.id = (
      select q.id from public.products q
      where q.household_id is null and q.ingredient is null
        and q.match_keys && array[public.product_key(c.name_fr), public.product_key(c.name)]
      order by (q.search_key <> public.product_key(c.name_fr)), q.created_at
      limit 1);

  insert into public.products (id, name_fr, name_en, aliases, ingredient, default_aisle)
  select c.id, coalesce(c.name_fr, c.name), c.name,
         array_remove(c.aliases || c.name_it, null), c.name, c.default_aisle
  from public.ingredient_catalog c
  where not exists (select 1 from public.products p where p.ingredient = c.name)
  on conflict do nothing;
  get diagnostics v_count = row_count;

  update public.products p set id = c.id
  from public.ingredient_catalog c
  where p.ingredient = c.name and p.id <> c.id
    and not exists (select 1 from public.products q where q.id = c.id);
  return v_count;
end;
$$;
revoke execute on function public.sync_products_from_catalog() from public, anon, authenticated;
