-- People who eat but don't choose (migrations/20261209000001_extra_eaters.sql).
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
  ('00000000-0000-0000-0000-00000000dd01', 'parent@example.com', '{"first_name":"Parent"}'),
  ('00000000-0000-0000-0000-00000000dd02', 'stranger@example.com', '{"first_name":"Stranger"}');

select pg_temp.act_as('00000000-0000-0000-0000-00000000dd01');
select create_household('Famille', 'Europe/Paris') as hid \gset
insert into household_eaters (name, age_band, portion, allergens) values ('Léa', '4-8', 0.5, '{nuts}') returning id as lea \gset
insert into household_eaters (name, age_band, portion) values ('Mamie', '14+', 1) returning id as mamie \gset
select pg_temp.check((select count(*) = 2 and bool_and(household_id = :'hid') from household_eaters), 'a member adds extra eaters to the household');

do $$ begin
  insert into household_eaters (name, age_band, portion) values ('Tom', '9-13', 0.3);
  raise exception 'FAILED: a portion off the quarter steps was saved';
exception when check_violation then raise notice 'ok - portions go in quarter steps';
end $$;
do $$ begin
  insert into household_eaters (name, age_band, portion) values ('Bébé', '0-3', 0.25);
  raise exception 'FAILED: a baby was saved';
exception when check_violation then raise notice 'ok - no 0-3 age band';
end $$;

-- The pot: 1 serving for the member, plus the extra eaters at the table.
insert into recipes (household_id, title, source_type) values (:'hid', 'Gratin', 'typed') returning id as rid \gset
select pg_temp.act_as(null);
update recipes set kcal_per_serving = 600, protein_g_per_serving = 30 where id = :'rid';
select pg_temp.act_as('00000000-0000-0000-0000-00000000dd01');
select pg_temp.check((select pot_servings = 2.5 from my_portion(:'rid')), 'no deck: everyone, 1 + 0.5 + 1');
select pg_temp.check((select pot_servings = 1.5 from my_portion(:'rid', null, array[:'lea'::uuid])), 'tonight with Léa: 1 + 0.5');
select pg_temp.check((select pot_servings = 1 from my_portion(:'rid', null, '{}')), 'tonight alone: 1');
select pg_temp.check((select servings = 1 from my_portion(:'rid', null, array[:'lea'::uuid])), 'my own plate stays mine');

-- Another household sees none of them and can't add to this one.
select pg_temp.act_as('00000000-0000-0000-0000-00000000dd02');
select create_household('Ailleurs', 'Europe/Paris');
select pg_temp.check((select count(*) = 0 from household_eaters), 'other households see no extra eaters');
do $$ begin
  insert into household_eaters (household_id, name, age_band, portion)
  select household_id, 'Intrus', '14+', 1 from household_eaters limit 1;
  insert into household_eaters (household_id, name, age_band, portion)
  values ((select id from households where name = 'Famille' limit 1), 'Intrus', '14+', 1);
  raise exception 'FAILED: wrote into another household';
exception when insufficient_privilege or not_null_violation or foreign_key_violation then
  raise notice 'ok - no extra eater in another household';
end $$;

select pg_temp.act_as(null);
select pg_temp.check((select extra_eaters = '{}' from decks limit 1) is not false, 'decks carry extra_eaters (empty by default)');
-- Leave nothing behind: later tests count households.
delete from households where name in ('Famille', 'Ailleurs');
delete from auth.users where id in ('00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-00000000dd02');
