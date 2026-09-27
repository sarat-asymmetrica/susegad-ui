// Node has no window, no localStorage, no AudioContext and no document. These
// tests prove the contract that matters most without any of them: the switch
// never throws, defaults to off, and play()/haptic() are silent no-ops until
// both the switch and a gesture are true. The gesture and the audio graph
// itself need a browser; see sound-switch.check.mjs for that half.

import test from 'node:test';
import assert from 'node:assert/strict';
import { soundOn, setSoundOn, onSoundChange, play, haptic, sceneContext, _resetForTests } from './switch.js';

test.beforeEach(() => _resetForTests());

test('switch: off by default when there is no storage to read', () => {
  assert.equal(soundOn(), false);
});

test('switch: setSoundOn is remembered for the life of the module, even without storage', () => {
  setSoundOn(true);
  assert.equal(soundOn(), true);
  setSoundOn(false);
  assert.equal(soundOn(), false);
});

test('switch: onSoundChange without a document returns a no-op unsubscribe, and never throws', () => {
  const off = onSoundChange(() => {});
  assert.equal(typeof off, 'function');
  assert.doesNotThrow(() => off());
});

test('sceneContext: null with no gesture, no AudioContext, or the switch off; never throws', () => {
  assert.equal(sceneContext(), null);
  setSoundOn(true);
  assert.equal(sceneContext(), null, 'still null: no AudioContext exists in Node');
  setSoundOn(false);
  assert.doesNotThrow(() => sceneContext());
});

test('play() and haptic() never throw, with no context, no navigator and no gesture', () => {
  assert.doesNotThrow(() => play('confirm'));
  assert.doesNotThrow(() => play('confirm', { register: 'playful' }));
  assert.doesNotThrow(() => play('not-a-word'));
  assert.doesNotThrow(() => haptic('tick'));
  setSoundOn(true);
  assert.doesNotThrow(() => play('confirm'));
  assert.doesNotThrow(() => haptic('tick'));
});
