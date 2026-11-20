import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalFeature, classificationFeatures, classifyRecipe, classifyRow, isHealthy, isVegetable, parseTrait, type ClassifyInput,
} from '../classify.ts';
import { Catalog, type CatalogEntry } from '../ingredients.ts';

const e = (name: string, over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  name, default_aisle: 'other', is_staple: false, kcal_100g: 100, protein_100g: 0,
  fat_100g: 0, carbs_100g: 0, fiber_100g: 0, traits: [], ...over,
});
const catalog = new Catalog([
  e('cod fillet', { kcal_100g: 82, protein_100g: 18, fat_100g: 0.7, traits: ['protein:fish'], diet_class: 'fish' }),
  e('coconut milk', { kcal_100g: 197, protein_100g: 2.2, fat_100g: 21, carbs_100g: 2.8, traits: ['sauce:coconut', 'liquid'] }),
  e('rice', { kcal_100g: 360, protein_100g: 7, fat_100g: 0.6, carbs_100g: 79, fiber_100g: 1.3, traits: ['starch:rice'] }),
  e('chili flakes', { kcal_100g: 318, protein_100g: 12, fat_100g: 17, default_aisle: 'spices', is_staple: true, traits: ['heat:0.9'], grams_per_unit: 1 }),
  e('potato', { kcal_100g: 77, protein_100g: 2, fat_100g: 0.1, carbs_100g: 17, fiber_100g: 2.2, traits: ['starch:potato'] }),
  e('flour', { kcal_100g: 364, protein_100g: 10, fat_100g: 1, carbs_100g: 76, is_staple: true }),
  e('mayonnaise', { kcal_100g: 680, protein_100g: 1, fat_100g: 75, traits: ['sauce:mayonnaise'] }),
  e('vegetable oil', { kcal_100g: 884, fat_100g: 100, is_staple: true }),
  e('parmesan', { kcal_100g: 431, protein_100g: 38, fat_100g: 29, traits: ['protein:dairy', 'sauce:cheese@20'] }),
  e('pasta', { kcal_100g: 371, protein_100g: 13, fat_100g: 1.5, carbs_100g: 75, fiber_100g: 3, traits: ['starch:pasta'] }),
  e('chicken breast', { kcal_100g: 120, protein_100g: 23, fat_100g: 1.5, traits: ['protein:poultry'], diet_class: 'meat' }),
  e('broccoli', { kcal_100g: 34, protein_100g: 2.8, fat_100g: 0.4, fiber_100g: 2.6, default_aisle: 'produce' }),
  e('garlic', { kcal_100g: 149, default_aisle: 'produce' }),
  e('lemon', { kcal_100g: 29, default_aisle: 'produce', traits: ['sauce:citrus'] }),
  e('passata', { kcal_100g: 30, default_aisle: 'pantry', traits: ['sauce:tomato', 'liquid'] }),
  e('cream', { kcal_100g: 340, protein_100g: 2, fat_100g: 36, traits: ['sauce:cream'] }),
  e('mystery'),
]);

const input = (over: Partial<ClassifyInput> & { lines: [string, number | null, string | null, boolean?][] }): ClassifyInput => {
  const { lines, ...rest } = over;
  return {
    titles: ['Untitled'], servings: 2, tags: [], cuisine: null, steps: [], prepMin: 10, cookMin: 20, totalMin: 30,
    difficulty: 'easy', equipment: null,
    ingredients: lines.map(([name, quantity, unit, optional]) => ({ name, quantity, unit, optional, catalog: catalog.find(name) })),
    ...rest,
  };
};

const curry = input({
  titles: ['Goan-style fish curry'], cuisine: 'goan',
  steps: ['Fry the onions.', 'Add the coconut milk and simmer for 10 minutes.'],
  lines: [['cod fillet', 300, 'g'], ['coconut milk', 400, 'ml'], ['rice', 150, 'g'], ['chili flakes', 1, 'tsp']],
});
const fishAndChips = input({
  titles: ['Fish and chips'], tags: ['treat'],
  steps: ['Dust the fish in flour and pan-fry until golden.', 'Bake the chips in the oven.'],
  lines: [['cod fillet', 300, 'g'], ['potato', 500, 'g'], ['flour', 2, 'tbsp'], ['mayonnaise', 40, 'g'], ['vegetable oil', 2, 'tbsp']],
});

