-- Taste signals: own rows only, about recipes, decks and meals in reach; one per key.
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
create or replace function pg_temp.refused(p_sql text, p_msg text) returns void language plpgsql as $$
declare v_rows int;
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
  ('00000000-0000-0000-0000-00000000a5f1', 'carla@example.com', '{"first_name":"Carla"}'),
  ('00000000-0000-0000-0000-00000000a5f2', 'dmitri@example.com', '{"first_name":"Dmitri"}');

select id as seed_recipe from recipes where household_id is null order by title limit 1 \gset

select pg_temp.act_as('00000000-0000-0000-0000-00000000a5f1');
select create_household('Chez Carla', 'Europe/Paris') as hc \gset
insert into recipes (household_id, title, source_type) values (:'hc', 'Soupe de Carla', 'typed') returning id as recipe_c \gset
insert into meals (household_id, for_date, recipe_id) values (:'hc', current_date, :'recipe_c') returning id as meal_c \gset

insert into taste_signals (recipe_id, kind, value) values (:'seed_recipe', 'starter', 'yes');
-- "I like it, but not often" is a quiz answer too; saving again replaces it.
insert into taste_signals (recipe_id, kind, value) values (:'seed_recipe', 'starter', 'sometimes')
  on conflict (user_id, key) do update set value = excluded.value;
select pg_temp.check((select value = 'sometimes' from taste_signals where kind = 'starter' and recipe_id = :'seed_recipe'), 'quiz takes "not often"');
update taste_signals set value = 'yes' where kind = 'starter' and recipe_id = :'seed_recipe';
insert into taste_signals (recipe_id, kind, value) values (:'seed_recipe', 'starter', 'pass')
  on conflict (user_id, key) do update set value = excluded.value;
select pg_temp.check((select count(*) = 1 and min(value) = 'pass' from taste_signals), 'retaking the quiz replaces the answer');
insert into taste_signals (recipe_id, kind, value, meal_id) values (:'recipe_c', 'rating', 'loved', :'meal_c');
select pg_temp.check((select count(*) = 2 from taste_signals), 'a rating for an own meal');
select pg_temp.refused(format('insert into taste_signals (recipe_id, kind, value) values (%L, %L, %L)', :'seed_recipe', 'rating', 'loved'),
                       'a rating needs a meal');
select pg_temp.refused(format('insert into taste_signals (recipe_id, kind, value) values (%L, %L, %L)', :'seed_recipe', 'starter', 'meh'),
                       'only known values');

select pg_temp.act_as('00000000-0000-0000-0000-00000000a5f2');
select create_household('Chez Dmitri', 'Europe/Paris') as hd \gset
select pg_temp.check((select count(*) = 0 from taste_signals), 'someone else''s signals are private');
select pg_temp.refused(format('insert into taste_signals (recipe_id, kind, value) values (%L, %L, %L)', :'recipe_c', 'starter', 'yes'),
                       'no signal on another household''s recipe');
select pg_temp.refused(format('insert into taste_signals (recipe_id, kind, value, meal_id) values (%L, %L, %L, %L)', :'seed_recipe', 'rating', 'loved', :'meal_c'),
                       'no rating on another household''s meal');
select pg_temp.refused(format('insert into taste_signals (user_id, recipe_id, kind, value) values (%L, %L, %L, %L)',
                       '00000000-0000-0000-0000-00000000a5f1', :'seed_recipe', 'starter', 'yes'), 'no signals for someone else');
select pg_temp.refused('delete from taste_signals', 'cannot delete someone else''s signals');
select pg_temp.act_as(null);
