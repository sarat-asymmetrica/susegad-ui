import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { placement, hintSupported } from './tooltip.core.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'tooltip.css'), 'utf8');
const viewport = { width: 1024, height: 768 };

test('placement: plenty of room above (the usual case), the panel stays above', () => {
  const t = { left: 400, top: 300, bottom: 320, width: 80 };
  const p = placement(t, { width: 160, height: 36 }, viewport);
  assert.equal(p.above, true);
});

test('placement: no room above, the panel flips below', () => {
  const t = { left: 400, top: 10, bottom: 30, width: 80 };
  const p = placement(t, { width: 160, height: 36 }, viewport);
  assert.equal(p.above, false);
});

test('placement: centred on the trigger, clamped inside the viewport', () => {
  const t = { left: 10, top: 300, bottom: 320, width: 20 };
  const p = placement(t, { width: 200, height: 36 }, viewport, { margin: 8 });
  assert.ok(p.left >= 8, `left ${p.left} stays on screen`);
  const t2 = { left: 1000, top: 300, bottom: 320, width: 20 };
  const p2 = placement(t2, { width: 200, height: 36 }, viewport, { margin: 8 });
  assert.ok(p2.left + 200 <= viewport.width - 8 + 0.001, `left ${p2.left} keeps the right edge on screen`);
});

test('hintSupported: false without a document (Node)', () => {
  assert.equal(hintSupported(null), false);
});

test('hintSupported: false when the fake document normalises an unknown value away, as a real browser without "hint" does', () => {
  class NoHint { set popover(v) { this._p = ['auto', 'manual'].includes(v) ? v : ''; } get popover() { return this._p ?? ''; } }
  assert.equal(hintSupported({ createElement: () => new NoHint() }), false);
});

test('hintSupported: true when the fake document reads the value straight back, as a browser that understands "hint" does', () => {
  class HasHint { set popover(v) { this._p = v; } get popover() { return this._p; } }
  assert.equal(hintSupported({ createElement: () => new HasHint() }), true);
});

test('the CSS reveals the panel by opacity only (never display/visibility), so the accessible description is never hidden from assistive tech', () => {
  assert.match(css, /sg-tooltip\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /opacity:\s*0;/);
  assert.doesNotMatch(css, /\[role="tooltip"\]\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(css, /\[role="tooltip"\]\s*\{[^}]*visibility:\s*hidden/);
});

test('the no-JS reveal rule excludes the popover-enhanced state, so the two paths never fight', () => {
  assert.match(css, /:is\(:hover, :focus-within\)\s*\[role="tooltip"\]:not\(\[popover\]\)/);
});

test('reduced motion turns the fade off; forced colours give the panel a real border and hide the leader line', () => {
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /transition:\s*none/);
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /border:\s*1px solid CanvasText/);
  assert.match(forced, /::after\s*\{\s*display:\s*none/);
});

for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`contrast: ${name} ${theme}: the panel's text reads against its own background`, () => {
    const r = resolveRoles(name, theme), c = contrast(toRgb(r.surface.hex), toRgb(r.text.hex));
    assert.ok(c >= 4.5, `text ${r.text.hex} on surface ${r.surface.hex} used as the panel's own background/foreground pair`);
  });
}
