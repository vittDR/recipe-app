-- Advanced deck filters (protein, cuisine, base, spice: logic/deckFilters.ts),
-- kept on the deck so "deal again" after a no-match uses the same ones and the
-- learning knows a pass in a chicken deck says nothing about chicken.
alter table public.decks add column if not exists filters jsonb not null default '{}'::jsonb;
