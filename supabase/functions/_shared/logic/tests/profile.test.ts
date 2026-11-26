import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProfile, signalsFor, occasionalKinds, pickStarterSet, profileHighlights, signalWeight, type Signal } from '../profile.ts';
import type { RecipeClassification } from '../classify.ts';

const now = Date.UTC(2026, 5, 1);
const at = (daysAgo = 0) => new Date(now - daysAgo * 86_400_000).toISOString();

test('signals weigh by what they say', () => {
  const f = ['dish:curry', 'intent:comfort'];
  assert.equal(signalWeight({ kind: 'swipe', verdict: 'must', features: f, at: at() }).weight, 1.5);
  assert.equal(signalWeight({ kind: 'starter', verdict: 'yes', features: f, at: at() }).weight, 0.75);
  assert.equal(signalWeight({ kind: 'rating', rating: 'not_again', features: f, at: at() }).weight, -2);
  assert.equal(signalWeight({ kind: 'cooked', features: f, at: at() }).weight, 0.5);
  // Passing for tonight's reasons says nothing about the dish.
  assert.equal(signalWeight({ kind: 'swipe', verdict: 'pass', reason: 'too_long', features: f, at: at() }).weight, 0);
  // A mood deck halves a pass and leaves out the dish's mood…
  const moody = signalWeight({ kind: 'swipe', verdict: 'pass', mood: 'light', features: f, at: at() });
  assert.deepEqual(moody, { weight: -0.2, features: ['dish:curry'] });
  // …unless the person said it's not for them.
  assert.deepEqual(signalWeight({ kind: 'swipe', verdict: 'pass', mood: 'light', reason: 'not_for_me', features: f, at: at() }),
    { weight: -1, features: f });
});

test('a filtered deck: a pass counts half and says nothing about what was filtered on', () => {
  const f = ['protein:poultry', 'japanese', 'asian', 'dish:curry'];
  assert.deepEqual(signalWeight({ kind: 'swipe', verdict: 'pass', filters: { proteins: ['chicken'], cuisines: ['japanese'] }, features: f, at: at() }),
    { weight: -0.2, features: ['dish:curry'] });
  assert.deepEqual(signalWeight({ kind: 'swipe', verdict: 'yes', filters: { proteins: ['chicken'] }, features: f, at: at() }),
    { weight: 1, features: ['japanese', 'asian', 'dish:curry'] });
});

test('a yes says far more than a pass: as many passes as yeses still read as a like', () => {
  assert.equal(signalWeight({ kind: 'swipe', verdict: 'pass', features: ['dish:curry'], at: at() }).weight, -0.4);
  const signals: Signal[] = [];
  for (let i = 0; i < 4; i++) {
    signals.push({ kind: 'swipe', verdict: 'yes', features: ['dish:curry'], at: at(i) });
    signals.push({ kind: 'swipe', verdict: 'pass', features: ['dish:curry'], at: at(i) });
  }
  assert.ok(buildProfile(signals, now).get('dish:curry')!.weight > 0.2);
  // And passes alone never make a strong dislike; only "not for me" or a rating does.
  const passes: Signal[] = Array.from({ length: 20 }, (_, i) => ({ kind: 'swipe', verdict: 'pass', features: ['dish:soup'], at: at(i) }));
  assert.ok(buildProfile(passes, now).get('dish:soup')!.weight > -0.4);
});

test('a rating after eating outweighs a swipe; old signals fade', () => {
  const p = buildProfile([
    { kind: 'swipe', verdict: 'yes', features: ['sauce:coconut'], at: at() },
    { kind: 'rating', rating: 'not_again', features: ['sauce:coconut'], at: at() },
    { kind: 'swipe', verdict: 'pass', features: ['dish:salad'], at: at(360) },
    { kind: 'swipe', verdict: 'pass', features: ['dish:soup'], at: at() },
  ], now);
  assert.ok(p.get('sauce:coconut')!.weight < 0);
  assert.equal(p.get('sauce:coconut')!.evidence, 2);
  assert.ok(Math.abs(p.get('dish:salad')!.weight) < Math.abs(p.get('dish:soup')!.weight));
});

test('highlights need repeated evidence', () => {
  const signals: Signal[] = [];
  for (let i = 0; i < 3; i++) signals.push({ kind: 'swipe', verdict: 'yes', features: ['heat:2+'], at: at(i) });
  signals.push({ kind: 'swipe', verdict: 'pass', features: ['dish:salad'], at: at() });
  for (let i = 0; i < 3; i++) signals.push({ kind: 'starter', verdict: 'pass', features: ['protein:lamb'], at: at(i) });
  const h = profileHighlights(buildProfile(signals, now));
  assert.deepEqual(h.likes.map((x) => x.feature), ['heat:2+']);
  assert.deepEqual(h.dislikes.map((x) => x.feature), ['protein:lamb']);
});

