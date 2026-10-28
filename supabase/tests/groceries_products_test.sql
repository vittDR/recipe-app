-- Grocery products: one item whatever it's called, household items, stores
-- and the "Frequently bought" list.
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

select pg_temp.check(not exists (select 1 from ingredient_catalog c
                                 where not exists (select 1 from products p where p.ingredient = c.name)),
                     'every catalogue ingredient is a product');
select pg_temp.check(product_key('Chou-fleur') = product_key('chou fleur')
                     and product_key('Œufs') = 'oeufs' and product_key('Fêta') = 'feta', 'product keys ignore case, accents and dashes');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000d', 'you@example.com', '{"first_name":"Dee"}'),
  ('00000000-0000-0000-0000-00000000000e', 'e@example.com', '{"first_name":"Eve"}');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select create_household('Chez Eve', 'Europe/Paris') as eve_hid \gset

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select create_household('Chez Dee', 'Europe/Paris') as hid \gset
select pg_temp.check((select count(*) = 1 from household_aisle_order where aisle = 'hygiene'), 'new households get the hygiene aisle');

-- chicken breast = Blanc de Poulet = poulet: one line.
select add_grocery_items('[{"name":"chicken breast","quantity":2},{"name":"Blanc de Poulet","quantity":1},{"name":"poulet"}]');
select pg_temp.check((select count(*) = 1 and min(quantity) = 3 and min(name) = 'blanc de poulet' and min(aisle::text) = 'meat_fish'
                      from grocery_items), 'English, French and alias names merge into one product');

-- A household's own item, private to it.
select add_grocery_items('[{"name":"Recharges Swiffer poussière"}]');
select id as swiffer from products where name_fr = 'Recharges Swiffer poussière' \gset
select pg_temp.check((select household_id = :'hid'::uuid and default_aisle = 'other' from products where id = :'swiffer'),
                     'unknown names become household products');
select pg_temp.check((select count(*) = 1 from grocery_items where product_id = :'swiffer'), 'and go on the list straight away');
select add_grocery_items(format('[{"product_id":"%s"}]', :'swiffer')::jsonb);
select pg_temp.check((select count(*) = 1 from grocery_items where product_id = :'swiffer'), 'adding by product id merges too');

-- Stores are sections; the choice is remembered.
select add_store('Picard') as picard \gset
select pg_temp.check(add_store('picard') = :'picard'::uuid, 'store names are unique per household');
select pg_temp.check((select position > (select max(position) from household_aisle_order) from household_stores),
                     'new stores go after the aisles');
select id as framboises from products where name_fr = 'Framboises' and household_id is null \gset
select add_grocery_items(format('[{"product_id":"%s"}]', :'framboises')::jsonb);
select set_product_section(:'framboises', null, :'picard');
select pg_temp.check((select store_id = :'picard'::uuid and aisle = 'produce' from grocery_items where product_id = :'framboises'),
                     'moving a product to a store moves it on the list');
update grocery_items set checked_at = now() where product_id = :'framboises';
select clear_checked_items();
select add_grocery_items('[{"name":"framboises"}]');
select pg_temp.check((select store_id = :'picard'::uuid from grocery_items
                      where product_id = :'framboises' and cleared_at is null), 'next time it goes to the store again');
select set_product_section(:'framboises', 'frozen', null);
select pg_temp.check((select store_id is null and aisle = 'frozen' from grocery_items
                      where product_id = :'framboises' and cleared_at is null), 'and back to an aisle');
select pg_temp.check((select add_count = 2 from household_products where product_id = :'framboises'), 'adds are counted');

select set_frequent(:'swiffer', true);
select pg_temp.check((select pinned and not hidden from household_products where product_id = :'swiffer'), 'pin to frequents');
select set_frequent(:'swiffer', false);
select pg_temp.check((select hidden and not pinned from household_products where product_id = :'swiffer'), 'hide from frequents');

-- The other household sees none of it.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select pg_temp.check((select count(*) = 0 from products where id = :'swiffer'), 'household products are private');
select pg_temp.check((select count(*) = 0 from household_stores) and (select count(*) = 0 from household_products),
                     'stores and history are private');
do $$ begin
  perform set_product_section((select id from products where name_fr = 'Framboises'), null,
                              (select id from household_stores limit 1));
exception when others then null;
end $$;
select add_grocery_items(format('[{"product_id":"%s"}]', :'swiffer')::jsonb);
select pg_temp.check((select count(*) = 0 from grocery_items), 'cannot add another household''s product');

-- The imported frequently-bought list (supabase/personal/frequent_items.sql).
select pg_temp.act_as(null);
\i personal/frequent_items.sql
select pg_temp.check((select count(*) = 66 from household_products where household_id = :'hid' and pinned), 'frequents imported');
select pg_temp.check((select count(*) = 7 from household_products hp join household_stores s on s.id = hp.store_id
                      where hp.household_id = :'hid' and s.name = 'Picard'), 'Picard items go to the Picard store');
\i personal/frequent_items.sql
select pg_temp.check((select count(*) = 1 from household_stores where household_id = :'hid'), 'import is re-runnable');

-- A household's recipe: lines match catalogue ingredients, then any product,
-- and only unknown ones become new household items.
reset role;
insert into recipes (household_id, title, source_type) values (:'hid', 'Pavlova', 'typed') returning id as rid \gset
insert into recipe_ingredients (recipe_id, position, name, quantity, unit) values
  (:'rid', 0, 'chicken breast', 1, 'piece'),
  (:'rid', 1, 'framboises', 125, 'g'),
  (:'rid', 2, 'Recharges Swiffer poussière', null, null),
  (:'rid', 3, 'sirop de sureau', 2, 'tbsp');
select pg_temp.check((select p.ingredient = 'chicken breast' from recipe_ingredients i join products p on p.id = i.product_id
                      where i.recipe_id = :'rid' and i.position = 0), 'catalogue ingredient line uses its product');
select pg_temp.check((select i.product_id = :'framboises'::uuid and i.aisle = 'produce' from recipe_ingredients i
                      where i.recipe_id = :'rid' and i.position = 1), 'unmatched line finds a shared product and its aisle');
select pg_temp.check((select i.product_id = :'swiffer'::uuid from recipe_ingredients i
                      where i.recipe_id = :'rid' and i.position = 2), 'or the household''s own item');
select pg_temp.check((select p.household_id = :'hid'::uuid and p.name_fr = 'sirop de sureau'
                      from recipe_ingredients i join products p on p.id = i.product_id
                      where i.recipe_id = :'rid' and i.position = 3), 'only unknown lines create an item');
select pg_temp.check((select count(*) = 1 from products where search_key = 'sirop de sureau'), 'created once');

-- Leave the database as the other suites expect it.
delete from households where id in (:'hid', :'eve_hid');
delete from auth.users where id in ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000e');
