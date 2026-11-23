-- Test accounts reset on every sign-in (migrations/20261205000001_test_accounts.sql).
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

-- T is a test account, R a real person.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000bb01', 'tester@example.com', '{"first_name":"Test"}'),
  ('00000000-0000-0000-0000-00000000bb02', 'real@example.com', '{"first_name":"Real"}');
insert into test_accounts (user_id) values ('00000000-0000-0000-0000-00000000bb01');

-- T goes through onboarding: a household with things in it, and personal settings.
select pg_temp.act_as('00000000-0000-0000-0000-00000000bb01');
select create_household('Test house', 'Europe/Paris') as th \gset
select code from create_invite() \gset
insert into member_goals (user_id, dinner_kcal) values (auth.uid(), 700);
insert into recipes (household_id, title, source_type) values (:'th', 'Test soup', 'typed');
insert into plan_dates (household_id, for_date, cook_at_home) values (:'th', current_date, false);
update profiles set onboarded_at = now() where id = auth.uid();
select pg_temp.act_as(null);
-- Decks are dealt by the server (deal-deck, service role).
insert into decks (id, household_id, for_date, started_by, who_eating)
values (gen_random_uuid(), :'th', current_date, '00000000-0000-0000-0000-00000000bb01',
        array['00000000-0000-0000-0000-00000000bb01']::uuid[]);

-- R signs in: nothing happens to anyone.
insert into auth.sessions (user_id) values ('00000000-0000-0000-0000-00000000bb02');
select pg_temp.check((select count(*) = 1 from households where id = :'th'), 'a real sign-in resets nothing');

-- T signs in again: back to the start.
insert into auth.sessions (user_id) values ('00000000-0000-0000-0000-00000000bb01');
select pg_temp.check((select count(*) = 0 from households where id = :'th'), 'the test household is gone');
select pg_temp.check((select count(*) = 0 from recipes where household_id = :'th'), 'with its recipes');
select pg_temp.check((select count(*) = 0 from decks where household_id = :'th'), 'and its decks');
select pg_temp.check((select count(*) = 0 from invites where code = :'code'), 'and its invite');
select pg_temp.check((select count(*) = 0 from member_goals where user_id = '00000000-0000-0000-0000-00000000bb01'), 'goals are gone');
select pg_temp.check((select onboarded_at is null and first_name = 'Test' from profiles where id = '00000000-0000-0000-0000-00000000bb01'),
  'back to onboarding, first name kept');

-- T joins R's real household, then signs in again: T leaves, R keeps everything.
select pg_temp.act_as('00000000-0000-0000-0000-00000000bb02');
select create_household('Real house', 'Europe/Paris') as rh \gset
insert into member_goals (user_id, dinner_kcal) values (auth.uid(), 650);
select code from create_invite() \gset
select pg_temp.act_as('00000000-0000-0000-0000-00000000bb01');
select redeem_invite(:'code');
select pg_temp.act_as(null);
insert into auth.sessions (user_id) values ('00000000-0000-0000-0000-00000000bb01');
select pg_temp.check((select count(*) = 1 from households where id = :'rh'), 'a real household stays');
select pg_temp.check((select array_agg(user_id) = array['00000000-0000-0000-0000-00000000bb02'::uuid]
  from household_members where household_id = :'rh'), 'the test account has left it');
select pg_temp.check((select dinner_kcal = 650 from member_goals where user_id = '00000000-0000-0000-0000-00000000bb02'),
  'the real person keeps their goals');

-- The app can't see the list or call the reset.
select pg_temp.act_as('00000000-0000-0000-0000-00000000bb01');
select pg_temp.check((select count(*) = 0 from test_accounts), 'the list is invisible from the app');
do $$ begin
  perform reset_test_account(auth.uid());
  raise exception 'FAILED: reset callable from the app';
exception when insufficient_privilege then raise notice 'ok - the reset is not callable from the app';
end $$;
select pg_temp.act_as(null);
