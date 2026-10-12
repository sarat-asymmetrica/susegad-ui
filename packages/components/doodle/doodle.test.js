import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTIFS, VIEW, MARGIN, BOIL_AMOUNT, BOIL_FRAMES, BOIL_ORDER, HIDDEN, DASH,
  motif, describe, parsePath, strokesIn, controlPoints, pathPoints, pathBounds, pathLength,
  boilPath, boilFrames, revealPlan, wiggleFrames, fitCells, layBand, cellTransform,
} from './doodle.core.js';
import { MOTIF_DATA } from './doodle.motifs.js';

// ── the motifs: a table of drawings ──────────────────────────────────────────

test('ten motifs, named for the kitchen', () => {
  assert.deepEqual(MOTIFS, ['fork-twirl', 'ravioli', 'gnocchi', 'lemon', 'tomato', 'basil', 'whisk', 'rolling-pin', 'wheat', 'steam']);
  assert.throws(() => motif('pizza'), /not a doodle motif/);
});

test('every motif is one or two strokes, and each stroke is a single path', () => {
  for (const name of MOTIFS) {
    const strokes = motif(name);
    assert.ok(strokes.length >= 1 && strokes.length <= 2, `${name}: ${strokes.length} strokes`);
    for (const d of strokes) assert.equal(strokesIn(d), 1, `${name}: a stroke is one pen-down line`);
  }
});

test('stroke only, never filled: the table holds path data and nothing that paints', () => {
  for (const [name, m] of Object.entries(MOTIF_DATA)) {
    assert.deepEqual(Object.keys(m).sort(), ['about', 'strokes'], `${name}: only words and strokes`);
    for (const d of m.strokes) {
      assert.match(d, /^[MLCQ0-9\s.,-]+$/, `${name}: path data is absolute M, L, C, Q and numbers`);
      assert.ok(!/fill|style|#|rgb/i.test(d), `${name}: no paint in the path`);
    }
  }
});

test('every motif stays inside its 100 by 100 box: the drawn line clear of the edge by the pen margin, control points inside the box', () => {
  for (const name of MOTIFS) for (const d of motif(name)) {
    for (const [x, y] of controlPoints(d)) assert.ok(x >= 0 && x <= VIEW && y >= 0 && y <= VIEW, `${name}: control point ${x},${y} outside the box`);
    const b = pathBounds(d);
    assert.ok(b.minX >= MARGIN && b.maxX <= VIEW - MARGIN && b.minY >= MARGIN && b.maxY <= VIEW - MARGIN, `${name}: the line reaches ${b.minX.toFixed(1)}..${b.maxX.toFixed(1)}, ${b.minY.toFixed(1)}..${b.maxY.toFixed(1)}`);
  }
});

test('the boil keeps every drawn line inside the box too', () => {
  for (const name of MOTIFS) for (const d of motif(name)) for (const frame of boilFrames(d)) {
    const b = pathBounds(frame);
    assert.ok(b.minX >= 0 && b.maxX <= VIEW && b.minY >= 0 && b.maxY <= VIEW, `${name}: the boil carries the line to ${b.minX.toFixed(1)}..${b.maxX.toFixed(1)}, ${b.minY.toFixed(1)}..${b.maxY.toFixed(1)}`);
  }
});

test('each motif fills its cell without crowding it: the drawn line spans at least 55 units one way', () => {
  for (const name of MOTIFS) {
    const all = motif(name).map(pathBounds);
    const w = Math.max(...all.map(b => b.maxX)) - Math.min(...all.map(b => b.minX));
    const h = Math.max(...all.map(b => b.maxY)) - Math.min(...all.map(b => b.minY));
    assert.ok(Math.max(w, h) >= 55, `${name}: ${w.toFixed(0)} by ${h.toFixed(0)}`);
  }
});

test('every motif says in words what it is', () => {
  for (const name of MOTIFS) assert.ok(describe(name).length > 8, name);
});

// ── reading path data ───────────────────────────────────────────────────────

test('parsePath reads M, L, C and Q, and refuses everything else', () => {
  const cmds = parsePath('M1 2L3 4C1 1 2 2 3 3Q4 4 5 5');
  assert.deepEqual(cmds.map(c => c.c), ['M', 'L', 'C', 'Q']);
  assert.throws(() => parsePath('M1 2l3 4'), /not allowed/);
  assert.throws(() => parsePath('M1 2Z'), /not allowed/);
  assert.throws(() => parsePath('M1 2L3'), /takes 2 numbers/);
  assert.throws(() => parsePath('L1 2'), /starts with M/);
  assert.throws(() => parsePath('M1 2 fill'), /not allowed/);
});

test('a path with a second M is counted as two strokes', () => {
  assert.equal(strokesIn('M1 1L2 2M5 5L6 6'), 2);
});

test('the path tools are right on a known curve: a straight cubic has the length of its chord', () => {
  const d = 'M0 0C10 0 20 0 30 0';
  assert.ok(Math.abs(pathLength(d) - 30) < 0.01);
  assert.deepEqual(pathBounds(d), { minX: 0, maxX: 30, minY: 0, maxY: 0 });
  assert.ok(pathPoints('M0 0Q50 100 100 0').some(([, y]) => Math.abs(y - 50) < 1), 'a quadratic peaks halfway to its control point');
});

// ── the boil ─────────────────────────────────────────────────────────────────

test('frame 0 of the boil is the drawing itself; the others move it a little and no more than the amount', () => {
  const d = motif('lemon')[0];
  assert.equal(boilPath(d, 0), d);
  const base = controlPoints(d);
  for (let k = 1; k < BOIL_FRAMES; k++) {
    const moved = controlPoints(boilPath(d, k));
    assert.equal(moved.length, base.length, 'same command structure');
    let most = 0;
    moved.forEach(([x, y], i) => { most = Math.max(most, Math.hypot(x - base[i][0], y - base[i][1])); });
    assert.ok(most > 0.1, `frame ${k} moves the line`);
    assert.ok(most <= BOIL_AMOUNT * Math.SQRT2 + 0.05, `frame ${k} moves it by ${most.toFixed(2)} at most`);
  }
});

test('the boil is smooth: neighbouring points move together, so the line wobbles instead of fizzing', () => {
  const d = motif('whisk')[1];
  const base = controlPoints(d), moved = controlPoints(boilPath(d, 2));
  for (let i = 1; i < base.length; i++) {
    const a = [moved[i][0] - base[i][0], moved[i][1] - base[i][1]], b = [moved[i - 1][0] - base[i - 1][0], moved[i - 1][1] - base[i - 1][1]];
    const near = Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1]) < 8;
    if (near) assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.9, `points ${i - 1} and ${i} move apart`);
  }
});

