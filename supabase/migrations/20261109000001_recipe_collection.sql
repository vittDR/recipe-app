-- Which part of the library a recipe belongs to, worked out from where it
-- came from:
--   original    seed recipes written for the app (ai_generated_recipe)
--   web_import  seed recipes taken from recipe sites (to hide if the app goes commercial)
--   our_import  recipes a household imported (a link, Instagram, a photo)
--   our_recipe  recipes a household typed in
-- A household's copy of a seed recipe stays in the seed recipe's collection.

alter table public.recipes add column if not exists collection text generated always as (
  case
    when source_type = 'seed' and ai_generated_recipe then 'original'
    when source_type = 'seed' then 'web_import'
    when source_type = 'typed' then 'our_recipe'
    else 'our_import'
  end
) stored;

-- The view's columns were fixed when it was created; recreate it so it has the new one.
create or replace view public.library_recipes
with (security_invoker = true)
as
  select r.* from public.recipes r
  where r.household_id = public.my_household_id()
     or (r.household_id is null and not exists (
           select 1 from public.recipes c
           where c.copied_from = r.id and c.household_id = public.my_household_id()));
