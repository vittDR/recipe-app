import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipeFeatures } from '../preferences.ts';

test('recipe features: legacy tags become their classified feature, no duplicates', () => {
  const f = recipeFeatures(['curry', 'Indian'], [{ name: 'Cod fillet' }, { name: 'salt', is_staple: true }]);
  assert.deepEqual(f, ['dish:curry', 'indian', 'cod fillet']);
});
