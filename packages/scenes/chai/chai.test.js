import test from 'node:test';
import assert from 'node:assert/strict';
import chai from './index.js';
import { model, curl, streamline, wispWindow, wispsAt, vineGeometry, vineGrowth, VINE_GEO, LOOKS, STEAM, STILL_TIME, GLASS, VINE } from './model.js';
import { meta } from './meta.js';
import { paramsFromAttributes } from '../../core/define-scene.js';

test('curl noise has no divergence: what flows in flows out', () => {
  for (const [x, y] of [[200, 200], [600, 100], [900, 300]]) {
    const e = 0.5, t = 3, z = 0.4;
    const dvx = (curl(x + e, y, t, z)[0] - curl(x - e, y, t, z)[0]) / (2 * e);
    const dvy = (curl(x, y + e, t, z)[1] - curl(x, y - e, t, z)[1]) / (2 * e);
    const scale = Math.hypot(...curl(x, y, t, z)) || 1;
    assert.ok(Math.abs(dvx + dvy) / scale < 0.05, `${x},${y}: ${dvx + dvy}`);
  }
});

test('steam rises: every streamline climbs', () => {
  const pts = streamline(GLASS.cx, GLASS.level - 4, 2, 0.37);
  assert.ok(pts.at(-1)[1] < pts[0][1] - 150);
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i][1] < pts[i - 1][1] + 1e-9);
});

test('a wisp is a window that slides up its streamline and fades', () => {
  const pts = streamline(GLASS.cx, GLASS.level, 1, 0.1);
  const early = wispWindow(pts, 0.5, STEAM.life), late = wispWindow(pts, 3, STEAM.life);
  assert.ok(late.at(-1)[1] < early.at(-1)[1]);
  const w = wispsAt(10);
  assert.ok(w.length >= 4 && w.length <= 7, `${w.length} wisps`);
  for (const { age, alpha } of w) { assert.ok(age >= 0 && age <= STEAM.life); assert.ok(alpha >= 0 && alpha <= 0.62); }
});

test('the creeper grows along its rule in order and is grown by 3.4 s', () => {
  const g = vineGeometry();
  assert.deepEqual(g.leaves, VINE_GEO.leaves);
  assert.ok(g.stem.length > VINE.x1 - VINE.x0);
  for (let i = 1; i < g.leaves.length; i++) assert.ok(g.leaves[i].d >= g.leaves[i - 1].d);
  assert.ok(Math.abs(vineGrowth(0)) < 1e-12); assert.ok(Math.abs(vineGrowth(3.4) - 1) < 1e-12);
  assert.ok(vineGrowth(1) < vineGrowth(2));
});

test('lit is the lamp’s state; every register’s still is the plate’s moment', () => {
  assert.equal(model({ params: { lit: false } }).lit, false);
  assert.equal(model({ params: {} }).lit, true);
  assert.equal(paramsFromAttributes(chai.params, n => (n === 'lit' ? 'false' : null)).lit, false);
  for (const r of ['quiet', 'warm', 'playful']) assert.equal(model({ time: STILL_TIME, register: r }).t, STILL_TIME);
  assert.ok(LOOKS.warm.pace < LOOKS.playful.pace && !LOOKS.warm.hand && LOOKS.playful.hand);
});

test('words', () => {
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
});
