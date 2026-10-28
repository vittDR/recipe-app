-- Recipe ingredients point at grocery products, so a recipe line and a list
-- line are the same item. Each ingredient gets its product when saved: the
-- catalogue ingredient's product, else a product whose name or alias matches
-- (the household's own first), else a new household item. Seed recipes only
-- ever use shared products.

alter table public.recipe_ingredients
  add column product_id uuid references public.products (id) on delete set null;

-- Every name a product goes by, as keys, for indexed matching.
create or replace function public.product_keys(p_names text[])
returns text[]
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(array_agg(distinct k), '{}') from (
    select public.product_key(n) as k from unnest(p_names) n
  ) x where k <> ''
$$;

alter table public.products
  add column match_keys text[] generated always as (public.product_keys(array[name_fr, name_en] || aliases)) stored;
create index products_match_keys on public.products using gin (match_keys);

-- The product for a name, without creating one. Catalogue ingredient first,
-- then any name or alias; the household's own items before shared ones, a
-- main name before an alias.
create or replace function public.find_product(p_household uuid, p_name text)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_key text := public.product_key(p_name);
  v_id uuid;
begin
  select id into v_id from public.products where ingredient = lower(trim(p_name));
  if v_id is not null or v_key = '' then
    return v_id;
  end if;
  select p.id into v_id from public.products p
  where p.match_keys @> array[v_key]
    and (p.household_id is null or p.household_id = p_household)
  order by (p.household_id is null), (p.search_key <> v_key)
  limit 1;
  return v_id;
end;
$$;

create or replace function public.resolve_product(p_household uuid, p_name text, p_aisle public.aisle default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := public.find_product(p_household, p_name);
begin
  if v_id is not null or public.product_key(p_name) = '' or p_household is null then
    return v_id;
  end if;
  insert into public.products (household_id, name_fr, default_aisle, created_by)
  values (p_household, trim(p_name), coalesce(p_aisle, 'other'), auth.uid())
  on conflict do nothing
  returning id into v_id;
  -- Someone else created it at the same moment.
  return coalesce(v_id, public.find_product(p_household, p_name));
end;
$$;
revoke execute on function public.find_product(uuid, text) from public, anon, authenticated;
revoke execute on function public.resolve_product(uuid, text, public.aisle) from public, anon, authenticated;

create or replace function public.recipe_ingredient_product()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_product public.products;
begin
  if tg_op = 'UPDATE' and new.name is distinct from old.name and new.product_id is not distinct from old.product_id then
    new.product_id := null; -- renamed: find its product again
  end if;
  if new.product_id is null then
    -- Resolve first: a product it creates isn't visible to a query already running.
    new.product_id := public.resolve_product((select r.household_id from public.recipes r where r.id = new.recipe_id),
                                             new.name, new.aisle);
    select * into v_product from public.products where id = new.product_id;
  else
    select * into v_product from public.products where id = new.product_id;
  end if;
  -- Lines the catalogue didn't place get the product's aisle.
  if v_product.id is not null and new.aisle = 'other' then
    new.aisle := v_product.default_aisle;
  end if;
  return new;
end;
$$;

-- Same as before, except a product created for a new name is found right away
-- (the first add of a new item used to be dropped).
create or replace function public.add_grocery_items(p_items jsonb)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
  v_item jsonb;
  v_product public.products;
  v_product_id uuid;
  v_pref public.household_products;
  v_unit text;
  v_qty real;
  v_existing uuid;
  v_count int := 0;
begin
  if v_household is null then
    raise exception 'no_household';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product := null;
    if v_item ? 'product_id' then
      select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid
        and (household_id is null or household_id = v_household);
    elsif nullif(trim(v_item ->> 'name'), '') is not null then
      -- Resolve first: a product it creates isn't visible to a query already running.
      v_product_id := public.resolve_product(v_household, v_item ->> 'name', (v_item ->> 'aisle')::public.aisle);
      select * into v_product from public.products where id = v_product_id;
    end if;
    continue when v_product.id is null;

    v_unit := nullif(lower(trim(v_item ->> 'unit')), '');
    v_qty := (v_item ->> 'quantity')::real;
    select * into v_pref from public.household_products
    where household_id = v_household and product_id = v_product.id;

    select id into v_existing from public.grocery_items
    where household_id = v_household
      and product_id = v_product.id
      and coalesce(unit, '') = coalesce(v_unit, '')
      and checked_at is null and cleared_at is null
    limit 1;

    if v_existing is not null then
      update public.grocery_items
      set quantity = case when quantity is null or v_qty is null then coalesce(quantity, v_qty)
                          else quantity + v_qty end,
          recipe_id = coalesce(recipe_id, (v_item ->> 'recipe_id')::uuid)
      where id = v_existing;
    else
      insert into public.grocery_items
        (household_id, product_id, name, quantity, unit, aisle, store_id, recipe_id, added_by, sort_key)
      values (
        v_household, v_product.id, v_product.name_fr, v_qty, v_unit,
        coalesce(v_pref.aisle, (v_item ->> 'aisle')::public.aisle, v_product.default_aisle),
        v_pref.store_id,
        (v_item ->> 'recipe_id')::uuid,
        auth.uid(),
        extract(epoch from now())
      );
    end if;

    insert into public.household_products (household_id, product_id, add_count, last_added_at)
    values (v_household, v_product.id, 1, now())
    on conflict (household_id, product_id) do update
      set add_count = public.household_products.add_count + 1, last_added_at = now();
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;


create trigger recipe_ingredients_product
  before insert or update of name, product_id on public.recipe_ingredients
  for each row execute function public.recipe_ingredient_product();

-- A catalogue ingredient added later takes over a shared product that already
-- has its name, in either language or as an alias (Butternut, Lentilles).
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

  insert into public.products (name_fr, name_en, aliases, ingredient, default_aisle)
  select coalesce(c.name_fr, c.name), c.name,
         array_remove(c.aliases || c.name_it, null), c.name, c.default_aisle
  from public.ingredient_catalog c
  where not exists (select 1 from public.products p where p.ingredient = c.name)
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.sync_products_from_catalog() from public, anon, authenticated;

-- Every existing line gets its product (unmatched household lines become
-- household items).
update public.recipe_ingredients set name = name where product_id is null;
