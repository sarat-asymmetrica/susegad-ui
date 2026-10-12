// The bubble zone kernel, in Node. The promise this file holds to is a
// clearance: for any supported outline, every point of the zone the bubble
// hands to the type tier stands eps or more inside. So the tests below build
// zones for random and degenerate outlines and measure the distance field of
// the outline at every point of the zone, and they pin the pieces of the math
// (the polygon distance is exact, the ellipse distance meets a brute-force
// search, the corridor obeys its band).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signedDistance, polygonDistance, ellipseDistance, corridor, clearanceZone } from './bubble.zones.core.js';
import { shapeOf, boundsOf } from '../../type/layout.core.js';

// ── a small deterministic generator, so a failure is reproducible ──────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── reading a zone back ────────────────────────────────────────────────────

const insidePolygon = (pts, x, y) => {
  let inside = false;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
    if ((y0 > y) !== (y1 > y) && x < x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)) inside = !inside;
  }
  return inside;
};

/** Points of a polygon zone worth measuring: its vertices, its edge midpoints, and a grid inside. */
function zonePoints(zone, step = 3) {
  const pts = zone.points, out = [...pts];
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    out.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  const b = boundsOf(zone);
  for (let y = b.y; y <= b.y + b.h + 1e-9; y += step) for (let x = b.x; x <= b.x + b.w + 1e-9; x += step) if (insidePolygon(pts, x, y)) out.push([x, y]);
  return out;
}

/** The least distance from any point of a zone to the outline it was cut from. */
function worstClearance(shape, zone) {
  const sdf = signedDistance(shape);
  let worst = Infinity;
  for (const [x, y] of zonePoints(zone)) worst = Math.min(worst, sdf(x, y));
  return worst;
}

// ── the distance fields ────────────────────────────────────────────────────

test('polygon distance is exact: the nearest edge, positive inside and negative outside', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(polygonDistance(square, 5, 5), 5);            // centre: 5 from every edge
  assert.equal(polygonDistance(square, 1, 5), 1);            // 1 from the left edge
  assert.equal(polygonDistance(square, 5, 0), 0);            // on the boundary
  assert.equal(polygonDistance(square, -3, 5), -3);          // 3 outside the left edge
  assert.equal(polygonDistance(square, 12, 12), -Math.hypot(2, 2)); // outside, nearest the corner
  const tri = [[0, 0], [4, 0], [0, 3]];
  assert.ok(polygonDistance(tri, 1, 1) > 0, 'a point inside the triangle is positive');
  assert.ok(polygonDistance(tri, 3, 3) < 0, 'a point past the hypotenuse is negative');
});

test('ellipse distance meets a brute-force closest point, and is exact on the axes', () => {
  const brute = (a, b, x, y) => { let best = Infinity; for (let i = 0; i < 20000; i++) { const t = (i / 20000) * 2 * Math.PI; best = Math.min(best, Math.hypot(x - a * Math.cos(t), y - b * Math.sin(t))); } return best; };
  let worst = 0;
  const rnd = mulberry32(7);
  for (const [a, b] of [[2, 1], [100, 20], [40, 30], [1, 1], [90, 60], [10, 1]]) {
    for (let i = 0; i < 40; i++) {
      const x = (rnd() * 3 - 1.5) * a, y = (rnd() * 3 - 1.5) * b;
      worst = Math.max(worst, Math.abs(Math.abs(ellipseDistance(0, 0, a, b, x, y)) - brute(a, b, x, y)));
    }
  }
  assert.ok(worst < 2e-4, `worst difference from the brute force is ${worst}`);
  assert.equal(ellipseDistance(0, 0, 5, 3, 0, 0), 3);       // centre: the minor radius
  assert.equal(ellipseDistance(0, 0, 5, 3, 2, 0), 3);       // on the major axis, inside
  assert.equal(ellipseDistance(0, 0, 5, 3, 0, 1), 2);       // on the minor axis, inside
  assert.equal(ellipseDistance(0, 0, 5, 3, 8, 0), -3);      // on the major axis, outside
  assert.equal(ellipseDistance(0, 0, 5, 3, 0, 5), -2);      // on the minor axis, outside
});

test('the documented scaling bound never overshoots the true distance inside', () => {
  const rnd = mulberry32(11);
  for (const [a, b] of [[2, 1], [100, 20], [40, 30], [90, 60], [10, 1]]) {
    for (let i = 0; i < 200; i++) {
      const t = rnd() * 2 * Math.PI, g = rnd();
      const x = g * a * Math.cos(t), y = g * b * Math.sin(t);
      const bound = (1 - Math.hypot(x / a, y / b)) * Math.min(a, b);
      assert.ok(bound <= ellipseDistance(0, 0, a, b, x, y) + 1e-9, `bound ${bound} over true distance at (${x}, ${y})`);
    }
  }
});

