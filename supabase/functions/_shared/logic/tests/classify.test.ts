import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalFeature, classificationFeatures, classifyRecipe, classifyRow, parseTrait, type ClassifyInput,
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
