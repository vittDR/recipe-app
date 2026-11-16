// Exports the seed library as one JSON list for review or for an illustrator:
// every recipe from supabase/seed/recipes.json with whether it has an
// illustration (and the file name to give one), whether it's healthy, its seasons, kcal, protein and exotic
// ingredients. Reads the catalogue and the loaded library from a database
// with the migrations, seed.sql and seed_library.sql applied (npm run test:sql
// leaves one behind as dineamite_test):
//   node scripts/export-recipes.ts recipes.json             # every recipe
//   node scripts/export-recipes.ts recipes.json --original  # our own recipes only

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { classifyRow, isHealthy } from '../supabase/functions/_shared/logic/classify.ts';
import { Catalog, type CatalogEntry } from '../supabase/functions/_shared/logic/ingredients.ts';

const root = new URL('..', import.meta.url).pathname;
const out = process.argv[2];
if (!out || out.startsWith('--')) throw new Error('usage: node scripts/export-recipes.ts <out.json> [--original]');
const originalOnly = process.argv.includes('--original');
const db = process.env.PGDATABASE ?? 'dineamite_test';
const q = (sql: string) => JSON.parse(execFileSync('psql', ['-At', '-d', db, '-c', sql], { encoding: 'utf8', maxBuffer: 1 << 28 }));

const catalog = new Catalog(q('select coalesce(json_agg(c), \'[]\') from public.ingredient_catalog c') as CatalogEntry[]);
const rows = q(`select coalesce(json_agg(x), '[]') from (select r.id, r.title, r.collection, r.kcal_per_serving, r.protein_g_per_serving,
  r.servings, r.tags, r.cuisine, r.steps, r.prep_min, r.cook_min, r.total_min, r.difficulty, r.equipment, r.translations,
  (select json_agg(i) from public.recipe_ingredients i where i.recipe_id = r.id) recipe_ingredients
  from public.recipes r where r.household_id is null) x`);
const loaded = new Map(rows.map((r: { id: string }) => [r.id, r]));

// The photo file name, as scripts/download_images.py makes it.
const slug = (title: string) => {
  for (const [a, b] of [['œ', 'oe'], ['Œ', 'Oe'], ['æ', 'ae'], ['ı', 'i'], ['ß', 'ss']]) title = title.replaceAll(a, b);
  return title.normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
};

const recipes = JSON.parse(readFileSync(`${root}supabase/seed/recipes.json`, 'utf8')).flatMap((r: Record<string, unknown> & { id: string; title: string; image_url?: string | null }) => {
  const row = loaded.get(r.id) as Record<string, any> | undefined;
  if (!row) throw new Error(`${r.title} is not loaded in ${db}: run npm run test:sql`);
  if (originalOnly && row.collection !== 'original') return [];
  const c = classifyRow(row as never, catalog);
  const photo = r.image_url ?? null;
  const has = !!photo && (photo.startsWith('https://') || existsSync(`${root}web/public${photo}`));
  return [{
    has_illustration: has,
    illustration: has ? photo : null,
    photo_file: has ? null : `${slug(r.title)}.webp`,
    collection: row.collection,
    healthy: isHealthy((r.tags as string[] | undefined) ?? [], c),
    seasons: (c.seasons?.length ?? 4) === 4 ? ['all year'] : c.seasons,
    kcal_per_serving: row.kcal_per_serving,
    protein_g_per_serving: row.protein_g_per_serving,
    exotic_ingredients: row.recipe_ingredients.filter((i: { name: string }) => catalog.find(i.name)?.exotic).map((i: { name: string }) => i.name),
    ...r,
  }];
});

const files = recipes.flatMap((r: { photo_file: string | null }) => (r.photo_file ? [r.photo_file] : []));
if (new Set(files).size !== files.length) throw new Error('two recipes would share a photo_file: give one a different title');
const counts = {
  recipes: recipes.length,
  healthy: recipes.filter((r: { healthy: boolean }) => r.healthy).length,
  with_illustration: recipes.length - files.length,
  without_illustration: files.length,
};
writeFileSync(out, JSON.stringify({
  about: 'DINEAMITE seed recipes. has_illustration says whether a recipe has a photo (illustration is its path); '
    + 'those without one have photo_file: name the illustration after it (4:3, 900x675, WebP; docs/recipe-template.md#image-specs). '
    + 'healthy: by what is on the plate (docs/recipe-classification.md). '
    + 'collection: web = taken from a recipe site, original = written for the app.',
  counts,
  recipes,
}, null, 2) + '\n');
console.log(`${out}: ${JSON.stringify(counts)}`);
