-- Seed recipes and their ingredient lines get fixed ids, written in
-- seed/recipes.json, so every database has the same ones. seed_library.sql
-- gives recipes loaded before then their fixed id, and whatever points at a
-- recipe (copies, decks, swipes, meals, lists) follows the new id.

alter table public.recipes drop constraint recipes_copied_from_fkey,
  add constraint recipes_copied_from_fkey foreign key (copied_from)
    references public.recipes (id) on delete set null on update cascade;
alter table public.recipe_ingredients drop constraint recipe_ingredients_recipe_id_fkey,
  add constraint recipe_ingredients_recipe_id_fkey foreign key (recipe_id)
    references public.recipes (id) on delete cascade on update cascade;
alter table public.decks drop constraint decks_matched_recipe_id_fkey,
  add constraint decks_matched_recipe_id_fkey foreign key (matched_recipe_id)
    references public.recipes (id) on delete set null on update cascade;
alter table public.deck_cards drop constraint deck_cards_recipe_id_fkey,
  add constraint deck_cards_recipe_id_fkey foreign key (recipe_id)
    references public.recipes (id) on delete cascade on update cascade;
alter table public.member_portions drop constraint member_portions_recipe_id_fkey,
  add constraint member_portions_recipe_id_fkey foreign key (recipe_id)
    references public.recipes (id) on delete cascade on update cascade;
alter table public.swipes drop constraint swipes_recipe_id_fkey,
  add constraint swipes_recipe_id_fkey foreign key (recipe_id)
    references public.recipes (id) on delete cascade on update cascade;
alter table public.tiebreak_picks drop constraint tiebreak_picks_recipe_id_fkey,
  add constraint tiebreak_picks_recipe_id_fkey foreign key (recipe_id)
    references public.recipes (id) on delete cascade on update cascade;
alter table public.meals drop constraint meals_recipe_id_fkey,
  add constraint meals_recipe_id_fkey foreign key (recipe_id)
    references public.recipes (id) on delete cascade on update cascade;
alter table public.plan_days drop constraint plan_days_recipe_id_fkey,
  add constraint plan_days_recipe_id_fkey foreign key (recipe_id)
    references public.recipes (id) on delete set null on update cascade;
alter table public.grocery_items drop constraint grocery_items_recipe_id_fkey,
  add constraint grocery_items_recipe_id_fkey foreign key (recipe_id)
    references public.recipes (id) on delete set null on update cascade;
