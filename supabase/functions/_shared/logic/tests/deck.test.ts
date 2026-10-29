import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, type CandidateRecipe, type DeckMember, type RecipeHistory } from '../deck.ts';

const recipe = (id: string, over: Partial<CandidateRecipe> = {}): CandidateRecipe => ({
  id, title: id, tags: [], ingredientNames: [], dietClass: 'veg', totalMin: 30,
  kcalPerServing: 600, proteinGPerServing: 40, ...over,
});
const member = (over: Partial<DeckMember> = {}): DeckMember => ({
  userId: 'u', dinnerKcal: 600, dinnerProteinG: 40, never: [], loves: [], diet: 'everything', weights: new Map(), ...over,
});
const fixed = () => 0;

test('hard filters: never list, diet, time, recently cooked', () => {
  const recipes = [
    recipe('mushroom risotto', { ingredientNames: ['mushrooms', 'rice'] }),
    recipe('steak', { dietClass: 'meat' }),
    recipe('salmon', { dietClass: 'fish' }),
    recipe('slow stew', { totalMin: 180 }),
    recipe('dal'),
    recipe('tacos'),
  ];
  const deck = buildDeck(recipes, [member({ never: ['mushroom'] }), member({ userId: 'v', diet: 'pescatarian' })],
    new Map(), { maxMinutes: 45, recentlyCooked: new Set(['tacos']), random: fixed });
  assert.deepEqual(deck.map((c) => c.recipeId).sort(), ['dal', 'salmon']);
});

test('a never rule on an optional line keeps the recipe', () => {
  const recipes = [
    recipe('chana masala', { ingredientNames: ['chickpeas', 'fresh coriander'], productIds: ['p-chickpeas', 'p-coriander'],
      optionalNames: ['fresh coriander'], optionalProductIds: ['p-coriander'] }),
    recipe('green chutney', { ingredientNames: ['fresh coriander'], productIds: ['p-coriander'] }),
  ];
  for (const m of [member({ never: ['coriander'] }), member({ neverProducts: ['p-coriander'] })]) {
    assert.deepEqual(buildDeck(recipes, [m], new Map(), { random: fixed }).map((c) => c.recipeId), ['chana masala']);
  }
});

test('mixes known and new, spreads new cards, ranks by score', () => {
  const recipes = Array.from({ length: 30 }, (_, i) => recipe(`r${i}`, { proteinGPerServing: 40 - i }));
  const history = new Map<string, RecipeHistory>();
  for (let i = 0; i < 15; i++) history.set(`r${i}`, { yes: 1, pass: 0, cooked: 0 });
  const deck = buildDeck(recipes, [member()], history, { random: fixed });
  assert.equal(deck.length, 12);
  assert.equal(deck.filter((c) => c.known).length, 8);
  assert.equal(deck.filter((c) => !c.known).length, 4);
  assert.deepEqual(deck.map((c) => c.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(deck[0].recipeId, 'r0'); // best fit known card first
  const newPositions = deck.filter((c) => !c.known).map((c) => c.position);
  assert.deepEqual(newPositions, [2, 5, 8, 11]);
});

test('fills from the other pool when one is short', () => {
  const recipes = Array.from({ length: 5 }, (_, i) => recipe(`r${i}`));
  const deck = buildDeck(recipes, [member()], new Map(), { random: fixed });
  assert.equal(deck.length, 5);
});

test('preferences, loves, mood and pantry lift a card', () => {
  const recipes = [recipe('plain'), recipe('bowl', { tags: ['bowl', 'light'], ingredientNames: ['spinach'] })];
  const deck = buildDeck(recipes, [member({ loves: ['bowl'], weights: new Map([['spinach', 0.8]]) })], new Map(),
    { mood: 'light', pantry: ['spinach'], random: fixed });
  assert.equal(deck.find((c) => !c.known && c.recipeId === 'bowl')!.reason, 'pantry:spinach');
  const scores = Object.fromEntries(deck.map((c) => [c.recipeId, c.score]));
  assert.ok(scores.bowl > scores.plain);
});

test('rules on catalogue items match the recipe’s ingredient products', () => {
  const recipes = [
    recipe('champignons', { productIds: ['p-mushroom', 'p-rice'] }),
    recipe('saumon', { productIds: ['p-salmon'] }),
    recipe('plain', { productIds: ['p-rice'] }),
  ];
  const deck = buildDeck(recipes, [member({ neverProducts: ['p-mushroom'], loveProducts: ['p-salmon'] })], new Map(), { random: fixed });
  assert.ok(!deck.some((c) => c.recipeId === 'champignons'));
  const scores = Object.fromEntries(deck.map((c) => [c.recipeId, c.score]));
  assert.ok(scores.saumon > scores.plain);
});
