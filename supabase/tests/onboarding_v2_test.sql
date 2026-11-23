-- Onboarding v2: the onboarded stamp, goals that can be switched off, and the
-- household's weeknight defaults (migrations/20261203000001_onboarding_v2.sql).
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
  ('00000000-0000-0000-0000-00000000aa01', 'e1@example.com', '{"first_name":"Ana"}'),
  ('00000000-0000-0000-0000-00000000aa02', 'e2@example.com', '{"first_name":"Bo"}'),
  ('00000000-0000-0000-0000-00000000aa03', 'e3@example.com', '{"first_name":"Cy"}');

select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
select pg_temp.check((select onboarded_at is null from profiles where id = auth.uid()), 'a new account is not onboarded yet');
select create_household('Chez Ana', 'Europe/Paris') as hid \gset
select code from create_invite() \gset

-- Calories and protein off, fibre on.
insert into member_goals (user_id, dinner_kcal, dinner_protein_g, dinner_fibre_g) values (auth.uid(), null, null, 12);
select pg_temp.check((select dinner_kcal is null and dinner_fibre_g = 12 from member_goals where user_id = auth.uid()),
  'goals can be switched off and fibre set');

update households set deck_defaults = '{"maxMinutes": 30, "mood": "comfort", "filters": {"effort": "minimum"}}' where id = :'hid';
select pg_temp.check((select deck_defaults ->> 'mood' = 'comfort' from households where id = :'hid'), 'a member sets the weeknight defaults');

update profiles set onboarded_at = now() where id = auth.uid();
select pg_temp.check((select onboarded_at is not null from profiles where id = auth.uid()), 'finishing onboarding stamps the profile');

-- A joiner reads the defaults; nobody else can change them.
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa02');
select redeem_invite(:'code');
select pg_temp.check((select deck_defaults -> 'filters' ->> 'effort' = 'minimum' from households where id = :'hid'), 'the joiner sees the defaults');

select pg_temp.act_as('00000000-0000-0000-0000-00000000aa03');
update households set deck_defaults = '{}' where id = :'hid';
select pg_temp.act_as(null);
select pg_temp.check((select deck_defaults ->> 'mood' = 'comfort' from households where id = :'hid'), 'an outsider cannot change them');

-- Carbs, fat and fibre in "fits" (migrations/20261204000001_goal_macros_fit.sql).
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
insert into recipes (household_id, title, source_type) values (:'hid', 'Dal', 'typed') returning id as rid \gset
select pg_temp.act_as(null);
-- As deal-deck stores it: per-serving nutrition in the classification.
update recipes set kcal_per_serving = 700, protein_g_per_serving = 40,
  classification = '{"nutrition": {"carbs_g": 90, "fat_g": 25, "fiber_g": 6}}' where id = :'rid';
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
update member_goals set dinner_kcal = 700, dinner_protein_g = 40, dinner_carbs_g = null, dinner_fat_g = null, dinner_fibre_g = null
where user_id = auth.uid();
select pg_temp.check((select fits from my_portion(:'rid')), 'fits with no carbs, fat or fibre target');
update member_goals set dinner_carbs_g = 80 where user_id = auth.uid();
select pg_temp.check((select fits from my_portion(:'rid')), '90 g carbs is within 20% over 80');
update member_goals set dinner_carbs_g = 70 where user_id = auth.uid();
select pg_temp.check((select not fits from my_portion(:'rid')), '90 g carbs is too far over 70');
update member_goals set dinner_carbs_g = null, dinner_fat_g = 20 where user_id = auth.uid();
select pg_temp.check((select not fits from my_portion(:'rid')), '25 g fat is too far over 20');
update member_goals set dinner_fat_g = null, dinner_fibre_g = 10 where user_id = auth.uid();
select pg_temp.check((select not fits from my_portion(:'rid')), '6 g fibre is short of 10');
update member_goals set dinner_fibre_g = 7 where user_id = auth.uid();
select pg_temp.check((select fits from my_portion(:'rid')), '6 g fibre is within 15% of 7');
select pg_temp.act_as(null);
update recipes set classification = null where id = :'rid';
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
update member_goals set dinner_fibre_g = 30 where user_id = auth.uid();
select pg_temp.check((select fits from my_portion(:'rid')), 'an unclassified recipe is not held to fibre');
