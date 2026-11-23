import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultAmount, matchProduct, suggestAisle, unitsFor, ProductIndex, productKey, productName, type Product } from '../products.ts';

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

test('search forgives a typo or two when nothing matches as typed', () => {
  const names = (q: string) => index.search(q).map((p) => p.name_fr);
  assert.deepEqual(names('lentiles'), ['Lentilles', 'lentilles corail']);
  assert.deepEqual(names('poulte'), ['blanc de poulet', 'Escalopes de poulet']);
  assert.deepEqual(names('choux flaur'), ['chou-fleur']);
  assert.deepEqual(names('caulifower'), ['chou-fleur']);
  assert.deepEqual(names('swifer'), ['Recharges Swiffer poussière']);
  assert.deepEqual(names('sopaln'), ['Essuie-tout']);
  // Too short to guess, or too far off.
  assert.deepEqual(names('oef'), []);
  assert.deepEqual(names('banane'), []);
  // An exact match is not a typo.
  assert.equal(index.find('lentiles'), undefined);
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


test('recipe lines: exact, close or new', () => {
  const idx = new ProductIndex([
    product('blanc de poulet', { name_en: 'chicken breast', aliases: ['poulet'], ingredient: 'chicken breast' }),
    product('Framboises'),
    product('sirop d\'érable', { name_en: 'maple syrup', ingredient: 'maple syrup' }),
  ]);
  assert.deepEqual(pick(matchProduct(idx, 'Blancs de poulet')), ['blanc de poulet', 'exact']);
  assert.deepEqual(pick(matchProduct(idx, 'framboises fraîches')), ['Framboises', 'exact']);
  // The parser's catalogue guess (it found the name inside the line) is worth a look.
  assert.deepEqual(pick(matchProduct(idx, 'blanc de poulet fermier', 'chicken breast')), ['blanc de poulet', 'close']);
  assert.deepEqual(pick(matchProduct(idx, 'framboises du jardin')), ['Framboises', 'close']);
  assert.deepEqual(pick(matchProduct(idx, 'sirop')), ['sirop d\'érable', 'weak']);
  assert.deepEqual(pick(matchProduct(idx, 'sachet de sirop')), ['sirop d\'érable', 'weak']); // one of its words
  assert.equal(matchProduct(idx, 'fleurs de sureau'), null);
});

function pick(m: ReturnType<typeof matchProduct>) {
  return m && [m.product.name_fr, m.confidence];
}

test('what + adds: the usual amount, else the aisle\'s first unit', () => {
  assert.deepEqual(defaultAmount(product('lait', { default_aisle: 'dairy_eggs', default_unit: 'l', default_qty: 2 })), { quantity: 2, unit: 'l' });
  assert.deepEqual(defaultAmount(product('citronnelle', { default_aisle: 'produce', default_unit: 'stalk' })), { quantity: null, unit: 'stalk' });
  assert.deepEqual(defaultAmount(product('Swiffer', { default_aisle: 'household' })), { quantity: null, unit: 'pack' });
  assert.deepEqual(unitsFor(product('lait', { default_aisle: 'dairy_eggs', default_unit: 'l', suggested_units: ['bottle'] })), ['l', 'bottle']);
  assert.deepEqual(unitsFor(product('x', { default_aisle: 'drinks' })), ['bottle', 'pack', 'l']);
});

test('a new item\'s aisle comes from a product in its name', () => {
  const idx = new ProductIndex([product('citron', { default_aisle: 'produce' }), product('Lessive', { default_aisle: 'household' })]);
  assert.equal(suggestAisle(idx, 'Citrons bio'), 'produce');
  assert.equal(suggestAisle(idx, 'lessive écologique'), 'household');
  assert.equal(suggestAisle(idx, 'Swiffer'), null);
});

test('a group rule stands for every product of its ingredients', async () => {
  const { groupsFrom, ruleProductIds, searchGroups } = await import('../products.ts');
  const groups = groupsFrom(
    [
      { key: 'cow_milk', name_fr: 'Lait de vache et dérivés', name_en: "Cow's milk and dairy", aliases: ['yaourt', 'dairy'], position: 2 },
      { key: 'pork', name_fr: 'Porc (tout)', name_en: 'Pork (all)', aliases: ['charcuterie'], position: 1 },
    ],
    [
      { group_key: 'pork', ingredient: 'pork tenderloin' }, { group_key: 'pork', ingredient: 'sausage' },
      { group_key: 'pork', ingredient: 'bacon' }, { group_key: 'cow_milk', ingredient: 'butter' },
    ],
  );
  assert.deepEqual(groups.map((g) => g.key), ['pork', 'cow_milk']);
  const productOf = (i: string) => ({ 'pork tenderloin': 'p1', sausage: 'p2', butter: 'p3' } as Record<string, string>)[i];
  assert.deepEqual(ruleProductIds([{ product_id: null, group_key: 'pork' }, { product_id: 'x' }], groups, productOf).sort(), ['p1', 'p2', 'x']);
  assert.deepEqual(searchGroups(groups, 'porc').map((g) => g.key), ['pork']);
  assert.deepEqual(searchGroups(groups, 'Lait').map((g) => g.key), ['cow_milk']);
  assert.deepEqual(searchGroups(groups, 'yaourts').map((g) => g.key), ['cow_milk']);
  assert.deepEqual(searchGroups(groups, 'vache').map((g) => g.key), ['cow_milk']);
  assert.deepEqual(searchGroups(groups, 'chou').map((g) => g.key), []);
});
