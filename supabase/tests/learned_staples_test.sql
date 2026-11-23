-- "Toujours à la maison" starts small and learns (migrations/20261210000001_learned_staples.sql).
\set ON_ERROR_STOP on

create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
  if p_user is null then execute 'reset role'; else execute 'set role authenticated'; end if;
end $$;

create or replace function pg_temp.check(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000ee01', 'cook@example.com', '{"first_name":"Cook"}');

select pg_temp.act_as('00000000-0000-0000-0000-00000000ee01');
select create_household('Cuisine', 'Europe/Paris') as hid \gset
select pg_temp.check((select count(*) between 3 and 10 from household_staples where household_id = :'hid'), 'a new household starts with a few basics');
select pg_temp.check((select bool_and(p.ingredient in ('salt', 'black pepper', 'white pepper', 'olive oil', 'vegetable oil', 'sugar', 'flour', 'vinegar'))
  from household_staples s join products p on p.id = s.product_id where s.household_id = :'hid'), 'salt, pepper, oils, sugar, flour, vinegar');
select pg_temp.check((select count(*) = 8 from household_staples where household_id = :'hid'), 'all eight are in the catalogue');

select p.id as cumin from products p where p.ingredient = 'cumin' and p.household_id is null limit 1 \gset
select p.id as onion from products p where p.ingredient = 'onion' and p.household_id is null limit 1 \gset
select p.id as salt from products p where p.ingredient = 'salt' and p.household_id is null limit 1 \gset

select pg_temp.check((select count(*) = 0 from record_list_choices('{}', array[:'cumin'::uuid, :'onion'::uuid])), 'left out once: not yet');
select pg_temp.check((select count(*) = 0 from record_list_choices(array[:'onion'::uuid], array[:'cumin'::uuid])), 'left out twice: not yet');
select pg_temp.check((select array_agg(x) = array[:'cumin'::uuid] from record_list_choices('{}', array[:'cumin'::uuid, :'onion'::uuid]) x),
  'left out 3 times in a row: a staple');
select pg_temp.check(exists (select 1 from household_staples where household_id = :'hid' and product_id = :'cumin'), 'cumin is now always at home');
select pg_temp.check(not exists (select 1 from household_staples where household_id = :'hid' and product_id = :'onion'), 'adding onions once reset their count');
select pg_temp.check((select count(*) = 0 from record_list_choices('{}', array[:'salt'::uuid])), 'a staple already is not counted again');

do $$ begin
  perform * from household_staple_skips;
  raise exception 'FAILED: the counts are readable from the app';
exception when insufficient_privilege then raise notice 'ok - the counts are not readable from the app';
end $$;

select pg_temp.act_as(null);
delete from households where name = 'Cuisine';
delete from auth.users where id = '00000000-0000-0000-0000-00000000ee01';

select pg_temp.check((select count(*) = 8 from ingredient_catalog where is_staple), 'the catalogue has 8 strict staples');
select pg_temp.check(not exists (select 1 from recipe_ingredients where is_staple and lower(name) = 'garlic'), 'garlic is no staple on recipe lines');
select pg_temp.check(exists (select 1 from recipe_ingredients where is_staple), 'salt still is');
