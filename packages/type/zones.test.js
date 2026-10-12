// Shapes as data (ellipse, polygon, shapeOf, boundsOf) and text zones (layZones),
// in Node through the fake oracle. The truth here is written from the geometry
// itself (the ellipse's equation, a ray cast through the polygon), never from
// the code under test, and every claim is geometric: a line box, grown by the
// zone's pad, stands inside the true shape. Mutants (copies of the source with
// one fault put back) must fail the same assertions, or the assertion is not
// biting.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLayout, rect, arch, slant, ellipse, polygon, shapeOf, boundsOf } from './layout.core.js';
import { createFakeOracle } from './oracle.fake.js';
import { layZones } from './layout.zones.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const between = (r, a, b) => a + r() * (b - a);

// ── the truth ──────────────────────────────────────────────────────────────

const TOL = 1e-6;
const inEllipse = (d, x, y) => ((x - d.cx) / d.rx) ** 2 + ((y - d.cy) / d.ry) ** 2 <= 1 + TOL;
function distToSegment(px, py, [x0, y0], [x1, y1]) {
  const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}
function inPolygon(pts, x, y) {
  let inside = false;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    if (distToSegment(x, y, a, b) < TOL) return true; // on the edge counts
    if ((a[1] > y) !== (b[1] > y) && x < a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0])) inside = !inside;
  }
  return inside;
}
const inside = (d, x, y) => d.kind === 'ellipse' ? inEllipse(d, x, y) : d.kind === 'polygon' ? inPolygon(d.points, x, y) : (() => { throw new Error(`no truth for ${d.kind}`); })();

/** Sample points over a box: a grid across it, dense along its edges. */
function samples(x0, y0, x1, y1, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) out.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * j) / n]);
  for (let i = 0; i <= 200; i++) { const t = i / 200; out.push([x0 + (x1 - x0) * t, y0], [x0 + (x1 - x0) * t, y1], [x0, y0 + (y1 - y0) * t], [x1, y0 + (y1 - y0) * t]); }
  return out;
}

/** A star: spikes out, valleys in, centre (cx, cy). Not convex, so its bands can meet a vertex and a notch. */
const star = (cx, cy, outer, inner, n) => Array.from({ length: 2 * n }, (_, i) => {
  const a = (Math.PI * i) / n - Math.PI / 2, r = i % 2 ? inner : outer;
  return [cx + r * Math.cos(a) * 1.3, cy + r * Math.sin(a)];
});
/** A "C": a block with a bite out of its right side, so a row can be cut in two. */
const cShape = [[0, 0], [100, 0], [100, 30], [40, 30], [40, 70], [100, 70], [100, 100], [0, 100]];

// ── shapes: the room lies inside the true shape, and is as wide as it can be ──

function checkRoom(d, shape, label, bands = 60, seed = 5) {
  const r = rng(seed), b = boundsOf(d), pad = d.pad ?? 0;
  let roomy = 0;
  for (let k = 0; k < bands; k++) {
    const top = between(r, b.y, b.y + b.h), bottom = top + between(r, 2, b.h / 3), why = `${label}, band ${top.toFixed(2)} to ${bottom.toFixed(2)}`;
    const room = shape(top, bottom);
    if (!room) continue;
    roomy++;
    const [x0, y0, x1, y1] = [room.x - pad, top - pad, room.x + room.w + pad, bottom + pad];
    for (const [x, y] of samples(x0, y0, x1, y1)) assert.ok(inside(d, x, y), `${why}: (${x.toFixed(3)}, ${y.toFixed(3)}) of the grown box is outside the shape`);
    // as wide as it can be: a hair more on either side lets a point of the grown box out. The row that holds the
    // box in may sit at a vertex, so the rows tried include each vertex's own.
    const vs = d.kind === 'polygon' ? d.points.map(p => p[1]).filter(y => y > y0 && y < y1) : [];
    const rows = [...Array.from({ length: 1500 }, (_, i) => y0 + ((y1 - y0) * i) / 1499), ...vs.flatMap(y => [y - 1e-5, y, y + 1e-5])];
    for (const [side, x] of [['left', x0 - 0.02], ['right', x1 + 0.02]]) {
      assert.ok(rows.some(y => !inside(d, x, y)), `${why}: widening the ${side} by 0.02 still stays inside, so the room is not maximal`);
    }
  }
  assert.ok(roomy > bands / 4, `${label}: only ${roomy} of ${bands} bands had room, the test sampled too little`);
}

