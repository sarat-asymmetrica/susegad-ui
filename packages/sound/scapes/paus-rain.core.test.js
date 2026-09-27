import test from 'node:test';
import assert from 'node:assert/strict';
import { voicesToTrigger, sample, voiceFor } from './paus-rain.core.js';

test('voicesToTrigger: never more than the free voices, never more than the per-frame cap, never negative', () => {
  assert.equal(voicesToTrigger(50, 5, 3), 3, 'a storm still caps at 3 a frame');
  assert.equal(voicesToTrigger(2, 5, 3), 2, 'fewer new drops than the cap: sound them all');
  assert.equal(voicesToTrigger(5, 1, 3), 1, 'the pool is nearly full: only one free voice');
  assert.equal(voicesToTrigger(5, 0, 3), 0, 'no free voices: silence, not a negative count');
  assert.equal(voicesToTrigger(-4, 5, 3), 0, 'a negative delta never triggers anything');
});

test('sample: n items spread across the array, not clustered at one end', () => {
  const arr = Array.from({ length: 10 }, (_, i) => i);
  assert.deepEqual(sample(arr, 0), []);
  assert.deepEqual(sample(arr, 20), arr, 'asking for more than there are returns them all');
  const three = sample(arr, 3);
  assert.equal(three.length, 3);
  assert.ok(three[0] < three[1] && three[1] < three[2], 'spread, not the same index repeated');
  assert.ok(three[2] - three[0] > 3, 'the sample actually spans the array');
});

test('voiceFor: pan follows x across the window, smaller drops are higher and quieter', () => {
  const W = 1200;
  const left = voiceFor({ x: 0, r: 2 }, W), right = voiceFor({ x: W, r: 2 }, W), mid = voiceFor({ x: W / 2, r: 2 }, W);
  assert.equal(left.pan, -1);
  assert.equal(right.pan, 1);
  assert.ok(Math.abs(mid.pan) < 0.05);
  const small = voiceFor({ x: 0, r: 1 }, W), big = voiceFor({ x: 0, r: 5 }, W);
  assert.ok(small.freq > big.freq, 'a smaller drop is higher pitched');
  assert.ok(small.gain < big.gain, 'a smaller drop is quieter');
});

test('voiceFor: every value stays in a sane, always-audible range', () => {
  const W = 1200;
  for (const r of [0, 1, 3, 9, 50]) {
    const v = voiceFor({ x: 600, r }, W);
    assert.ok(v.freq >= 900 && v.freq <= 2200, `freq in range: ${v.freq}`);
    assert.ok(v.gain >= 0.05 && v.gain <= 0.22, `gain in range: ${v.gain}`);
  }
});
