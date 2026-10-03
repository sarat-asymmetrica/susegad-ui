import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTIFS, TONES, TURN_MS, motif, pigmentOf, fitTiles, layBand, turnOf, turned, crackle, tileAt, turnAngle, lift } from './tile-band.core.js';

const numbers = d => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);

// ── the motifs: a small family, geometric and floral only ────────────────

test('four motifs: a rosette, a quatrefoil, quarter-circle corners and a vine, and nothing else', () => {
  assert.deepEqual(MOTIFS, ['rosette', 'quatrefoil', 'corner', 'vine']);
  assert.deepEqual(TONES, ['azulejo', 'majolica']);
  assert.throws(() => motif('saint'), /not a motif/);
  assert.throws(() => motif('cross'), /not a motif/);
});

test('every motif has layers, each a path with a pigment role', () => {
  const roles = new Set(['ink', 'blue', 'wash', 'lemon', 'leaf', 'ground']);
  for (const name of MOTIFS) {
    const layers = motif(name);
    assert.ok(layers.length >= 6, `${name} has body`);
    for (const l of layers) {
      assert.match(l.d, /^M/, `${name}: a path starts with a move`);
      assert.ok(roles.has(l.role), `${name}: role ${l.role}`);
      assert.ok(l.mode === 'fill' || (l.mode === 'stroke' && l.w > 0), `${name}: a stroke has a width`);
    }
  }
});

test('every path stays inside its tile (a little past the edge is allowed for strokes)', () => {
  for (const name of MOTIFS) for (const l of motif(name)) {
    const n = numbers(l.d.replace(/A\s*[\d.]+[ ,][\d.]+ 0 [01] [01]/g, 'A'));
    assert.ok(n.every(v => v >= -1 && v <= 101), `${name}: ${l.d.slice(0, 40)}`);
  }
});

test('the vine runs edge to edge at mid-height, so neighbouring vines join', () => {
  const stem = motif('vine').find(l => l.mode === 'stroke' && l.w > 3);
  assert.match(stem.d, /^M0 50/);
  assert.match(stem.d, /100 50$/);
});

test('the corner motif is built from quarter circles in the corners', () => {
  const layers = motif('corner');
  assert.ok(layers.filter(l => /^M0 0H/.test(l.d)).length >= 4, 'a fan of rings in the top-left corner');
  assert.ok(layers.some(l => /^M100 100H/.test(l.d)), 'and a smaller one opposite');
});

test('lemon and leaf are majolica pigments; a blue-and-white tile paints them as wash and cobalt', () => {
  assert.equal(pigmentOf('lemon', 'azulejo'), 'wash');
  assert.equal(pigmentOf('leaf', 'azulejo'), 'blue');
  assert.equal(pigmentOf('lemon', 'majolica'), 'lemon');
  assert.equal(pigmentOf('leaf', 'majolica'), 'leaf');
  for (const role of ['ink', 'blue', 'wash', 'ground']) for (const t of TONES) assert.equal(pigmentOf(role, t), role);
});

// ── fitting ──────────────────────────────────────────────────────────────

test('whole tiles, square: the room is shared out so none is cut', () => {
  const { count, size } = fitTiles(1000, 64);
  assert.equal(count, 16);
  assert.equal(size, 62.5);
  assert.equal(fitTiles(390, 64).count, 6);
  assert.ok(Math.abs(fitTiles(390, 64).size - 65) < 1e-9);
});

test('a band shorter than a tile is one tile, and a band with no room has none', () => {
  assert.deepEqual(fitTiles(30, 64), { count: 1, size: 30 });
  assert.deepEqual(fitTiles(0, 64), { count: 0, size: 0 });
  assert.deepEqual(fitTiles(500, 0), { count: 0, size: 0 });
  assert.deepEqual(fitTiles(NaN, 64), { count: 0, size: 0 });
});

test('the fitted size never strays far from the wanted size', () => {
  for (const len of [200, 333, 390, 777, 1280, 1920]) {
    const { size } = fitTiles(len, 64);
    assert.ok(Math.abs(size - 64) / 64 < 0.5 / (len / 64) + 1e-9, `${len}: ${size}`);
  }
});

// ── laying ───────────────────────────────────────────────────────────────

test('a seed lays the same band every time, and another seed another band', () => {
  assert.deepEqual(layBand('goa', 20), layBand('goa', 20));
  assert.notDeepEqual(layBand('goa', 20), layBand('mapusa', 20));
});

test('a longer band keeps the start of a shorter one: resizing the window does not repaint the tiles you could see', () => {
  const short = layBand('goa', 8), long = layBand('goa', 30);
  assert.deepEqual(long.slice(0, 8), short);
});

test('two motifs alternate, with an accent tile of a third every six to nine', () => {
  const tiles = layBand('goa', 60);
  const counts = Object.fromEntries(MOTIFS.map(m => [m, tiles.filter(t => t.motif === m).length]));
  const main = Object.values(counts).filter(n => n >= 20);
  assert.equal(main.length, 2, JSON.stringify(counts));
  const accents = tiles.filter(t => counts[t.motif] < 20);
  assert.ok(accents.length >= 5 && accents.length <= 12, `${accents.length} accents`);
  for (let k = 1; k < accents.length; k++) assert.ok(accents[k].i - accents[k - 1].i >= 6 && accents[k].i - accents[k - 1].i <= 9);
});

