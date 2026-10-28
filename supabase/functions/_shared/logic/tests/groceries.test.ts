import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupGroceries, proposeListItems, scaleQuantity, splitCart, storeKey, type GroceryItem } from '../groceries.ts';

const item = (name: string, over: Partial<GroceryItem> = {}): GroceryItem => ({
  id: name, name, quantity: null, unit: null, aisle: 'other', recipe_id: null, checked_at: null, sort_key: 0, ...over,
});

test('groups by aisle in store order, checked items last', () => {
  const g = groupGroceries([
    item('milk', { aisle: 'dairy_eggs' }),
    item('spinach', { aisle: 'produce', checked_at: '2026-01-01T00:00:00Z', sort_key: 1 }),
    item('lemon', { aisle: 'produce', sort_key: 2 }),
    item('old', { aisle: 'produce', cleared_at: '2026-01-01T00:00:00Z' }),
  ], 'aisle');
  assert.deepEqual(g.map((s) => s.key), ['produce', 'dairy_eggs']);
  assert.deepEqual(g[0].items.map((i) => i.name), ['lemon', 'spinach']);
});

test('A-Z and recipe grouping', () => {
  const az = groupGroceries([item('bread'), item('apple'), item('avocado')], 'az');
  assert.deepEqual(az.map((s) => s.key), ['A', 'B']);
  assert.deepEqual(az[0].items.map((i) => i.name), ['apple', 'avocado']);
  const byRecipe = groupGroceries([item('x'), item('y', { recipe_id: 'r1' })], 'recipe');
  assert.deepEqual(byRecipe.map((s) => s.key), ['r1', '']);
});

test('proposes what to buy', () => {
  const now = new Date('2026-01-10T12:00:00Z');
  const ings = [
    { name: 'spinach', quantity: 150, unit: 'g', aisle: 'produce' as const, is_staple: false },
    { name: 'olive oil', quantity: 1, unit: 'tbsp', aisle: 'pantry' as const, is_staple: true },
    { name: 'lemon', quantity: 1, unit: 'piece', aisle: 'produce' as const, is_staple: false },
    { name: 'rice', quantity: 150, unit: 'g', aisle: 'pantry' as const, is_staple: false },
    { name: 'eggs', quantity: 2, unit: 'piece', aisle: 'dairy_eggs' as const, is_staple: false },
  ];
  const list = [
    item('lemon', { checked_at: '2026-01-08T00:00:00Z' }),
    item('rice', { checked_at: '2025-12-01T00:00:00Z' }),
    item('eggs'),
  ];
  const p = proposeListItems(ings, list, [], now);
  assert.deepEqual(p.map((x) => [x.ingredient.name, x.add, x.why]), [
    ['spinach', true, 'to_buy'],
    ['olive oil', false, 'staple'],
    ['lemon', false, 'bought_recently'],
    ['rice', true, 'to_buy'],
    ['eggs', false, 'on_list'],
  ]);
});

test('scales quantities to the pot', () => {
  assert.equal(scaleQuantity(300, 2, 2.6), 390);
  assert.equal(scaleQuantity(1, 2, 2.6), 1.25);
  assert.equal(scaleQuantity(null, 2, 3), null);
});

test('stores are sections in the household order; unknown stores fall back to the aisle', () => {
  const g = groupGroceries([
    item('framboises', { aisle: 'produce', store_id: 'picard' }),
    item('citron', { aisle: 'produce' }),
    item('pain', { aisle: 'bakery', store_id: 'gone' }),
  ], 'aisle', [storeKey('picard'), 'produce', 'bakery']);
  assert.deepEqual(g.map((s) => [s.key, s.items.map((i) => i.name)]), [
    ['store:picard', ['framboises']], ['produce', ['citron']], ['bakery', ['pain']],
  ]);
});

test('recipe ingredients match list items through their product', () => {
  const p = proposeListItems(
    [{ name: 'chicken breast', quantity: 2, unit: 'piece', aisle: 'meat_fish' as const, is_staple: false }],
    [item('blanc de poulet', { ingredient: 'chicken breast' })],
    [],
  );
  assert.equal(p[0].why, 'on_list');
});

test('A-Z folds accents and œ', () => {
  const az = groupGroceries([item('Éponges'), item('Œufs'), item('Oignon')], 'az');
  assert.deepEqual(az.map((s) => [s.key, s.items.length]), [['E', 1], ['O', 2]]);
});

test('recipe ingredients match list items by product', () => {
  const p = proposeListItems(
    [{ name: 'framboises', product_id: 'p-framboises', quantity: 125, unit: 'g', aisle: 'produce' as const, is_staple: false }],
    [item('Framboises', { product_id: 'p-framboises' })],
    [],
  );
  assert.equal(p[0].why, 'on_list');
});

test('checked items go to the cart, last checked first', () => {
  const { toBuy, cart } = splitCart([
    item('milk'),
    item('eggs', { checked_at: '2026-01-01T10:00:00Z' }),
    item('bread', { checked_at: '2026-01-01T11:00:00Z' }),
    item('old', { checked_at: '2026-01-01T09:00:00Z', cleared_at: '2026-01-01T12:00:00Z' }),
  ]);
  assert.deepEqual(toBuy.map((i) => i.name), ['milk']);
  assert.deepEqual(cart.map((i) => i.name), ['bread', 'eggs']);
});
