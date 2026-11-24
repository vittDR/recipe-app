import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectsFromSums, POPULATION_PRIOR, populationEffects, populationMean } from '../population.ts';
import { fitStyle } from '../style.ts';
import { dishFeature } from '../profile.ts';

const answers = (user: string, ys: Record<string, number>) =>
  Object.entries(ys).map(([recipeId, y]) => ({ userId: user, recipeId, y, weight: 1 }));

test('a dish everyone wants more than their usual dinner starts ahead, shrunk by the prior', () => {
  const all = [
    ...answers('a', { best: 4, b: 2, c: 2, d: 2, e: 2 }),
    ...answers('b', { best: 3, b: 1, c: 1, d: 1, e: 1 }),
  ];
  const fx = populationEffects(all);
  // a: mean 2.4, best +1.6; b: mean 1.4, best +1.6: 3.2 over 2 answers and the prior.
  assert.ok(Math.abs(fx.get('best')! - 3.2 / (2 + POPULATION_PRIOR)) < 1e-9);
  assert.ok(fx.get('b')! < 0);
});

test('few answers say nothing; excluded people are left out', () => {
  const all = [...answers('few', { x: 4, y: 0 }), ...answers('a', { x: 4, b: 2, c: 2, d: 2, e: 2 })];
  assert.equal(populationEffects(all).size, 5);
  assert.equal(populationEffects(all, ['a']).size, 0);
});

test('the database sums read the same way', () => {
  const fx = effectsFromSums({ r1: [2, 4], r2: [-40, 4] });
  assert.equal(fx.get('r1'), 2 / (4 + POPULATION_PRIOR));
  assert.equal(fx.get('r2'), -1);
});

test("a dish's population effect is its prior: own answers take over", () => {
  const plate = { protein: 0.5, rich: 0.3, veg: 0.5, carb: 0.6 };
  const mean = populationMean(new Map([['loved', 0.8]]));
  const loved = [dishFeature('loved')];
  const prior = fitStyle([], [], { featureMean: mean });
  assert.ok(Math.abs(prior.frequency([plate], loved) - prior.frequency([plate], [dishFeature('other')]) - 0.8) < 1e-9);
  // They said "not for me" to it, twice: that wins over what others think.
  const own = fitStyle([{ plate, features: loved, y: 0 }, { plate, features: loved, y: 0 }], [], { featureMean: mean });
  assert.ok(own.frequency([plate], loved) < prior.frequency([plate], loved) - 1);
});
