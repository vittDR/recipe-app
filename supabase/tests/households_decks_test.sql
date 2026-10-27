-- End-to-end checks of household lifecycle, privacy and the Tonight rules.
-- Runs as the API roles with a fake JWT subject, like PostgREST does.
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

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', '{"first_name":"Vittorio","locale":"fr-FR"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', '{"full_name":"Camille Martin"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.com', '{}');

select pg_temp.check((select first_name = 'Vittorio' and locale = 'fr' from profiles
                      where id = '00000000-0000-0000-0000-00000000000a'), 'profile created from metadata');
select pg_temp.check((select first_name = 'Camille' from profiles
                      where id = '00000000-0000-0000-0000-00000000000b'), 'first name taken from full name');

-- A creates a household and an invite.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select create_household('Chez nous', 'Europe/Paris') as hid \gset
select pg_temp.check((select count(*) = 7 from plan_days), 'plan days created');
select code from create_invite() \gset
select pg_temp.check(:'code' ~ '^[A-HJ-NP-Z2-9]{6}$', 'invite code uses the unambiguous alphabet');
insert into member_goals (user_id, goal, dinner_kcal, dinner_protein_g)
values (auth.uid(), 'build', 800, 50);

-- B previews and joins.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select household_name = 'Chez nous' and inviter_name = 'Vittorio'
                      from preview_invite(lower(:'code'))), 'preview shows household and inviter');
select pg_temp.check(redeem_invite(:'code') = :'hid'::uuid, 'B joins with the code');
insert into member_goals (user_id, goal, dinner_kcal, dinner_protein_g)
values (auth.uid(), 'lean', 500, 30);

-- Privacy: B cannot see A's goals, but sees A's name.
select pg_temp.check((select count(*) = 1 from member_goals), 'B sees only own goals');
select pg_temp.check((select count(*) = 2 from profiles), 'B sees both profiles');

-- C: outsider sees nothing, cannot reuse the code.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) = 0 from households), 'outsider sees no household');
select pg_temp.check((select count(*) = 0 from preview_invite(:'code')), 'used invite no longer previews');
select set_config('my.code', :'code', false);
do $$ begin
  perform redeem_invite(current_setting('my.code'));
  raise exception 'should have failed';
exception when others then
  if sqlerrm <> 'invalid_invite' then raise; end if;
end $$;
select pg_temp.check((select count(*) = 1 from profiles), 'outsider sees only self');
select pg_temp.check((select count(*) >= 14 from library_recipes), 'outsider sees the seed library');

-- Members edit settings but cannot take ownership.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update households set store_name = 'Carrefour' where id = :'hid';
do $$ begin
  update households set owner_id = auth.uid();
  raise exception 'should have failed';
exception when insufficient_privilege then null;
end $$;
select pg_temp.check((select store_name = 'Carrefour' and owner_id = '00000000-0000-0000-0000-00000000000a'
                      from households), 'members edit settings, not ownership');

-- Grocery merge (as A).
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select add_grocery_items('[{"name":"Spinach","quantity":100,"unit":"g"},{"name":"spinach","quantity":50,"unit":"g"},{"name":"eggs","quantity":6}]');
select pg_temp.check((select quantity = 150 and aisle = 'produce' from grocery_items where name = 'spinach'),
                     'same name and unit merge, aisle from catalogue');
select pg_temp.check((select count(*) = 2 from grocery_items), 'two distinct items');

-- Portions: A (800 kcal) and B (500 kcal) share one seed recipe's pot.
select id as rid, kcal_per_serving as rkcal from recipes where title = 'Spaghetti alle vongole' \gset
select pg_temp.check((select abs(kcal - 800) < 0.01 and abs(pot_servings - 1300.0 / :rkcal) < 0.01
                      from my_portion(:'rid')), 'plate sized by own target, pot by both');

-- Deal a deck the way the deal-deck function does (service role).
reset role;
insert into decks (id, household_id, for_date, started_by, who_eating)
values ('10000000-0000-0000-0000-000000000001', :'hid', current_date,
        '00000000-0000-0000-0000-00000000000a',
        array['00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b']::uuid[]);
