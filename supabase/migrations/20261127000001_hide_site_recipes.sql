-- Recipes taken from recipe sites (the 'web' collection of the seed library)
-- are hidden: the library and the deck show our own recipes ('original') and
-- each household's own. They stay in the database, so past decks, meals and
-- swipes still open them, and a household's copy of one stays theirs. To
-- show them again, recreate the view without the collection condition and
-- drop the same condition in deal-deck.

create or replace view public.library_recipes
with (security_invoker = true)
as
  select r.* from public.recipes r
  where r.household_id = public.my_household_id()
     or (r.household_id is null and r.collection <> 'web' and not exists (
           select 1 from public.recipes c
           where c.copied_from = r.id and c.household_id = public.my_household_id()));
