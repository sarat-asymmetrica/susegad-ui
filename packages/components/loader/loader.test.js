import test from 'node:test';
import assert from 'node:assert/strict';
import { loaderText, STRINGS } from './loader.js';
import { kolamLap } from './skins/warm.js';
import { BODY, BANDS } from './skins/playful.js';

test('the page\'s words win; otherwise the register has its own', () => {
  assert.equal(loaderText({ label: 'Loading your bookings', register: 'playful' }), 'Loading your bookings');
  assert.equal(loaderText({ text: '  Checking the calendar ' }), 'Checking the calendar');
  assert.equal(loaderText({ label: 'A', text: 'B' }), 'A', 'the label attribute beats the text');
  for (const r of ['quiet', 'warm', 'playful']) assert.equal(loaderText({ register: r }), STRINGS.loading[r]);
  assert.equal(loaderText({ register: 'unknown' }), STRINGS.loading.warm);
});

test('copy: sentence case, no em dashes', () => {
  for (const v of Object.values(STRINGS.loading)) { assert.ok(!v.includes('\u2014')); assert.equal(v[0], v[0].toUpperCase()); }
});

test('warm: every dot has a place on the lap, in [0, 1)', () => {
  const k = kolamLap();
  assert.equal(k.phases.length, k.dots.length);
  for (const p of k.phases) assert.ok(p >= 0 && p < 1);
  assert.ok(new Set(k.phases.map(p => p.toFixed(3))).size > k.dots.length / 2, 'the dots are reached at different moments');
  assert.deepEqual(kolamLap(), k);
});

test('playful: the top is one closed outline with its bands', () => {
  assert.match(BODY, /^M.*Z$/);
  assert.ok(BANDS.length >= 3);
});
