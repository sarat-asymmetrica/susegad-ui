import test from 'node:test';
import assert from 'node:assert/strict';
import abri from './index.js';
import {
  plan, pushDrop, makeBath, stepBath, cloudRows, stylusAt, times, sheetSeed, stillAt, model, held, LOOKS, PALETTES, BATH, FW, FH, FC, FX0, FY0,
} from './model.js';
import { meta } from './meta.js';

/** Shoelace area of a flat [x0, y0, x1, y1, ...] polygon. */
const area = P => { let s = 0; for (let i = 0; i < P.length; i += 2) { const j = (i + 2) % P.length; s += P[i] * P[j + 1] - P[j] * P[i + 1]; } return Math.abs(s) / 2; };
const ring = (x, y, r, n = 400) => { const P = []; for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; P.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return P; };
const noCloud = () => ({ cx: new Float32Array(FW * FH), cy: new Float32Array(FW * FH) });

test('same seed, same making; different seeds differ', () => {
  const strip = p => JSON.stringify({ ...p, strokes: p.strokes.map(s => [s.t0, s.t1, s.m.length]) });
  assert.equal(strip(plan(4)), strip(plan(4)));
  assert.notEqual(strip(plan(4)), strip(plan(5)));
});

test('a plan is drops, then the stylus, then the drift, then the sheet', () => {
  for (const seed of [1, 2, 3, 'goa']) {
    const p = plan(seed);
    assert.ok(p.drops.length >= 40, `${p.drops.length} drops`);
    assert.ok(PALETTES.includes(p.cols));
    for (const d of p.drops) assert.ok(d.x > BATH.x0 && d.x < BATH.x1 && d.y > BATH.y0 && d.y < BATH.y1);
    assert.ok(p.dropsEnd < p.combEnd && p.combEnd <= p.cloud[1] && p.cloud[1] < p.lay);
    const tm = times(p.lay);
    assert.ok(tm.lay < tm.rest && tm.rest < tm.lift && tm.lift < tm.face && tm.face < tm.out && tm.out < tm.end);
  }
});

test('the marbling map keeps area: a drop pushes a ring outward and the ring encloses its old area plus the drop', () => {
  const P = ring(600, 400, 80), before = area(P), polys = [{ pts: P }];
  const D = 40 * 40;
  pushDrop(polys, 620, 410, D);
  const after = area(polys[0].pts);
  assert.ok(Math.abs(after - (before + Math.PI * D)) / (before + Math.PI * D) < 0.002, `${before.toFixed(0)} + ${(Math.PI * D).toFixed(0)} = ${after.toFixed(0)}`);
});

test('a boundary outside the drop keeps its own enclosed area (the drop only displaces it)', () => {
  const P = ring(300, 300, 30), before = area(P), polys = [{ pts: P }];
  pushDrop(polys, 700, 500, 90 * 90);
  assert.ok(Math.abs(area(polys[0].pts) - before) / before < 0.01);
});

test('the drift is a curl: a patch of colour carried by it for two seconds keeps its area', () => {
  const c = noCloud(), p = plan(1);
  cloudRows(1, c.cx, c.cy, 0, FH);
  const B = makeBath(p, c);
  B.drops = []; B.t = p.cloud[0] + 2.5; // the drift at full strength
  B.polys.push({ col: '#000', pts: ring(600, 420, 90) });
  const before = area(B.polys[0].pts);
  let moved = 0;
  for (let k = 0; k < 120; k++) stepBath(B, 1 / 60);
  moved = Math.hypot(B.polys[0].pts[0] - 690, B.polys[0].pts[1] - 420);
  const after = area(B.polys[0].pts);
  assert.ok(moved > 5, `the drift moved it ${moved.toFixed(1)} units`);
  assert.ok(Math.abs(after - before) / before < 0.03, `area ${before.toFixed(0)} then ${after.toFixed(0)}`);
});

test('stepping the tray is deterministic, and points under the page’s words are held', () => {
  const run = hold => { const B = makeBath(plan(2), noCloud()); B.hold = hold; for (let k = 0; k < 900; k++) stepBath(B, 1 / 60); return B; };
  const a = run([]), b = run([]);
  assert.deepEqual(a.polys.map(p => p.pts.slice(0, 20)), b.polys.map(p => p.pts.slice(0, 20)));
  assert.ok(a.polys.length > 10);
  // the stylus: every point it would have dragged inside a held box stays put
  const box = { x: BATH.x0, y: BATH.y0, w: BATH.x1 - BATH.x0, h: BATH.y1 - BATH.y0 };
  const B = makeBath(plan(2), noCloud()), p = plan(2);
  B.t = p.dropsEnd - 1 / 60; B.hold = [box]; B.drops = [];
  B.polys.push({ col: '#000', pts: ring(600, 400, 200) });
  const snap = B.polys.at(-1).pts.slice();
  for (let k = 0; k < 120; k++) stepBath(B, 1 / 60);
  assert.deepEqual(B.polys.at(-1).pts.length, B.polys.at(-1).pts.length);
  assert.ok(held([box], 600, 400));
  assert.deepEqual(B.polys.at(-1).pts.slice(0, 40), snap.slice(0, 40), 'held under the words');
});

test('drops marked as landing under the words never land', () => {
  const B = makeBath(plan(1), noCloud());
  for (const d of B.drops) d.skip = true;
  for (let k = 0; k < 300; k++) stepBath(B, 1 / 60);
  assert.equal(B.polys.length, 0);
});

test('the stylus is somewhere only while it combs', () => {
  const p = plan(3);
  assert.equal(stylusAt(p, p.dropsEnd - 0.1), null);
  assert.ok(stylusAt(p, p.strokes[0].t0 + 0.2));
  assert.equal(stylusAt(p, p.combEnd + 1), null);
});

test('sheets of a sitting, registers and the still', () => {
  assert.equal(sheetSeed(3, 0), 3); assert.equal(sheetSeed(3, 2), 5); assert.equal(sheetSeed('goa', 1), 'goa+1');
  assert.equal(LOOKS.quiet.pace, 0); assert.ok(LOOKS.warm.pace < LOOKS.playful.pace); assert.ok(LOOKS.playful.hand && !LOOKS.warm.hand);
  assert.deepEqual(model({ register: 'loud' }).look, LOOKS.warm);
  assert.equal(meta.stillTime, stillAt(plan(1)));
  assert.ok(stillAt(plan(1)) > times(plan(1).lay).face, 'the still is the print face up');
  assert.deepEqual(abri.interactive, ['playful']);
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
  assert.ok(FX0 < BATH.x0 && FY0 < BATH.y0);
});
