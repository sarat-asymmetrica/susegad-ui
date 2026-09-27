import test from 'node:test';
import assert from 'node:assert/strict';
import {
  model, createDrops, cover, fogField, geometry, progressEdge, ghostPath, steam, LOOKS, PANES, R, MW, MH,
} from './model.js';
import { rng } from '../../engine/index.js';

const run = (drops, n, dt = 1 / 60) => { for (let i = 0; i < n; i++) drops.step(dt); return drops; };
const snap = d => JSON.stringify({ b: d.beads, r: d.runners });

test('model runs in Node with no DOM', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof window, 'undefined');
  const m = model({ time: 3.2, seed: 7, register: 'playful', params: { intensity: 0.5 } });
  assert.equal(m.sway.length, 11);
  assert.ok(m.sway.every(Number.isFinite));
  assert.equal(m.steam.length, 3);
  assert.equal(m.progress, null);
  JSON.stringify(m); // plain data
});

test('model is deterministic for a seed and time', () => {
  const a = model({ time: 5, seed: 3, register: 'warm' }), b = model({ time: 5, seed: 3, register: 'warm' });
  assert.deepEqual(a, b);
  assert.notDeepEqual(model({ time: 5, seed: 4 }).geo.fields, a.geo.fields);
});

test('static geometry is memoised per seed', () => {
  assert.equal(geometry(11), geometry(11));
  assert.notEqual(geometry(11), geometry(12));
});

test('registers change the look, and quiet has no steam or ghost', () => {
  const q = model({ register: 'quiet' }), w = model({ register: 'warm' }), p = model({ register: 'playful' });
  assert.ok(q.beadRate < w.beadRate && w.beadRate < p.beadRate);
  assert.equal(q.steam, null);
  assert.equal(q.wipe, false);
  assert.equal(p.wipe, true);
  assert.equal(model({ register: 'playful', params: { wipe: false } }).wipe, false);
  assert.equal(model({ register: 'nonsense' }).look, LOOKS.warm);
});

test('intensity scales the rain', () => {
  const lo = model({ register: 'playful', params: { intensity: 0.2 } }), hi = model({ register: 'playful', params: { intensity: 1 } });
  assert.ok(lo.beadRate < hi.beadRate && lo.streaks < hi.streaks);
  assert.equal(model({ register: 'playful', params: { intensity: 0 } }).beadRate, 0);
});

test('the drop stepper is deterministic per seed', () => {
  const a = run(createDrops(5), 300), b = run(createDrops(5), 300), c = run(createDrops(6), 300);
  assert.equal(snap(a), snap(b));
  assert.notEqual(snap(a), snap(c));
  assert.ok(a.beads.length > 50);
});

test('determinism holds for an uneven dt sequence', () => {
  const dts = Array.from({ length: 200 }, (_, i) => 1 / 60 + (i % 7) * 0.002);
  const go = () => { const d = createDrops(9); for (const dt of dts) d.step(dt); return snap(d); };
  assert.equal(go(), go());
});

test('beads merge on contact and conserve mass', () => {
  const d = createDrops(1, { rate: 0 });
  d.add(300, 400, 2);
  d.add(301, 400, 1.5);
  assert.equal(d.beads.length, 1);
  assert.ok(Math.abs(d.beads[0].r - Math.hypot(2, 1.5)) < 1e-9);
  assert.ok(Math.abs(d.mass() - (4 + 2.25)) < 1e-9);
});

test('a heavy merge becomes a runner, and mass is conserved', () => {
  const d = createDrops(1, { rate: 0 });
  d.add(300, 400, 3.6);
  d.add(302, 400, 3.2);
  assert.equal(d.beads.length, 0);
  assert.equal(d.runners.length, 1);
  assert.ok(Math.abs(d.mass() - (3.6 ** 2 + 3.2 ** 2)) < 1e-9);
});

