import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  shouldSay, heardKey, expiryOf, isExpired, phaseOf, hashText, storageKey, safeStore, wasDismissed, rememberDismissed, dateText, announcement,
} from './banner.core.js';
import { BY_LANG } from './banner.strings.js';
import { strings } from '../../core/strings.js';
import { parseWhen } from '../../core/intl.core.js';

const at = text => parseWhen(text); // an IST wall-clock time

test('until: a date alone is the whole of that IST day; a time is that moment', () => {
  assert.equal(expiryOf('2026-10-01'), at('2026-10-02T00:00'));
  assert.equal(expiryOf('2026-10-01T18:00'), at('2026-10-01T18:00'));
  assert.equal(expiryOf(' 2026-10-01 '), at('2026-10-02T00:00'), 'spaces around it are fine');
  for (const bad of [undefined, null, '', 'soon', '2026-02-30', '1 October']) assert.ok(Number.isNaN(expiryOf(bad)), String(bad));
});

test('a banner goes at the end of its day in IST, whatever zone the visitor is in', () => {
  // 11:59 pm on 1 October in Panjim is 6:29 pm UTC, and 2:29 pm in New York: the same banner, still showing
  assert.equal(isExpired('2026-10-01', at('2026-10-01T23:59')), false);
  assert.equal(isExpired('2026-10-01', at('2026-10-02T00:00')), true);
  // 12:30 am on 2 October in Panjim is 1 October at 7:00 pm UTC: expired here, though the UTC date is still the 1st
  assert.equal(isExpired('2026-10-01', Date.UTC(2026, 9, 1, 19, 0)), true);
  assert.equal(isExpired('2026-10-01', Date.UTC(2026, 9, 1, 18, 0)), false, '11:30 pm in Panjim');
  assert.equal(isExpired('2026-10-01T18:00', at('2026-10-01T17:59')), false);
  assert.equal(isExpired('2026-10-01T18:00', at('2026-10-01T18:00')), true);
  assert.equal(isExpired(undefined, 9e15), false, 'no until: never');
  assert.equal(isExpired('soon', 9e15), false, 'a bad until never hides a banner');
});

test('the same answers in other machine zones', () => {
  const file = fileURLToPath(new URL('./banner.core.js', import.meta.url));
  const probe = `import('${new URL('./banner.core.js', import.meta.url).href}').then(m => console.log(m.isExpired('2026-10-01', ${at('2026-10-01T23:59')}), m.isExpired('2026-10-01', ${at('2026-10-02T00:00')}), m.dateText('2026-10-01', 'en')))`;
  for (const TZ of ['America/New_York', 'Pacific/Auckland', 'Europe/London']) {
    const out = execFileSync(process.execPath, ['-e', probe], { env: { ...process.env, TZ }, encoding: 'utf8' }).trim();
    assert.equal(out, 'false true 1 October', TZ);
  }
  assert.ok(file);
});

test('expired beats dismissed beats shown', () => {
  assert.equal(phaseOf(), 'shown');
  assert.equal(phaseOf({ dismissed: true }), 'dismissed');
  assert.equal(phaseOf({ expired: true }), 'expired');
  assert.equal(phaseOf({ expired: true, dismissed: true }), 'expired');
});

test('a banner with no id is keyed by its words, so new words show again', () => {
  assert.equal(hashText('Closed for the monsoon'), hashText('  Closed   for the\nmonsoon '), 'whitespace does not matter');
  assert.notEqual(hashText('Closed for the monsoon'), hashText('Open again'));
  assert.equal(storageKey('monsoon', 'anything'), 'sg-banner:monsoon', 'an id wins');
  assert.equal(storageKey('', 'Closed'), `sg-banner:${hashText('Closed')}`);
  assert.match(storageKey(undefined, 'x'), /^sg-banner:[0-9a-z]+$/);
});

test('storage that works remembers a dismissal', () => {
  const data = new Map();
  const store = safeStore(() => ({ getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }));
  assert.equal(wasDismissed(store, 'sg-banner:a'), false);
  assert.equal(rememberDismissed(store, 'sg-banner:a', 1234), true);
  assert.equal(wasDismissed(store, 'sg-banner:a'), true);
  assert.equal(data.get('sg-banner:a'), '1234');
  assert.equal(wasDismissed(store, 'sg-banner:b'), false, 'another banner is not dismissed');
  store.remove('sg-banner:a');
  assert.equal(wasDismissed(store, 'sg-banner:a'), false);
});

test('storage that is missing or blocked never throws, and reads as not dismissed', () => {
  const blocked = safeStore(() => { throw new DOMException('blocked', 'SecurityError'); });
  assert.equal(wasDismissed(blocked, 'k'), false);
  assert.equal(rememberDismissed(blocked, 'k', 1), false, 'the write says it was not kept');
  assert.equal(blocked.remove('k'), false);
  const none = safeStore(() => undefined);
  assert.equal(wasDismissed(none, 'k'), false);
  assert.equal(rememberDismissed(none, 'k', 1), false);
  const full = safeStore(() => ({ getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); }, removeItem() {} }));
  assert.equal(rememberDismissed(full, 'k', 1), false);
  assert.equal(wasDismissed(full, 'k'), false);
});

