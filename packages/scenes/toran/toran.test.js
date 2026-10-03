import test from 'node:test';
import assert from 'node:assert/strict';
import toran from './index.js';
import {
  sweepStrokes, buildToran, settle, step, createDoorway, doorwayAt, clearMemo, tapStrokes, stepPetals, makePetal, model, LOOKS,
  HSTEP, NAILS, STEP, OPEN, W, H,
} from './model.js';
import { rng } from '../../engine/index.js';
import { meta } from './meta.js';

/** Worst stretch of any (non-minimum) link, as a share of its length. */
function worstStretch(sim) {
  let worst = 0;
  for (const c of sim.C) {
    if (c.min) continue;
    const A = sim.P[c.a], B = sim.P[c.b];
    worst = Math.max(worst, Math.abs(Math.hypot(B.x - A.x, B.y - A.y) - c.len) / c.len);
  }
  return worst;
}

test('buildToran: the same seed strings the same garland; another seed another', () => {
  assert.deepEqual(buildToran(3), buildToran(3));
  assert.notDeepEqual(buildToran(1).P.map(p => p.y), buildToran(2).P.map(p => p.y));
});

test('buildToran: two swags and three strands, pinned to the three nails, with leaves', () => {
  const s = buildToran(1);
  assert.equal(s.chains.filter(c => c.kind === 'swag').length, 2);
  assert.equal(s.chains.filter(c => c.kind === 'strand').length, 3);
  const pins = s.P.filter(p => p.pin).map(p => p.pin.join(','));
  for (const n of NAILS) assert.ok(pins.includes(n.join(',')), `pinned at ${n}`);
  assert.ok(s.leaves.length > 20 && s.flowers.length > 60, `${s.leaves.length} leaves, ${s.flowers.length} flowers`);
});

test('the rope keeps its length within 2%, at rest and in a gusty minute', () => {
  const s = buildToran(1);
  settle(s, 220);
  assert.ok(worstStretch(s) < 0.02, `at rest: ${(worstStretch(s) * 100).toFixed(2)}%`);
  let worst = 0;
  for (let n = 1; n <= 60 * 120; n++) { step(s, HSTEP, n * HSTEP, 1); if (n % 120 === 0) worst = Math.max(worst, worstStretch(s)); }
  assert.ok(worst < 0.02, `in the wind: ${(worst * 100).toFixed(2)}%`);
});

test('settle: with no wind the garland comes to rest below its nails', () => {
  const d = createDoorway(1, 'quiet').advanceTo(10);
  assert.ok(d.energy < 1e-4, `energy ${d.energy}`);
  for (const q of d.sim.P) if (!q.pin) assert.ok(q.y > NAILS[1][1] - 5 && q.y < STEP.top, `a flower at ${q.y.toFixed(0)}`);
});

test('doorwayAt: deterministic for a seed, and memoised forward without changing the answer', () => {
  clearMemo();
  const a = createDoorway(7, 'playful').advanceTo(4);
  const snapA = a.sim.P.map(p => [p.x, p.y]);
  clearMemo();
  // reach the same time in many small frames, as a playing scene does
  let d;
  for (let t = 0; t <= 4 + 1e-9; t += 1 / 60) d = doorwayAt(7, 'playful', t);
  d = doorwayAt(7, 'playful', 4);
  assert.deepEqual(d.sim.P.map(p => [p.x, p.y]), snapA);
});

