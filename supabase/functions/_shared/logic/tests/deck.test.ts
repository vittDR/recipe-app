import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeck, type CandidateRecipe, type DeckMember, FREQUENCY_OUT, FREQUENCY_REGULAR, nowAndThenShare, type RecipeHistory,
  scoreRecipe, softmin, STYLE_FIT_FACTOR,
} from '../deck.ts';
import type { Plate } from '../plate.ts';
import { fitStyle } from '../style.ts';

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
    recipe('mushroom risotto', { ingredientNames: ['mushrooms', 'rice'], productIds: ['p-mushroom', 'p-rice'] }),
    recipe('steak', { dietClass: 'meat' }),
    recipe('salmon', { dietClass: 'fish' }),
    recipe('slow stew', { totalMin: 180 }),
    recipe('dal'),
    recipe('tacos'),
  ];
  const deck = buildDeck(recipes, [member({ never: ['p-mushroom'] }), member({ userId: 'v', diet: 'pescatarian' })],
    new Map(), { maxMinutes: 45, recentlyCooked: new Set(['tacos']), random: fixed });
  assert.deepEqual(deck.map((c) => c.recipeId).sort(), ['dal', 'salmon']);
});

test('advanced filters are hard filters; a recipe that can\'t be read is left out of a filtered deck', () => {
  const facets = (proteins: ('chicken' | 'prawns')[]) => ({ proteins, cuisines: [], bases: [], heat: 0 });
  const recipes = [recipe('teriyaki chicken', { facets: facets(['chicken']) }), recipe('prawn curry', { facets: facets(['prawns']) }), recipe('unread')];
  const ids = (filters: object) => buildDeck(recipes, [member()], new Map(), { filters, random: fixed }).map((c) => c.recipeId).sort();
  assert.deepEqual(ids({ proteins: ['chicken'] }), ['teriyaki chicken']);
  assert.deepEqual(ids({ proteins: ['chicken', 'prawns'] }), ['prawn curry', 'teriyaki chicken']);
  assert.deepEqual(ids({}), ['prawn curry', 'teriyaki chicken', 'unread']);
});

test('a never rule on an optional line keeps the recipe', () => {
  const recipes = [
    recipe('chana masala', { ingredientNames: ['chickpeas', 'fresh coriander'], productIds: ['p-chickpeas', 'p-coriander'],
      optionalProductIds: ['p-coriander'] }),
    recipe('green chutney', { ingredientNames: ['fresh coriander'], productIds: ['p-coriander'] }),
  ];
  assert.deepEqual(buildDeck(recipes, [member({ never: ['p-coriander'] })], new Map(), { random: fixed }).map((c) => c.recipeId),
    ['chana masala']);
});

