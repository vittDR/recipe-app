import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPatterns, softWeights, type Exposure } from '../preferences.ts';

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
