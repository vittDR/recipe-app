import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flavoursOf, GARLICKY_MIN_G } from '../flavours.ts';

const of = (...lines: [string, number | null][]) => flavoursOf(lines.map(([name, grams]) => ({ name, grams })));

test('a main ingredient is a note, a supporting one takes two', () => {
  assert.deepEqual(of(['fresh coriander', 5]).flavours, ['fresh_herbs']);
  assert.deepEqual(of(['lemon', 20]).flavours, []);
  assert.deepEqual(of(['lemon', 20], ['lemongrass', 10]).flavours, ['citrus']);
  assert.deepEqual(of(['soy sauce', 10], ['honey', 12], ['sesame oil', 5], ['sesame seeds', 3]).flavours, ['umami', 'sweet', 'nutty']);
});

test('garlic and sugar count by how much', () => {
  assert.deepEqual(of(['garlic', 3]).flavours, []);
  assert.deepEqual(of(['garlic', GARLICKY_MIN_G]).flavours, ['garlicky']);
  assert.deepEqual(of(['sugar', 2]).flavours, []);
  assert.deepEqual(of(['sugar', 10]).flavours, ['sweet']);
});

test('families: one member is enough, a splash of wine is not', () => {
  assert.deepEqual(of(['mushrooms', 80], ['feta', 30]).families, ['mushrooms', 'cheese']);
  assert.deepEqual(of(['white wine', 15]).families, []);
  assert.deepEqual(of(['white wine', 60]).families, ['alcohol']);
});
