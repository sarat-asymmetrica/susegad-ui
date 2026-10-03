import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp01, progressFromRect, isNearViewport } from './scroll-section.core.js';

test('clamp01 holds to 0..1', () => {
  assert.equal(clamp01(-3), 0);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(clamp01(9), 1);
});

test('progress is 0 while the section is still well below the viewport', () => {
  assert.equal(progressFromRect({ top: 2000, height: 600 }, 800), 0);
});

test('progress reaches 1 once the section has fully passed', () => {
  assert.equal(progressFromRect({ top: -2000, height: 600 }, 800), 1);
});

test('progress is exactly 0.5 at the point the formula defines as the midpoint', () => {
  // Ghat's own shape (A7: checked against the ported source, not assumed):
  // p = (vh - top) / (vh*ease + height*ease). Solving for p = 0.5 at
  // vh=800, height=600, ease=0.55 gives top = vh - 0.5*span = 415.
  const p = progressFromRect({ top: 415, height: 600 }, 800);
  assert.ok(Math.abs(p - 0.5) < 1e-9, p);
});

test('a section already mostly on screen (well within the viewport) reads well past its own midpoint', () => {
  // top 100, height 600, viewport 800: the section spans 100..700, almost
  // entirely visible already, so the reveal is most of the way done, not
  // "half": this is a reveal-progress number, not a geometric centre.
  const p = progressFromRect({ top: 100, height: 600 }, 800);
  assert.ok(p > 0.85, p);
});

test('progress increases monotonically as the section scrolls up through the viewport', () => {
  let last = -1;
  for (let top = 1600; top >= -1600; top -= 40) {
    const p = progressFromRect({ top, height: 500 }, 800);
    assert.ok(p >= last - 1e-9, `top ${top}: ${p} < ${last}`);
    last = p;
  }
});

test('a taller section takes a proportionally wider scroll span to cross the same easing zone', () => {
  const short = progressFromRect({ top: 0, height: 200 }, 800);
  const tall = progressFromRect({ top: 0, height: 1600 }, 800);
  assert.ok(tall < short, `tall ${tall} should trail short ${short} at the same top`);
});

test('never reports a value outside 0..1, across a wide sweep of positions and sizes', () => {
  for (let top = -5000; top <= 5000; top += 250) {
    for (const height of [50, 400, 900, 3000]) {
      const p = progressFromRect({ top, height }, 800);
      assert.ok(p >= 0 && p <= 1, `top ${top} height ${height}: ${p}`);
    }
  }
});

// ── the off-screen gate ─────────────────────────────────────────────────

test('isNearViewport is true when the section is on screen', () => {
  assert.ok(isNearViewport({ top: 100, bottom: 500 }, 800));
});

test('isNearViewport is true just outside the viewport, within the slack margin', () => {
  assert.ok(isNearViewport({ top: 900, bottom: 1200 }, 800, 0.5)); // 0.5 * 800 = 400px slack
});

test('isNearViewport is false well outside the viewport', () => {
  assert.ok(!isNearViewport({ top: 5000, bottom: 5400 }, 800, 0.5));
  assert.ok(!isNearViewport({ top: -5400, bottom: -5000 }, 800, 0.5));
});
