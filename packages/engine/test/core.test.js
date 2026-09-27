import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TAU, clamp, lerp, invLerp, smoothstep, phase, ease, boil, hashSeed, rng, makeNoise, N,
  hexToRgb, rgba, mix,
} from '../index.js';

const close = (a, b, eps = 1e-9, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ≉ ${b}`);

test('scalars', () => {
  assert.equal(clamp(2), 1); assert.equal(clamp(-1), 0); assert.equal(clamp(5, 0, 10), 5);
  assert.equal(lerp(2, 4, 0.5), 3);
  assert.equal(invLerp(2, 4, 3), 0.5); assert.equal(invLerp(2, 4, 9), 1);
  assert.equal(smoothstep(0, 1, 0.5), 0.5); assert.equal(smoothstep(0, 1, -1), 0);
  assert.equal(phase(3, 2, 6), 0.25); assert.equal(phase(1, 2, 6), 0); assert.equal(phase(7, 2, 6), 1);
  assert.equal(boil(0.99, 10), 9); assert.equal(boil(1, 10), 10);
});

test('every easing starts at 0 and ends at 1', () => {
  for (const [name, f] of Object.entries(ease)) {
    close(f(0), 0, 1e-9, `${name}(0)`);
    close(f(1), 1, 1e-9, `${name}(1)`);
  }
  assert.ok(ease.outBack(0.8) > 1, 'outBack overshoots');
});

test('hashSeed: numbers and strings, stable and spread', () => {
  assert.equal(hashSeed(1), hashSeed(1));
  assert.equal(hashSeed('kolam'), hashSeed('kolam'));
  assert.notEqual(hashSeed('kolam'), hashSeed('kolan'));
  assert.notEqual(hashSeed(1), hashSeed(2));
  // numbers are scaled by 1000 and truncated, so tiny differences share a hash
  assert.equal(hashSeed(1.0001), hashSeed(1));
  assert.notEqual(hashSeed(1.5), hashSeed(1));
  for (const s of [0, 1, -3, 1e6, '', 'a', 'susegad']) {
    const h = hashSeed(s);
    assert.ok(Number.isInteger(h) && h >= 0 && h < 2 ** 32, `uint32 for ${s}`);
  }
  // known values, so a silent change to the hash (and every drawing) is caught
  assert.equal(hashSeed(''), 2166136261);
  assert.equal(hashSeed(0), 0);
});

test('rng is deterministic per seed', () => {
  const a = rng(42), b = rng(42), c = rng(43), d = rng('42');
  const sa = Array.from({ length: 20 }, a), sb = Array.from({ length: 20 }, b);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, Array.from({ length: 20 }, c));
  assert.notDeepEqual(sa, Array.from({ length: 20 }, d));
});

test('rng distribution sanity', () => {
  const r = rng('dist'), n = 20000, bins = new Array(10).fill(0);
  let sum = 0, g = 0, g2 = 0;
  for (let i = 0; i < n; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
    sum += v; bins[Math.floor(v * 10)]++;
  }
  close(sum / n, 0.5, 0.01, 'mean near 0.5');
  for (const b of bins) assert.ok(Math.abs(b - n / 10) < n / 10 * 0.08, `bin ${b}`);
  for (let i = 0; i < n; i++) { const v = r.gauss(); g += v; g2 += v * v; }
  close(g / n, 0, 0.03, 'gauss mean'); close(g2 / n, 1, 0.05, 'gauss variance');
  const ints = new Set();
  for (let i = 0; i < 2000; i++) { const v = r.int(3, 6); assert.ok(v >= 3 && v <= 6 && Number.isInteger(v)); ints.add(v); }
  assert.equal(ints.size, 4, 'int covers both ends');
  for (let i = 0; i < 500; i++) { const v = r.range(-2, 5); assert.ok(v >= -2 && v < 5); }
  assert.ok([1, -1].includes(r.sign()));
  assert.ok(['a', 'b'].includes(r.pick(['a', 'b'])));
  let yes = 0; for (let i = 0; i < 4000; i++) yes += r.chance(0.25); close(yes / 4000, 0.25, 0.03);
});

test('noise: range, determinism, continuity', () => {
  const n = makeNoise(7), m = makeNoise(7), o = makeNoise(8);
  let lo = Infinity, hi = -Infinity, differs = false;
  for (let i = 0; i < 5000; i++) {
    const x = i * 0.173, y = i * 0.091 - 40, z = (i % 50) * 0.37;
    const v = n(x, y, z);
    lo = Math.min(lo, v); hi = Math.max(hi, v);
    assert.equal(v, m(x, y, z));
    if (v !== o(x, y, z)) differs = true;
    // continuity: a tiny step gives a tiny change (Perlin gradient is bounded)
    assert.ok(Math.abs(n(x + 1e-4, y, z) - v) < 1e-3);
  }
  assert.ok(lo >= -1 && hi <= 1, `range ${lo}..${hi}`);
  assert.ok(lo < -0.4 && hi > 0.4, 'uses the range');
  assert.ok(differs, 'seed matters');
  assert.equal(n(3, 4, 5), 0, 'zero on integer lattice');
});

test('fbm stays in range', () => {
  const n = makeNoise('fbm');
  for (let i = 0; i < 3000; i++) {
    const v = n.fbm(i * 0.07, i * 0.013, 0.5, 1 + (i % 6));
    assert.ok(v >= -1 && v <= 1, `${v}`);
  }
  assert.equal(typeof N(0.5, 0.5), 'number');
});

test('colour helpers', () => {
  assert.deepEqual(hexToRgb('#1d2742'), [0x1d, 0x27, 0x42]);
  assert.deepEqual(hexToRgb('#abc'), [0xaa, 0xbb, 0xcc]);
  assert.equal(rgba('#ffffff', 0.5), 'rgba(255,255,255,0.5)');
  assert.equal(mix('#000000', '#ffffff', 0.5), 'rgb(128,128,128)');
  assert.equal(mix('#102030', '#405060', 0), 'rgb(16,32,48)');
  close(TAU, 2 * Math.PI);
});
