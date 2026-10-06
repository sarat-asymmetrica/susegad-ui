import test from 'node:test';
import assert from 'node:assert/strict';
import { consentOf, pendingLine, columnsFor, hash, tilt, photoCorner } from './gallery.core.js';

// ── consent: only the written word hides a photograph ─────────────────────

test('only "pending" hides a photograph, in any lettering', () => {
  assert.equal(consentOf('pending'), 'pending');
  assert.equal(consentOf('Pending'), 'pending');
  assert.equal(consentOf(' pending '), 'pending');
});

test('"granted" shows the image', () => {
  assert.equal(consentOf('granted'), 'granted');
  assert.equal(consentOf('GRANTED'), 'granted');
});

test('no attribute is the author\'s decision, and the image shows', () => {
  assert.equal(consentOf(null), 'author');
  assert.equal(consentOf(undefined), 'author');
  assert.equal(consentOf(''), 'author');
});

test('an unknown value never hides a photograph: the element does not guess', () => {
  for (const v of ['yes', 'no', 'maybe', 'asked', 'later', 'true', '0']) {
    assert.equal(consentOf(v), 'author', v);
  }
});

// ── the count line: kind, exact, one form per number ──────────────────────

test('the count line reads "n photos, coming soon"', () => {
  assert.equal(pendingLine(1), '1 photo, coming soon');
  assert.equal(pendingLine(2), '2 photos, coming soon');
  assert.equal(pendingLine(5), '5 photos, coming soon');
});

test('a count that is not a photograph count says nothing', () => {
  assert.equal(pendingLine(0), '');
  assert.equal(pendingLine(-1), '');
  assert.equal(pendingLine(NaN), '');
  assert.equal(pendingLine(Infinity), '');
  assert.equal(pendingLine(2.4), '2 photos, coming soon', 'a count of slots is a whole number');
});

// ── the grid: columns the slots can still breathe in ──────────────────────

test('columns follow the width, then the count', () => {
  assert.equal(columnsFor(390, 6), 1);
  assert.equal(columnsFor(500, 6), 2);
  assert.equal(columnsFor(700, 6), 3);
  assert.equal(columnsFor(1000, 6), 4);
});

test('a gallery of two slots never claims four empty columns', () => {
  assert.equal(columnsFor(1200, 2), 2);
  assert.equal(columnsFor(1200, 1), 1);
  assert.equal(columnsFor(500, 1), 1);
});

test('unmeasurable things give a single column, never a crash', () => {
  assert.equal(columnsFor(0, 3), 1);
  assert.equal(columnsFor(NaN, 3), 1);
  assert.equal(columnsFor(500, 0), 1);
  assert.equal(columnsFor(500, NaN), 1);
});

// ── seeds: deterministic, so the frames are reproducible ──────────────────

test('the same seed gives the same number, every time', () => {
  assert.equal(hash('paus'), hash('paus'));
  assert.notEqual(hash('paus'), hash('chai'));
});

test('the playful tilt is a seeded half-degree', () => {
  assert.equal(tilt('paus'), tilt('paus'));
  for (const s of ['a', 'b', 'c', 'paus', 'veranda']) {
    assert.ok(Math.abs(tilt(s)) > 0.05, `${s} actually leans`);
    assert.ok(Math.abs(tilt(s)) <= 0.55, `${s} stays under half a degree`);
  }
  const signs = new Set(['a', 'b', 'c', 'paus', 'veranda', 'chai', 'toran'].map(s => Math.sign(tilt(s))));
  assert.ok(signs.has(1) && signs.has(-1), 'some lean left, some right');
});

// ── the hand-drawn photo corners ──────────────────────────────────────────

test('a corner is a path inside the frame, the same every time', () => {
  const a = photoCorner({ w: 300, h: 200, corner: 'tl', seed: 'x' });
  const b = photoCorner({ w: 300, h: 200, corner: 'tl', seed: 'x' });
  assert.equal(a, b);
  assert.match(a, /^M /);
  assert.ok(a.length > 40, 'it has shape, not a dot');
});

test('the four corners sit in the frame\'s four quarters', () => {
  const q = corner => {
    const m = photoCorner({ w: 300, h: 200, corner, seed: 'x' }).match(/-?[\d.]+/g).map(Number);
    return { x: m[0], y: m[1] };
  };
  assert.ok(q('tl').x < 150 && q('tl').y < 100);
  assert.ok(q('tr').x > 150 && q('tr').y < 100);
  assert.ok(q('br').x > 150 && q('br').y > 100);
  assert.ok(q('bl').x < 150 && q('bl').y > 100);
});

test('another seed, another corner; tiny frames still draw', () => {
  assert.notEqual(photoCorner({ w: 300, h: 200, corner: 'tl', seed: 'x' }), photoCorner({ w: 300, h: 200, corner: 'tl', seed: 'y' }));
  assert.match(photoCorner({ w: 40, h: 40, corner: 'br' }), /^M /);
});
