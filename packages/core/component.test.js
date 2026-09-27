import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSkin, componentMotion, SgElement, defineComponent } from './component.js';

test('pickSkin falls back to a quieter register', () => {
  const q = () => 'q', w = () => 'w', p = () => 'p';
  assert.equal(pickSkin({ quiet: q, warm: w, playful: p }, 'playful'), p);
  assert.equal(pickSkin({ quiet: q, warm: w }, 'playful'), w);
  assert.equal(pickSkin({ quiet: q }, 'warm'), q);
  assert.equal(pickSkin({}, 'warm'), null);
  assert.equal(pickSkin({ warm: w }, 'quiet'), null, 'never louder than asked');
});

test('component motion: reduced motion wins, quiet is state-only', () => {
  assert.equal(componentMotion({ register: 'quiet', reducedMotion: false }), 'state');
  assert.equal(componentMotion({ register: 'warm', reducedMotion: false }), 'ambient');
  assert.equal(componentMotion({ register: 'playful', reducedMotion: false }), 'full');
  assert.equal(componentMotion({ register: 'playful', reducedMotion: true }), 'still');
});

test('SgElement and defineComponent load in Node', () => {
  class X extends SgElement { static native = 'progress'; }
  assert.equal(defineComponent('sg-x', X), X);
  assert.deepEqual(new X().state(), {});
  assert.deepEqual(SgElement.observedAttributes, ['register']);
});
