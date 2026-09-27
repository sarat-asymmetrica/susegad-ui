import test from 'node:test';
import assert from 'node:assert/strict';
import { SPEAKER, pulse, waveAnimation } from './sound-switch.core.js';

test('core: the speaker and its arcs are real path data, and the two arcs differ', () => {
  assert.ok(SPEAKER.body.startsWith('M'));
  assert.equal(SPEAKER.arcs.length, 2);
  assert.notEqual(SPEAKER.arcs[0], SPEAKER.arcs[1]);
  assert.ok(SPEAKER.slash.startsWith('M'));
});

test('pulse: always a small breath around 0.72..1.0, and not the same value forever', () => {
  const values = Array.from({ length: 20 }, (_, i) => pulse(i * 0.3));
  for (const v of values) assert.ok(v >= 0.4 && v <= 1.05, `pulse in range: ${v}`);
  assert.ok(new Set(values).size > 1, 'the pulse actually varies over time');
});

test('pulse: two different seeds diverge (switches on the same page do not breathe in step)', () => {
  const a = Array.from({ length: 8 }, (_, i) => pulse(i * 0.3, 'a'));
  const b = Array.from({ length: 8 }, (_, i) => pulse(i * 0.3, 'b'));
  assert.notDeepEqual(a, b);
});

test('waveAnimation: null when off, in quiet motion (still/state), and returns frames only when on and moving', () => {
  assert.equal(waveAnimation('full', false, 's'), null, 'off: no animation');
  assert.equal(waveAnimation('still', true, 's'), null, 'reduced motion: no animation');
  assert.equal(waveAnimation('state', true, 's'), null, 'quiet: no animation');
  const a = waveAnimation('ambient', true, 's');
  assert.ok(a && a.frames.length > 1 && a.timing.iterations === Infinity);
});

test('waveAnimation: loops without a jump (first and last frame match)', () => {
  const a = waveAnimation('full', true, 'loop-check');
  assert.deepEqual(a.frames.at(0), a.frames.at(-1));
});
