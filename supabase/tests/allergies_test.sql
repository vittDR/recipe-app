-- Allergies: everyone in the household sees them, each person edits their own,
-- and allergens are linked to catalogue ingredients and preparations.
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
  ('00000000-0000-0000-0000-0000000000c1', 'al1@example.com', '{"first_name":"Ana"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'al2@example.com', '{"first_name":"Ben"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'al3@example.com', '{"first_name":"Cy"}');

select pg_temp.check((select count(*) = 14 from allergens), 'the EU 14 allergens');
select pg_temp.check(exists (select 1 from allergen_ingredients where allergen = 'milk' and ingredient = 'parmesan'), 'lactose covers parmesan');
select pg_temp.check(exists (select 1 from allergen_ingredients where allergen = 'nuts' and ingredient = 'pesto'), 'nuts cover pesto');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select create_household('Allergy home', 'Europe/Paris') as hid \gset
select code from create_invite() \gset
insert into member_allergies (allergen) values ('milk');
insert into member_allergies (ingredient) values ('celery');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select redeem_invite(:'code');
insert into member_allergies (allergen) values ('nuts');
select pg_temp.check((select count(*) = 3 from member_allergies), 'the household sees everyone''s allergies');
select pg_temp.check((select count(*) = 1 from member_allergies where user_id = auth.uid()), 'own allergy saved');
delete from member_allergies where allergen = 'milk';
select pg_temp.check((select count(*) = 3 from member_allergies), 'cannot remove someone else''s');
do $$ begin
  insert into member_allergies (user_id, allergen) values ('00000000-0000-0000-0000-0000000000c1', 'eggs');
  raise exception 'should have failed';
exception when insufficient_privilege then null;
          when others then if sqlerrm = 'should have failed' then raise; end if;
end $$;
do $$ begin
  insert into member_allergies (allergen, ingredient) values ('eggs', 'eggs');
  raise exception 'should have failed';
exception when check_violation then null;
end $$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c3');
select pg_temp.check((select count(*) = 0 from member_allergies), 'outsiders see none');
reset role;
-- Leave nothing behind for the other tests.
delete from households where id = :'hid';
delete from auth.users where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