test('ellipse: the room of a band lies inside the true ellipse and is maximal (random ellipses, pads 0 to 6)', () => {
  const r = rng(21);
  for (let k = 0; k < 12; k++) {
    const d = { kind: 'ellipse', cx: between(r, -50, 200), cy: between(r, -50, 200), rx: between(r, 40, 220), ry: between(r, 30, 160), pad: Math.floor(between(r, 0, 7)) };
    checkRoom(d, ellipse(d.cx, d.cy, d.rx, d.ry, d.pad), `ellipse ${k} ${JSON.stringify(d)}`, 40, k + 1);
  }
});

test('ellipse: the widest band is the one through the middle, and a band past the poles has no room', () => {
  const e = ellipse(100, 100, 80, 40);
  const mid = e(95, 105), top = e(62, 70);
  assert.ok(Math.abs(mid.w - 2 * 80 * Math.sqrt(1 - (5 / 40) ** 2)) < 1e-9, 'the band 5 either side of the middle is as wide as its edge row');
  assert.ok(top.w < mid.w);
  assert.equal(e(50, 80), null, 'a band that starts above the top of the ellipse');
  assert.equal(e(120, 150), null, 'a band that ends below the bottom');
  assert.equal(ellipse(0, 0, 10, 10, 7)(-1, 1), null, 'a pad that eats the whole width leaves nothing');
});

test('polygon: the room lies inside the true polygon and is maximal (a star with vertices mid-band, a "C", a convex ring)', () => {
  const ring = Array.from({ length: 14 }, (_, i) => [100 + 90 * Math.cos((2 * Math.PI * i) / 14), 60 + 50 * Math.sin((2 * Math.PI * i) / 14)]);
  for (const [label, points] of [['star', star(100, 100, 90, 45, 7)], ['C', cShape], ['ring', ring]]) {
    for (const pad of [0, 3]) {
      const d = { kind: 'polygon', points, pad };
      checkRoom(d, polygon(points, pad), `${label}, pad ${pad}`, 90, 3 + pad);
    }
  }
});

test('polygon: a non-convex row is cut in two, and the band keeps the stretch with the centroid, else the widest', () => {
  const c = polygon(cShape);
  assert.deepEqual(c(35, 65), { x: 0, w: 40 }, 'a band through the bite of the C has the spine only');
  assert.deepEqual(c(5, 25), { x: 0, w: 100 }, 'the upper arm is whole');
  // the same C with its spine too thin to hold the centroid: the centroid (x about 54) is in the bite, so the widest stretch wins
  const wide = polygon([[0, 0], [100, 0], [100, 30], [10, 30], [10, 70], [100, 70], [100, 100], [0, 100]]);
  assert.deepEqual(wide(35, 65), { x: 0, w: 10 });
  assert.deepEqual(c(20, 80), { x: 0, w: 40 }, 'a band that spans the bite and both arms keeps the spine, the one stretch common to every row');
  assert.equal(polygon([[0, 0], [10, 0], [110, 100], [100, 100]])(0, 100), null, 'a leaning sliver whose top and bottom rows do not overlap has no room');
});

test('polygon: a vertex inside a band narrows it (the rows between the edges count)', () => {
  const diamond = [[50, 0], [100, 50], [50, 100], [0, 50]];
  const room = polygon(diamond)(10, 90);
  assert.ok(Math.abs(room.w - 2 * 10) < 1e-3, `the band from 10 to 90 of a diamond is 20 wide at its edges (${room.w})`);
  const wideMiddle = polygon(diamond)(40, 60);
  assert.ok(Math.abs(wideMiddle.w - 2 * 40) < 1e-3, `the band through the middle is 80 wide at its edges (${wideMiddle.w})`);
});

