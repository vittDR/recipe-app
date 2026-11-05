-- Taste profile: the choices people make, recorded so recommendations can
-- learn from more than deck swipes. Deck swipes (swipes) and cooked meals
-- (meals) were already recorded; this adds what they couldn't say:
--   starter  the taste quiz: 20 varied recipes swiped once, before any deck
--            (value yes / must / pass)
--   reason   why a deck card was passed on: not_tonight, too_long and
--            had_recently are about tonight and don't count against the dish;
--            not_for_me does
--   rating   how a meal was after eating it: loved / fine / not_again, or
--            not_eaten (stops asking, says nothing)
-- logic/profile.ts turns these, with swipes and cooked meals, into the
-- profile the deck is ranked with. Each person's signals are private, like
-- their goals.

create table if not exists public.taste_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade on update cascade,
  kind text not null check (kind in ('starter', 'reason', 'rating')),
  value text not null,
  deck_id uuid references public.decks (id) on delete cascade,
  meal_id uuid references public.meals (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One signal of a kind per recipe (starter), per deck card (reason) or per meal (rating): saving again replaces it.
  key text generated always as (
    kind || ':' || recipe_id::text || ':' || coalesce(deck_id::text, '') || ':' || coalesce(meal_id::text, '')
  ) stored,
  unique (user_id, key),
  check (
    (kind = 'starter' and value in ('yes', 'must', 'pass') and deck_id is null and meal_id is null)
    or (kind = 'reason' and value in ('not_tonight', 'too_long', 'had_recently', 'not_for_me') and deck_id is not null)
    or (kind = 'rating' and value in ('loved', 'fine', 'not_again', 'not_eaten') and meal_id is not null)
  )
);
create index if not exists taste_signals_user_created on public.taste_signals (user_id, created_at desc);

alter table public.taste_signals enable row level security;
grant select, insert, update, delete on public.taste_signals to authenticated;

-- Own rows only, about recipes, decks and meals the person can see (their household's or the seed library).
drop policy if exists taste_signals_own on public.taste_signals;
create policy taste_signals_own on public.taste_signals for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id)
    and (deck_id is null or exists (select 1 from public.decks d where d.id = deck_id))
    and (meal_id is null or exists (select 1 from public.meals m where m.id = meal_id))
  );
