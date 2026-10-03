import test from 'node:test';
import assert from 'node:assert/strict';
import vad from './index.js';
import { growBanyan, banyan, schedule, scheduleOf, birthTimeOf, model, LOOKS, GROUND, KATTA_TOP, SKY, layMoment, canopyLeft, skyShape, minSizes, skySizes } from './model.js';
import { meta } from './meta.js';

test('same seed, same tree; different seeds differ', () => {
  const a = growBanyan(3), b = growBanyan(3);
  assert.equal(a.nodes.length, b.nodes.length);
  assert.deepEqual(a.nodes.slice(0, 50), b.nodes.slice(0, 50));
  assert.notEqual(growBanyan(4).nodes.length, a.nodes.length);
  assert.equal(banyan(3), banyan(3), 'memoised');
});

test('a tree: one trunk rising from the platform, every other node has a parent born before it', () => {
  const t = banyan(1);
  assert.equal(t.nodes[0].parent, -1);
  assert.ok(Math.abs(t.nodes[0].y - (KATTA_TOP + 4)) < 1e-9);
  for (let i = 1; i < t.nodes.length; i++) {
    const n = t.nodes[i];
    assert.ok(n.parent >= 0 && n.parent < i);
    assert.ok(n.birth >= t.nodes[n.parent].birth, `node ${i} born after its parent`);
  }
});

test('the pipe model: a parent is at least as thick as any child, and the trunk thickest', () => {
  const t = banyan(1);
  for (let i = 0; i < t.nodes.length; i++) for (const c of t.nodes[i].children) assert.ok(t.R[i] >= t.R[c] - 1e-6);
  assert.equal(Math.max(...t.R), t.R[0]);
});

test('aerial roots hang from limbs; a few reach the ground as pillars', () => {
  const t = banyan(1), kinds = t.roots.map(r => r.kind);
  assert.ok(kinds.includes('hang'));
  assert.ok(kinds.filter(k => k === 'pillar').length >= 1 && kinds.filter(k => k === 'pillar').length <= 5);
  for (const r of t.roots) assert.ok(r.ground > GROUND - 5 && r.ground < GROUND + 6);
});

test('the schedule: birth times rise with birth, and the tree is done after its last pillar thickens', () => {
  const t = banyan(1), s = schedule(t);
  assert.ok(birthTimeOf(t, 10) < birthTimeOf(t, 100));
  for (const r of s.roots) { assert.ok(r.land > r.start); assert.ok(s.endTime >= (r.kind === 'pillar' ? r.thickStart + 6 : r.land)); }
  assert.ok(s.endTime > 20 && s.endTime < 60, `${s.endTime}`);
});

test('progress holds the growth; the still is the grown tree', () => {
  const a = model({ time: 0, seed: 1, register: 'warm', params: { progress: 0.4 } });
  const b = model({ time: 99, seed: 1, register: 'warm', params: { progress: 0.4 } });
  assert.equal(a.local, b.local);
  assert.ok(Math.abs(a.local - 0.4 * scheduleOf(1).endTime) < 1e-9);
  assert.ok(model({ time: 0, params: { progress: 1 } }).done);
  assert.ok(model({ time: meta.stillTime, register: 'warm', params: {} }).done, 'the still time is past the end in every register');
  assert.equal(vad.status({ progress: 0.4 }), '40% done');
  assert.equal(vad.status({ progress: null }), '');
});

test('words in the world: the words are laid four times as the tree grows, each time against the quarter\'s end', () => {
  const end = scheduleOf(1).endTime;
  assert.equal(layMoment(end * 0.1, end), end / 4);
  assert.equal(layMoment(end * 0.26, end), end / 2);
  assert.equal(layMoment(end * 0.5, end), end / 2, 'a quarter holds until it ends');
  assert.equal(layMoment(end + 1, end), end, 'grown: the whole tree');
  const moments = new Set(Array.from({ length: 200 }, (_, i) => layMoment((end * i) / 199, end)));
  assert.equal(moments.size, 4, 'four layouts over the whole growth');
});

test('words in the world: the sky ends at the canopy, which only ever grows toward the words', () => {
  const tree = banyan(1), end = scheduleOf(1).endTime;
  const early = canopyLeft(tree, end * 0.2), grown = canopyLeft(tree, end);
  for (const y of [140, 180, 220, 260]) assert.ok(grown(y, y + 22) <= early(y, y + 22), `at ${y} the grown canopy reaches at least as far left`);
  assert.equal(grown(20, 40), Infinity, 'nothing above the dome');
  const shape = skyShape(tree, end, 560);
  assert.deepEqual(shape(40, 62), { x: SKY.x, w: 560 }, 'open sky: the full measure');
  const low = shape(180, 202);
  assert.ok(low && low.x + low.w <= grown(180, 202) - SKY.gap + 1e-9, 'beside the canopy: short of it by the gap');
  assert.equal(shape(330, 352), null, 'no room where the canopy is widest');
  // the model carries the param through
  assert.equal(model({ params: { words: 'world' } }).words, 'world');
  assert.equal(model({ params: {} }).words, 'panel');
});

test('words in the world: legible sizes follow the root font size; a phone or 200% text gets none', () => {
  assert.deepEqual(minSizes(16), { body: 14, heading: 20 });
  assert.ok(skySizes(1240 / 1200).length > 3);
  assert.deepEqual(skySizes(358 / 1200), []);
  assert.deepEqual(skySizes(1240 / 1200, 32), []);
});

test('registers and words', () => {
  assert.ok(LOOKS.warm.pace < LOOKS.playful.pace && LOOKS.quiet.pace === 0);
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
});
