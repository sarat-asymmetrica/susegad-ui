// The bubble's pure core, in Node. Geometry is checked against the drawing
// itself: the outline's path data is read back into a polygon (arcs
// flattened), and the words' line boxes are held to be inside it, which is
// what a reader sees, not just the zone the model says. The type tier runs
// through the fake oracle (every grapheme half the font size wide).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KINDS, TAILS, bubbleModel, textZones, sizeBubble, hugShapes, linesHold, arrive, captionFor, tailOf, kindOf, CLEARANCE } from './bubble.core.js';
import { createLayout, shapeOf, boundsOf } from '../../type/layout.core.js';
import { layZones } from '../../type/layout.zones.js';
import { createFakeOracle } from '../../type/oracle.fake.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const L = createLayout(createFakeOracle());
const lay = (zones, texts) => layZones(L, zones, texts, { family: 'Kalam', register: 'warm' });

// ── reading the drawing back ───────────────────────────────────────────────

/** A path's points: M and L as they are, A (circle arcs, sweep 1, small) flattened. */
function flatten(d) {
  const out = [];
  for (const m of d.matchAll(/([MLA])([^MLAZ]*)/g)) {
    const n = m[2].trim().split(/[\s,]+/).map(Number);
    if (m[1] !== 'A') { out.push([n[0], n[1]]); continue; }
    const [r, , , , , x, y] = n, [px, py] = out[out.length - 1], dx = x - px, dy = y - py, c = Math.hypot(dx, dy);
    const dist = Math.sqrt(Math.max(0, r * r - (c * c) / 4)), cx = (px + x) / 2 + (-dy / c) * dist, cy = (py + y) / 2 + (dx / c) * dist;
    const a0 = Math.atan2(py - cy, px - cx);
    let sweep = Math.atan2(y - cy, x - cx) - a0;
    if (sweep < 0) sweep += 2 * Math.PI;
    for (let i = 1; i <= 10; i++) out.push([cx + r * Math.cos(a0 + (sweep * i) / 10), cy + r * Math.sin(a0 + (sweep * i) / 10)]);
  }
  return out;
}
function distToSegment(px, py, [x0, y0], [x1, y1]) {
  const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}
function inPolygon(pts, x, y, tol = 0) {
  let inside = false;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    if (tol && distToSegment(x, y, a, b) < tol) return true;
    if ((a[1] > y) !== (b[1] > y) && x < a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0])) inside = !inside;
  }
  return inside;
}
const zoneBoundary = z => z.kind === 'polygon' ? z.points.flatMap((a, i) => { const b = z.points[(i + 1) % z.points.length]; return Array.from({ length: 12 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / 12, a[1] + ((b[1] - a[1]) * k) / 12]); }) : Array.from({ length: 64 }, (_, i) => [z.cx + z.rx * Math.cos((2 * Math.PI * i) / 64), z.cy + z.ry * Math.sin((2 * Math.PI * i) / 64)]);
const samples = (x0, y0, x1, y1, n = 8) => {
  const o = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) o.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * j) / n]);
  for (let i = 0; i <= 60; i++) { const t = i / 60; o.push([x0 + (x1 - x0) * t, y0], [x0 + (x1 - x0) * t, y1], [x0, y0 + (y1 - y0) * t], [x1, y0 + (y1 - y0) * t]); }
  return o;
};

const SIZES = [[320, 190], [224, 150], [448, 260], [300, 300], [160, 110]];
const TAILLEN = 28;
const eachCase = fn => {
  for (const kind of KINDS) for (const tail of TAILS) for (const [w, h] of SIZES) for (const edge of kind === 'shout' ? ['clean', 'torn'] : ['clean']) fn({ kind, tail, w, h, edge, seed: `${kind}-${tail}`, wobble: 0.8 });
};

// ── the model ──────────────────────────────────────────────────────────────

test('the model is deterministic per seed and differs between seeds', () => {
  for (const kind of KINDS) {
    const st = { kind, tail: 'bottom-left', w: 320, h: 190, seed: 'crow' };
    assert.deepEqual(bubbleModel(st), bubbleModel(st));
    assert.notEqual(bubbleModel(st).outline, bubbleModel({ ...st, seed: 'heron' }).outline);
    assert.notEqual(bubbleModel(st).outline, bubbleModel({ ...st, w: 321 }).outline);
  }
});