test('no two neighbours are the same motif at the same turn', () => {
  for (const seed of ['goa', 'mapusa', 'panjim', 1, 2, 3, 'x', 'y']) {
    const tiles = layBand(seed, 80);
    for (let i = 1; i < tiles.length; i++) {
      assert.ok(!(tiles[i].motif === tiles[i - 1].motif && tiles[i].turn === tiles[i - 1].turn), `${seed}: ${i}`);
    }
  }
});

test('a vine only ever turns a half, so its stem keeps joining the next tile', () => {
  for (const seed of ['goa', 'a', 'b', 'c']) for (const t of layBand(seed, 60)) if (t.motif === 'vine') assert.ok(t.turn === 0 || t.turn === 2, `${seed} ${t.i}`);
  assert.equal(turned({ motif: 'vine', turn: 0 }).turn, 2);
  assert.equal(turned({ motif: 'vine', turn: 2 }).turn, 0);
  assert.equal(turned({ motif: 'rosette', turn: 3 }).turn, 0);
  assert.equal(turned({ motif: 'corner', turn: 0 }).turn, 1);
});

test('turning a tile does not change the tile it came from', () => {
  const t = layBand('goa', 3)[0], before = JSON.stringify(t);
  turned(t);
  assert.equal(JSON.stringify(t), before);
});

test('a band that runs down the page turns every motif a quarter, so vines run down too', () => {
  assert.equal(turnOf({ turn: 0 }, false), 0);
  assert.equal(turnOf({ turn: 0 }, true), 1);
  assert.equal(turnOf({ turn: 3 }, true), 0);
});

test('hand-painted: each tile is a little off, within a hair', () => {
  const tiles = layBand('goa', 40);
  assert.ok(tiles.every(t => Math.abs(t.dx) <= 1.2 && Math.abs(t.dy) <= 1.2 && Math.abs(t.rot) <= 1.1 && t.scale >= 0.985 && t.scale <= 1.015));
  assert.ok(tiles.every(t => t.weight >= 0.88 && t.weight <= 1.14 && t.pool >= 0 && t.pool <= 1));
  assert.ok(new Set(tiles.map(t => t.dx)).size > 20, 'no two alike');
  assert.equal(new Set(tiles.map(t => t.crackle)).size, 40, 'each has its own crackle');
});

// ── crackle ──────────────────────────────────────────────────────────────

test('crackle: a few fine cracks from the edges, the same every time', () => {
  const a = crackle('goa:3'), b = crackle('goa:3');
  assert.deepEqual(a, b);
  assert.ok(a.length >= 3 && a.length <= 10, `${a.length} cracks`);
  for (const line of a) {
    assert.ok(line.length >= 2);
    for (const [x, y] of line) assert.ok(x >= -12 && x <= 112 && y >= -12 && y <= 112);
  }
  assert.notDeepEqual(a, crackle('goa:4'));
  assert.equal(crackle('goa:3', { cracks: 5 }).length >= 5, true);
});

// ── pointing ─────────────────────────────────────────────────────────────

test('tileAt: along a horizontal band', () => {
  assert.equal(tileAt(10, 10, 64, 6), 0);
  assert.equal(tileAt(64, 10, 64, 6), 1, 'the edge belongs to the next tile');
  assert.equal(tileAt(383, 63, 64, 6), 5);
  assert.equal(tileAt(384, 10, 64, 6), -1, 'past the last tile');
  assert.equal(tileAt(-1, 10, 64, 6), -1);
  assert.equal(tileAt(10, 64, 64, 6), -1, 'below the band');
});

test('tileAt: down a vertical band', () => {
  assert.equal(tileAt(10, 70, 64, 6, true), 1);
  assert.equal(tileAt(64, 70, 64, 6, true), -1, 'right of the band');
  assert.equal(tileAt(10, 400, 64, 6, true), -1);
});

test('tileAt: no size, no tile', () => {
  assert.equal(tileAt(5, 5, 0, 6), -1);
  assert.equal(tileAt(5, 5, NaN, 6), -1);
});

// ── the turn ─────────────────────────────────────────────────────────────

test('a turn starts at 0 and lands on exactly 90', () => {
  assert.equal(turnAngle(0), 0);
  assert.equal(turnAngle(-1), 0);
  assert.equal(turnAngle(1), 90);
  assert.equal(turnAngle(2), 90);
  assert.equal(turnAngle(NaN), 0);
});

test('a turn swings a little past the quarter and settles back: wet mortar', () => {
  const samples = Array.from({ length: 201 }, (_, i) => turnAngle(i / 200));
  const peak = Math.max(...samples);
  assert.ok(peak > 90 && peak < 90 * 1.2, `peak ${peak.toFixed(1)}`);
  const at = samples.indexOf(peak) / 200;
  assert.ok(at > 0.55 && at < 0.85, `peaks at ${at}`);
  const settle = samples.slice(Math.round(at * 200));
  for (let i = 1; i < settle.length; i++) assert.ok(settle[i] <= settle[i - 1] + 1e-9, 'after the peak it only comes back');
  for (let i = 1; i <= Math.round(at * 200); i++) assert.ok(samples[i] >= samples[i - 1] - 1e-9, 'before the peak it only goes forward');
});

test('lift: up in the middle of the turn, and down at both ends', () => {
  assert.equal(lift(0), 0);
  assert.equal(lift(1), 0);
  assert.ok(Math.abs(lift(0.5) - 1) < 1e-9);
  assert.ok(lift(0.25) > 0 && lift(0.25) < 1);
  assert.equal(TURN_MS > 300 && TURN_MS < 800, true);
});
