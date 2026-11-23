-- Taste quiz pairs (docs/taste-profiles.md §4): "On a normal weeknight,
-- which one?" between two dishes with the same protein. A pair is a
-- taste_signals row of kind 'pair' on recipe_id (the first dish) and
-- other_recipe_id (the second), with value a (the first), b (the second),
-- either or neither. logic/style.ts reads it as the difference between the
-- two dishes' plates. One answer per pair: answering again replaces it.

alter table public.taste_signals
  add column if not exists other_recipe_id uuid references public.recipes (id) on delete cascade on update cascade;

-- The key names the other recipe too, so a dish can be in several pairs.
alter table public.taste_signals drop constraint if exists taste_signals_user_id_key_key;
alter table public.taste_signals drop column if exists key;
alter table public.taste_signals add column key text generated always as (
  kind || ':' || recipe_id::text || ':' || coalesce(deck_id::text, '') || ':' || coalesce(meal_id::text, '')
    || ':' || coalesce(other_recipe_id::text, '')
) stored;
alter table public.taste_signals add constraint taste_signals_user_id_key_key unique (user_id, key);

alter table public.taste_signals drop constraint if exists taste_signals_kind_check;
alter table public.taste_signals add constraint taste_signals_kind_check
  check (kind in ('starter', 'reason', 'rating', 'pair'));

alter table public.taste_signals drop constraint if exists taste_signals_check;
alter table public.taste_signals add constraint taste_signals_check check (
  (kind = 'starter' and value in ('yes', 'must', 'pass', 'sometimes') and deck_id is null and meal_id is null and other_recipe_id is null)
  or (kind = 'reason' and value in ('not_tonight', 'too_long', 'had_recently', 'not_for_me') and deck_id is not null and other_recipe_id is null)
  or (kind = 'rating' and value in ('loved', 'fine', 'not_again', 'not_eaten') and meal_id is not null and other_recipe_id is null)
  or (kind = 'pair' and value in ('a', 'b', 'either', 'neither') and deck_id is null and meal_id is null
      and other_recipe_id is not null and other_recipe_id <> recipe_id)
);

-- Own rows only, about recipes, decks and meals the person can see (their household's or the seed library).
drop policy if exists taste_signals_own on public.taste_signals;
create policy taste_signals_own on public.taste_signals for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id)
    and (other_recipe_id is null or exists (select 1 from public.recipes r where r.id = other_recipe_id))
    and (deck_id is null or exists (select 1 from public.decks d where d.id = deck_id))
    and (meal_id is null or exists (select 1 from public.meals m where m.id = meal_id))
  );
