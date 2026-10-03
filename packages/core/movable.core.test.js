import { test } from 'node:test';
import assert from 'node:assert/strict';
import { room, canMove, avoid, clampTo, placeOf, offsetOf, nudge, nameOf, movedSaid, homeSaid, limitSaid, parseWordsAt, formatWordsAt, MARGIN, STEP } from './movable.core.js';

const stage = { left: 100, top: 50, right: 1100, bottom: 750 }; // 1000 x 700
const home = { left: 140, top: 520, width: 400, height: 190 }; // bottom left, as the reading layer puts it
const r = room(stage, home);

test('room keeps the panel MARGIN inside the stage on every side', () => {
  assert.equal(home.left + r.minX, stage.left + MARGIN);
  assert.equal(home.left + home.width + r.maxX, stage.right - MARGIN);
  assert.equal(home.top + r.minY, stage.top + MARGIN);
  assert.equal(home.top + home.height + r.maxY, stage.bottom - MARGIN);
});

test('a panel wider than the stage has no room and sits centred', () => {
  const wide = room(stage, { left: 100, top: 100, width: 1200, height: 100 });
  assert.equal(wide.minX, wide.maxX);
  assert.ok(wide.maxY > wide.minY);
  assert.equal(canMove(wide), true); // still room to move up and down
  assert.equal(canMove(room(stage, { left: 100, top: 50, width: 1200, height: 800 })), false);
});

test('canMove asks for 48 px of room in at least one direction', () => {
  assert.equal(canMove({ minX: 0, maxX: 47, minY: 0, maxY: 47 }), false);
  assert.equal(canMove({ minX: 0, maxX: 47, minY: 0, maxY: 48 }), true);
});

test('places and offsets round-trip, and a place is the same share of the room at another width', () => {
  for (const [x, y] of [[0, 0], [1, 1], [0.25, 0.8], [0.5, 0.5]]) {
    const o = offsetOf(r, x, y), p = placeOf(r, o.dx, o.dy);
    assert.ok(Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9, `${x} ${y}`);
  }
  // half a stage narrower: the same place is still the middle of what is there
  const narrow = room({ ...stage, right: 700 }, { ...home, width: 300 });
  const a = offsetOf(narrow, 0.5, 0.5), p = placeOf(narrow, a.dx, a.dy);
  assert.ok(Math.abs(p.x - 0.5) < 1e-9);
  assert.equal(placeOf({ minX: 5, maxX: 5, minY: 0, maxY: 100 }, 5, 50).x, 0); // no room across: 0, never NaN
});

test('an offset is held inside the room, and so is a place outside 0..1', () => {
  const far = clampTo(r, -9999, 9999);
  assert.equal(far.dx, r.minX); assert.equal(far.dy, r.maxY);
  const o = offsetOf(r, 7, -3);
  assert.equal(o.dx, r.maxX); assert.equal(o.dy, r.minY);
});

test('an arrow key moves 3% of the stage, Shift 9%, and stops at the edge', () => {
  const w = stage.right - stage.left;
  let s = nudge(r, 0, 0, 'ArrowRight', false, w);
  assert.equal(s.dx, w * STEP); assert.equal(s.moved, true);
  s = nudge(r, 0, 0, 'ArrowRight', true, w);
  assert.equal(s.dx, w * 0.09);
  const edge = nudge(r, r.maxX, 0, 'ArrowRight', false, w);
  assert.equal(edge.moved, false); assert.equal(edge.dx, r.maxX);
  assert.equal(nudge(r, 0, 0, 'a', false, w).moved, false);
});

test('parity: keys reach every place a drag can, to within one step, and the corners exactly', () => {
  const w = stage.right - stage.left, step = w * STEP;
  const reach = (tx, ty) => {
    let dx = 0, dy = 0;
    for (let i = 0; i < 200; i++) {
      const key = Math.abs(tx - dx) >= step ? (tx > dx ? 'ArrowRight' : 'ArrowLeft') : Math.abs(ty - dy) >= step ? (ty > dy ? 'ArrowDown' : 'ArrowUp') : null;
      if (!key) break;
      ({ dx, dy } = nudge(r, dx, dy, key, false, w));
    }
    return { dx, dy };
  };
  for (const x of [0, 0.13, 0.5, 0.77, 1]) for (const y of [0, 0.31, 0.5, 0.9, 1]) {
    const t = offsetOf(r, x, y), got = reach(t.dx, t.dy);
    assert.ok(Math.abs(got.dx - t.dx) < step && Math.abs(got.dy - t.dy) < step, `${x} ${y}: off by ${got.dx - t.dx}, ${got.dy - t.dy}`);
  }
  // the corners: keep pressing and clamping lands on them exactly
  let s = { dx: 0, dy: 0 };
  for (let i = 0; i < 60; i++) { s = nudge(r, s.dx, s.dy, 'ArrowRight', false, w); s = nudge(r, s.dx, s.dy, 'ArrowUp', false, w); }
  assert.deepEqual([s.dx, s.dy], [r.maxX, r.minY]);
});

