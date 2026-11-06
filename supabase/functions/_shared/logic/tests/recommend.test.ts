import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, type CandidateRecipe, type DeckMember } from '../deck.ts';
import { buildProfile, type Signal } from '../profile.ts';
import { diversePick, dietAdherence, fitWeight, similarity, tasteScore, uncertainty } from '../recommend.ts';

const now = Date.UTC(2026, 10, 1);
const at = (daysAgo = 0) => new Date(now - daysAgo * 86_400_000).toISOString();

const cheesyPasta = ['dish:pasta_dish', 'sauce:cheese', 'starch:pasta', 'protein:dairy', 'intent:comfort', 'intent:indulgent'];
const leanFish = ['dish:plated', 'protein:fish', 'sauce:citrus', 'goal:lean', 'goal:high_protein', 'intent:light'];
const leanChicken = ['dish:plated', 'protein:poultry', 'sauce:citrus', 'goal:lean', 'goal:high_protein', 'intent:light'];

/** Someone who minds their diet: says yes to what fits, passes on what doesn't. */
function dieter(extra: Signal[] = []): Signal[] {
  const s: Signal[] = [];
  for (let i = 0; i < 8; i++) {
    s.push({ kind: 'swipe', verdict: 'yes', features: i % 2 ? leanFish : leanChicken, fits: true, at: at(i) });
    s.push({ kind: 'swipe', verdict: 'pass', features: cheesyPasta, fits: false, at: at(i) });
  }
  return [...s, ...extra];
}

test('passing on off-diet dishes is the diet talking, not a dislike of the dish', () => {
  const p = buildProfile(dieter(), now);
  // Cheese and pasta: mildly negative at most, nowhere near a dislike…
  assert.ok(p.get('sauce:cheese')!.weight > -0.6);
  // …and much weaker than the same passes on dishes that fit.
  const plain = buildProfile(dieter().map((x) => (x.kind === 'swipe' && x.verdict === 'pass' ? { ...x, fits: true } : x)), now);
  assert.ok(p.get('sauce:cheese')!.weight > plain.get('sauce:cheese')!.weight + 0.2);
  // Diet features aren't learned from the deck at all: the deck already ranks on fit.
  assert.equal(p.get('goal:lean'), undefined);
  assert.equal(p.get('intent:indulgent'), undefined);
});

test('a rating after eating says what tastes good, diet features included', () => {
  const p = buildProfile(dieter([
    { kind: 'rating', rating: 'loved', features: cheesyPasta, at: at() },
    { kind: 'rating', rating: 'loved', features: cheesyPasta, at: at(20) },
  ]), now);
  assert.ok(p.get('sauce:cheese')!.weight > 0);
  assert.ok(p.get('intent:indulgent')!.weight > 0);
});

test('a yes on something off-plan counts more', () => {
  const p = buildProfile([
    { kind: 'swipe', verdict: 'yes', features: ['sauce:cheese'], fits: false, at: at() },
    { kind: 'swipe', verdict: 'yes', features: ['sauce:tomato'], fits: true, at: at() },
  ], now);
  assert.ok(p.get('sauce:cheese')!.weight > p.get('sauce:tomato')!.weight);
});

test('adherence: how much someone sticks to their goals, 0.5 until it shows', () => {
  assert.equal(dietAdherence([]), 0.5);
  assert.ok(dietAdherence(dieter()) > 0.7);
  const relaxed: Signal[] = [];
  for (let i = 0; i < 8; i++) {
    relaxed.push({ kind: 'swipe', verdict: 'yes', features: leanFish, fits: true, at: at(i) });
    relaxed.push({ kind: 'swipe', verdict: 'yes', features: cheesyPasta, fits: false, at: at(i) });
  }
  assert.ok(dietAdherence(relaxed) < 0.3);
  assert.ok(fitWeight(dietAdherence(dieter())) > fitWeight(dietAdherence(relaxed)));
});

test('taste is averaged per kind of feature, so long ingredient lists are not louder', () => {
  const p = buildProfile([{ kind: 'swipe', verdict: 'yes', features: ['dish:curry', 'coconut milk'], at: at() }], now);
  const short = tasteScore(['dish:curry', 'coconut milk'], p);
  const long = tasteScore(['dish:curry', 'coconut milk', 'a', 'b', 'c', 'd', 'e', 'f', 'g'], p);
  assert.ok(short > 0 && long > 0);
  assert.ok(long >= short * 0.6); // diluted by at most three unknowns
});

test('uncertainty is high for kinds of dishes never seen', () => {
  const p = buildProfile(dieter(), now);
  assert.ok(uncertainty(['dish:soup', 'protein:legumes'], p) > uncertainty(leanFish, p));
  assert.equal(uncertainty(['dish:soup'], new Map()), 1);
});

test('diverse picks: a near-copy of a picked dish waits its turn', () => {
  const items = [
    { id: 'stew 1', f: ['dish:stew', 'protein:poultry'], s: 3 },
    { id: 'stew 2', f: ['dish:stew', 'protein:poultry'], s: 2.9 },
    { id: 'curry', f: ['dish:curry', 'protein:fish'], s: 2.5 },
  ];
  assert.equal(similarity(items[0].f, items[1].f), 1);
  assert.deepEqual(diversePick(items, 2, (x) => x.s, (x) => x.f).map((x) => x.id), ['stew 1', 'curry']);
});

const recipe = (id: string, features: string[], kcal: number, over: Partial<CandidateRecipe> = {}): CandidateRecipe => ({
  id, title: id, tags: [], ingredientNames: [], dietClass: 'veg', totalMin: 30, kcalPerServing: kcal, proteinGPerServing: 40,
  features, ...over,
});

test('a deck for someone who minds their diet still has a treat they would love', () => {
  const signals = dieter([{ kind: 'rating', rating: 'loved', features: cheesyPasta, at: at(5) }]);
  const member: DeckMember = {
    userId: 'u', dinnerKcal: 600, dinnerProteinG: 40, never: [], loves: [], diet: 'everything', weights: new Map(),
    profile: buildProfile(signals, now), adherence: dietAdherence(signals),
  };
  const recipes: CandidateRecipe[] = [
    ...Array.from({ length: 12 }, (_, i) => recipe(`lean ${i}`, i % 2 ? leanFish : leanChicken, 600)),
    recipe('mac and cheese', cheesyPasta, 1100),
    recipe('something meh', ['dish:salad', 'protein:legumes'], 1100),
  ];
  const deck = buildDeck(recipes, [member], new Map(), { size: 6, random: () => 0 });
  assert.equal(deck.length, 6);
  const treat = deck.find((c) => c.recipeId === 'mac and cheese');
  assert.ok(treat, 'the treat is in the deck');
  assert.equal(treat!.reason, 'treat');
  assert.ok(!deck.some((c) => c.recipeId === 'something meh'));
  // Mostly what fits.
  assert.ok(deck.filter((c) => c.recipeId.startsWith('lean')).length >= 4);
});

test('no treat slot for someone who does not mind their diet', () => {
  const member: DeckMember = {
    userId: 'u', dinnerKcal: 600, dinnerProteinG: 40, never: [], loves: [], diet: 'everything', weights: new Map(),
    profile: new Map(), adherence: 0.2,
  };
  const deck = buildDeck([recipe('a', leanFish, 600), recipe('b', cheesyPasta, 1100)], [member], new Map(), { size: 1, random: () => 0 });
  assert.equal(deck[0].reason, null);
});