insert into deck_cards (deck_id, recipe_id, position, score, fit_score)
select '10000000-0000-0000-0000-000000000001', id, row_number() over (order by title), 1, 0.5
from (select id, title from recipes where household_id is null order by title limit 3) s;
select recipe_id as r1 from deck_cards where position = 1 \gset
select recipe_id as r2 from deck_cards where position = 2 \gset
select recipe_id as r3 from deck_cards where position = 3 \gset

-- Outsider cannot swipe.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$ begin
  insert into swipes (deck_id, recipe_id, user_id, verdict)
  values ('10000000-0000-0000-0000-000000000001', (select recipe_id from deck_cards limit 1), auth.uid(), 'yes');
  raise exception 'should have failed';
exception when insufficient_privilege then null;
          when others then if sqlerrm = 'should have failed' then raise; end if;
end $$;

-- A swipes: pass, yes, must.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into swipes (deck_id, recipe_id, user_id, verdict) values
  ('10000000-0000-0000-0000-000000000001', :'r1', auth.uid(), 'pass'),
  ('10000000-0000-0000-0000-000000000001', :'r2', auth.uid(), 'yes'),
  ('10000000-0000-0000-0000-000000000001', :'r3', auth.uid(), 'must');
select pg_temp.check((select finished_at is not null and swiped_count = 3 from deck_members
                      where user_id = auth.uid()), 'A finished');

-- B mid-swipe cannot see A's verdicts; after finishing, can.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into swipes (deck_id, recipe_id, user_id, verdict) values
  ('10000000-0000-0000-0000-000000000001', :'r1', auth.uid(), 'yes');
select pg_temp.check((select count(*) = 1 from swipes), 'B mid-deck sees only own swipes');
select pg_temp.check((select status = 'open' from decks), 'deck still open');
insert into swipes (deck_id, recipe_id, user_id, verdict) values
  ('10000000-0000-0000-0000-000000000001', :'r2', auth.uid(), 'pass'),
  ('10000000-0000-0000-0000-000000000001', :'r3', auth.uid(), 'pass');
select pg_temp.check((select count(*) = 6 from swipes), 'B sees all swipes after finishing');
select pg_temp.check((select status = 'tiebreak' from decks), 'no mutual yes -> tie-break');

-- Tie-break options: r3 (must = 2 votes), r1 and r2 (1 vote each).
select pg_temp.check((select array_agg(recipe_id order by votes desc, score desc)::text
                      from tiebreak_options('10000000-0000-0000-0000-000000000001'))
                      like '{' || :'r3' || ',%', 'must-have ranks first in tie-break');

-- Different picks: highest fit wins.
reset role;
update deck_cards set fit_score = 0.9 where recipe_id = :'r1';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into tiebreak_picks (deck_id, user_id, recipe_id) values ('10000000-0000-0000-0000-000000000001', auth.uid(), :'r1');
select pg_temp.check((select status = 'tiebreak' from decks), 'waits for both picks');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into tiebreak_picks (deck_id, user_id, recipe_id) values ('10000000-0000-0000-0000-000000000001', auth.uid(), :'r3');
select pg_temp.check((select status = 'matched' and matched_recipe_id = :'r1' from decks),
                     'different picks -> best fit wins');
select pg_temp.check((select recipe_id = :'r1' from meals where for_date = current_date), 'meal recorded');

-- Clients cannot read the push outbox (RLS with no policies); the server can.
select pg_temp.check((select count(*) = 0 from push_outbox), 'clients cannot read the outbox');
reset role;
select pg_temp.check((select count(*) filter (where kind = 'partner_joined') = 1
                         and count(*) filter (where kind = 'match') = 2
                         and count(*) filter (where kind = 'tiebreak') = 2
                      from push_outbox), 'outbox has join, tie-break and match pushes');

