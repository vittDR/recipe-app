-- Checks the seed recipe library (seed_library.sql) loaded cleanly.
\set ON_ERROR_STOP on

create or replace function pg_temp.check(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;

create temp view lib as select * from recipes where household_id is null and source_url is not null;

select pg_temp.check((select count(*) = 109 from lib), '109 sourced seed recipes loaded');
select pg_temp.check((select count(*) filter (where language = 'it') = 27 and count(*) filter (where language = 'fr') = 26
                             and count(*) filter (where language = 'en') = 56 from lib), 'languages: 27 it, 26 fr, 56 en');
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
select pg_temp.check((select count(*) = 98 from lib where image_path like '/recipe-photos/%.webp'), '98 recipes have a photo served by the app');
select pg_temp.check(not exists (select 1 from lib where difficulty is null or equipment is null),
                     'every recipe has a difficulty and equipment');
select pg_temp.check((select count(*) > 0 from ingredient_catalog where exotic)
                     and not (select exotic from ingredient_catalog where name = 'soy sauce'), 'exotic ingredients are flagged');
select pg_temp.check((select count(*) = 1323 from recipe_ingredients i join lib r on r.id = i.recipe_id
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
select pg_temp.check((select count(*) = 109 from lib), 'library recipes are kept');

-- Seed recipes and lines have the fixed ids from recipes.json.
select pg_temp.check((select id = 'd8e4ac12-403d-4d06-97cf-022682d08894' from recipes
                      where household_id is null and title = 'Arrosto di tacchino alle erbe'), 'seed recipes have their fixed id');
select pg_temp.check((select i.id = 'b6b4b263-9d00-433a-a43b-af72a2b7bd33' from recipe_ingredients i join recipes r on r.id = i.recipe_id
                      where r.title = 'Arrosto di tacchino alle erbe' and i.position = 0), 'seed lines have their fixed id');

-- Loading it again adds nothing.
\i seed_library.sql
select pg_temp.check((select count(*) = 109 from lib), 're-running seed_library.sql adds no duplicates');

select pg_temp.check((select count(*) filter (where collection = 'original') = 10
                             and count(*) filter (where collection = 'web') = 109
                      from recipes where household_id is null), 'seed collections: 10 originals, 109 web');

-- AI-generated seed recipes have no source link: they're known by language and title.
create temp view ai as select * from recipes where household_id is null and ai_generated_recipe;
select pg_temp.check((select count(*) = 10 and count(source_url) = 0 from ai), '10 AI-generated seed recipes, without a source link');
select pg_temp.check(not exists (select 1 from lib where ai_generated_recipe), 'sourced recipes are not marked AI-generated');
\i seed_library.sql
select pg_temp.check((select count(*) = 10 from ai), 're-running seed_library.sql adds no duplicate AI recipes');
select pg_temp.check(not exists (
  select 1 from recipe_ingredients i join ai r on r.id = i.recipe_id
  where not exists (select 1 from ingredient_catalog c where c.name = i.name)), 'AI recipe ingredients are in the catalogue');
select pg_temp.check((select bool_and(i.optional) and count(*) = 2 from recipe_ingredients i join ai r on r.id = i.recipe_id
                      where r.title = 'Chana masala' and i.name in ('fresh coriander', 'chili flakes')),
                     'optional lines are loaded');
select pg_temp.check((select count(*) = 0 from recipe_ingredients i join ai r on r.id = i.recipe_id
                      where r.title = 'Shakshuka with feta' and i.name = 'feta' and i.optional),
                     'lines are required unless marked optional');

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
select pg_temp.check((select r.difficulty = s.difficulty and r.equipment = s.equipment and r.equipment is not null
                      from recipes r join recipes s on s.id = r.copied_from where r.id = :'cp'),
                     'copy keeps difficulty and equipment');
select pg_temp.check((select equipment is not null from library_recipes where id = :'cp'), 'library view has the new columns');
select pg_temp.check((select r.prep_min = s.prep_min and r.cook_min = s.cook_min and r.total_min = s.total_min and r.prep_min is not null
                      from recipes r join recipes s on s.id = r.copied_from where r.id = :'cp'),
                     'copy keeps prep, cook and total time');
select pg_temp.check((select cook_min is not null from library_recipes where id = :'cp'), 'library view has prep and cook time');
select id as aisrc from library_recipes where title = 'Pasta e ceci' and ai_generated_recipe \gset
select copy_recipe(:'aisrc') as aicp \gset
select pg_temp.check((select ai_generated_recipe from library_recipes where id = :'aicp'), 'copy keeps the AI-generated flag');
select pg_temp.check((select collection = 'original' from library_recipes where id = :'aicp')
                     and (select collection = 'web' from library_recipes where id = :'cp'),
                     'a copy stays in its seed recipe''s collection');
insert into recipes (household_id, title, source_type) values (my_household_id(), 'Typed one', 'typed'),
  (my_household_id(), 'From a link', 'web'), (my_household_id(), 'From a photo', 'photo');
select pg_temp.check((select array_agg(collection order by title) = '{our_import,our_import,our_recipe}'
                      from library_recipes where title in ('Typed one', 'From a link', 'From a photo')),
                     'household recipes: typed ones are ours, the rest are imports');
select pg_temp.check((select count(*) filter (where optional) = 2 from recipe_ingredients where recipe_id = :'aicp'),
                     'copy keeps optional lines');
reset role;

-- Seed recipes (and copies) loaded before these fields existed are filled in by re-running seed_library.sql.
update recipes set difficulty = null, equipment = null, prep_min = null, cook_min = null where id = :'cp' or id = :'src';
\i seed_library.sql
select pg_temp.check((select count(*) = 2 from recipes where (id = :'cp' or id = :'src') and prep_min is not null and cook_min is not null),
                     're-running seed_library.sql fills prep and cook time');
select pg_temp.check((select count(*) = 2 from recipes where (id = :'cp' or id = :'src') and difficulty is not null
                      and equipment is not null), 're-running seed_library.sql fills difficulty and equipment');

-- When the catalogue gets finer, re-running seed_library.sql renames lines in
-- recipes already loaded (and copies) and they find their new product.
select id as pel from recipes where title = 'Pasta e lenticchie' and household_id is null \gset
update recipe_ingredients set name = 'chicken stock', product_id = null where recipe_id = :'pel' and raw_text like '%brodo vegetale%';
update recipes set kcal_per_serving = 1 where id = :'pel';
\i seed_library.sql
select pg_temp.check((select i.name = 'vegetable stock' and p.ingredient = 'vegetable stock'
                      from recipe_ingredients i join products p on p.id = i.product_id
                      where i.recipe_id = :'pel' and i.raw_text like '%brodo vegetale%'), 're-running seed_library.sql follows a split ingredient');
select pg_temp.check((select kcal_per_serving > 1 from recipes where id = :'pel'), 'and refreshes macros');
select pg_temp.check(not exists (select 1 from recipe_ingredients where product_id is null), 'every recipe line has a product');
select pg_temp.check(not exists (select 1 from products where household_id is null and ingredient is null
                                 and name_fr in ('Lentilles', 'Butternut', 'Yaourts nature')),
                     'new catalogue ingredients take over shared products with their name');
select pg_temp.check((select diet_class = 'meat' from ingredient_catalog where name = 'chicken stock'), 'chicken stock is not vegetarian');

-- The catalogue has fixed ids (seed.sql): an ingredient's product has the ingredient's id.
select pg_temp.check((select id = '31ea62a7-f216-40b6-a6d8-ea8fc749b1a7' from ingredient_catalog where name = 'olive oil'), 'catalogue ingredients have their fixed id');
select pg_temp.check(not exists (select 1 from products p join ingredient_catalog c on c.name = p.ingredient where p.id <> c.id),
                     'a catalogue ingredient''s product has the ingredient''s id');
select pg_temp.check((select id = '426208bd-c1e2-4974-938d-b5a64a13df1a' from products where household_id is null and search_key = 'ampoules'),
                     'shared everyday products have their fixed id');
