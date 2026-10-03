import test from 'node:test';
import assert from 'node:assert/strict';
import mithagar, {
  model,
  panLayout,
  sluiceGate,
  crystallization,
  skyAtmosphere,
  saltHeaps,
  sandpiperBehaviors,
  raker,
  panDrying,
  LOOKS,
  W,
  H,
  HORIZON_Y,
  PAN_ROWS,
  PAN_COLS,
} from './index.js';
import { meta } from './meta.js';
import { sunAt, shadowLength } from '../../engine/index.js';

test('determinism: same seed produces identical model outputs', () => {
  const m1 = model({ time: 5, seed: 42, register: 'warm', params: { progress: 0.5, timeOfDay: 0.2 } });
  const m2 = model({ time: 5, seed: 42, register: 'warm', params: { progress: 0.5, timeOfDay: 0.2 } });
  assert.deepEqual(m1, m2);

  const m3 = model({ time: 5, seed: 43, register: 'warm', params: { progress: 0.5, timeOfDay: 0.2 } });
  assert.notDeepEqual(m1.layout.pans[0].polygon, m3.layout.pans[0].polygon);
});

test('registers: quiet is settled still, warm breathes ambient motion, playful adds waders and raking', () => {
  const quiet = model({ time: 10, register: 'quiet' });
  assert.equal(quiet.settled, true);
  assert.equal(quiet.ripples.amp, 0);
  assert.equal(quiet.shimmer.amp, 0);
  assert.equal(quiet.sandpipers.length, 0);
  assert.equal(quiet.look.motion, false);

  const warm = model({ time: 10, register: 'warm' });
  assert.equal(warm.settled, false);
  assert.ok(warm.ripples.amp > 0);
  assert.ok(warm.shimmer.amp > 0);
  assert.equal(warm.sandpipers.length, 1);
  assert.equal(warm.look.motion, true);

  const playful = model({ time: 10, register: 'playful' });
  assert.equal(playful.settled, false);
  assert.ok(playful.ripples.amp >= warm.ripples.amp);
  assert.ok(playful.shimmer.amp >= warm.shimmer.amp);
  assert.equal(playful.sandpipers.length, 4);
  assert.equal(playful.look.motion, true);
});

test('progress handling: water recedes, crust thickens, and pyramids grow monotonically', () => {
  const p0 = model({ params: { progress: 0 } });
  assert.equal(p0.crys.recede, 0);
  assert.equal(p0.crys.crustThickness, 0);
  assert.ok(p0.heaps.every(h => h.height === 0));

  const steps = [0, 0.25, 0.5, 0.75, 1.0];
  let prevRecede = -1;
  let prevCrust = -1;
  let prevHeapHeight = -1;

  for (const p of steps) {
    const m = model({ params: { progress: p } });
    assert.ok(m.crys.recede >= prevRecede, `recede monotonic at ${p}`);
    assert.ok(m.crys.crustThickness >= prevCrust, `crust monotonic at ${p}`);

    const avgHeight = m.heaps.reduce((sum, h) => sum + h.height, 0) / m.heaps.length;
    assert.ok(avgHeight >= prevHeapHeight, `heap height monotonic at ${p}`);

    prevRecede = m.crys.recede;
    prevCrust = m.crys.crustThickness;
    prevHeapHeight = avgHeight;
  }

  const p1 = model({ params: { progress: 1 } });
  assert.ok(p1.crys.recede >= 12);
  assert.ok(p1.crys.crustThickness >= 15);
  assert.ok(p1.heaps.every(h => h.height > 18));
});

test('progress clamping: negative and oversized numbers are safely bounded', () => {
  assert.equal(model({ params: { progress: -0.8 } }).progress, 0);
  assert.equal(model({ params: { progress: 2.5 } }).progress, 1);
});

