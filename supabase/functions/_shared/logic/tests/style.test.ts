import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { type Plate, plateDistance, platesOf } from '../plate.ts';
import {
  COOKED_FREQUENCY, FREQUENCY, fitStyle, nextQuizCard, nextQuizPair, type Observation, observationsFor, PAIR_MIN_DISTANCE,
  type QuizCandidate, RATING_FREQUENCY, SIGNAL_WEIGHT, STYLE_HALF_LIFE_DAYS, styleModelFor, SWIPE_FREQUENCY, tasteFeatures,
} from '../style.ts';
import { type MealRow, type Signal, signalsFor, type SwipeRow, type TasteSignalRow } from '../profile.ts';
import type { RecipeClassification } from '../classify.ts';

const plate = (rich: number, protein = 0.5, veg = 0.5, carb = 0.6): Plate => ({ protein, rich, veg, carb });

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

test('answers are frequencies', () => {
  assert.deepEqual(FREQUENCY, { pass: 0, sometimes: 1, yes: 3, must: 4 });
});

test('plate-like features are left to style', () => {
  assert.deepEqual(tasteFeatures(['protein:fish', 'goal:lean', 'intent:comfort', 'sauce:cream', 'sauce:tomato', 'cod', 'cod']),
    ['protein:fish', 'sauce:tomato', 'cod']);
});

test('style: someone who wants rich plates rarely', () => {
  const obs: Observation[] = [];
  for (let i = 0; i <= 10; i++) obs.push({ plate: plate(i / 10), features: [], y: Math.max(0, 3.5 - 4 * (i / 10)) });
  const m = fitStyle(obs);
  assert.ok(m.style(plate(0.1)) > 2.8);
  assert.ok(m.style(plate(0.9)) < 0.8);
  assert.ok(m.frequency([plate(0.2)], []) > m.frequency([plate(0.6)], []));
  // Where they said a lot, the model is surer than far away from it.
  assert.ok(m.styleVariance(plate(0.5)) < m.styleVariance({ protein: 1, rich: 1, veg: 0, carb: 0 }));
});

test('taste and style are told apart: fish is disliked whatever the plate', () => {
  const r = rng(3);
  const obs: Observation[] = [];
  for (let i = 0; i < 40; i++) {
    const p = plate(r(), r(), r(), r());
    const fish = i % 2 === 0;
    obs.push({ plate: p, features: [fish ? 'protein:fish' : 'protein:poultry'], y: fish ? 0.5 : 3 });
  }
  const m = fitStyle(obs);
  assert.ok(m.taste(['protein:fish']) - m.taste(['protein:poultry']) < -1.8);
  // Style has nothing to explain: it's about flat.
  assert.ok(Math.abs(m.style(plate(0.1)) - m.style(plate(0.9))) < 0.5);
  assert.ok(m.tasteWeights.get('protein:fish')!.t < 0);
});

test('a dish is scored on its best plate', () => {
  const obs = [0, 0.2, 0.8, 1].map((rich) => ({ plate: plate(rich), features: [], y: rich < 0.5 ? 3.5 : 0.5 }));
  const m = fitStyle(obs);
  assert.ok(m.frequency([plate(0.9), plate(0.15)], []) > m.frequency([plate(0.9)], []) + 1.5);
});

test('pairs teach style', () => {
  // Every answer said the same; only the pairs prefer the lighter plate.
  const obs = [0, 0.5, 1].map((rich) => ({ plate: plate(rich), features: [], y: 2 }));
  const pairs = [0.6, 0.7, 0.8].map((rich) => ({ a: plate(rich - 0.5), b: plate(rich), choice: 'a' as const }));
  const flat = fitStyle(obs);
  const m = fitStyle(obs, pairs);
  assert.ok(Math.abs(flat.style(plate(0.2)) - flat.style(plate(0.8))) < 0.1);
  assert.ok(m.style(plate(0.2)) > m.style(plate(0.8)) + 0.5);
});

test('older or weaker signals weigh less', () => {
  const strong = fitStyle([{ plate: plate(0.5), features: [], y: 4 }, { plate: plate(0.5), features: [], y: 0, weight: 0.1 }]);
  assert.ok(strong.mean > 3.5);
  assert.ok(strong.style(plate(0.5)) > 3);
});

test('no answers yet: everything is middling and unsure', () => {
  const m = fitStyle([]);
  assert.equal(m.frequency([plate(0.3)], ['protein:fish']), 2);
  assert.ok(m.variance(plate(0.3), ['protein:fish']) > 1);
});

// ---------------------------------------------------------------------------
// The quiz, on the library
// ---------------------------------------------------------------------------

