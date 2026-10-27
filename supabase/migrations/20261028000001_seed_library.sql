-- Fields for the seed recipe library (supabase/seed/recipes.json): Italian
-- catalogue names, source credit, original yield and cuisine on recipes, and
-- the source's unscaled line on each ingredient. The catalogue rows themselves
-- are in seed.sql.

alter table public.ingredient_catalog add column if not exists name_it text;

alter table public.recipes add column if not exists source_name text;
alter table public.recipes add column if not exists original_servings real check (original_servings > 0);
alter table public.recipes add column if not exists cuisine text;
alter table public.recipes add column if not exists image_source_url text;
alter table public.recipes add constraint recipes_language_check check (language in ('en', 'fr', 'it'));

alter table public.recipe_ingredients add column if not exists original_text text;

-- Same as before, now carrying the new fields onto the household's copy.
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
    servings, total_min, steps, tags, kcal_per_serving, protein_g_per_serving, macros_estimated,
    language, created_by, source_name, original_servings, cuisine, image_source_url)
  select v_household, v_src.id, v_src.title, v_src.source_type, v_src.source_url, v_src.image_path,
    v_src.servings, v_src.total_min, v_src.steps, v_src.tags, v_src.kcal_per_serving,
    v_src.protein_g_per_serving, v_src.macros_estimated, v_src.language, auth.uid(),
    v_src.source_name, v_src.original_servings, v_src.cuisine, v_src.image_source_url
  returning id into v_new;

  insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle, is_staple, guessed,
    raw_text, original_text)
  select v_new, position, name, quantity, unit, aisle, is_staple, guessed, raw_text, original_text
  from public.recipe_ingredients where recipe_id = v_src.id;

  return v_new;
end;
$$;