test('12 cards: 5 very close, 5 close, 2 wildcards at a third and three quarters in', () => {
  const recipes = Array.from({ length: 30 }, (_, i) => recipe(`r${i}`, { proteinGPerServing: 40 - i }));
  const history = new Map<string, RecipeHistory>();
  for (let i = 0; i < 15; i++) history.set(`r${i}`, { yes: 1, pass: 0, cooked: 0 });
  const deck = buildDeck(recipes, [member()], history, { random: fixed });
  assert.equal(deck.length, 12);
  assert.deepEqual(deck.map((c) => c.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(deck.filter((c) => c.tier === 'close').length, 5);
  assert.equal(deck.filter((c) => c.tier === 'near').length, 5);
  const wild = deck.filter((c) => c.tier === 'wild');
  assert.deepEqual(wild.map((c) => c.position), [5, 10]);
  // Every recipe not chosen before misses the protein goal here, so wildcards fall back to known ones that fit.
  assert.ok(wild.every((c) => c.reason === 'wildcard' && c.fitScore >= 0.7));
  assert.equal(deck[0].recipeId, 'r0'); // best fit first
  assert.equal(deck[0].tier, 'close');
});

test('very close cards suit everyone; close ones may lean to one person', () => {
  const both = ['dish:curry'];
  const anna = ['dish:salad'];
  const boris = ['dish:stew'];
  const recipes = [
    ...Array.from({ length: 6 }, (_, i) => recipe(`curry ${i}`, { features: [...both, `sauce:s${i}`] })),
    ...Array.from({ length: 6 }, (_, i) => recipe(`salad ${i}`, { features: [...anna, `sauce:t${i}`] })),
    ...Array.from({ length: 6 }, (_, i) => recipe(`other ${i}`, { features: [`dish:d${i}`] })),
  ];
  const w = (pairs: [string, number][]) => new Map(pairs);
  const members = [
    member({ userId: 'anna', weights: w([['dish:curry', 0.8], ['dish:salad', 0.9]]) }),
    member({ userId: 'boris', weights: w([['dish:curry', 0.8], ['dish:salad', 0], [boris[0], 0.5]]) }),
  ];
  const deck = buildDeck(recipes, members, new Map(), { random: fixed });
  const close = deck.filter((c) => c.tier === 'close');
  assert.ok(close.every((c) => c.recipeId.startsWith('curry')), 'liked by both');
  const leaning = deck.filter((c) => c.reason === 'leans:anna');
  assert.ok(leaning.length > 0 && leaning.every((c) => c.tier === 'near' && c.recipeId.startsWith('salad')));
});

test('wildcards fit the goals and nobody dislikes them', () => {
  const recipes = [
    ...Array.from({ length: 10 }, (_, i) => recipe(`fav ${i}`, { features: ['dish:curry', `sauce:s${i}`] })),
    recipe('huge', { kcalPerServing: 1500, features: ['dish:pie'] }),
    recipe('disliked', { features: ['dish:soup'] }),
    recipe('fresh a', { features: ['dish:salad'] }),
    recipe('fresh b', { features: ['dish:tacos'] }),
  ];
  const m = member({ weights: new Map([['dish:curry', 1], ['dish:soup', -1]]) });
  const history = new Map<string, RecipeHistory>(Array.from({ length: 10 }, (_, i) => [`fav ${i}`, { yes: 1, pass: 0, cooked: 0 }]));
  const wild = buildDeck(recipes, [m], history, { random: fixed }).filter((c) => c.tier === 'wild').map((c) => c.recipeId);
  assert.deepEqual(wild.sort(), ['fresh a', 'fresh b']); // new to the household, fit the goals, not disliked
});

test('fills from the other pool when one is short', () => {
  const recipes = Array.from({ length: 5 }, (_, i) => recipe(`r${i}`));
  const deck = buildDeck(recipes, [member()], new Map(), { random: fixed });
  assert.equal(deck.length, 5);
});

test('preferences, loves, mood and pantry lift a card', () => {
  const recipes = [recipe('plain'), recipe('bowl', { tags: ['bowl', 'light'], ingredientNames: ['spinach'], productIds: ['p-spinach'] })];
  const deck = buildDeck(recipes, [member({ loves: ['p-spinach'], weights: new Map([['spinach', 0.8]]) })], new Map(),
    { mood: 'light', pantry: ['spinach'], random: fixed });
  assert.equal(deck.find((c) => !c.known && c.recipeId === 'bowl')!.reason, 'pantry:spinach');
  const scores = Object.fromEntries(deck.map((c) => [c.recipeId, c.score]));
  assert.ok(scores.bowl > scores.plain);
});

test('rules are catalogue items: they match the recipe’s ingredient products, not its words', () => {
  const recipes = [
    recipe('champignons', { productIds: ['p-mushroom', 'p-rice'] }),
    recipe('saumon', { productIds: ['p-salmon'] }),
    recipe('plain', { productIds: ['p-rice'] }),
  ];
  const deck = buildDeck(recipes, [member({ never: ['p-mushroom'], loves: ['p-salmon'] })], new Map(), { random: fixed });
  assert.ok(!deck.some((c) => c.recipeId === 'champignons'));
  const scores = Object.fromEntries(deck.map((c) => [c.recipeId, c.score]));
  assert.ok(scores.saumon > scores.plain);
  // A title or tag that says "mushroom" is not the item.
  const named = [recipe('mushroom-style tofu', { tags: ['mushroom'], productIds: ['p-tofu'] })];
  assert.equal(buildDeck(named, [member({ never: ['p-mushroom'] })], new Map(), { random: fixed }).length, 1);
});

test('moods match on what the dish is for when it is classified', () => {
  const recipes = [
    recipe('curry', { tags: ['curry'], intents: ['light'] }),
    recipe('roast', { intents: ['comfort'] }),
  ];
  const deck = buildDeck(recipes, [member()], new Map(), { mood: 'comfort', random: fixed, size: 1, newShare: 1 });
  assert.equal(deck[0].recipeId, 'roast');
});

test('healthy mood: dishes healthy by composition come first', () => {
  const recipes = [recipe('lasagne', { intents: ['comfort'] }), recipe('pot-au-feu', { healthy: true })];
  const deck = buildDeck(recipes, [member()], new Map(), { mood: 'healthy', random: fixed, size: 1, newShare: 1 });
  assert.equal(deck[0].recipeId, 'pot-au-feu');
});

test('features given by the caller drive preference scoring', () => {
  const recipes = [recipe('a', { features: ['sauce:coconut'] }), recipe('b', { features: ['sauce:tomato'] })];
  const deck = buildDeck(recipes, [member({ weights: new Map([['sauce:coconut', -1]]) })], new Map(), { random: fixed, size: 1, newShare: 1 });
  assert.equal(deck[0].recipeId, 'b');
});

test('after a no-match: the failed cards are left out and liked features lift a card', () => {
  const recipes = [
    recipe('failed', { features: ['protein:chicken'] }),
    recipe('chicken curry', { features: ['protein:chicken', 'dish:curry', 'cuisine:indian'] }),
    recipe('tofu salad', { features: ['protein:tofu', 'dish:salad'] }),
  ];
  const deck = buildDeck(recipes, [member()], new Map(), {
    exclude: new Set(['failed']), lean: new Set(['protein:chicken', 'dish:curry']), random: fixed,
  });
  assert.deepEqual(deck.map((c) => c.recipeId), ['chicken curry', 'tofu salad']);
});

test('allergies rule out a recipe on any line, optional or staple', () => {
  const recipes = [
    recipe('pesto pasta', { ingredientNames: ['pasta'], allIngredients: ['pasta', 'pesto'] }),
    recipe('salad', { ingredientNames: ['lettuce'], allIngredients: ['lettuce', 'parmesan'] }),
    recipe('rice', { ingredientNames: ['rice'], allIngredients: ['rice'] }),
  ];
  const deck = buildDeck(recipes, [member({ allergies: ['pesto', 'parmesan'] }), member({ userId: 'v' })], new Map(), { random: fixed });
  assert.deepEqual(deck.map((c) => c.recipeId), ['rice']);
});

test('"not often" dishes: one per deck at most, none when one of the kind was eaten lately', () => {
  const recipes = [
    recipe('margherita', { features: ['dish:pizza'] }),
    recipe('calzone', { features: ['dish:pizza'] }),
    recipe('dal', { features: ['dish:curry'] }),
  ];
  const m = member({ occasional: new Set(['dish:pizza']) });
  const ids = buildDeck(recipes, [m], new Map(), { random: fixed }).map((c) => c.recipeId);
  assert.equal(ids.filter((id) => id === 'margherita' || id === 'calzone').length, 1);
  assert.ok(ids.includes('dal'));
  const later = buildDeck(recipes, [m], new Map(), { random: fixed, recentKinds: new Set(['dish:pizza']) }).map((c) => c.recipeId);
  assert.deepEqual(later, ['dal']);
});

test('season: at least 3 of 12 cards are dishes of the season, and out-of-season dishes rank lower', async () => {
  const { seasonFit } = await import('../deck.ts');
  assert.equal(seasonFit({ seasons: ['summer'] }, 'summer'), 1);
  assert.equal(seasonFit({ seasons: ['summer', 'autumn'] }, 'winter'), -1);
  assert.equal(seasonFit({ seasons: ['spring', 'summer', 'autumn', 'winter'] }, 'winter'), 0);
  assert.equal(seasonFit({ seasons: null }, 'winter'), 0);
  assert.equal(seasonFit({ seasons: ['summer'] }, undefined), 0);

  // All-year dishes fit the goals better, so on taste and fit alone no seasonal dish would make it.
  const recipes = [
    ...Array.from({ length: 20 }, (_, i) => recipe(`all-year ${i}`, { features: [`dish:d${i}`] })),
    ...Array.from({ length: 5 }, (_, i) => recipe(`summer ${i}`, { seasons: ['summer'], proteinGPerServing: 20, features: [`sauce:s${i}`] })),
    ...Array.from({ length: 5 }, (_, i) => recipe(`winter ${i}`, { seasons: ['winter'], proteinGPerServing: 20, features: [`starch:w${i}`] })),
  ];
  const inSummer = buildDeck(recipes, [member()], new Map(), { random: fixed, season: 'summer' });
  assert.equal(inSummer.length, 12);
  const summerCards = inSummer.filter((c) => c.recipeId.startsWith('summer'));
  assert.ok(summerCards.length >= 3);
  assert.ok(summerCards.some((c) => c.reason === 'season'));
  assert.equal(inSummer.filter((c) => c.recipeId.startsWith('winter')).length, 0);
  assert.equal(inSummer.filter((c) => c.tier === 'wild').length, 2);

  const inWinter = buildDeck(recipes, [member()], new Map(), { random: fixed, season: 'winter' });
  assert.ok(inWinter.filter((c) => c.recipeId.startsWith('winter')).length >= 3);
  // No season: no seasonal rule.
  const anySeason = buildDeck(recipes, [member()], new Map(), { random: fixed });
  assert.ok(anySeason.every((c) => c.reason !== 'season'));
});

test('rotation: recipes dealt lately without being chosen give way, up to a limit', () => {
  const recipes = Array.from({ length: 30 }, (_, i) => recipe(`r${i}`, { proteinGPerServing: 40 - i * 0.1, features: [`dish:d${i}`] }));
  const first = buildDeck(recipes, [member()], new Map(), { random: fixed });
  const shown = new Map(first.map((c) => [c.recipeId, 1]));
  const second = buildDeck(recipes, [member()], new Map(), { random: fixed, recentlyDealt: shown });
  const again = second.filter((c) => shown.has(c.recipeId)).length;
  assert.ok(again < first.length / 2, `${again} of ${first.length} cards came back`);
  assert.notEqual(second[0].recipeId, first[0].recipeId);
  // Dealt many times counts like ROTATION_MAX_DECKS: a strong favourite still comes back.
  const favourite = recipes.map((r, i) => (i === 0 ? { ...r, proteinGPerServing: 40, features: ['dish:fav'] } : r));
  const many = buildDeck(favourite, [member({ weights: new Map([['dish:fav', 3]]) })], new Map(), { random: fixed, recentlyDealt: new Map([['r0', 50]]) });
  assert.ok(many.some((c) => c.recipeId === 'r0'));
});

// ---------------------------------------------------------------------------
// With style models (style.ts)
// ---------------------------------------------------------------------------

const plateOf = (rich: number, protein = 0.5): Plate => ({ protein, rich, veg: 0.6, carb: 0.6 });
/** A model that has heard, several times each, how often this person wants each of these plates. */
const styleOf = (said: [Plate, number][]) =>
  fitStyle(said.flatMap(([plate, y]) => Array.from({ length: 4 }, () => ({ plate, features: [], y }))));
const lean = plateOf(0.1);
const rich = plateOf(0.9);
const mid = plateOf(0.5, 0.9);
/** Mostly lean, rich now and then. */
const balanced = () => styleOf([[lean, 3.6], [rich, 1.2]]);

test('with a style model, how often they want a dish decides; goal fit counts half', () => {
  const recipes = [
    ...Array.from({ length: 10 }, (_, i) => recipe(`lean${i}`, { plates: [lean], kcalPerServing: 900 })),
    ...Array.from({ length: 10 }, (_, i) => recipe(`rich${i}`, { plates: [rich] })),
  ];
  const deck = buildDeck(recipes, [member({ style: balanced() })], new Map(), { size: 6, random: fixed });
  // Lean dishes win although only the rich ones fit the calorie goal.
  assert.ok(deck.filter((c) => c.recipeId.startsWith('lean')).length >= 4);
  const fitting = recipe('fits', { plates: [lean] });
  const heavy = recipe('heavy', { plates: [lean], kcalPerServing: 1200 });
  const gap = (m: DeckMember) => scoreRecipe(fitting, [m], undefined, { random: fixed }).base
    - scoreRecipe(heavy, [m], undefined, { random: fixed }).base;
  assert.ok(Math.abs(gap(member({ style: balanced() })) - STYLE_FIT_FACTOR * gap(member())) < 1e-9);
});

test('"now and then" dishes: as many as the style says, badged as treats', () => {
  const recipes = [
    ...Array.from({ length: 30 }, (_, i) => recipe(`lean${i}`, { plates: [plateOf(0.1, 0.3 + i / 100)] })),
    ...Array.from({ length: 10 }, (_, i) => recipe(`rich${i}`, { plates: [plateOf(0.9, 0.3 + i / 100)] })),
  ];
  const count = (m: DeckMember) => {
    const deck = buildDeck(recipes, [m], new Map(), { random: fixed });
    const f = recipes.map((r) => m.style!.frequency(r.plates!, []));
    const wanted = Math.round(12 * nowAndThenShare(f));
    const occasional = deck.filter((c) => {
      const v = m.style!.frequency(recipes.find((r) => r.id === c.recipeId)!.plates!, []);
      return v >= FREQUENCY_OUT && v < FREQUENCY_REGULAR;
    });
    return { wanted, occasional };
  };
  const mostlyLean = count(member({ style: balanced() }));
  assert.ok(mostlyLean.wanted >= 1);
  assert.equal(mostlyLean.occasional.length, mostlyLean.wanted);
  assert.ok(mostlyLean.occasional.every((c) => c.reason === 'treat' || c.reason === 'wildcard'));
  // Someone who wants rich plates more often (still not regularly) gets more of them.
  const generous = count(member({ style: styleOf([[lean, 3.6], [rich, 1.9]]) }));
  assert.ok(generous.wanted > mostlyLean.wanted);
  assert.equal(generous.occasional.length, generous.wanted);
});

test('shared decks: what works for everyone comes first', () => {
  const recipes = [
    ...Array.from({ length: 6 }, (_, i) => recipe(`rich${i}`, { plates: [plateOf(0.9, 0.3 + i / 50)] })),
    ...Array.from({ length: 6 }, (_, i) => recipe(`lean${i}`, { plates: [plateOf(0.1, 0.3 + i / 50)] })),
    ...Array.from({ length: 6 }, (_, i) => recipe(`both${i}`, { plates: [plateOf(0.5, 0.9 - i / 50)] })),
  ];
  const a = member({ userId: 'a', style: styleOf([[rich, 3.8], [lean, 0.8], [mid, 3.2]]) });
  const b = member({ userId: 'b', style: styleOf([[rich, 0.8], [lean, 3.8], [mid, 3.2]]) });
  const deck = buildDeck(recipes, [a, b], new Map(), { size: 12, random: fixed });
  const close = deck.filter((c) => c.tier === 'close');
  assert.ok(close.length >= 4);
  assert.ok(close.every((c) => c.recipeId.startsWith('both')), close.map((c) => c.recipeId).join());
  assert.ok(softmin([3.8, 0.8]) < 1 && Math.abs(softmin([3, 3]) - (3 - 0.5 * Math.log(2))) < 1e-9);
});

test('a dish someone wants more without its optional lines says so', () => {
  const recipes = [
    recipe('pasta, parmesan on the side', { plates: [rich, lean] }),
    ...Array.from({ length: 5 }, (_, i) => recipe(`other${i}`, { plates: [mid] })),
  ];
  const deck = buildDeck(recipes, [member({ style: balanced() })], new Map(), { size: 4, random: fixed });
  const card = deck.find((c) => c.recipeId === 'pasta, parmesan on the side');
  assert.ok(card);
  assert.equal(card.reason, 'adjustable');
});

test('vegan and vegetarian keep only veg dishes; flexitarian keeps meat but ranks it lower', async () => {
  const { passesHardFilters, scoreRecipe } = await import('../deck.ts');
  const base = { id: 'r', title: 'r', tags: [], ingredientNames: [], totalMin: 30, kcalPerServing: null, proteinGPerServing: null };
  const meat = { ...base, dietClass: 'meat' as const };
  const veg = { ...base, id: 'v', dietClass: 'veg' as const };
  const eater = (diet: 'vegan' | 'flexitarian' | 'everything') => ({
    userId: 'a', dinnerKcal: null, dinnerProteinG: null, servings: 1, never: [], loves: [], diet, weights: new Map(),
  });
  assert.equal(passesHardFilters(meat, [eater('vegan')], {}), false);
  assert.equal(passesHardFilters(veg, [eater('vegan')], {}), true);
  assert.equal(passesHardFilters(meat, [eater('flexitarian')], {}), true);
  const opts = { random: () => 0 };
  const flexi = scoreRecipe(meat, [eater('flexitarian')], undefined, opts).score;
  const omni = scoreRecipe(meat, [eater('everything')], undefined, opts).score;
  assert.ok(flexi < omni);
});
