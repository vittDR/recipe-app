// Shows one person's style + taste model (logic/style.ts) from their real
// signals: the same rows deal-deck reads (quiz answers and pairs, swipes and
// pass reasons, ratings, cooked meals), turned into signals (profile.ts
// signalsFor) and fitted on the plates of their household's and the seed
// library's recipes. For checking what the model makes of someone.
//   node scripts/taste-profile.ts <user id or email>
//   node scripts/taste-profile.ts <user> --deck   # also deal them a deck, with and without the model
// Reads the database in PGDATABASE (default dineamite_test, which
// npm run test:sql leaves behind); any Postgres with the schema will do.

import { execFileSync } from 'node:child_process';
import { CLASSIFICATION_VERSION, classifyRow, type ClassifiableRow, type RecipeClassification } from '../supabase/functions/_shared/logic/classify.ts';
import { buildDeck, type CandidateRecipe, type DeckMember } from '../supabase/functions/_shared/logic/deck.ts';
import { Catalog, type CatalogEntry } from '../supabase/functions/_shared/logic/ingredients.ts';
import { type Plate, rowPlates } from '../supabase/functions/_shared/logic/plate.ts';
import { recipeFeatures } from '../supabase/functions/_shared/logic/preferences.ts';
import { buildProfile, type MealRow, signalsFor, type SwipeRow, type TasteSignalRow, weightsOf } from '../supabase/functions/_shared/logic/profile.ts';
import { observationsFor, styleModelFor } from '../supabase/functions/_shared/logic/style.ts';

const who = process.argv[2];
if (!who) throw new Error('usage: node scripts/taste-profile.ts <user id or email>');
const db = process.env.PGDATABASE ?? 'dineamite_test';
const q = (sql: string) => JSON.parse(execFileSync('psql', ['-At', '-d', db, '-c', sql], { encoding: 'utf8', maxBuffer: 1 << 28 }) || 'null');
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

const user = q(`select row_to_json(u) from (select u.id, m.household_id from auth.users u
  left join public.household_members m on m.user_id = u.id
  where u.id::text = ${lit(who)} or u.email = ${lit(who)} limit 1) u`) as { id: string; household_id: string | null } | null;
if (!user) throw new Error(`no user ${who} in ${db}`);
const hh = user.household_id ? lit(user.household_id) : 'null';

const catalog = new Catalog(q("select coalesce(json_agg(c), '[]') from public.ingredient_catalog c") as CatalogEntry[]);
const recipes = q(`select coalesce(json_agg(x), '[]') from (select r.id, r.title, r.servings, r.tags, r.cuisine, r.steps,
  r.prep_min, r.cook_min, r.total_min, r.difficulty, r.equipment, r.translations, r.copied_from,
  (select json_agg(i order by i.position) from public.recipe_ingredients i where i.recipe_id = r.id) recipe_ingredients
  from public.recipes r where r.household_id is null or r.household_id = ${hh}) x`) as (ClassifiableRow & { id: string; copied_from: string | null })[];
const swipes = q(`select coalesce(json_agg(x), '[]') from (select s.user_id, s.deck_id, s.recipe_id, s.verdict, s.created_at, d.mood, d.filters
  from public.swipes s join public.decks d on d.id = s.deck_id where s.user_id = ${lit(user.id)}) x`) as SwipeRow[];
const tasteSignals = q(`select coalesce(json_agg(x), '[]') from (select user_id, recipe_id, other_recipe_id, kind, value, deck_id, meal_id, created_at
  from public.taste_signals where user_id = ${lit(user.id)}) x`) as TasteSignalRow[];
const meals = q(`select coalesce(json_agg(x), '[]') from (select m.id, m.recipe_id, m.for_date, m.status, d.who_eating
  from public.meals m left join public.decks d on d.id = m.deck_id where m.household_id = ${hh}) x`) as MealRow[];

const started = performance.now();
const features = new Map<string, string[]>();
const plates = new Map<string, Plate[]>();
const classes = new Map<string, RecipeClassification>();
for (const r of recipes) {
  const ings = r.recipe_ingredients ?? [];
  const row = { ...r, recipe_ingredients: ings };
  const c = classifyRow(row, catalog);
  classes.set(r.id, c);
  features.set(r.id, recipeFeatures(r.tags ?? [], ings, c));
  plates.set(r.id, rowPlates(row, catalog, c));
  // As in deal-deck: what was said about the seed recipe counts for the household's copy.
  if (r.copied_from) {
    features.set(r.copied_from, features.get(r.id)!);
    plates.set(r.copied_from, plates.get(r.id)!);
  }
}
const prepared = performance.now();
const signals = signalsFor(user.id, { swipes, tasteSignals, meals }, (id) => features.get(id));
const { observations, pairs } = observationsFor(signals, (id) => plates.get(id));
const model = styleModelFor(signals, (id) => plates.get(id));
const fitted = performance.now();