test('doorwayAt: the same strokes give the same swing; different strokes a different one', () => {
  clearMemo();
  const strokes = [...tapStrokes(1.0, 600, 260), { t: 1.5, ax: 500, ay: 300, bx: 700, by: 300, vx: 1800, vy: 0, R: 42 }];
  const a = createDoorway(1, 'playful').advanceTo(3, strokes).sim.P.map(p => [p.x, p.y]);
  const b = createDoorway(1, 'playful').advanceTo(3, strokes).sim.P.map(p => [p.x, p.y]);
  const c = createDoorway(1, 'playful').advanceTo(3, []).sim.P.map(p => [p.x, p.y]);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('a hard brush sheds petals, and they land on the step or a seat and stay', () => {
  const strokes = [];
  for (let k = 0; k < 10; k++) strokes.push({ t: 1 + k * 0.02, ax: 380, ay: 260 + k * 20, bx: 400, by: 262 + k * 20, vx: 2400, vy: 0, R: 42 });
  const d = createDoorway(2, 'playful').advanceTo(1.5, strokes);
  const before = d.fallen.length;
  assert.ok(d.petals.length > 0, 'petals in the air after a hard brush');
  d.advanceTo(12, strokes);
  assert.ok(d.fallen.length > before, `landed: ${d.fallen.length - before}`);
  for (const p of d.fallen) assert.ok(p.y >= 640 && p.y <= STEP.edge, `on a seat or the step: ${p.y.toFixed(0)}`);
});

test('stepPetals: gravity brings a petal down to its landing line', () => {
  const r = rng('p'), p = makePetal(r, 600, 300, 0, 0, 'orange');
  let t = 0, landed = [];
  while (!landed.length && t < 20) { landed = stepPetals([p], HSTEP, t); t += HSTEP; }
  assert.equal(landed.length, 1);
  assert.equal(p.y, p.land);
});

test('registers: quiet has no wind and no petals of its own; warm is gentler than playful', () => {
  assert.equal(LOOKS.quiet.wind, 0); assert.equal(LOOKS.quiet.shed, 0);
  assert.ok(LOOKS.warm.wind < LOOKS.playful.wind);
  assert.ok(!LOOKS.warm.touch && LOOKS.playful.touch);
  assert.deepEqual(model({ time: 2, register: 'loud' }).look, LOOKS.warm, 'an unknown register falls back to warm');
});

test('the still: the garland at rest with petals already on the step', () => {
  const d = doorwayAt(1, 'quiet', 0);
  assert.ok(d.fallen.length >= 6);
  for (const p of d.fallen) assert.ok(p.x > OPEN.x0 - 21 && p.x < OPEN.x1 + 21 && p.y > STEP.top && p.y < STEP.edge);
  assert.ok(d.energy < 1e-3, 'at rest');
  assert.equal(meta.stillTime, 0);
});

test('calm: near the page’s words the wind is turned down', () => {
  const calm = [{ x: 330, y: 150, w: 540, h: 360 }];
  const move = d => { let e = 0; for (const q of d.sim.P) e += Math.abs(q.x - q.px); return e; };
  let open = 0, quiet = 0;
  const a = createDoorway(1, 'warm'), b = createDoorway(1, 'warm');
  for (let t = 1; t <= 20; t += 0.25) { open += move(a.advanceTo(t)); quiet += move(b.advanceTo(t, [], calm)); }
  assert.ok(quiet < open * 0.4, `sway with calm ${quiet.toFixed(1)} vs ${open.toFixed(1)}`);
});

test('scene definition: no params, interactive only in playful, size is the plate’s', () => {
  assert.deepEqual(Object.keys(toran.params), []);
  assert.deepEqual(toran.interactive, ['playful']);
  assert.equal(W, 1200); assert.equal(H, 900);
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
});

test('Enter’s sweep through the middle strand moves it, firmly but never shedding petals', () => {
  const mid = d => d.sim.chains[4].idx.slice(-2).map(i => d.sim.P[i]);
  const a = createDoorway(1, 'playful').advanceTo(3), b = createDoorway(1, 'playful');
  const sweep = sweepStrokes(3, 600, 234, 1);
  b.advanceTo(3, sweep);
  let most = 0;
  for (let t = 3; t <= 3.8; t += 0.05) {
    a.advanceTo(t); b.advanceTo(t, sweep);
    const pa = mid(a), pb = mid(b);
    most = Math.max(most, ...pa.map((q, i) => Math.hypot(q.x - pb[i].x, q.y - pb[i].y)));
  }
  assert.ok(most > 10, `the strand's last flowers are pushed ${most.toFixed(1)} units off where the breeze alone has them`);
  assert.equal(b.petals.length + b.fallen.length, a.petals.length + a.fallen.length, 'no petals shed by the keyboard sweep');
  for (const s of sweep) assert.ok(Math.hypot(s.vx, s.vy) <= 700);
});
