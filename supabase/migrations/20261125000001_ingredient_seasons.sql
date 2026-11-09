-- Seasonality: the months an ingredient is in season in France (1 = January).
-- Null means all year: pantry and frozen goods, stored crops sold all year
-- (onion, potato, carrot), and imports nobody thinks of as seasonal (lemon,
-- avocado). Set in seed.sql. A recipe's season isn't stored or tagged by
-- hand: logic/classify.ts works it out from its main ingredients
-- (classification.season_months), and the classification cache already
-- clears when the catalogue changes, so editing a month reseasons every
-- recipe with no backfill.

alter table public.ingredient_catalog add column if not exists season_months smallint[]
  check (season_months is null or (
    cardinality(season_months) between 1 and 11
    and season_months <@ '{1,2,3,4,5,6,7,8,9,10,11,12}'::smallint[]));