test('shapeOf: each descriptor is the shape it names; an unknown kind or a missing number throws', () => {
  const bands = [[0, 20], [10, 30], [40, 60], [70, 95], [0, 100]];
  const pairs = [
    [{ kind: 'rect', x: 10, y: 5, w: 120, h: 90, pad: 4 }, rect(10, 5, 120, 90, 4)],
    [{ kind: 'arch', x: 10, y: 5, w: 120, h: 90, rise: 40 }, arch(10, 5, 120, 90, 40, 0)],
    [{ kind: 'slant', x: 10, y: 5, w: 120, h: 90, lean: 0.2, pad: 2 }, slant(10, 5, 120, 90, 0.2, 2)],
    [{ kind: 'ellipse', cx: 70, cy: 50, rx: 60, ry: 45, pad: 3 }, ellipse(70, 50, 60, 45, 3)],
    [{ kind: 'polygon', points: cShape, pad: 1 }, polygon(cShape, 1)],
  ];
  for (const [d, direct] of pairs) for (const [t, b] of bands) assert.deepEqual(shapeOf(d)(t, b), direct(t, b), `${d.kind} ${t}-${b}`);
  assert.throws(() => shapeOf({ kind: 'cloud' }), /unknown shape kind "cloud"/);
  assert.throws(() => shapeOf({}), TypeError);
  assert.throws(() => shapeOf({ kind: 'ellipse', cx: 0, cy: 0, rx: 5 }), /needs a finite "ry"/);
  assert.throws(() => shapeOf({ kind: 'polygon', points: [[0, 0], [1, 1]] }), /at least three/);
  assert.throws(() => shapeOf({ kind: 'rect', x: 0, y: 0, w: 5, h: 5, pad: 'big' }), /pad/);
  const plain = JSON.parse(JSON.stringify(pairs.map(p => p[0])));
  assert.deepEqual(plain, pairs.map(p => p[0]), 'a descriptor is plain data: it survives JSON');
});

test('boundsOf: the box a descriptor stands in', () => {
  assert.deepEqual(boundsOf({ kind: 'ellipse', cx: 50, cy: 40, rx: 30, ry: 20 }), { x: 20, y: 20, w: 60, h: 40 });
  assert.deepEqual(boundsOf({ kind: 'polygon', points: cShape }), { x: 0, y: 0, w: 100, h: 100 });
  assert.deepEqual(boundsOf({ kind: 'rect', x: 1, y: 2, w: 3, h: 4 }), { x: 1, y: 2, w: 3, h: 4 });
  assert.deepEqual(boundsOf({ kind: 'slant', x: 0, y: 0, w: 100, h: 50, lean: -0.2 }), { x: -10, y: 0, w: 110, h: 50 });
});

// ── zones: the lines come back nested in the shape ────────────────────────

const ZONES = [
  { id: 'speech', shape: { kind: 'ellipse', cx: 150, cy: 90, rx: 140, ry: 80, pad: 4 }, slot: 'speech', registers: ['warm', 'playful'], minPx: 12, maxPx: 26, leading: 1.25, align: 'center' },
  { id: 'shout', shape: { kind: 'polygon', points: star(150, 100, 140, 95, 9).filter((_, i) => i % 2), pad: 4 }, slot: 'shout', registers: ['playful'], minPx: 12, maxPx: 24, align: 'center' },
  { id: 'burst', shape: { kind: 'polygon', points: star(200, 140, 190, 135, 8), pad: 3 }, slot: 'burst', registers: ['playful'], minPx: 10, maxPx: 20, align: 'start' }, // a true star, set flush left so the lines reach the edges of the room
  { id: 'thought', shape: { kind: 'ellipse', cx: 150, cy: 70, rx: 120, ry: 60, pad: 6 }, text: 'Perhaps the ferry will be late again, and the tea cold.', registers: ['warm', 'playful'], minPx: 12, maxPx: 22 },
];
const TEXTS = {
  speech: 'The fish was this big, I tell you, and the bus to Mapusa left without us.',
  burst: 'Boom! The whole village heard it, from the church steps to the harbour wall.',
  shout: 'Hot sorpotel! Fresh from the pot, come and get it before it is gone!',
};
const DEVA = 'नमस्ते दुनिया, यह एक लंबा वाक्य है जो कई पंक्तियों में फैलता है';
const L = createLayout(createFakeOracle());

