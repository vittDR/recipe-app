-- Groceries v2.
--
-- 1. Catalogue defaults: each product says what you usually buy (2 lemons,
--    2 l of milk, 800 g of chicken thighs) and which units make sense for it.
-- 2. The person who created a household can edit the shared catalogue.
-- 3. List items written with ids made on the phone, so a retried save never
--    adds an item twice (put_grocery_item, create_household_product).
-- 4. "Vittorio added 4 items to the list": adds are collected per person and
--    pushed to the rest of the household once they've been quiet 5 minutes.
-- 5. Notification switches: all on/off, and per kind.

-- ---------------------------------------------------------------------------
-- 1. Catalogue defaults
-- ---------------------------------------------------------------------------

-- Units are free text; the app translates the ones it knows (piece, g, kg, ml,
-- l, pack, jar, bottle, can, bunch, bag, stalk) and shows others as typed.
alter table public.products
  add column default_unit text,
  add column default_qty real check (default_qty is null or default_qty > 0),
  add column suggested_units text[] not null default '{}';

-- Fills defaults for shared products that have none: per aisle, then known
-- items. Never overwrites a value someone set. Safe to re-run; seed.sql calls
-- it after loading the catalogue.
create or replace function public.apply_product_defaults()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  with aisle_defaults (aisle, unit, qty, units) as (values
    ('produce'::public.aisle, 'piece', 1::real, '{piece,g,kg,bunch,bag,pack}'::text[]),
    ('meat_fish', 'g', 500, '{g,kg,piece,pack}'),
    ('dairy_eggs', 'pack', 1, '{pack,piece,g,jar,l}'),
    ('bakery', 'piece', 1, '{piece,pack}'),
    ('pantry', 'pack', 1, '{pack,jar,can,bottle,g,kg}'),
    ('spices', 'jar', 1, '{jar,pack,g}'),
    ('frozen', 'pack', 1, '{pack,g,kg}'),
    ('drinks', 'bottle', 1, '{bottle,pack,l}'),
    ('hygiene', 'piece', 1, '{piece,pack,bottle}'),
    ('household', 'pack', 1, '{pack,piece,bottle}'),
    ('other', 'piece', null, '{piece,pack,g,kg}')
  ),
  known (key, unit, qty) as (values
    -- fruit and veg
    ('citron', 'piece', 2::real), ('citron vert', 'piece', 2), ('bananes', 'piece', 6), ('pomme', 'piece', 6),
    ('poire', 'piece', 4), ('orange', 'piece', 4), ('kiwis', 'piece', 4), ('tomate', 'piece', 4),
    ('oignon', 'piece', 3), ('echalote', 'piece', 3), ('courgette', 'piece', 2), ('poivron', 'piece', 2),
    ('avocat', 'piece', 2), ('patate douce', 'piece', 2), ('concombre', 'piece', 1),
    ('carotte', 'kg', 1), ('pomme de terre', 'kg', 1), ('clementines', 'kg', 1), ('raisin', 'g', 500),
    ('haricots verts', 'g', 500), ('pois gourmands', 'g', 250), ('champignons', 'g', 250),
    ('tomates cerises', 'pack', 1), ('fraises', 'pack', 1), ('framboises', 'pack', 1), ('myrtilles', 'pack', 1),
    ('aneth', 'bunch', 1), ('basilic', 'bunch', 1), ('ciboulette', 'bunch', 1), ('coriandre', 'bunch', 1),
    ('estragon', 'bunch', 1), ('menthe', 'bunch', 1), ('persil', 'bunch', 1), ('romarin', 'bunch', 1),
    ('sauge', 'bunch', 1), ('thym', 'bunch', 1), ('oseille', 'bunch', 1), ('radis', 'bunch', 1),
    ('salade', 'piece', 1), ('roquette', 'bag', 1), ('epinards', 'bag', 1), ('mache', 'bag', 1),
    ('germes de soja', 'bag', 1), ('feuilles de combava', 'pack', 1), ('feuilles de perilla', 'pack', 1),
    ('citronnelle', 'stalk', null),
    -- meat and fish
    ('cuisse de poulet', 'g', 800), ('lardons', 'g', 200), ('crevettes', 'g', 300), ('moules', 'kg', 1),
    ('jambon', 'pack', 1), ('jambon cru', 'pack', 1), ('saumon fume', 'pack', 1), ('escalopes de poulet', 'pack', 1),
    ('poulet au citron', 'pack', 1), ('chorizo', 'piece', 1), ('saucisse', 'piece', 4),
    ('pave de saumon', 'piece', 2), ('dos de cabillaud', 'piece', 2), ('steak de boeuf', 'piece', 2),
    -- dairy and eggs
    ('lait', 'l', 2), ('lait d avoine', 'l', 1), ('oeufs', 'piece', 6), ('beurre', 'g', 250),
    ('comte', 'g', 200), ('emmental', 'g', 200), ('feta', 'g', 200), ('fontina', 'g', 200),
    ('parmesan', 'g', 200), ('pecorino', 'g', 200), ('ricotta', 'g', 250), ('mozzarella', 'piece', 2),
    ('reblochon', 'piece', 1), ('creme fraiche', 'jar', 1), ('fromage blanc', 'jar', 1), ('yaourt grec', 'jar', 1),
    ('creme liquide', 'piece', 1),
    -- bakery
    ('croissants', 'piece', 4), ('pain de mie', 'pack', 1), ('grissini', 'pack', 1), ('wasa fibres', 'pack', 1),
    ('tortillas', 'pack', 1),
    -- pantry
    ('huile d olive', 'bottle', 1), ('huile de sesame', 'bottle', 1), ('huile vegetale', 'bottle', 1),
    ('sauce soja', 'bottle', 1), ('sauce d huitre', 'bottle', 1), ('sauce de poisson', 'bottle', 1),
    ('sauce worcestershire', 'bottle', 1), ('vinaigre', 'bottle', 1), ('vinaigre balsamique', 'bottle', 1),
    ('mirin', 'bottle', 1), ('sirop d erable', 'bottle', 1), ('sirop de riz', 'bottle', 1),
    ('sriracha', 'bottle', 1), ('ketchup', 'bottle', 1), ('coulis de tomate', 'bottle', 1),
    ('moutarde', 'jar', 1), ('moutarde de dijon', 'jar', 1), ('confiture', 'jar', 1), ('miel', 'jar', 1),
    ('mayonnaise', 'jar', 1), ('pesto', 'jar', 1), ('harissa', 'jar', 1), ('cornichons', 'jar', 1),
    ('capres', 'jar', 1), ('olives', 'jar', 1), ('beurre de cacahuete', 'jar', 1), ('pate de curry', 'jar', 1),
    ('pate de miso', 'jar', 1), ('pate de tamarin', 'jar', 1), ('gochujang', 'jar', 1), ('ssamjang', 'jar', 1),
    ('concentre de tomate', 'jar', 1), ('gingembre marine', 'jar', 1), ('pate nasi goreng', 'jar', 1),
    ('tomates concassees', 'can', 2), ('haricots noirs', 'can', 1), ('haricots rouges', 'can', 1),
    ('pois chiches', 'can', 1), ('lait de coco', 'can', 1), ('thon', 'can', 1), ('sardines', 'can', 1),
    ('mais', 'can', 1), ('farine', 'kg', 1), ('sucre', 'kg', 1),
    -- spices, drinks, hygiene, household
    ('sel', 'pack', 1), ('bouquet garni', 'pack', 1),
    ('eau', 'pack', 1), ('eau gazeuse', 'pack', 1), ('biere', 'pack', 1),
    ('shampoing', 'bottle', 1), ('apres shampoing', 'bottle', 1), ('gel douche', 'bottle', 1),
    ('savon pour les mains', 'bottle', 1), ('cotons demaquillants', 'pack', 1), ('cotons tiges', 'pack', 1),
    ('lingettes humides', 'pack', 1), ('rasoirs', 'pack', 1), ('brosses a dents', 'pack', 1),
    ('liquide vaisselle', 'bottle', 1), ('nettoyant multi usage', 'bottle', 1), ('adoucissant', 'bottle', 1),
    ('lessive', 'bottle', 1), ('ampoules', 'piece', 1), ('scotch', 'piece', 1)
  ),
  chosen as (
    select p.id,
           coalesce(k.unit, a.unit) as unit,
           case when k.key is not null then k.qty else a.qty end as qty,
           a.units
    from public.products p
    join aisle_defaults a on a.aisle = p.default_aisle
    left join known k on k.key = p.search_key
    where p.household_id is null and p.default_unit is null
  )
  update public.products p
  set default_unit = c.unit,
      default_qty = c.qty,
      suggested_units = case when p.suggested_units = '{}'
                             then array_prepend(c.unit, array_remove(c.units, c.unit))
                             else p.suggested_units end
  from chosen c
  where p.id = c.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.apply_product_defaults() from public, anon, authenticated;

