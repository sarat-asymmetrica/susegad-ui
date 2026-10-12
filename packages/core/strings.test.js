import { test } from 'node:test';
import assert from 'node:assert/strict';
import { langOfKey, normalizeTag, scriptOf, languageOf, sameLanguage, langOf, chain, strings, t, unreviewed } from './strings.js';
import { BY_LANG, REVIEWED } from './strings.table.js';

test('tags are written in their canonical case, and rubbish is English', () => {
  assert.equal(normalizeTag('GOM-deva'), 'gom-Deva');
  assert.equal(normalizeTag('en_in'), 'en-IN');
  assert.equal(normalizeTag(''), 'en');
  assert.equal(normalizeTag('12'), 'en');
  assert.equal(normalizeTag(null), 'en');
});

test('a tag names its script; Konkani with none is Devanagari', () => {
  assert.equal(scriptOf('gom-Latn'), 'Latn');
  assert.equal(scriptOf('gom-Deva'), 'Deva');
  assert.equal(scriptOf('gom'), 'Deva');
  assert.equal(scriptOf('kok'), 'Deva');
  assert.equal(scriptOf('en-IN'), 'Latn');
  assert.equal(scriptOf('kn'), 'Knda');
  assert.equal(languageOf('gom-Latn'), 'gom');
});

test('kok and gom are one language; Hindi is not', () => {
  assert.ok(sameLanguage('kok-Deva', 'gom-Deva'));
  assert.ok(sameLanguage('gom', 'gom-Latn'));
  assert.ok(!sameLanguage('hi', 'gom'));
});

test('the chain never crosses a script', () => {
  assert.deepEqual(chain('gom-Deva'), ['gom-Deva', 'kok-Deva', 'gom', 'kok', 'en']);
  assert.deepEqual(chain('gom-Latn'), ['gom-Latn', 'kok-Latn', 'en']);
  assert.deepEqual(chain('kok-Latn'), ['kok-Latn', 'gom-Latn', 'en']);
  assert.deepEqual(chain('en-IN'), ['en-IN', 'en']);
  assert.deepEqual(chain('en'), ['en']);
  assert.ok(!chain('gom-Latn').includes('gom'), 'bare gom is Devanagari');
});

test('a table is the chain laid over English: a missing Konkani key is English', () => {
  const by = { en: { a: 'A', b: 'B' }, 'gom-Deva': { a: 'अ' }, kok: { b: 'ब' }, 'gom-Latn': { a: 'a-latn' } };
  assert.deepEqual(strings(by, 'gom-Deva'), { a: 'अ', b: 'ब' });
  assert.deepEqual(strings(by, 'gom-Latn'), { a: 'a-latn', b: 'B' }, 'Romi does not borrow the Devanagari kok table');
  assert.deepEqual(strings(by, 'kok-Deva'), { a: 'अ', b: 'ब' }, 'a kok page reads the gom table of its script');
  assert.deepEqual(strings(by, 'fr'), { a: 'A', b: 'B' });
});

test('a value says which language it came from, so fallback text is not claimed for the page', () => {
  const by = { en: { a: 'A', b: 'B' }, 'gom-Deva': { a: 'अ' }, 'gom-Latn': {} };
  assert.equal(langOfKey(by, 'gom-Deva', 'a'), 'gom-Deva');
  assert.equal(langOfKey(by, 'gom-Deva', 'b'), 'en', 'no Konkani for b: it is English');
  assert.equal(langOfKey(by, 'gom-Latn', 'a'), 'en', 'Romi never borrows the Devanagari table');
  assert.equal(langOfKey(by, 'en-IN', 'a'), 'en');
  assert.equal(langOfKey(by, 'gom-Deva', 'nope'), 'en');
});

test('t gives a string, a function result, or the key itself so a gap is seen', () => {
  const s = { close: 'Close', n: (a, b) => `${a} of ${b}` };
  assert.equal(t(s, 'close'), 'Close');
  assert.equal(t(s, 'n', 2, 5), '2 of 5');
  assert.equal(t(s, 'nope'), 'nope');
});

test('langOf reads the nearest lang, then the root', () => {
  const root = { getAttribute: k => (k === 'lang' ? 'en-IN' : null) };
  const doc = { documentElement: root };
  const span = { closest: () => ({ getAttribute: () => 'gom-deva' }), ownerDocument: doc };
  const bare = { closest: () => null, ownerDocument: doc };
  assert.equal(langOf(span), 'gom-Deva');
  assert.equal(langOf(bare), 'en-IN');
  assert.equal(langOf(null), 'en');
});

test('the shared table: every Konkani key has English, REVIEWED is a subset of what is written, and unchecked is exactly written minus reviewed (a key with no draft falls back to English and is listed by tools/strings-review.mjs)', () => {
  for (const tag of Object.keys(BY_LANG).filter(t => t !== 'en')) {
    const u = unreviewed(BY_LANG, tag, REVIEWED);
    for (const k of Object.keys(BY_LANG[tag])) assert.ok(k in BY_LANG.en, `${tag}:${k} has no English`);
    const reviewedHere = Object.keys(BY_LANG[tag]).filter(k => REVIEWED.has(`${tag}:${k}`));
    assert.deepEqual(u.unchecked.sort(), Object.keys(BY_LANG[tag]).filter(k => !reviewedHere.includes(k)).sort(), 'unchecked is exactly the written keys that are not reviewed');
  }
  for (const k of REVIEWED) { const [tag, key] = k.split(':'); assert.ok(BY_LANG[tag]?.[key] != null, `${k} is reviewed but not written`); }
});

test('unreviewed() takes a readers word key by key', () => {
  const by = { en: { a: 'A', b: 'B' }, 'gom-Deva': { a: 'अ', b: 'ब' } };
  assert.deepEqual(unreviewed(by, 'gom-Deva', new Set()).unchecked, ['a', 'b']);
  assert.deepEqual(unreviewed(by, 'gom-Deva', new Set(['gom-Deva:a'])).unchecked, ['b']);
  assert.deepEqual(unreviewed(by, 'gom-Deva', new Set(['gom-Latn:a'])).unchecked, ['a', 'b'], 'another tag review does not count');
  assert.deepEqual(unreviewed({ en: { a: 'A', b: 'B' }, 'gom-Deva': { a: 'अ' } }, 'gom-Deva').missing, ['b']);
});

test('English has no em dash and no empty entry', () => {
  for (const [k, v] of Object.entries(BY_LANG.en)) assert.ok(v && !/—/.test(v), k);
});
