-- The taste quiz gets a fourth answer: "I like it, but not often". It counts
-- as a like for taste, and makes that kind of dish occasional for the person
-- (logic/profile.ts occasionalKinds, logic/deck.ts): at most one such dish in
-- a deck, and none when one of that kind was eaten in the last two weeks.
alter table public.taste_signals drop constraint if exists taste_signals_check;
alter table public.taste_signals add constraint taste_signals_check check (
  (kind = 'starter' and value in ('yes', 'must', 'pass', 'sometimes') and deck_id is null and meal_id is null)
  or (kind = 'reason' and value in ('not_tonight', 'too_long', 'had_recently', 'not_for_me') and deck_id is not null)
  or (kind = 'rating' and value in ('loved', 'fine', 'not_again', 'not_eaten') and meal_id is not null)
);
