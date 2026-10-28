-- Groceries on real items instead of free text.
--
-- products: one row per thing you buy. "chicken breast", "Blanc de poulet" and
-- "poulet" are all the same product, so the list merges, groups and
-- autocompletes on it. French name first; English optional. household_id null
-- = the shared catalogue (every catalogue ingredient has one, plus everyday
-- non-food items from seed.sql); otherwise an item a household created itself
-- ("Recharges Swiffer poussière").
--
-- household_stores: shops like Picard. A store is a section of the list, next
-- to the aisles, ordered in the same position space as household_aisle_order.
--
-- household_products: what a household remembers per product: where it goes
-- (aisle or store), how often it was added, and whether it is pinned to or
-- hidden from the "Frequently bought" section.

-- Lowercase, no accents, punctuation as spaces: "Chou-fleur" = "chou fleur".
-- Mirrors productKey() in _shared/logic/products.ts (which also drops plurals).
create or replace function public.product_key(p text)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select trim(regexp_replace(
    replace(replace(translate(lower(coalesce(p, '')),
      'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), 'œ', 'oe'), 'æ', 'ae'),
    '[^a-z0-9]+', ' ', 'g'))
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade, -- null = shared catalogue
  name_fr text not null check (char_length(trim(name_fr)) between 1 and 80),
  name_en text,
  aliases text[] not null default '{}', -- other names and brands, any language
  -- The catalogue ingredient this is, so recipe ingredients land on it.
  ingredient text unique references public.ingredient_catalog (name) on update cascade on delete set null,
  default_aisle public.aisle not null default 'other',
  search_key text generated always as (public.product_key(name_fr)) stored,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index products_shared_key on public.products (search_key) where household_id is null;
create unique index products_household_key on public.products (household_id, search_key) where household_id is not null;

create table public.household_stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  position int not null default 0
);
create unique index household_stores_name on public.household_stores (household_id, lower(name));

create table public.household_products (
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  aisle public.aisle,          -- overrides the product's default aisle
  store_id uuid references public.household_stores (id) on delete set null,
  add_count int not null default 0,
  last_added_at timestamptz,
  pinned boolean not null default false, -- always in "Frequently bought"
  hidden boolean not null default false, -- never in "Frequently bought"
  primary key (household_id, product_id)
);

alter table public.grocery_items
  add column product_id uuid references public.products (id) on delete set null,
  add column store_id uuid references public.household_stores (id) on delete set null;
create index grocery_items_product on public.grocery_items (household_id, product_id) where cleared_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.products enable row level security;
alter table public.household_stores enable row level security;
alter table public.household_products enable row level security;

create policy products_select on public.products for select to authenticated
  using (household_id is null or public.is_member(household_id));
create policy products_insert on public.products for insert to authenticated
  with check (public.is_member(household_id));
create policy products_update on public.products for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy products_delete on public.products for delete to authenticated
  using (public.is_member(household_id));
create policy stores_all on public.household_stores for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy household_products_all on public.household_products for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- One shared product per catalogue ingredient. Safe to re-run; seed.sql calls
-- it after loading the catalogue.
create or replace function public.sync_products_from_catalog()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  -- A shared product with the same French name takes the ingredient instead.
  update public.products p set ingredient = c.name
  from public.ingredient_catalog c
  where p.household_id is null and p.ingredient is null
    and p.search_key = public.product_key(coalesce(c.name_fr, c.name))
    and not exists (select 1 from public.products q where q.ingredient = c.name);

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

-- The product a typed or recipe name stands for, creating a household item
-- when nothing matches. Catalogue ingredient first, then any name or alias,
-- the household's own items before shared ones.
create or replace function public.resolve_product(p_household uuid, p_name text, p_aisle public.aisle default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_key text := public.product_key(p_name);
  v_id uuid;
begin
  if v_key = '' then
    return null;
  end if;
  select id into v_id from public.products where ingredient = lower(trim(p_name));
  if v_id is not null then
    return v_id;
  end if;

  select p.id into v_id from public.products p
  where (p.household_id is null or p.household_id = p_household)
    and (p.search_key = v_key or public.product_key(p.name_en) = v_key
         or exists (select 1 from unnest(p.aliases) a where public.product_key(a) = v_key))
  order by (p.household_id is null), (p.search_key <> v_key)
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.products (household_id, name_fr, default_aisle, created_by)
  values (p_household, trim(p_name), coalesce(p_aisle, 'other'), auth.uid())
  on conflict do nothing
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.resolve_product(uuid, text, public.aisle) from public, anon, authenticated;
revoke execute on function public.sync_products_from_catalog() from public, anon, authenticated;

-- Adds items, merging quantities into unchecked items of the same product and
-- unit. Each item: {"product_id": "..."} or {"name": "spinach"} (resolved, or
-- created as a household item), plus optional quantity, unit, aisle, recipe_id.
-- The household's remembered aisle or store wins over the item's aisle.
create or replace function public.add_grocery_items(p_items jsonb)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
  v_item jsonb;
  v_product public.products;
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
      select * into v_product from public.products
      where id = public.resolve_product(v_household, v_item ->> 'name', (v_item ->> 'aisle')::public.aisle);
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

-- Where a product goes for this household: a store, or an aisle (store null).
-- Remembered for next time and applied to the items on the list now.
create or replace function public.set_product_section(p_product uuid, p_aisle public.aisle, p_store uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
begin
  if v_household is null then
    raise exception 'no_household';
  end if;
  if not exists (select 1 from public.products
                 where id = p_product and (household_id is null or household_id = v_household)) then
    raise exception 'not_found';
  end if;
  if p_store is not null and not exists (select 1 from public.household_stores
                                         where id = p_store and household_id = v_household) then
    raise exception 'not_found';
  end if;

  insert into public.household_products (household_id, product_id, aisle, store_id)
  values (v_household, p_product, p_aisle, p_store)
  on conflict (household_id, product_id) do update
    set aisle = coalesce(excluded.aisle, public.household_products.aisle), store_id = excluded.store_id;

  update public.grocery_items g
  set aisle = coalesce(p_aisle, g.aisle), store_id = p_store
  where g.household_id = v_household and g.product_id = p_product and g.cleared_at is null;
end;
$$;

-- Pins a product to "Frequently bought" (true) or hides it from there (false).
create or replace function public.set_frequent(p_product uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
begin
  if v_household is null then
    raise exception 'no_household';
  end if;
  if not exists (select 1 from public.products
                 where id = p_product and (household_id is null or household_id = v_household)) then
    raise exception 'not_found';
  end if;
  insert into public.household_products (household_id, product_id, pinned, hidden)
  values (v_household, p_product, p_on, not p_on)
  on conflict (household_id, product_id) do update set pinned = p_on, hidden = not p_on;
end;
$$;

-- New stores go last; the household can move them among the aisles.
create or replace function public.add_store(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
  v_id uuid;
begin
  if v_household is null then
    raise exception 'no_household';
  end if;
  select id into v_id from public.household_stores
  where household_id = v_household and lower(name) = lower(trim(p_name));
  if v_id is not null then
    return v_id;
  end if;
  insert into public.household_stores (household_id, name, position)
  values (v_household, trim(p_name), 1 + greatest(
    (select coalesce(max(position), 0) from public.household_aisle_order where household_id = v_household),
    (select coalesce(max(position), 0) from public.household_stores where household_id = v_household)))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Existing data
-- ---------------------------------------------------------------------------

select public.sync_products_from_catalog();

-- Everyday items that aren't recipe ingredients: the shared shopping catalogue.
insert into public.products (name_fr, name_en, aliases, default_aisle) values
  -- fruits et légumes
  ('Fruits', 'Fruit', '{}', 'produce'),
  ('Framboises', 'Raspberries', '{}', 'produce'),
  ('Fraises', 'Strawberries', '{}', 'produce'),
  ('Myrtilles', 'Blueberries', '{}', 'produce'),
  ('Bananes', 'Bananas', '{}', 'produce'),
  ('Kiwis', 'Kiwis', '{}', 'produce'),
  ('Clémentines', 'Clementines', '{mandarines}', 'produce'),
  ('Raisin', 'Grapes', '{}', 'produce'),
  ('Pêches', 'Peaches', '{nectarines}', 'produce'),
  ('Abricots', 'Apricots', '{}', 'produce'),
  ('Melon', 'Melon', '{}', 'produce'),
  ('Ananas', 'Pineapple', '{}', 'produce'),
  ('Mangue', 'Mango', '{}', 'produce'),
  ('Pamplemousse', 'Grapefruit', '{}', 'produce'),
  ('Choux de Bruxelles', 'Brussels sprouts', '{chou de bruxelles}', 'produce'),
  ('Butternut', 'Butternut squash', '{courge butternut}', 'produce'),
  ('Mâche', 'Lamb''s lettuce', '{salade mâche,doucette}', 'produce'),
  ('Endives', 'Chicory', '{endive,chicon}', 'produce'),
  ('Betteraves', 'Beetroot', '{betterave}', 'produce'),
  ('Fenouil', 'Fennel', '{}', 'produce'),
  ('Asperges', 'Asparagus', '{}', 'produce'),
  -- boucherie et poissonnerie
  ('Escalopes de poulet', 'Chicken escalopes', '{escalope poulet,escalope de poulet}', 'meat_fish'),
  ('Poulet au citron', 'Lemon chicken', '{poulet citron}', 'meat_fish'),
  ('Saumon fumé', 'Smoked salmon', '{}', 'meat_fish'),
  ('Crevettes décortiquées', 'Peeled prawns', '{crevettes décortiquées surgelées}', 'frozen'),
  -- crèmerie
  ('Skyr', 'Skyr', '{}', 'dairy_eggs'),
  ('Skyr de brebis', 'Sheep''s milk skyr', '{skyr brebis}', 'dairy_eggs'),
  ('Sojasun', 'Soy yogurt', '{yaourt soja,yaourts au soja,dessert soja}', 'dairy_eggs'),
  ('Babybel', 'Babybel', '{mini babybel}', 'dairy_eggs'),
  ('Comté', 'Comté', '{}', 'dairy_eggs'),
  ('Fromage râpé', 'Grated cheese', '{gruyère râpé,emmental râpé}', 'dairy_eggs'),
  ('Lait d''avoine', 'Oat milk', '{boisson avoine,boisson à l''avoine}', 'dairy_eggs'),
  ('Yaourts nature', 'Plain yogurt', '{yaourts}', 'dairy_eggs'),
  -- boulangerie
  ('Pain de mie', 'Sandwich bread', '{}', 'bakery'),
  ('Croissants', 'Croissants', '{viennoiseries}', 'bakery'),
  ('Grissini', 'Breadsticks', '{gressins}', 'bakery'),
  ('Wasa Fibres', 'Wasa crispbread', '{wasa,pain suédois}', 'bakery'),
  -- épicerie
  ('Café', 'Coffee', '{café moulu,café en grains,capsules café}', 'pantry'),
  ('Café décaféiné', 'Decaf coffee', '{déca,deca,décaféiné}', 'pantry'),
  ('Thé', 'Tea', '{}', 'pantry'),
  ('Tisane', 'Herbal tea', '{infusion}', 'pantry'),
  ('Chocolat', 'Chocolate', '{chocolat noir,tablette de chocolat}', 'pantry'),
  ('Céréales', 'Cereal', '{muesli,granola}', 'pantry'),
  ('Confiture', 'Jam', '{}', 'pantry'),
  ('Biscuits', 'Biscuits', '{gâteaux secs}', 'pantry'),
  ('Compotes', 'Fruit purée pouches', '{compote}', 'pantry'),
  ('Lentilles', 'Lentils', '{lentilles vertes,lentilles du puy}', 'pantry'),
  ('Sardines', 'Sardines', '{sardines en boîte}', 'pantry'),
  ('Purée', 'Mashed potatoes', '{purées,purée mousline}', 'pantry'),
  ('Soupe', 'Soup', '{soupes,velouté}', 'pantry'),
  -- surgelés
  ('Croustibat', 'Fish fingers', '{bâtonnets de poisson,poisson pané}', 'frozen'),
  ('Glace', 'Ice cream', '{glaces}', 'frozen'),
  -- boissons
  ('Boissons', 'Drinks', '{}', 'drinks'),
  ('Eau', 'Water', '{eau plate,bouteilles d''eau}', 'drinks'),
  ('Eau gazeuse', 'Sparkling water', '{eau pétillante}', 'drinks'),
  ('Jus d''orange', 'Orange juice', '{jus}', 'drinks'),
  ('Bière', 'Beer', '{bières}', 'drinks'),
  -- hygiène et beauté
  ('Shampoing', 'Shampoo', '{shampooing}', 'hygiene'),
  ('Après-shampoing', 'Conditioner', '{après shampooing}', 'hygiene'),
  ('Gel douche', 'Shower gel', '{}', 'hygiene'),
  ('Savon pour les mains', 'Hand soap', '{savon main,savon mains,savon}', 'hygiene'),
  ('Recharge savon mains', 'Hand soap refill', '{recharge savon main,recharge savon,recherche savon main}', 'hygiene'),
  ('Dentifrice', 'Toothpaste', '{}', 'hygiene'),
  ('Brosses à dents', 'Toothbrushes', '{brosse à dents}', 'hygiene'),
  ('Déodorant', 'Deodorant', '{déo}', 'hygiene'),
  ('Gommage', 'Body scrub', '{exfoliant}', 'hygiene'),
  ('Crème pour le corps', 'Body lotion', '{crème corps,lait corps,lait pour le corps}', 'hygiene'),
  ('Cotons démaquillants', 'Cotton pads', '{cotons,coton}', 'hygiene'),
  ('Cotons-tiges', 'Cotton buds', '{coton-tige}', 'hygiene'),
  ('Lingettes humides', 'Wet wipes', '{lingettes,lingettes fesses,lingettes bébé}', 'hygiene'),
  ('Rasoirs', 'Razors', '{lames de rasoir}', 'hygiene'),
  -- maison
  ('Papier toilette', 'Toilet paper', '{pq,papier wc,papier hygiénique}', 'household'),
  ('Essuie-tout', 'Paper towels', '{sopalin}', 'household'),
  ('Mouchoirs', 'Tissues', '{kleenex}', 'household'),
  ('Serviettes en papier', 'Paper napkins', '{serviettes}', 'household'),
  ('Liquide vaisselle', 'Washing-up liquid', '{produit vaisselle}', 'household'),
  ('Tablettes lave-vaisselle', 'Dishwasher tablets', '{pods lave vaisselle,pods vaisselle,capsules lave-vaisselle,pastilles lave-vaisselle}', 'household'),
  ('Sel lave-vaisselle', 'Dishwasher salt', '{sel régénérant}', 'household'),
  ('Lessive', 'Laundry detergent', '{lessives,capsules lessive}', 'household'),
  ('Adoucissant', 'Fabric softener', '{}', 'household'),
  ('Éponges', 'Sponges', '{éponge}', 'household'),
  ('Sacs poubelle', 'Bin bags', '{sac poubelle}', 'household'),
  ('Papier sulfurisé', 'Baking paper', '{papier cuisson}', 'household'),
  ('Papier aluminium', 'Aluminium foil', '{alu,papier alu}', 'household'),
  ('Film alimentaire', 'Cling film', '{film étirable}', 'household'),
  ('Nettoyant multi-usage', 'All-purpose cleaner', '{nettoyant}', 'household'),
  ('Scotch', 'Tape', '{ruban adhésif}', 'household'),
  ('Piles', 'Batteries', '{}', 'household'),
  ('Ampoules', 'Light bulbs', '{ampoule}', 'household')
on conflict do nothing;

-- Households made before the hygiene aisle get it just before "household".
do $$
declare
  v_h record;
begin
  for v_h in
    select o.household_id, o.position from public.household_aisle_order o
    where o.aisle = 'household'
      and not exists (select 1 from public.household_aisle_order x
                      where x.household_id = o.household_id and x.aisle = 'hygiene')
  loop
    update public.household_aisle_order set position = position + 1
    where household_id = v_h.household_id and position >= v_h.position;
    insert into public.household_aisle_order (household_id, aisle, position)
    values (v_h.household_id, 'hygiene', v_h.position);
  end loop;
end;
$$;

-- Items already on lists point at their product.
update public.grocery_items g
set product_id = public.resolve_product(g.household_id, g.name, g.aisle)
where g.product_id is null;
update public.grocery_items g set aisle = p.default_aisle
from public.products p
where p.id = g.product_id and g.cleared_at is null and g.aisle = 'other' and p.default_aisle <> 'other';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.household_products, public.household_stores;
  end if;
end;
$$;

-- French first.
alter table public.profiles alter column locale set default 'fr';
