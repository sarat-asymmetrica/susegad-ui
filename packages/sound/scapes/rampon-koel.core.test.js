import test from 'node:test';
import assert from 'node:assert/strict';
import { anyVisible, bout, CALL_NOTES } from './rampon-koel.core.js';

test('anyVisible: true only when a bird is inside the visible band', () => {
  assert.equal(anyVisible([-500, 2000], 1200), false, 'both birds are out in the wrap-around margin');
  assert.equal(anyVisible([-500, 600, 2000], 1200), true, 'one bird is on screen');
  assert.equal(anyVisible([], 1200), false, 'no birds at all');
});

test('bout: n-1 gaps, each one shorter than the last (a real koel speeds up)', () => {
  const gaps = bout(3, 1.1, 0.72);
  assert.equal(gaps.length, 2);
  assert.ok(gaps[1] < gaps[0], 'the second gap is shorter than the first');
  assert.ok(gaps.every(g => g > 0));
});

test('bout: more calls means more gaps, and the shrink still holds throughout', () => {
  const gaps = bout(5);
  assert.equal(gaps.length, 4);
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] < gaps[i - 1], `gap ${i} shorter than gap ${i - 1}`);
});

test('CALL_NOTES: two rising notes, the second higher than the first', () => {
  assert.equal(CALL_NOTES.length, 2);
  assert.ok(CALL_NOTES[1] > CALL_NOTES[0]);
});
