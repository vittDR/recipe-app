-- Staples are catalogue items, like love / never rules and list lines: a
-- staple is a product, so it covers every recipe line that is that product,
-- whatever language the recipe was written in. They used to be free-text
-- names matched against recipe lines.

alter table public.household_staples
  add column product_id uuid references public.products (id) on delete cascade on update cascade;

-- Each name becomes the item it stands for (its catalogue ingredient, or an
-- item named that way). Names that are no item are dropped: they matched
-- recipe lines by spelling only.
update public.household_staples s set product_id = public.find_product(s.household_id, s.name);
delete from public.household_staples where product_id is null;
-- Two names for the same item: keep one.
delete from public.household_staples s using public.household_staples t
where s.household_id = t.household_id and s.product_id = t.product_id and s.name > t.name;

alter table public.household_staples drop constraint household_staples_pkey;
alter table public.household_staples drop column name;
alter table public.household_staples alter column product_id set not null;
alter table public.household_staples add primary key (household_id, product_id);

create trigger household_staples_refs before insert or update of household_id, product_id
  on public.household_staples for each row execute function public.check_household_refs();

-- New households start with the catalogue's staples, as items.
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

  insert into public.household_staples (household_id, product_id)
  select v_id, p.id from public.products p
  join public.ingredient_catalog c on c.name = p.ingredient
  where c.is_staple and p.household_id is null;

  insert into public.household_aisle_order (household_id, aisle, position)
  select v_id, a, row_number() over ()
  from unnest(enum_range(null::public.aisle)) as a;

  return v_id;
end;
$$;
