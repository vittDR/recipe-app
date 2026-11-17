import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { type Plate, plateDistance, platesOf, plateVector } from '../plate.ts';
import type { RecipeClassification } from '../classify.ts';

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
