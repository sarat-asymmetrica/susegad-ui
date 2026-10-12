import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelFor, currentIndex, matchLanguage, hreflangLinks, hreflangHtml, urlFor, pencilLine, tabTilt, AUTONYMS } from './lang.core.js';

test('each language is named in its own script', () => {
  assert.equal(labelFor('en-IN'), 'English');
  assert.equal(labelFor('gom-Deva'), 'कोंकणी');
  assert.equal(labelFor('gom-Latn'), 'Konknni');
  assert.equal(labelFor('kok-Deva'), 'कोंकणी', 'kok is gom');
  assert.equal(labelFor('kok-Latn'), 'Konknni');
  assert.equal(labelFor('en-GB'), 'English');
  assert.equal(labelFor('xx'), 'xx', 'an unknown tag is shown as written');
  assert.ok(Object.values(AUTONYMS).every(v => !/[A-Z]{3,}/.test(v)), 'names are not shouted');
});

test('the current language: exact first, then the same language in the same script, never another script', () => {
  const tags = ['en-IN', 'gom-Deva', 'gom-Latn'];
  assert.equal(currentIndex(tags, 'gom-Latn'), 2);
  assert.equal(currentIndex(tags, 'en-GB'), 0);
  assert.equal(currentIndex(tags, 'kok-Deva'), 1);
  assert.equal(currentIndex(tags, 'gom'), 1, 'bare gom is Devanagari');
  assert.equal(currentIndex(['en-IN', 'gom-Deva'], 'gom-Latn'), -1, 'no Romi page: do not call the Devanagari one current');
  assert.equal(currentIndex(tags, 'hi'), -1);
});

test('a browser list is matched to the offered pages, by language and script', () => {
  const av = ['en-IN', 'gom-Deva', 'gom-Latn'];
  assert.equal(matchLanguage(['hi', 'kok-Latn', 'en'], av), 'gom-Latn');
  assert.equal(matchLanguage(['fr', 'de'], av), null);
  assert.equal(matchLanguage([], av), null);
  assert.equal(matchLanguage(undefined, av), null);
});

test('hreflang links: one per language, and x-default points at the first, or at the one named', () => {
  const alts = [{ lang: 'en-in', href: 'https://e.in/' }, { lang: 'gom-deva', href: 'https://e.in/gom-deva/' }];
  const l = hreflangLinks(alts);
  assert.deepEqual(l.map(x => x.hreflang), ['en-IN', 'gom-Deva', 'x-default']);
  assert.equal(l[2].href, 'https://e.in/');
  assert.equal(hreflangLinks(alts, { xDefault: 'gom-Deva' }).at(-1).href, 'https://e.in/gom-deva/');
  assert.deepEqual(hreflangLinks([]), []);
  assert.throws(() => hreflangLinks([...alts, { lang: 'en-IN', href: '/x' }]), /twice/);
  assert.throws(() => hreflangLinks(alts, { xDefault: 'hi' }), /not one of/);
  assert.throws(() => hreflangLinks([{ lang: 'en-IN', href: '' }]), /no address/);
});

test('hreflang html: one link tag per line, attributes escaped', () => {
  const h = hreflangHtml([{ lang: 'en-IN', href: '/a?x=1&y="2"' }]).split('\n');
  assert.equal(h.length, 2);
  assert.equal(h[0], '<link rel="alternate" hreflang="en-IN" href="/a?x=1&amp;y=&quot;2&quot;">');
  assert.match(h[1], /hreflang="x-default"/);
});

test('urlFor: the prefix scheme (lower case) and the suffix scheme; the default language has neither', () => {
  assert.equal(urlFor('/', 'en-IN'), '/');
  assert.equal(urlFor('/', 'gom-Deva'), '/gom-deva/');
  assert.equal(urlFor('/events/', 'gom-Latn'), '/gom-latn/events/');
  assert.equal(urlFor('events/', 'gom-Latn'), '/gom-latn/events/');
  assert.equal(urlFor('demo.html', 'gom-Deva', { scheme: 'suffix' }), 'demo.gom-Deva.html');
  assert.equal(urlFor('demo.html', 'en-IN', { scheme: 'suffix' }), 'demo.html');
  assert.equal(urlFor('/talks/', 'gom-Deva', { scheme: 'suffix' }), '/talks/index.gom-Deva.html');
  assert.equal(urlFor('/', 'hi', { defaultLang: 'hi' }), '/');
});

test('the pencil line and the tabs are deterministic for a seed', () => {
  assert.deepEqual(pencilLine(80, 'x'), pencilLine(80, 'x'));
  assert.notDeepEqual(pencilLine(80, 'x'), pencilLine(80, 'y'));
  assert.equal(pencilLine(80, 'x').length, 2);
  assert.equal(tabTilt('a', 0), tabTilt('a', 0));
  for (let i = 0; i < 20; i++) assert.ok(Math.abs(tabTilt('s', i)) >= 0.5 && Math.abs(tabTilt('s', i)) <= 2);
});
