-- Recipe lines now arrive with the item picked in the app. Keep only items
-- the recipe's household can see (shared, or its own); anything else is
-- matched by name as before.

create or replace function public.recipe_ingredient_product()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := (select r.household_id from public.recipes r where r.id = new.recipe_id);
  v_product public.products;
begin
  if tg_op = 'UPDATE' and new.name is distinct from old.name and new.product_id is not distinct from old.product_id then
    new.product_id := null; -- renamed: find its product again
  end if;
  if new.product_id is not null then
    select * into v_product from public.products
    where id = new.product_id and (household_id is null or household_id = v_household);
    new.product_id := v_product.id;
  end if;
  if new.product_id is null then
    -- Resolve first: a product it creates isn't visible to a query already running.
    new.product_id := public.resolve_product(v_household, new.name, new.aisle);
    select * into v_product from public.products where id = new.product_id;
  end if;
  -- Lines the catalogue didn't place get the product's aisle.
  if v_product.id is not null and new.aisle = 'other' then
    new.aisle := v_product.default_aisle;
  end if;
  return new;
end;
$$;
