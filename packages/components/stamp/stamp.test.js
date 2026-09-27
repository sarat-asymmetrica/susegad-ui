import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scriptOf, stampPose, inkMask, coverage, landing, toneOf, TONES } from './stamp.core.js';

test('scriptOf tells Latin, Devanagari and Kannada apart, including Konkani in Romi', () => {
  assert.equal(scriptOf('Held'), 'latin');
  assert.equal(scriptOf('Paus ailo'), 'latin');
  assert.equal(scriptOf('राखून ठेवले'), 'devanagari');
  assert.equal(scriptOf('ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ'), 'kannada');
  assert.equal(scriptOf('12 ऑक्टो.'), 'devanagari', 'digits do not count');
  assert.equal(scriptOf('₹4,50,000'), 'latin', 'no letters: default to Latin');
});

test('toneOf falls back to accent', () => {
  for (const t of TONES) assert.equal(toneOf(t), t);
  assert.equal(toneOf('purple'), 'accent');
  assert.equal(toneOf(null), 'accent');
});

test('the pose is square in quiet, tilted a little in warm, more in playful, and fixed by the seed', () => {
  assert.deepEqual(stampPose('held', 'quiet'), { rotate: 0, ghost: { x: 0, y: 0 } });
  assert.deepEqual(stampPose('held', 'warm'), stampPose('held', 'warm'));
  const warm = [], playful = [];
  for (let i = 0; i < 200; i++) {
    warm.push(Math.abs(stampPose(i, 'warm').rotate));
    playful.push(Math.abs(stampPose(i, 'playful').rotate));
  }
  assert.ok(Math.min(...warm) >= 1.5 && Math.max(...warm) <= 4);
  assert.ok(Math.min(...playful) >= 3 && Math.max(...playful) <= 7);
  assert.notDeepEqual(stampPose('a', 'warm'), stampPose('b', 'warm'));
});

test('the ink mask is deterministic for a seed and size, and differs between seeds', () => {
  const a = inkMask('held', 240, 120), b = inkMask('held', 240, 120), c = inkMask('received', 240, 120);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 240 * 120);
});

test('the texture starves the ink without eating the word', () => {
  for (const seed of ['held', 'received', 'paid', 7, 42]) {
    const warm = coverage(inkMask(seed, 240, 120));
    const playful = coverage(inkMask(seed, 240, 120, { amount: 1.25 }));
    // Enough missing to read as a print, enough left to read the word.
    assert.ok(warm > 0.7 && warm < 0.97, `warm coverage ${warm.toFixed(3)}`);
    assert.ok(playful < warm && playful > 0.6, `playful coverage ${playful.toFixed(3)}`);
  }
});

test('the mask scales with device pixels and keeps its character', () => {
  const one = coverage(inkMask('held', 200, 100, { scale: 1 }));
  const two = coverage(inkMask('held', 400, 200, { scale: 2 }));
  assert.ok(Math.abs(one - two) < 0.06, `${one.toFixed(3)} vs ${two.toFixed(3)}`);
});

test('landing: none under reduced motion, a quick fade in quiet, a press in warm, press and spread in playful', () => {
  assert.equal(landing('still', -3), null);
  const q = landing('state');
  assert.ok(q.timing.duration < 200, 'quiet stays under 200ms');
  assert.ok(!('transform' in q.frames[0]), 'quiet does not move');
  const w = landing('ambient', -3);
  assert.match(w.frames.at(-1).transform, /rotate\(-3deg\) scale\(1\)/, 'warm ends exactly on the resting pose');
  const p = landing('full', -5);
  assert.match(p.frames.at(-1).transform, /rotate\(-5deg\) scale\(1\)/);
  assert.ok(p.frames.some(f => /scale\(0\.9/.test(f.transform)), 'playful presses past flat');
  assert.ok(p.spread && p.spread.frames.at(-1).opacity === 0, 'the spread fades away');
});
