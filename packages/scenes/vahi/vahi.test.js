import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDesk, desk, paperPose, model, timeline, fitAround, actionBox, entryLine, scatterOffset, KINDS, COUNT, BOOK, W, H } from './model.js';

test('makeDesk: the same seed always deals the same pile', () => {
  assert.deepEqual(makeDesk(3), makeDesk(3));
});

test('makeDesk: a new seed moves the papers but keeps the same papers', () => {
  const a = makeDesk(1), b = makeDesk(2);
  assert.notEqual(a.papers[0].pile.x, b.papers[0].pile.x);
  assert.deepEqual(a.papers.map(p => p.kind), b.papers.map(p => p.kind));
  assert.deepEqual(a.papers.map(p => p.kind), KINDS);
});

test('makeDesk: ranks are a sorting order, each paper once', () => {
  for (const seed of [1, 2, 3, 9, 'records']) {
    const ranks = makeDesk(seed).papers.map(p => p.rank).sort((x, y) => x - y);
    assert.deepEqual(ranks, [...Array(COUNT).keys()]);
  }
});

test('makeDesk: the pile lies on the table and left of the open book', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const p of makeDesk(seed).papers) {
      assert.ok(p.pile.x > 40 && p.pile.x < W - 40 && p.pile.y > 40 && p.pile.y < H - 40, `inside the table: ${p.pile.x}, ${p.pile.y}`);
      assert.ok(p.pile.x < BOOK.x - BOOK.pw * 0.55, `the pile sits left of the book: ${p.pile.x}`);
    }
  }
});

test('desk(): memoised per seed', () => {
  assert.equal(desk(4), desk(4));
  assert.notEqual(desk(4), desk(5));
});

test('paperPose: 0 is the pile, 1 is the stack, and the path never jumps', () => {
  const p = makeDesk(1).papers[2];
  assert.equal(paperPose(p, 0).x, p.pile.x);
  assert.equal(paperPose(p, 1).y, p.stack.y);
  let prev = paperPose(p, 0);
  for (let k = 0.005; k <= 1.0001; k += 0.005) {
    const q = paperPose(p, Math.min(1, k));
    assert.ok(Math.hypot(q.x - prev.x, q.y - prev.y) < 30, `a step of ${Math.hypot(q.x - prev.x, q.y - prev.y)} at k=${k}`);
    prev = q;
  }
});

test('paperPose: lifted off the table only in flight', () => {
  const p = makeDesk(1).papers[0];
  assert.equal(paperPose(p, 0).lift, 0);
  assert.equal(paperPose(p, 1).lift, 0);
  assert.ok(paperPose(p, 0.5).lift > 0.5);
});

test('model: at the start everything is in the pile and the book is open', () => {
  const f = model({ time: 0, seed: 1, register: 'warm' });
  assert.equal(f.sorted, 0);
  assert.equal(f.close, 0);
  assert.ok(f.papers.every(p => p.k === 0));
  assert.equal(f.settled, false);
});

test('model: one living thing at a time, never two papers in flight', () => {
  const end = timeline('warm').end;
  for (let t = 0; t < end; t += 0.05) {
    const moving = model({ time: t, seed: 3, register: 'warm' }).papers.filter(p => p.k > 0 && p.k < 1);
    assert.ok(moving.length <= 1, `${moving.length} in flight at ${t.toFixed(2)} s`);
  }
});

test('model: sorting only ever moves forward', () => {
  let prev = -1;
  for (let t = 0; t < 40; t += 0.1) {
    const f = model({ time: t, seed: 2, register: 'playful' });
    assert.ok(f.done >= prev, `done went back at ${t}`);
    prev = f.done;
  }
});

test('model: at the end the book is shut, the string wound and the scene settled', () => {
  const end = timeline('warm').end;
  const f = model({ time: end + 0.01, seed: 1, register: 'warm' });
  assert.equal(f.sorted, COUNT);
  assert.equal(f.close, 1);
  assert.equal(f.wind, 1);
  assert.equal(f.settled, true);
  assert.equal(f.entries.length, COUNT);
});

test('model: the pen writes only while a line is being written', () => {
  for (let t = 0; t < timeline('warm').end; t += 0.1) {
    const f = model({ time: t, seed: 1, register: 'warm' });
    const writing = f.papers.some(p => p.written > 0 && p.written < 1);
    assert.equal(f.pen.writing, writing, `at ${t.toFixed(1)} s`);
  }
});

test('progress: sorts exactly that much, and time stands still', () => {
  const a = model({ time: 0, seed: 1, register: 'warm', params: { progress: 0.5 } });
  const b = model({ time: 100, seed: 1, register: 'warm', params: { progress: 0.5 } });
  assert.deepEqual(a, b);
  assert.equal(a.sorted, COUNT / 2);
  assert.equal(a.close, 0);
  assert.equal(a.settled, true);
});

test('progress: the book is shut only at 1', () => {
  assert.equal(model({ seed: 1, params: { progress: 0.99 } }).close, 0);
  const f = model({ seed: 1, params: { progress: 1 } });
  assert.equal(f.close, 1);
  assert.equal(f.sorted, COUNT);
});

test('progress: 0 leaves the whole pile and an empty page', () => {
  const f = model({ seed: 1, params: { progress: 0 } });
  assert.equal(f.sorted, 0);
  assert.equal(f.entries.length, 0);
});

test('quiet: the finished still, whatever the time', () => {
  const f = model({ time: 0, seed: 1, register: 'quiet' });
  assert.equal(f.close, 1);
  assert.equal(f.sorted, COUNT);
  assert.equal(f.settled, true);
});

test('entryLine: eight entries fit on the page', () => {
  const last = entryLine(COUNT - 1);
  assert.ok(last.y < BOOK.y + BOOK.ph / 2 - 10, `last line at ${last.y}`);
});

test('fitAround: no slotted text, no move', () => {
  assert.deepEqual(fitAround([], actionBox(1)), { s: 1, tx: 0, ty: 0 });
});

test('fitAround: text in the bottom left moves the action clear of it', () => {
  const calm = [{ x: 40, y: 560, w: 440, h: 190 }], box = actionBox(1), f = fitAround(calm, box);
  assert.ok(f.s >= 0.42 && f.s <= 1);
  const x0 = box.x * f.s + f.tx, y0 = box.y * f.s + f.ty, x1 = x0 + box.w * f.s, y1 = y0 + box.h * f.s;
  const r = calm[0], overlap = !(x1 < r.x || x0 > r.x + r.w || y1 < r.y || y0 > r.y + r.h);
  assert.equal(overlap, false, `fitted box ${[x0, y0, x1, y1].map(Math.round)} clears the text`);
});

test('scatterOffset: pushes away from the hand, and is spent by the end', () => {
  const o = scatterOffset({ x: 300, y: 300 }, { x: 200, y: 300 }, 0.5);
  assert.ok(o.x > 0 && Math.abs(o.y) < 1e-9);
  const end = scatterOffset({ x: 300, y: 300 }, { x: 200, y: 300 }, 1);
  assert.ok(Math.abs(end.x) < 1e-9);
});
