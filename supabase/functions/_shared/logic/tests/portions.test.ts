import { test } from 'node:test';
import assert from 'node:assert/strict';
import { macrosOf, splitPot, targetsOf } from '../portions.ts';

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

test('carbs and fat are ceilings, fibre a floor; off or unknown never count', () => {
  const recipe = { kcalPerServing: 700, proteinGPerServing: 40, carbsGPerServing: 90, fatGPerServing: 25, fibreGPerServing: 6 };
  const eater = (over: Record<string, number | null>) => ({ userId: 'a', dinnerKcal: 700, dinnerProteinG: 40, ...over });
  const fits = (over: Record<string, number | null>, r = recipe) => splitPot(r, [eater(over)])!.plates[0].fits;

  assert.equal(fits({}), true, 'no carbs, fat or fibre targets');
  assert.equal(fits({ dinnerCarbsG: 80 }), true, '90 g carbs is within 20% over 80');
  assert.equal(fits({ dinnerCarbsG: 70 }), false, '90 g carbs is too far over 70');
  assert.equal(fits({ dinnerCarbsG: 200 }), true, 'well under a carbs ceiling is fine');
  assert.equal(fits({ dinnerFatG: 20 }), false, '25 g fat is more than 20% over 20');
  assert.equal(fits({ dinnerFibreG: 7 }), true, '6 g fibre is within 15% of 7');
  assert.equal(fits({ dinnerFibreG: 10 }), false, '6 g fibre is short of 10');
  assert.equal(fits({ dinnerFibreG: 3 }), true, 'more fibre is fine');
  assert.equal(fits({ dinnerCarbsG: null, dinnerFatG: null, dinnerFibreG: null }), true, 'switched off');
  assert.equal(fits({ dinnerFibreG: 30 }, { kcalPerServing: 700, proteinGPerServing: 40 }), true, 'unknown fibre is not held to it');

  // Calories and protein off: only the other targets decide.
  assert.equal(fits({ dinnerKcal: null, dinnerProteinG: null, dinnerFatG: 30 }), true);
  // Servings scale every macro: 1.5 plates of 25 g fat is 37.5 g.
  assert.equal(splitPot(recipe, [{ ...eater({ dinnerKcal: null, dinnerFatG: 30 }), servings: 1.5 }])!.plates[0].fits, false);
  // The score falls as a ceiling is passed.
  const near = splitPot(recipe, [eater({ dinnerCarbsG: 80 })])!.fitScore;
  const far = splitPot(recipe, [eater({ dinnerCarbsG: 50 })])!.fitScore;
  assert.ok(near > far);
});

test('targetsOf and macrosOf read stored rows', () => {
  assert.deepEqual(targetsOf('u', { dinner_kcal: null, dinner_protein_g: 40, dinner_fibre_g: 8, servings: 1 }), {
    userId: 'u', dinnerKcal: null, dinnerProteinG: 40, dinnerCarbsG: null, dinnerFatG: null, dinnerFibreG: 8, servings: 1,
  });
  assert.deepEqual(macrosOf({ kcal_per_serving: 600, protein_g_per_serving: 30 }, { carbs_g: 70, fat_g: 20, fiber_g: 9 }), {
    kcalPerServing: 600, proteinGPerServing: 30, carbsGPerServing: 70, fatGPerServing: 20, fibreGPerServing: 9,
  });
});