test('timeOfDay changes solar position and atmosphere palettes', () => {
  const dawn = skyAtmosphere(0);
  const noon = skyAtmosphere(0.5);
  const dusk = skyAtmosphere(1.0);

  assert.notEqual(dawn.zenith, noon.zenith);
  assert.notEqual(noon.zenith, dusk.zenith);
  assert.notEqual(dawn.horizon, dusk.horizon);
  assert.ok(noon.sun.y < dawn.sun.y, 'noon sun is higher than dawn sun');
  assert.ok(noon.sun.y < dusk.sun.y, 'noon sun is higher than dusk sun');
});

test('pan layout produces exactly twelve geometric pans inside bounds', () => {
  const layout = panLayout(1, W, H);
  assert.equal(layout.pans.length, PAN_ROWS * PAN_COLS);

  for (const pan of layout.pans) {
    assert.ok(pan.x0 >= 50 && pan.x1 <= W - 50);
    assert.ok(pan.y0 >= HORIZON_Y && pan.y1 <= H);
    assert.ok(pan.w > 180);
    assert.ok(pan.h > 100);
    assert.equal(pan.polygon.length, 4);
  }

  assert.equal(layout.bunds.horizontal.length, 4);
  assert.equal(layout.bunds.vertical.length, 5);
});

test('sluice gate contains laterite piers, timber planks, and lifting lever', () => {
  const sl = sluiceGate(1);
  assert.ok(sl.leftPier.x0 < sl.rightPier.x0);
  assert.ok(sl.planks.length >= 3);
  assert.ok(sl.lever.y0 < sl.lever.y1);
});

test('sandpiper state machines run, pause, and peck on bund tracks', () => {
  const birds0 = sandpiperBehaviors(0, 1, 4);
  const birds1 = sandpiperBehaviors(1.5, 1, 4);
  assert.equal(birds0.length, 4);
  assert.equal(birds1.length, 4);

  // Checks that bird states rotate deterministically
  const states = new Set(Array.from({ length: 30 }, (_, i) => sandpiperBehaviors(i * 0.3, 1, 1)[0].state));
  assert.ok(states.has('run'), 'bird has run state');
  assert.ok(states.has('stand'), 'bird has stand state');
  assert.ok(states.has('peck'), 'bird has peck state');
});

test('scene definition, status, and accessibility contracts', () => {
  assert.equal(mithagar.name, 'mithagar');
  assert.equal(mithagar.meta.id, 'mithagar');
  assert.equal(mithagar.meta.W, 1200);
  assert.equal(mithagar.meta.H, 800);
  assert.deepEqual(mithagar.interactive, ['playful']);

  assert.equal(mithagar.status({ progress: null }), '');
  assert.equal(mithagar.status({ progress: 0 }), '0% crystallized');
  assert.equal(mithagar.status({ progress: 0.42 }), '42% crystallized');
  assert.equal(mithagar.status({ progress: 1.0 }), '100% crystallized');
});

test('copy standards: no em dashes in any user-facing text, metadata, or map', () => {
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit', 'prompt']) {
    if (meta[k]) assert.ok(!meta[k].includes('—'), `em dash found in meta.${k}`);
  }
  for (const spark of meta.sparks || []) {
    assert.ok(!spark.includes('—'), `em dash found in spark: "${spark}"`);
  }
  for (const row of meta.map) {
    assert.ok(!row.join(' ').includes('—'), `em dash found in map: "${row[0]}"`);
  }
});

test('drying: progress 0 leaves every pan wet and progress 1 leaves every pan dry, for any seed', () => {
  for (const seed of [1, 2, 7, 42, 1001]) {
    const { pans } = panLayout(seed, W, H);
    assert.equal(pans.length, 12);
    for (const pan of pans) {
      assert.equal(panDrying(pan, 0), 0, `seed ${seed} pan ${pan.id} wet at 0`);
      assert.equal(panDrying(pan, 1), 1, `seed ${seed} pan ${pan.id} dry at 1`);
    }
  }
});

