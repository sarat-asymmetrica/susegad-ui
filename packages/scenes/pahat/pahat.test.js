import test from 'node:test';
import assert from 'node:assert/strict';
import { model, dawn, skyAt, sky, DAWN, STILL_U, SKY } from './model.js';
import { hexToRgb } from '../../engine/index.js';

const lum = hex => hexToRgb(hex).reduce((a, b) => a + b, 0);

test('skyAt: indigo at the start, first light at the end, the stops themselves exactly', () => {
  for (const s of SKY) assert.deepEqual(skyAt(s.u), { top: s.top, hor: s.hor });
  assert.deepEqual(skyAt(-1), skyAt(0));
  assert.deepEqual(skyAt(2), skyAt(1));
});

test('the sky only ever gets lighter through the dawn', () => {
  let prev = -1;
  for (let u = 0; u <= 1.0001; u += 0.02) { const l = lum(skyAt(u).top) + lum(skyAt(u).hor); assert.ok(l >= prev, `darker at ${u.toFixed(2)}`); prev = l; }
});

test('stars fade first; the morning star holds on longest', () => {
  const at = u => dawn(u, 0, 1, 0);
  assert.equal(at(0).stars, 1);
  assert.equal(at(0.75).stars, 0);
  assert.ok(at(0.75).venus > 0.9);
  assert.equal(at(1).venus, 0);
});

test('warm: time drives the dawn, and the scene rests once the birds have gone', () => {
  assert.equal(model({ time: 0, register: 'warm' }).u, 0);
  assert.equal(model({ time: DAWN.warm / 2, register: 'warm' }).u, 0.5);
  let settledAt = null;
  for (let t = 0; t < 120; t += 0.25) if (model({ time: t, register: 'warm' }).settled) { settledAt = t; break; }
  assert.ok(settledAt !== null && settledAt >= DAWN.warm, `settled at ${settledAt}`);
  assert.equal(model({ time: settledAt + 50, register: 'warm' }).birds.length, 0);
});

test('birds cross once, only in the light', () => {
  assert.equal(model({ time: 5, register: 'warm' }).birds.length, 0);
  const counts = [];
  for (let t = 0; t < 60; t += 1) counts.push(model({ time: t, register: 'warm' }).birds.length);
  const first = counts.findIndex(n => n > 0), last = counts.length - 1 - [...counts].reverse().findIndex(n => n > 0);
  assert.ok(first > 0 && last < 59 && counts.slice(first, last + 1).every(n => n > 0), counts.join(''));
});

test('quiet: first light, still', () => {
  const q = model({ time: 0, register: 'quiet' });
  assert.equal(q.u, STILL_U);
  assert.equal(q.settled, true);
});

test('playful never settles, so a hand can move the dawn at any time', () => {
  assert.equal(model({ time: 999, register: 'playful' }).settled, false);
});

test('sky: seeded stars, palms and morning star', () => {
  assert.deepEqual(sky(4), sky(4));
  assert.notDeepEqual(sky(4).venus, sky(5).venus);
});