test('the drawing stays in its box; the tail or trail leaves it by the tail length at most, and only toward its side', () => {
  eachCase(c => {
    const m = bubbleModel(c), pts = [...flatten(m.outline), ...m.trail.flatMap(t => [[t.cx - t.r, t.cy - t.r], [t.cx + t.r, t.cy + t.r]])];
    const why = JSON.stringify(c), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const tol = 0.6; // the pen's stroke is drawn outside the path by half its width
    const room = { left: c.tail.includes('left') ? TAILLEN : 0, right: c.tail.includes('right') ? TAILLEN : 0, top: c.tail.startsWith('top') ? TAILLEN : 0, bottom: c.tail.startsWith('bottom') ? TAILLEN : 0 };
    assert.ok(Math.min(...xs) >= -room.left - tol && Math.max(...xs) <= c.w + room.right + tol, `${why}: x ${Math.min(...xs).toFixed(1)} to ${Math.max(...xs).toFixed(1)} in a ${c.w} wide box`);
    assert.ok(Math.min(...ys) >= -room.top - tol && Math.max(...ys) <= c.h + room.bottom + tol, `${why}: y ${Math.min(...ys).toFixed(1)} to ${Math.max(...ys).toFixed(1)} in a ${c.h} tall box`);
    if (c.tail === 'none') { assert.equal(m.trail.length, 0, why); assert.deepEqual(m.tip, { x: c.w / 2, y: c.h / 2 }, why); }
  });
});

test('the zone lies inside the drawn outline, every kind, tail, size and edge', () => {
  eachCase(c => {
    const m = bubbleModel(c), outline = flatten(m.outline);
    for (const [x, y] of zoneBoundary(m.zone)) assert.ok(inPolygon(outline, x, y, 0.3), `${JSON.stringify(c)}: the zone point (${x.toFixed(1)}, ${y.toFixed(1)}) is outside the outline`);
  });
});

test('a thought has a trail of three shrinking circles, farther out each; a shout and a speech have none', () => {
  const t = bubbleModel({ kind: 'thought', tail: 'bottom-left', w: 320, h: 190 });
  assert.equal(t.trail.length, 3);
  assert.ok(t.trail[0].r > t.trail[1].r && t.trail[1].r > t.trail[2].r);
  const d = t.trail.map(c => Math.hypot(c.cx - 160, c.cy - 95));
  assert.ok(d[0] < d[1] && d[1] < d[2], 'each is farther from the middle than the last');
  for (const kind of ['speech', 'shout']) assert.equal(bubbleModel({ kind, tail: 'bottom-left', w: 320, h: 190 }).trail.length, 0);
});

test('plain draws a rounded box for any kind, with the same tail, for the words that must flow as they are', () => {
  for (const kind of KINDS) {
    const m = bubbleModel({ kind, tail: 'bottom-right', w: 300, h: 160, plain: true });
    assert.equal(m.zone.kind, 'polygon');
    assert.ok(!m.outline.includes('A'), 'no cloud arcs');
    assert.equal(m.trail.length, kind === 'thought' ? 3 : 0);
  }
});

test('the zone is plain data a Node gate can read: it survives JSON and shapeOf accepts it', () => {
  eachCase(c => {
    const z = textZones(c);
    assert.deepEqual(JSON.parse(JSON.stringify(z)), z);
    assert.equal(z.length, 1);
    assert.equal(z[0].slot, 'words');
    assert.deepEqual(z[0].registers, ['warm', 'playful'], 'quiet lays nothing: its words stay CSS flow');
    assert.equal(typeof shapeOf(z[0].shape), 'function');
    const b = boundsOf(z[0].shape);
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= c.w && b.y + b.h <= c.h, `${JSON.stringify(c)}: the zone's box ${JSON.stringify(b)} is inside the bubble's box`);
  });
});

test('unknown kinds and tails fall back rather than draw nothing', () => {
  assert.equal(kindOf('whisper'), 'speech');
  assert.equal(tailOf('sideways'), 'bottom-left');
  assert.equal(bubbleModel({ kind: 'whisper', tail: 'sideways', w: 200, h: 120 }).kind, 'speech');
});

// ── the words in the bubble ────────────────────────────────────────────────

const TEXTS = {
  short: 'Hm.',
  line: 'The fish was this big.',
  medium: 'The fish was this big, I tell you, and the bus to Mapusa left without us.',
  long: 'The fish was this big, I tell you, and the bus to Mapusa left without us, so we walked the whole way home along the paddy, singing, and nobody believed a word of it.',
  deva: 'मछली इतनी बड़ी थी, सच कहता हूँ, और मापुसा की बस हमें छोड़कर चली गई',
};
const joined = lines => lines.map(l => l.text).join('').replace(/\s+/g, ' ').trim();
const base = (kind, extra = {}) => ({ kind, tail: 'bottom-left', w: 320, h: 190, seed: 'crow', wobble: 0.8, minPx: 14, maxPx: 20, ...extra });

