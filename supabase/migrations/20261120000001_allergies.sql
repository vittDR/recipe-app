-- Allergies: a person's, but they filter every deck that person eats from
-- (one pot). Harder than "never": optional lines and staples count too.
-- People pick one of the EU's 14 allergens, each linked to the catalogue
-- ingredients and preparations that contain it (milk -> butter, parmesan,
-- pesto…; links are in seed.sql), or any catalogue ingredient.

create table if not exists public.allergens (
  key text primary key,
  name_fr text not null,
  name_en text not null,
  position int not null
);

insert into public.allergens (key, name_fr, name_en, position) values
  ('gluten', 'Gluten', 'Gluten', 1),
  ('milk', 'Lactose', 'Lactose', 2),
  ('nuts', 'Fruits à coque', 'Tree nuts', 3),
  ('peanuts', 'Arachides', 'Peanuts', 4),
  ('eggs', 'Œufs', 'Eggs', 5),
  ('fish', 'Poisson', 'Fish', 6),
  ('crustaceans', 'Crustacés', 'Crustaceans', 7),
  ('molluscs', 'Mollusques', 'Molluscs', 8),
  ('soy', 'Soja', 'Soy', 9),
  ('sesame', 'Sésame', 'Sesame', 10),
  ('celery', 'Céleri', 'Celery', 11),
  ('mustard', 'Moutarde', 'Mustard', 12),
  ('sulphites', 'Sulfites', 'Sulphites', 13),
  ('lupin', 'Lupin', 'Lupin', 14)
on conflict (key) do update set name_fr = excluded.name_fr, name_en = excluded.name_en, position = excluded.position;

-- Which catalogue ingredients contain an allergen, preparations included.
create table if not exists public.allergen_ingredients (
  allergen text not null references public.allergens (key) on delete cascade,
  ingredient text not null references public.ingredient_catalog (name) on delete cascade on update cascade,
  primary key (allergen, ingredient)
);

create table if not exists public.member_allergies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  allergen text references public.allergens (key) on delete cascade,
  ingredient text references public.ingredient_catalog (name) on delete cascade on update cascade,
  created_at timestamptz not null default now(),
  check ((allergen is null) <> (ingredient is null)),
  unique (user_id, allergen),
  unique (user_id, ingredient)
);

alter table public.allergens enable row level security;
alter table public.allergen_ingredients enable row level security;
alter table public.member_allergies enable row level security;
grant select on public.allergens, public.allergen_ingredients to authenticated;
grant select, insert, delete on public.member_allergies to authenticated;

drop policy if exists allergens_read on public.allergens;
create policy allergens_read on public.allergens for select to authenticated using (true);
drop policy if exists allergen_ingredients_read on public.allergen_ingredients;
create policy allergen_ingredients_read on public.allergen_ingredients for select to authenticated using (true);

-- The household sees everyone's allergies (they cook for each other); each person edits their own.
drop policy if exists member_allergies_select on public.member_allergies;
create policy member_allergies_select on public.member_allergies for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.household_members hm
               where hm.user_id = member_allergies.user_id and hm.household_id = (select public.my_household_id()))
  );
drop policy if exists member_allergies_insert on public.member_allergies;
create policy member_allergies_insert on public.member_allergies for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists member_allergies_delete on public.member_allergies;
create policy member_allergies_delete on public.member_allergies for delete to authenticated
  using (user_id = (select auth.uid()));
