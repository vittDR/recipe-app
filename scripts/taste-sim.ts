// Taste quiz simulation (docs/taste-profiles.md, Validation): simulated
// people with a hidden true frequency for every library dish take the quiz,
// and we check how well the fitted model (logic/style.ts) recovers it on the
// dishes they weren't shown. Compares quiz strategies and lengths, and tunes
// the model's settings.
//
//   node scripts/taste-sim.ts                 # strategies × lengths, every persona
//   node scripts/taste-sim.ts --tune          # model settings sweep, adaptive + pairs
//   node scripts/taste-sim.ts --seeds 20      # more simulated people per persona
//   node scripts/taste-sim.ts --lengths 20,32 # quiz lengths to compare
//   node scripts/taste-sim.ts --diag          # the truth's ceiling, and the model with many answers
//   node scripts/taste-sim.ts --features      # v2 features (cuisine, cut, flavour, family, effort), the dish's
//                                             # own effect and other households' answers, against the v1 features
//
// Reads logic/tests/fixtures/library.json (scripts/export-plates.ts).

import { readFileSync } from 'node:fs';
import { type Plate, platesOf } from '../supabase/functions/_shared/logic/plate.ts';
import { pickStarterSet } from '../supabase/functions/_shared/logic/profile.ts';
import {
  fitStyle, FREQUENCY, nextQuizCard, nextQuizPair, type PairChoice, type PairObservation, type QuizCandidate,
  type StyleOptions,
} from '../supabase/functions/_shared/logic/style.ts';
import type { RecipeClassification } from '../supabase/functions/_shared/logic/classify.ts';
import { dishFeature } from '../supabase/functions/_shared/logic/profile.ts';
import { type PopulationAnswer, populationEffects, populationMean } from '../supabase/functions/_shared/logic/population.ts';

const root = new URL('..', import.meta.url).pathname;
interface Row {
  id: string; title: string; hasPhoto: boolean; diet: 'veg' | 'fish' | 'meat'; features: string[]; facets: string[];
  classification: RecipeClassification; withoutOptional: RecipeClassification | null;
}
const library = (JSON.parse(readFileSync(`${root}supabase/functions/_shared/logic/tests/fixtures/library.json`, 'utf8')) as Row[])
  .map((r) => ({ ...r, plates: platesOf(r.classification, r.withoutOptional) }))
  .filter((r) => r.plates.length > 0);
type Dish = (typeof library)[number];

const args = process.argv.slice(2);
const SEEDS = Number(args[args.indexOf('--seeds') + 1]) || 8;

// ---------------------------------------------------------------------------
// Randomness, seeded
// ---------------------------------------------------------------------------

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

// ---------------------------------------------------------------------------
// Personas: a true style over plates, true tastes, and a diet
// ---------------------------------------------------------------------------

interface Persona {
  name: string;
  diet?: 'vegetarian' | 'pescatarian';
  style: (p: Plate) => number;
  tastes: Record<string, number>;
  /** Tastes only the v2 features name (--features --extended): cuisines, cuts, flavours, families, effort. */
  extra?: Record<string, number>;
}
const over = (v: number, at: number) => Math.max(0, v - at);