select public.apply_product_defaults();

-- ---------------------------------------------------------------------------
-- 2. Catalogue admin: whoever created a household edits the shared catalogue.
-- (One household per copy of the app for now; see docs/SETUP.md.)
-- ---------------------------------------------------------------------------

create or replace function public.is_catalog_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.households where owner_id = auth.uid())
$$;

create policy products_admin_insert on public.products for insert to authenticated
  with check (household_id is null and public.is_catalog_admin());
create policy products_admin_update on public.products for update to authenticated
  using (household_id is null and public.is_catalog_admin())
  with check (household_id is null and public.is_catalog_admin());

-- ---------------------------------------------------------------------------
-- 3. Writes with ids from the phone
-- ---------------------------------------------------------------------------

-- Adds collected for the "added to the list" push (section 4).
create table public.grocery_add_batches (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_ids uuid[] not null default '{}',
  last_add_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
alter table public.grocery_add_batches enable row level security; -- server only

create or replace function public.note_grocery_add(p_household uuid, p_item uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.grocery_add_batches (household_id, user_id, item_ids)
  select p_household, auth.uid(), array[p_item]
  where auth.uid() is not null
  on conflict (household_id, user_id) do update
    set item_ids = case when p_item = any(public.grocery_add_batches.item_ids)
                        then public.grocery_add_batches.item_ids
                        else public.grocery_add_batches.item_ids || p_item end,
        last_add_at = now();
$$;
revoke execute on function public.note_grocery_add(uuid, uuid) from public, anon, authenticated;

-- A household item made from the New catalog item sheet, with the id the phone
-- gave it. A product with the same name already there (shared or the
-- household's) is returned instead of a duplicate. `p_store` puts it in a store.
create or replace function public.create_household_product(
  p_id uuid, p_name text, p_aisle public.aisle, p_unit text default null, p_store uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
  v_key text := public.product_key(p_name);
  v_id uuid;
  v_unit text := nullif(lower(trim(p_unit)), '');
begin
  if v_household is null then
    raise exception 'no_household';
  end if;
  if v_key = '' then
    raise exception 'empty_name';
  end if;
  select id into v_id from public.products
  where id = p_id and (household_id is null or household_id = v_household);
  if v_id is null then
    select id into v_id from public.products
    where search_key = v_key and (household_id is null or household_id = v_household)
    order by (household_id is null)
    limit 1;
  end if;
  if v_id is null then
    insert into public.products (id, household_id, name_fr, default_aisle, default_unit, suggested_units, created_by)
    values (p_id, v_household, trim(p_name), coalesce(p_aisle, 'other'), v_unit,
            case when v_unit is null then '{}' else array[v_unit] end, auth.uid())
    returning id into v_id;
  end if;
  if p_store is not null and exists (select 1 from public.household_stores
                                     where id = p_store and household_id = v_household) then
    insert into public.household_products (household_id, product_id, store_id)
    values (v_household, v_id, p_store)
    on conflict (household_id, product_id) do update set store_id = excluded.store_id;
  end if;
  return v_id;
end;
$$;

-- One list item with the id the phone gave it. Saving the same id again
-- changes nothing, so retries are safe. Unlike add_grocery_items it never
-- merges into another row. Item: {"product_id"} or {"name"} (both: the name is
-- used when the product isn't there), plus optional quantity, unit, recipe_id.
create or replace function public.put_grocery_item(p_id uuid, p_item jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
  v_product public.products;
  v_pref public.household_products;
begin
  if v_household is null then
    raise exception 'no_household';
  end if;
  if exists (select 1 from public.grocery_items where id = p_id) then
    return p_id;
  end if;

  if p_item ? 'product_id' then
    select * into v_product from public.products
    where id = (p_item ->> 'product_id')::uuid and (household_id is null or household_id = v_household);
  end if;
  if v_product.id is null and nullif(trim(p_item ->> 'name'), '') is not null then
    select * into v_product from public.products
    where id = public.resolve_product(v_household, p_item ->> 'name', (p_item ->> 'aisle')::public.aisle);
  end if;
  if v_product.id is null then
    raise exception 'not_found';
  end if;

  select * into v_pref from public.household_products
  where household_id = v_household and product_id = v_product.id;

  insert into public.grocery_items
    (id, household_id, product_id, name, quantity, unit, aisle, store_id, recipe_id, added_by, sort_key)
  values (
    p_id, v_household, v_product.id, v_product.name_fr,
    (p_item ->> 'quantity')::real,
    nullif(trim(p_item ->> 'unit'), ''),
    coalesce(v_pref.aisle, v_product.default_aisle),
    v_pref.store_id,
    (p_item ->> 'recipe_id')::uuid,
    auth.uid(),
    extract(epoch from now())
  );
  insert into public.household_products (household_id, product_id, add_count, last_added_at)
  values (v_household, v_product.id, 1, now())
  on conflict (household_id, product_id) do update
    set add_count = public.household_products.add_count + 1, last_added_at = now();
  return p_id;
end;
$$;

-- Every new list row counts towards its adder's push, whichever way it was
-- added (put_grocery_item, add_grocery_items from a recipe).
create or replace function public.on_grocery_item_added()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.added_by is not null and new.added_by = auth.uid() then
    perform public.note_grocery_add(new.household_id, new.id);
  end if;
  return new;
end;
$$;
create trigger grocery_items_added after insert on public.grocery_items
  for each row execute function public.on_grocery_item_added();

-- ---------------------------------------------------------------------------
-- 4. "<name> added 4 items to the list"
-- ---------------------------------------------------------------------------

-- Who has the Groceries tab open: the app refreshes its row every minute
-- while the tab is on screen and deletes it when the tab closes.
create table public.grocery_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.grocery_presence enable row level security;
create policy grocery_presence_own on public.grocery_presence for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Batches whose person has added nothing for 5 minutes. Counts the items
-- still on the list (removed ones are gone; the same product counts once) and
-- skips people looking at the list right now. Run every minute by pg_cron.
create or replace function public.enqueue_grocery_pushes()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_batch public.grocery_add_batches;
  v_count int;
  v_item record;
  v_to uuid[];
  v_sent int := 0;
begin
  for v_batch in
    delete from public.grocery_add_batches
    where last_add_at < now() - interval '5 minutes'
    returning *
  loop
    select count(distinct coalesce(g.product_id::text, g.name)) into v_count
    from public.grocery_items g
    where g.id = any(v_batch.item_ids) and g.household_id = v_batch.household_id and g.cleared_at is null;
    continue when v_count = 0;

    select g.name as name_fr, p.name_en into v_item
    from public.grocery_items g left join public.products p on p.id = g.product_id
    where g.id = any(v_batch.item_ids) and g.household_id = v_batch.household_id and g.cleared_at is null
    limit 1;

    select array_agg(m.user_id) into v_to
    from public.household_members m
    where m.household_id = v_batch.household_id and m.user_id <> v_batch.user_id
      and not exists (select 1 from public.grocery_presence s
                      where s.user_id = m.user_id and s.seen_at > now() - interval '90 seconds');
    continue when v_to is null;

    perform public.enqueue_push(v_to, 'groceries_added', jsonb_build_object(
      'name', (select first_name from public.profiles where id = v_batch.user_id),
      'count', v_count,
      'item_fr', case when v_count = 1 then v_item.name_fr end,
      'item_en', case when v_count = 1 then coalesce(v_item.name_en, v_item.name_fr) end));
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;
revoke execute on function public.enqueue_grocery_pushes() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('dineamite-grocery-pushes', '* * * * *', 'select public.enqueue_grocery_pushes()');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Notification switches
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column push_enabled boolean not null default true,
  add column push_muted text[] not null default '{}'; -- outbox kinds this person turned off

create or replace function public.enqueue_push(p_users uuid[], p_kind text, p_payload jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.push_outbox (user_id, kind, payload)
  select u, p_kind, coalesce(p_payload, '{}'::jsonb)
  from unnest(p_users) as u
  join public.profiles p on p.id = u
  where p.push_enabled and not (p_kind = any(p.push_muted));
$$;
revoke execute on function public.enqueue_push(uuid[], text, jsonb) from public, anon, authenticated;

-- Live updates for the new columns' tables.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.products;
  end if;
end;
$$;
