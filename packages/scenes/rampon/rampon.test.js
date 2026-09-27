import test from 'node:test';
import assert from 'node:assert/strict';
import { makeScene, scene, palmSway, visibleBirds, birdX, model, LOOKS, W } from './model.js';

test('makeScene: the same seed always gives the same evening (pure, deterministic)', () => {
  const a = makeScene(3), b = makeScene(3);
  assert.deepEqual(a, b);
});

test('makeScene: a different seed gives a different evening', () => {
  const a = makeScene(1), b = makeScene(2);
  assert.notEqual(a.sun.x, b.sun.x);
});

test('makeScene: two or three palms, each inside the frame at the crown', () => {
  for (const seed of [1, 2, 3, 7, 42]) {
    const S = makeScene(seed);
    assert.ok(S.palms.length === 2 || S.palms.length === 3);
    for (const p of S.palms) {
      const crownX = p.x + p.lean * p.h;
      assert.ok(crownX > 0 && crownX < W, `palm crown stays inside the frame: ${crownX}`);
    }
  }
});

test('scene(): memoised, so repeated calls with the same seed return the identical object', () => {
  assert.equal(scene(9), scene(9));
  assert.notEqual(scene(9), scene(10));
});

test('palmSway: zero wind (quiet) means zero sway, whatever the time', () => {
  const S = makeScene(1);
  for (const t of [0, 1, 5, 20]) assert.equal(palmSway(S.palms[0], t, S, 0), 0);
});

test('palmSway: with wind, it varies over time but stays small (a lean, not a fall)', () => {
  const S = makeScene(1);
  const values = [0, 1, 2, 3, 4].map(t => palmSway(S.palms[0], t, S, 1));
  assert.ok(new Set(values).size > 1, 'sway actually changes over time');
  for (const v of values) assert.ok(Math.abs(v) < 0.2, `a lean, not a fall: ${v}`);
});

test('visibleBirds: the register\'s bird factor scales how many are on screen', () => {
  const S = makeScene(1);
  assert.equal(visibleBirds(S, 0).length, 0, 'quiet: no birds in flight');
  assert.ok(visibleBirds(S, 1).length === S.birdsAll.length, 'playful: the full flock');
  assert.ok(visibleBirds(S, 0.6).length <= S.birdsAll.length);
});

test('birdX: wraps smoothly, always inside a band around the frame', () => {
  const bird = { x0: 500, v: 40 };
  for (let t = 0; t < 60; t += 3) {
    const x = birdX(bird, t);
    assert.ok(x >= -100 && x <= W + 100, `bird stays in its band: ${x} at t=${t}`);
  }
});

test('model(): quiet has no boil and no wind and no birds; playful has all three', () => {
  const quiet = model({ time: 1, seed: 1, register: 'quiet' });
  assert.equal(quiet.look.fps, 0);
  assert.equal(quiet.look.wind, 0);
  assert.equal(quiet.birds.length, 0);
  const playful = model({ time: 1, seed: 1, register: 'playful' });
  assert.ok(playful.look.fps > 0 && playful.look.wind > 0);
});

test('model(): an unknown register falls back to warm, not a crash', () => {
  const m = model({ time: 0, seed: 1, register: 'loud' });
  assert.deepEqual(m.look, LOOKS.warm);
});

test('model(): the same seed and time always give the same data (deterministic for tests and the visual-diff tool)', () => {
  const a = model({ time: 2, seed: 5, register: 'playful' });
  const b = model({ time: 2, seed: 5, register: 'playful' });
  assert.deepEqual(a, b);
});
