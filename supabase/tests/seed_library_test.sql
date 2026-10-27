-- Checks the seed recipe library (seed_library.sql) loaded cleanly.
\set ON_ERROR_STOP on

create or replace function pg_temp.check(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;

create temp view lib as select * from recipes where household_id is null and source_url is not null;

select pg_temp.check((select count(*) = 110 from lib), '110 seed recipes loaded');
select pg_temp.check((select count(*) filter (where language = 'it') = 27 and count(*) filter (where language = 'fr') = 27
                             and count(*) filter (where language = 'en') = 56 from lib), 'languages: 27 it, 27 fr, 56 en');
select pg_temp.check(not exists (
  select 1 from recipe_ingredients i join lib r on r.id = i.recipe_id
  where not exists (select 1 from ingredient_catalog c where c.name = i.name)), 'every ingredient is in the catalogue');
select pg_temp.check(not exists (
  select 1 from recipe_ingredients i join lib r on r.id = i.recipe_id
  join ingredient_catalog c on c.name = i.name
  where i.aisle <> c.default_aisle or i.is_staple <> c.is_staple), 'aisle and staple flag come from the catalogue');
select pg_temp.check(not exists (select 1 from lib where kcal_per_serving is null or protein_g_per_serving is null),
                     'every recipe has estimated macros');
select pg_temp.check(not exists (select 1 from lib where source_name is null or cuisine is null or original_servings is null),
                     'source name, cuisine and original yield are set');
select pg_temp.check((select count(*) = 101 from lib where image_path like 'https://%'), '101 recipes have a photo');
select pg_temp.check((select count(*) = 1334 from recipe_ingredients i join lib r on r.id = i.recipe_id
                      where i.original_text is not null), 'every line keeps the source''s original text');

-- Diet class is worked out from the ingredients: vegetarian-tagged recipes have no meat or fish.
select pg_temp.check(not exists (
  select 1 from lib r where 'vegetarian' = any (r.tags) and exists (
    select 1 from recipe_ingredients i join ingredient_catalog c on c.name = i.name
    where i.recipe_id = r.id and c.diet_class <> 'veg')), 'vegetarian recipes have no meat or fish');

-- The old placeholder starters (seed recipes with no source) are removed by their migration.
insert into recipes (title, source_type) values ('Placeholder starter', 'seed');
\i migrations/20261028000002_remove_starter_recipes.sql
select pg_temp.check(not exists (select 1 from recipes where household_id is null and source_url is null),
                     'placeholder starter recipes are gone');
select pg_temp.check((select count(*) = 110 from lib), 'library recipes are kept');

-- Loading it again adds nothing.
\i seed_library.sql
select pg_temp.check((select count(*) = 110 from lib), 're-running seed_library.sql adds no duplicates');

-- Italian names are matched; the language check rejects anything else.
select pg_temp.check((select name from ingredient_catalog where name_it = 'vino bianco') = 'white wine', 'Italian catalogue names');
do $$ begin
  insert into recipes (title, source_type, language) values ('x', 'typed', 'de');
  raise exception 'should have failed';
exception when check_violation then null;
end $$;

-- A household's copy of a seed recipe keeps the new fields.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'd@example.com');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select create_household('Seed test', 'Europe/Paris');
select pg_temp.check((select count(*) >= 110 from library_recipes where household_id is null), 'household browses the seed library');
select id as src from library_recipes where title = 'Spaghetti alle vongole' \gset
select copy_recipe(:'src') as cp \gset
select pg_temp.check((select source_name = 'Dissapore' and cuisine = 'italian' and original_servings = 4 and language = 'it'
                      from recipes where id = :'cp'), 'copy keeps source name, cuisine, yield and language');
select pg_temp.check((select count(*) = count(original_text) and count(*) > 0 from recipe_ingredients where recipe_id = :'cp'),
                     'copy keeps each line''s original text');
reset role;
