import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Catalog, estimateMacros, parseIngredientLine, dietClassOf } from '../ingredients.ts';

const catalog = new Catalog([
  { name: 'spinach', name_fr: 'épinards', name_it: 'spinaci', aliases: ['baby spinach'], default_aisle: 'produce', is_staple: false, kcal_100g: 23, protein_100g: 2.9, grams_per_unit: 30, diet_class: 'veg' },
  { name: 'chicken breast', name_fr: 'blanc de poulet', aliases: ['chicken'], default_aisle: 'meat_fish', is_staple: false, kcal_100g: 120, protein_100g: 22.5, grams_per_unit: 150, diet_class: 'meat' },
  { name: 'garlic', name_fr: 'ail', name_it: 'aglio', aliases: [], default_aisle: 'produce', is_staple: true, kcal_100g: 149, protein_100g: 6.4, grams_per_unit: 5, diet_class: 'veg' },
  { name: 'salt', name_fr: 'sel', aliases: [], default_aisle: 'spices', is_staple: true, kcal_100g: 0, protein_100g: 0, grams_per_unit: 6, diet_class: 'veg' },
  { name: 'olive oil', name_fr: "huile d'olive", name_it: "olio d'oliva", aliases: [], default_aisle: 'pantry', is_staple: true, kcal_100g: 884, protein_100g: 0, grams_per_unit: 14, diet_class: 'veg' },
  { name: 'bouquet garni', name_fr: 'bouquet garni', name_it: 'mazzetto aromatico', aliases: [], default_aisle: 'spices', is_staple: true, kcal_100g: 50, protein_100g: 2, grams_per_unit: 10, diet_class: 'veg' },
  { name: 'parsley', name_fr: 'persil', name_it: 'prezzemolo', aliases: [], default_aisle: 'produce', is_staple: false, kcal_100g: 36, protein_100g: 3, grams_per_unit: 1, diet_class: 'veg' },
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

test('parses Italian lines', () => {
  const a = parseIngredientLine("2 cucchiai olio d'oliva");
  assert.deepEqual([a.quantity, a.unit, a.name], [2, 'tbsp', "olio d'oliva"]);
  assert.equal(parseIngredientLine('0.5 cucchiaino curry').unit, 'tsp');
  const b = parseIngredientLine("2 spicchi d'aglio, tritati");
  assert.deepEqual([b.unit, b.name], ['clove', 'aglio']);
  assert.equal(parseIngredientLine('1 pizzico sale').unit, 'pinch');
  assert.equal(parseIngredientLine('1 mazzetto prezzemolo').unit, 'bunch');
  assert.equal(parseIngredientLine('4 fette pancetta').unit, 'slice');
  assert.equal(parseIngredientLine('1 scatola ceci').unit, 'can');
  assert.equal(parseIngredientLine('200 g di spinaci').name, 'spinaci');
});

test('a unit word can start a catalogue name', () => {
  const a = catalog.normalise(parseIngredientLine('1 bouquet garni (thym, laurier)'));
  assert.deepEqual([a.name, a.quantity, a.unit], ['bouquet garni', 1, 'piece']);
  assert.equal(catalog.normalise(parseIngredientLine('1 mazzetto aromatico')).name, 'bouquet garni');
  // A real unit still wins when the rest is a known name.
  const b = catalog.normalise(parseIngredientLine('1 bouquet persil'));
  assert.deepEqual([b.name, b.unit], ['parsley', 'bunch']);
});

test('normalises to catalogue in all three languages', () => {
  assert.equal(catalog.find('spinaci')?.name, 'spinach');
  assert.equal(catalog.find("olio d'oliva")?.name, 'olive oil');
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
