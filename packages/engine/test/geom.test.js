import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resample, catmull, chaikin, measure, ellipse, blob, roughen, bbox, dist, TAU } from '../index.js';

const close = (a, b, eps = 1e-9, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ≉ ${b}`);
const L = [[0, 0], [10, 0], [10, 7.5]];

test('resample spaces points evenly along the line', () => {
  const P = resample(L, 2);
  assert.deepEqual(P[0], [0, 0]);
  assert.deepEqual(P[P.length - 1], [10, 7.5]);
  // arc-length spacing is exactly `step` (except the kept end)
  const m = measure(P);
  for (let i = 1; i < P.length - 1; i++) close(measure(P.slice(0, i + 1)).length, i * 2, 1e-6);
  close(m.length, 17.5, 1e-9);
  // straight runs: chord spacing is step
  for (let i = 1; i < 5; i++) close(dist(P[i - 1], P[i]), 2, 1e-9);
  // closed: walks all the way round; when the perimeter is a whole number of
  // steps the last point lands back on the first (sketch.js behaviour, kept)
  const sq = [[0, 0], [4, 0], [4, 4], [0, 4]];
  const C = resample(sq, 1, true);
  assert.equal(C.length, 17);
  assert.deepEqual(C[16], [0, 0]);
  for (let i = 1; i < C.length; i++) close(dist(C[i - 1], C[i]), 1, 1e-9);
});

test('catmull passes through every anchor', () => {
  const A = [[0, 0], [30, 40], [60, -10], [100, 20], [120, 80]];
  const s = 8, P = catmull(A, s);
  assert.equal(P.length, (A.length - 1) * s + 1);
  A.forEach((a, i) => { close(P[i * s][0], a[0]); close(P[i * s][1], a[1]); });
  const C = catmull(A, s, true);
  assert.equal(C.length, A.length * s);
  A.forEach((a, i) => { close(C[i * s][0], a[0]); close(C[i * s][1], a[1]); });
  assert.deepEqual(catmull([[1, 2], [3, 4]]), [[1, 2], [3, 4]], 'two points pass straight through');
});

test('chaikin rounds corners and keeps open ends', () => {
  const P = chaikin(L, 1);
  assert.deepEqual(P[0], L[0]); assert.deepEqual(P[P.length - 1], L[2]);
  assert.equal(P.length, 2 + 2 * 2);
  assert.equal(chaikin([[0, 0], [1, 0], [1, 1], [0, 1]], 2, true).length, 16);
});

test('measure: length and at()', () => {
  const m = measure(L);
  close(m.length, 17.5);
  assert.deepEqual(m.at(5).slice(0, 2), [5, 0]);
  close(m.at(5)[2], 0);
  const [x, y, a] = m.at(13);
  close(x, 10); close(y, 3); close(a, Math.PI / 2);
  assert.deepEqual(m.at(-4).slice(0, 2), [0, 0], 'open lines clamp');
  assert.deepEqual(m.at(99).slice(0, 2), [10, 7.5]);
  const sq = measure([[0, 0], [4, 0], [4, 4], [0, 4]], true);
  close(sq.length, 16);
  assert.deepEqual(sq.at(17).slice(0, 2), [1, 0], 'closed lines wrap');
  assert.deepEqual(sq.at(-1).slice(0, 2), [0, 1]);
});

test('ellipse closes on itself; arcs include both ends', () => {
  const E = ellipse(10, 20, 30, 15, { n: 36 });
  assert.equal(E.length, 36);
  close(E[0][0], 40); close(E[0][1], 20);
  // the next point after the last would be the first
  const step = dist(E[0], E[1]);
  close(dist(E[35], E[0]), step, 1e-9);
  for (const [x, y] of E) close(((x - 10) / 30) ** 2 + ((y - 20) / 15) ** 2, 1, 1e-9);
  const A = ellipse(0, 0, 10, 10, { n: 4, start: 0, end: Math.PI });
  assert.equal(A.length, 5);
  close(A[4][0], -10); close(A[4][1], 0, 1e-9);
});

test('blob is closed, deterministic and near its radius', () => {
  const B = blob(100, 100, 50, { seed: 3, wobble: 0.12, n: 72 });
  assert.equal(B.length, 72);
  assert.deepEqual(B, blob(100, 100, 50, { seed: 3, wobble: 0.12, n: 72 }));
  assert.notDeepEqual(B, blob(100, 100, 50, { seed: 4, wobble: 0.12, n: 72 }));
  for (const p of B) { const r = dist(p, [100, 100]); assert.ok(r > 50 * 0.7 && r < 50 * 1.3, `${r}`); }
  // closure: the gap from last back to first looks like any other gap
  const gaps = B.map((p, i) => dist(p, B[(i + 1) % B.length]));
  const mean = gaps.reduce((a, b) => a + b) / gaps.length;
  assert.ok(gaps[gaps.length - 1] < mean * 2);
});

test('roughen stays near the outline', () => {
  const E = ellipse(0, 0, 100, 100, { n: 64 });
  const R = roughen(E, { amp: 3, seed: 1 });
  for (const p of R) { const r = Math.hypot(p[0], p[1]); assert.ok(r > 95 && r < 105, `${r}`); }
  assert.deepEqual(R, roughen(E, { amp: 3, seed: 1 }));
});

test('bbox', () => {
  assert.deepEqual(bbox([[3, -2], [-1, 5], [7, 1]]), { x: -1, y: -2, w: 8, h: 7 });
  assert.deepEqual(bbox([[2, 2]]), { x: 2, y: 2, w: 0, h: 0 });
  const E = bbox(ellipse(0, 0, 10, 5, { n: 4 }));
  close(E.w, 20); close(E.h, 10);
  close(TAU, Math.PI * 2);
});
