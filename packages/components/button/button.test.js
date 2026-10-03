import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { boilOutline, inkSpread } from './button.core.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'button.css'), 'utf8');
const nums = d => d.match(/-?[\d.]+/g).map(Number);

test('the warm outline is deterministic for a seed, and differs between two seeds', () => {
  assert.equal(boilOutline(120, 44, 'Book now'), boilOutline(120, 44, 'Book now'));
  assert.notEqual(boilOutline(120, 44, 'Book now'), boilOutline(120, 44, 'See the rooms'));
});

test('the warm outline stays close to the box it is drawn for', () => {
  const w = 140, h = 48;
  const d = boilOutline(w, h, 'x', { jitter: 2 });
  for (const n of nums(d)) assert.ok(n >= -6 && n <= Math.max(w, h) + 6, `${n} stays near the ${w}x${h} box`);
});

test('the outline is a closed path', () => {
  assert.match(boilOutline(100, 40, 'x'), /Z$/);
});

test('the ink spread plays only above quiet motion, and eases fully out', () => {
  assert.equal(inkSpread('still'), null, 'reduced motion: no spread');
  assert.equal(inkSpread('state'), null, 'quiet: no spread, the press transform is enough');
  for (const motion of ['ambient', 'full']) {
    const s = inkSpread(motion);
    assert.equal(s.frames.at(-1).opacity, 0, `${motion}: the ring fades all the way`);
    assert.ok(s.timing.duration > 0);
  }
});

test('the CSS keeps the native control whole and gives forced colours its own look', () => {
  assert.match(css, /sg-button\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /:focus-visible/);
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /\.sg-button-boil,[\s\S]*display:\s*none\s*!important/);
  assert.match(forced, /border-color:\s*ButtonText/);
  // the boil only animates while hovered or focused: never a bare infinite animation
  assert.doesNotMatch(css, /\.sg-button-boil\s*\{[^}]*animation:/);
});

// ── WCAG 1.4.3/1.4.11: the outline, focus ring and accent fill against their surfaces ──
for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`contrast: ${name} ${theme}: the hairline outline and the accent chip read`, () => {
    const r = resolveRoles(name, theme), c = (a, b) => contrast(toRgb(r[a].hex), toRgb(r[b].hex));
    for (const ground of ['surface', 'surface-raised']) {
      assert.ok(c('rule-strong', ground) >= 3, `quiet outline on ${ground}`);
      assert.ok(c('accent', ground) >= 3, `playful border on ${ground}`);
    }
    assert.ok(c('on-accent', 'accent') >= 4.5, 'text on the accent chip');
  });
}