test('the same fish, told apart by sauce, starch, method and heat', () => {
  const c = classifyRecipe(curry);
  assert.deepEqual(c.protein_groups, ['fish']);
  assert.deepEqual(c.starch_bases, ['rice']);
  assert.deepEqual(c.dish_families, ['curry']);
  assert.deepEqual(c.sauce_families, ['coconut']);
  assert.deepEqual(c.cooking_methods, ['pan_fried', 'simmered']);
  assert.equal(c.sauce_level, 2); // 200 ml of coconut milk each
  assert.equal(c.heat_level, 1); // 1 tsp of flakes for two: mild
  assert.deepEqual(c.cuisines, ['goan', 'indian', 'asian']);
  assert.ok(c.meal_intents.includes('comfort'));

  const f = classifyRecipe(fishAndChips);
  assert.deepEqual(f.protein_groups, ['fish']);
  assert.deepEqual(f.starch_bases, ['potato']);
  assert.deepEqual(f.dish_families, ['plated']);
  assert.deepEqual(f.sauce_families, ['mayonnaise']);
  assert.deepEqual(f.cooking_methods, ['pan_fried', 'baked']);
  assert.equal(f.heat_level, 0);
  assert.equal(f.sauce_level, 1); // a sauce on the side, no liquid
  assert.ok(f.meal_intents.includes('indulgent')); // from the treat tag
  assert.deepEqual(f.sourced, ['meal_intents']);
});

test('null means unknown, [] means none', () => {
  const unknown = classifyRecipe(input({ lines: [['dragon fruit', 1, 'piece']] }));
  assert.equal(unknown.protein_groups, null);
  assert.equal(unknown.heat_level, null);
  assert.equal(unknown.sauce_level, null);
  assert.deepEqual(unknown.dish_families, ['other']);
  const plain = classifyRecipe(input({ lines: [['potato', 400, 'g']] }));
  assert.deepEqual(plain.protein_groups, []);
  assert.deepEqual(plain.sauce_families, []);
  assert.equal(plain.heat_level, 0);
});

test('optional chilli makes the heat adjustable, not hotter', () => {
  const c = classifyRecipe(input({ lines: [['cod fillet', 300, 'g'], ['chili flakes', 2, 'tsp', true]] }));
  assert.equal(c.heat_level, 0);
  assert.equal(c.heat_adjustable, true);
  assert.equal(classifyRecipe(input({ tags: ['spicy'], lines: [['cod fillet', 300, 'g']] })).heat_level, 2);
});

test('a little cheese is a garnish; enough is the protein and the sauce', () => {
  const garnish = classifyRecipe(input({ lines: [['cod fillet', 300, 'g'], ['parmesan', 10, 'g']] }));
  assert.deepEqual(garnish.protein_groups, ['fish']);
  assert.deepEqual(garnish.sauce_families, []);
  const cacio = classifyRecipe(input({ titles: ['Cacio e pepe'], lines: [['pasta', 200, 'g'], ['parmesan', 80, 'g']] }));
  assert.deepEqual(cacio.protein_groups, ['dairy']); // over a quarter of the protein
  assert.deepEqual(cacio.sauce_families, ['cheese']);
  assert.deepEqual(cacio.dish_families, ['pasta_dish']);
});

test('nutrition goals: lean and high protein from the numbers', () => {
  const c = classifyRecipe(input({ lines: [['cod fillet', 400, 'g'], ['potato', 300, 'g']] }));
  assert.equal(c.nutrition.kcal, 280);
  assert.ok(c.nutrition_goals.includes('high_protein'));
  assert.ok(c.nutrition_goals.includes('lean'));
  assert.ok(c.nutrition_goals.includes('low_kcal'));
  assert.ok(c.meal_intents.includes('fuel'));
  const rich = classifyRecipe(fishAndChips);
  assert.ok(!rich.nutrition_goals.includes('lean'));
});