-- Second deck: mutual yes on two cards -> first in deck order wins; other offered.
insert into decks (id, household_id, for_date, started_by, who_eating)
values ('10000000-0000-0000-0000-000000000002', :'hid', current_date + 1,
        '00000000-0000-0000-0000-00000000000b',
        array['00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b']::uuid[]);
insert into deck_cards (deck_id, recipe_id, position) values
  ('10000000-0000-0000-0000-000000000002', :'r1', 1),
  ('10000000-0000-0000-0000-000000000002', :'r2', 2);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into swipes (deck_id, recipe_id, user_id, verdict) values
  ('10000000-0000-0000-0000-000000000002', :'r1', auth.uid(), 'yes'),
  ('10000000-0000-0000-0000-000000000002', :'r2', auth.uid(), 'must');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into swipes (deck_id, recipe_id, user_id, verdict) values
  ('10000000-0000-0000-0000-000000000002', :'r1', auth.uid(), 'yes'),
  ('10000000-0000-0000-0000-000000000002', :'r2', auth.uid(), 'yes');
select pg_temp.check((select matched_recipe_id = :'r1' from decks where id = '10000000-0000-0000-0000-000000000002'),
                     'first mutual yes in deck order wins');
select pg_temp.check((select count(*) = 2 from deck_matches('10000000-0000-0000-0000-000000000002')),
                     'other match offered');
select choose_match('10000000-0000-0000-0000-000000000002', :'r2');
select pg_temp.check((select matched_recipe_id = :'r2' from decks where id = '10000000-0000-0000-0000-000000000002'),
                     'switch to other match');

-- Solo deck: first yes is dinner.
reset role;
insert into decks (id, household_id, for_date, started_by, who_eating)
values ('10000000-0000-0000-0000-000000000003', :'hid', current_date + 2,
        '00000000-0000-0000-0000-00000000000a', array['00000000-0000-0000-0000-00000000000a']::uuid[]);
insert into deck_cards (deck_id, recipe_id, position) values
  ('10000000-0000-0000-0000-000000000003', :'r1', 1), ('10000000-0000-0000-0000-000000000003', :'r2', 2);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into swipes (deck_id, recipe_id, user_id, verdict) values
  ('10000000-0000-0000-0000-000000000003', :'r1', auth.uid(), 'pass'),
  ('10000000-0000-0000-0000-000000000003', :'r2', auth.uid(), 'yes');
select pg_temp.check((select status = 'matched' and matched_recipe_id = :'r2' from decks
                      where id = '10000000-0000-0000-0000-000000000003'), 'solo deck: first yes wins');

-- Partner sees fit booleans but not numbers.
reset role;
insert into member_portions (deck_id, recipe_id, user_id, kcal, protein_g, fits) values
  ('10000000-0000-0000-0000-000000000001', :'r1', '00000000-0000-0000-0000-00000000000a', 800, 50, true);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 0 from member_portions), 'partner cannot read numbers');
select pg_temp.check((select fits from member_fits('10000000-0000-0000-0000-000000000001')
                      where user_id = '00000000-0000-0000-0000-00000000000a'), 'partner sees fit boolean');

-- Owner leaves: B becomes owner. Removing members is owner-only.
do $$ begin
  perform remove_member('00000000-0000-0000-0000-00000000000a');
  raise exception 'should have failed';
exception when others then if sqlerrm <> 'owner_only' then raise; end if;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select leave_household();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select owner_id = '00000000-0000-0000-0000-00000000000b' from households),
                     'ownership passes on when the owner leaves');

-- Scheduler: prompt queued once per local day on cook days.
reset role;
update households set prompt_time = ((now() at time zone timezone) - interval '1 minute')::time,
                      reminder_time = ((now() at time zone timezone) + interval '3 hours')::time;
delete from decks where for_date = (now() at time zone 'Europe/Paris')::date;
select enqueue_due_prompts() as n1 \gset
select enqueue_due_prompts() as n2 \gset
select pg_temp.check(:n1 = 1 and :n2 = 0, 'prompt queued exactly once');
