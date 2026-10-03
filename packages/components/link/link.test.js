import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { inkUnderline, kolamUnderline } from './link.core.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'link.css'), 'utf8');
const nums = d => d.match(/-?[\d.]+/g).map(Number);

test('the ink underline is deterministic for a seed, and differs between two seeds', () => {
  assert.equal(inkUnderline(80, 'See the rooms'), inkUnderline(80, 'See the rooms'));
  assert.notEqual(inkUnderline(80, 'See the rooms'), inkUnderline(80, 'Book now'));
});

test('the ink underline starts at x=0 and ends near x=w', () => {
  const w = 96;
  const d = inkUnderline(w, 'x');
  const points = d.match(/-?[\d.]+ -?[\d.]+/g).map(p => p.split(' ').map(Number));
  assert.equal(points[0][0], 0);
  assert.ok(Math.abs(points.at(-1)[0] - w) < 0.1);
});

test('the kolam line is deterministic, closes near x=w, and has a knotted loop (a cubic curve) in its middle third', () => {
  const w = 120;
  assert.equal(kolamUnderline(w, 'a'), kolamUnderline(w, 'a'));
  assert.notEqual(kolamUnderline(w, 'a'), kolamUnderline(w, 'b'));
  const d = kolamUnderline(w, 'a');
  assert.match(d, /C/, 'built from cubic segments, including the loop');
  const last = nums(d).slice(-2);
  assert.ok(Math.abs(last[0] - w) < 1);
});

test('the CSS switches off the native underline only where a drawn one replaces it, and forced colours bring it back', () => {
  assert.match(css, /sg-link\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /:focus-visible/);
  // quiet keeps the browser's own underline
  const quietRule = css.slice(0, css.indexOf('warm: the ink underline'));
  assert.match(quietRule, /text-decoration-line:\s*underline/);
  assert.match(css, /\[data-skin="warm"\]\s*>\s*a\s*\{\s*text-decoration-line:\s*none/);
  assert.match(css, /\[data-skin="playful"\]\s*>\s*a\s*\{\s*text-decoration-line:\s*none/);
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /\.sg-link-ink\s*\{\s*display:\s*none\s*!important/);
  assert.match(forced, /text-decoration-line:\s*underline\s*!important/);
});

test('warm: the drawn line stays hidden (transitions from its own length) until hover or focus', () => {
  assert.match(css, /\.sg-link-ink path\s*\{[^}]*transition:\s*stroke-dashoffset/);
  assert.match(css, /:is\(:hover, :focus-within\)\s*\.sg-link-ink path\s*\{\s*stroke-dashoffset:\s*0\s*!important/);
});

// ── WCAG 1.4.1/1.4.11: a link must be distinguishable from body text by more than colour ──
for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`contrast: ${name} ${theme}: the link's own colour and its drawn ink read against the surface`, () => {
    const r = resolveRoles(name, theme), c = (a, b) => contrast(toRgb(r[a].hex), toRgb(r[b].hex));
    for (const ground of ['surface', 'surface-raised']) {
      assert.ok(c('accent-text', ground) >= 4.5, `link text on ${ground}`);
      assert.ok(c('accent', ground) >= 3, `drawn ink on ${ground}`);
    }
  });
}
