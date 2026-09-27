import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, PAD, strokeWidths, ribbon, penFor, toPathData, toSVG } from './signature.core.js';
import { DRY_MS, dryness, inkBounds, flourish, fitSize } from './skins/marks.js';

/** A straight stroke from a to b, n samples, `ms` apart. */
const line = ([x0, y0], [x1, y1], n = 20, ms = 16, p = 0.5) =>
  Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, i * ms, p]);

/** Ray-casting point-in-polygon. */
function inside([x, y], poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
/** Ribbon width at the middle of a horizontal or vertical stroke. */
function widthAcross(poly, axis, at) {
  const o = axis === 'x' ? 1 : 0, a = axis === 'x' ? 0 : 1;
  const near = poly.filter(p => Math.abs(p[a] - at) < 3).map(p => p[o]);
  return Math.max(...near) - Math.min(...near);
}

test('every word the element adds is in STRINGS, in sentence case with no em dashes', () => {
  for (const v of Object.values(STRINGS)) {
    assert.match(v, /^[A-Z]/);
    assert.doesNotMatch(v, /—/);
  }
});

test('quick strokes are thinner than slow ones; a mouse’s pressure is ignored, a pen’s is not', () => {
  const slow = strokeWidths(line([0, 0], [100, 0], 20, 40)).widths.at(-1);
  const fast = strokeWidths(line([0, 0], [100, 0], 20, 4)).widths.at(-1);
  assert.ok(fast < slow * 0.8, `fast ${fast.toFixed(2)} vs slow ${slow.toFixed(2)}`);
  const mouseHard = strokeWidths(line([0, 0], [100, 0], 20, 16, 1)).widths.at(-1);
  const mouseSoft = strokeWidths(line([0, 0], [100, 0], 20, 16, 0.1)).widths.at(-1);
  assert.equal(mouseHard, mouseSoft);
  const penHard = strokeWidths(line([0, 0], [100, 0], 20, 16, 1), { pen: true }).widths.at(-1);
  const penSoft = strokeWidths(line([0, 0], [100, 0], 20, 16, 0.1), { pen: true }).widths.at(-1);
  assert.ok(penHard > penSoft * 1.8);
});

test('the ribbon is a closed shape around the pen’s path, and the same input gives the same ink', () => {
  const pts = line([100, 100], [300, 120], 30, 12);
  const r = ribbon(pts);
  assert.ok(r.length > 40);
  for (const [x, y] of pts.slice(3, -3)) assert.ok(inside([x, y], r), `(${x}, ${y}) inside`);
  assert.ok(!inside([200, 140], r) && !inside([200, 95], r), 'and not far from it');
  assert.deepEqual(ribbon(pts), r);
});

test('a tap is a dot', () => {
  const dot = ribbon([[50, 60, 0, 0.5]]);
  assert.ok(dot.length >= 12);
  assert.ok(inside([50, 60], dot));
  for (const [x, y] of dot) assert.ok(Math.hypot(x - 50, y - 60) < 3);
  assert.deepEqual(ribbon([]), []);
});

test('the start swells in; a quick lift flicks thin, a slow one stays blunt', () => {
  const slow = ribbon(line([0, 100], [200, 100], 40, 40));
  assert.ok(widthAcross(slow, 'x', 1) < widthAcross(slow, 'x', 100) * 0.8, 'soft start');
  assert.ok(widthAcross(slow, 'x', 196) > widthAcross(slow, 'x', 100) * 0.8, 'blunt end');
  const quick = ribbon(line([0, 100], [200, 100], 40, 3));
  assert.ok(widthAcross(quick, 'x', 199) < widthAcross(quick, 'x', 100) * 0.6, 'flicked end');
});

test('the broad nib makes downstrokes thick and upstrokes to the right hairline', () => {
  const nib = penFor('warm');
  const down = ribbon(line([100, 20], [100, 180], 40, 20), nib);
  const up = ribbon(line([100, 180], [100 + 160 * Math.cos(0.61), 180 - 160 * Math.sin(0.61)], 40, 20), nib);
  const wd = widthAcross(down, 'y', 100);
  const wu = Math.max(...up.map(p => Math.abs((p[0] - 100) * Math.sin(0.61) + (p[1] - 180) * Math.cos(0.61))).filter(Number.isFinite)) * 2;
  assert.ok(wd > wu * 2, `down ${wd.toFixed(2)} vs up ${wu.toFixed(2)}`);
  const plain = penFor('quiet');
  assert.equal(plain.nib, 0);
  const a = widthAcross(ribbon(line([100, 20], [100, 180], 40, 20), plain), 'y', 100);
  const b = widthAcross(ribbon(line([20, 100], [180, 100], 40, 20), plain), 'x', 100);
  assert.ok(Math.abs(a - b) < 0.05, 'a plain pen is the same width every way');
});

test('path data is compact SVG in the pad’s box, and toSVG wraps it', () => {
  const d = toPathData([ribbon(line([10, 10], [60, 40], 8)), ribbon([[5, 5, 0, 0.5]])]);
  assert.match(d, /^M[\d.]+ [\d.]+L/);
  assert.equal((d.match(/M/g) || []).length, 2);
  assert.equal((d.match(/Z/g) || []).length, 2);
  assert.doesNotMatch(d, /\.\d\d/, 'one decimal at most');
  assert.equal(toPathData([]), '');
  const svg = toSVG(d, '#123456');
  assert.match(svg, new RegExp(`viewBox="0 0 ${PAD.W} ${PAD.H}"`));
  assert.match(svg, /fill="#123456"/);
});

test('ink dries over DRY_MS; quiet and reduced motion lay it down dry', () => {
  assert.equal(dryness(0, 'ambient'), 0);
  assert.equal(dryness(DRY_MS, 'full'), 1);
  const mid = dryness(DRY_MS / 2, 'ambient');
  assert.ok(mid > 0.2 && mid < 0.8);
  assert.equal(dryness(0, 'still'), 1);
  assert.equal(dryness(0, 'state'), 1);
});

test('inkBounds', () => {
  assert.equal(inkBounds([]), null);
  assert.deepEqual(inkBounds([[[1, 2], [5, 9]], [[3, -1]]]), { x: 1, y: -1, w: 4, h: 10 });
});

test('the flourish sits under the signature, inside the pad, and is fixed by its seed', () => {
  const b = { x: 100, y: 60, w: 260, h: 80 };
  const f = flourish(b, 'sarat');
  assert.deepEqual(f, flourish(b, 'sarat'));
  assert.notDeepEqual(f, flourish(b, 'other'));
  for (const [x, y] of f) assert.ok(x >= 0 && x <= PAD.W && y >= 0 && y <= PAD.H, `${x}, ${y}`);
  assert.ok(f[0][1] > b.y + b.h, 'starts below the ink');
  assert.ok(f.every((p, i) => i === 0 || p[2] > f[i - 1][2]), 'time moves forward, so it inks like a stroke');
  assert.ok(ribbon(f, penFor('playful')).length > 20);
});

test('fitSize shrinks a long name to fit the line', () => {
  const width = (name) => size => name.length * size * 0.5;
  assert.equal(fitSize(width('Sarat')), 64);
  const s = fitSize(width('Sarat Chandran Venkataraman Iyer'));
  assert.ok(s < 64 && s >= 22);
  assert.ok(width('Sarat Chandran Venkataraman Iyer')(s) <= PAD.W - 80 || s === 22);
});
