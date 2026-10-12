import test from 'node:test';
import assert from 'node:assert/strict';
import { track, MOVE_KEYS, installInputModality } from './input-modality.js';

test('modality: a moving key sets "key", and letting go sets "pointer"', () => {
  for (const k of MOVE_KEYS) {
    const held = new Set();
    assert.equal(track(held, 'keydown', k), 'key', k);
    assert.equal(track(held, 'keyup', k), 'pointer', k);
  }
});

test('modality: releasing one moving key while another is held keeps "key"', () => {
  const held = new Set();
  track(held, 'keydown', 'ArrowRight');
  track(held, 'keydown', 'ArrowDown');
  assert.equal(track(held, 'keyup', 'ArrowDown'), 'key');
  assert.equal(track(held, 'keyup', 'ArrowRight'), 'pointer');
});

test('modality: Space, Enter, Tab and letters leave it alone, so a single press still animates', () => {
  for (const k of [' ', 'Enter', 'Tab', 'a', 'Escape']) {
    assert.equal(track(new Set(), 'keydown', k), null, k);
    assert.equal(track(new Set(['ArrowLeft']), 'keyup', k), null, k);
  }
});

test('modality: a pointer press or a blur sets "pointer" and forgets held keys', () => {
  const held = new Set(['ArrowLeft']);
  assert.equal(track(held, 'pointerdown'), 'pointer');
  assert.equal(held.size, 0);
  assert.equal(track(new Set(['Home']), 'blur'), 'pointer');
  assert.equal(track(new Set(), 'click'), null);
});

test('modality: with no document (Node) it installs nothing and throws nothing', () => {
  assert.equal(installInputModality(undefined), false);
});
