-- "Toujours à la maison" starts small and learns.
--
-- * A staple is strict now: a shelf-stable basic nearly every kitchen has
--   (salt, pepper, oils, sugar, flour, vinegar). It used to be ~95
--   catalogue items, garlic, butter, stocks, sauces and spices included.
--   narrow_staples() sets the catalogue flag and the recipe lines' copy of it;
--   the seed files call it again after loading.
-- * New households start with those basics; households with none get them.
--   The grocery sheet's "probably at home" is now only the household's own
--   staples, what's on the list and what was bought recently.
-- * The rest is deduced: when recipe ingredients go to the list, an item
--   the household leaves out (not on the list, not bought recently) counts
--   once; adding it resets the count. Left out 3 times in a row, it becomes
--   a staple. record_list_choices() does both and returns what it promoted.

create or replace function public.narrow_staples()
returns void
language sql set search_path = ''
as $$
  update public.ingredient_catalog set is_staple = (name in
    ('salt', 'black pepper', 'white pepper', 'olive oil', 'vegetable oil', 'sugar', 'flour', 'vinegar'))
  where is_staple is distinct from (name in
    ('salt', 'black pepper', 'white pepper', 'olive oil', 'vegetable oil', 'sugar', 'flour', 'vinegar'));
  -- Recipe lines carry a copy (deal-deck skips staples when matching "never" rules).
  update public.recipe_ingredients ri set is_staple = false
  where ri.is_staple and not exists (
    select 1 from public.ingredient_catalog c
    left join public.products p on p.ingredient = c.name and p.household_id is null
    where c.is_staple and (c.name = lower(ri.name) or p.id = ri.product_id));
$$;
revoke all on function public.narrow_staples() from public, anon, authenticated;

select public.narrow_staples();

create or replace function public.starter_staples()
returns setof uuid
language sql stable set search_path = ''
as $$
  select p.id from public.products p
  join public.ingredient_catalog c on c.name = p.ingredient
  where c.is_staple and p.household_id is null;
$$;

create or replace function public.create_household(p_name text, p_timezone text default 'Europe/Paris')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'already_in_household';
  end if;
  -- Validates the time zone name; raises on unknown zones.
  perform now() at time zone p_timezone;

  insert into public.households (name, owner_id, timezone)
  values (trim(p_name), v_uid, p_timezone)
  returning id into v_id;

  insert into public.household_members (household_id, user_id) values (v_id, v_uid);

  -- Cook at home every day until the couple says otherwise.
  insert into public.plan_days (household_id, weekday, cook_at_home)
  select v_id, d, true from generate_series(1, 7) as d;

  -- A few basics; the rest is learned (record_list_choices).
  insert into public.household_staples (household_id, product_id)
  select v_id, s from public.starter_staples() as s;

  insert into public.household_aisle_order (household_id, aisle, position)
  select v_id, a, row_number() over ()
  from unnest(enum_range(null::public.aisle)) as a;

  return v_id;
end;
$$;

insert into public.household_staples (household_id, product_id)
select h.id, s from public.households h cross join public.starter_staples() as s
where not exists (select 1 from public.household_staples x where x.household_id = h.id)
on conflict do nothing;

-- How many times in a row each item was left out. Only the function below
-- reads or writes it.
create table if not exists public.household_staple_skips (
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade on update cascade,
  skips int not null default 0,
  primary key (household_id, product_id)
);
alter table public.household_staple_skips enable row level security;
revoke all on public.household_staple_skips from anon, authenticated;

create or replace function public.record_list_choices(p_added uuid[], p_skipped uuid[])
returns setof uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
begin
  if v_household is null then
    return;
  end if;

  delete from public.household_staple_skips
  where household_id = v_household and product_id = any (coalesce(p_added, '{}'));

  -- Only items this household can see, and not already staples.
  insert into public.household_staple_skips as k (household_id, product_id, skips)
  select v_household, p.id, 1 from public.products p
  where p.id = any (coalesce(p_skipped, '{}'))
    and (p.household_id is null or p.household_id = v_household)
    and not exists (select 1 from public.household_staples s where s.household_id = v_household and s.product_id = p.id)
  on conflict (household_id, product_id) do update set skips = k.skips + 1;

  return query
  with promoted as (
    delete from public.household_staple_skips
    where household_id = v_household and skips >= 3
    returning product_id
  )
  insert into public.household_staples (household_id, product_id)
  select v_household, product_id from promoted
  on conflict do nothing
  returning product_id;
end;
$$;

revoke all on function public.record_list_choices(uuid[], uuid[]) from public, anon;
grant execute on function public.record_list_choices(uuid[], uuid[]) to authenticated;
revoke all on function public.starter_staples() from public, anon;
grant execute on function public.starter_staples() to authenticated;