const title = new Map(recipes.map((r) => [r.id, r.title]));
const kinds = signals.reduce((m, s) => m.set(s.kind, (m.get(s.kind) ?? 0) + 1), new Map<string, number>());
console.log(`${user.id}: ${[...kinds].map(([k, n]) => `${n} ${k}`).join(', ') || 'no signals'}`);
console.log(`→ ${observations.length} observations, ${pairs.length} pairs; mean answer ${model.mean.toFixed(2)}`);
console.log(`classification v${CLASSIFICATION_VERSION}: plates of ${recipes.length} recipes in ${(prepared - started).toFixed(0)} ms,`
  + ` signals and fit in ${(fitted - prepared).toFixed(0)} ms\n`);

const scored = recipes.map((r) => ({
  title: r.title, f: model.frequency(plates.get(r.id) ?? [], features.get(r.id) ?? []),
  sd: Math.sqrt(model.variance((plates.get(r.id) ?? [])[0] ?? { protein: 0.4, rich: 0.3, veg: 0.55, carb: 0.6 }, features.get(r.id) ?? [])),
})).sort((a, b) => b.f - a.f);
const line = (x: (typeof scored)[number]) => `  ${x.f.toFixed(2)} ±${x.sd.toFixed(2)}  ${x.title}`;
console.log('Most wanted:');
scored.slice(0, 10).forEach((x) => console.log(line(x)));
console.log('Least wanted:');
scored.slice(-6).forEach((x) => console.log(line(x)));

const tiers = [0, 0, 0];
for (const x of scored) tiers[x.f < 0.5 ? 0 : x.f < 2 ? 1 : 2] += 1;
console.log(`\nNot for me ${tiers[0]} · now and then ${tiers[1]} · regularly ${tiers[2]}`);

// Style along each axis, the others at the library's middle plate.
const middle: Plate = { protein: 0.4, rich: 0.3, veg: 0.55, carb: 0.6 };
console.log('\nStyle along each axis (0 → 1, others in the middle):');
for (const axis of ['protein', 'rich', 'veg', 'carb'] as const) {
  console.log(`  ${axis.padEnd(8)}`, [0, 0.25, 0.5, 0.75, 1].map((v) => model.style({ ...middle, [axis]: v }).toFixed(2)).join('  '));
}
const tastes = [...model.tasteWeights].filter(([f]) => f.includes(':')).sort((a, b) => b[1].t - a[1].t);
console.log('\nTaste, clearest likes and dislikes:');
for (const [f, e] of [...tastes.slice(0, 5), ...tastes.slice(-5)]) console.log(`  ${e.t >= 0 ? '+' : ''}${e.t.toFixed(2)}  ${f} (${e.n})`);
for (const p of signals.filter((s) => s.kind === 'pair')) {
  console.log(`pair: ${title.get(p.recipeId)} / ${title.get(p.otherRecipeId)} → ${p.choice}`);
}

if (process.argv.includes('--deck')) {
  const goals = q(`select row_to_json(g) from public.member_goals g where g.user_id = ${lit(user.id)}`) as
    { dinner_kcal: number | null; dinner_protein_g: number | null } | null;
  const candidates: CandidateRecipe[] = recipes.map((r) => {
    const c = classes.get(r.id)!;
    const proteins = c.protein_groups ?? [];
    return {
      id: r.id, title: r.title, tags: r.tags ?? [], ingredientNames: [], totalMin: r.total_min ?? null,
      dietClass: proteins.some((g) => ['poultry', 'beef', 'pork', 'lamb', 'veal', 'game', 'offal'].includes(g)) ? 'meat'
        : proteins.some((g) => g === 'fish' || g === 'shellfish') ? 'fish' : 'veg',
      kcalPerServing: c.nutrition.kcal, proteinGPerServing: c.nutrition.protein_g,
      features: features.get(r.id), plates: plates.get(r.id), intents: c.meal_intents,
    };
  });
  const profile = buildProfile(signals);
  const base: DeckMember = {
    userId: user.id, dinnerKcal: goals?.dinner_kcal ?? 650, dinnerProteinG: goals?.dinner_protein_g ?? 40,
    never: [], loves: [], diet: 'everything', weights: weightsOf(profile), profile,
  };
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [label, m] of [['v1 profile', base], ['style model', { ...base, style: model }]] as const) {
    seed = 1;
    const deck = buildDeck(candidates, [m], new Map(), { random });
    console.log(`\nDeck with the ${label}:`);
    for (const c of deck) {
      const p = plates.get(c.recipeId)![0];
      const f = model.rawFrequency(plates.get(c.recipeId)!, features.get(c.recipeId)!);
      console.log(`  ${c.tier.padEnd(5)} F ${f.toFixed(1)}  rich ${p.rich.toFixed(2)}  ${(c.reason ?? '').padEnd(10)} ${title.get(c.recipeId)}`);
    }
  }
}
