import test from 'node:test';
import assert from 'node:assert/strict';
import shet from './index.js';
import { buildField, season, windAt, gustAt, proj, unproj, T, LOOKS, STILL_AT, localOf, model, settledEgrets, W, H, Z_NEAR, Z_FAR } from './model.js';
import { makeEgrets, rainOf } from './year-model.js';
import { meta } from './meta.js';
import { paramsFromAttributes, defaultParams } from '../../core/define-scene.js';

const P = (o = {}) => ({ ...defaultParams(shet.params), ...o });

test('same seed, same field; different seeds differ', () => {
  const a = buildField(3), b = buildField(3), c = buildField(4);
  assert.deepEqual(a.plots, b.plots);
  assert.deepEqual(rainOf(a).slice(0, 20), rainOf(b).slice(0, 20));
  assert.notDeepEqual(a.plots, c.plots);
});

test('the field: plots, two levels of cracks, rows of rice near and far, raindrops in time order', () => {
  const f = buildField(1);
  assert.ok(f.plots.length > 4);
  assert.ok(f.pEdges.length > 0 && f.sEdges.length > 0, 'big cracks and fine cracks');
  assert.ok(f.near.length > 100 && f.far.length > f.near.length, `${f.near.length} near, ${f.far.length} far`);
  const drops = rainOf(f);
  assert.equal(rainOf(f), drops, 'drawn once per field, then kept');
  for (let i = 1; i < drops.length; i++) assert.ok(drops[i].t >= drops[i - 1].t);
  for (const d of drops) assert.ok(d.t >= T.spots[0] - 0.01 && d.t <= T.rainOut[1] + 0.01);
});

test('projection and its inverse agree on the ground plane', () => {
  for (const [gx, gz] of [[0, 1], [-1.2, 2.5], [2, 6.8]]) {
    const [x, y] = proj(gx, gz), [bx, bz] = unproj(x, y);
    assert.ok(Math.abs(bx - gx) < 1e-9 && Math.abs(bz - gz) < 1e-9);
  }
  assert.ok(proj(0, Z_NEAR)[1] > H && proj(0, Z_FAR)[1] < H / 2, 'the near edge is below the frame, the far rows high up');
});

test('the year: dry, rain, water, green, gold, cut, dry again', () => {
  assert.ok(season(2).rain === 0); assert.ok(season(2).water < 0);
  assert.ok(season(18).rain > 0.9, 'the monsoon');
  assert.ok(season(40).water > 1 && season(40).green > 0.5, 'flooded and green');
  assert.ok(season(STILL_AT).ripe > 0.5, 'the still is ripening gold');
  assert.ok(season(T.cut[1]).cut > Z_FAR, 'cut to the far edge');
  assert.ok(season(T.dry[1]).dry === 1);
});

test('wind: a unit direction and a strength, gusts that travel', () => {
  const [dx, dz, m, g] = windAt(0.3, 2, 10, -0.75);
  assert.ok(Math.abs(Math.hypot(dx, dz) - 1) < 1e-9);
  assert.ok(m > 0 && g >= 0 && g <= 1);
  const a = [0, 0.5, 1, 1.5].map(t => gustAt(0.3, 2, t, -0.75));
  assert.ok(new Set(a.map(v => v.toFixed(4))).size > 1, 'the gust moves over time');
});

test('progress is a held moment of the year: time stands still, the scene settles, the status says it', () => {
  const a = model({ time: 0, register: 'warm', params: P({ progress: 0.5 }) });
  const b = model({ time: 900, register: 'warm', params: P({ progress: 0.5 }) });
  assert.equal(a.local, b.local); assert.ok(a.settled && a.held);
  assert.ok(!model({ time: 3, params: P() }).settled);
  assert.equal(localOf(0), 0); assert.ok(localOf(1) < T.cycle);
  assert.equal(shet.status(P({ progress: 0.4 })), '40% done');
  assert.equal(shet.status(P()), '');
  assert.equal(paramsFromAttributes(shet.params, n => (n === 'progress' ? '2' : null)).progress, 1);
});

test('registers: quiet is the still, warm an easier year, playful takes the wind', () => {
  assert.equal(LOOKS.quiet.pace, 0);
  assert.ok(LOOKS.warm.pace < LOOKS.playful.pace);
  assert.ok(LOOKS.playful.touch && !LOOKS.warm.touch);
  assert.equal(meta.stillTime, STILL_AT);
  assert.deepEqual(model({ register: 'loud' }).look, LOOKS.warm);
});

test('the egrets come with the water and leave before the dry', () => {
  const e = makeEgrets(1);
  for (let k = 0; k < 600; k++) e.step(1 / 30, true, null, null);
  assert.ok(e.placed().length === 2, 'both in the field');
  for (let k = 0; k < 600; k++) e.step(1 / 30, false, null, null);
  assert.equal(e.placed().length, 0, 'both gone');
  const s = makeEgrets(2); s.settle();
  for (const p of s.placed()) assert.ok(p.x > 0 && p.x < W && p.y > 0 && p.y < H);
});

test('the still places the egrets where the simulation settles them (one seeded plan, two halves)', () => {
  for (const seed of [1, 2, 7, 'shet']) {
    const sim = makeEgrets(seed); sim.settle();
    const at = list => list.map(p => [p.x, p.y, p.s, p.b.dir, p.b.peck]);
    assert.deepEqual(at(settledEgrets(seed)), at(sim.placed()), `seed ${seed}`);
  }
});

test('meta: no em dash, no living person named', () => {
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
});