/** Every line box, grown by the zone's pad, must stand inside the zone's true shape. Returns the faults. */
function nestingFaults(zones, laid, { scale = 1 } = {}) {
  const faults = [];
  for (const z of zones) {
    const got = laid[z.id];
    if (!got?.fits) continue;
    const pad = z.shape.pad ?? 0;
    got.lines.forEach((l, i) => {
      for (const [x, y] of samples(l.x - pad, l.y - pad, l.x + l.w + pad, l.y + l.h + pad, 8)) {
        if (!inside(z.shape, x, y)) { faults.push(`${z.id} line ${i} "${l.text}": (${x.toFixed(2)}, ${y.toFixed(2)}) is outside`); return; }
      }
    });
  }
  return faults;
}
const joined = lines => lines.map(l => l.text).join('').replace(/\s+/g, ' ').trim();
const OPTS = { family: 'Kalam', register: 'playful' };

test('layZones: every line box nests inside its ellipse or polygon, geometrically, and the words are all there', () => {
  const laid = layZones(L, ZONES, TEXTS, OPTS);
  assert.deepEqual(Object.keys(laid), ['speech', 'shout', 'burst', 'thought']);
  for (const z of ZONES) {
    const got = laid[z.id];
    assert.equal(got.fits, true, `${z.id} fits`);
    assert.ok(got.px >= z.minPx && got.px <= z.maxPx && Number.isInteger(got.px), `${z.id} at ${got.px}px`);
    assert.equal(joined(got.lines), z.text ?? TEXTS[z.slot], `${z.id}: words lost or reordered`);
    assert.ok(got.lines.length >= 2, `${z.id} wraps over ${got.lines.length} lines`);
  }
  assert.deepEqual(nestingFaults(ZONES, laid), []);
  // and the lines are lines of a bubble: they get wider toward the middle of the ellipse, not fixed to a column
  const widths = laid.speech.lines.map(l => l.room);
  assert.ok(Math.max(...widths) > Math.min(...widths) + 10, `an ellipse's rooms differ line to line (${widths.map(Math.round)})`);
});

test('layZones: at another scale, in Devanagari, and when the zone moves, the lines still nest', () => {
  for (const scale of [0.5, 2]) {
    const laid = layZones(L, ZONES, TEXTS, { ...OPTS, scale: scale / 2 + 0.25 });
    assert.deepEqual(nestingFaults(ZONES, laid), [], `scale ${scale}`);
  }
  const zones = [{ id: 'hindi', shape: { kind: 'ellipse', cx: 400, cy: -30, rx: 130, ry: 70, pad: 5 }, text: DEVA, minPx: 12, maxPx: 24, align: 'center' }];
  const laid = layZones(L, zones, {}, OPTS);
  assert.equal(laid.hindi.fits, true);
  assert.equal(joined(laid.hindi.lines), DEVA);
  assert.deepEqual(nestingFaults(zones, laid), []);
});

test('layZones: the register picks the zones; a zone with no room says so; a missing text throws', () => {
  assert.deepEqual(Object.keys(layZones(L, ZONES, TEXTS, { ...OPTS, register: 'warm' })), ['speech', 'thought']);
  assert.deepEqual(Object.keys(layZones(L, ZONES, TEXTS, { ...OPTS, register: 'quiet' })), [], 'quiet lays nothing');
  assert.equal(Object.keys(layZones(L, ZONES, TEXTS, { family: 'Kalam' })).length, 4, 'no register: every zone');
  const tiny = [{ id: 't', shape: { kind: 'ellipse', cx: 30, cy: 20, rx: 30, ry: 15, pad: 3 }, text: 'Far too many words for a pill this small to hold at a legible size.', minPx: 14, maxPx: 20 }];
  assert.deepEqual(layZones(L, tiny, {}, OPTS).t, { px: null, lines: [], fits: false });
  assert.throws(() => layZones(L, ZONES, {}, OPTS), /zone "speech" has no text/);
});

test('layZones: a block in a zone whose top is too narrow to start in still has equal gaps above and below (a burst)', () => {
  for (const id of ['shout', 'burst', 'thought']) {
    const z = ZONES.find(q => q.id === id), got = layZones(L, [z], TEXTS, OPTS)[id], b = boundsOf(z.shape);
    const above = got.lines[0].y - b.y, below = b.y + b.h - (got.lines[got.lines.length - 1].y + got.lineHeight);
    assert.ok(Math.abs(above - below) <= got.lineHeight * 0.75, `${id}: above ${above.toFixed(1)}, below ${below.toFixed(1)}, line ${got.lineHeight}`);
  }
});

