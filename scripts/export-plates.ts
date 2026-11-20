// Exports the seed library's classification, as the taste simulation reads it
// (scripts/taste-sim.ts, logic/tests/style.test.ts): per recipe its
// learning features, its quiz facets, and what plate.ts reads of its
// classification, as written and without its optional lines (parmesan to
// serve, cream to finish). Reads a
// database with the migrations, seed.sql and seed_library.sql applied
// (npm run test:sql leaves one behind as dineamite_test):
//   node scripts/export-plates.ts
// Writes supabase/functions/_shared/logic/tests/fixtures/library.json.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { classifyRow, type ClassifiableRow, type RecipeClassification } from '../supabase/functions/_shared/logic/classify.ts';
import { Catalog, dietClassOf, type CatalogEntry } from '../supabase/functions/_shared/logic/ingredients.ts';
import { recipeFeatures } from '../supabase/functions/_shared/logic/preferences.ts';
import { quizFacets } from '../supabase/functions/_shared/logic/profile.ts';

const root = new URL('..', import.meta.url).pathname;
const db = process.env.PGDATABASE ?? 'dineamite_test';
const q = (sql: string) => JSON.parse(execFileSync('psql', ['-At', '-d', db, '-c', sql], { encoding: 'utf8', maxBuffer: 1 << 28 }));

const catalog = new Catalog(q('select coalesce(json_agg(c), \'[]\') from public.ingredient_catalog c') as CatalogEntry[]);
const rows = q(`select coalesce(json_agg(x order by x.id), '[]') from (select r.id, r.title, r.image_path,
  r.servings, r.tags, r.cuisine, r.steps, r.prep_min, r.cook_min, r.total_min, r.difficulty, r.equipment, r.translations,
  (select json_agg(i order by i.position) from public.recipe_ingredients i where i.recipe_id = r.id) recipe_ingredients
  from public.recipes r where r.household_id is null) x`) as (ClassifiableRow & { id: string; image_path: string | null })[];
if (rows.length === 0) throw new Error(`no library in database ${db}: run npm run test:sql first`);

// What plate.ts reads, so the fixture follows plate rule changes without a re-export.
const plateFields = (c: RecipeClassification | null) => c && {
  nutrition: c.nutrition, veg_g: c.veg_g, sauce_families: c.sauce_families, dish_families: c.dish_families,
  cooking_methods: c.cooking_methods,
};
const out = rows.map((r) => {
  const ingredients = r.recipe_ingredients ?? [];
  const classification = classifyRow({ ...r, recipe_ingredients: ingredients }, catalog);
  const required = ingredients.filter((i) => !i.optional);
  const withoutOptional = required.length < ingredients.length
    ? classifyRow({ ...r, recipe_ingredients: required }, catalog)
    : null;
  return {
    id: r.id,
    title: r.title,
    hasPhoto: !!r.image_path,
    diet: dietClassOf(ingredients.map((i) => catalog.find(i.name))),
    features: recipeFeatures(r.tags ?? [], ingredients, classification),
    facets: quizFacets(classification),
    classification: plateFields(classification),
    withoutOptional: plateFields(withoutOptional),
  };
});
const file = `${root}supabase/functions/_shared/logic/tests/fixtures/library.json`;
writeFileSync(file, `[\n${out.map((x) => JSON.stringify(x)).join(',\n')}\n]\n`);
console.log(`${out.length} recipes → ${file}`);
