import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitPot } from '../portions.ts';

test('plates are servings times the per-serving macros', () => {
  const s = splitPot({ kcalPerServing: 500, proteinGPerServing: 40 }, [
    { userId: 'a', dinnerKcal: 800, dinnerProteinG: 55, servings: 1.5 },
    { userId: 'b', dinnerKcal: 500, dinnerProteinG: 30 },
  ])!;
  assert.equal(s.potServings, 2.5);
  assert.deepEqual([s.plates[0].kcal, s.plates[0].proteinG, s.plates[0].servings], [750, 60, 1.5]);
  // b eats the default 1 serving.
  assert.deepEqual([s.plates[1].kcal, s.plates[1].proteinG, s.plates[1].servings], [500, 40, 1]);
  assert.ok(s.fitsAll);
  assert.equal(s.fitScore, 1);
});

test('fits: calories within 20%, protein at least 85% of target', () => {
  const plate = (kcal: number, protein: number) =>
    splitPot({ kcalPerServing: kcal, proteinGPerServing: protein }, [{ userId: 'a', dinnerKcal: 800, dinnerProteinG: 50 }])!;
  assert.ok(plate(950, 80).fitsAll, 'more protein is fine');
  assert.ok(plate(650, 43).fitsAll);
  assert.ok(!plate(1000, 60).fitsAll, '+25% calories');
  assert.ok(!plate(800, 40).fitsAll, '-20% protein');
  assert.ok(plate(1000, 60).fitScore > 0 && plate(1000, 60).fitScore < 1);
});

test('no targets -> always fits', () => {
  assert.ok(splitPot({ kcalPerServing: 1200, proteinGPerServing: 5 }, [{ userId: 'a', dinnerKcal: null, dinnerProteinG: null }])!.fitsAll);
});

test('no macros -> no split', () => {
  assert.equal(splitPot({ kcalPerServing: null, proteinGPerServing: null }, [{ userId: 'a', dinnerKcal: 700, dinnerProteinG: 40 }]), null);
});
