-- Calendar and rating (design/calendar/HANDOFF.md §4): how the household
-- found a dish, and whether it's a favourite.
--
-- * One row per (household, recipe). A rating belongs to the household, not
--   to a person: the first person to rate a dish rates it for everyone, and
--   either person can change it later (the last edit wins). rated_by and
--   rated_at are set by the database whenever the stars change.
-- * favorite: household-wide too; the heart on the rate sheet and on the
--   recipe screen are this one value. Favourites rank higher in the deck.
-- * Ratings stay inside the household: never copied to the seed library,
--   never aggregated across households (population_answers doesn't read
--   this table).
-- * They replace the per-person "How was it?" chips (taste_signals kind
--   'rating', still read for meals rated before). Each person who ate the
--   dish learns from the household's stars (logic/profile.ts).

create table if not exists public.household_recipes (
  household_id uuid not null default public.my_household_id() references public.households (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade on update cascade,
  stars smallint check (stars between 1 and 5),
  rated_by uuid references public.profiles (id) on delete set null,
  rated_at timestamptz,
  favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (household_id, recipe_id)
);

alter table public.household_recipes enable row level security;
grant select, insert, update, delete on public.household_recipes to authenticated;

-- The household's own rows, about recipes it can see (its own or the seed library).
drop policy if exists household_recipes_all on public.household_recipes;
create policy household_recipes_all on public.household_recipes for all to authenticated
  using (household_id = (select public.my_household_id()))
  with check (
    household_id = (select public.my_household_id())
    and exists (select 1 from public.recipes r where r.id = recipe_id
      and (r.household_id is null or r.household_id = (select public.my_household_id())))
  );

-- Who rated and when follow the stars: whoever changes them last.
create or replace function public.household_recipes_stamp()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.stars is null then
    new.rated_by := null;
    new.rated_at := null;
  elsif tg_op = 'INSERT' or new.stars is distinct from old.stars then
    new.rated_by := coalesce(auth.uid(), new.rated_by);
    new.rated_at := now();
  else
    new.rated_by := old.rated_by;
    new.rated_at := old.rated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists household_recipes_stamp on public.household_recipes;
create trigger household_recipes_stamp before insert or update on public.household_recipes
  for each row execute function public.household_recipes_stamp();

-- Both phones see a rating or a heart at once.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.household_recipes;
  end if;
end;
$$;
