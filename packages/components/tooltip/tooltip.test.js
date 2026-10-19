import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { placement, hintSupported, visibleBox, fitShift, parseGap } from './tooltip.core.js';
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

test('visibleBox: the visual viewport, not a widened innerWidth', () => {
  const win = { visualViewport: { offsetLeft: 0, offsetTop: 0, width: 390, height: 700 }, innerWidth: 700, innerHeight: 700, document: { documentElement: { clientWidth: 390 } } };
  assert.deepEqual(visibleBox(win), { left: 0, top: 0, width: 390, height: 700 });
});

test('visibleBox: follows a pinch zoom (the visible part is offset inside the layout viewport)', () => {
  const win = { visualViewport: { offsetLeft: 120, offsetTop: 40, width: 195, height: 350 }, innerWidth: 390, innerHeight: 700 };
  assert.deepEqual(visibleBox(win), { left: 120, top: 40, width: 195, height: 350 });
});

test('visibleBox: no visual viewport, the document width stands in for a widened innerWidth', () => {
  assert.equal(visibleBox({ visualViewport: null, innerWidth: 700, innerHeight: 800, document: { documentElement: { clientWidth: 390 } } }).width, 390);
  assert.equal(visibleBox({ innerWidth: 700, innerHeight: 800 }).width, 700);
});

test('fitShift: a panel that fits is not moved', () => {
  assert.equal(fitShift({ left: 40, right: 240, width: 200 }, { left: 0, width: 390 }), 0);
});

test('fitShift: a panel past the right edge slides back to the margin', () => {
  assert.equal(fitShift({ left: 345, right: 696, width: 351 }, { left: 0, width: 390 }), 382 - 696);
  assert.equal(fitShift({ left: 39, right: 390, width: 351 }, { left: 0, width: 390 }, 8), -8);
});

test('fitShift: a panel past the left edge slides in; one wider than the room starts at the margin', () => {
  assert.equal(fitShift({ left: -30, right: 120, width: 150 }, { left: 0, width: 390 }), 38);
  assert.equal(fitShift({ left: 100, right: 500, width: 400 }, { left: 0, width: 390 }), 8 - 100);
});

test('fitShift: counts from the visible box, not from zero (a zoomed page)', () => {
  assert.equal(fitShift({ left: 100, right: 250, width: 150 }, { left: 120, width: 195 }), 28);
});

test('placement: a visible box that is offset (zoomed in) clamps inside it, not inside 0..width', () => {
  const t = { left: 130, top: 300, bottom: 320, width: 80 };
  const p = placement(t, { width: 100, height: 60 }, { left: 120, top: 40, width: 195, height: 350 }, { margin: 8 });
  assert.ok(p.left >= 128 && p.left + 100 <= 120 + 195 - 8 + 0.001, 'left ' + p.left);
});

test('parseGap: reads the token text, in px, rem and em; anything else is the stylesheet default', () => {
  assert.equal(parseGap(' 8px '), 8);
  assert.equal(parseGap('0.5rem', 16), 8);
  assert.equal(parseGap('0.5em', 20), 10);
  assert.equal(parseGap('', 16), 8);
  assert.equal(parseGap('calc(1px + 2px)'), 8);
  assert.equal(parseGap('12px', 16, 99), 12);
});

test('tooltip.css owns the gap: --sg-tooltip-gap is declared once, and the hover bridge stops at the page edge', () => {
  assert.match(css, /--sg-tooltip-gap:\s*8px/);
  assert.match(css, /--sg-bridge-l/);
});
