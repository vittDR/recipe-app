-- Style edits (docs/taste-profiles.md §3): on the taste summary, people say
-- how often they want a kind of plate ("rich & creamy: now and then"). Each
-- is a taste_signals row of kind 'style' with no recipe, value
-- '<region>:<level>' (regions in logic/style.ts STYLE_REGIONS), read as a
-- strong answer at the region's plate. One per region: saving again
-- replaces it.

alter table public.taste_signals alter column recipe_id drop not null;

alter table public.taste_signals drop constraint if exists taste_signals_user_id_key_key;
alter table public.taste_signals drop column if exists key;
alter table public.taste_signals add column key text generated always as (
  kind || ':' || coalesce(recipe_id::text, '') || ':' || coalesce(deck_id::text, '') || ':' || coalesce(meal_id::text, '')
    || ':' || coalesce(other_recipe_id::text, '')
    || case when kind = 'style' then ':' || split_part(value, ':', 1) else '' end
) stored;
alter table public.taste_signals add constraint taste_signals_user_id_key_key unique (user_id, key);

alter table public.taste_signals drop constraint if exists taste_signals_kind_check;
alter table public.taste_signals add constraint taste_signals_kind_check
  check (kind in ('starter', 'reason', 'rating', 'pair', 'style'));

alter table public.taste_signals drop constraint if exists taste_signals_check;
alter table public.taste_signals add constraint taste_signals_check check (
  (kind = 'starter' and value in ('yes', 'must', 'pass', 'sometimes') and recipe_id is not null and deck_id is null
      and meal_id is null and other_recipe_id is null)
  or (kind = 'reason' and value in ('not_tonight', 'too_long', 'had_recently', 'not_for_me') and recipe_id is not null
      and deck_id is not null and other_recipe_id is null)
  or (kind = 'rating' and value in ('loved', 'fine', 'not_again', 'not_eaten') and recipe_id is not null
      and meal_id is not null and other_recipe_id is null)
  or (kind = 'pair' and value in ('a', 'b', 'either', 'neither') and recipe_id is not null and deck_id is null
      and meal_id is null and other_recipe_id is not null and other_recipe_id <> recipe_id)
  or (kind = 'style' and value ~ '^(balanced|light|hearty|carb|rich|fried):(regularly|sometimes|rarely)$'
      and recipe_id is null and deck_id is null and meal_id is null and other_recipe_id is null)
);

-- Own rows only, about recipes, decks and meals the person can see (their household's or the seed library).
drop policy if exists taste_signals_own on public.taste_signals;
create policy taste_signals_own on public.taste_signals for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (recipe_id is null or exists (select 1 from public.recipes r where r.id = recipe_id))
    and (other_recipe_id is null or exists (select 1 from public.recipes r where r.id = other_recipe_id))
    and (deck_id is null or exists (select 1 from public.decks d where d.id = deck_id))
    and (meal_id is null or exists (select 1 from public.meals m where m.id = meal_id))
  );
