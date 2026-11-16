import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type FacetRecipe, matchesFilter, matchesFilters, normaliseEquipment } from '../facets.ts';

const recipe = (over: Partial<FacetRecipe> = {}): FacetRecipe => ({
  tags: [], totalMin: 40, kcalPerServing: 600, proteinGPerServing: 30, dietClass: 'meat',
  difficulty: 'medium', equipment: { pots: 1, oven: false, special: [] }, exoticIngredients: [], ...over,
});

test('normalising equipment: whole pot count, oven flag, special items deduplicated in display order', () => {
  assert.deepEqual(normaliseEquipment({ pots: 2.4, oven: true, special: ['Thermometer', 'blender', 'tagine', 'blender'] }),
    { pots: 2, oven: true, special: ['blender', 'thermometer', 'tagine'] });
  assert.deepEqual(normaliseEquipment({ pots: -1, oven: 'yes', special: 'blender' }), { pots: 0, oven: false, special: [] });
  assert.deepEqual(normaliseEquipment(null), { pots: 0, oven: false, special: [] });
});

test('one pot means exactly one pot, pan or dish', () => {
  assert.ok(matchesFilter(recipe({ equipment: { pots: 1, oven: true, special: ['blender'] } }), 'one_pot'));
  assert.ok(!matchesFilter(recipe({ equipment: { pots: 2, oven: false, special: [] } }), 'one_pot'));
  assert.ok(!matchesFilter(recipe({ equipment: { pots: 0, oven: false, special: [] } }), 'one_pot'));
  assert.ok(!matchesFilter(recipe({ equipment: null }), 'one_pot'));
});

test('healthy: by composition, whatever the size; never a treat or indulgent', () => {
  const classified = (nutrition: { kcal: number; protein_g: number; fat_g: number | null; fiber_g: number }, intents: string[] = []) =>
    recipe({ classification: { nutrition: { carbs_g: null, estimated: false, ...nutrition }, meal_intents: intents } as never });
  // 860 kcal, 25% protein, 31% fat, 12 g fibre per 1000 kcal: a big plate, still healthy.
  const big = { kcal: 860, protein_g: 54, fat_g: 30, fiber_g: 10.5 };
  assert.ok(matchesFilter(classified(big), 'healthy'));
  assert.ok(!matchesFilter({ ...classified(big), tags: ['treat'] }, 'healthy'));
  assert.ok(!matchesFilter(classified(big, ['indulgent']), 'healthy'));
  assert.ok(!matchesFilter(classified({ ...big, protein_g: 40 }), 'healthy')); // 19% protein
  assert.ok(!matchesFilter(classified({ ...big, fat_g: 36 }), 'healthy')); // 38% fat
  assert.ok(!matchesFilter(classified({ ...big, fiber_g: 8 }), 'healthy')); // 9 g / 1000 kcal
  assert.ok(!matchesFilter(classified({ ...big, fat_g: null }), 'healthy'));
  // Unclassified: only its own tag says so, never its size.
  assert.ok(!matchesFilter(recipe({ kcalPerServing: 400 }), 'healthy'));
  assert.ok(matchesFilter(recipe({ tags: ['healthy'] }), 'healthy'));
});

test('diet, high protein, quick, comfort', () => {
  assert.ok(matchesFilter(recipe({ kcalPerServing: 480 }), 'diet'));
  assert.ok(!matchesFilter(recipe(), 'diet'));
  assert.ok(matchesFilter(recipe({ proteinGPerServing: 35 }), 'high_protein'));
  assert.ok(!matchesFilter(recipe(), 'high_protein'));
  assert.ok(matchesFilter(recipe({ totalMin: 20 }), 'quick'));
  assert.ok(matchesFilter(recipe({ totalMin: null, tags: ['quick'] }), 'quick'));
  assert.ok(!matchesFilter(recipe(), 'quick'));
  assert.ok(matchesFilter(recipe({ tags: ['stew'] }), 'comfort'));
  assert.ok(!matchesFilter(recipe({ tags: ['light'] }), 'comfort'));
});

test('veggie and fish follow the diet class; easy and everyday follow the new fields', () => {
  assert.ok(matchesFilter(recipe({ dietClass: 'veg' }), 'veggie'));
  assert.ok(!matchesFilter(recipe({ dietClass: 'fish' }), 'veggie'));
  assert.ok(matchesFilter(recipe({ dietClass: 'fish' }), 'fish'));
  assert.ok(matchesFilter(recipe({ difficulty: 'easy' }), 'easy'));
  assert.ok(!matchesFilter(recipe({ difficulty: null }), 'easy'));
  assert.ok(matchesFilter(recipe(), 'everyday'));
  assert.ok(!matchesFilter(recipe({ exoticIngredients: ['gochujang'] }), 'everyday'));
});

test('several filters must all match', () => {
  const r = recipe({ dietClass: 'veg', kcalPerServing: 450, difficulty: 'easy' });
  assert.ok(matchesFilters(r, ['veggie', 'diet', 'easy']));
  assert.ok(!matchesFilters(r, ['veggie', 'high_protein']));
  assert.ok(matchesFilters(r, []));
});
