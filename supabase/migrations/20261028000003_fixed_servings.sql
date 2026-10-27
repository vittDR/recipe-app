-- Plates are a fixed number of servings per person (1 by default) instead of
-- being sized to each calorie target. A recipe fits when the plate's calories
-- are within 20% of target and its protein is at least 85% of target.
-- Mirrors supabase/functions/_shared/logic/portions.ts.

alter table public.member_goals
  add column if not exists servings real not null default 1 check (servings between 0.25 and 4);

create or replace function public.my_portion(p_recipe uuid, p_eaters uuid[] default null)
returns table (kcal real, protein_g real, servings real, pot_servings real, fits boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid := public.my_household_id();
  v_recipe public.recipes;
  v_eaters uuid[];
  v_goal public.member_goals;
begin
  select * into v_recipe from public.recipes where id = p_recipe;
  if not found or (v_recipe.household_id is not null and v_recipe.household_id is distinct from v_household) then
    return;
  end if;
  if v_recipe.kcal_per_serving is null or v_recipe.kcal_per_serving <= 0 then
    return;
  end if;

  v_eaters := coalesce(p_eaters,
    (select array_agg(user_id) from public.household_members where household_id = v_household));
  -- Only household members count; always include the caller.
  select array_agg(distinct m.user_id) into v_eaters
  from public.household_members m
  where m.household_id = v_household and (m.user_id = any (v_eaters) or m.user_id = v_uid);

  select coalesce(sum(coalesce(g.servings, 1)), 0) into pot_servings
  from unnest(v_eaters) as e(uid)
  left join public.member_goals g on g.user_id = e.uid;

  select * into v_goal from public.member_goals where user_id = v_uid;
  servings := coalesce(v_goal.servings, 1);
  kcal := v_recipe.kcal_per_serving * servings;
  protein_g := coalesce(v_recipe.protein_g_per_serving, 0) * servings;
  fits := (v_goal.dinner_kcal is null or v_goal.dinner_kcal = 0
           or abs(kcal - v_goal.dinner_kcal) / v_goal.dinner_kcal <= 0.2)
      and (v_goal.dinner_protein_g is null or v_goal.dinner_protein_g = 0
           or protein_g >= 0.85 * v_goal.dinner_protein_g);
  return next;
end;
$$;
