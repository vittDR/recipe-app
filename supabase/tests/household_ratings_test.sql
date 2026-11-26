-- Household ratings and favourites: one per (household, recipe), shared by the
-- household, stamped with whoever last changed the stars, never seen by another household.
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
  ('00000000-0000-0000-0000-0000000ab001', 'lisa@example.com', '{"first_name":"Lisa"}'),
  ('00000000-0000-0000-0000-0000000ab002', 'dario@example.com', '{"first_name":"Dario"}'),
  ('00000000-0000-0000-0000-0000000ab003', 'olga@example.com', '{"first_name":"Olga"}');

select id as seed_recipe from recipes where household_id is null order by title limit 1 \gset

select pg_temp.act_as('00000000-0000-0000-0000-0000000ab001');
select create_household('Chez Lisa', 'Europe/Paris') as hl \gset
select pg_temp.act_as(null);
insert into household_members (household_id, user_id) values (:'hl', '00000000-0000-0000-0000-0000000ab002');

-- Lisa rates first: she rates it for the household.
select pg_temp.act_as('00000000-0000-0000-0000-0000000ab001');
insert into household_recipes (recipe_id, stars) values (:'seed_recipe', 5);
select pg_temp.check((select stars = 5 and rated_by = '00000000-0000-0000-0000-0000000ab001' and rated_at is not null and not favorite
                      from household_recipes), 'the first rating is the household''s, stamped with who rated');
select pg_temp.refused(format('insert into household_recipes (recipe_id, stars) values (%L, 6)', :'seed_recipe'), 'stars are 1 to 5');

-- Dario sees it, and a heart alone keeps Lisa's rating.
select pg_temp.act_as('00000000-0000-0000-0000-0000000ab002');
select pg_temp.check((select count(*) = 1 from household_recipes where stars = 5), 'the partner sees the household''s rating');
insert into household_recipes (household_id, recipe_id, favorite) values (:'hl', :'seed_recipe', true)
  on conflict (household_id, recipe_id) do update set favorite = excluded.favorite;
select pg_temp.check((select favorite and stars = 5 and rated_by = '00000000-0000-0000-0000-0000000ab001' from household_recipes),
                     'a favourite leaves the rating and who rated it');
-- Saving the same stars again doesn't take the rating over; changing them does (the last edit wins).
update household_recipes set stars = 5 where recipe_id = :'seed_recipe';
select pg_temp.check((select rated_by = '00000000-0000-0000-0000-0000000ab001' from household_recipes), 'the same stars keep who rated');
update household_recipes set stars = 3 where recipe_id = :'seed_recipe';
select pg_temp.check((select stars = 3 and rated_by = '00000000-0000-0000-0000-0000000ab002' from household_recipes), 'the last edit wins');

-- Another household sees none of it and can't write for this one.
select pg_temp.act_as('00000000-0000-0000-0000-0000000ab003');
select create_household('Chez Olga', 'Europe/Paris') as ho \gset
select pg_temp.check((select count(*) = 0 from household_recipes), 'ratings stay inside the household');
select pg_temp.refused(format('insert into household_recipes (household_id, recipe_id, stars) values (%L, %L, 1)', :'hl', :'seed_recipe'),
                       'no rating for another household');
select pg_temp.refused('update household_recipes set stars = 1', 'no changing another household''s rating');
insert into household_recipes (recipe_id, stars) values (:'seed_recipe', 1);
select pg_temp.check((select count(*) = 1 and min(stars) = 1 from household_recipes), 'each household rates the same dish on its own');
select pg_temp.act_as(null);
select pg_temp.check((select count(*) = 2 from household_recipes where recipe_id = :'seed_recipe'), 'two households, two ratings');
-- Leave nothing behind: later tests count households.
delete from households where id in (:'hl', :'ho');
delete from auth.users where id in ('00000000-0000-0000-0000-0000000ab001', '00000000-0000-0000-0000-0000000ab002', '00000000-0000-0000-0000-0000000ab003');
