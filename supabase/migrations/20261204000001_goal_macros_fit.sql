-- Carbs, fat and fibre goals (onboarding step 08) count in "fits": carbs and
-- fat are ceilings (the plate may go 20% over), fibre a floor like protein
-- (15% short at most). A switched-off goal (null) doesn't count, and neither
-- does a value the recipe doesn't know: per-serving carbs, fat and fibre come
-- from its stored classification (logic/classify.ts nutrition), which is null
-- until deal-deck has classified it.
-- Mirrors supabase/functions/_shared/logic/portions.ts.

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
  v_carbs real;
  v_fat real;
  v_fibre real;
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
  v_carbs := (v_recipe.classification -> 'nutrition' ->> 'carbs_g')::real * servings;
  v_fat := (v_recipe.classification -> 'nutrition' ->> 'fat_g')::real * servings;
  v_fibre := (v_recipe.classification -> 'nutrition' ->> 'fiber_g')::real * servings;

  fits := (v_goal.dinner_kcal is null or v_goal.dinner_kcal = 0
           or abs(kcal - v_goal.dinner_kcal) / v_goal.dinner_kcal <= 0.2)
      and (v_goal.dinner_protein_g is null or v_goal.dinner_protein_g = 0
           or protein_g >= 0.85 * v_goal.dinner_protein_g)
      and (v_goal.dinner_carbs_g is null or v_goal.dinner_carbs_g = 0 or v_carbs is null
           or v_carbs <= 1.2 * v_goal.dinner_carbs_g)
      and (v_goal.dinner_fat_g is null or v_goal.dinner_fat_g = 0 or v_fat is null
           or v_fat <= 1.2 * v_goal.dinner_fat_g)
      and (v_goal.dinner_fibre_g is null or v_goal.dinner_fibre_g = 0 or v_fibre is null
           or v_fibre >= 0.85 * v_goal.dinner_fibre_g);
  return next;
end;
$$;
