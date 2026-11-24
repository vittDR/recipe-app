-- Other households' answers per library dish (logic/population.ts): relative to each person's mean,
-- people with few answers and the people being dealt for left out; only the service role reads it.
\set ON_ERROR_STOP on

create or replace function pg_temp.check(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000b0b01', 'pop1@example.com', '{"first_name":"Pop"}'),
  ('00000000-0000-0000-0000-0000000b0b02', 'pop2@example.com', '{"first_name":"Ula"}'),
  ('00000000-0000-0000-0000-0000000b0b03', 'pop3@example.com', '{"first_name":"Few"}');

create temp table dishes as select id, row_number() over (order by title) as n from recipes where household_id is null order by title limit 6;
grant select on dishes to public;

-- Pop: a favourite (4) on the first dish, not for me (0) on the next five: mean 4/6.
insert into taste_signals (user_id, recipe_id, kind, value)
  select '00000000-0000-0000-0000-0000000b0b01', id, 'starter', case when n = 1 then 'must' else 'pass' end from dishes;
-- Ula: regularly (3) on all six, mean 3: differences of 0.
insert into taste_signals (user_id, recipe_id, kind, value)
  select '00000000-0000-0000-0000-0000000b0b02', id, 'starter', 'yes' from dishes;
-- Few: two answers, too few to read against their own mean.
insert into taste_signals (user_id, recipe_id, kind, value)
  select '00000000-0000-0000-0000-0000000b0b03', id, 'starter', 'must' from dishes where n <= 2;

select id as first from dishes where n = 1 \gset
select id as second from dishes where n = 2 \gset

-- Earlier tests left swipes behind: everyone else is left out, as the people being dealt for would be.
select coalesce(array_agg(id), '{}') as others from profiles where id::text not like '00000000-0000-0000-0000-0000000b0b0%' \gset
select public.population_answers(:'others') as pop \gset
select pg_temp.check(((:'pop'::jsonb) -> :'first' ->> 0)::numeric = round(4 - 4.0 / 6, 3), 'a favourite reads against the person''s mean');
select pg_temp.check(((:'pop'::jsonb) -> :'first' ->> 1)::numeric = 2, 'two people with enough answers, quiz weight 1 each');
select pg_temp.check(((:'pop'::jsonb) -> :'second' ->> 0)::numeric < 0, 'a pass reads below the mean');

select public.population_answers(:'others'::uuid[] || '00000000-0000-0000-0000-0000000b0b01'::uuid) as pop \gset
select pg_temp.check(((:'pop'::jsonb) -> :'first' ->> 0)::numeric = 0 and ((:'pop'::jsonb) -> :'first' ->> 1)::numeric = 1,
  'the people being dealt for are left out');

select pg_temp.check(not has_function_privilege('authenticated', 'public.population_answers(uuid[])', 'execute'),
  'not callable from the app');

delete from taste_signals where user_id in ('00000000-0000-0000-0000-0000000b0b01', '00000000-0000-0000-0000-0000000b0b02', '00000000-0000-0000-0000-0000000b0b03');
delete from auth.users where id in ('00000000-0000-0000-0000-0000000b0b01', '00000000-0000-0000-0000-0000000b0b02', '00000000-0000-0000-0000-0000000b0b03');