test('drying: a front, so a pan farther from the corner is never drier than a nearer one', () => {
  const { pans } = panLayout(1, W, H);
  const ox = pans[0].x0, oy = pans[0].y0;
  const byDistance = [...pans].sort((a, b) =>
    Math.hypot(a.center[0] - ox, a.center[1] - oy) - Math.hypot(b.center[0] - ox, b.center[1] - oy));
  for (let p = 0; p <= 1.0001; p += 0.05) {
    for (let i = 1; i < byDistance.length; i++) {
      assert.ok(panDrying(byDistance[i], p) <= panDrying(byDistance[i - 1], p) + 1e-9,
        `farther pan drier than nearer at progress ${p.toFixed(2)}`);
    }
  }
  // Each pan only ever dries.
  for (const pan of pans) {
    let prev = 0;
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const d = panDrying(pan, p);
      assert.ok(d >= prev - 1e-9, `pan ${pan.id} un-dries at ${p}`);
      prev = d;
    }
  }
  // It is a real front: partway through, some pans are dry and some still wet.
  const mid = pans.map(pan => panDrying(pan, 0.5));
  assert.ok(Math.max(...mid) > 0.9 && Math.min(...mid) < 0.1, 'both dry and wet pans at 0.5');
  // And the far pan is dry before the end, not exactly at it.
  assert.ok(pans.every(pan => panDrying(pan, 0.95) === 1), 'every pan dry by 0.95');
});

test('raker shadow is the engine sun read twice: length from its elevation, direction from the disc', () => {
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    const sky = skyAtmosphere(t);
    const rk = raker(0, 0, t, 1, sky.sun.x);
    const sun = sunAt(t, { latitudeDeg: 15 });
    assert.equal(rk.sunElevationDeg, sky.sun.elevationDeg, `same elevation as the disc at t=${t}`);
    assert.equal(rk.sunElevationDeg, sun.elevationDeg);
    assert.ok(Math.abs(rk.shadow - shadowLength(rk.height, sun.elevationDeg, { max: 1.5 }) / rk.height) < 1e-12,
      `shadow is h / tan(elevation) at t=${t}`);
    assert.equal(rk.shadowDir, sky.sun.x >= W / 2 ? -1 : 1, `shadow thrown away from the disc at t=${t}`);
  }
});

test('raker shadow: longest at either end of the day, shortest at noon, symmetric', () => {
  const len = t => raker(0, 0, t, 1, skyAtmosphere(t).sun.x).shadow;
  assert.equal(len(0), 1.5);
  assert.equal(len(1), 1.5);
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    assert.ok(len(t) >= len(0.5) - 1e-12, `noon is the shortest (t=${t})`);
    assert.ok(len(t) <= 1.5 + 1e-12, `never longer than a body and a half (t=${t})`);
    assert.ok(Math.abs(len(t) - len(1 - t)) < 1e-9, `symmetric about noon (t=${t})`);
  }
  assert.ok(len(0.5) < 0.4, 'a short shadow at noon');
  assert.ok(len(0.1) > len(0.3) && len(0.3) > len(0.5), 'shortens toward noon');
});

test('raker shadow falls away from the sun: right of the frame at dawn the sun is east, shadow goes left', () => {
  const dawn = skyAtmosphere(0.1), dusk = skyAtmosphere(0.9);
  assert.ok(dawn.sun.x > W / 2 && dusk.sun.x < W / 2, 'sun crosses from right to left');
  assert.equal(raker(0, 0, 0.1, 1, dawn.sun.x).shadowDir, -1, 'dawn shadow falls to the left');
  assert.equal(raker(0, 0, 0.9, 1, dusk.sun.x).shadowDir, 1, 'dusk shadow falls to the right');
});

test('sun disc: right at dawn, centre at noon, left at dusk, on the horizon at the ends and high at noon', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
  const d = skyAtmosphere(0).sun, n = skyAtmosphere(0.5).sun, e = skyAtmosphere(1).sun;
  near(d.x, 780); near(n.x, 600); near(e.x, 420);
  near(d.y, 212); near(n.y, 72); near(e.y, 212);
});
