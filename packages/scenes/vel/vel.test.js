import test from 'node:test';
import assert from 'node:assert/strict';
import vel from './index.js';
import { rng } from '../../engine/index.js';
import { derive, buildVine, buildWall, fallPlan, fallFrames, sceneOf, model, LOOKS, STILL_TIME, W, H, CAP_TOP, GROUND } from './model.js';
import { meta } from './meta.js';

test('the grammar: brackets balance, every apex ends as a tip, and the seed repeats it', () => {
  const a = derive(rng('t:1')), b = derive(rng('t:1')), c = derive(rng('t:2'));
  let depth = 0;
  for (const t of a) { if (t.s === '[') depth++; if (t.s === ']') depth--; assert.ok(depth >= 0); }
  assert.equal(depth, 0);
  assert.ok(!a.some(t => t.s === 'A'), 'no apex left unrewritten');
  assert.ok(a.some(t => t.s === 'B'), 'it flowers');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('segments shorten with each generation', () => {
  const len = derive(rng('t:3')).filter(t => t.s === 'F').map(t => t.len);
  assert.ok(Math.max(...len) <= 42 * 1.2 + 1e-9);
  assert.ok(Math.min(...len) >= 42 * Math.pow(0.93, 6) * 0.75 - 1e-9);
});

test('the vine: three canes from behind the wall, a tree of stems, leaves and blooms, the same for the same seed', () => {
  const v = buildVine(1), again = buildVine(1);
  assert.equal(v.stems.filter(s => !s.parent).length, 3);
  assert.equal(v.roots.length, 3);
  for (const s of v.stems.filter(s => !s.parent)) assert.equal(s.pts[0][1], CAP_TOP + 6);
  for (const s of v.stems) if (s.parent) assert.ok(s.parent.children.includes(s) && s.depth === s.parent.depth + 1);
  assert.ok(v.leaves.length > 100 && v.clusters.length > 60, `${v.leaves.length} leaves, ${v.clusters.length} blooms`);
  assert.deepEqual(v.bounds, again.bounds);
  assert.equal(v.clusters[7].petals[1].d, again.clusters[7].petals[1].d);
  assert.notDeepEqual(buildVine(2).bounds, v.bounds);
});

test('gravity: the vine arches up and spills down over the wall, inside the frame', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const b = buildVine(seed).bounds;
    assert.ok(b.y0 < CAP_TOP - 80, `seed ${seed} rises: ${b.y0}`);
    assert.ok(b.y1 > CAP_TOP + 60, `seed ${seed} hangs over the cap: ${b.y1}`);
    assert.ok(b.y1 < GROUND - 20 && b.x0 > -20 && b.x1 < W + 20, `seed ${seed} stays in the frame`);
  }
});

test('growth flows from the root: every stem, leaf and bract starts no earlier than its parent reaches it', () => {
  const v = buildVine(1);
  for (const s of v.stems) {
    for (let i = 1; i < s.chunks.length; i++) assert.ok(s.chunks[i].t >= s.chunks[i - 1].t);
    if (s.parent && s.chunks.length && s.parent.chunks.length) assert.ok(s.chunks[0].t >= s.parent.chunks[0].t);
  }
  const first = Math.min(...v.stems.flatMap(s => s.chunks.map(c => c.t)));
  assert.ok(Math.abs(first - 0.4) < 1e-9, 'the roots start at 0.4 s');
  assert.ok(v.growEnd > 9 && v.growEnd < 14, `the last bloom opens at ${v.growEnd.toFixed(2)} s`);
  assert.ok(STILL_TIME > v.growEnd + 5);
});

test('the taper: canes are thick at the root and fine at the tips', () => {
  const v = buildVine(1), root = v.stems.find(s => !s.parent && s.chunks.length > 3);
  assert.ok(root.chunks[0].w > 5 && root.chunks.at(-1).w < root.chunks[0].w);
  const tips = v.stems.filter(s => !s.children.length && s.chunks.length);
  assert.ok(tips.every(s => s.chunks.at(-1).w < 3));
});

test('a bloom is three bracts around a small white flower', () => {
  const c = buildVine(1).clusters[0];
  assert.equal(c.petals.length, 3);
  assert.match(c.star, /^M.*Z$/);
});

test('the wall: six courses of blocks, a cap, pits, stains, the ground and bracts fallen before', () => {
  const w = buildWall(1);
  assert.ok(w.blocks.length > 40);
  assert.equal(w.stains.length, 16);
  assert.equal(w.palms.length, 2);
  assert.equal(w.fallen.length, 11);
  for (const k of ['cap', 'pits', 'flecks', 'ground', 'hatch', 'grass', 'far', 'near', 'splash']) assert.ok(w[k].length > 20, k);
  assert.deepEqual(buildWall(1).blocks[3], w.blocks[3]);
});

test('falling bracts: five, after the growing, each lands on the ground', () => {
  const v = buildVine(1), f = fallPlan(v, 1);
  assert.equal(f.length, 5);
  for (const x of f) {
    assert.ok(x.delay > v.growEnd && x.land > GROUND && x.land < H);
    const fr = fallFrames(x, 0.3, 0.7);
    assert.equal(fr[0].offset, 0); assert.equal(fr.at(-1).offset, 1);
    for (let i = 1; i < fr.length; i++) assert.ok(fr[i].offset > fr[i - 1].offset);
  }
});

test('registers: quiet is a settled still, warm a lighter breeze than playful', () => {
  assert.equal(LOOKS.quiet.breeze, 0); assert.equal(LOOKS.quiet.falls, 0);
  assert.ok(LOOKS.warm.breeze < LOOKS.playful.breeze && LOOKS.warm.falls < LOOKS.playful.falls);
  assert.ok(model({ register: 'quiet' }).settled);
  assert.ok(!model({ time: 3, register: 'warm' }).settled);
  assert.ok(model({ time: 20, register: 'warm' }).grown && !model({ time: 2, register: 'warm' }).grown);
  assert.equal(model({ seed: 3 }).S, sceneOf(3), 'the vine is built once per seed');
});

test('definition and meta', () => {
  assert.equal(vel.name, 'vel');
  assert.equal(vel.kind, 'svg');
  assert.deepEqual(vel.interactive, ['playful']);
  assert.equal(meta.W, 1200); assert.equal(meta.H, 800);
  assert.equal(meta.stillTime, STILL_TIME);
  assert.ok(meta.alt && meta.keys && meta.prompt.includes('three registers'));
  for (const [phrase] of meta.map) assert.ok(meta.prompt.includes(phrase), phrase);
});