test('fat is unknown when ingredients without it carry the calories', () => {
  const c = classifyRecipe(input({ lines: [['cod fillet', 100, 'g'], ['mystery', 300, 'g']] }));
  const withoutFat = new Catalog([e('cod fillet', { kcal_100g: 82, protein_100g: 18, fat_100g: null })]);
  const d = classifyRecipe({ ...input({ lines: [] }), ingredients: [{ name: 'cod fillet', quantity: 400, unit: 'g', catalog: withoutFat.find('cod fillet') }] });
  assert.notEqual(c.nutrition.fat_g, null); // mystery has fat_100g 0 in this catalogue
  assert.equal(d.nutrition.fat_g, null);
  assert.ok(!d.nutrition_goals.includes('lean'));
});

test('vegetables: produce that isn\'t a starch, citrus juice or a rich ingredient, plus tinned vegetables', () => {
  assert.ok(isVegetable(catalog.find('broccoli')));
  assert.ok(isVegetable(catalog.find('passata')));
  assert.ok(!isVegetable(catalog.find('potato'))); // a starch
  assert.ok(!isVegetable(catalog.find('garlic'))); // an aromatic
  assert.ok(!isVegetable(catalog.find('lemon'))); // juice
  assert.ok(!isVegetable(catalog.find('coconut milk')));
  assert.equal(classifyRecipe(input({ lines: [['broccoli', 300, 'g'], ['potato', 400, 'g']] })).veg_g, 150);
});

test('healthy is a balanced plate: a protein, vegetables and a base, nothing fried, creamy or cheesy', () => {
  // Chicken breast with a sauce, rice and broccoli, for two: healthy, however big the plate.
  const plate = (lines: [string, number | null, string | null][], over: Partial<ClassifyInput> = {}) => {
    const i = input({ steps: ['Pan-fry the chicken.', 'Boil the rice.', 'Steam the broccoli.'], lines, ...over });
    return isHealthy(i.tags, classifyRecipe(i));
  };
  const chickenRiceBroccoli: [string, number | null, string | null][] = [
    ['chicken breast', 360, 'g'], ['rice', 160, 'g'], ['broccoli', 300, 'g'], ['vegetable oil', 1, 'tbsp'],
  ];
  assert.ok(plate(chickenRiceBroccoli));
  assert.ok(plate(chickenRiceBroccoli.map(([n, q, u]) => [n, q! * 1.5, u]))); // a bigger plate is still healthy
  assert.ok(!plate(chickenRiceBroccoli.filter(([n]) => n !== 'broccoli'))); // no vegetables
  assert.ok(!plate(chickenRiceBroccoli.filter(([n]) => n !== 'rice'))); // no base
  assert.ok(!plate(chickenRiceBroccoli.filter(([n]) => n !== 'chicken breast'))); // no protein
  assert.ok(!plate([...chickenRiceBroccoli, ['cream', 200, 'ml']])); // creamy
  assert.ok(!plate([...chickenRiceBroccoli, ['parmesan', 80, 'g']])); // cheesy
  assert.ok(!plate(chickenRiceBroccoli, { steps: ['Deep-fry the chicken.'] }));
  assert.ok(!plate(chickenRiceBroccoli, { tags: ['treat'] }));
});

test('fresh pasta: a pasta dish made from flour has pasta as its base; flour elsewhere is not a base', () => {
  const starchOf = (titles: string[], lines: [string, number | null, string | null][]) =>
    classifyRecipe(input({ titles, steps: ['Make the dough.', 'Bake in the oven.'], lines })).starch_bases;
  // Lasagne verdi: the sheets are rolled from 130 g of flour for two, plus 40 g in the béchamel.
  const verdi: [string, number | null, string | null][] = [
    ['flour', 130, 'g'], ['flour', 40, 'g'], ['passata', 500, 'ml'], ['parmesan', 50, 'g'],
  ];
  assert.deepEqual(starchOf(['Lasagne verdi alla bolognese'], verdi), ['pasta']);
  assert.deepEqual(starchOf(['Tagliatelle fatte in casa'], [['flour', 200, 'g']]), ['pasta']);
  // Dried sheets: the béchamel's flour adds nothing.
  assert.deepEqual(starchOf(['Spinach and mushroom lasagne'], [['pasta', 120, 'g'], ['flour', 20, 'g']]), ['pasta']);
  // Not a pasta dish, or too little flour to be the dough.
  assert.deepEqual(starchOf(['Fish pie'], [['cod fillet', 300, 'g'], ['flour', 130, 'g']]), []);
  assert.deepEqual(starchOf(['Lasagne'], [['flour', 30, 'g'], ['parmesan', 50, 'g']]), []);
});

