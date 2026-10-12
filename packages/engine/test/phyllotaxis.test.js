import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vogel, GOLDEN, JITTER_CAP, fit, floretSize, variation } from '../index.js';

const close = (a, b, eps = 1e-9, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ≉ ${b}`);

test('the golden angle is exact, not 137.5', () => {
  close(GOLDEN * 180 / Math.PI, 137.50776405003785, 1e-9);
  close(GOLDEN, Math.PI * (3 - Math.sqrt(5)), 0);
  assert.ok(Math.abs(GOLDEN * 180 / Math.PI - 137.5) > 0.0077, 'not the rounded value that leaves spokes');
  const P = vogel(4);
  close(P[3].theta, 3 * GOLDEN);
  close(P[3].r, Math.sqrt(3));
  assert.deepEqual([P[0].x, P[0].y, P[0].r], [0, 0, 0], 'the first point is the centre');
  close(Math.hypot(P[3].x, P[3].y), P[3].r);
});

test('equal area: the count inside radius ρ grows as ρ²', () => {
  const P = vogel(3000);
  for (const rho of [8, 16, 32, 48]) {
    const inside = P.filter(p => p.r < rho).length;
    assert.ok(Math.abs(inside - rho * rho) <= 1, `from the centre: ${inside} vs ${rho * rho}`);
  }
  // the same density away from the centre: a disc of radius ρ holds about ρ² points
  for (const [cx, cy] of [[20, 0], [0, -25], [-15, 15], [10, 30]]) {
    for (const rho of [6, 9]) {
      const inside = P.filter(p => Math.hypot(p.x - cx, p.y - cy) < rho).length;
      assert.ok(Math.abs(inside / (rho * rho) - 1) < 0.2, `disc ${rho} at ${cx},${cy}: ${inside} vs ~${rho * rho}`);
    }
  }
});

test('stability: the first k points of vogel(n) are vogel(k), jittered or not', () => {
  for (const o of [{}, { scale: 7, offset: 0.4 }, { jitter: 0.15, seed: 'Maria' }]) {
    const big = vogel(200, o);
    for (const k of [1, 2, 13, 89, 144]) assert.deepEqual(big.slice(0, k), vogel(k, o), `k = ${k}`);
  }
  assert.deepEqual(vogel(5, { start: 3 }).map(p => p.i), [3, 4, 5, 6, 7]);
  assert.deepEqual(vogel(5, { start: 3 }), vogel(8).slice(3), 'start picks up where a smaller head stopped');
});

test('the same seed gives the same points, another seed gives others', () => {
  const a = vogel(60, { jitter: 0.1, seed: 'Asha' }), b = vogel(60, { jitter: 0.1, seed: 'Asha' }), c = vogel(60, { jitter: 0.1, seed: 'Bruno' });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.deepEqual(variation('Asha', { count: [20, 40] }), variation('Asha', { count: [20, 40] }));
  assert.notDeepEqual(variation('Asha'), variation('Bruno'));
  const v = variation('Asha', { count: [20, 40] });
  assert.ok(Number.isInteger(v.count) && v.count >= 20 && v.count <= 40);
  assert.ok(v.jitter <= JITTER_CAP && v.offset >= 0 && v.offset < 2 * Math.PI);
  assert.ok(!('angle' in v), 'the angle is never part of the variation');
});

test('no two points closer than a floor at the default scale', () => {
  const closest = P => { let m = Infinity; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) m = Math.min(m, Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y)); return m; };
  const plain = closest(vogel(500));
  assert.ok(plain >= 0.7, `plain: ${plain}`);
  const rough = closest(vogel(500, { jitter: 99, seed: 7 }));
  assert.ok(rough >= 0.5, `at the jitter cap: ${rough}`);
  close(closest(vogel(500, { scale: 4 })), plain * 4, 1e-9, 'the floor scales with scale');
  // the floor can fail: a square angle stacks points into spokes
  assert.ok(closest(vogel(500, { angle: Math.PI / 2 })) < 0.15, 'a square angle stacks points');
});

test('fit puts the head inside the disc, and floretSize grows to the rim', () => {
  for (const n of [1, 37, 144, 400]) {
    const P = vogel(n, { scale: fit(n, 50) });
    assert.ok(P.every(p => p.r < 50 + 1e-9), `n = ${n}`);
  }
  assert.equal(fit(0, 10), 10);
  close(vogel(400, { scale: fit(400, 100) })[399].r, 100 * Math.sqrt(399 / 400), 1e-9);
  assert.equal(floretSize(0, 100), 0.5);
  assert.equal(floretSize(99, 100), 1);
  assert.equal(floretSize(0, 1), 1);
  const s = Array.from({ length: 50 }, (_, i) => floretSize(i, 50, { min: 2, max: 9 }));
  assert.ok(s.every((v, i) => i === 0 || v >= s[i - 1]));
});