// ── the corridor ───────────────────────────────────────────────────────────

test('a corridor holds its clearance: every point of the band it returns is eps inside', () => {
  const rnd = mulberry32(3);
  for (let k = 0; k < 200; k++) {
    const shape = { kind: 'ellipse', cx: 100, cy: 100, rx: 20 + rnd() * 60, ry: 20 + rnd() * 60 };
    const sdf = signedDistance(shape), b = boundsOf(shape);
    const y0 = b.y + rnd() * b.h, h = rnd() * 12, eps = 1 + rnd() * 2;
    const room = corridor(shape, y0, y0 + h, eps, { step: 0.5 });
    if (!room) continue;
    // between the sampled rows the field can dip by at most half the step
    for (let i = 0; i <= 20; i++) {
      const y = y0 + (h * i) / 20;
      for (let j = 0; j <= 20; j++) {
        const x = room.x + (room.w * j) / 20;
        assert.ok(sdf(x, y) >= eps - 0.25 - 1e-9, `point (${x.toFixed(2)}, ${y.toFixed(2)}) is ${sdf(x, y).toFixed(3)} inside, under eps ${eps}`);
      }
    }
  }
});

// ── the zone ───────────────────────────────────────────────────────────────

const EPS = 1.5;

test('a zone is a polygon the type tier accepts, and stands inside its outline', () => {
  const zone = clearanceZone({ kind: 'ellipse', cx: 100, cy: 80, rx: 70, ry: 50 }, EPS);
  assert.ok(zone && zone.kind === 'polygon' && zone.points.length >= 6);
  assert.equal(typeof shapeOf(zone), 'function');
  const b = boundsOf(zone);
  assert.ok(b.x > 30 && b.y > 30 && b.x + b.w < 170 && b.y + b.h < 130);
});

test('a zone too thin to hold a corridor comes back null, not a broken shape', () => {
  assert.equal(clearanceZone({ kind: 'ellipse', cx: 0, cy: 0, rx: 60, ry: 0.4 }, EPS), null);
  assert.equal(clearanceZone({ kind: 'polygon', points: [[0, 0], [1, 0], [0.5, 0.01]] }, EPS), null);
});

// ── property: zero corridor/outline violations over a population ───────────

/** Star-shaped polygons: simple, and their anchor is inside, so a corridor exists. */
function starPolygon(rnd, { cx = 0, cy = 0, r = 50, n = 8, jitter = 0.4 } = {}) {
  const angles = Array.from({ length: n }, (_, i) => (i / n) * 2 * Math.PI + (rnd() - 0.5) * 0.5).sort((a, b) => a - b);
  return angles.map(a => [cx + r * (1 - jitter * rnd()) * Math.cos(a), cy + r * (1 - jitter * rnd()) * Math.sin(a)]);
}

test('property: over randomized ellipses, no zone point comes within eps of the outline', () => {
  const rnd = mulberry32(101);
  let zones = 0;
  for (let k = 0; k < 200; k++) {
    // radii from a hair to large, including very thin and near-circular
    const rx = 0.3 + rnd() * 110, ry = 0.3 + rnd() * 110;
    const shape = { kind: 'ellipse', cx: 0, cy: 0, rx, ry };
    const zone = clearanceZone(shape, EPS);
    if (!zone) continue;
    zones++;
    const worst = worstClearance(shape, zone);
    assert.ok(worst >= EPS - 1e-6, `ellipse ${rx.toFixed(2)}x${ry.toFixed(2)}: worst clearance ${worst.toFixed(3)} under eps ${EPS}`);
  }
  assert.ok(zones >= 160, `only ${zones} of 200 ellipses held a zone; the population is not biting`);
});

test('property: over randomized polygons (concave included), no zone point comes within eps', () => {
  const rnd = mulberry32(202);
  let zones = 0;
  for (let k = 0; k < 200; k++) {
    const n = 3 + Math.floor(rnd() * 10);
    const shape = { kind: 'polygon', points: starPolygon(rnd, { r: 5 + rnd() * 100, n, jitter: rnd() * 0.8 }) };
    const zone = clearanceZone(shape, EPS);
    if (!zone) continue;
    zones++;
    const worst = worstClearance(shape, zone);
    assert.ok(worst >= EPS - 1e-6, `polygon of ${n}: worst clearance ${worst.toFixed(3)} under eps ${EPS}`);
  }
  assert.ok(zones >= 160, `only ${zones} of 200 polygons held a zone`);
});