test('protein items: the catalogue ingredients the proteins come from, by the same rule', () => {
  const c = classifyRecipe(input({ lines: [['chicken breast', 360, 'g'], ['parmesan', 4, 'g'], ['rice', 160, 'g']] }));
  assert.deepEqual(c.protein_groups, ['poultry']);
  assert.deepEqual(c.protein_items, ['chicken breast']); // a sprinkle of parmesan isn't one
  assert.equal(classifyRecipe(input({ lines: [['dragon fruit leather', 100, 'g']] })).protein_items, null); // nothing could be read
});

test('a deep frying pan or an air fryer is not deep-frying', () => {
  const methods = (step: string) => classifyRecipe(input({ steps: [step], lines: [['cod fillet', 200, 'g']] })).cooking_methods;
  assert.ok(!methods('Soften the onion in a deep frying pan.').includes('deep_fried'));
  assert.ok(!methods('Air-fry the cod for 12 minutes.').includes('deep_fried'));
  assert.ok(!methods('Faites cuire à la friteuse à air 12 minutes.').includes('deep_fried'));
  assert.ok(methods('Deep-fry the cod until golden.').includes('deep_fried'));
});

test('stir-fry is not also pan-frying; roast wins over baked', () => {
  const c = classifyRecipe(input({ steps: ['Stir-fry the beef in a wok.'], lines: [['cod fillet', 200, 'g']] }));
  assert.deepEqual(c.cooking_methods, ['stir_fried']);
  const r = classifyRecipe(input({ steps: ['Preheat the oven.', 'Roast for 40 minutes.'], equipment: { pots: 1, oven: true, special: [] }, lines: [['potato', 400, 'g']] }));
  assert.deepEqual(r.cooking_methods, ['roasted']);
  const tagged = classifyRecipe(input({ tags: ['oven'], steps: ['Cook the fish.'], lines: [['cod fillet', 200, 'g']] }));
  assert.deepEqual(tagged.cooking_methods, ['baked']);
  const raw = classifyRecipe(input({ cookMin: 0, steps: ['Slice and serve.'], lines: [['potato', 400, 'g']] }));
  assert.deepEqual(raw.cooking_methods, ['no_cook']);
});

test('dish family words in any language, and not Italian "al forno" or pizzaiola', () => {
  const fam = (titles: string[]) => classifyRecipe(input({ titles, lines: [['cod fillet', 300, 'g']] })).dish_families;
  assert.deepEqual(fam(['Blanquette de veau']), ['stew']);
  assert.deepEqual(fam(['Soupe de poisson']), ['soup']);
  assert.deepEqual(fam(['Merluzzo al forno']), ['plated']);
  assert.deepEqual(fam(['Pollo alla pizzaiola']), ['plated']);
  assert.deepEqual(fam(['Tarte flambée']), ['pizza']);
  assert.deepEqual(fam(['Pollo dal contadino']), ['plated']); // "dal" is not dhal
  assert.deepEqual(fam(['Chicken shawarma traybake']), ['wrap', 'oven_bake']);
});

test('traits', () => {
  assert.deepEqual(parseTrait('sauce:cream@60'), { kind: 'sauce', value: 'cream', amount: 60 });
  assert.deepEqual(parseTrait('heat:1.5'), { kind: 'heat', value: '', amount: 1.5 });
  assert.deepEqual(parseTrait('liquid'), { kind: 'liquid', value: '', amount: null });
});