const c = (over: Partial<RecipeClassification>): RecipeClassification => ({
  version: 1, cuisines: [], protein_groups: [], starch_bases: [], dish_families: ['plated'], sauce_families: [],
  cooking_methods: [], heat_level: 0, heat_adjustable: false, sauce_level: 1,
  nutrition: { kcal: 500, protein_g: 30, fat_g: 20, carbs_g: 50, fiber_g: 5, estimated: false },
  nutrition_goals: [], meal_intents: [], sourced: [], ...over,
});

test('the starter set varies proteins, dishes and heat before repeating them', () => {
  const recipes = [
    { id: 'chicken stew 1', classification: c({ protein_groups: ['poultry'], dish_families: ['stew'] }) },
    { id: 'chicken stew 2', classification: c({ protein_groups: ['poultry'], dish_families: ['stew'] }) },
    { id: 'chicken stew 3', classification: c({ protein_groups: ['poultry'], dish_families: ['stew'] }) },
    { id: 'fish curry', classification: c({ protein_groups: ['fish'], dish_families: ['curry'], heat_level: 3 }) },
    { id: 'lentil soup', classification: c({ protein_groups: ['legumes'], dish_families: ['soup'] }) },
  ];
  const picked = pickStarterSet(recipes, 3, () => 0).map((r) => r.id);
  assert.equal(picked.length, 3);
  assert.ok(picked.includes('fish curry') && picked.includes('lentil soup'));
  assert.equal(picked.filter((id) => id.startsWith('chicken')).length, 1);
});

test('"I like it, but not often" is a like, and makes the kind of dish occasional', () => {
  const at = new Date().toISOString();
  const signals: Signal[] = [
    { kind: 'starter', verdict: 'sometimes', features: ['dish:pizza', 'cheese'], at, recipeId: 'r1' },
    { kind: 'starter', verdict: 'yes', features: ['dish:curry'], at, recipeId: 'r2' },
  ];
  assert.ok(buildProfile(signals).get('dish:pizza')!.weight > 0);
  assert.deepEqual([...occasionalKinds(signals)].sort(), ['dish:pizza', 'recipe:r1']);
});

test('quiz pairs are read with both dishes, and only style learns from them', () => {
  const signals = signalsFor('u', {
    swipes: [], meals: [],
    tasteSignals: [{
      user_id: 'u', recipe_id: 'a', other_recipe_id: 'b', kind: 'pair', value: 'either', deck_id: null, meal_id: null, created_at: at(),
    }],
  }, () => ['dish:curry']);
  assert.deepEqual(signals, [{ kind: 'pair', choice: 'either', recipeId: 'a', otherRecipeId: 'b', features: ['dish:curry'], at: at() }]);
  assert.equal(signalWeight(signals[0]).weight, 0);
  assert.equal(buildProfile(signals).size, 0);
});

test('household stars: each person who ate the dish learns them once; an unrated meal says nothing', () => {
  const meals = [
    { id: 'm1', recipe_id: 'risotto', for_date: '2026-05-20', status: 'planned', who_eating: ['lisa', 'dario'] },
    { id: 'm2', recipe_id: 'risotto', for_date: '2026-05-25', status: 'cooked', who_eating: ['lisa'] },
    { id: 'm3', recipe_id: 'dal', for_date: '2026-05-26', status: 'cooked', who_eating: ['lisa', 'dario'] },
    { id: 'm4', recipe_id: 'curry', for_date: '2026-05-27', status: 'skipped', who_eating: ['lisa', 'dario'] },
    // Tomorrow's plan isn't eaten yet.
    { id: 'm5', recipe_id: 'curry', for_date: '2026-06-02', status: 'planned', who_eating: ['lisa', 'dario'] },
  ];
  const ratings = [
    { recipe_id: 'risotto', stars: 4, rated_at: at(1) },
    { recipe_id: 'curry', stars: 1, rated_at: at(1) },
    { recipe_id: 'pho', stars: null, rated_at: null },
  ];
  // Rated before the stars, one meal at a time: still counts, unless the dish now has stars.
  const tasteSignals = [
    { user_id: 'dario', recipe_id: 'risotto', kind: 'rating' as const, value: 'loved', deck_id: null, meal_id: 'm1', created_at: at(10) },
  ];
  const rows = { swipes: [], tasteSignals, meals, ratings, today: '2026-06-01' };
  const of = (who: string) => signalsFor(who, rows, () => ['x']).map((s) => (s.kind === 'rating'
    ? `rating:${s.recipeId}:${s.stars}:${s.rating}` : s.kind === 'cooked' ? `cooked:${s.mealId}` : s.kind)).sort();
  // Lisa ate the risotto twice (the past plan counts as eaten); the dal is unrated, so it says nothing.
  assert.deepEqual(of('lisa'), ['cooked:m1', 'cooked:m2', 'rating:risotto:4:fine']);
  // Dario only had the first risotto; his old per-meal rating gives way to the household's stars.
  assert.deepEqual(of('dario'), ['cooked:m1', 'rating:risotto:4:fine']);
  // Without the household's ratings (before the stars), every cooked meal counts.
  const before = signalsFor('lisa', { swipes: [], tasteSignals: [], meals }, () => ['x']).map((s) => s.kind === 'cooked' && s.mealId);
  assert.deepEqual(before, ['m2', 'm3']);
});
