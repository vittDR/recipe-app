-- Several households on one copy of the app (docs/AUDIT-2026-10.md, section 1).
--
-- 1. Catalogue admins are named people (app_admins), not "whoever created a
--    household": the shared catalogue is the same for every household.
-- 2. A household's rows can only point at shared rows or at its own: a
--    foreign key alone accepts another household's product, recipe or store.
-- 3. put_grocery_item no longer accepts an id another household uses, and a
--    new name now lands on the item it creates (it used to fail not_found).
-- 4. Ownership lives in households.owner_id only (household_members.role went).
-- 5. Household policies compare with my_household_id() once per query instead
--    of calling is_member() on every row. One household per person stays the
--    rule (household_members_one_per_user), so the two say the same.
-- 6. Shared tags count in catalog_version(), like products and ingredients.
-- 7. Cleared list lines are kept a year (usuals and "probably at home" read them).
-- 8. Unused: meals.portion_split, households.store_name, clear_checked_items(),
--    set_frequent(), add_grocery_items() (every list change now goes through
--    the app's queue and put_grocery_item) and the recipe-images bucket
--    (photos are served by the app).

-- ---------------------------------------------------------------------------
-- 1. Catalogue admins
-- ---------------------------------------------------------------------------

create table public.app_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security; -- no policies: SQL editor only

-- Until now the first household's creator edited the catalogue; they stay admin.
-- Add others with: insert into public.app_admins (user_id) values ('<profile id>');
insert into public.app_admins (user_id)
select owner_id from public.households order by created_at limit 1
on conflict do nothing;

create or replace function public.is_catalog_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- 2. References stay inside the household
-- ---------------------------------------------------------------------------

-- Shared catalogue items are the ingredient's product; a household's own items never are.
alter table public.products add constraint products_ingredient_shared
  check (household_id is null or ingredient is null);

-- Rejects a product, recipe or store that is neither shared nor the row's
-- household's. taste_rules belong to a person: their household counts.
create or replace function public.check_household_refs()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_household uuid;
  v_id uuid;
begin
  if tg_table_name = 'taste_rules' then
    select m.household_id into v_household from public.household_members m where m.user_id = new.user_id;
  else
    v_household := (v_row ->> 'household_id')::uuid;
  end if;

  v_id := (v_row ->> 'product_id')::uuid;
  if v_id is not null and not exists (
    select 1 from public.products p
    where p.id = v_id and (p.household_id is null or p.household_id = v_household)) then
    raise exception 'foreign_product' using errcode = 'foreign_key_violation';
  end if;

  v_id := (v_row ->> 'recipe_id')::uuid;
  if v_id is not null and not exists (
    select 1 from public.recipes r
    where r.id = v_id and (r.household_id is null or r.household_id = v_household)) then
    raise exception 'foreign_recipe' using errcode = 'foreign_key_violation';
  end if;

  v_id := (v_row ->> 'store_id')::uuid;
  if v_id is not null and not exists (
    select 1 from public.household_stores s where s.id = v_id and s.household_id = v_household) then
    raise exception 'foreign_store' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_household_refs() from public, anon, authenticated;

create trigger grocery_items_refs before insert or update of household_id, product_id, recipe_id, store_id
  on public.grocery_items for each row execute function public.check_household_refs();
create trigger household_products_refs before insert or update of household_id, product_id, store_id
  on public.household_products for each row execute function public.check_household_refs();
create trigger meals_refs before insert or update of household_id, recipe_id
  on public.meals for each row execute function public.check_household_refs();
create trigger plan_days_refs before insert or update of household_id, recipe_id
  on public.plan_days for each row execute function public.check_household_refs();
create trigger taste_rules_refs before insert or update of user_id, product_id
  on public.taste_rules for each row execute function public.check_household_refs();

-- ---------------------------------------------------------------------------
-- 3. put_grocery_item: the id is checked within the household
-- ---------------------------------------------------------------------------

create or replace function public.put_grocery_item(p_id uuid, p_item jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
  v_existing uuid;
  v_product_id uuid;
  v_product public.products;
  v_pref public.household_products;
begin
  if v_household is null then
    raise exception 'no_household';
  end if;
  select household_id into v_existing from public.grocery_items where id = p_id;
  if v_existing = v_household then
    return p_id; -- a retry: already saved
  elsif v_existing is not null then
    raise exception 'id_taken';
  end if;

  if p_item ? 'product_id' then
    select * into v_product from public.products
    where id = (p_item ->> 'product_id')::uuid and (household_id is null or household_id = v_household);
  end if;
  if v_product.id is null and nullif(trim(p_item ->> 'name'), '') is not null then
    -- Resolve first: a product it creates isn't visible to a query already running.
    v_product_id := public.resolve_product(v_household, p_item ->> 'name', (p_item ->> 'aisle')::public.aisle);
    select * into v_product from public.products where id = v_product_id;
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

-- ---------------------------------------------------------------------------
-- 4. One place for the owner
-- ---------------------------------------------------------------------------

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

  insert into public.household_staples (household_id, name)
  select v_id, c.name from public.ingredient_catalog c where c.is_staple;

  insert into public.household_aisle_order (household_id, aisle, position)
  select v_id, a, row_number() over ()
  from unnest(enum_range(null::public.aisle)) as a;

  return v_id;
end;
$$;

create or replace function public.redeem_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites;
  v_others uuid[];
  v_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_invite from public.invites
  where code = upper(trim(p_code))
  for update;

  if not found or v_invite.used_by is not null or v_invite.expires_at <= now() then
    raise exception 'invalid_invite';
  end if;
  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'already_in_household';
  end if;

  select array_agg(user_id) into v_others
  from public.household_members where household_id = v_invite.household_id;

  insert into public.household_members (household_id, user_id) values (v_invite.household_id, v_uid);

  update public.invites set used_by = v_uid, used_at = now() where code = v_invite.code;

  select first_name into v_name from public.profiles where id = v_uid;
  perform public.enqueue_push(v_others, 'partner_joined', jsonb_build_object('name', v_name));

  return v_invite.household_id;
end;
$$;

-- Leaving keeps the account and personal preferences. If the owner leaves,
-- ownership passes to the longest-standing member; an empty household is deleted.
create or replace function public.leave_household()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid := public.my_household_id();
  v_next uuid;
begin
  if v_household is null then
    return;
  end if;
  delete from public.household_members where household_id = v_household and user_id = v_uid;

  select user_id into v_next from public.household_members
  where household_id = v_household order by joined_at limit 1;

  if v_next is null then
    delete from public.households where id = v_household;
  else
    update public.households set owner_id = v_next where id = v_household and owner_id = v_uid;
  end if;
end;
$$;

alter table public.household_members drop column role;
drop type public.member_role;

-- ---------------------------------------------------------------------------
-- 5. Household policies: my_household_id() once per query
-- ---------------------------------------------------------------------------

drop policy households_select on public.households;
drop policy households_update on public.households;
create policy households_select on public.households for select to authenticated
  using (id = (select public.my_household_id()));
create policy households_update on public.households for update to authenticated
  using (id = (select public.my_household_id())) with check (id = (select public.my_household_id()));

drop policy members_select on public.household_members;
create policy members_select on public.household_members for select to authenticated
  using (household_id = (select public.my_household_id()));

drop policy recipes_select on public.recipes;
drop policy recipes_insert on public.recipes;
drop policy recipes_update on public.recipes;
drop policy recipes_delete on public.recipes;
create policy recipes_select on public.recipes for select to authenticated
  using (household_id is null or household_id = (select public.my_household_id()));
create policy recipes_insert on public.recipes for insert to authenticated
  with check (household_id = (select public.my_household_id()));
create policy recipes_update on public.recipes for update to authenticated
  using (household_id = (select public.my_household_id()))
  with check (household_id = (select public.my_household_id()));
create policy recipes_delete on public.recipes for delete to authenticated
  using (household_id = (select public.my_household_id()));

drop policy ingredients_select on public.recipe_ingredients;
drop policy ingredients_write on public.recipe_ingredients;
create policy ingredients_select on public.recipe_ingredients for select to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id
                 and (r.household_id is null or r.household_id = (select public.my_household_id()))));
