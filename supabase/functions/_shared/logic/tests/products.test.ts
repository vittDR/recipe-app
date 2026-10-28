import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFrequent, ProductIndex, productKey, productName, type Product } from '../products.ts';

const product = (name_fr: string, over: Partial<Product> = {}): Product => ({
  id: name_fr, household_id: null, name_fr, name_en: null, aliases: [], ingredient: null, default_aisle: 'other', ...over,
});

const index = new ProductIndex([
  product('blanc de poulet', { name_en: 'chicken breast', aliases: ['poulet', 'filet de poulet'], ingredient: 'chicken breast' }),
  product('Escalopes de poulet', { aliases: ['escalope poulet'] }),
  product('œufs', { name_en: 'eggs', aliases: ['oeuf'] }),
  product('chou-fleur', { name_en: 'cauliflower' }),
  product('lentilles corail', { aliases: ['lentilles'] }),
  product('Lentilles'),
  product('Essuie-tout', { aliases: ['sopalin'] }),
  product('Recharges Swiffer poussière', { household_id: 'h1' }),
]);

test('keys ignore case, accents, punctuation and plurals', () => {
  assert.equal(productKey('Chou-fleur'), productKey('chou fleur'));
  assert.equal(productKey('Œufs'), productKey('oeuf'));
  assert.equal(productKey('Fêta'), 'feta');
  assert.equal(productKey('Tomates cerise'), productKey('tomates cerises'));
});

test('chicken breast = Chicken Breast = Blanc de Poulet = poulet', () => {
  for (const n of ['chicken breast', 'Chicken Breast', 'Blanc de Poulet', 'blancs de poulet', 'Poulet']) {
    assert.equal(index.find(n)?.name_fr, 'blanc de poulet', n);
  }
  assert.equal(index.find('Escalope poulet')?.name_fr, 'Escalopes de poulet');
  assert.equal(index.find('Chou fleur')?.name_fr, 'chou-fleur');
  assert.equal(index.find('sopalin')?.name_fr, 'Essuie-tout');
  assert.equal(index.find('swiffer'), undefined);
});

test('a main name beats another product\'s alias', () => {
  assert.equal(index.find('lentilles')?.name_fr, 'Lentilles');
});

test('autocomplete ranks prefixes first, then words, then the rest', () => {
  assert.deepEqual(index.search('poul').map((p) => p.name_fr), ['blanc de poulet', 'Escalopes de poulet']);
  assert.deepEqual(index.search('swif').map((p) => p.name_fr), ['Recharges Swiffer poussière']);
  assert.deepEqual(index.search('lent').map((p) => p.name_fr), ['Lentilles', 'lentilles corail']);
  assert.deepEqual(index.search('').length, 0);
  // Boost (times bought) breaks ties.
  const boosted = index.search('lentilles', 6, (p) => (p.name_fr === 'lentilles corail' ? 5 : 0));
  assert.equal(boosted[0].name_fr, 'Lentilles'); // exact main name still wins
});

test('display names are French first and capitalised', () => {
  assert.equal(productName(product('œufs', { name_en: 'eggs' })), 'Œufs');
  assert.equal(productName(product('œufs', { name_en: 'eggs' }), 'en'), 'Eggs');
  assert.equal(productName(product('Babybel'), 'en'), 'Babybel');
});

test('frequently bought: pinned or bought twice, unless hidden', () => {
  const hp = { product_id: 'x', aisle: null, store_id: null, add_count: 0, last_added_at: null, pinned: false, hidden: false };
  assert.equal(isFrequent(hp), false);
  assert.equal(isFrequent({ ...hp, add_count: 2 }), true);
  assert.equal(isFrequent({ ...hp, pinned: true }), true);
  assert.equal(isFrequent({ ...hp, add_count: 9, hidden: true }), false);
});
