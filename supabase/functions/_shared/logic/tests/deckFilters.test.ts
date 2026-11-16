import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askedFor, deckFacets, filterCount, matchesDeckFilters, normaliseFilters } from '../deckFilters.ts';

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
