import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askedFor, deckFacets, filterCount, filtersForDiet, matchesDeckFilters, normaliseFilters, proteinsForDiet } from '../deckFilters.ts';

const c = (over: Partial<Parameters<typeof deckFacets>[0]> = {}) => ({
  protein_groups: [], protein_items: [], cuisines: [], starch_bases: [], heat_level: 0, ...over,
});

test('facets: proteins from the ingredients a dish is built on, fish by its group', () => {
  const f = deckFacets(c({
    protein_groups: ['poultry', 'shellfish', 'fish'], protein_items: ['chicken thigh', 'prawns', 'hake'],
    cuisines: ['thai', 'asian'], starch_bases: ['noodles'], heat_level: 2,
  }));
  assert.deepEqual(f, { proteins: ['chicken', 'fish', 'prawns'], cuisines: ['southeast_asian'], bases: ['noodles'], heat: 2 });
  // Chicken stock or a few peas don't make a chicken or a pulses dish: only the items counted as proteins do.
  assert.deepEqual(deckFacets(c({ protein_items: ['lamb', 'frozen peas'] })).proteins, ['lamb']);
  assert.deepEqual(deckFacets(c({ protein_items: ['red lentils', 'eggs'] })).proteins, ['eggs', 'pulses']);
  assert.deepEqual(deckFacets(c({ starch_bases: ['tortilla', 'sweet_potato'] })).bases, ['potatoes', 'bread']);
  assert.deepEqual(deckFacets(c({ cuisines: ['lebanese', 'middle eastern', 'mediterranean'] })).cuisines, ['middle_eastern']);
});

test('within a row any choice matches; across rows all must', () => {
  const chickenRice = deckFacets(c({ protein_items: ['chicken breast'], cuisines: ['japanese', 'asian'], starch_bases: ['rice'] }));
  assert.ok(matchesDeckFilters(chickenRice, {}));
  assert.ok(matchesDeckFilters(chickenRice, { proteins: ['chicken', 'prawns'] }));
  assert.ok(!matchesDeckFilters(chickenRice, { proteins: ['prawns'] }));
  assert.ok(matchesDeckFilters(chickenRice, { proteins: ['chicken'], cuisines: ['japanese'], bases: ['rice'], spice: 'mild' }));
  assert.ok(!matchesDeckFilters(chickenRice, { proteins: ['chicken'], cuisines: ['indian'] }));
  assert.ok(!matchesDeckFilters(chickenRice, { spice: 'spicy' }));
  assert.ok(matchesDeckFilters({ ...chickenRice, heat: 3 }, { spice: 'spicy' }));
  assert.ok(!matchesDeckFilters({ ...chickenRice, heat: 2 }, { spice: 'mild' }));
  assert.ok(matchesDeckFilters({ ...chickenRice, heat: null }, { spice: 'mild' })); // unknown heat counts as mild
});

test('filters from a request are cleaned; the count is the choices made', () => {
  assert.deepEqual(normaliseFilters({ proteins: ['chicken', 'unicorn'], cuisines: 'japanese', bases: [], spice: 'very' }),
    { proteins: ['chicken'] });
  assert.deepEqual(normaliseFilters(null), {});
  assert.equal(filterCount({ proteins: ['chicken', 'prawns'], cuisines: ['japanese'], spice: 'mild' }), 4);
  assert.equal(filterCount({ spice: 'any' }), 0);
});

test('what was asked for is not learnt from', () => {
  const asked = askedFor({ proteins: ['chicken'], cuisines: ['japanese'] });
  assert.ok(asked('protein:poultry'));
  assert.ok(asked('japanese'));
  assert.ok(asked('asian'));
  assert.ok(!asked('starch:rice'));
  assert.ok(!asked('dish:curry'));
  assert.ok(!askedFor({})('protein:poultry'));
});

test('calories and protein per serving', () => {
  const dish = { proteins: [], cuisines: [], bases: [], heat: null, kcal: 550, proteinG: 32 };
  assert.ok(matchesDeckFilters(dish, { maxKcal: 600, minProteinG: 30 }));
  assert.ok(matchesDeckFilters(dish, { maxKcal: 550, minProteinG: 32 }));
  assert.ok(!matchesDeckFilters(dish, { maxKcal: 500 }));
  assert.ok(!matchesDeckFilters(dish, { minProteinG: 35 }));
  // Unknown numbers never pass a number asked for.
  assert.ok(!matchesDeckFilters({ ...dish, kcal: null }, { maxKcal: 600 }));
  assert.ok(!matchesDeckFilters({ ...dish, proteinG: undefined }, { minProteinG: 10 }));
  assert.ok(matchesDeckFilters({ ...dish, kcal: null, proteinG: null }, {}));
  assert.deepEqual(normaliseFilters({ maxKcal: '612.4', minProteinG: 0 }), { maxKcal: 612 });
  assert.deepEqual(normaliseFilters({ maxKcal: -5, minProteinG: 999 }), { minProteinG: 200 });
  assert.equal(filterCount({ maxKcal: 600, minProteinG: 30, proteins: ['chicken'] }), 3);
});

test('effort: the minimum keeps easy dishes, some leaves out hard ones, unknown passes', () => {
  const f = { proteins: [], cuisines: [], bases: [], heat: 0 };
  assert.equal(matchesDeckFilters({ ...f, difficulty: 'medium' }, { effort: 'minimum' }), false);
  assert.equal(matchesDeckFilters({ ...f, difficulty: 'easy' }, { effort: 'minimum' }), true);
  assert.equal(matchesDeckFilters({ ...f, difficulty: 'hard' }, { effort: 'some' }), false);
  assert.equal(matchesDeckFilters({ ...f, difficulty: 'medium' }, { effort: 'some' }), true);
  assert.equal(matchesDeckFilters({ ...f, difficulty: null }, { effort: 'minimum' }), true);
  assert.deepEqual(normaliseFilters({ effort: 'some' }), { effort: 'some' });
  assert.deepEqual(normaliseFilters({ effort: 'lots' }), {});
});

test('protein choices follow the diet', () => {
  assert.deepEqual(proteinsForDiet('vegetarian'), ['eggs', 'tofu', 'pulses']);
  assert.deepEqual(proteinsForDiet('pescatarian'), ['fish', 'prawns', 'eggs', 'tofu', 'pulses']);
  assert.equal(proteinsForDiet('flexitarian').length, 10);
  assert.equal(proteinsForDiet('everything').length, 10);
  // Choices the diet rules out are dropped; an emptied row is no filter.
  assert.deepEqual(filtersForDiet({ proteins: ['chicken', 'tofu'], spice: 'mild' }, 'vegetarian'), { proteins: ['tofu'], spice: 'mild' });
  assert.deepEqual(filtersForDiet({ proteins: ['beef'], maxKcal: 600 }, 'pescatarian'), { maxKcal: 600 });
  const f = { proteins: ['beef' as const] };
  assert.equal(filtersForDiet(f, 'everything'), f);
});
