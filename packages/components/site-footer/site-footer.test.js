import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, yearIn, yearTo, rulePath, stampTilt } from './site-footer.core.js';

// ── the small print's year ────────────────────────────────────────────────

test('a year is found in a copyright line, a datetime, or plain text', () => {
  assert.equal(yearIn('© 2026 The Paper Boat Studio, Aldona'), 2026);
  assert.equal(yearIn('2024-11-02'), 2024);
  assert.equal(yearIn('Made in 1998, still here'), 1998);
  assert.equal(yearIn('the 2020 office'), 2020, 'a year beside a word');
});

test('things that are not years are not years', () => {
  for (const bad of ['', null, undefined, 'no date here', '26', '12345', '20261', 'phone 20255']) {
    assert.equal(yearIn(bad), null, String(bad));
  }
});

test('the clock moves a past year forward', () => {
  const r = yearTo(2024, Date.UTC(2026, 9, 3));
  assert.deepEqual(r, { year: 2026, changed: true });
  assert.equal(yearTo(2025, Date.UTC(2027, 0, 1, 0, 0, 1)).year, 2027, 'a second into the new year is the new year');
});

test('the year never rolls back, and a year written ahead keeps', () => {
  assert.deepEqual(yearTo(2026, Date.UTC(2026, 9, 3)), { year: 2026, changed: false });
  assert.deepEqual(yearTo(2027, Date.UTC(2026, 9, 3)), { year: 2027, changed: false }, 'written ahead: the author keeps it');
  assert.equal(yearTo(2099, Date.UTC(2026, 9, 3)).changed, false);
});

test('no written year, no change: the element never invents one', () => {
  for (const none of [null, undefined, NaN, 20.5, '2026', 1899, 3000]) {
    assert.deepEqual(yearTo(none, Date.UTC(2026, 9, 3)), { year: null, changed: false }, String(none));
  }
});

// ── the warm pencil rule ──────────────────────────────────────────────────

test('the rule is drawn twice, stays near the line and fits its width', () => {
  const a = rulePath(320, 'aldona');
  assert.equal(a.length, 2, 'two passes');
  for (const d of a) {
    assert.ok(d.startsWith('M'), 'a path');
    const [ys, xs] = d.slice(1).split('L').reduce(([ys, xs], p) => {
      const [x, y] = p.split(' ').map(Number); return [ys.concat(y), xs.concat(x)];
    }, [[], []]);
    assert.ok(xs[0] >= -3 && xs[xs.length - 1] <= 322, 'inside, a little over run');
    assert.ok(Math.min(...ys) > 0 && Math.max(...ys) < 8, 'near the line, never wild');
    assert.ok(xs.length > 40, 'plotted every 5 px or so');
  }
});

test('the rule is seeded: the same seed, the same line; another seed, another', () => {
  assert.deepEqual(rulePath(300, 'x'), rulePath(300, 'x'));
  assert.notDeepEqual(rulePath(300, 'x'), rulePath(300, 'y'));
  assert.deepEqual(rulePath(300, 'x', 0.8), rulePath(300, 'x'), 'the default wobble is 0.8');
});

test('a rule too short to bother with is not drawn', () => {
  assert.deepEqual(rulePath(8, 'x'), []);
  assert.deepEqual(rulePath(0, 'x'), []);
  assert.deepEqual(rulePath(-10, 'x'), []);
});

// ── the playful stamps ────────────────────────────────────────────────────

test('the stamp tilt is small, signed and seeded', () => {
  assert.equal(stampTilt('a', 0), stampTilt('a', 0));
  for (let i = 0; i < 12; i++) assert.ok(Math.abs(stampTilt('seed', i)) >= 0.6 && Math.abs(stampTilt('seed', i)) <= 2.2, `link ${i}`);
  assert.notEqual(stampTilt('a', 0), stampTilt('b', 0), 'another seed, another hand');
  const signs = new Set(Array.from({ length: 24 }, (_, i) => Math.sign(stampTilt('s', i))));
  assert.ok(signs.size === 2, 'both ways, as a hand does');
});

// ── the strings ───────────────────────────────────────────────────────────

test('the default landmark label', () => {
  assert.equal(STRINGS.label, 'Site footer');
});