create policy ingredients_write on public.recipe_ingredients for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id
                 and r.household_id = (select public.my_household_id())))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id
                      and r.household_id = (select public.my_household_id())));

drop policy decks_select on public.decks;
create policy decks_select on public.decks for select to authenticated
  using (household_id = (select public.my_household_id()));

drop policy deck_cards_select on public.deck_cards;
create policy deck_cards_select on public.deck_cards for select to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id
                 and d.household_id = (select public.my_household_id())));

drop policy deck_members_select on public.deck_members;
create policy deck_members_select on public.deck_members for select to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id
                 and d.household_id = (select public.my_household_id())));

drop policy swipes_select on public.swipes;
drop policy swipes_insert on public.swipes;
create policy swipes_select on public.swipes for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.decks d
      join public.deck_members me on me.deck_id = d.id and me.user_id = (select auth.uid())
      where d.id = deck_id and d.household_id = (select public.my_household_id()) and me.finished_at is not null
    )
  );
create policy swipes_insert on public.swipes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.decks d
      join public.deck_cards c on c.deck_id = d.id and c.recipe_id = swipes.recipe_id
      where d.id = deck_id and d.status = 'open'
        and (select auth.uid()) = any (d.who_eating)
        and d.household_id = (select public.my_household_id())
    )
  );

