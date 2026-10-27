import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitPot } from '../portions.ts';

test('plates follow each eater calorie target', () => {
  const s = splitPot({ kcalPerServing: 500, proteinGPerServing: 40 }, [
    { userId: 'a', dinnerKcal: 800, dinnerProteinG: 64 },
    { userId: 'b', dinnerKcal: 500, dinnerProteinG: 30 },
  ])!;
  assert.equal(s.potServings, 2.6);
  assert.equal(s.plates[0].kcal, 800);
  assert.equal(s.plates[0].proteinG, 64);
  assert.ok(s.plates[0].fits);
  // b gets 40 g against a 30 g target: +33%, outside 15%.
  assert.ok(!s.plates[1].fits);
  assert.ok(!s.fitsAll);
  assert.ok(s.fitScore > 0.5 && s.fitScore < 1);
});

test('no macros -> no split', () => {
  assert.equal(splitPot({ kcalPerServing: null, proteinGPerServing: null }, [{ userId: 'a', dinnerKcal: 700, dinnerProteinG: 40 }]), null);
});
