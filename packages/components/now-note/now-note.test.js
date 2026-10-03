import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageInWords, isStale, daysBetween, todayIso, lean } from './now-note.core.js';
import { palettes, resolveRoles, contrast, toRgb, oklchToHex } from '../../tokens/tokens.js';

test('days between two dates, by the calendar, across a month and a year', () => {
  assert.equal(daysBetween('2026-09-24', '2026-09-27'), 3);
  assert.equal(daysBetween('2026-08-31', '2026-09-01'), 1);
  assert.equal(daysBetween('2025-12-31T23:59', '2026-01-01T00:01'), 1);
});

test('how long ago, in words', () => {
  const now = '2026-09-27';
  assert.equal(ageInWords('2026-09-27', now), 'today');
  assert.equal(ageInWords('2026-09-26', now), 'yesterday');
  assert.equal(ageInWords('2026-09-24', now), '3 days ago');
  assert.equal(ageInWords('2026-09-13', now), '2 weeks ago');
  assert.equal(ageInWords('2026-09-20', now), '7 days ago');
  assert.equal(ageInWords('2026-08-20', now), '5 weeks ago');
  assert.equal(ageInWords('2026-06-02', now), '3 months ago');
  assert.equal(ageInWords('2025-06-02', now), 'over a year ago');
  assert.equal(ageInWords('2026-10-01', now), '', 'the future says nothing');
  assert.equal(ageInWords('soon', now), '');
});

test('stale after the limit; an unreadable date counts as stale', () => {
  assert.equal(isStale('2026-09-24', '2026-09-27'), false);
  assert.equal(isStale('2026-08-13', '2026-09-27', 45), false);
  assert.equal(isStale('2026-08-12', '2026-09-27', 45), true);
  assert.equal(isStale('2026-09-20', '2026-09-27', 3), true);
  assert.equal(isStale(null, '2026-09-27'), true);
});

test('today is the reader\'s own calendar date', () => {
  assert.equal(todayIso(new Date(2026, 8, 7)), '2026-09-07');
});

test('the sticky note leans a little, never flat', () => {
  for (let i = 0; i < 100; i++) { const a = Math.abs(lean(i)); assert.ok(a >= 0.8 && a <= 2); }
});

// The sticky note keeps daylight colours (the highlighter, light) and the
// chalkboard keeps night ones (a little green over the sunk surface, dark).
const mix = (a, b, t) => {
  let dh = (b.h - a.h) % 360; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  return oklchToHex({ l: a.l + (b.l - a.l) * t, c: a.c + (b.c - a.c) * t, h: a.h + dh * t });
};
for (const name of Object.keys(palettes)) {
  test(`AA: ${name}: words on the sticky note and the chalkboard read at 4.5:1 in any theme`, () => {
    const day = resolveRoles(name, 'light'), night = resolveRoles(name, 'dark');
    const sticky = toRgb(day.selection.hex);
    for (const role of ['text', 'text-soft']) assert.ok(contrast(toRgb(day[role].hex), sticky) >= 4.5, `sticky ${role}`);
    const board = toRgb(mix(night['surface-sunk'], night.success, 0.14));
    for (const role of ['text', 'text-soft', 'accent-text']) assert.ok(contrast(toRgb(night[role].hex), board) >= 4.5, `board ${role}: ${contrast(toRgb(night[role].hex), board).toFixed(2)}`);
  });
}
