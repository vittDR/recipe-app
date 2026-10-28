-- Groceries v2: catalogue defaults, admin edits, list writes with ids from the
-- phone, the batched "added to the list" push and notification switches.
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

-- Defaults
select pg_temp.check((select count(*) = 0 from products where household_id is null and default_unit is null),
                     'every shared product has a default unit');
select pg_temp.check((select default_unit = 'l' and default_qty = 2 from products where search_key = 'lait' and household_id is null),
                     'milk: 2 l');
select pg_temp.check((select default_unit = 'piece' and default_qty = 2 from products where search_key = 'citron' and household_id is null),
                     'lemons: 2 pieces');
select pg_temp.check((select default_unit = 'g' and default_qty = 800 from products where search_key = 'cuisse de poulet'),
                     'chicken thighs: 800 g');
select pg_temp.check((select default_unit = 'stalk' and default_qty is null from products where search_key = 'citronnelle'),
                     'lemongrass: a stalk, no quantity');
select pg_temp.check((select suggested_units[1] = 'l' from products where search_key = 'lait' and household_id is null),
                     'the default unit is suggested first');
update products set default_qty = 3 where search_key = 'lait' and household_id is null;
update products set default_unit = null where search_key = 'riz' and household_id is null;
select apply_product_defaults();
select pg_temp.check((select default_qty = 3 from products where search_key = 'lait' and household_id is null),
                     're-running the defaults keeps values someone set');
select pg_temp.check((select default_unit = 'pack' from products where search_key = 'riz' and household_id is null),
                     'and fills ones that are missing');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.com', '{"first_name":"Olga"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'partner@example.com', '{"first_name":"Paul"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'other@example.com', '{"first_name":"Otto"}');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select create_household('Chez Olga', 'Europe/Paris') as hid \gset
select code from create_invite() \gset
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select redeem_invite(:'code');

-- Admin: the household's creator edits the shared catalogue, others can't.
select id as lait from products where search_key = 'lait' and household_id is null \gset
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
update products set default_qty = 9 where id = :'lait';
select pg_temp.check((select default_qty = 3 from products where id = :'lait'), 'members cannot edit the shared catalogue');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check(is_catalog_admin(), 'the household creator is the catalogue admin');
update products set default_qty = 1, suggested_units = '{l,bottle}' where id = :'lait';
select pg_temp.check((select default_qty = 1 from products where id = :'lait'), 'the admin can edit the shared catalogue');
insert into products (name_fr, name_en, default_aisle, default_unit) values ('Pois cassés', 'Split peas', 'pantry', 'pack');
select pg_temp.check((select count(*) = 1 from products where search_key = 'pois casses' and household_id is null),
                     'and add to it');

-- Writes with ids from the phone.
select put_grocery_item('11111111-0000-0000-0000-000000000001', format('{"product_id":"%s","quantity":2,"unit":"l"}', :'lait')::jsonb);
select put_grocery_item('11111111-0000-0000-0000-000000000001', format('{"product_id":"%s","quantity":2,"unit":"l"}', :'lait')::jsonb);
select pg_temp.check((select count(*) = 1 and min(quantity) = 2 from grocery_items where product_id = :'lait'),
                     'saving the same id twice adds the item once');
select put_grocery_item('11111111-0000-0000-0000-000000000002', format('{"product_id":"%s","quantity":1,"unit":"l"}', :'lait')::jsonb);
select pg_temp.check((select count(*) = 2 from grocery_items where product_id = :'lait'),
                     'a new id is a new row, never merged');

select create_household_product('22222222-0000-0000-0000-000000000001', 'Recharges Swiffer', 'household', 'pack', null) as swiffer \gset
select pg_temp.check(:'swiffer' = '22222222-0000-0000-0000-000000000001'
                     and (select default_aisle = 'household' and default_unit = 'pack' and household_id = :'hid'::uuid
                          from products where id = :'swiffer'), 'new catalog items keep the id, aisle and unit given');
select pg_temp.check(create_household_product('22222222-0000-0000-0000-000000000002', 'recharges swiffer', 'other') = :'swiffer'::uuid,
                     'the same name returns the existing item');
select pg_temp.check(create_household_product('22222222-0000-0000-0000-000000000003', 'Lait', 'other') = :'lait'::uuid,
                     'a shared name returns the shared product');
select put_grocery_item('11111111-0000-0000-0000-000000000003',
                        '{"product_id":"22222222-0000-0000-0000-0000000000ff","name":"Recharges Swiffer"}');
select pg_temp.check((select product_id = :'swiffer'::uuid from grocery_items where id = '11111111-0000-0000-0000-000000000003'),
                     'an unknown product id falls back to the name');

-- The push: one per batch, after 5 quiet minutes, to the others only.
select pg_temp.act_as(null);
select pg_temp.check((select array_length(item_ids, 1) = 3 from grocery_add_batches
                      where user_id = '00000000-0000-0000-0000-0000000000a1'), 'adds are collected per person');
select pg_temp.check(enqueue_grocery_pushes() = 0, 'nothing is sent before 5 quiet minutes');
update grocery_add_batches set last_add_at = now() - interval '6 minutes';
delete from grocery_items where id = '11111111-0000-0000-0000-000000000003';
select pg_temp.check(enqueue_grocery_pushes() = 1, 'then one push goes out');
select pg_temp.check((select count(*) = 1 and min(user_id::text) = '00000000-0000-0000-0000-0000000000a2'
                             and min((payload ->> 'count')::int) = 1 and min(payload ->> 'name') = 'Olga'
                             and min(payload ->> 'item_fr') = 'lait'
                      from push_outbox where kind = 'groceries_added'),
                     'to the partner, counting removed items out and the same product once');
select pg_temp.check((select count(*) = 0 from grocery_add_batches), 'and the batch is done');

-- Someone looking at the list gets no push.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
insert into grocery_presence (user_id) values ('00000000-0000-0000-0000-0000000000a2');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select add_grocery_items('[{"name":"citron","quantity":2}]');
select pg_temp.act_as(null);
update grocery_add_batches set last_add_at = now() - interval '6 minutes';
select pg_temp.check(enqueue_grocery_pushes() = 0 and (select count(*) = 1 from push_outbox where kind = 'groceries_added'),
                     'recipe adds count too, and nobody looking at the list is pushed');

-- Switches.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
update profiles set push_muted = '{groceries_added}' where id = '00000000-0000-0000-0000-0000000000a2';
select pg_temp.act_as(null);
select enqueue_push(array['00000000-0000-0000-0000-0000000000a2'::uuid], 'groceries_added', '{}');
select enqueue_push(array['00000000-0000-0000-0000-0000000000a2'::uuid], 'match', '{}');
select pg_temp.check((select count(*) = 1 from push_outbox where kind = 'groceries_added')
                     and (select count(*) = 1 from push_outbox where kind = 'match'), 'a muted kind is not sent, others are');
update profiles set push_enabled = false where id = '00000000-0000-0000-0000-0000000000a2';
select enqueue_push(array['00000000-0000-0000-0000-0000000000a2'::uuid], 'match', '{}');
select pg_temp.check((select count(*) = 1 from push_outbox where kind = 'match'), 'with notifications off nothing is sent');

-- Another household sees none of it.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
select pg_temp.check((select count(*) = 0 from grocery_presence) and (select count(*) = 0 from products where id = :'swiffer'),
                     'presence and household items stay private');
select pg_temp.act_as(null);
-- Other test files count their own households and pushes.
delete from households where id = :'hid';
delete from push_outbox;
