import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { triState, pencilTick, pencilDash, pencilBox, stampPose, arrival, resample, length, STAMP_TICK, sketchBox } from './check.core.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'check.css'), 'utf8');

test('triState: all, none, some, and an empty group reads as clear', () => {
  assert.equal(triState([true, true]), 'checked');
  assert.equal(triState([false, false]), 'unchecked');
  assert.equal(triState([true, false, false]), 'mixed');
  assert.equal(triState([]), 'unchecked');
});

test('resample keeps the ends and steps no longer than asked', () => {
  const pts = resample([[0, 0], [10, 0], [10, 5]], 1);
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts.at(-1), [10, 5]);
  for (let i = 1; i < pts.length; i++) assert.ok(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) <= 1.0001);
  assert.equal(length([[0, 0], [3, 4]]), 5);
});

test('the pencil tick is deterministic, stays in its box, and has a length to draw it in by', () => {
  const a = pencilTick('breakfast'), b = pencilTick('breakfast'), c = pencilTick('pickup');
  assert.deepEqual(a, b);
  assert.notEqual(a.d, c.d);
  assert.ok(a.length > 15 && a.length < 25, `length ${a.length}`);
  for (const [x, y] of a.points) assert.ok(x > 2 && x < 18.5 && y > 2.5 && y < 17, `${x},${y}`);
  // a tick: it goes down, then up and further right
  const low = a.points.reduce((m, p) => (p[1] > m[1] ? p : m));
  assert.ok(low[0] > a.points[0][0] && low[0] < a.points.at(-1)[0]);
  assert.ok(a.points.at(-1)[1] < a.points[0][1]);
});

test('the pencil box and dash are deterministic; wobble 0 is a clean line', () => {
  assert.deepEqual(pencilBox('x'), pencilBox('x'));
  assert.deepEqual(pencilDash('x'), pencilDash('x'));
  const flat = pencilDash('x', 0);
  assert.ok(flat.length > 9.9 && flat.length < 10.2);
});

test('the stamp: a closed filled tick, a tilt within reason, three ink spots near the edge', () => {
  assert.match(STAMP_TICK, /Z$/);
  for (const seed of ['a', 'b', 'c', 1, 2]) {
    const p = stampPose(seed);
    assert.ok(p.rotate >= -9 && p.rotate <= 5);
    assert.equal(p.spots.length, 3);
    for (const s of p.spots) assert.ok(Math.hypot(s.cx - 10, s.cy - 10) > 8 && s.r < 1);
  }
});

test('arrival: nothing under reduced motion or in quiet, a draw-in in warm, a press in playful', () => {
  assert.equal(arrival('still', 'draw'), null);
  assert.equal(arrival('state', 'press'), null);
  assert.ok(arrival('ambient', 'draw').timing.duration < 400);
  const p = arrival('full', 'press');
  assert.equal(p.frames.at(-1).transform, 'scale(1)');
});

test('the CSS keeps the no-JS path whole and gives forced colours the native control', () => {
  assert.match(css, /sg-check\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /input\[type="checkbox"\]:checked::before/);
  assert.match(css, /:indeterminate::before/);
  assert.match(css, /:focus-visible/);
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /appearance:\s*auto/);
  assert.match(forced, /\.sg-check-art[^{]*\{\s*display:\s*none/);
  // every colour falls back to a system colour when tokens.css is missing
  for (const m of css.matchAll(/var\(--sg-[a-z-]+\)/g)) assert.fail(`no fallback: ${m[0]}`);
});

// ── WCAG 1.4.11: the box and the tick against what they sit on, every palette and theme ──
for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`1.4.11: ${name} ${theme}: the box edge and the tick are 3:1 or more`, () => {
    const r = resolveRoles(name, theme), c = (a, b) => contrast(toRgb(r[a].hex), toRgb(r[b].hex));
    for (const ground of ['surface', 'surface-raised', 'surface-sunk']) {
      for (const edge of ['rule-strong', 'text-soft', 'accent-text']) assert.ok(c(edge, ground) >= 3, `${edge} on ${ground}: ${c(edge, ground).toFixed(2)}`);
    }
    assert.ok(c('accent-text', 'surface-raised') >= 3, 'the tick inside the box');
  });
}

test('the sketched box is four strokes whose corners cross, the same for the same label', () => {
  const a = sketchBox('Breakfast');
  assert.equal(a.sides.length, 4);
  assert.equal((a.d.match(/M/g) || []).length, 4, 'four separate strokes');
  // each side runs past both of its corners: the top starts left of the left side and ends right of the right
  const xs = a.sides[0].map(p => p[0]);
  assert.ok(Math.min(...xs) < 2.2 - 0.3 && Math.max(...xs) > 17.8 + 0.3, `top from ${Math.min(...xs)} to ${Math.max(...xs)}`);
  assert.deepEqual(sketchBox('Breakfast'), a);
  assert.notEqual(sketchBox('Pickup').d, a.d);
  for (const side of a.sides) for (const [x, y] of side) assert.ok(x > -1 && x < 21 && y > -1 && y < 21, 'stays near the box');
});