interface Row {
  id: string; title: string; hasPhoto: boolean; features: string[]; facets: string[];
  classification: RecipeClassification; withoutOptional: RecipeClassification | null;
}
const library = (JSON.parse(readFileSync(new URL('./fixtures/library.json', import.meta.url), 'utf8')) as Row[])
  .map((r) => ({ ...r, plates: platesOf(r.classification, r.withoutOptional) }));
const pool: QuizCandidate[] = library.map((r) => ({ id: r.id, plate: r.plates[0], features: r.features, facets: r.facets, hasPhoto: r.hasPhoto }));

test('quiz cards: unseen, with a photo, none when the pool is used up', () => {
  const r = rng(1);
  const shown: { candidate: QuizCandidate; y: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const c = nextQuizCard(pool, shown, [], r)!;
    assert.ok(c.hasPhoto);
    assert.ok(!shown.some((s) => s.candidate.id === c.id));
    shown.push({ candidate: c, y: 3 });
  }
  const two = pool.slice(0, 2);
  assert.equal(nextQuizCard(two, two.map((c) => ({ candidate: c, y: 1 })), [], r), null);
});

test('quiz pairs: same protein, different plates, nothing shown before', () => {
  const used = new Set(pool.slice(0, 50).map((c) => c.id));
  const [a, b] = nextQuizPair(pool, used, fitStyle([]), rng(2))!;
  const proteins = (c: QuizCandidate) => c.features.filter((f) => f.startsWith('protein:')).sort();
  assert.deepEqual(proteins(a), proteins(b));
  assert.ok(proteins(a).length > 0);
  assert.ok(!used.has(a.id) && !used.has(b.id));
  const m = fitStyle([]);
  assert.ok(Math.abs(m.style(a.plate) - m.style(b.plate)) < 1e-9);
  assert.ok(plateDistance(a.plate, b.plate) >= PAIR_MIN_DISTANCE);
});

test('26 quiz answers recover a lean, fish-loving person on the dishes they were not shown', () => {
  const truth = (r: (typeof library)[number]) => {
    const p = r.plates[0];
    const fs = new Set(r.features);
    const v = 3 - 7 * Math.max(0, p.rich - 0.3) + 1.5 * (p.protein - 0.4)
      + (fs.has('protein:fish') ? 1.5 : 0) + (fs.has('protein:pork') ? -2 : 0);
    return Math.max(0, Math.min(4, v));
  };
  const answer = (f: number) => (f < 0.5 ? 0 : f < 2 ? 1 : f < 3.5 ? 3 : 4);
  const byId = new Map(library.map((r) => [r.id, r]));
  const r = rng(7);
  const shown: { candidate: QuizCandidate; y: number }[] = [];
  while (shown.length < 26) {
    const c = nextQuizCard(pool, shown, [], r)!;
    shown.push({ candidate: c, y: answer(truth(byId.get(c.id)!)) });
  }
  const m = fitStyle(shown.map((s) => ({ plate: s.candidate.plate, features: s.candidate.features, y: s.y })));
  const seen = new Set(shown.map((s) => s.candidate.id));
  const rest = library.filter((x) => !seen.has(x.id));
  const fit = rest.map((x) => m.frequency(x.plates, x.features));
  const real = rest.map(truth);
  assert.ok(spearman(fit, real) > 0.7, `ρ ${spearman(fit, real).toFixed(2)}`);
});

