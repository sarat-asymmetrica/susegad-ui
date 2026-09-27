import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, clampStep, terrain, stations, astar, map, footprints, toD, gridW, MAP } from './stepper.core.js';

test('runs in Node with no DOM', () => {
  assert.equal(typeof document, 'undefined');
  assert.ok(map(3).legs.length === 2);
});

test('words: where you are, and where Next goes', () => {
  assert.equal(STRINGS.progress(2, 3), 'Step 2 of 3');
  assert.equal(STRINGS.next('Your details'), 'Next: Your details');
  assert.equal(STRINGS.next(''), 'Next');
  assert.equal(STRINGS.back, 'Back');
});

test('the step is always a real one', () => {
  assert.equal(clampStep(-1, 3), 0);
  assert.equal(clampStep(5, 3), 2);
  assert.equal(clampStep(1.7, 3), 1);
});

test('the map is deterministic per seed', () => {
  assert.deepEqual(map(4, 7), map(4, 7));
  assert.notDeepEqual(map(4, 7).legs, map(4, 8).legs);
});

test('stations run left to right, alternating high and low', () => {
  for (const n of [2, 3, 5, 8]) {
    const st = stations(n, terrain(1), 1);
    assert.equal(st.length, n);
    for (let k = 1; k < n; k++) assert.ok(st[k].x > st[k - 1].x);
    for (let k = 0; k < n; k++) assert.ok(k % 2 ? st[k].y >= MAP.H / 2 : st[k].y < MAP.H / 2, `station ${k} at ${st[k].y}`);
  }
});

test('A* joins each pair of stations, cell by cell', () => {
  const h = terrain(3), st = stations(3, h, 3);
  const path = astar(h, st[0], st[1]);
  assert.deepEqual(path[0], [st[0].x, st[0].y]);
  assert.deepEqual(path.at(-1), [st[1].x, st[1].y]);
  for (let i = 1; i < path.length; i++) assert.ok(Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]) <= Math.hypot(2, 1) * MAP.cell + 1e-9);
});

test('the road prefers low ground to a straight line over the hills', () => {
  // a ridge across the middle, with a gap at the bottom: the road goes round it
  const GW = gridW(), GH = MAP.H / MAP.cell + 1, h = new Float32Array(GW * GH).fill(-1);
  const mid = Math.floor(GW / 2);
  // three cells thick, so no single move can hop it
  for (let j = 0; j < GH - 3; j++) for (let d = -1; d <= 1; d++) h[j * GW + mid + d] = 1;
  const path = astar(h, { i: 2, j: 3 }, { i: GW - 3, j: 3 });
  const inRidge = path.filter(([x]) => Math.abs(x - mid * MAP.cell) <= MAP.cell);
  assert.ok(inRidge.length > 0 && inRidge.every(([, y]) => y >= (GH - 3) * MAP.cell), `crossed at ${JSON.stringify(inRidge)}`);
});

test('each leg is measured, so a skin can ink it exactly', () => {
  const m = map(3, 1);
  for (const l of m.legs) {
    let len = 0;
    for (let i = 1; i < l.pts.length; i++) len += Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]);
    assert.ok(Math.abs(len - l.length) < 1e-6);
  }
  assert.ok(m.contours.length > 0);
});

test('the map fits narrow and wide boxes', () => {
  assert.equal(map(3, 1, { width: 200 }).W, 320);
  assert.equal(map(3, 1, { width: 480 }).W, 480);
  assert.equal(map(3, 1, { width: 2000 }).W, 640);
  for (const w of [320, 480, 640]) for (const s of map(5, 2, { width: w }).stations) assert.ok(s.x >= 0 && s.x <= w);
});

test('footprints alternate feet along the road', () => {
  const f = footprints([[0, 0], [100, 0]], { spacing: 10 });
  assert.ok(f.length >= 8);
  assert.ok(f.every((p, i) => p.side === (i % 2 ? 1 : -1)));
  assert.ok(f.every(p => Math.abs(p.angle) < 1e-9));
});

test('path data is plain and closed when asked', () => {
  assert.equal(toD([[0, 0], [1.25, 2]]), 'M0,0L1.3,2');
  assert.equal(toD([[0, 0], [1, 0], [1, 1]], true), 'M0,0L1,0L1,1Z');
});
