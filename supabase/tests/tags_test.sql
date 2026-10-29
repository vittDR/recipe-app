-- Tag catalogue: shared labels and aliases, households' own tags, and the
-- seed library storing catalogue names only.
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

select pg_temp.check((select name = 'stew' and kind = 'tag' from find_tag(null, 'Plat mijoté')), 'French words find their tag');
select pg_temp.check((select kind = 'ingredient' from find_tag(null, 'Poulet')), 'ingredients are not tags');
select pg_temp.check((select kind = 'noise' from find_tag(null, 'plat principal')), 'filler words are noise');
select pg_temp.check((select name is null from find_tag(null, 'game day')), 'unknown words find nothing');
select pg_temp.check(not exists (
  select 1 from tag_catalog where household_id is null and kind = 'tag' and (name_en is null or name_fr is null)),
  'every shared tag has an English and a French label');
select pg_temp.check(not exists (
  select 1 from recipes r, unnest(r.tags) t where r.household_id is null
  and not exists (select 1 from tag_catalog c where c.household_id is null and c.kind = 'tag' and c.name = t)),
  'seed recipes only store shared tag names');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@example.com');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select create_household('Tags A', 'Europe/Paris') as ha \gset
insert into tag_catalog (household_id, name, name_fr) values (:'ha', 'pique-nique du dimanche', 'Pique-nique du dimanche');
select pg_temp.check((select name = 'pique-nique du dimanche' from find_tag(:'ha', 'Pique-nique du Dimanche')), 'a household finds its own tag');
update tag_catalog set name_en = 'Sunday picnic' where household_id = :'ha' and name = 'pique-nique du dimanche';
select pg_temp.check((select name_en = 'Sunday picnic' from tag_catalog where household_id = :'ha'), 'members can translate their tags');
do $$ begin
  insert into tag_catalog (name, name_en) values ('sneaky', 'Sneaky');
  raise exception 'FAILED: a member added a shared tag';
exception when insufficient_privilege then raise notice 'ok - members cannot add shared tags';
end $$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select create_household('Tags B', 'Europe/Paris') as hb \gset
select pg_temp.check(not exists (select 1 from tag_catalog where household_id = :'ha'), 'other households'' tags are private');
select pg_temp.check((select name is null from find_tag(:'hb', 'pique-nique du dimanche')), 'another household does not match them');
select pg_temp.check((select count(*) > 80 from tag_catalog), 'everyone reads the shared catalogue');
select pg_temp.act_as(null);
