-- No tie-break any more: a deck nobody agreed on ends as "no_match" and the
-- household deals a new one. The value is added on its own, before it's used.
alter type public.deck_status add value if not exists 'no_match';