test('sizeBubble: the words fit, and every line box (grown by the pad) is inside the drawn outline, for each kind', () => {
  let fitted = 0;
  for (const kind of KINDS) for (const [name, text] of Object.entries(TEXTS)) {
    const got = sizeBubble(lay, base(kind), text);
    if (!got) continue;
    fitted++;
    const outline = flatten(got.model.outline), pad = got.model.pad;
    assert.equal(joined(got.lines), text, `${kind} ${name}: words lost`);
    assert.ok(got.px >= 14 && got.px <= 20 && Number.isInteger(got.px), `${kind} ${name} at ${got.px}px`);
    for (const l of got.lines) for (const [x, y] of samples(l.x - pad, l.y - pad, l.x + l.w + pad, l.y + l.h + pad)) {
      assert.ok(inPolygon(outline, x, y, 0.3), `${kind} ${name}: "${l.text}" at (${x.toFixed(1)}, ${y.toFixed(1)}) pokes out of the bubble`);
    }
  }
  assert.ok(fitted >= 12, `only ${fitted} of 15 texts fitted; the test is not looking at enough bubbles`);
});

test('sizeBubble: a short line gets a small bubble, a longer one a bigger one, and none is wider than it was given', () => {
  for (const kind of KINDS) {
    const short = sizeBubble(lay, base(kind), TEXTS.short), medium = sizeBubble(lay, base(kind), TEXTS.medium);
    assert.ok(short.w < 320 * 0.8, `${kind}: "Hm." in ${short.w} px`);
    assert.equal(short.px, 20, 'a short line is at the size asked for');
    assert.ok(medium.w <= 320 && medium.h >= medium.w / 1.7 - 1, `${kind}: ${medium.w} by ${medium.h}`);
    assert.ok(medium.h * medium.w > short.h * short.w * 2, `${kind}: the medium bubble is much bigger than the short one`);
  }
});

test('sizeBubble: the bubble grows taller (to 0.9 of its width) before it gives the words up, and then returns null', () => {
  const st = base('speech', { w: 240, maxPx: 20 });
  const grown = sizeBubble(lay, st, TEXTS.medium);
  assert.ok(grown.h > 240 / 1.7 + 1, `grown to ${grown.h}`);
  assert.ok(grown.h <= 240 * 0.9 + 1e-6);
  assert.equal(sizeBubble(lay, { ...st, w: 160 }, `${TEXTS.long} ${TEXTS.long}`), null, 'too many words for the tallest bubble at the floor: null, so the caller flows them plainly and never clips');
});

test('sizeBubble: Devanagari fits and no line ends on a virama', () => {
  for (const kind of KINDS) {
    const got = sizeBubble(lay, base(kind, { w: 360 }), TEXTS.deva);
    assert.ok(got, `${kind} did not fit`);
    assert.equal(joined(got.lines), TEXTS.deva);
    for (const l of got.lines) assert.ok(!l.text.trimEnd().endsWith('्'), `"${l.text}" ends on a virama`);
  }
});

// ── mutants: the zone must not be allowed outside the drawing ───────────────

/** The least distance from a point to a polygon's edges (the drawn outline, flattened). */
const outlineGap = (o, px, py) => o.reduce((best, a, i) => Math.min(best, distToSegment(px, py, a, o[(i + 1) % o.length])), Infinity);

test('every zone clears the drawn outline by CLEARANCE, all kinds, tails, sizes and edges', () => {
  eachCase(c => {
    const m = bubbleModel(c), o = flatten(m.outline);
    for (const [px, py] of zoneBoundary(m.zone)) assert.ok(outlineGap(o, px, py) >= CLEARANCE - 0.05, `${JSON.stringify(c)}: the zone point (${px.toFixed(1)}, ${py.toFixed(1)}) is ${outlineGap(o, px, py).toFixed(2)} from the outline, under the clearance ${CLEARANCE}`);
  });
});

async function mutatedCore(from, to) {
  const dir = mkdtempSync(join(tmpdir(), 'sg-bubble-'));
  try {
    const src = readFileSync(join(HERE, 'bubble.core.js'), 'utf8').replace(/'(\.\.\/\.\.\/[^']+|\.\/[^']+\.js)'/g, (m, rel) => `'${pathToFileURL(join(HERE, rel)).href}'`);
    assert.ok(from === '' || src.includes(from), `the mutant's target is gone: ${from}`);
    writeFileSync(join(dir, 'bubble.core.mjs'), from === '' ? src : src.replace(from, to));
    return await import(pathToFileURL(join(dir, 'bubble.core.mjs')).href);
  } finally { setTimeout(() => rmSync(dir, { recursive: true, force: true }), 2000).unref(); }
}
const clearanceFaults = m => {
  const out = [];
  eachCase(c => {
    const x = m.bubbleModel(c), o = flatten(x.outline);
    for (const [px, py] of zoneBoundary(x.zone)) if (outlineGap(o, px, py) < CLEARANCE - 0.05) { out.push(`${c.kind}/${c.tail}`); break; }
  });
  return out;
};

