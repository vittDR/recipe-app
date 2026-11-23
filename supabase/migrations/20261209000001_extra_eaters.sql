-- People who eat at home but don't choose (children, a grandparent, a
-- flatmate who just eats): design handoff v2, §4.
--
-- * household_eaters: one row per such person. Name, age band (4-8, 9-13,
--   14+; no 0-3: babies eat baby food), portion (quarter steps; the age
--   band's default, overridable), and what they don't eat (allergen keys and
--   catalogue products, the same picker as a member's "je ne mange pas").
--   Their exclusions filter every deck they eat from, like a member's.
-- * decks.extra_eaters: who of them eats tonight (chosen per deck; there is
--   no schedule on the eater).
-- * my_portion(): the pot now counts the selected extra eaters' portions, so
--   ingredient quantities (recipe, match, groceries) scale to everyone at the
--   table. p_extra null = every extra eater (the recipe screen, no deck).

create table if not exists public.household_eaters (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household_id() references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  age_band text not null check (age_band in ('4-8', '9-13', '14+')),
  portion real not null check (portion between 0.25 and 4 and (portion * 4) = round(portion * 4)),
  allergens text[] not null default '{}',
  never_products uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists household_eaters_household on public.household_eaters (household_id, created_at);

alter table public.household_eaters enable row level security;
grant select, insert, update, delete on public.household_eaters to authenticated;
drop policy if exists household_eaters_all on public.household_eaters;
create policy household_eaters_all on public.household_eaters for all to authenticated
  using (household_id = (select public.my_household_id()))
  with check (household_id = (select public.my_household_id()));

alter table public.decks add column if not exists extra_eaters uuid[] not null default '{}';

-- One more parameter: the old two-argument version goes, or calls would be ambiguous.
drop function if exists public.my_portion(uuid, uuid[]);

create or replace function public.my_portion(p_recipe uuid, p_eaters uuid[] default null, p_extra uuid[] default null)
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

  -- Members eat their servings; the household's extra eaters at the table, their portion.
  select coalesce(sum(coalesce(g.servings, 1)), 0) into pot_servings
  from unnest(v_eaters) as e(uid)
  left join public.member_goals g on g.user_id = e.uid;
  pot_servings := pot_servings + coalesce((
    select sum(x.portion) from public.household_eaters x
    where x.household_id = v_household and (p_extra is null or x.id = any (p_extra))), 0);

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