test('the boil plays out and back, so no frame jumps to a far one', () => {
  assert.equal(BOIL_ORDER[0], 0);
  for (let i = 0; i < BOIL_ORDER.length; i++) assert.ok(Math.abs(BOIL_ORDER[i] - BOIL_ORDER[(i + 1) % BOIL_ORDER.length]) <= 1, `step ${i}`);
});

test('the boil is deterministic', () => {
  const d = motif('tomato')[0];
  assert.equal(boilPath(d, 2), boilPath(d, 2));
});

// ── drawing itself ──────────────────────────────────────────────────────────

test('strokes draw one after another, each taking time in proportion to its length', () => {
  const strokes = motif('ravioli');
  const plan = revealPlan(strokes, 'warm');
  assert.equal(plan.length, strokes.length);
  assert.equal(plan[0].delay, 0);
  assert.ok(plan[1].delay > plan[0].delay && plan[1].delay < plan[0].delay + plan[0].duration, 'the second starts just before the first ends');
  const [a, b] = strokes.map(pathLength);
  assert.ok((plan[0].duration > plan[1].duration) === (a > b), 'the longer stroke takes longer');
});

test('playful draws faster than warm; a later cell in a band starts later, up to a cap', () => {
  const s = motif('wheat');
  const warm = revealPlan(s, 'warm'), playful = revealPlan(s, 'playful');
  assert.ok(playful[0].duration < warm[0].duration);
  assert.ok(revealPlan(s, 'warm', 5)[0].delay > revealPlan(s, 'warm', 1)[0].delay);
  assert.ok(revealPlan(s, 'warm', 500)[0].delay <= 1400, 'a long band does not wait for ever');
});

test('the dash pattern hides a line completely at the hidden offset and shows it whole at zero', () => {
  const [on, off] = DASH.split(' ').map(Number);
  assert.equal(on, 1, 'one whole length of ink');
  assert.ok(off > HIDDEN, 'the gap is longer than the hidden offset, so no dot is left at either end');
  assert.ok(HIDDEN > 1);
});

test('the wiggle starts and ends at rest', () => {
  const k = wiggleFrames(1);
  assert.equal(k[0].transform, 'rotate(0deg) scale(1)');
  assert.equal(k.at(-1).transform, 'rotate(0deg) scale(1)');
  assert.notEqual(wiggleFrames(1)[1].transform, wiggleFrames(2)[1].transform, 'alternate doodles lean opposite ways');
});

// ── a band ───────────────────────────────────────────────────────────────────

test('cells fit whole along a length, stretched a little', () => {
  assert.deepEqual(fitCells(1000, 64), { count: 16, size: 62.5 });
  assert.deepEqual(fitCells(30, 64), { count: 1, size: 30 });
  assert.deepEqual(fitCells(0, 64), { count: 0, size: 0 });
});

