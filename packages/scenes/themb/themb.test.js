import test from 'node:test';
import assert from 'node:assert/strict';
import themb from './index.js';
import { createLeaf, leafAt, leafR, leafSd, leafHeight, areaOf, LOOKS, STILL_TIME, STEP, LC, TIPA, leafTime, model, clearMemo, inCalm } from './model.js';
import { meta } from './meta.js';
import { paramsFromAttributes } from '../../core/define-scene.js';

const run = (seed, secs, look = LOOKS.playful, each = null) => {
  const s = createLeaf(seed, look);
  for (let t = 0; t < secs; t += STEP) { s.step(STEP, null); each?.(s); }
  return s;
};
const snap = s => s.beads.map(b => [b.x, b.y, b.r].map(v => +v.toFixed(6)));

test('the leaf: a heart with a pointed tip, the cup lowest at the join', () => {
  assert.ok(leafR(0) > leafR(Math.PI / 2), 'the tip reaches further than the sides');
  assert.ok(leafR(Math.PI) < leafR(Math.PI / 2) * 0.4, 'the notch where the stalk joins');
  assert.ok(leafSd(LC[0], LC[1]) < 0 && leafSd(5, 5) > 0);
  const tip = [LC[0] + Math.cos(TIPA) * 300, LC[1] + Math.sin(TIPA) * 300];
  assert.ok(leafHeight(LC[0] + 1, LC[1], [0, 0]) < leafHeight(LC[0] + 120, LC[1] - 120, [0, 0]), 'the cup');
  assert.ok(leafHeight(...tip, [0, 0]) < leafHeight(LC[0] - 200, LC[1] - 80, [0, 0]), 'the droop toward the tip');
});

test('same seed, same water; different seeds differ', () => {
  assert.deepEqual(snap(run(3, 8)), snap(run(3, 8)));
  assert.notDeepEqual(snap(run(3, 8)), snap(run(4, 8)));
});

test('merging keeps the total area: water only arrives by rain and leaves over the edge', () => {
  const s = createLeaf(2);
  let merges = 0;
  for (let t = 0; t < 14; t += STEP) {
    const before = areaOf(s.beads), m0 = s.merged, landing = s.incoming.filter(d => s.t + STEP >= d.at).reduce((a, d) => a + d.r * d.r, 0);
    const falling = new Set(s.beads.filter(b => b.fall >= 0));
    s.step(STEP, null);
    const fell = s.beads.filter(b => b.fall >= 0 && !falling.has(b)).reduce((a, b) => a + b.r * b.r, 0);
    if (s.merged > m0) merges += s.merged - m0;
    assert.ok(Math.abs(areaOf(s.beads) - (before + landing - fell)) < 1e-6 * Math.max(1, before), `t=${s.t.toFixed(3)}`);
  }
  assert.ok(merges > 3, `${merges} merges seen`);
});

test('the pour empties the cup: after a dip the water on the leaf is far less', () => {
  const s = run(1, 12);
  const full = areaOf(s.beads);
  s.pour();
  for (let t = 0; t < 8; t += STEP) s.step(STEP, null);
  assert.ok(full > 800, `water before ${full.toFixed(0)}`);
  assert.ok(areaOf(s.beads) < full * 0.5, `${full.toFixed(0)} before, ${areaOf(s.beads).toFixed(0)} after`);
});

test('a tilt rolls the water toward the low side', () => {
  const a = run(5, 10), b = createLeaf(5);
  for (let t = 0; t < 10; t += STEP) b.step(STEP, t > 5 ? [0.17, 0] : null);
  const cx = s => { const live = s.beads.filter(x => x.fall < 0); return live.reduce((m, x) => m + x.x * x.r * x.r, 0) / Math.max(1, areaOf(s.beads)); };
  assert.ok(cx(b) > cx(a) + 20, `centre of water ${cx(a).toFixed(0)} flat, ${cx(b).toFixed(0)} tilted`);
});

test('the calm zone: no drop lands under the words, and beads are pushed out', () => {
  const box = { x: 380, y: 280, w: 360, h: 200 };
  const s = createLeaf(1); s.calm = [box];
  for (let t = 0; t < 16; t += STEP) {
    s.step(STEP, null);
    for (const d of s.incoming) assert.ok(!inCalm(d.x, d.y, [box], 20), `drop at ${d.x | 0},${d.y | 0}`);
  }
  const under = s.beads.filter(b => b.fall < 0 && inCalm(b.x, b.y, [box]));
  assert.ok(under.length === 0, `${under.length} beads under the words`);
});

test('leafAt: memoised and deterministic; inputs replay exactly; going back steps again from zero', () => {
  clearMemo();
  const inputs = [{ t: 16, tilt: [0.1, 0.05] }, { t: 17, act: 'pour' }];
  const a = snap(leafAt({ seed: 2, register: 'playful', time: 18, inputs }));
  const later = leafAt({ seed: 2, register: 'playful', time: 20, inputs });
  assert.ok(later.t > 19.9);
  clearMemo();
  assert.deepEqual(snap(leafAt({ seed: 2, register: 'playful', time: 18, inputs })), a);
  assert.deepEqual(snap(leafAt({ seed: 2, register: 'playful', time: 18, inputs: [] })), snap(leafAt({ seed: 2, register: 'playful', time: 18, inputs: [] })));
  assert.notDeepEqual(snap(leafAt({ seed: 2, register: 'playful', time: 18, inputs: [] })), a, 'the hands changed the water');
});

test('every register’s still is the plate’s moment, and warm rains more gently', () => {
  for (const r of ['quiet', 'warm', 'playful']) assert.equal(leafTime(STILL_TIME, r), STILL_TIME, r);
  assert.ok(LOOKS.warm.pace < LOOKS.playful.pace && LOOKS.warm.rain < LOOKS.playful.rain);
  assert.ok(!LOOKS.warm.touch && LOOKS.playful.touch);
  assert.deepEqual(model({ register: 'nope' }).look, LOOKS.warm);
});

test('the renderer attribute is a closed list', () => {
  assert.equal(paramsFromAttributes(themb.params, a => (a === 'renderer' ? '2d' : null)).renderer, '2d');
  assert.equal(paramsFromAttributes(themb.params, a => (a === 'renderer' ? 'gpu' : null)).renderer, 'auto');
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
});
