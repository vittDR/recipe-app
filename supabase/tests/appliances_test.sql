-- Kitchen appliances (migrations/20261208000001_household_equipment.sql).
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
  ('00000000-0000-0000-0000-00000000cc01', 'cook@example.com', '{"first_name":"Cook"}');

select pg_temp.act_as('00000000-0000-0000-0000-00000000cc01');
select pg_temp.check((select count(*) = 12 from appliances), 'the twelve appliances are readable');
select create_household('Kitchen', 'Europe/Paris') as hid \gset
select pg_temp.check((select equipment is null from households where id = :'hid'), 'never asked: no answer');

update households set equipment = array['oven', 'air fryer', 'oven', 'barbecue'] where id = :'hid';
select pg_temp.check((select equipment = array['air fryer', 'barbecue', 'oven'] from households where id = :'hid'),
  'a member saves what the household has, each once');

do $$ begin
  update households set equipment = array['oven', 'jacuzzi'];
  raise exception 'FAILED: an unknown appliance was saved';
exception when raise_exception then
  if sqlerrm <> 'unknown_appliance' then raise; end if;
  raise notice 'ok - an unknown appliance is refused';
end $$;

update households set equipment = '{}' where id = :'hid';
select pg_temp.check((select equipment = '{}' from households where id = :'hid'), 'none of them is an answer too');
select pg_temp.act_as(null);

-- Leave nothing behind: later tests count households.
delete from households where id = :'hid';
delete from auth.users where id = '00000000-0000-0000-0000-00000000cc01';
