-- Seasonality: the seasons an ingredient is in season in France (spring,
-- summer, autumn, winter). Seasons rather than months, to keep it flexible:
-- a dish of the season is anything from those three months. Null means all
-- year: pantry and frozen goods, stored crops sold all year (onion, potato,
-- carrot), and imports nobody thinks of as seasonal (lemon, avocado). Set in
-- seed.sql. A recipe's season isn't stored: logic/classify.ts works it out
-- from its main ingredients, or takes the recipe's own season tags
-- (classification.seasons), and the classification cache already clears when
-- the catalogue changes, so editing a season reseasons every recipe with no
-- backfill.

alter table public.ingredient_catalog drop column if exists season_months;
alter table public.ingredient_catalog add column if not exists seasons text[]
  check (seasons is null or (
    cardinality(seasons) between 1 and 3
    and seasons <@ '{spring,summer,autumn,winter}'::text[]));