test('dates print as words, in IST, in the page’s language', () => {
  assert.equal(dateText('2026-10-01', 'en'), '1 October');
  assert.equal(dateText('2026-11-21T19:00', 'en-IN'), '21 November');
  assert.equal(dateText('2026-12-05', 'fr'), '5 December', 'another language reads in English for now');
  assert.equal(dateText('2026-10-01', 'gom-Deva'), '1 ऑक्टोबर');
  assert.equal(dateText('2026-10-01', 'gom-Latn'), '1 Otubr');
  assert.equal(dateText('2026-11-21', 'kok'), '21 नोव्हेंबर');
  assert.equal(dateText('2026-02-30', 'en'), '');
  assert.equal(dateText('soon', 'gom-Deva'), '');
  // an instant that is the previous day in UTC is still the venue's day
  assert.equal(dateText('2026-10-01T00:30:00+05:30', 'en'), '1 October');
});

test('the words: English is the base and each Konkani script has every key', () => {
  const keys = Object.keys(BY_LANG.en);
  for (const tag of ['gom-Deva', 'gom-Latn']) assert.deepEqual(Object.keys(BY_LANG[tag]), keys, tag);
  assert.equal(strings(BY_LANG, 'en-IN').dismiss, 'Dismiss this announcement');
  assert.equal(strings(BY_LANG, 'gom-Deva').dismiss, 'ही सूचना बंद करचीं');
  assert.equal(strings(BY_LANG, 'gom-Latn').label, 'Suchona', 'Romi never borrows Devanagari');
  assert.equal(strings(BY_LANG, 'hi').label, 'Announcement', 'a language with no words reads in English');
});

test('what a screen reader hears, once', () => {
  const S = strings(BY_LANG, 'en');
  assert.equal(announcement(S, '  Closed for the monsoon,\n back 1 October '), 'Announcement: Closed for the monsoon, back 1 October');
  assert.equal(announcement(S, ''), '');
  assert.equal(announcement(strings(BY_LANG, 'gom-Latn'), 'Pausallea khatir bond'), 'Suchona: Pausallea khatir bond');
  assert.equal(S.back('1 October'), 'Back 1 October');
  assert.equal(strings(BY_LANG, 'gom-Deva').back('1 ऑक्टोबर'), '1 ऑक्टोबर परत');
});

// ── the shapes the skins draw ──
import { rulePaths } from './skins/warm.js';
import { bunting, COLOURS } from './skins/playful.js';

test('the pencil rule is two strokes, the same for a seed and different for another', () => {
  const a = rulePaths(600, 7), b = rulePaths(600, 7), c = rulePaths(600, 8);
  assert.equal(a.length, 2);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  for (const d of a) assert.match(d, /^M[\d.]+ [\d.]+( Q[\d.]+ [\d.]+ [\d.]+ [\d.]+)+$/);
  const xs = d => [...d.matchAll(/[MQ ]([\d.]+) [\d.]+/g)].map(m => +m[1]);
  assert.ok(Math.max(...xs(a[0])) <= 600 && Math.min(...xs(a[0])) >= 0, 'the long rule stays inside the strip');
  assert.ok(rulePaths(10, 1).length === 2, 'a tiny width still draws');
});

test('the bunting hangs flags along a sagging string, inside the width, in the palette’s colours', () => {
  const { string, flags } = bunting(600, 3);
  assert.match(string, /^M0 3 Q300 17 600 3$/);
  assert.ok(flags.length >= 20 && flags.length <= 30, `${flags.length} flags across 600`);
  for (const f of flags) {
    assert.ok(COLOURS.includes(f.colour));
    const nums = [...f.d.matchAll(/[\d.]+/g)].map(m => +m[0]);
    assert.ok(Math.max(...nums.filter((_, i) => i % 2 === 0)) <= 600, 'a flag does not leave the strip');
    assert.ok(Math.max(...nums.filter((_, i) => i % 2 === 1)) < 24, 'a flag fits the 24-unit box');
  }
  assert.deepEqual(flags.map(f => f.colour).slice(0, COLOURS.length), COLOURS, 'the colours go round in order');
  assert.deepEqual(bunting(600, 3), bunting(600, 3), 'same seed, same bunting');
  assert.notDeepEqual(bunting(600, 3).flags.map(f => f.d), bunting(600, 4).flags.map(f => f.d));
  assert.ok(bunting(390, 3).flags.length < flags.length, 'a narrower strip hangs fewer');
});

test('said once per visit: the first page says it, the pages after it in the same tab do not, new tab starts again', () => {
  const data = new Map(), mk = () => safeStore(() => ({ getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }));
  const key = 'sg-banner:doors';
  assert.equal(shouldSay(mk(), key), true, 'the first page of the visit');
  assert.equal(shouldSay(mk(), key), false, 'the second page, a new page object but the same session');
  assert.equal(shouldSay(mk(), key), false);
  assert.equal(shouldSay(mk(), 'sg-banner:other'), true, 'another banner is another announcement');
  assert.ok(data.has(heardKey(key)));
  data.clear();
  assert.equal(shouldSay(mk(), key), true, 'a new tab is a new visit');
});

test('with no session storage there is no memory, so it is said on every page load', () => {
  const none = safeStore(() => { throw new DOMException('blocked', 'SecurityError'); });
  assert.equal(shouldSay(none, 'k'), true);
  assert.equal(shouldSay(none, 'k'), true);
  assert.equal(shouldSay(safeStore(() => undefined), 'k'), true);
});
