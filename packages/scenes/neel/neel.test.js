import test from 'node:test';
import assert from 'node:assert/strict';
import neel from './index.js';
import { carve, plan, planOf, printerAt, visibleSeq, pressAt, printLength, lift, footprint, model, LOOKS, PALETTES, W, H, REST_IN, REST_OUT, HOME } from './model.js';
import { meta } from './meta.js';

test('same seed, same block and plan; seeds differ', () => {
  assert.deepEqual(carve(3), carve(3));
  assert.deepEqual(planOf(3).seq, planOf(3).seq);
  assert.notDeepEqual(carve(3).items, carve(4).items);
});

test('the block is one of three buti, carved with its mirror', () => {
  const types = new Set();
  for (let s = 1; s <= 30; s++) types.add(carve(s).type);
  assert.deepEqual([...types].sort(), ['bud', 'rosette', 'sprig']);
  const b = carve(1).bounds;
  assert.ok(Math.abs(b.x + b.w / 2) < 12, `roughly centred left to right: ${b.x}, ${b.w}`);
});

test('two passes over the same cells: outlines first, then the fill off register', () => {
  const { seq, palette } = planOf(1), n = seq.length / 2;
  assert.ok(Number.isInteger(n) && n > 20);
  assert.ok(seq.slice(0, n).every(s => s.pass === 0) && seq.slice(n).every(s => s.pass === 1));
  const dx = seq.slice(n).map((s, i) => s.x - seq[i].x);
  assert.ok(Math.abs(dx.reduce((a, b) => a + b) / n) > 1.5, 'the fill sits off register');
  assert.ok(PALETTES.includes(palette));
  for (const s of seq) assert.ok(s.load > 0 && s.load <= 1 && Math.abs(s.rot) < 0.04);
});

test('the printer: nothing down at the start, one at a time, everything down and the block home at the end', () => {
  const { seq } = planOf(2);
  assert.equal(printerAt(seq, 0).applied, 0);
  assert.deepEqual([printerAt(seq, 0).block.x, printerAt(seq, 0).block.y], REST_IN);
  let prev = 0;
  for (let t = 0; t < printLength(seq) + 1; t += 0.05) {
    const p = printerAt(seq, t);
    assert.ok(p.applied >= prev && p.applied <= prev + 1, `t=${t.toFixed(2)}`);
    prev = p.applied;
  }
  const end = printerAt(seq, printLength(seq) + 0.01);
  assert.equal(end.applied, seq.length); assert.equal(end.block, null); assert.ok(end.done);
  const home = printerAt(seq, printLength(seq) - HOME / 2);
  assert.ok(home.block.x > seq.at(-1).x && home.block.x < REST_OUT[0]);
  assert.deepEqual(printerAt(seq, 12.3), printerAt(seq, 12.3), 'a pure function of time');
});

test('the block presses where the ink goes down: lifted while it travels, flat at the press', () => {
  assert.equal(lift(0.2), 1);
  assert.equal(lift(0.65), 0);
  assert.ok(lift(0.5) > 0 && lift(0.5) < 1);
  assert.ok(lift(1) > 0.99);
});

test('progress: exactly that share, the block home, and the scene rests', () => {
  const m = model({ time: 5, seed: 1, register: 'warm', params: { progress: 0.4 } });
  assert.ok(m.held && m.settled && m.progress === 0.4);
  assert.equal(neel.status({ progress: 0.4 }), '40% done');
  assert.equal(neel.status({ progress: null }), '');
  assert.ok(!model({ time: 5, register: 'warm' }).settled);
  assert.ok(model({ time: 1000, register: 'warm' }).settled, 'warm rests when the length is printed');
});

test('playful prints faster than warm; quiet is the finished length', () => {
  assert.ok(LOOKS.playful.pace > LOOKS.warm.pace);
  assert.equal(model({ time: 0, register: 'quiet' }).printerTime, Infinity);
});

test('the words sit on plain cloth: impressions under them are left out', () => {
  const { seq, motif } = planOf(1), calm = [{ x: 60, y: 600, w: 520, h: 200 }];
  const vis = visibleSeq(seq, motif.bounds, calm);
  assert.ok(vis.length < seq.length && vis.length > seq.length / 2);
  const hit = (a, r) => a.x < r.x + r.w && a.x + a.w > r.x && a.y < r.y + r.h && a.y + a.h > r.y;
  for (const s of vis) assert.ok(!hit(footprint(s, motif.bounds), calm[0]));
  assert.equal(visibleSeq(seq, motif.bounds, []), seq);
});

test('a press under the hand: both blocks, near each other, the same for the same count', () => {
  const [a, b] = pressAt(1, 0, 400, 300);
  assert.equal(a.pass, 0); assert.equal(b.pass, 1);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 6);
  assert.deepEqual(pressAt(1, 0, 400, 300), pressAt(1, 0, 400, 300));
});

test('words and size', () => {
  assert.equal(W, 1200); assert.equal(H, 900);
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
});
