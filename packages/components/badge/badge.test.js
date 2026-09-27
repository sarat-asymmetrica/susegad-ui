import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TONES, ICONS, iconUrl, toneOf, scriptOf, inkOutline, busyMotion, MOTIF } from './badge.core.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'badge.css'), 'utf8');

test('every tone has its own shape, so colour never carries the meaning alone', () => {
  const shapes = TONES.map(t => ICONS[t]);
  assert.equal(new Set(shapes).size, TONES.length);
  for (const t of TONES) assert.ok(ICONS[t].length > 10, t);
});

test('badge.css carries exactly the core icons (no drift between the two)', () => {
  for (const t of TONES) assert.ok(css.includes(iconUrl(t)), `${t} icon in badge.css`);
  // the mark is a mask on an empty pseudo-element: nothing for a screen reader to read
  assert.match(css, /sg-badge::before\s*\{\s*content:\s*"";/);
});

test('toneOf falls back to neutral', () => {
  assert.equal(toneOf('success'), 'success');
  assert.equal(toneOf('sparkly'), 'neutral');
  assert.equal(toneOf(null), 'neutral');
});

test('scriptOf tags Latin, Devanagari and Kannada', () => {
  assert.equal(scriptOf('Paid'), 'latin');
  assert.equal(scriptOf('भरले'), 'devanagari');
  assert.equal(scriptOf('ಪಾವತಿಸಲಾಗಿದೆ'), 'kannada');
});

test('the inked outline is deterministic, two passes, closed with an overlap, and hugs the box', () => {
  const a = inkOutline(80, 24, 'paid'), b = inkOutline(80, 24, 'paid'), c = inkOutline(80, 24, 'draft');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.d, c.d);
  assert.equal(a.d.length, 2);
  for (const pts of a.points) {
    const first = pts[0], ends = pts.slice(-4);
    assert.ok(ends.some(p => Math.hypot(p[0] - first[0], p[1] - first[1]) < 12), 'the pen comes back past the start');
    for (const [x, y] of pts) assert.ok(x > -2 && x < 82 && y > -2 && y < 26, `point ${x},${y} strays`);
  }
});

test('a wobble of 0 gives a clean rounded rectangle', () => {
  const { points } = inkOutline(60, 20, 'x', { wobble: 0, inset: 1 });
  for (const [x, y] of points[0]) assert.ok(x >= 0.99 && x <= 59.01 && y >= 0.99 && y <= 19.01);
});

test('busy: still in quiet and under reduced motion, breathes in warm, turns in playful', () => {
  assert.equal(busyMotion('still'), null);
  assert.equal(busyMotion('state'), null);
  assert.ok(busyMotion('ambient').frames.some(f => f.opacity < 1));
  assert.match(busyMotion('full').frames.at(-1).transform, /1turn/);
});

test('the motif is a kolam flower: four closed petals round the centre, inside its 12 × 12 grid', () => {
  assert.equal(MOTIF.petals.length, 4);
  for (const d of MOTIF.petals) {
    assert.match(d, /^M6 6C.*6 6z$/, 'each petal starts and ends at the centre');
    const nums = d.match(/-?[\d.]+/g).map(Number);
    for (const n of nums) assert.ok(n >= 0 && n <= 12, `${n} leaves the grid`);
  }
});

// ── contrast: every register's text, every palette, both themes ──────────
const fill = { neutral: 'text-soft', accent: 'accent', success: 'success', warning: 'warning', danger: 'danger', info: 'info' };
const ink = { neutral: 'text-soft', accent: 'accent-text', success: 'success', warning: 'warning', danger: 'danger', info: 'info' };
for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  const r = resolveRoles(name, theme);
  const hex = role => toRgb(r[role].hex);
  test(`AA: ${name} ${theme}: warm badge ink and the playful chip read at 4.5:1`, () => {
    for (const tone of TONES) {
      for (const ground of ['surface', 'surface-raised', 'surface-sunk']) {
        const w = contrast(hex(ink[tone]), hex(ground));
        assert.ok(w >= 4.5, `warm ${tone} on ${ground}: ${w.toFixed(2)}`);
      }
      const on = tone === 'accent' ? 'on-accent' : 'surface-raised';
      const p = contrast(hex(on), hex(fill[tone]));
      assert.ok(p >= 4.5, `playful ${tone} chip: ${p.toFixed(2)}`);
    }
  });
}
