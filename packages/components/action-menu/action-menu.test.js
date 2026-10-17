import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { wrap, typeaheadIndex, placement, stampLanding, visibleBox, fitShift } from './action-menu.core.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'action-menu.css'), 'utf8');

test('wrap: steps forward and back, wrapping at both ends', () => {
  assert.equal(wrap(0, -1, 4), 3);
  assert.equal(wrap(3, 1, 4), 0);
  assert.equal(wrap(1, 1, 4), 2);
  assert.equal(wrap(0, 0, 4), 0, 'used to clamp a raw index into range');
});

test('typeaheadIndex: jumps to the next item starting with the letter, searching after "from"', () => {
  const labels = ['Profile', 'Preferences', 'Sign out', 'Payment methods'];
  assert.equal(typeaheadIndex(labels, 'p', 0), 1, 'Preferences, not Profile itself, since it starts just after "from"');
  assert.equal(typeaheadIndex(labels, 'p', 1), 3, 'wraps forward to Payment methods');
  assert.equal(typeaheadIndex(labels, 'p', 3), 0, 'wraps back around to Profile');
});

test('typeaheadIndex: no match, or an empty query, returns -1', () => {
  const labels = ['Profile', 'Sign out'];
  assert.equal(typeaheadIndex(labels, 'z', 0), -1);
  assert.equal(typeaheadIndex(labels, '', 0), -1);
  assert.equal(typeaheadIndex([], 'p', 0), -1);
});

test('typeaheadIndex: repeating the same letter cycles through every match', () => {
  const labels = ['Apple', 'Apricot', 'Banana'];
  let i = typeaheadIndex(labels, 'a', -1);
  assert.equal(i, 0);
  i = typeaheadIndex(labels, 'a', i);
  assert.equal(i, 1);
  i = typeaheadIndex(labels, 'a', i);
  assert.equal(i, 0, 'wraps back to the first match, skipping Banana');
});

test('the CSS gives the entrance and the item stagger a reduced-motion off switch', () => {
  assert.match(css, /sg-action-menu\[hidden\]\s*\{\s*display:\s*none/);
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /animation:\s*none/);
});

test('every register keeps a visible focus outline on the roving item', () => {
  assert.match(css, /\[role="menuitem"\]:focus-visible\s*\{\s*outline:/);
});

test('stampLanding: null under reduced motion and quiet-equivalent state motion, so nothing plays there', () => {
  assert.equal(stampLanding('still'), null);
  assert.equal(stampLanding('state'), null);
});

test('stampLanding: a real impression in ambient and full motion, fading fully to nothing', () => {
  for (const motion of ['ambient', 'full']) {
    const landing = stampLanding(motion);
    assert.ok(landing.timing.duration > 0);
    assert.equal(landing.frames[0].opacity, 0, 'starts invisible');
    assert.ok(landing.frames.some(f => f.opacity > 0), 'blooms partway through');
    assert.equal(landing.frames.at(-1).opacity, 0, 'fades fully, leaving no permanent mark on the text');
  }
});

test('the playful stamp sits behind its item, not over its text (z-index: -1 within the item\'s own stacking context)', () => {
  const playful = css.slice(css.indexOf('playful: a stamped list'));
  assert.match(playful, /\[role="menuitem"\]\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*0/s);
  assert.match(playful, /\.sg-action-menu-item-stamp\s*\{[^}]*z-index:\s*-1/s);
  assert.match(playful, /\.sg-action-menu-item-stamp\s*\{[^}]*pointer-events:\s*none/s);
});

for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`contrast: ${name} ${theme}: the list's border, text and the focused item's background read`, () => {
    const r = resolveRoles(name, theme), c = (a, b) => contrast(toRgb(r[a].hex), toRgb(r[b].hex));
    assert.ok(c('rule-strong', 'surface-raised') >= 3, 'the list border');
    assert.ok(c('text', 'surface-raised') >= 4.5, 'item text');
    assert.ok(c('text', 'surface-sunk') >= 4.5, 'item text on the hover/focus background');
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