function spearman(a: number[], b: number[]) {
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const out = new Array<number>(v.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) out[idx[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return out;
  };
  const ra = rank(a), rb = rank(b);
  const m = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = m(ra), mb = m(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

// ---------------------------------------------------------------------------
// From recorded signals
// ---------------------------------------------------------------------------

const now = Date.UTC(2026, 10, 1);
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
const plates: Record<string, Plate[]> = {
  light: [plate(0.1)], rich: [plate(0.9)], mid: [plate(0.5)], other: [plate(0.3, 0.8)],
};
const platesById = (id: string) => plates[id];

test('signals become frequencies, weighted by what they say', () => {
  const signals: Signal[] = [
    { kind: 'starter', verdict: 'sometimes', recipeId: 'rich', features: [], at: daysAgo(0) },
    { kind: 'swipe', verdict: 'must', recipeId: 'light', features: [], at: daysAgo(0) },
    { kind: 'swipe', verdict: 'pass', reason: 'not_for_me', recipeId: 'mid', features: [], at: daysAgo(0) },
    // A plain pass, or one for tonight's reasons, says nothing about how often.
    { kind: 'swipe', verdict: 'pass', recipeId: 'mid', features: [], at: daysAgo(0) },
    { kind: 'swipe', verdict: 'pass', reason: 'too_long', recipeId: 'mid', features: [], at: daysAgo(0) },
    { kind: 'rating', rating: 'not_again', recipeId: 'other', mealId: 'm1', features: [], at: daysAgo(0) },
    { kind: 'rating', rating: 'not_eaten', recipeId: 'other', mealId: 'm2', features: [], at: daysAgo(0) },
    // Cooked and rated: the rating says it; cooked alone counts a little.
    { kind: 'cooked', recipeId: 'other', mealId: 'm1', features: [], at: daysAgo(0) },
    { kind: 'cooked', recipeId: 'light', mealId: 'm3', features: [], at: daysAgo(0) },
    // A dish without a plate says nothing here.
    { kind: 'starter', verdict: 'yes', recipeId: 'unknown', features: [], at: daysAgo(0) },
  ];
  const { observations, pairs } = observationsFor(signals, platesById, now);
  assert.deepEqual(observations.map((o) => [o.y, o.weight]), [
    [FREQUENCY.sometimes, SIGNAL_WEIGHT.starter],
    [SWIPE_FREQUENCY.must, SIGNAL_WEIGHT.swipe],
    [0, SIGNAL_WEIGHT.swipe],
    [RATING_FREQUENCY.not_again, SIGNAL_WEIGHT.rating],
    [COOKED_FREQUENCY, SIGNAL_WEIGHT.cooked],
  ]);
  assert.equal(pairs.length, 0);
});

test('older signals fade', () => {
  const { observations } = observationsFor([
    { kind: 'starter', verdict: 'yes', recipeId: 'light', features: [], at: daysAgo(STYLE_HALF_LIFE_DAYS) },
    { kind: 'starter', verdict: 'yes', recipeId: 'light', features: [], at: daysAgo(2 * STYLE_HALF_LIFE_DAYS) },
  ], platesById, now);
  assert.deepEqual(observations.map((o) => o.weight), [0.5, 0.25]);
});

test('a quiz pair between two dishes with plates', () => {
  const { pairs } = observationsFor([
    { kind: 'pair', choice: 'a', recipeId: 'light', otherRecipeId: 'rich', features: [], at: daysAgo(0) },
    { kind: 'pair', choice: 'b', recipeId: 'light', otherRecipeId: 'unknown', features: [], at: daysAgo(0) },
  ], platesById, now);
  assert.deepEqual(pairs, [{ a: plates.light[0], b: plates.rich[0], choice: 'a', weight: 1 }]);
});

test('from database rows to a model: the quiz, then what they picked, drift it', () => {
  const ids = ['light', 'mid', 'rich'];
  const tasteSignals: TasteSignalRow[] = [
    // The quiz said rich plates are a favourite…
    ...ids.map((id, i) => ({
      user_id: 'u', recipe_id: id, kind: 'starter' as const, value: ['pass', 'yes', 'must'][i], deck_id: null, meal_id: null,
      created_at: daysAgo(300),
    })),
    { user_id: 'u', recipe_id: 'light', other_recipe_id: 'rich', kind: 'pair', value: 'b', deck_id: null, meal_id: null, created_at: daysAgo(300) },
  ];
  const before = styleModelFor(signalsFor('u', { swipes: [], tasteSignals, meals: [] }, () => []), platesById, now);
  assert.ok(before.style(plate(0.9)) > before.style(plate(0.1)) + 1);
  // …since then they keep choosing light ones and rating rich ones "not again".
  const swipes: SwipeRow[] = Array.from({ length: 12 }, (_, i) => ({
    user_id: 'u', deck_id: `d${i}`, recipe_id: 'light', verdict: 'must' as const, created_at: daysAgo(i * 5),
  }));
  const meals: MealRow[] = Array.from({ length: 4 }, (_, i) => ({ id: `m${i}`, recipe_id: 'rich', for_date: daysAgo(i * 7).slice(0, 10), status: 'cooked' }));
  const ratings: TasteSignalRow[] = meals.map((m) => ({
    user_id: 'u', recipe_id: 'rich', kind: 'rating', value: 'not_again', deck_id: null, meal_id: m.id, created_at: daysAgo(1),
  }));
  const after = styleModelFor(signalsFor('u', { swipes, tasteSignals: [...tasteSignals, ...ratings], meals }, () => []), platesById, now);
  assert.ok(after.style(plate(0.1)) > after.style(plate(0.9)) + 1);
  // Someone else's signals don't count.
  const other = styleModelFor(signalsFor('someone else', { swipes, tasteSignals, meals }, () => []), platesById, now);
  assert.equal(other.style(plate(0.9)), other.style(plate(0.1)));
});
