import test from 'node:test';
import assert from 'node:assert/strict';
import maun from './index.js';
import { model, plan, planOf, passesAt, scrapeAt, breathAt, PALETTES, PALETTE_NAMES, RATE, STILL_TIME, W, H } from './model.js';
import { meta } from './meta.js';
import { paramsFromAttributes, defaultParams } from '../../core/define-scene.js';

const P = (o = {}) => ({ ...defaultParams(maun.params), ...o });

test('same seed, same painting; different seeds differ', () => {
  assert.deepEqual(plan(2), plan(2));
  assert.deepEqual(plan('monsoon'), plan('monsoon'));
  assert.notDeepEqual(plan(2).passes, plan(3).passes);
});

test('seed 2 is the plate’s own painting: kokum, 34 passes', () => {
  const p = plan(2);
  assert.equal(p.pal.name, 'kokum');
  assert.equal(p.passes.length, 34);
});

test('a painting is rolls and scrapes: the first seven are rolls, the last two scrapes open the light', () => {
  for (const seed of [1, 2, 3, 7, 42]) {
    const { passes } = plan(seed);
    assert.ok(passes.slice(0, 7).every(p => p.kind === 'roll'), `seed ${seed}`);
    assert.deepEqual(passes.slice(-2).map(p => p.kind), ['scrape', 'scrape']);
    for (const p of passes) assert.ok(p.alpha > 0 && p.alpha < 1 && p.w > 0 && p.h > 0);
  }
});

test('one restrained palette: every roll is the palette’s own colour', () => {
  for (const name of PALETTE_NAMES) {
    const { pal, passes } = plan(5, name);
    assert.equal(pal.name, name);
    const allowed = new Set([pal.mid, pal.dark, ...pal.paints]);
    for (const p of passes) if (p.kind === 'roll') assert.ok(allowed.has(p.color), `${name}: ${p.color}`);
  }
  assert.equal(plan(5, 'nonsense').pal, plan(5).pal, 'an unknown palette falls back to the seed’s');
});

test('the palette attribute is a closed list', () => {
  assert.deepEqual(PALETTE_NAMES, ['turmeric', 'monsoon', 'kokum', 'indigo']);
  assert.equal(paramsFromAttributes(maun.params, a => (a === 'palette' ? 'monsoon' : null)).palette, 'monsoon');
  assert.equal(paramsFromAttributes(maun.params, a => (a === 'palette' ? 'pink' : null)).palette, 'seed');
});

test('passes go down one at once, then about three a second, and stop', () => {
  assert.equal(passesAt(0, 34), 1);
  assert.equal(passesAt(1, 34), 1 + Math.floor(RATE));
  let prev = 0;
  for (let t = 0; t < 20; t += 0.1) { const d = passesAt(t, 34); assert.ok(d >= prev); prev = d; }
  assert.equal(prev, 34);
  assert.ok(34 / RATE < 12, 'about ten seconds of making');
});

test('the still is the finished painting in every register', () => {
  for (const register of ['quiet', 'warm', 'playful']) {
    const m = model({ time: STILL_TIME, seed: 2, register, params: P() });
    assert.equal(m.done, m.plan.passes.length, register);
    assert.ok(m.finished);
  }
  assert.ok(model({ time: STILL_TIME, register: 'quiet', params: P() }).settled, 'quiet rests');
  assert.ok(!model({ time: STILL_TIME, register: 'warm', params: P() }).settled, 'warm keeps breathing');
});

test('planOf is memoised; the breath stays over the painting', () => {
  assert.equal(planOf(3, 'seed'), planOf(3, 'seed'));
  for (let t = 0; t < 400; t += 7) { const b = breathAt(t); assert.ok(b.x > 0 && b.x < W && b.y > 0 && b.y < H); }
});

test('a hand’s scrape is centred where the hand is', () => {
  const s = scrapeAt(400, 300);
  assert.equal(s.kind, 'scrape');
  assert.ok(Math.abs(s.x + s.w / 2 - 400) < 1e-9 && s.y === 300);
});

test('meta keeps the lineage note, names only Gaitonde, no em dash', () => {
  assert.equal(meta.after.who, 'V. S. Gaitonde');
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
  assert.equal(PALETTES.length, 4);
});
