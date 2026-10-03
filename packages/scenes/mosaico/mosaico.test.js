import test from 'node:test';
import assert from 'node:assert/strict';
import mosaico from './index.js';
import {
  layFloor, makeAnt, exitOf, walk, antPlace, turnQuarter, floorAt, createFloor, advance, rippleTurns,
  layTime, LAY_END, STILL_TIME, LOOKS, ORDER, STEP, COLS, ROWS, T, W, H, model,
} from './model.js';
import { meta } from './meta.js';

/** The four band ends on each edge of a tile turned k: which edges its bands join. */
const joins = k => [0, 1, 2, 3].map(e => exitOf(k & 1, e));
/** A point on the ant's band centre-line: distance from the band's corner is half a tile. */
function onRibbon(floor, ant) {
  const [x, y] = antPlace(floor, ant);
  const x0 = ant.i * T, y0 = ant.j * T;
  const corners = [[x0, y0], [x0 + T, y0], [x0 + T, y0 + T], [x0, y0 + T]];
  return corners.some(([cx, cy]) => Math.abs(Math.hypot(x - cx, y - cy) - T / 2) < 1e-6);
}

test('the floor is 10 by 7 tiles of 120, filling the scene', () => {
  const f = layFloor(1);
  assert.equal(f.tiles.length, COLS * ROWS);
  assert.equal(COLS * T, W); assert.equal(ROWS * T, H);
  assert.equal(f.at(-1, 0), null); assert.equal(f.at(COLS, 0), null);
  assert.equal(f.at(3, 2).i, 3); assert.equal(f.at(3, 2).j, 2);
});

test('a band always leaves by a neighbouring edge, and the join is its own inverse', () => {
  for (const o of [0, 1]) for (let e = 0; e < 4; e++) {
    const x = exitOf(o, e);
    assert.notEqual(x, e); assert.notEqual(x, (e + 2) % 4, 'never straight across');
    assert.equal(exitOf(o, x), e);
  }
});

test('every tile edge meets its neighbour’s bands: each band end has a band end on the other side', () => {
  for (const seed of [1, 2, 3, 9, 42]) {
    const f = layFloor(seed);
    for (const t of f.tiles) for (let e = 0; e < 4; e++) {
      const n = f.at(t.i + STEP[e][0], t.j + STEP[e][1]);
      if (!n) continue;
      // every edge has a band ending at its midpoint, whichever way either tile is turned
      const back = (e + 2) % 4;
      assert.ok(joins(t.k).includes(e) && joins(n.k).includes(back), `seed ${seed} ${t.i},${t.j} edge ${e}`);
      // and following the band across the edge lands on a band that leads on
      assert.ok(exitOf(n.k & 1, back) !== back);
    }
  }
});

test('the same seed lays the same floor and puts the ant in the same place; another seed differs', () => {
  assert.deepEqual(layFloor(4).tiles, layFloor(4).tiles);
  assert.deepEqual(makeAnt(4), makeAnt(4));
  assert.notDeepEqual(layFloor(4).tiles.map(t => t.k), layFloor(5).tiles.map(t => t.k));
});

test('walking, the ant always stays on a ribbon, tile to tile, and never leaves the floor', () => {
  for (const seed of [1, 2, 7]) {
    const f = layFloor(seed), a = makeAnt(seed);
    const seen = new Set();
    for (let s = 0; s < 4000; s++) {
      walk(f, a, 3.3);
      assert.ok(f.at(a.i, a.j), 'on the floor');
      assert.ok(a.u >= 0 && a.u < 1);
      assert.ok(onRibbon(f, a), `seed ${seed} step ${s}`);
      seen.add(`${a.i},${a.j}`);
      if (s % 97 === 0) turnQuarter(f.tiles[(s * 7) % f.tiles.length], a, 1 + (s % 3));
      assert.ok(onRibbon(f, a), 'still on a ribbon after a turn');
    }
    assert.ok(seen.size > 5, `it travels: ${seen.size} tiles`);
  }
});

test('turning the ant’s own tile carries the ant round with it', () => {
  const f = layFloor(1), a = makeAnt(1), t = f.at(a.i, a.j);
  const [x0, y0] = antPlace(f, a);
  turnQuarter(t, a, 1);
  const [x1, y1] = antPlace(f, a);
  // a quarter turn clockwise about the tile's centre
  const cx = a.i * T + T / 2, cy = a.j * T + T / 2;
  assert.ok(Math.abs((x1 - cx) - -(y0 - cy)) < 1e-6 && Math.abs((y1 - cy) - (x0 - cx)) < 1e-6);
});