test('layZones: the size is the largest that fits, and the block sits in the middle of the room', () => {
  const got = layZones(L, [ZONES[0]], TEXTS, OPTS).speech, z = ZONES[0];
  const bigger = layZones(L, [{ ...z, minPx: got.px + 1, maxPx: got.px + 1 }], TEXTS, OPTS).speech;
  const b = boundsOf(z.shape), first = got.lines[0], last = got.lines[got.lines.length - 1];
  assert.ok(got.px === z.maxPx || (!bigger.fits || bigger.px === null), `${got.px}px, but ${got.px + 1}px fits as well`);
  const above = first.y - b.y, below = b.y + b.h - (last.y + last.h);
  assert.ok(Math.abs(above - below) <= got.lineHeight, `above ${above.toFixed(1)}, below ${below.toFixed(1)}`);
  const top = layZones(L, [{ ...z, valign: 'top' }], TEXTS, OPTS).speech;
  assert.ok(top.lines[0].y < first.y - 1 || got.lines.length * got.lineHeight >= b.h - 2, 'valign top starts higher than the centred block');
});

// ── mutants: the same assertions must go red when the code is faulted ────

/** The three source files, copied to a temp folder with one fault put back, and the module loaded. */
async function mutated(edits) {
  const dir = mkdtempSync(join(tmpdir(), 'sg-zones-'));
  try {
    for (const name of ['layout.core', 'layout.operators', 'layout.zones']) {
      let src = readFileSync(join(HERE, `${name}.js`), 'utf8').replace(/'\.\/(layout\.[a-z]+)\.js'/g, "'./$1.mjs'");
      for (const [file, from, to] of edits) if (file === name) {
        assert.ok(src.includes(from), `the mutant's target is gone from ${name}.js: ${from}`);
        src = src.replace(from, to);
      }
      writeFileSync(join(dir, `${name}.mjs`), src);
    }
    const zones = await import(pathToFileURL(join(dir, 'layout.zones.mjs')).href);
    const core = await import(pathToFileURL(join(dir, 'layout.core.mjs')).href);
    return { layZones: zones.layZones, createLayout: core.createLayout, core };
  } finally { setTimeout(() => rmSync(dir, { recursive: true, force: true }), 2000).unref(); }
}

test('the control: an unmutated copy of the source passes the nesting assertion', async () => {
  const m = await mutated([]);
  assert.deepEqual(nestingFaults(ZONES, m.layZones(m.createLayout(createFakeOracle()), ZONES, TEXTS, OPTS)), []);
});

for (const [name, edits] of [
  ['layZones ignores the pad', [['layout.zones', 'shapeOf(z.shape)', 'shapeOf({ ...z.shape, pad: 0 })']]],
  ['layZones lays into the bounding box', [['layout.zones', 'shapeOf(z.shape)', "shapeOf({ kind: 'rect', ...boundsOf(z.shape) })"]]],
  ['ellipse looks at the top edge of a band only', [['layout.core', 'Math.min(half(top - pad), half(bottom + pad)) - pad', 'half(top - pad) - pad']]],
  ['polygon does not shrink by the pad', [['layout.core', 'x: run[0] + pad, w: run[1] - run[0] - 2 * pad', 'x: run[0], w: run[1] - run[0]']]],
]) {
  test(`mutant: ${name}; the nesting assertion fails`, async () => {
    const m = await mutated(edits);
    const faults = nestingFaults(ZONES, m.layZones(m.createLayout(createFakeOracle()), ZONES, TEXTS, OPTS));
    assert.ok(faults.length > 0, `the mutant "${name}" passed: the nesting assertion does not bite`);
  });
}

test('mutant: polygon forgets the vertices between the edges of a band; the room assertion fails on a star', async () => {
  const points = star(100, 100, 90, 45, 7), d = { kind: 'polygon', points, pad: 0 };
  const m = await mutated([['layout.core', 'rows.push(y - NUDGE, y + NUDGE)', 'void 0']]);
  const control = await mutated([]);
  checkRoom(d, control.core.polygon(points, 0), 'a copy with nothing changed', 90, 3);
  assert.throws(() => checkRoom(d, m.core.polygon(points, 0), 'the mutant', 90, 3), /outside the shape|not maximal/);
});
