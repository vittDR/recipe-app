import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TAGS, TagCatalog, newTagName, tagKey, type TagEntry } from '../tags.ts';

const entry = (name: string, over: Partial<TagEntry> = {}): TagEntry => ({
  name, household_id: null, kind: 'tag', name_en: null, name_fr: null, aliases: [], ...over,
});

const tags = new TagCatalog([
  entry('stew', { name_en: 'Stew', name_fr: 'Mijoté', aliases: ['plat mijoté', 'ragoût'] }),
  entry('one-pot', { name_en: 'One-pot', name_fr: 'Tout-en-un', aliases: ['one pot'] }),
  entry('quick', { name_en: 'Quick', name_fr: 'Rapide' }),
  entry('chicken', { kind: 'ingredient', name_fr: 'Poulet', aliases: ['volaille'] }),
  entry('dinner', { kind: 'noise', aliases: ['plat principal'] }),
  entry('jour de match', { household_id: 'h1', name_fr: 'Jour de match' }),
  entry('stew', { household_id: 'h1', name_fr: 'Notre mijoté' }),
]);

test('keys ignore case, accents and punctuation', () => {
  assert.equal(tagKey('Plat Mijoté!'), 'plat mijote');
  assert.equal(tagKey('one-pot'), tagKey('One pot'));
  assert.equal(newTagName('  Jour   de Match '), 'jour de match');
});

test('words in any language find their tag; shared tags win', () => {
  assert.equal(tags.find('Ragoût')?.name, 'stew');
  assert.equal(tags.find('stew')?.household_id, null);
  assert.equal(tags.find('ONE POT')?.name, 'one-pot');
  assert.equal(tags.find('jour de match')?.household_id, 'h1');
});

test('labels follow the language, falling back to the other one, then the name', () => {
  assert.equal(tags.label('stew', 'fr'), 'Mijoté');
  assert.equal(tags.label('stew', 'en'), 'Stew');
  assert.equal(tags.label('jour de match', 'en'), 'Jour de match');
  assert.equal(tags.label('unknown thing', 'fr'), 'Unknown thing');
  assert.ok(tags.untranslated('jour de match', 'en'));
  assert.ok(!tags.untranslated('jour de match', 'fr'));
});

test('normalise maps to names, drops ingredients and noise, keeps new tags', () => {
  assert.deepEqual(tags.normalise(['Plat principal', 'Poulet', 'rapide', 'Ragoût', 'stew', 'Pique-nique', 'volaille', '']), {
    tags: ['quick', 'stew', 'pique-nique'], unknown: ['pique-nique'],
  });
  assert.equal(tags.normalise(Array.from({ length: 20 }, (_, i) => `tag ${i}`)).tags.length, MAX_TAGS);
});

test('choices list real tags only, sorted by label', () => {
  assert.deepEqual(tags.choices('fr').map((c) => c.label), ['Jour de match', 'Mijoté', 'Rapide', 'Tout-en-un']);
});
