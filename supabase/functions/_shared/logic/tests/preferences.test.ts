import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPatterns, recipeFeatures, softWeights, type Exposure } from '../preferences.ts';

const at = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString();

test('suggests avoid after 8 passes in the last 10 exposures', () => {
  const ex: Exposure[] = [];
  for (let i = 0; i < 10; i++) ex.push({ verdict: i < 8 ? 'pass' : 'yes', features: ['mushrooms'], createdAt: at(i) });
  // Older yeses outside the window don't count.
  for (let i = 0; i < 5; i++) ex.push({ verdict: 'yes', features: ['mushrooms'], createdAt: new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString() });
  const p = detectPatterns(ex);
  assert.deepEqual(p.map((x) => x.pattern), [{ kind: 'avoid', value: 'mushrooms' }]);
  assert.equal(p[0].evidence, 8);
});

test('7 of 10 is not enough; prefer patterns work too', () => {
  const ex: Exposure[] = [];
  for (let i = 0; i < 10; i++) ex.push({ verdict: i < 7 ? 'pass' : 'yes', features: ['tofu'], createdAt: at(i) });
  for (let i = 0; i < 9; i++) ex.push({ verdict: 'must', features: ['bowl'], createdAt: at(i) });
  assert.deepEqual(detectPatterns(ex).map((x) => x.pattern), [{ kind: 'prefer', value: 'bowl' }]);
});

test('soft weights sign follows verdicts', () => {
  const w = softWeights([
    { verdict: 'pass', features: ['a'], createdAt: at(1) },
    { verdict: 'yes', features: ['b'], createdAt: at(2) },
  ]);
  assert.ok(w.get('a')! < 0);
  assert.ok(w.get('b')! > 0);
});

test('a pass in a mood deck counts half and says nothing about the dish mood', () => {
  const ex: Exposure[] = [
    { verdict: 'pass', features: ['dish:curry', 'intent:comfort'], createdAt: at(1), mood: 'light' },
    { verdict: 'pass', features: ['dish:curry', 'intent:comfort'], createdAt: at(2) },
  ];
  const w = softWeights(ex);
  assert.equal(w.get('dish:curry'), -1.5 / 3.5);
  assert.equal(w.get('intent:comfort'), -1 / 3); // only the any-mood pass
  const many: Exposure[] = [];
  for (let i = 0; i < 10; i++) many.push({ verdict: 'pass', features: ['intent:comfort'], createdAt: at(i), mood: 'light' });
  assert.deepEqual(detectPatterns(many), []);
});

test('recipe features: legacy tags become their classified feature, no duplicates', () => {
  const f = recipeFeatures(['curry', 'Indian'], [{ name: 'Cod fillet' }, { name: 'salt', is_staple: true }]);
  assert.deepEqual(f, ['dish:curry', 'indian', 'cod fillet']);
});