drop policy picks_select on public.tiebreak_picks;
create policy picks_select on public.tiebreak_picks for select to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id
                 and d.household_id = (select public.my_household_id())));

drop policy meals_all on public.meals;
drop policy plan_days_all on public.plan_days;
drop policy grocery_all on public.grocery_items;
drop policy staples_all on public.household_staples;
drop policy aisle_order_all on public.household_aisle_order;
drop policy stores_all on public.household_stores;
drop policy household_products_all on public.household_products;
create policy meals_all on public.meals for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));
create policy plan_days_all on public.plan_days for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));
create policy grocery_all on public.grocery_items for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));
create policy staples_all on public.household_staples for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));
create policy aisle_order_all on public.household_aisle_order for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));
create policy stores_all on public.household_stores for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));
create policy household_products_all on public.household_products for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));

drop policy products_select on public.products;
drop policy products_insert on public.products;
drop policy products_update on public.products;
drop policy products_delete on public.products;
drop policy products_admin_insert on public.products;
drop policy products_admin_update on public.products;
create policy products_select on public.products for select to authenticated
  using (household_id is null or household_id = (select public.my_household_id()));
create policy products_insert on public.products for insert to authenticated
  with check (household_id = (select public.my_household_id())
              or (household_id is null and (select public.is_catalog_admin())));
create policy products_update on public.products for update to authenticated
  using (household_id = (select public.my_household_id())
         or (household_id is null and (select public.is_catalog_admin())))
  with check (household_id = (select public.my_household_id())
              or (household_id is null and (select public.is_catalog_admin())));
create policy products_delete on public.products for delete to authenticated
  using (household_id = (select public.my_household_id()));

drop policy tag_catalog_select on public.tag_catalog;
drop policy tag_catalog_insert on public.tag_catalog;
drop policy tag_catalog_update on public.tag_catalog;
drop policy tag_catalog_delete on public.tag_catalog;
create policy tag_catalog_select on public.tag_catalog for select to authenticated
  using (household_id is null or household_id = (select public.my_household_id()));
create policy tag_catalog_insert on public.tag_catalog for insert to authenticated
  with check (household_id = (select public.my_household_id()));
create policy tag_catalog_update on public.tag_catalog for update to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));
create policy tag_catalog_delete on public.tag_catalog for delete to authenticated
  using (household_id = (select public.my_household_id()));

-- ---------------------------------------------------------------------------
-- 6. Shared tags in the catalogue fingerprint
-- ---------------------------------------------------------------------------

create or replace function public.catalog_version()
returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'products', md5(coalesce((select string_agg(p::text, '|' order by p.id)
                              from public.products p where p.household_id is null), '')),
    'ingredients', md5(coalesce((select string_agg(c::text, '|' order by c.name)
                                 from public.ingredient_catalog c), '')),
    'tags', md5(coalesce((select string_agg(t::text, '|' order by t.id)
                          from public.tag_catalog t where t.household_id is null), ''))
  )
$$;

-- ---------------------------------------------------------------------------
-- 7. List history: a year
-- ---------------------------------------------------------------------------

create or replace function public.purge_old_grocery_items()
returns int
language sql security definer set search_path = ''
as $$
  with gone as (
    delete from public.grocery_items
    where cleared_at < now() - interval '1 year'
    returning 1
  )
  select count(*)::int from gone;
$$;
revoke execute on function public.purge_old_grocery_items() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('dineamite-purge-list-history', '23 3 * * 0', 'select public.purge_old_grocery_items()');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Unused
-- ---------------------------------------------------------------------------

alter table public.meals drop column portion_split;
revoke update on public.households from anon, authenticated;
alter table public.households drop column store_name;
grant update (name, timezone, prompt_time, reminder_time) on public.households to authenticated;
drop function public.clear_checked_items();
drop function public.set_frequent(uuid, boolean);
drop function public.add_grocery_items(jsonb);

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    drop policy if exists recipe_images_read on storage.objects;
    drop policy if exists recipe_images_write on storage.objects;
    drop policy if exists recipe_images_delete on storage.objects;
    begin
      delete from storage.buckets b
      where b.id = 'recipe-images' and not exists (select 1 from storage.objects o where o.bucket_id = b.id);
    exception when others then
      raise notice 'recipe-images bucket kept: %', sqlerrm; -- newer projects only delete buckets through the Storage API
    end;
  end if;
end;
$$;
