-- Preparation and cooking time, next to the total. prep_min is hands-on work
-- (chopping, mixing, shaping); cook_min is time on the hob, in the oven or on
-- the grill. total_min stays start to plate and also counts marinating,
-- soaking, rising and resting, so it can be more than the two added up.
-- cook_min is 0 for no-cook dishes. Null when unknown.

alter table public.recipes add column if not exists prep_min int check (prep_min >= 0);
alter table public.recipes add column if not exists cook_min int check (cook_min >= 0);

-- The view's columns were fixed when it was created; recreate it so it has the new ones.
create or replace view public.library_recipes
with (security_invoker = true)
as
  select r.* from public.recipes r
  where r.household_id = public.my_household_id()
     or (r.household_id is null and not exists (
           select 1 from public.recipes c
           where c.copied_from = r.id and c.household_id = public.my_household_id()));

-- Same as before, now carrying prep and cook time onto the household's copy.
create or replace function public.copy_recipe(p_recipe uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
  v_new uuid;
  v_src public.recipes;
begin
  select * into v_src from public.recipes where id = p_recipe;
  if not found or (v_src.household_id is not null and not public.is_member(v_src.household_id)) then
    raise exception 'not_found';
  end if;
  if v_src.household_id = v_household then
    return v_src.id;
  end if;
  select id into v_new from public.recipes where household_id = v_household and copied_from = p_recipe;
  if v_new is not null then
    return v_new;
  end if;

  insert into public.recipes (household_id, copied_from, title, source_type, source_url, image_path,
    servings, total_min, prep_min, cook_min, steps, tags, kcal_per_serving, protein_g_per_serving, macros_estimated,
    language, created_by, source_name, original_servings, cuisine, image_source_url, difficulty, equipment)
  select v_household, v_src.id, v_src.title, v_src.source_type, v_src.source_url, v_src.image_path,
    v_src.servings, v_src.total_min, v_src.prep_min, v_src.cook_min, v_src.steps, v_src.tags, v_src.kcal_per_serving,
    v_src.protein_g_per_serving, v_src.macros_estimated, v_src.language, auth.uid(),
    v_src.source_name, v_src.original_servings, v_src.cuisine, v_src.image_source_url,
    v_src.difficulty, v_src.equipment
  returning id into v_new;

  insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle, is_staple, guessed,
    raw_text, original_text)
  select v_new, position, name, quantity, unit, aisle, is_staple, guessed, raw_text, original_text
  from public.recipe_ingredients where recipe_id = v_src.id;

  return v_new;
end;
$$;