test('the control: an unchanged copy of the core clears the outline everywhere', async () => assert.deepEqual(clearanceFaults(await mutatedCore('', '')), []));
for (const [name, from, to] of [
  ['the clearance is dropped, so the zone sits on the outline', 'clearanceZone(shape, clear)', 'clearanceZone(shape, 0)'],
  ['the clearance is negative, so the zone spills past the outline', 'export const CLEARANCE = 1.5;', 'export const CLEARANCE = -30;'],
]) {
  test(`mutant: ${name}; the clearance assertion fails`, async () => {
    const faults = clearanceFaults(await mutatedCore(from, to));
    assert.ok(faults.length > 0, `"${name}" passed: the assertion does not bite`);
  });
}

// ── the still's float shapes, the arrival, the caption ──────────────────────

const parsePoly = s => [...s.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g)].map(m => [+m[1], +m[2]]);

test('hugShapes: the two polygons are the zone\'s left and right edge, row by row', () => {
  for (const kind of KINDS) {
    const m = bubbleModel(base(kind)), room = shapeOf(m.zone), hug = hugShapes(m.zone, m.w, m.h), half = m.w / 2;
    const left = parsePoly(hug.left), right = parsePoly(hug.right);
    assert.deepEqual(left[0], [0, 0]);
    assert.deepEqual(left[left.length - 1], [0, m.h]);
    assert.deepEqual(right[0], [half, 0]);
    let checked = 0;
    for (const [x, y] of left.slice(1, -1)) {
      const r = room(y - 0.25, y + 0.25);
      if (!r) continue;
      checked++;
      assert.ok(Math.abs(x - Math.min(Math.max(r.x, 0), half)) < 0.06, `${kind}: left edge at y ${y} is ${x}, the zone's is ${r.x}`);
    }
    for (const [x, y] of right.slice(1, -1)) {
      const r = room(y - 0.25, y + 0.25);
      if (r) assert.ok(Math.abs(x - Math.min(Math.max(r.x + r.w - half, 0), half)) < 0.06, `${kind}: right edge at y ${y} is ${x}`);
    }
    assert.ok(checked >= 20, `${kind}: only ${checked} rows had room`);
    assert.ok(hug.top >= 0 && hug.bottom <= m.h);
  }
});

test('arrive: playful pops and warm settles at motion; never at still or state; opacity and transform only', () => {
  const tip = { x: 40, y: 190 };
  for (const motion of ['still', 'state']) for (const reg of ['warm', 'playful']) assert.equal(arrive(motion, reg, tip), null, `${reg} at ${motion}`);
  const pop = arrive('full', 'playful', tip), settle = arrive('ambient', 'warm', tip);
  assert.equal(pop.origin, '40px 190px', 'it grows out of the tail');
  assert.equal(pop.frames.length, 3);
  assert.equal(settle.frames.length, 2);
  for (const a of [pop, settle]) for (const fr of a.frames) assert.deepEqual(Object.keys(fr).filter(k => !['opacity', 'transform', 'offset'].includes(k)), []);
  assert.equal(arrive('ambient', 'playful', tip).frames.length, 2, 'playful without full motion settles rather than pops');
});

test('captionFor: the page\'s own label wins; a speaker gets the kind\'s verb; no speaker, no caption', () => {
  assert.equal(captionFor('thought', 'Crow'), 'Crow thinks');
  assert.equal(captionFor('shout', 'Crow'), 'Crow shouts');
  assert.equal(captionFor('speech', 'Crow'), 'Crow says');
  assert.equal(captionFor('speech', 'Crow', 'कावळा म्हणतो'), 'कावळा म्हणतो');
  assert.equal(captionFor('speech', ''), '');
});

test('linesHold: boxes inside the room of the zone pass; a box a hair too wide, or in a row with no room, fails (so the still can refuse a bubble)', () => {
  for (const kind of KINDS) {
    const m = bubbleModel(base(kind)), room = shapeOf(m.zone), y0 = m.h / 2 - 10, y1 = m.h / 2 + 10, r = room(y0, y1);
    assert.ok(r, `${kind} has room at its middle`);
    const fit = { x0: r.x, x1: r.x + r.w, y0, y1 };
    assert.equal(linesHold(m.zone, [fit]), true, `${kind}: a line exactly the room`);
    assert.equal(linesHold(m.zone, [{ ...fit, x1: fit.x1 + 3 }]), false, `${kind}: 3 px too wide on the right`);
    assert.equal(linesHold(m.zone, [{ ...fit, x0: fit.x0 - 3 }]), false, `${kind}: 3 px too wide on the left`);
    assert.equal(linesHold(m.zone, [{ x0: m.w / 2 - 5, x1: m.w / 2 + 5, y0: 0, y1: 12 }]), false, `${kind}: a line at the very top has no room`);
    assert.equal(linesHold(m.zone, []), false, 'no lines is not a bubble that holds its words');
  }
});
