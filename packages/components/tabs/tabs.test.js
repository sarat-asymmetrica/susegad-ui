import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveIndex, isTabsKey, underlineRect, beadAt } from './tabs.core.js';

// ── the APG keyboard model, automatic activation ────────────────────────────

test('ArrowRight moves forward and wraps from the last tab to the first', () => {
  assert.equal(moveIndex(0, 'ArrowRight', 3), 1);
  assert.equal(moveIndex(1, 'ArrowRight', 3), 2);
  assert.equal(moveIndex(2, 'ArrowRight', 3), 0);
});

test('ArrowLeft moves back and wraps from the first tab to the last', () => {
  assert.equal(moveIndex(2, 'ArrowLeft', 3), 1);
  assert.equal(moveIndex(0, 'ArrowLeft', 3), 2);
});

test('Home and End jump to the first and last tab from anywhere', () => {
  for (const i of [0, 1, 2]) {
    assert.equal(moveIndex(i, 'Home', 3), 0);
    assert.equal(moveIndex(i, 'End', 3), 2);
  }
});

test('a key the tablist does not use leaves the index alone', () => {
  for (const key of ['Tab', 'Escape', ' ', 'Enter', 'ArrowUp', 'ArrowDown']) assert.equal(moveIndex(1, key, 3), 1);
});

test('with one tab, the arrows are a no-op (nowhere else to wrap to)', () => {
  assert.equal(moveIndex(0, 'ArrowRight', 1), 0);
  assert.equal(moveIndex(0, 'ArrowLeft', 1), 0);
});

test('vertical orientation reads Up and Down instead of Left and Right', () => {
  assert.equal(moveIndex(0, 'ArrowDown', 3, { orientation: 'vertical' }), 1);
  assert.equal(moveIndex(0, 'ArrowUp', 3, { orientation: 'vertical' }), 2);
  assert.equal(moveIndex(0, 'ArrowRight', 3, { orientation: 'vertical' }), 0, 'the horizontal keys do nothing here');
});

test('isTabsKey names exactly the keys moveIndex acts on, for the given orientation', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) assert.ok(isTabsKey(key), key);
  for (const key of ['ArrowUp', 'ArrowDown', 'Tab', 'Enter', ' ', 'Escape']) assert.ok(!isTabsKey(key), key);
  assert.ok(isTabsKey('ArrowUp', 'vertical'));
  assert.ok(!isTabsKey('ArrowLeft', 'vertical'));
});

// ── the travelling underline's geometry ─────────────────────────────────────

const RECTS = [{ left: 0, width: 40 }, { left: 44, width: 60 }, { left: 108, width: 30 }];

test('underlineRect reads the active tab\'s own box', () => {
  assert.deepEqual(underlineRect(RECTS, 1), { left: 44, width: 60 });
  assert.deepEqual(underlineRect(RECTS, 2), { left: 108, width: 30 });
});

test('underlineRect is null off the end, so a skin can shrink to width 0 rather than throw', () => {
  assert.equal(underlineRect(RECTS, -1), null);
  assert.equal(underlineRect(RECTS, 9), null);
  assert.equal(underlineRect([], 0), null);
});

test('beadAt centres on the box, and is null with none', () => {
  assert.equal(beadAt({ left: 44, width: 60 }), 74);
  assert.equal(beadAt(null), null);
});
