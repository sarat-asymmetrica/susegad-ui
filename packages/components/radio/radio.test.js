import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { handRing, inkDot, KOLAM, arrival } from './radio.core.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'radio.css'), 'utf8');

test('a hand ring is deterministic, round within its wobble, and runs past its start', () => {
  const a = handRing('guests:2'), b = handRing('guests:2'), c = handRing('guests:4');
  assert.deepEqual(a, b);
  assert.notEqual(a.d, c.d);
  for (const [x, y] of a.points) {
    const r = Math.hypot(x - 10, y - 10);
    assert.ok(r > 6.4 && r < 9, `radius ${r.toFixed(2)}`);
  }
  // 1.12 turns of a radius-7.6 circle is about 53.5 units
  assert.ok(a.length > 48 && a.length < 60, `length ${a.length}`);
  const turn = handRing('x', { overlap: 0 });
  const [s, e] = [turn.points[0], turn.points.at(-1)];
  assert.ok(Math.hypot(s[0] - e[0], s[1] - e[1]) < 1.2, 'with no overlap it closes on itself');
});

test('an ink dot is a closed blot about the size asked for', () => {
  const d = inkDot('x', 3.6);
  assert.match(d, /Z$/);
  const nums = d.match(/-?[\d.]+/g).map(Number);
  for (let i = 0; i < nums.length; i += 2) {
    const r = Math.hypot(nums[i] - 10, nums[i + 1] - 10);
    assert.ok(r > 3 && r < 4.2, `r ${r}`);
  }
});

test('the kolam dot: four round petals from the centre that fill the circle as a flower', () => {
  assert.equal(KOLAM.petals.length, 4);
  for (const p of KOLAM.petals) {
    assert.match(p, /^M10 10C.*10 10$/);
    const nums = p.match(/-?[\d.]+/g).map(Number);
    const r = [];
    for (let i = 0; i < nums.length; i += 2) r.push(Math.hypot(nums[i] - 10, nums[i + 1] - 10));
    assert.ok(Math.max(...r) < 9.9, 'the control points stay near the ring');
    assert.ok(r.some(v => Math.abs(v - 8.4) < 0.01), 'the tip reaches as far as the ring it replaces');
  }
});

test('arrival: none in quiet or under reduced motion; a ring drawn in (warm); a bloom (playful) that ends at rest', () => {
  assert.equal(arrival('still', 'ring'), null);
  assert.equal(arrival('state', 'bloom'), null);
  assert.ok(arrival('ambient', 'ring').timing.duration < 400);
  assert.equal(arrival('full', 'bloom').frames.at(-1).transform, 'scale(1) rotate(0deg)');
});

test('the CSS keeps the no-JS path whole and gives forced colours the native radios', () => {
  assert.match(css, /sg-radio-group\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /input\[type="radio"\]:checked::before/);
  assert.match(css, /input\[type="radio"\]:focus-visible/);
  assert.match(css, /input:disabled ~ \.sg-radio-art \.sg-radio-ring/, 'playful shows disabled too');
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /appearance:\s*auto/);
  assert.match(forced, /\.sg-radio-art[^{]*\{\s*display:\s*none/);
  for (const m of css.matchAll(/var\(--sg-[a-z-]+\)/g)) assert.fail(`no fallback: ${m[0]}`);
});

// ── WCAG 1.4.11: circles and dots against what they sit on, every palette and theme ──
for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`1.4.11: ${name} ${theme}: circles, rings and dots are 3:1 or more`, () => {
    const r = resolveRoles(name, theme), c = (a, b) => contrast(toRgb(r[a].hex), toRgb(r[b].hex));
    for (const ground of ['surface', 'surface-raised', 'surface-sunk']) {
      for (const edge of ['rule-strong', 'text-soft', 'accent-text']) assert.ok(c(edge, ground) >= 3, `${edge} on ${ground}: ${c(edge, ground).toFixed(2)}`);
    }
  });
}

test('the pen-circled answer: a leaning oval a quarter bigger than the radio, whose end overruns its start', () => {
  const o = handRing('guests:4:ink', { r: 10.4, wobble: 0.5, overlap: 0.3, spread: 1.5, squash: 0.8, tilt: -14 });
  const rs = o.points.map(([x, y]) => Math.hypot(x - 10, y - 10));
  assert.ok(Math.max(...rs) > 7.6 * 1.25, `reaches ${Math.max(...rs).toFixed(2)}`);
  assert.ok(Math.max(...rs) - Math.min(...rs) > 2, 'an oval, not a circle');
  const [s, e] = [o.points[0], o.points.at(-1)];
  assert.ok(Math.hypot(e[0] - 10, e[1] - 10) - Math.hypot(s[0] - 10, s[1] - 10) > 0.5 || Math.hypot(s[0] - e[0], s[1] - e[1]) > 3, 'the end does not close on the start');
  assert.deepEqual(handRing('a', { squash: 0.8, tilt: -14 }), handRing('a', { squash: 0.8, tilt: -14 }));
});
