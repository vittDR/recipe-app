-- The 14 hand-written starter recipes from the first seed.sql were
-- placeholders; the seed library (seed_library.sql) replaces them. They are
-- the only seed recipes without a source link. Households' own copies stay
-- (copied_from is cleared); their decks, swipes and meals go with them.
delete from public.recipes where household_id is null and source_url is null and source_type = 'seed';