const PERSONAS: Persona[] = [
  {
    name: 'mostly balanced',
    style: (p) => 3.3 - 6 * over(p.rich, 0.35) + 1 * (p.protein - 0.4) + 0.6 * (p.veg - 0.5) - 1.5 * over(0.2, p.carb),
    tastes: { 'protein:poultry': 0.6, 'protein:fish': 0.4, 'dish:soup': -0.8 },
    extra: { 'flavour:fresh_herbs': 0.5, 'family:mushrooms': -1.2, 'cuisine:asian': 0.5, 'cut:chicken thigh': 0.5 },
  },
  {
    name: 'generous',
    style: (p) => 2 + 2 * p.rich - 0.8 * over(p.veg, 0.6) + 0.5 * p.carb,
    tastes: { 'sauce:tomato': 0.6, 'dish:pasta_dish': 0.8, 'dish:salad': -1.5 },
    extra: { 'family:cheese': 0.8, 'cuisine:italian': 0.6, 'effort:long': 0.4, 'flavour:smoky': 0.6 },
  },
  {
    name: 'lean fish lover',
    diet: 'pescatarian',
    style: (p) => 3 - 7 * over(p.rich, 0.3) + 1.5 * (p.protein - 0.4),
    tastes: { 'protein:fish': 1.5, 'protein:shellfish': 1, 'protein:eggs': -1, 'heat:2+': 0.5 },
    extra: { 'flavour:citrus': 0.7, 'cuisine:japanese': 0.7, 'cut:salmon fillet': 0.6, 'family:coconut': -0.8 },
  },
  {
    name: 'vegetarian comfort',
    diet: 'vegetarian',
    style: (p) => 2.2 + 1.5 * p.rich + 0.5 * p.carb - 0.8 * over(p.protein, 0.5),
    tastes: { 'dish:curry': 1.2, 'protein:legumes': 0.5, 'dish:salad': -1 },
    extra: { 'flavour:warm_spice': 0.8, 'family:cheese': 0.6, 'family:aubergine': -1, 'cut:tofu': -0.8 },
  },
  {
    name: 'picky, no spice',
    style: (p) => 3 - 3 * over(p.veg, 0.55) - 2 * over(0.3, p.carb),
    tastes: { 'heat:2+': -2.5, 'dish:soup': -2, 'dish:salad': -1.5, 'protein:offal': -3, 'protein:lamb': -1.5 },
    extra: { 'family:olives_capers': -1.2, 'flavour:tangy': -0.6, 'effort:long_list': -0.7, 'family:mushrooms': -1 },
  },
  // Its style and tastes are drawn per seed: guards against tuning to the personas above.
  { name: 'random', style: () => 0, tastes: {} },
];

const TASTE_POOL = [
  'protein:poultry', 'protein:beef', 'protein:pork', 'protein:fish', 'protein:shellfish', 'protein:eggs', 'protein:legumes',
  'protein:lamb', 'dish:curry', 'dish:soup', 'dish:salad', 'dish:pasta_dish', 'dish:stew', 'dish:stir_fry', 'dish:tacos',
  'sauce:tomato', 'sauce:coconut', 'sauce:soy_based', 'heat:2+', 'starch:rice', 'starch:potato', 'italian', 'asian', 'indian',
];

const EXTRA_POOL = [
  'cuisine:indian', 'cuisine:italian', 'cuisine:mexican', 'cuisine:japanese', 'cuisine:middle eastern', 'cuisine:french',
  'cut:chicken thigh', 'cut:chicken breast', 'cut:prawns', 'cut:salmon fillet', 'cut:tofu', 'cut:ground beef',
  'flavour:fresh_herbs', 'flavour:citrus', 'flavour:umami', 'flavour:smoky', 'flavour:warm_spice', 'flavour:sweet',
  'flavour:tangy', 'flavour:nutty', 'family:mushrooms', 'family:cheese', 'family:olives_capers', 'family:pulses',
  'family:coconut', 'family:aubergine', 'effort:quick', 'effort:long', 'effort:long_list',
];
const EXTENDED = args.includes('--extended');

function draw(persona: Persona, seed: number): Persona {
  if (persona.name !== 'random') return EXTENDED ? { ...persona, tastes: { ...persona.tastes, ...persona.extra } } : persona;
  const r = rng(seed * 7919);
  const c = { protein: gauss(r), rich: gauss(r) * 2, veg: gauss(r), carb: gauss(r) };
  const base = 2 + gauss(r) * 0.6;
  const tastes: Record<string, number> = {};
  for (const f of TASTE_POOL) if (r() < 0.35) tastes[f] = gauss(r) * 1.2;
  if (EXTENDED) for (const f of EXTRA_POOL) if (r() < 0.25) tastes[f] = gauss(r) * 0.9;
  return {
    name: 'random',
    style: (p) => base + c.protein * (p.protein - 0.4) + c.rich * (p.rich - 0.3) + c.veg * (p.veg - 0.55) + c.carb * (p.carb - 0.6),
    tastes,
  };
}

/**
 * How much better or worse a dish is than its features say, for everyone:
 * with --features, a dish's own effect (sd 0.5) is this shared part (sd 0.4)
 * plus a personal one (sd 0.3), so other people's answers can teach it.
 */
