import test from 'node:test';
import assert from 'node:assert/strict';
import './index.js';
import {
  model, buildScene, scene, createFlock, resetFlock, stepFlock, simulate, startle, darkness, nightFor, skyLch, skyS, oklchToRgb,
  rgbToOklab, hawkField, calmPush, LOOKS, CYCLE, T, STILL_TIME, W, HZ,
} from './model.js';
import { getScene } from '../../core/define-scene.js';

const snap = F => Array.from(F.x.slice(0, 40)).concat(Array.from(F.y.slice(0, 40)));

test('the scene registers as saanj, interactive only in playful', () => {
  const def = getScene('saanj');
  assert.ok(def);
  assert.deepEqual(def.interactive, ['playful']);
});

test('same seed, same evening: palms, stars, planet', () => {
  assert.deepEqual(buildScene(3), buildScene(3));
  assert.notDeepEqual(buildScene(1).palms.map(p => p.x), buildScene(2).palms.map(p => p.x));
  assert.equal(scene(5), scene(5), 'memoised');
});

test('the stars keep their distance (Poisson disc, 34 units)', () => {
  const { stars } = buildScene(1);
  assert.ok(stars.length > 100, `${stars.length} stars`);
  for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) {
    assert.ok(Math.hypot(stars[i].x - stars[j].x, stars[i].y - stars[j].y) >= 34 - 1e-9);
  }
});

test('the flock is deterministic: same seed, same steps, same birds', () => {
  const a = createFlock(2, 150), b = createFlock(2, 150);
  simulate(a, 0, 6); simulate(b, 0, 6);
  assert.deepEqual(snap(a), snap(b));
  const c = createFlock(3, 150);
  simulate(c, 0, 6);
  assert.notDeepEqual(snap(a), snap(c));
});

test('the flock holds together in the sky and off the fields while it murmurs', () => {
  const F = createFlock(1, 200);
  simulate(F, 0, 25, {}, 1 / 30);
  let inSky = 0;
  for (let i = 0; i < F.n; i++) if (F.y[i] > 0 && F.y[i] < HZ - 40 && F.x[i] > -60 && F.x[i] < W + 60) inSky++;
  assert.ok(inSky / F.n > 0.9, `${inSky} of ${F.n} in the sky`);
});

test('by full night every bird has gone home to the palms, and at dawn they leave', () => {
  const F = createFlock(1, 160);
  simulate(F, 0, T.dawn - 1, {}, 1 / 30);
  const roosting = F.state.filter(s => s === 1).length;
  assert.ok(roosting / F.n > 0.95, `${roosting} of ${F.n} roosting`);
  simulate(F, T.dawn - 1, CYCLE - 0.5, {}, 1 / 30);
  const gone = F.state.filter(s => s === 2).length;
  assert.ok(gone / F.n > 0.8, `${gone} of ${F.n} flown away by the end of the cycle`);
});

test('the calm zone: birds inside the page’s words are pushed out, and the flock flies round them', () => {
  const calm = [{ x: 300, y: 150, w: 400, h: 150 }];
  assert.equal(calmPush(100, 100, calm), null);
  assert.ok(calmPush(310, 225, calm)[0] < 0, 'near the left edge: pushed left');
  const inside = F => { let k = 0; for (let i = 0; i < F.n; i++) if (!F.state[i] && F.x[i] > 300 && F.x[i] < 700 && F.y[i] > 150 && F.y[i] < 300) k++; return k; };
  const free = createFlock(1, 300), kept = createFlock(1, 300);
  let a = 0, b = 0;
  for (let t = 8; t < 30; t += 2) {
    simulate(free, t - 2, t, {}, 1 / 30); simulate(kept, t - 2, t, { calm }, 1 / 30);
    a += inside(free); b += inside(kept);
  }
  assert.ok(a > 30, `without calm, birds do cross the box (${a} bird-samples)`);
  assert.ok(b < a * 0.15, `with calm, few do (${b} against ${a})`);
});

test('the governor’s share: only the active birds move', () => {
  const F = createFlock(1, 200), x0 = Array.from(F.x);
  for (let k = 0; k < 30; k++) stepFlock(F, 1 / 30, { t: 5 + k / 30, active: 100 });
  assert.notEqual(F.x[10], x0[10]);
  assert.equal(F.x[150], x0[150]);
});

test('the hawk: its field is negative inside the body, and birds near it are alarmed', () => {
  assert.ok(hawkField(0, 0, 0, 0, 0).d < 0);
  assert.ok(hawkField(300, 0, 0, 0, 0).d > 200);
  const F = createFlock(1, 200);
  simulate(F, 0, 12, {}, 1 / 30);
  const [hx, hy] = [F.x[0], F.y[0]];
  simulate(F, 12, 12.5, { hawk: { x: hx, y: hy, ang: 0 } });
  let alarmed = 0; for (let i = 0; i < F.n; i++) if (F.alarm[i] > 0.3) alarmed++;
  assert.ok(alarmed > 5, `${alarmed} birds alarmed`);
  const G = createFlock(1, 200); simulate(G, 0, 12, {}, 1 / 30);
  assert.ok(startle(G, G.x[0], G.y[0], 70) > 1);
});

test('dusk: darkness rises to night and falls again at dawn; a dark page is always later', () => {
  assert.ok(darkness(0) < 0.05 && darkness(T.roost + 20) > 0.95 && darkness(CYCLE - 1) < 0.05);
  for (let t = 2; t < T.roost + 18; t += 0.5) assert.ok(darkness(t + 0.5) >= darkness(t) - 1e-9);
  for (const d of [0, 0.3, 1]) assert.ok(nightFor(d) >= Math.min(d, 0.9) && nightFor(d) >= 0.5);
});

test('the sky ramp mixes in OKLCH and stays in gamut; the middle is rose, not grey', () => {
  for (let s = 0; s <= 1; s += 0.05) {
    const rgb = oklchToRgb(...skyLch(s));
    assert.ok(rgb.every(v => v >= 0 && v <= 255));
  }
  const [, C] = rgbToOklab(oklchToRgb(...skyLch(0.4)).map(v => v / 255)).reduce((acc, v, i) => (i ? [acc[0], Math.hypot(acc[1], v)] : [v, 0]), [0, 0]);
  assert.ok(C > 0.06, `chroma at the middle of the ramp ${C.toFixed(3)}`);
  assert.ok(skyS(0, 0.5) > skyS(1, 0.5), 'the zenith is further along the ramp than the horizon');
});

test('model: every register’s still is the plate’s own moment; warm is an easier dusk', () => {
  for (const register of ['quiet', 'warm', 'playful']) assert.equal(model({ time: STILL_TIME, register }).local, STILL_TIME);
  const w = model({ time: 60, register: 'warm' }).local - model({ time: 50, register: 'warm' }).local;
  const p = model({ time: 60, register: 'playful' }).local - model({ time: 50, register: 'playful' }).local;
  assert.ok(w < p);
  assert.ok(LOOKS.playful.hawk && !LOOKS.warm.hawk && !LOOKS.quiet.hawk);
  const m = model({ time: CYCLE + 30, register: 'playful' });
  assert.equal(m.cycle, 1);
  assert.ok(m.local >= 0 && m.local < CYCLE);
  assert.deepEqual(model({ time: 33, seed: 4, register: 'warm' }), model({ time: 33, seed: 4, register: 'warm' }));
  resetFlock(createFlock(1, 10), 1);
});
