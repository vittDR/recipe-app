import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Catalog, estimateMacros, parseIngredientLine, dietClassOf } from '../ingredients.ts';

const catalog = new Catalog([
  { name: 'spinach', name_fr: 'épinards', aliases: ['baby spinach'], default_aisle: 'produce', is_staple: false, kcal_100g: 23, protein_100g: 2.9, grams_per_unit: 30, diet_class: 'veg' },
  { name: 'chicken breast', name_fr: 'blanc de poulet', aliases: ['chicken'], default_aisle: 'meat_fish', is_staple: false, kcal_100g: 120, protein_100g: 22.5, grams_per_unit: 150, diet_class: 'meat' },
  { name: 'garlic', name_fr: 'ail', aliases: [], default_aisle: 'produce', is_staple: true, kcal_100g: 149, protein_100g: 6.4, grams_per_unit: 5, diet_class: 'veg' },
  { name: 'salt', name_fr: 'sel', aliases: [], default_aisle: 'spices', is_staple: true, kcal_100g: 0, protein_100g: 0, grams_per_unit: 6, diet_class: 'veg' },
  { name: 'olive oil', name_fr: "huile d'olive", aliases: [], default_aisle: 'pantry', is_staple: true, kcal_100g: 884, protein_100g: 0, grams_per_unit: 14, diet_class: 'veg' },
]);

test('parses English lines', () => {
  assert.deepEqual(
    (({ name, quantity, unit }) => ({ name, quantity, unit }))(parseIngredientLine('200 g baby spinach, washed')),
    { name: 'baby spinach', quantity: 200, unit: 'g' },
  );
  const l = parseIngredientLine('1 1/2 tbsp olive oil');
  assert.equal(l.quantity, 1.5);
  assert.equal(l.unit, 'tbsp');
  assert.equal(parseIngredientLine('½ cup rice').quantity, 0.5);
  assert.equal(parseIngredientLine('2-3 cloves garlic').quantity, 3);
  assert.equal(parseIngredientLine('2-3 cloves garlic').unit, 'clove');
  assert.equal(parseIngredientLine('Salt').quantity, null);
  assert.equal(parseIngredientLine('Salt').unit, null);
});

test('parses French lines', () => {
  const a = parseIngredientLine("2 c. à soupe d'huile d'olive");
  assert.equal(a.unit, 'tbsp');
  assert.equal(a.name, "huile d'olive");
  const b = parseIngredientLine('3 gousses d’ail');
  assert.equal(b.unit, 'clove');
  assert.equal(b.name, 'ail');
  const c = parseIngredientLine('1,5 kg de blanc de poulet');
  assert.equal(c.quantity, 1.5);
  assert.equal(c.unit, 'kg');
  assert.equal(c.name, 'blanc de poulet');
  assert.equal(parseIngredientLine("l'ail").name, 'ail');
});

test('normalises to catalogue in both languages', () => {
  assert.equal(catalog.find('Épinards')?.name, 'spinach');
  assert.equal(catalog.find('boneless chicken breasts')?.name, 'chicken breast');
  assert.equal(catalog.find('ail')?.name, 'garlic');
  assert.equal(catalog.find('dragonfruit'), undefined);
});

test('estimates macros from ingredients', () => {
  const ings = ['300 g chicken breast', '150 g spinach', '2 cloves garlic', 'salt'].map((l) =>
    catalog.normalise(parseIngredientLine(l)),
  );
  const m = estimateMacros(ings, 2);
  // chicken 360 kcal / 67.5 g, spinach 34.5 / 4.35, garlic 14.9 / 0.64
  assert.equal(m.kcalPerServing, Math.round((360 + 34.5 + 14.9) / 2));
  assert.equal(m.estimated, false);
  assert.deepEqual(m.unknown, []);
  const g = estimateMacros([{ ...ings[0], guessed: true }], 2);
  assert.equal(g.estimated, true);
});

test('diet class of a recipe', () => {
  assert.equal(dietClassOf([catalog.find('spinach'), catalog.find('chicken')]), 'meat');
  assert.equal(dietClassOf([catalog.find('spinach')]), 'veg');
});
