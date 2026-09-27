import test from 'node:test';
import assert from 'node:assert/strict';
import kolam, { buildKolam, geometry, model, meta } from './index.js';
import { timeline, handPace } from './model.js';
import { fitAround } from './render.js';
import { getScene, paramsFromAttributes, defaultParams } from '../../core/define-scene.js';

const P = (o = {}) => ({ ...defaultParams(kolam.params), ...o });

test('same seed, same kolam; different seeds differ', () => {
  assert.deepEqual(buildKolam(7), buildKolam(7));
  assert.deepEqual(buildKolam('monsoon', 7), buildKolam('monsoon', 7));
  assert.notDeepEqual(buildKolam(1).loops, buildKolam(2).loops);
});

test('one unbroken, closed line around every dot', () => {
  for (const grid of [null, 3, 5, 7, 9]) for (const seed of [1, 2, 7, 42, 'goa']) {
    const k = buildKolam(seed, grid);
    assert.equal(k.loops.length, 1, `seed ${seed} grid ${grid}: a single loop`);
    const loop = k.loops[0];
    // consecutive points are one diagonal step apart, including the wrap back to the start
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      assert.equal(Math.abs(a[0] - b[0]), 1); assert.equal(Math.abs(a[1] - b[1]), 1);
    }
    if (grid) assert.equal(k.size, grid, 'odd grids are kept as given');
    const g = geometry(seed, grid, 1000, 1000).loops[0];
    assert.deepEqual(g.pts[0], g.pts[g.pts.length - 1], 'the smooth path closes');
  }
});

test('even grids round up to odd, keeping a centre', () => {
  assert.equal(buildKolam(1, 4).size, 5);
  assert.equal(buildKolam(1, 8).size, 9);
});

test('progress over time is monotonic and finishes', () => {
  for (const register of ['warm', 'playful']) {
    const geo = geometry(7, null, 1000, 1000), tl = timeline(geo, register);
    let prev = -1, prevDots = -1;
    for (let t = 0; t <= tl.lineEnd + 2; t += 0.05) {
      const d = model({ time: t, seed: 7, register, params: P() });
      assert.ok(d.drawn >= prev, `${register} t=${t.toFixed(2)}`);
      assert.ok(d.dots >= prevDots);
      prev = d.drawn; prevDots = d.dots;
    }
    assert.equal(prev, 1);
    assert.equal(prevDots, geo.dots.length);
  }
  for (let u = 0; u < 1; u += 0.001) assert.ok(handPace(u + 0.001) >= handPace(u));
});

test('with progress set, time does not move the line', () => {
  const a = model({ time: 0, seed: 7, register: 'warm', params: P({ progress: 0.4 }) });
  const b = model({ time: 500, seed: 7, register: 'warm', params: P({ progress: 0.4 }) });
  assert.equal(a.drawn, 0.4); assert.equal(b.drawn, 0.4);
  assert.equal(a.dots, a.geo.dots.length, 'every dot is laid before the line');
  assert.ok(a.settled && b.settled);
  assert.equal(b.since, -1); assert.deepEqual(b.ants, []);
  assert.ok(a.tip, 'the tip shows where the work has reached');
});

test('registers: quiet is the finished still; playful brings colour and ants', () => {
  const q = model({ time: 0, seed: 7, register: 'quiet', params: P() });
  assert.equal(q.drawn, 1); assert.ok(q.settled); assert.equal(q.tip, null);
  const w = model({ time: 1e6, seed: 7, register: 'warm', params: P() });
  assert.equal(w.palette, 'flour'); assert.ok(w.since > 0); assert.deepEqual(w.ants, []); assert.ok(!w.settled);
  const p = model({ time: 1e6, seed: 7, register: 'playful', params: P() });
  assert.equal(p.palette, 'rangoli'); assert.equal(p.ants.length, 3);
  assert.equal(model({ time: 1e6, seed: 7, register: 'playful', params: P({ palette: 'flour' }) }).palette, 'flour');
  assert.deepEqual(model({ time: 3, seed: 7, register: 'warm', params: P() }), model({ time: 3, seed: 7, register: 'warm', params: P() }), 'deterministic per frame');
});

test('the definition: params from attributes, status text, meta', () => {
  assert.equal(getScene('kolam'), kolam);
  assert.deepEqual(paramsFromAttributes(kolam.params, a => ({ progress: '1.4', grid: '6' })[a] ?? null), { progress: 1, grid: 6, palette: 'auto' });
  assert.equal(kolam.status(P({ progress: 0.4 })), '40% done', 'the short part; core adds the label');
  assert.equal(kolam.status(P()), '');
  assert.deepEqual(kolam.interactive, ['playful']);
  for (const k of ['title', 'alt', 'caption', 'prompt', 'credit', 'tier']) assert.ok(meta[k], k);
  assert.equal(meta.tier, 'shared');
  for (const k of ['title', 'alt', 'caption', 'prompt', 'credit', 'keys']) assert.ok(!meta[k].includes('—'), `no em dash in ${k}`);
  assert.ok(meta.map.every(row => row.length === 3));
});

test('the kolam makes room for slotted text', () => {
  assert.deepEqual(fitAround([], 1000, 1000), { s: 1, tx: 0, ty: 0 });
  assert.deepEqual(fitAround([{ x: 10, y: 10, w: 50, h: 40 }], 1000, 1000), { s: 1, tx: 0, ty: 0 }, 'a corner note does not move it');
  const f = fitAround([{ x: 40, y: 850, w: 600, h: 110 }], 1000, 1000);
  const bottom = f.ty + (500 + 370) * f.s;
  assert.ok(bottom < 850, 'the kolam ends above the text');
  assert.ok(f.s > 0.9 && f.s <= 1);
});
