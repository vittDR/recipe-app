-- What other households think of each library dish (logic/population.ts,
-- docs/taste-profiles.md §6): deal-deck reads it as the prior of each dish's
-- own effect in the style model. Aggregated here so a deal reads one row per
-- dish, not everyone's answers.
--
-- Answers on the frequency scale, as logic/style.ts reads them:
--   quiz        pass 0, now and then 1, regularly 3, a favourite 4   weight 1
--   rating      loved 4, fine 2.5, not again 0                        weight 1
--   deck swipe  yes 3, must 4, pass "not for me" 0                    weight 0.5
--   (a plain pass is "not tonight" and says nothing)
-- Each relative to the person's own mean answer, people with fewer than 5
-- answers left out. A household's copy of a library dish counts for the
-- dish. The people being dealt for (p_exclude) are left out, so their own
-- answers don't count twice. Returns { recipe_id: [sum of weighted
-- differences, sum of weights] }; population.ts shrinks it.

create or replace function public.population_answers(p_exclude uuid[])
returns jsonb
language sql stable security definer
set search_path = public
as $$
  with answers as (
    select t.user_id, t.recipe_id,
      case t.value when 'pass' then 0 when 'sometimes' then 1 when 'yes' then 3 when 'must' then 4 end::real as y,
      1::real as w
    from public.taste_signals t where t.kind = 'starter'
    union all
    select t.user_id, t.recipe_id,
      case t.value when 'loved' then 4 when 'fine' then 2.5 when 'not_again' then 0 end::real, 1::real
    from public.taste_signals t where t.kind = 'rating'
    union all
    select s.user_id, s.recipe_id, case s.verdict::text when 'yes' then 3 when 'must' then 4 else 0 end::real, 0.5::real
    from public.swipes s
    where s.verdict::text <> 'pass'
      or exists (select 1 from public.taste_signals t
        where t.kind = 'reason' and t.value = 'not_for_me'
          and t.user_id = s.user_id and t.deck_id = s.deck_id and t.recipe_id = s.recipe_id)
  ), kept as (
    select a.user_id, coalesce(r.copied_from, r.id) as recipe_id, a.y, a.w,
      sum(a.w * a.y) over (partition by a.user_id) / sum(a.w) over (partition by a.user_id) as m,
      count(*) over (partition by a.user_id) as n
    from answers a
    join public.recipes r on r.id = a.recipe_id
    where a.y is not null and not (a.user_id = any (coalesce(p_exclude, '{}')))
  )
  select coalesce(jsonb_object_agg(x.recipe_id, jsonb_build_array(round(x.s::numeric, 3), round(x.w::numeric, 3))), '{}'::jsonb)
  from (
    select k.recipe_id, sum(k.w * (k.y - k.m)) as s, sum(k.w) as w
    from kept k join public.recipes r on r.id = k.recipe_id and r.household_id is null
    where k.n >= 5
    group by k.recipe_id
  ) x;
$$;

revoke all on function public.population_answers(uuid[]) from public, anon, authenticated;
grant execute on function public.population_answers(uuid[]) to service_role;
