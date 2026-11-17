import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { type Plate, plateDistance, platesOf, plateVector, rowPlates } from '../plate.ts';
import type { ClassifiableRow, RecipeClassification } from '../classify.ts';
import { Catalog, type CatalogEntry } from '../ingredients.ts';

interface Row { title: string; classification: RecipeClassification; withoutOptional: RecipeClassification | null }
const library = JSON.parse(readFileSync(new URL('./fixtures/library.json', import.meta.url), 'utf8')) as Row[];
const plate = (title: string) => {
  const r = library.find((x) => x.title === title);
  assert.ok(r, title);
  return plateVector(r.classification)!;
};

test('every library dish has a plate, inside the unit square', () => {
  for (const r of library) {
    const p = plateVector(r.classification);
    assert.ok(p, r.title);
    for (const v of Object.values(p)) assert.ok(v >= 0 && v <= 1, `${r.title}: ${v}`);
  }
});

test('familiar dishes land where people would put them', () => {
  const tartiflette = plate('Tartiflette traditionnelle');
  const teriyaki = plate('Teriyaki chicken with rice');
  const nicoise = plate('Salade niçoise with tuna and green beans');
  const chips = plate('Fish and Chips');
  // Cream and cheese make tartiflette as rich as it gets; olive oil leaves a Niçoise in between.
  assert.equal(tartiflette.rich, 1);
  assert.ok(teriyaki.rich < 0.1);
  assert.ok(nicoise.rich > teriyaki.rich && nicoise.rich < tartiflette.rich - 0.3);
  assert.ok(chips.rich > nicoise.rich);
  // A salad is all vegetables; teriyaki chicken is a carb base with protein.
  assert.equal(nicoise.veg, 1);
  assert.ok(teriyaki.carb > 0.9 && teriyaki.veg < 0.2);
  assert.ok(teriyaki.protein > tartiflette.protein);
});

test('no plate without readable nutrition', () => {
  const c = library[0].classification;
  assert.equal(plateVector({ ...c, nutrition: { ...c.nutrition, fat_g: null } }), null);
  assert.equal(plateVector({ ...c, veg_g: null }), null);
  assert.equal(plateVector(null), null);
});

test('plate distance: symmetric, zero on itself, far corners 1 apart', () => {
  const a: Plate = { protein: 0, rich: 0, veg: 0, carb: 0 };
  const b: Plate = { protein: 1, rich: 1, veg: 1, carb: 1 };
  const c = plate('Fish and Chips');
  assert.equal(plateDistance(a, a), 0);
  assert.equal(plateDistance(a, b), 1);
  assert.equal(plateDistance(a, c), plateDistance(c, a));
  // Richness counts most.
  assert.ok(plateDistance(a, { ...a, rich: 0.5 }) > plateDistance(a, { ...a, veg: 0.5 }));
});

test('a dish is a second plate without its optional lines only when that changes the plate', () => {
  const chilli = library.find((x) => x.title === 'Black bean and sweet potato chilli')!;
  const plates = platesOf(chilli.classification, chilli.withoutOptional);
  assert.equal(plates.length, 2);
  assert.ok(plates[1].rich < plates[0].rich); // the avocado on top is optional
  const teriyaki = library.find((x) => x.title === 'Teriyaki chicken with rice')!;
  assert.equal(platesOf(teriyaki.classification, teriyaki.withoutOptional).length, 1);
  assert.deepEqual(platesOf(null), []);
});

test('a stored recipe row: its plates as written and without its optional lines', () => {
  const e = (name: string, over: Partial<CatalogEntry>): CatalogEntry => ({
    name, default_aisle: 'other', is_staple: false, kcal_100g: 100, protein_100g: 0, fat_100g: 0, carbs_100g: 0, fiber_100g: 0,
    traits: [], ...over,
  });
  const catalog = new Catalog([
    e('chicken breast', { kcal_100g: 120, protein_100g: 23, fat_100g: 1.5, traits: ['protein:poultry'], diet_class: 'meat' }),
    e('rice', { kcal_100g: 360, protein_100g: 7, fat_100g: 0.6, carbs_100g: 79, traits: ['starch:rice'] }),
    e('broccoli', { kcal_100g: 34, protein_100g: 2.8, fat_100g: 0.4, carbs_100g: 7, default_aisle: 'produce' }),
    e('cream', { kcal_100g: 340, protein_100g: 2, fat_100g: 36, traits: ['sauce:cream', 'liquid'] }),
  ]);
  const row = (optionalCream: boolean): ClassifiableRow => ({
    title: 'Chicken, rice and broccoli', servings: 2, tags: [], steps: ['Cook the rice.', 'Pan-fry the chicken.'],
    recipe_ingredients: [
      { name: 'chicken breast', quantity: 300, unit: 'g' }, { name: 'rice', quantity: 150, unit: 'g' },
      { name: 'broccoli', quantity: 300, unit: 'g' }, { name: 'cream', quantity: 100, unit: 'ml', optional: optionalCream },
    ],
  });
  // Optional lines count in the dish's nutrition but don't make its sauce (classify.ts): the cream shows as fat.
  const [full, lean] = rowPlates(row(true), catalog);
  assert.ok(full.rich > lean.rich + 0.1, JSON.stringify({ full, lean }));
  assert.ok(lean.protein > full.protein);
  assert.equal(rowPlates(row(false), catalog).length, 1);
});