test('a seed lays the same band every time, and a longer band keeps the start of a shorter one', () => {
  assert.deepEqual(layBand('pasta', 12), layBand('pasta', 12));
  assert.deepEqual(layBand('pasta', 20).slice(0, 12), layBand('pasta', 12));
  assert.notDeepEqual(layBand('pasta', 12).map(c => c.motif), layBand('sauce', 12).map(c => c.motif));
});

test('no motif twice in a row, and none within the last two cells; every motif turns up in a long band', () => {
  for (const seed of ['a', 'b', 'c', 'pasta', 7]) {
    const cells = layBand(seed, 60);
    for (let i = 1; i < cells.length; i++) assert.notEqual(cells[i].motif, cells[i - 1].motif, `${seed}: ${i}`);
    for (let i = 2; i < cells.length; i++) assert.notEqual(cells[i].motif, cells[i - 2].motif, `${seed}: ${i} repeats within two`);
  }
  assert.equal(new Set(layBand('all', 80).map(c => c.motif)).size, MOTIFS.length);
});

test('a band never repeats a motif within three cells while the set has four or more', () => {
  for (const seed of ['saffron-spoon', 'a', 'b', 'c', 'pasta', 'market', 7]) {
    const cells = layBand(seed, 80);
    for (let i = 3; i < cells.length; i++) for (let d = 1; d <= 3; d++) assert.notEqual(cells[i].motif, cells[i - d].motif, `${seed}: cell ${i} repeats cell ${i - d}`);
  }
  const four = layBand('supper', 40, ['tomato', 'basil', 'ravioli', 'lemon']);
  for (let i = 3; i < four.length; i++) for (let d = 1; d <= 3; d++) assert.notEqual(four[i].motif, four[i - d].motif, `four: cell ${i}`);
  // a set of three can only keep two apart, and says nothing worse than a repeat after two
  const three = layBand('x', 30, ['lemon', 'basil', 'wheat']);
  for (let i = 2; i < three.length; i++) assert.notEqual(three[i].motif, three[i - 1].motif);
});

test('a band can draw from a chosen few, and survives a set of one or an empty one', () => {
  const few = layBand('x', 20, ['lemon', 'basil', 'wheat']);
  assert.ok(few.every(c => ['lemon', 'basil', 'wheat'].includes(c.motif)));
  assert.equal(layBand('x', 5, ['lemon']).length, 5);
  assert.ok(layBand('x', 5, ['pizza']).every(c => MOTIFS.includes(c.motif)), 'unknown names fall back to the whole set');
});

test('each cell is a little off true, within bounds', () => {
  for (const c of layBand('hand', 50)) {
    assert.ok(Math.abs(c.rotate) <= 7 && Math.abs(c.dx) <= 3 && Math.abs(c.dy) <= 3);
    assert.ok(c.scale >= 0.84 && c.scale <= 0.98);
    assert.equal(typeof c.flip, 'boolean');
  }
  assert.ok(layBand('hand', 50).some(c => c.flip) && layBand('hand', 50).some(c => !c.flip), 'some are drawn the other way round');
});

test('the cell transform centres a motif in its slot', () => {
  const t = cellTransform({ rotate: 0, dx: 0, dy: 0, scale: 1, flip: false }, 3);
  assert.match(t, /^translate\(350 50\)/);
  assert.match(cellTransform({ rotate: 0, dx: 0, dy: 0, scale: 0.9, flip: true }, 0), /scale\(-0\.9 0\.9\)/);
});

test('a placed motif stays inside its cell, whatever the seed and the motif, the pen included', () => {
  // the worst cell: turned 7 degrees, nudged 3 units each way, at full scale; checked on the real drawn lines
  const rad = d => d * Math.PI / 180;
  for (const name of MOTIFS) for (const rotate of [-7, 7]) for (const [dx, dy] of [[3, 3], [-3, -3], [3, -3], [-3, 3]]) for (const flip of [false, true]) {
    for (const d of motif(name)) for (const [x, y] of pathPoints(d)) {
      const fx = (flip ? -1 : 1) * 0.98 * (x - 50), fy = 0.98 * (y - 50);
      const px = 50 + dx + fx * Math.cos(rad(rotate)) - fy * Math.sin(rad(rotate)), py = 50 + dy + fx * Math.sin(rad(rotate)) + fy * Math.cos(rad(rotate));
      assert.ok(px >= -1 && px <= 101 && py >= -1 && py <= 101, `${name} at ${rotate} deg, nudge ${dx},${dy}: ${px.toFixed(1)},${py.toFixed(1)}`);
    }
  }
});