const SHARED = args.includes('--features');
const quality = (() => {
  const r = rng(4242);
  return new Map(library.map((d) => [d.id, gauss(r)]));
})();
const dishEffect = (id: string, r: () => number) => (SHARED ? 0.4 * quality.get(id)! + 0.3 * gauss(r) : 0.5 * gauss(r));

/** A person's true frequency for every dish they could be offered, with a dish-of-its-own effect taste can't explain. */
function truth(persona: Persona, seed: number) {
  const r = rng(seed);
  const allowed = library.filter((d) =>
    persona.diet === 'vegetarian' ? d.diet === 'veg' : persona.diet === 'pescatarian' ? d.diet !== 'meat' : true);
  const F = new Map<string, number>();
  /** Without the dish's own effect: what can be learned from other dishes. */
  const clean = new Map<string, number>();
  for (const d of allowed) {
    const style = Math.max(...d.plates.map((p) => persona.style(p)));
    const fs = new Set(d.features);
    const taste = Object.entries(persona.tastes).reduce((s, [f, v]) => s + (fs.has(f) ? v : 0), 0);
    F.set(d.id, Math.max(0, Math.min(4, style + taste + dishEffect(d.id, r))));
    clean.set(d.id, Math.max(0, Math.min(4, style + taste)));
  }
  return { allowed, F, clean };
}

/** How a person answers a card: their true frequency, a little noisy, on the four answers. */
const answer = (f: number, r: () => number) => {
  const v = f + 0.4 * gauss(r);
  return v < 0.5 ? FREQUENCY.pass : v < 2 ? FREQUENCY.sometimes : v < 3.5 ? FREQUENCY.yes : FREQUENCY.must;
};
const pairAnswer = (fa: number, fb: number): PairChoice =>
  fa - fb > 0.75 ? 'a' : fb - fa > 0.75 ? 'b' : Math.max(fa, fb) >= 1.5 ? 'either' : 'neither';

// ---------------------------------------------------------------------------
// Quiz strategies
// ---------------------------------------------------------------------------

type Strategy = 'random' | 'v1 varied' | 'adaptive' | 'anchors + adaptive' | 'adaptive + pairs';
const candidate = (d: Dish): QuizCandidate => ({ id: d.id, plate: d.plates[0], features: d.features, facets: d.facets, hasPhoto: d.hasPhoto });

function runQuiz(strategy: Strategy, length: number, allowed: Dish[], F: Map<string, number>, seed: number, options: StyleOptions) {
  const r = rng(seed * 31 + 7);
  const pool = allowed.map(candidate);
  const shown: { candidate: QuizCandidate; y: number }[] = [];
  const pairs: PairObservation[] = [];
  const show = (c: QuizCandidate) => shown.push({ candidate: c, y: answer(F.get(c.id)!, r) });

  if (strategy === 'random') {
    const order = [...pool].sort(() => r() - 0.5);
    order.slice(0, length).forEach(show);
  } else if (strategy === 'v1 varied') {
    const byId = new Map(pool.map((c) => [c.id, c]));
    // v1 picks on classification facets; the facets already are them.
    pickStarterSet(allowed.map((d) => ({ id: d.id, hasPhoto: d.hasPhoto, classification: facetsAsClassification(d.facets) })), length, r)
      .forEach((d) => show(byId.get(d.id)!));
  } else {
    const nPairs = strategy === 'adaptive + pairs' ? Math.round(length * (6 / 32)) : 0;
    const nCards = length - nPairs;
    while (shown.length < nCards) {
      const next = nextQuizCard(pool, shown, pairs, r, { ...options, anchors: strategy === 'anchors + adaptive' ? 10 : 0 });
      if (!next) break;
      show(next);
    }
    const used = new Set(shown.map((s) => s.candidate.id));
    for (let i = 0; i < nPairs; i++) {
      const model = fitStyle(shown.map(obsOf), pairs, options);
      const pair = nextQuizPair(pool, used, model, r);
      if (!pair) break;
      const [a, b] = pair;
      used.add(a.id).add(b.id);
      pairs.push({ a: a.plate, b: b.plate, choice: pairAnswer(F.get(a.id)!, F.get(b.id)!) });
    }
  }
  return { model: fitStyle(shown.map(obsOf), pairs, options), shown: new Set(shown.map((s) => s.candidate.id)) };
}
const obsOf = (s: { candidate: QuizCandidate; y: number }) => ({ plate: s.candidate.plate, features: s.candidate.features, y: s.y });

