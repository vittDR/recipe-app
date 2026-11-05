-- Recipe classification v1 (logic/classify.ts): every recipe, imported, typed
-- or seed, is described from its ingredients, amounts, steps and times rather
-- than hand-tagged. The catalogue gains what that needs: fat, carbohydrate
-- and fibre per 100 g (for lean / high-fibre goals) and traits such as
-- protein:fish, starch:rice, sauce:coconut, heat:1.5 and liquid.
-- Values are filled by seed.sql. Nothing is stored on recipes: the
-- classification is recomputed wherever it is used, so it follows the
-- catalogue and the rules without a backfill.

alter table public.ingredient_catalog add column if not exists fat_100g real;
alter table public.ingredient_catalog add column if not exists carbs_100g real;
alter table public.ingredient_catalog add column if not exists fiber_100g real;
alter table public.ingredient_catalog add column if not exists traits text[] not null default '{}';
