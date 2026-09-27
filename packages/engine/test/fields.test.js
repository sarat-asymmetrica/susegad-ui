import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeNoise, rng, flow, curl, domainWarp, sampleGrid, contours, poissonDisc,
  grayScott, gsSpot, gsStep,
} from '../index.js';

const close = (a, b, eps = 1e-9, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ≉ ${b}`);
const sum = a => { let s = 0; for (const v of a) s += v; return s; };

test('flow gives unit vectors that drift smoothly', () => {
  const n = makeNoise('wind');
  let prev = null;
  for (let i = 0; i < 400; i++) {
    const [dx, dy] = flow(n, i * 0.01, 2, 0.3, { angle: 1, spread: 1.2 });
    close(Math.hypot(dx, dy), 1, 1e-12);
    if (prev) assert.ok(Math.hypot(dx - prev[0], dy - prev[1]) < 0.05, 'continuous');
    prev = [dx, dy];
  }
  assert.deepEqual(flow(n, 1, 2), flow(makeNoise('wind'), 1, 2), 'deterministic');
});

test('curl of a known potential, and zero divergence on noise', () => {
  const [vx, vy] = curl((x, y) => x * y, 3, 5);
  close(vx, 3, 1e-6); close(vy, -5, 1e-6);
  const n = makeNoise(4), psi = (x, y) => n.fbm(x, y, 0, 3), e = 1e-3;
  for (let i = 0; i < 50; i++) {
    const x = i * 0.21, y = 1 + i * 0.05;
    const div = (curl(psi, x + e, y)[0] - curl(psi, x - e, y)[0]) / (2 * e)
      + (curl(psi, x, y + e)[1] - curl(psi, x, y - e)[1]) / (2 * e);
    assert.ok(Math.abs(div) < 1e-3, `divergence ${div}`);
  }
});

test('domainWarp: range and determinism, and it differs from plain fbm', () => {
  const n = makeNoise('abri'), m = makeNoise('abri');
  let differs = 0;
  for (let i = 0; i < 1000; i++) {
    const x = i * 0.031, y = i * 0.017;
    const v = domainWarp(n, x, y, { amount: 2.2 });
    assert.ok(v >= -1 && v <= 1, `${v}`);
    assert.equal(v, domainWarp(m, x, y, { amount: 2.2 }));
    if (Math.abs(v - n.fbm(x, y, 0.5, 3)) > 1e-3) differs++;
  }
  assert.ok(differs > 900);
  assert.equal(domainWarp(n, 0.3, 0.7, { amount: 0 }), n.fbm(0.3, 0.7, 0.5, 3));
});

test('sampleGrid is row-major', () => {
  const g = sampleGrid(3, 2, (i, j) => i + 10 * j);
  assert.deepEqual([...g], [0, 1, 2, 10, 11, 12]);
});

test('marching squares on a single peak gives a closed diamond', () => {
  const h = [0, 0, 0, 0, 1, 0, 0, 0, 0];
  const lines = contours(h, 3, 3, 0.5);
  assert.equal(lines.length, 1);
  const [{ pts, closed }] = lines;
  assert.equal(closed, true);
  assert.equal(pts.length, 4);
  const key = p => p.map(v => v.toFixed(6)).join(',');
  assert.deepEqual(new Set(pts.map(key)), new Set([[1, 0.5], [0.5, 1], [1.5, 1], [1, 1.5]].map(key)));
  // neighbours on the loop are adjacent diamond corners, never opposite ones
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4];
    close(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.SQRT1_2, 1e-9);
  }
});

test('marching squares: an open ramp, interpolation and placement', () => {
  // columns 0, 0, 1, 1 → the 0.25 level crosses between x = 1 and 2, a quarter of the way
  const h = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1];
  const [line, ...rest] = contours(h, 4, 3, 0.25, { x0: 100, y0: 50, cell: 10 });
  assert.equal(rest.length, 0);
  assert.equal(line.closed, false);
  assert.equal(line.pts.length, 3);
  for (const [x] of line.pts) close(x, 112.5);
  assert.deepEqual(line.pts.map(p => p[1]).sort((a, b) => a - b), [50, 60, 70]);
  assert.deepEqual(contours([0, 0, 0, 0], 2, 2, 0.5), [], 'flat grid, no lines');
});

test('marching squares: a saddle splits by the cell mean', () => {
  // a b / d c with a and c high
  const high = contours([1, 0, 0, 1], 2, 2, 0.4); // mean 0.5 > 0.4: the high corners join
  const low = contours([1, 0, 0, 1], 2, 2, 0.6);  // mean 0.5 < 0.6: they stay apart
  assert.equal(high.length, 2); assert.equal(low.length, 2);
  const cuts = ls => ls.map(l => l.pts.map(p => p.map(v => +v.toFixed(3)).join(',')).sort().join(' ')).sort();
  assert.notDeepEqual(cuts(high), cuts(low));
});

test('marching squares on a noise field: every line sits on the level', () => {
  const n = makeNoise('ghat'), gw = 40, gh = 30;
  const h = sampleGrid(gw, gh, (i, j) => n.fbm(i * 0.08, j * 0.08, 0.5, 3));
  const lines = contours(h, gw, gh, 0);
  assert.ok(lines.length > 0);
  const bil = (x, y) => {
    const i = Math.min(gw - 2, Math.floor(x)), j = Math.min(gh - 2, Math.floor(y)), u = x - i, v = y - j;
    // on a cell edge only the edge's two corners matter, so bilinear is exact there
    return h[j * gw + i] * (1 - u) * (1 - v) + h[j * gw + i + 1] * u * (1 - v) + h[(j + 1) * gw + i] * (1 - u) * v + h[(j + 1) * gw + i + 1] * u * v;
  };
  for (const l of lines) for (const [x, y] of l.pts) assert.ok(Math.abs(bil(x, y)) < 1e-5, 'on the level');
});

test('poissonDisc keeps its minimum distance and fills the box', () => {
  const w = 300, h = 200, r = 18, P = poissonDisc(w, h, r, 'stars');
  assert.ok(P.length > 60, `${P.length} points`);
  for (let i = 0; i < P.length; i++) {
    const [x, y] = P[i];
    assert.ok(x >= 0 && x < w && y >= 0 && y < h);
    for (let j = i + 1; j < P.length; j++) assert.ok(Math.hypot(P[j][0] - x, P[j][1] - y) >= r - 1e-9);
  }
  // maximal: no probe point is more than 2r from a sample
  for (let y = 0; y < h; y += 7) for (let x = 0; x < w; x += 7) {
    let best = Infinity;
    for (const p of P) best = Math.min(best, Math.hypot(p[0] - x, p[1] - y));
    assert.ok(best < 2 * r, `hole at ${x},${y}`);
  }
  assert.deepEqual(P, poissonDisc(w, h, r, 'stars'), 'deterministic');
  assert.notDeepEqual(P, poissonDisc(w, h, r, 'moon'));
  assert.deepEqual(poissonDisc(50, 50, 10, rng(5)), poissonDisc(50, 50, 10, rng(5)), 'accepts an rng');
});

test('Gray–Scott: with no feed or kill, u + v is conserved', () => {
  const s = grayScott(48, 48);
  gsSpot(s, 24, 24, 4, 0.5);
  const m0 = sum(s.U) + sum(s.V);
  gsStep(s, { feed: 0, kill: 0, steps: 40 });
  close(sum(s.U) + sum(s.V), m0, m0 * 1e-5);
  assert.ok(sum(s.V) > 0);
});

test('Gray–Scott: high kill starves v; the classic regime keeps it alive', () => {
  const dead = grayScott(48, 48); gsSpot(dead, 24, 24, 4);
  gsStep(dead, { feed: 0.01, kill: 0.1, steps: 600 });
  assert.ok(sum(dead.V) < 1e-3, `v left ${sum(dead.V)}`);

  const live = grayScott(64, 64); gsSpot(live, 32, 32, 4);
  const v0 = sum(live.V);
  gsStep(live, { steps: 1500 }); // the defaults: feed 0.037, kill 0.06
  assert.ok(sum(live.V) > v0, `spots grow: ${v0} → ${sum(live.V)}`);
  for (const v of live.V) assert.ok(v >= 0 && v <= 1 && Number.isFinite(v));
  for (const u of live.U) assert.ok(u >= 0 && u <= 1.0001 && Number.isFinite(u));
});

test('Gray–Scott: per-cell feed matches a constant, and the mask walls off a dish', () => {
  const a = grayScott(32, 32), b = grayScott(32, 32);
  gsSpot(a, 16, 16, 3); gsSpot(b, 16, 16, 3);
  // values exact in float32, so the two paths must agree to the bit
  gsStep(a, { feed: 0.03125, kill: 0.0625, steps: 30 });
  gsStep(b, { feed: new Float32Array(32 * 32).fill(0.03125), kill: new Float32Array(32 * 32).fill(0.0625), steps: 30 });
  assert.deepEqual([...a.V], [...b.V]);

  // left half is the dish; nothing may cross into the right half
  const s = grayScott(32, 32), mask = sampleGrid(32, 32, i => (i < 16 ? 1 : 0));
  gsSpot(s, 11, 16, 3);
  gsStep(s, { mask, steps: 300 });
  for (let j = 0; j < 32; j++) for (let i = 16; i < 32; i++) assert.equal(s.V[j * 32 + i], 0);
  assert.ok(sum(s.V) > 0);
});