/** pickStarterSet reads facets through classificationFeatures; this hands them back as-is. */
function facetsAsClassification(facets: string[]): RecipeClassification {
  // The smallest classification whose quiz facets are close to these: v1 varies on protein, dish, sauce, heat, cuisine.
  const by = (ns: string) => facets.filter((f) => f.startsWith(`${ns}:`)).map((f) => f.slice(ns.length + 1));
  const heat = by('heat')[0];
  return {
    version: 0, cuisines: by('cuisine'), protein_groups: by('protein'), protein_items: [], starch_bases: by('starch'),
    dish_families: by('dish'), sauce_families: by('sauce'), cooking_methods: by('method'),
    heat_level: heat === 'none' ? 0 : heat === 'some' ? 1 : heat === 'hot' ? 3 : null, heat_adjustable: false, sauce_level: null,
    seasons: null, nutrition: { kcal: null, protein_g: null, fat_g: null, carbs_g: null, fiber_g: null, estimated: true },
    veg_g: null, nutrition_goals: by('goal'), meal_intents: by('intent'), sourced: [],
  } as unknown as RecipeClassification;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function ranks(v: number[]) {
  const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(v.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) out[idx[k][1]] = (i + j) / 2;
    i = j + 1;
  }
  return out;
}
function spearman(a: number[], b: number[]) {
  const ra = ranks(a), rb = ranks(b);
  const ma = ra.reduce((s, x) => s + x, 0) / ra.length, mb = rb.reduce((s, x) => s + x, 0) / rb.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
const tier = (f: number) => (f < 0.5 ? 0 : f < 2 ? 1 : 2);
/** Share of the deck that's occasional: frequency mass of occasional dishes over all (docs §5). */
const occasionalShare = (fs: number[]) => {
  const total = fs.reduce((s, f) => s + f, 0);
  return total ? fs.filter((f) => tier(f) === 1).reduce((s, f) => s + f, 0) / total : 0;
};

function evaluate(strategy: Strategy, length: number, options: StyleOptions = {}) {
  const per = new Map<string, { rho: number[]; clean: number[]; tierAcc: number[]; shareErr: number[]; top: number[] }>();
  for (const base of PERSONAS) {
    const e = { rho: [] as number[], clean: [] as number[], tierAcc: [] as number[], shareErr: [] as number[], top: [] as number[] };
    for (let seed = 1; seed <= SEEDS; seed++) {
      const persona = draw(base, seed);
      const { allowed, F, clean } = truth(persona, seed * 101 + base.name.length);
      const { model, shown } = runQuiz(strategy, length, allowed, F, seed, options);
      const test = allowed.filter((d) => !shown.has(d.id));
      const truthF = test.map((d) => F.get(d.id)!);
      const fitF = test.map((d) => model.frequency(d.plates, d.features));
      e.rho.push(spearman(fitF, truthF));
      e.clean.push(spearman(fitF, test.map((d) => clean.get(d.id)!)));
      e.tierAcc.push(test.filter((_, i) => tier(fitF[i]) === tier(truthF[i])).length / test.length);
      e.shareErr.push(Math.abs(occasionalShare(fitF) - occasionalShare(truthF)));
      // Of the 12 dishes the model likes best, how many are in the person's true top quarter.
      const cut = [...truthF].sort((a, b) => b - a)[Math.floor(truthF.length / 4)];
      const top12 = fitF.map((f, i) => [f, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 12);
      e.top.push(top12.filter(([, i]) => truthF[i] >= cut).length / 12);
    }
    per.set(base.name, e);
  }
  return per;
}
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
const fmt = (v: number) => v.toFixed(2);

// ---------------------------------------------------------------------------

if (args.includes('--features')) {
  // v1 features against v2 ones, the dish's own effect and other households'
  // answers, after the quiz (26 cards) and after the quiz plus some history
  // (answers on random dishes, like deck swipes and ratings at half weight).
  const V2 = /^(cuisine|cut|flavour|family|effort|recipe):/;
  const variants = [
    { name: 'v1 features', v2: false, dish: false, population: false },
    { name: 'v2 features', v2: true, dish: false, population: false },
    { name: 'v2 + dish effect', v2: true, dish: true, population: false },
    { name: 'v2 + dish + others', v2: true, dish: true, population: true },
  ];
  const featuresOf = (d: Dish, v: (typeof variants)[number]) => [
    ...(v.v2 ? d.features : d.features.filter((f) => !V2.test(f))), ...(v.dish ? [dishFeature(d.id)] : []),
  ];
  // Other households: people drawn like the random persona, 50 answers each on dishes of their choosing.
  const others = (n: number) => {
    const answers: PopulationAnswer[] = [];
    for (let i = 0; i < n; i++) {
      const persona = draw(PERSONAS[PERSONAS.length - 1], 1000 + i);
      const { allowed, F } = truth(persona, 5000 + i);
      const r = rng(9000 + i);
      for (const d of [...allowed].sort(() => r() - 0.5).slice(0, 50)) {
        answers.push({ userId: `u${i}`, recipeId: d.id, y: answer(F.get(d.id)!, r), weight: 1 });
      }
    }
    return populationMean(populationEffects(answers));
  };
  const variance = args.includes('--variance') ? JSON.parse(args[args.indexOf('--variance') + 1]) as Record<string, number> : {};
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const population = others(Number(args[args.indexOf('--others') + 1]) || 80);
  const historyLengths = [0, 60];
  console.log(`${library.length} dishes, ${SEEDS} people per persona${EXTENDED ? ', with v2-only tastes' : ''}. ρ against the true frequency (top-12 hit rate), 26 quiz cards then n history answers.\n`);
  for (const v of variants.filter((x) => !only || x.name === only)) {
    const cells: string[] = [];
    for (const nHistory of historyLengths) {
      const rho: number[] = [];
      const top: number[] = [];
      const perPersona: string[] = [];
      for (const base of PERSONAS) {
        const pr: number[] = [];
        for (let seed = 1; seed <= SEEDS; seed++) {
          const persona = draw(base, seed);
          const { allowed, F, clean } = truth(persona, seed * 101 + base.name.length);
          const r = rng(seed * 31 + 7);
          const options: StyleOptions = { variance, ...(v.population ? { featureMean: population } : {}) };
          const pool = allowed.map((d) => ({ ...candidate(d), features: featuresOf(d, v) }));
          const shown: { candidate: QuizCandidate; y: number }[] = [];
          while (shown.length < 26) {
            const next = nextQuizCard(pool, shown, [], r, options);
            if (!next) break;
            shown.push({ candidate: next, y: answer(F.get(next.id)!, r) });
          }
          const seen = new Set(shown.map((x) => x.candidate.id));
          const history = pool.filter((c) => !seen.has(c.id)).sort(() => r() - 0.5).slice(0, nHistory);
          for (const c of history) seen.add(c.id);
          const model = fitStyle([
            ...shown.map(obsOf),
            ...history.map((c) => ({ plate: c.plate, features: c.features, y: answer(F.get(c.id)!, r), weight: 0.5 })),
          ], [], options);
          const test = allowed.filter((d) => !seen.has(d.id));
          const fit = test.map((d) => model.frequency(d.plates, featuresOf(d, v)));
          // Against the full truth: the shared part of a dish's own effect can be learned from others.
          const truthF = test.map((d) => F.get(d.id)!);
          const p = spearman(fit, truthF);
          rho.push(p);
          pr.push(p);
          const cut = [...truthF].sort((a, b) => b - a)[Math.floor(truthF.length / 4)];
          top.push(fit.map((f, i) => [f, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 12).filter(([, i]) => truthF[i] >= cut).length / 12);
        }
        perPersona.push(`${base.name} ${fmt(mean(pr))}`);
      }
      cells.push(`+${nHistory}: ${fmt(mean(rho))} (${fmt(mean(top))})  [${perPersona.join(' · ')}]`);
    }
    console.log(v.name.padEnd(20), cells.join('\n'.padEnd(22)));
  }
} else if (args.includes('--diag')) {
  // Ceiling: the noiseless truth against the truth. Then the model with many random answers.
  for (const base of PERSONAS) {
    const row: string[] = [];
    for (const n of [32, 100, 300]) {
      const rho: number[] = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const persona = draw(base, seed);
        const { allowed, F } = truth(persona, seed * 101 + base.name.length);
        const { model, shown } = runQuiz('random', Math.min(n, allowed.length - 50), allowed, F, seed, {});
        const test = allowed.filter((d) => !shown.has(d.id));
        rho.push(spearman(test.map((d) => model.frequency(d.plates, d.features)), test.map((d) => F.get(d.id)!)));
      }
      row.push(`n=${n} ${fmt(mean(rho))}`);
    }
    const ceil: number[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const persona = draw(base, seed);
      const { allowed, F } = truth(persona, seed * 101 + base.name.length);
      const clean = allowed.map((d) => {
        const fs = new Set(d.features);
        return Math.max(0, Math.min(4, Math.max(...d.plates.map((p) => persona.style(p)))
          + Object.entries(persona.tastes).reduce((s, [f, v]) => s + (fs.has(f) ? v : 0), 0)));
      });
      ceil.push(spearman(clean, allowed.map((d) => F.get(d.id)!)));
    }
    console.log(base.name.padEnd(20), `ceiling ${fmt(mean(ceil))}`, row.join('  '));
  }
} else if (args.includes('--tune')) {
  // The picker barely changes which settings win, so the sweep uses the fast one.
  console.log('v1 varied, 32 decisions: mean Spearman over personas (tier accuracy)');
  const grid: StyleOptions[] = [];
  for (const lengthscale of [0.1, 0.15, 0.25]) {
    for (const styleVariance of [0.5, 1, 2]) {
      for (const tasteScale of [0.5, 1, 2]) {
        for (const noise of [0.5, 1, 2]) grid.push({ lengthscale, styleVariance, tasteScale, noise });
      }
    }
  }
  const results = grid.map((o) => {
    const all = [...evaluate('v1 varied', 32, o).values()];
    return { o, rho: mean(all.map((e) => mean(e.rho))), tier: mean(all.map((e) => mean(e.tierAcc))) };
  }).sort((a, b) => b.rho - a.rho);
  for (const { o, rho, tier } of results.slice(0, 12)) console.log(JSON.stringify(o).padEnd(72), fmt(rho), `(${fmt(tier)})`);
  console.log('defaults', fmt(mean([...evaluate('v1 varied', 32).values()].map((e) => mean(e.rho)))));
} else {
  const strategies: Strategy[] = ['random', 'v1 varied', 'adaptive', 'anchors + adaptive', 'adaptive + pairs'];
  const lengths = (args.includes('--lengths') ? args[args.indexOf('--lengths') + 1] : '20,32,40').split(',').map(Number);
  console.log(`${library.length} dishes, ${SEEDS} simulated people per persona, scored on dishes not shown.`);
  console.log('Spearman ρ of fitted vs true frequency | ρ vs the learnable truth (no dish-of-its-own effect) | tier accuracy (out / now and then / regularly) | top-12 hit rate | occasional-share error\n');
  for (const length of lengths) {
    console.log(`— ${length} decisions —`);
    for (const s of strategies) {
      const per = evaluate(s, length);
      const all = [...per.values()];
      const cells = [...per].map(([n, e]) => `${n} ${fmt(mean(e.clean))}`).join(' · ');
      console.log(`${s.padEnd(19)} ρ ${fmt(mean(all.map((e) => mean(e.rho))))}  learnable ${fmt(mean(all.map((e) => mean(e.clean))))}  tier ${fmt(mean(all.map((e) => mean(e.tierAcc))))}`
        + `  top ${fmt(mean(all.map((e) => mean(e.top))))}  share±${fmt(mean(all.map((e) => mean(e.shareErr))))}   ${cells}`);
    }
  }
}
