-- Ingredient groups: "Pork (all)" and "Cow's milk and dairy" stand for their
-- catalogue items, and a never rule can name a group instead of an item.
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

select pg_temp.check((select count(*) = 14 from ingredient_group_members where group_key = 'pork'), 'pork covers its 14 items');
select pg_temp.check((select count(*) = 25 from ingredient_group_members where group_key = 'cow_milk'), 'cow''s milk covers its 25 items');
select pg_temp.check(exists (select 1 from ingredient_group_members where group_key = 'pork' and ingredient = 'sausage'), 'pork covers sausage');
select pg_temp.check(exists (select 1 from ingredient_group_members where group_key = 'pork' and ingredient = 'chorizo'), 'pork covers chorizo');
select pg_temp.check(exists (select 1 from ingredient_group_members where group_key = 'cow_milk' and ingredient = 'plain yogurt'), 'cow''s milk covers yoghurt');
select pg_temp.check(not exists (select 1 from ingredient_group_members where group_key = 'cow_milk' and ingredient in ('feta', 'pecorino', 'goat cheese')),
  'sheep and goat cheeses are not cow''s milk');
select pg_temp.check((select count(*) = 15 from ingredient_groups), 'fifteen groups');
-- Every cheese in the catalogue (its classification says dairy protein or cheese sauce, or "cheese" in its name) is in Cheese.
select pg_temp.check(not exists (select 1 from ingredient_catalog c
  where (c.name ~ 'cheese|mozzarella|parmesan|ricotta|feta|pecorino|cheddar|emmental|fontina|reblochon|halloumi|paneer|queso|kefalotyri'
         or c.traits && '{sauce:cheese}') and c.name not in (select ingredient from ingredient_group_members where group_key = 'cheese')),
  'every cheese is in Cheese');
select pg_temp.check(not exists (select ingredient from ingredient_group_members where group_key = 'cow_milk'
                                 except select ingredient from ingredient_group_members where group_key = 'dairy'), 'cow''s milk is part of dairy');
select pg_temp.check(not exists (select ingredient from ingredient_group_members where group_key = 'cheese'
                                 except select ingredient from ingredient_group_members where group_key = 'dairy'), 'cheese is part of dairy');
-- Every fish and shellfish in the catalogue is in Fish or Seafood.
select pg_temp.check(not exists (select 1 from ingredient_catalog c where c.traits && '{protein:fish,protein:shellfish}'
  and c.name not in (select ingredient from ingredient_group_members where group_key in ('fish', 'seafood'))), 'every fish and shellfish is grouped');
select pg_temp.check(not exists (select 1 from ingredient_catalog c where c.traits && '{protein:legumes}'
  and c.name not in (select ingredient from ingredient_group_members where group_key = 'legumes')), 'every legume is grouped');
-- Chilli: everything the catalogue gives real heat.
select pg_temp.check(not exists (select 1 from ingredient_catalog c, unnest(c.traits) t
  where t like 'heat:%' and split_part(t, ':', 2)::real >= 0.1
    and c.name not in (select ingredient from ingredient_group_members where group_key = 'chilli')), 'everything hot is in Chilli');
select pg_temp.check(not exists (select 1 from ingredient_groups g where not exists (select 1 from ingredient_group_members m where m.group_key = g.key)),
  'every group has items');
-- Every pork item is meat, every cow's milk item is in the catalogue's dairy or a preparation.
select pg_temp.check(not exists (select 1 from ingredient_group_members m join ingredient_catalog c on c.name = m.ingredient
                                 where m.group_key in ('pork', 'beef', 'lamb', 'poultry') and c.diet_class <> 'meat'), 'meat groups hold only meat');
-- Each item has a shared product, so a rule on the group reaches recipe lines.
select pg_temp.check(not exists (select 1 from ingredient_group_members m where not exists (
  select 1 from products p where p.ingredient = m.ingredient and p.household_id is null)), 'every group item is a product');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b7', 'gr1@example.com', '{"first_name":"Dee"}');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b7');
select pg_temp.check((select count(*) >= 6 from ingredient_groups), 'everyone reads the groups');
insert into taste_rules (user_id, kind, value, group_key) values (auth.uid(), 'never', 'Porc (tout)', 'pork');
select pg_temp.check((select count(*) = 1 from taste_rules where group_key = 'pork'), 'a never rule on a group');
do $$ begin
  insert into taste_rules (user_id, kind, value, group_key, product_id)
  values (auth.uid(), 'never', 'both', 'cow_milk', (select id from products where ingredient = 'butter'));
  raise exception 'FAILED: a rule names an item or a group, not both';
exception when check_violation then raise notice 'ok - a rule names an item or a group, not both';
end $$;
do $$ begin
  insert into taste_rules (user_id, kind, value) values (auth.uid(), 'never', 'nothing');
  raise exception 'FAILED: a never rule names something';
exception when check_violation then raise notice 'ok - a never rule names something';
end $$;
do $$ begin
  insert into taste_rules (user_id, kind, value, group_key) values (auth.uid(), 'never', 'Porc encore', 'pork');
  raise exception 'FAILED: one rule per group';
exception when unique_violation then raise notice 'ok - one rule per group';
end $$;
select pg_temp.act_as(null);