test('features are namespaced; heat is cumulative; legacy tags map onto them', () => {
  const f = classificationFeatures(classifyRecipe(curry));
  for (const x of ['protein:fish', 'starch:rice', 'dish:curry', 'sauce:coconut', 'method:simmered', 'heat:1+', 'texture:saucy', 'indian']) {
    assert.ok(f.includes(x), x);
  }
  assert.ok(!f.includes('heat:2+'));
  assert.equal(canonicalFeature('curry'), 'dish:curry');
  assert.equal(canonicalFeature('Comfort'), 'intent:comfort');
  assert.equal(canonicalFeature('spicy'), 'heat:2+');
  assert.equal(canonicalFeature('mushrooms'), 'mushrooms');
});

test('classifyRow reads a stored recipe, translations included', () => {
  const c = classifyRow({
    title: 'Curry de poisson goanais', servings: 2, tags: [], cuisine: 'goan',
    steps: ['Faire revenir les oignons.'],
    translations: { en: { title: 'Goan-style fish curry', steps: ['Fry the onions.'] } },
    recipe_ingredients: [{ name: 'cod fillet', quantity: 300, unit: 'g' }, { name: 'coconut milk', quantity: 400, unit: 'ml' }],
  }, catalog);
  assert.deepEqual(c.dish_families, ['curry']);
  assert.deepEqual(c.cooking_methods, ['pan_fried']);
  assert.deepEqual(c.sauce_families, ['coconut']);
});

test('season: the seasons the main seasonal ingredients share, or the recipe\'s own season tags', async () => {
  const { seasonOfMonth } = await import('../classify.ts');
  const seasonal = new Catalog([
    e('tomato', { seasons: ['summer'] }),
    e('zucchini', { seasons: ['summer'] }),
    e('bell pepper', { seasons: ['summer', 'autumn'] }),
    e('pumpkin', { seasons: ['autumn'] }),
    e('fresh basil', { seasons: ['summer'] }),
    e('leek', { seasons: ['spring', 'autumn', 'winter'] }),
    e('asparagus', { seasons: ['spring'] }),
    e('potato'),
  ]);
  const season = (lines: [string, number, string, boolean?][], tags: string[] = []) => classifyRecipe({
    ...input({ lines: [], tags }),
    ingredients: lines.map(([name, quantity, unit, optional]) => ({ name, quantity, unit, optional, catalog: seasonal.find(name) })),
  }).seasons;

  assert.deepEqual(season([['tomato', 300, 'g'], ['bell pepper', 300, 'g'], ['zucchini', 200, 'g']]), ['summer']);
  assert.deepEqual(season([['bell pepper', 300, 'g'], ['pumpkin', 300, 'g']]), ['autumn']);
  // A garnish or an optional line doesn't make a winter dish summery.
  assert.deepEqual(season([['leek', 400, 'g'], ['potato', 500, 'g'], ['fresh basil', 10, 'g']]), ['spring', 'autumn', 'winter']);
  assert.deepEqual(season([['leek', 400, 'g'], ['tomato', 300, 'g', true]]), ['spring', 'autumn', 'winter']);
  // One tomato in the sauce (60 g a serving) doesn't count.
  assert.deepEqual(season([['pumpkin', 500, 'g'], ['tomato', 120, 'g']]), ['autumn']);
  // Clashing main ingredients: the heaviest decides.
  assert.deepEqual(season([['pumpkin', 500, 'g'], ['asparagus', 200, 'g']]), ['autumn']);
  assert.deepEqual(season([['pumpkin', 100, 'g'], ['asparagus', 300, 'g']]), ['spring']);
  // The recipe's own season tags win.
  assert.deepEqual(season([['pumpkin', 500, 'g']], ['winter', 'comfort']), ['winter']);
  assert.deepEqual(season([['potato', 400, 'g']], ['summer', 'spring']), ['spring', 'summer']);
  // Nothing seasonal: all year. Nothing readable: unknown.
  const allYear = classifyRecipe(input({ lines: [['potato', 400, 'g'], ['cod fillet', 300, 'g']] }));
  assert.equal(allYear.seasons?.length, 4);
  assert.equal(classifyRecipe(input({ lines: [['dragon fruit', 1, 'piece']] })).seasons, null);

  assert.deepEqual([1, 2, 3, 5, 6, 8, 9, 11, 12].map(seasonOfMonth),
    ['winter', 'winter', 'spring', 'spring', 'summer', 'summer', 'autumn', 'autumn', 'winter']);
});