test('property: degenerate outlines either hold a clear zone or come back null, never a violation', () => {
  const rnd = mulberry32(303);
  const cases = [
    ['very thin ellipse', { kind: 'ellipse', cx: 0, cy: 0, rx: 200, ry: 1 }],
    ['tiny radius', { kind: 'ellipse', cx: 0, cy: 0, rx: 0.6, ry: 0.6 }],
    ['flat ellipse', { kind: 'ellipse', cx: 0, cy: 0, rx: 80, ry: 0.05 }],
    ['tiny area triangle', { kind: 'polygon', points: [[0, 0], [0.5, 0], [0.25, 0.4]] }],
    ['degenerate vertex count (three)', { kind: 'polygon', points: [[0, 0], [40, 6], [8, 50]] }],
    ['near-degenerate vertices', { kind: 'polygon', points: [[0, 0], [40, 0], [40, 1e-4], [0, 40]] }],
    ['a repeated vertex', { kind: 'polygon', points: [[0, 0], [40, 0], [40, 0], [20, 40]] }],
    ['a self-touching bowtie', { kind: 'polygon', points: [[0, 0], [40, 40], [0, 40], [40, 0]] }],
    ['a deep concave comb', { kind: 'polygon', points: [[0, 0], [80, 0], [80, 60], [70, 10], [60, 60], [50, 10], [40, 60], [30, 10], [20, 60], [10, 10], [0, 60]] }],
    ['a thin concave spike', { kind: 'polygon', points: [[0, 0], [60, 0], [30, 5], [60, 60], [0, 60]] }],
  ];
  for (let k = 0; k < 100; k++) {
    const n = 3 + Math.floor(rnd() * 6);
    cases.push([`random degenerate ${k}`, { kind: 'polygon', points: starPolygon(rnd, { r: 0.2 + rnd() * 3, n }) }]);
  }
  for (const [name, shape] of cases) {
    const zone = clearanceZone(shape, EPS);
    if (!zone) continue;
    const worst = worstClearance(shape, zone);
    assert.ok(worst >= EPS - 1e-6, `${name}: worst clearance ${worst.toFixed(3)} under eps ${EPS}`);
  }
});

// ── regression: the naive radial inset is the bug this replaces ────────────

test('regression: a radial inset leaves an eccentric ellipse within eps; the distance zone does not', () => {
  const shape = { kind: 'ellipse', cx: 0, cy: 0, rx: 100, ry: 20 };
  const sdf = signedDistance(shape);
  // the old zone: shrink both radii by eps, the way bubble.core.js used to
  const old = { kind: 'polygon', points: Array.from({ length: 360 }, (_, i) => { const t = (2 * Math.PI * i) / 360; return [(100 - EPS) * Math.cos(t), (20 - EPS) * Math.sin(t)]; }) };
  let oldWorst = Infinity;
  for (const [x, y] of zonePoints(old, 1)) oldWorst = Math.min(oldWorst, sdf(x, y));
  assert.ok(oldWorst < EPS - 1e-3, `the naive inset should fall under eps ${EPS}, its worst is ${oldWorst.toFixed(3)}`);

  const zone = clearanceZone(shape, EPS);
  assert.ok(zone);
  const worst = worstClearance(shape, zone);
  assert.ok(worst >= EPS - 1e-6, `the distance zone should clear eps ${EPS}, its worst is ${worst.toFixed(3)}`);
});

test('regression: at a concave vertex the radial inset dips into the notch; the distance zone stays clear', () => {
  const shape = { kind: 'polygon', points: [[0, 0], [120, 0], [120, 80], [60, 8], [0, 80]] }; // a deep V valley at the top
  const sdf = signedDistance(shape);
  const cx = 60, cy = 40;
  const old = { kind: 'polygon', points: shape.points.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1, k = 1 - EPS / d; return [cx + (x - cx) * k, cy + (y - cy) * k]; }) };
  let oldWorst = Infinity;
  for (const [x, y] of zonePoints(old, 1)) oldWorst = Math.min(oldWorst, sdf(x, y));
  assert.ok(oldWorst < EPS - 1e-3, `the radial inset near the valley should fall under eps ${EPS}, its worst is ${oldWorst.toFixed(3)}`);

  const zone = clearanceZone(shape, EPS);
  if (zone) {
    const worst = worstClearance(shape, zone);
    assert.ok(worst >= EPS - 1e-6, `the distance zone should clear eps ${EPS}, its worst is ${worst.toFixed(3)}`);
  }
});


