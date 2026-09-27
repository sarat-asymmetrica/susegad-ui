import test from 'node:test';
import assert from 'node:assert/strict';
import { progressState, STRINGS } from './progress.js';
import { kolamArt } from './skins/warm.js';
import { levelY, halfWidth, wisp, GLASS, sloshFrames } from './skins/playful.js';

test('state: fraction, percent and words', () => {
  assert.deepEqual(
    (({ fraction, percent, done, text }) => ({ fraction, percent, done, text }))(progressState({ value: 0.4, max: 1 })),
    { fraction: 0.4, percent: 40, done: false, text: '40%' },
  );
  assert.equal(progressState({ value: 60, max: 100 }).percent, 60, 'any max');
  assert.equal(progressState({ value: 0.999, max: 1 }).percent, 99, 'never rounds up to done');
  assert.equal(progressState({ value: 1.5, max: 1 }).fraction, 1, 'clamped');
  assert.equal(progressState({ value: -1 }).fraction, 0);
  assert.equal(progressState({ value: 1, max: 0 }).fraction, 1, 'a zero max is read as 1');
  const done = progressState({ value: 1, register: 'quiet' });
  assert.ok(done.done); assert.equal(done.text, STRINGS.done.quiet);
});

test('indeterminate says what is happening, never a number', () => {
  for (const register of ['quiet', 'warm', 'playful']) {
    const s = progressState({ determinate: false, value: 0.7, register });
    assert.equal(s.fraction, null); assert.equal(s.percent, null); assert.equal(s.done, false);
    assert.equal(s.text, STRINGS.working[register]);
  }
});

test('copy: sentence case, no em dashes', () => {
  for (const group of [STRINGS.working, STRINGS.done]) for (const v of Object.values(group)) {
    assert.ok(!v.includes('\u2014')); assert.equal(v[0], v[0].toUpperCase());
  }
});

test('warm: the kolam art is one closed line with every dot', () => {
  const a = kolamArt();
  assert.equal((a.d.match(/M/g) || []).length, 1, 'one unbroken line');
  assert.ok(a.d.endsWith('Z'));
  assert.equal(a.dots.length, 13);
  assert.deepEqual(kolamArt(), a, 'deterministic');
});

test('playful: the tea level rises with the value and an empty glass is empty', () => {
  let prev = Infinity;
  for (let f = 0.01; f <= 1; f += 0.01) { const y = levelY(f); assert.ok(y < prev); prev = y; }
  assert.ok(levelY(0) > GLASS.bottom, 'at 0 the tea is below the glass, out of sight');
  assert.ok(levelY(1) > GLASS.top, 'full stays inside the rim');
  assert.ok(halfWidth(GLASS.top) > halfWidth(GLASS.bottom), 'a tumbler narrows to its base');
  assert.match(wisp(1), /^M[\d. L-]+$/);
});

test('playful: the slosh never shows more tea than the value', () => {
  for (const [from, to] of [[0, 1], [0.9, 1], [0.99, 1], [0.2, 0.6], [0.6, 0.2], [0, 0.05]]) {
    const frames = sloshFrames(from, to);
    const top = levelY(to);
    // frames after the start: never above the value's level (smaller y would be more tea)
    for (const [y] of frames.slice(1)) assert.ok(y >= top - 1e-9, `${from} to ${to}: y ${y} vs ${top}`);
    assert.equal(frames.at(-1)[0], top, 'it settles exactly on the value');
  }
});
