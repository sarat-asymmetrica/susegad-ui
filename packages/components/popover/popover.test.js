import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { placement } from './popover.core.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'popover.css'), 'utf8');
const viewport = { width: 1024, height: 768 };

test('placement: plenty of room below, the panel goes below', () => {
  const t = { left: 100, top: 200, bottom: 220, width: 80 };
  const p = placement(t, { width: 200, height: 120 }, viewport);
  assert.equal(p.above, false);
});

test('placement: no room below but room above, the panel flips above', () => {
  const t = { left: 100, top: 700, bottom: 720, width: 80 };
  const p = placement(t, { width: 200, height: 120 }, viewport);
  assert.equal(p.above, true);
});

test('placement: keeps the panel inside the viewport horizontally, with a margin', () => {
  const t = { left: 980, top: 200, bottom: 220, width: 80 };
  const p = placement(t, { width: 200, height: 120 }, viewport, { margin: 8 });
  assert.ok(p.left + 200 <= viewport.width - 8 + 0.001, `left ${p.left} keeps the panel on screen`);
  assert.ok(p.left >= 8);
});

test('placement: a trigger flush against the left edge never goes negative', () => {
  const t = { left: -5, top: 200, bottom: 220, width: 40 };
  const p = placement(t, { width: 200, height: 120 }, viewport);
  assert.ok(p.left >= 8);
});

test('the CSS never overrides the native popover open/close; forced colours simplify the card', () => {
  assert.match(css, /sg-popover\[hidden\]\s*\{\s*display:\s*none/);
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /::before,[\s\S]*::after[\s\S]*display:\s*none\s*!important/);
});

test('the entry animation is off under reduced motion', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*sg-popover \[popover\]:popover-open\s*\{\s*animation:\s*none/);
});

for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`contrast: ${name} ${theme}: the card's border and text read against its own background`, () => {
    const r = resolveRoles(name, theme), c = (a, b) => contrast(toRgb(r[a].hex), toRgb(r[b].hex));
    assert.ok(c('rule-strong', 'surface-raised') >= 3, 'quiet hairline');
    assert.ok(c('accent', 'surface-raised') >= 3, 'warm/playful accent border');
    assert.ok(c('text', 'surface-raised') >= 4.5, 'card text');
  });
}