test('a blocked tile holds the ant at its edge; a wall turns it round', () => {
  const f = layFloor(2), a = makeAnt(2);
  const b = { ...a };
  walk(f, b, 200, () => 'wait');
  assert.equal(b.i, a.i); assert.equal(b.j, a.j); assert.equal(b.u, 1);
  const c = { ...a };
  walk(f, c, 400, () => 'wall');
  assert.equal(c.i, a.i); assert.equal(c.j, a.j);
  assert.ok(onRibbon(f, c));
});

test('the floor in time is deterministic, and memoised stepping matches a fresh run', () => {
  const a = createFloor(3, 'warm'); advance(a, 30);
  const b = createFloor(3, 'warm'); for (let t = 0; t <= 30; t += 0.37) advance(b, t); advance(b, 30);
  assert.deepEqual(a.floor.tiles, b.floor.tiles); assert.deepEqual(a.ant, b.ant);
  const c = floorAt(3, 'warm', 30), d = floorAt(3, 'warm', 30, [], new Set(), 99);
  assert.deepEqual(c.floor.tiles.map(t => t.k), d.floor.tiles.map(t => t.k));
  assert.deepEqual(c.ant, d.ant);
});

test('warm turns tiles now and then and the ant walks; quiet never does', () => {
  const w = createFloor(1, 'warm'), q = createFloor(1, 'quiet'), k0 = w.floor.tiles.map(t => t.k).join('');
  let turns = 0, prev = 0;
  for (let t = 0; t <= 60; t += 0.5) { advance(w, t); advance(q, t); if (w.turns.length > prev) turns++; prev = w.turns.length; }
  assert.ok(turns >= 5 && turns <= 20, `${turns} turns in a minute`);
  assert.notEqual(w.floor.tiles.map(t => t.k).join(''), k0);
  assert.notDeepEqual(w.ant, makeAnt(1));
  assert.deepEqual(q.ant, makeAnt(1)); assert.equal(q.floor.tiles.map(t => t.k).join(''), k0);
});

test('the still is the finished floor: laid, nothing turning, the ant at rest where the seed put it', () => {
  assert.ok(STILL_TIME > LAY_END);
  for (const r of ['quiet', 'warm', 'playful']) {
    const s = floorAt(2, r, STILL_TIME);
    assert.equal(s.turns.length, 0); assert.deepEqual(s.ant, makeAnt(2));
  }
  assert.equal(ORDER.length, COLS * ROWS);
  assert.ok(layTime(0, 0) < layTime(9, 6), 'laid from the top left');
});

test('no tile under the words turns, and the ant never walks onto them', () => {
  const calm = new Set();
  for (let j = 0; j < ROWS; j++) for (let i = 5; i < COLS; i++) calm.add(j * COLS + i);
  const s = createFloor(1, 'playful'), k0 = s.floor.tiles.map(t => t.k);
  // a hand asks to turn a calm tile; it is refused
  const inputs = [{ t: LAY_END + 2, i: 8, j: 1, n: 1 }, { t: LAY_END + 3, i: 1, j: 1, n: 1 }];
  const ant0 = makeAnt(1); assert.ok(!calm.has(ant0.j * COLS + ant0.i), 'the ant starts outside the words');
  for (let t = 0; t <= 90; t += 0.25) {
    advance(s, t, inputs, calm);
    assert.ok(!calm.has(s.ant.j * COLS + s.ant.i), `ant on a word tile at ${t}`);
  }
  for (const t of s.floor.tiles) if (calm.has(t.j * COLS + t.i)) assert.equal(t.k, k0[t.j * COLS + t.i]);
  assert.notEqual(s.floor.at(1, 1).k, k0[1 * COLS + 1], 'the tile outside the words did turn');
});

test('a click ripples: tiles near it turn by one to three quarters, later the further they are', () => {
  const r = rippleTurns(1, 20, 600, 420);
  assert.ok(r.length >= 5 && r.length <= 12);
  for (const q of r) { assert.ok(q.n >= 1 && q.n <= 3); assert.ok(q.delay >= 0 && q.delay < 0.16); }
  assert.deepEqual(r, rippleTurns(1, 20, 600, 420));
});

test('the element definition and meta', () => {
  assert.equal(mosaico.name, 'mosaico');
  assert.deepEqual(mosaico.interactive, ['playful']);
  assert.equal(meta.W, W); assert.equal(meta.H, H); assert.equal(meta.stillTime, STILL_TIME);
  assert.deepEqual(Object.keys(LOOKS), ['quiet', 'warm', 'playful']);
  assert.equal(model({ register: 'playful' }).look, LOOKS.playful);
  assert.ok(meta.map.every(([phrase]) => meta.prompt.includes(phrase)), 'every mapped phrase is in the prompt');
});
