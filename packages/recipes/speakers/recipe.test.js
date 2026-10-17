import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, tracksOf, tracksToQuery, visibleFor } from './recipe.js';

const people = [
  { name: 'Priyanka Naik', track: 'AI for Kids', words: 'priyanka naik' },
  { name: 'Melwyn Fernandes', track: 'Tech for Good', words: 'melwyn fernandes' },
  { name: 'Deepa Shirodkar', track: 'Tech for Good', words: 'deepa shirodkar' },
];

test('the ticked tracks read back from a query string', () => {
  assert.deepEqual(tracksOf(new URLSearchParams('?track=AI%20for%20Kids,Tech%20for%20Good')), ['AI for Kids', 'Tech for Good']);
  assert.deepEqual(tracksOf(new URLSearchParams('')), []);
  assert.deepEqual(tracksOf(new URLSearchParams('?track=')), []);
});

test('tracks write back to a query, and nothing ticked writes nothing', () => {
  assert.equal(tracksToQuery([]).toString(), '');
  assert.deepEqual(tracksOf(tracksToQuery(['AI for Kids', 'Tech for Good'])), ['AI for Kids', 'Tech for Good']);
});

test('nothing ticked shows every speaker; a ticked track keeps only its own', () => {
  assert.deepEqual(visibleFor(people, []), [true, true, true]);
  assert.deepEqual(visibleFor(people, ['Tech for Good']), [false, true, true]);
  assert.deepEqual(visibleFor(people, ['AI for Kids', 'Tech for Good']), [true, true, true]);
  assert.deepEqual(visibleFor(people, ['Workshops for Founders']), [false, false, false]);
});

test('the count and the empty line are plain and kind', () => {
  assert.equal(STRINGS.shown(1), 'Showing 1 speaker');
  assert.equal(STRINGS.shown(7), 'Showing 7 speakers');
  assert.equal(STRINGS.empty, 'No speaker is on that track yet. Try another track, or clear them all.');
});

import { urlWithTracks } from './recipe.js';

test('ticking a track changes only ?track: every other parameter and the hash stay', () => {
  const href = 'https://x.example/speakers?register=warm&lang=kok&utm_source=poster&track=AI%20for%20Kids#speakers';
  const two = new URL(urlWithTracks(href, ['AI for Kids', 'Tech for Good']));
  assert.equal(two.searchParams.get('register'), 'warm');
  assert.equal(two.searchParams.get('lang'), 'kok');
  assert.equal(two.searchParams.get('utm_source'), 'poster');
  assert.equal(two.searchParams.get('track'), 'AI for Kids,Tech for Good');
  assert.equal(two.hash, '#speakers');
  const none = new URL(urlWithTracks(href, []));
  assert.equal(none.searchParams.has('track'), false);
  assert.equal(none.searchParams.get('lang'), 'kok');
  assert.equal(none.search, '?register=warm&lang=kok&utm_source=poster');
});

import { BY_LANG } from './recipe.strings.js';
import { strings } from '../../core/strings.js';

test('the Konkani count keeps its one-versus-many branch in both scripts', () => {
  const deva = strings(BY_LANG, 'gom-Deva'), latn = strings(BY_LANG, 'gom-Latn');
  assert.equal(deva.shown(1), '1 उलोवपो दाखयला');
  assert.equal(deva.shown(7), '7 उलोवपी दाखयल्यात');
  assert.equal(latn.shown(1), '1 ulovpo dakhoilo');
  assert.equal(latn.shown(7), '7 ulovpi dakhoilyat');
  for (const S of [deva, latn]) assert.notEqual(S.shown(1).replace(/^1 /, ''), S.shown(2).replace(/^2 /, ''), 'the singular is its own word, not the plural with a different number');
});