test('the nine places have plain names, and a drag and a key that land in the same third say the same words', () => {
  const at = (x, y) => nameOf(x, y, r);
  assert.equal(at(0, 0), 'the top left'); assert.equal(at(0.5, 0), 'the top'); assert.equal(at(1, 0), 'the top right');
  assert.equal(at(0, 0.5), 'the left'); assert.equal(at(0.5, 0.5), 'the middle'); assert.equal(at(1, 0.5), 'the right');
  assert.equal(at(0, 1), 'the bottom left'); assert.equal(at(0.5, 1), 'the bottom'); assert.equal(at(1, 1), 'the bottom right');
  assert.equal(movedSaid(1, 0, r), 'Words moved to the top right');
  assert.equal(homeSaid(), 'Words are back where they started');
  assert.equal(limitSaid('ArrowLeft'), 'The words are as far left as they go');
  // no room up or down: the rows are left out
  const flat = { minX: 0, maxX: 300, minY: 10, maxY: 10 };
  assert.equal(nameOf(1, 0.9, flat), 'the right'); assert.equal(nameOf(0.5, 0, flat), 'the middle');
  assert.ok(!/\d/.test(movedSaid(0.4, 0.6, r)), 'never coordinates');
});

test('words-at reads two numbers with a space or a comma, clamps them, and refuses the rest', () => {
  assert.deepEqual(parseWordsAt('0.25 0.8'), { x: 0.25, y: 0.8 });
  assert.deepEqual(parseWordsAt('0.25,0.8'), { x: 0.25, y: 0.8 });
  assert.deepEqual(parseWordsAt(' .5 , 1.7 '), { x: 0.5, y: 1 });
  assert.deepEqual(parseWordsAt('-2 0'), { x: 0, y: 0 });
  for (const bad of ['', null, undefined, '0.5', 'a b', '0.5 0.5 0.5', 'NaN 1']) assert.equal(parseWordsAt(bad), null, String(bad));
  assert.equal(formatWordsAt(0.25, 0.8), '0.25 0.8');
  assert.equal(formatWordsAt(1 / 3, 0), '0.333 0');
  assert.deepEqual(parseWordsAt(formatWordsAt(0.123456, 0.5)), { x: 0.123, y: 0.5 });
});

test('a panel that would meet the pause button steps down below it, or aside when that is nearer, and stays inside the room', () => {
  const pause = { left: stage.right - 10 - 32, top: stage.top + 10, right: stage.right - 10, bottom: stage.top + 42 };
  const h = { left: 140, top: 520, width: 400, height: 190 };
  const rr = room(stage, h);
  // flush to the top right corner: it would sit on the button
  const corner = { dx: rr.maxX, dy: rr.minY }, out = avoid(rr, h, corner.dx, corner.dy, pause);
  assert.ok(out.dy > corner.dy || out.dx < corner.dx, 'it moved');
  const box = { left: h.left + out.dx, top: h.top + out.dy, right: h.left + out.dx + h.width, bottom: h.top + out.dy + h.height };
  assert.ok(box.right <= pause.left - 8 || box.left >= pause.right + 8 || box.bottom <= pause.top - 8 || box.top >= pause.bottom + 8, 'and is clear of it by the gap');
  assert.ok(out.dx >= rr.minX && out.dx <= rr.maxX && out.dy >= rr.minY && out.dy <= rr.maxY, 'inside the room');
  // nowhere near: untouched
  assert.deepEqual(avoid(rr, h, 0, 0, pause), { dx: 0, dy: 0 });
  // a panel that can neither go down nor aside stays put rather than leaving the room
  const tight = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  assert.deepEqual(avoid(tight, { left: 900, top: 60, width: 100, height: 100 }, 0, 0, { left: 920, top: 60, right: 960, bottom: 100 }), { dx: 0, dy: 0 });
});
