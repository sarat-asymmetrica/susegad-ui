import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loop } from '../index.js';

/** A fake frame clock: step(ms) advances time and fires the pending frame. */
function fakeRaf() {
  let now = 1000, cb = null, id = 0;
  return {
    raf: f => { cb = f; return ++id; },
    caf: () => { cb = null; },
    step(ms) { now += ms; const f = cb; cb = null; f?.(now); },
    get pending() { return !!cb; },
  };
}
const media = reduce => q => ({ matches: reduce && q.includes('reduce') });

test('loop runs in Node with an injected clock', () => {
  const clk = fakeRaf(), calls = [];
  const lp = loop((t, dt) => calls.push([t, dt]), { raf: clk.raf, caf: clk.caf, matchMedia: media(false) });
  assert.equal(lp.reduced, false);
  assert.equal(lp.playing, false);
  lp.play();
  assert.equal(lp.playing, true);
  clk.step(16); clk.step(20); clk.step(500);
  assert.equal(calls.length, 3);
  assert.ok(Math.abs(calls[0][1] - 1 / 60) < 1e-12, 'first frame assumes 1/60');
  assert.ok(Math.abs(calls[1][1] - 0.02) < 1e-12);
  assert.ok(Math.abs(calls[2][1] - 0.1) < 1e-12, 'long gaps clamp to 0.1 s');
  lp.pause();
  assert.equal(clk.pending, false);
  assert.equal(lp.playing, false);
});

test('fps limits drawing while time flows', () => {
  const clk = fakeRaf(), calls = [];
  const lp = loop((t, dt) => calls.push([t, dt]), { fps: 10, raf: clk.raf, caf: clk.caf, matchMedia: media(false) });
  lp.play();
  for (let i = 0; i < 60; i++) clk.step(1000 / 60);
  assert.ok(calls.length >= 9 && calls.length <= 11, `${calls.length} draws`);
  for (const [, dt] of calls.slice(1)) assert.ok(dt >= 0.1 - 1e-9 && dt < 0.12);
});

test('seek and redraw draw once with dt = 0; reduced motion is read from matchMedia', () => {
  const calls = [];
  const lp = loop((t, dt) => calls.push([t, dt]), { matchMedia: media(true), raf: () => 0, caf: () => {} });
  assert.equal(lp.reduced, true);
  lp.seek(4.5);
  lp.redraw();
  assert.deepEqual(calls, [[4.5, 0], [4.5, 0]]);
  assert.equal(lp.time, 4.5);
});

test('without matchMedia, motion is not reduced', () => {
  const lp = loop(() => {}, { matchMedia: undefined, raf: () => 0, caf: () => {} });
  assert.equal(lp.reduced, false);
});
