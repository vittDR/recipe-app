-- Two households on the same copy of the app: each sees the shared catalogue
-- and its own rows, never the other's, and can't point at the other's rows.
\set ON_ERROR_STOP on

create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
  if p_user is null then
    execute 'reset role';
  else
    execute 'set role authenticated';
  end if;
end $$;

create or replace function pg_temp.check(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;

-- Runs p_sql and checks it fails (any error, or a write RLS silently skips).
create or replace function pg_temp.refused(p_sql text, p_msg text) returns void language plpgsql as $$
declare
  v_rows int;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
  exception when others then
    raise notice 'ok - % (%)', p_msg, sqlerrm;
    return;
  end;
  if v_rows > 0 then raise exception 'FAILED: % (% rows changed)', p_msg, v_rows; end if;
  raise notice 'ok - % (no rows)', p_msg;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'anna@example.com', '{"first_name":"Anna"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'boris@example.com', '{"first_name":"Boris"}');

-- Household A: a recipe, an own item, a store, a tag, a list line, a meal.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select create_household('Chez Anna', 'Europe/Paris') as ha \gset
insert into recipes (household_id, title, source_type) values (:'ha', 'Gratin d''Anna', 'typed') returning id as recipe_a \gset
insert into recipe_ingredients (recipe_id, name) values (:'recipe_a', 'courgette');
select create_household_product(gen_random_uuid(), 'Pâte secrète d''Anna', 'pantry') as product_a \gset
select add_store('Marché d''Anna') as store_a \gset
insert into tag_catalog (household_id, name, name_fr) values (:'ha', 'dimanche', 'Dimanche');
select put_grocery_item('33333333-0000-0000-0000-0000000000a1', format('{"product_id":"%s","recipe_id":"%s"}', :'product_a', :'recipe_a')::jsonb);
insert into meals (household_id, for_date, recipe_id) values (:'ha', current_date, :'recipe_a');
insert into taste_rules (user_id, kind, value, product_id) values (auth.uid(), 'love', 'pâte', :'product_a');
select pg_temp.check((select count(*) = 1 from grocery_items), 'A has a list line');

-- A deck for A, as the deal-deck function writes it.
select pg_temp.act_as(null);
insert into decks (household_id, for_date, started_by, who_eating)
values (:'ha', current_date, '00000000-0000-0000-0000-0000000000e1', '{00000000-0000-0000-0000-0000000000e1}')
returning id as deck_a \gset
insert into deck_cards (deck_id, recipe_id, position) values (:'deck_a', :'recipe_a', 1);
insert into deck_members (deck_id, user_id) values (:'deck_a', '00000000-0000-0000-0000-0000000000e1');

select set_config('my.product_a', :'product_a', false);

-- Household B.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select create_household('Chez Boris', 'Europe/Paris') as hb \gset

-- Reads: only the shared rows and B's own.
select pg_temp.check((select count(*) = 1 from households), 'B sees only its household');
select pg_temp.check((select count(*) = 1 from household_members), 'B sees only its members');
select pg_temp.check((select count(*) = 1 from profiles), 'B sees only its own profile');
select pg_temp.check(not exists (select 1 from recipes where household_id is not null), 'B sees no other household''s recipes');
select pg_temp.check(not exists (select 1 from recipe_ingredients where recipe_id = :'recipe_a'), 'nor their lines');
select pg_temp.check(not exists (select 1 from library_recipes where id = :'recipe_a'), 'nor in the library');
select pg_temp.check(exists (select 1 from library_recipes where household_id is null), 'B sees the seed library');
select pg_temp.check(not exists (select 1 from products where household_id is not null), 'B sees no other household''s items');
select pg_temp.check(exists (select 1 from products where household_id is null), 'B sees the shared catalogue');
select pg_temp.check(not exists (select 1 from tag_catalog where household_id is not null), 'B sees no other household''s tags');
select pg_temp.check((select count(*) = 0 from household_stores), 'stores are private');
select pg_temp.check((select count(*) = 0 from household_products), 'item history is private');
select pg_temp.check((select count(*) = 0 from grocery_items), 'lists are private');
select pg_temp.check((select count(*) = 0 from meals), 'meals are private');
select pg_temp.check((select count(*) = 7 from plan_days), 'B sees only its own plan');
select pg_temp.check((select count(*) = (select count(*) from ingredient_catalog where is_staple) from household_staples),
                     'B sees only its own staples');
select pg_temp.check((select count(*) = 0 from decks) and (select count(*) = 0 from deck_cards)
                     and (select count(*) = 0 from deck_members), 'decks are private');
select pg_temp.check((select count(*) = 0 from taste_rules), 'taste rules are private');
select pg_temp.check((select count(*) = 0 from my_portion(:'recipe_a')), 'no plate for another household''s recipe');
select pg_temp.check((select count(*) = 0 from member_fits(:'deck_a')), 'no fits for another household''s deck');
select pg_temp.check(not is_catalog_admin(), 'a household creator is not a catalogue admin');

-- Writes into A's rows do nothing.
select pg_temp.refused(format('update recipes set title = %L where id = %L', 'x', :'recipe_a'), 'B cannot edit A''s recipe');
select pg_temp.refused(format('delete from recipes where id = %L', :'recipe_a'), 'B cannot delete A''s recipe');
select pg_temp.refused(format('update products set name_fr = %L where id = %L', 'x', :'product_a'), 'B cannot edit A''s item');
select pg_temp.refused(format('update households set name = %L where id = %L', 'x', :'ha'), 'B cannot rename A''s household');
select pg_temp.refused(format('update grocery_items set quantity = 9 where household_id = %L', :'ha'), 'B cannot edit A''s list');
select pg_temp.refused(format('delete from household_stores where id = %L', :'store_a'), 'B cannot delete A''s store');
select pg_temp.refused(format('insert into grocery_items (household_id, name) values (%L, %L)', :'ha', 'x'), 'B cannot add to A''s list');
select pg_temp.refused(format('insert into recipe_ingredients (recipe_id, name) values (%L, %L)', :'recipe_a', 'x'), 'B cannot add lines to A''s recipe');
select pg_temp.refused('update products set default_qty = 9 where household_id is null', 'B cannot edit the shared catalogue');
select pg_temp.refused(format('insert into products (name_fr, ingredient) values (%L, %L)', 'x', 'onion'), 'B cannot add to the shared catalogue');

-- References to A's rows from B's own rows are refused.
select pg_temp.refused(format('insert into grocery_items (household_id, name, product_id) values (%L, %L, %L)', :'hb', 'x', :'product_a'),
                       'B''s list cannot use A''s item');
select pg_temp.refused(format('insert into grocery_items (household_id, name, store_id) values (%L, %L, %L)', :'hb', 'x', :'store_a'),
                       'B''s list cannot use A''s store');
select pg_temp.refused(format('insert into grocery_items (household_id, name, recipe_id) values (%L, %L, %L)', :'hb', 'x', :'recipe_a'),
                       'B''s list cannot point at A''s recipe');
select pg_temp.refused(format('insert into meals (household_id, for_date, recipe_id) values (%L, current_date, %L)', :'hb', :'recipe_a'),
                       'B''s meal cannot be A''s recipe');
select pg_temp.refused(format('update plan_days set recipe_id = %L where household_id = %L', :'recipe_a', :'hb'),
                       'B''s plan cannot pre-pick A''s recipe');
select pg_temp.refused(format('insert into household_products (household_id, product_id) values (%L, %L)', :'hb', :'product_a'),
                       'B cannot keep history for A''s item');
select pg_temp.refused(format('insert into taste_rules (user_id, kind, value, product_id) values (auth.uid(), %L, %L, %L)', 'never', 'x', :'product_a'),
                       'B''s tastes cannot name A''s item');
select pg_temp.refused(format('insert into products (household_id, name_fr, ingredient) values (%L, %L, %L)', :'hb', 'Mon oignon', 'onion'),
                       'a household''s item cannot claim a catalogue ingredient');

-- RPCs stay inside the household.
select pg_temp.refused(format('select put_grocery_item(%L, %L)', '33333333-0000-0000-0000-0000000000a1', '{"name":"pain"}'),
                       'B cannot reuse the id of A''s list line');
select pg_temp.refused(format('select set_product_section(%L, null, %L)', :'product_a', null), 'B cannot file A''s item');
select pg_temp.refused(format('select close_deck(%L)', :'deck_a'), 'B cannot close A''s deck');
select pg_temp.refused(format('select copy_recipe(%L)', :'recipe_a'), 'B cannot copy A''s recipe');
do $$ begin
  perform put_grocery_item(gen_random_uuid(), jsonb_build_object('product_id', current_setting('my.product_a')));
exception when others then null;
end $$;
select put_grocery_item(gen_random_uuid(), '{"name":"Pâte secrète d''Anna"}');
select pg_temp.check(not exists (select 1 from grocery_items where product_id = :'product_a'),
                     'adding by A''s item id or name never lands on A''s item');
select pg_temp.check((select count(*) = 1 from products where household_id = :'hb'), 'the name became B''s own item');

-- A still sees all of its own.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select title = 'Gratin d''Anna' from recipes where id = :'recipe_a'), 'A''s recipe is untouched');
select pg_temp.check((select count(*) = 1 from grocery_items), 'A''s list is untouched');
select pg_temp.check((select count(*) = 1 from decks), 'A sees its deck');
select pg_temp.check(not exists (select 1 from products where household_id = :'hb'), 'and not B''s items');

reset role;
