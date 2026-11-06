-- The recipe classification (logic/classify.ts) is now kept on the recipe
-- instead of worked out every time it's used. It is cleared whenever the
-- recipe or its ingredients change, and stamped with the ingredient
-- catalogue it was worked out with, so a catalogue change or a new
-- CLASSIFICATION_VERSION also makes it stale. deal-deck fills in what is
-- missing or stale (through store_classifications); screens use the stored
-- one when it's fresh and work it out themselves otherwise.

alter table public.recipes add column if not exists classification jsonb;
-- catalog_version()->>'ingredients' at the time.
alter table public.recipes add column if not exists classified_with text;

create or replace function public.clear_recipe_classification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'recipes' then
    new.classification := null;
    new.classified_with := null;
    return new;
  end if;
  update public.recipes set classification = null, classified_with = null
  where id = coalesce(new.recipe_id, old.recipe_id) and classification is not null;
  return null;
end;
$$;

drop trigger if exists recipes_classification_stale on public.recipes;
create trigger recipes_classification_stale
  before update of title, translations, servings, tags, cuisine, steps, prep_min, cook_min, total_min, difficulty, equipment
  on public.recipes
  for each row execute function public.clear_recipe_classification();

drop trigger if exists recipe_ingredients_classification_stale on public.recipe_ingredients;
create trigger recipe_ingredients_classification_stale
  after insert or update or delete on public.recipe_ingredients
  for each row execute function public.clear_recipe_classification();

-- Server only (deal-deck): [{ id, classification, classified_with }, ...].
create or replace function public.store_classifications(p_rows jsonb)
returns void
language sql security definer set search_path = ''
as $$
  update public.recipes r
  set classification = x.classification, classified_with = x.classified_with
  from jsonb_to_recordset(p_rows) as x(id uuid, classification jsonb, classified_with text)
  where r.id = x.id;
$$;
revoke execute on function public.store_classifications(jsonb) from public, anon, authenticated;

-- The view's columns were fixed when it was created; recreate it so it has the new ones.
create or replace view public.library_recipes
with (security_invoker = true)
as
  select r.* from public.recipes r
  where r.household_id = public.my_household_id()
     or (r.household_id is null and not exists (
           select 1 from public.recipes c
           where c.copied_from = r.id and c.household_id = public.my_household_id()));
