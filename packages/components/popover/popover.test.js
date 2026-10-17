import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { placement, visibleBox, fitShift } from './popover.core.js';
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

test('the entry is a transition from @starting-style, and is off under reduced motion', () => {
  assert.match(css, /@starting-style\s*\{\s*sg-popover \[popover\]:popover-open\s*\{\s*opacity:\s*0/);
  assert.match(css, /transition:[^;]*overlay[^;]*allow-discrete[^;]*display[^;]*allow-discrete/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*sg-popover \[popover\]\s*\{\s*transition:\s*none/);
});

test('placement is CSS anchor positioning, behind a feature test', () => {
  assert.match(css, /@supports \(anchor-name: --a\)\s*\{[^}]*position-anchor:\s*auto[^}]*top:\s*anchor\(bottom\)[^}]*position-try-fallbacks:\s*flip-block/);
});

for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`contrast: ${name} ${theme}: the card's border and text read against its own background`, () => {
    const r = resolveRoles(name, theme), c = (a, b) => contrast(toRgb(r[a].hex), toRgb(r[b].hex));
    assert.ok(c('rule-strong', 'surface-raised') >= 3, 'quiet hairline');
    assert.ok(c('accent', 'surface-raised') >= 3, 'warm/playful accent border');
    assert.ok(c('text', 'surface-raised') >= 4.5, 'card text');
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

test('fitShift: a bigger margin keeps a decoration that pokes past the corner on screen (playful uses 16)', () => {
  assert.equal(fitShift({ left: 39, right: 390, width: 351 }, { left: 0, width: 390 }, 16), -16);
});