test('runners fall and swallow beads in their path', () => {
  const d = createDrops(2, { rate: 0 });
  d.add(300, 300, 3.6); d.add(302, 300, 3.2); // one runner
  const run0 = d.runners[0], r0 = run0.r, y0 = run0.y;
  d.add(run0.x, run0.y + r0 + 0.4, 1.4);
  assert.equal(d.beads.length, 1);
  d.step(1 / 60);
  assert.equal(d.beads.length, 0, 'the bead in its path was swallowed');
  assert.ok(run0.r > r0);
  run(d, 30);
  assert.ok(run0.y > y0, 'and it falls');
});

test('mass is conserved within tolerance on runner merges below the cap', () => {
  const d = createDrops(3, { rate: 0 });
  d.add(300, 300, 3.6); d.add(302, 300, 3.2);
  const run0 = d.runners[0];
  d.add(run0.x, run0.y + 6, 1.2);
  const m0 = d.mass();
  d.step(1 / 60); // swallows the bead in the same step, before any shedding (travel < 7)
  assert.ok(Math.abs(d.mass() - m0) / m0 < 0.02, `mass drift ${d.mass()} vs ${m0}`);
});

test('runners never cross a calm zone', () => {
  const calm = [{ x: 150, y: 420, w: 360, h: 120 }];
  const d = createDrops(4, { calm });
  for (let i = 0; i < 1200; i++) {
    d.step(1 / 60);
    for (const r of d.runners) {
      const inside = r.x > calm[0].x && r.x < calm[0].x + calm[0].w && r.y > calm[0].y && r.y < calm[0].y + calm[0].h;
      assert.ok(!inside, `runner inside calm zone at ${r.x},${r.y}`);
    }
  }
});

test('calm zones hold fewer beads', () => {
  const calm = [{ x: 150, y: 420, w: 360, h: 120 }];
  const count = d => d.beads.filter(b => b.x > 150 && b.x < 510 && b.y > 420 && b.y < 540).length;
  const free = count(run(createDrops(4), 600)), quiet = count(run(createDrops(4, { calm }), 600));
  assert.ok(quiet < free * 0.4, `${quiet} vs ${free}`);
});

test('wiping removes the water it passes over', () => {
  const d = run(createDrops(5), 300);
  d.wipe(PANES[0].x0, 400, PANES[1].x1, 400, 40);
  assert.ok(!d.beads.some(b => Math.abs(b.y - 400) < 30));
  d.step(1 / 60, [{ x0: 100, y0: 600, x1: 1100, y1: 600, rad: 40 }]);
  assert.ok(!d.beads.some(b => Math.abs(b.y - 600) < 25));
});

test('progress is monotonic in its effect and time never moves it', () => {
  let prev = Infinity;
  for (let p = 0; p <= 1.0001; p += 0.05) {
    let fog = 0;
    for (let y = R.y; y < R.y + R.h; y += 6) for (let x = R.x; x < R.x + R.w; x += 12) fog += cover(p, x, y);
    assert.ok(fog <= prev + 1e-9, `fog rose at progress ${p}`);
    prev = fog;
  }
  assert.ok(cover(0, 600, R.y + R.h) > 0.999 && cover(1, 600, R.y) < 0.001);
  assert.equal(cover(null, 600, 400), 1);
  assert.ok(progressEdge(0.2) > progressEdge(0.8));
  const a = model({ time: 1, params: { progress: 0.4 } }), b = model({ time: 90, params: { progress: 0.4 } });
  assert.equal(a.progress, b.progress);
  assert.equal(model({ params: { progress: 3 } }).progress, 1);
});

test('fog field is deterministic and in range', () => {
  const g = fogField(1);
  let r; while (!(r = g.next()).done);
  assert.equal(r.value.length, MW * MH);
  assert.ok(r.value.every(v => v >= 114 && v <= 255));
  const g2 = fogField(1); let r2; while (!(r2 = g2.next()).done);
  assert.deepEqual(r.value, r2.value);
});

test('ghost path and steam are pure', () => {
  assert.equal(ghostPath(rng('ghost')).length, ghostPath(rng('ghost')).length);
  assert.deepEqual(steam(2.5), steam(2.5));
});
