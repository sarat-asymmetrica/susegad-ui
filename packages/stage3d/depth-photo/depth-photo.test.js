import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coerce, defaults, PARAMS, profileFor, seaFlow, frameState, blurPx, placeOnStage } from './depth-photo.core.js';

test('coerce clamps numbers, reads strings, and drops what it cannot read', () => {
  assert.deepEqual(coerce({ focus: '0.3', dolly: 4, aperture: -1, sea: 'lots', nope: 1 }), { focus: 0.3, dolly: 1, aperture: 0 });
  assert.equal(Object.keys(defaults()).length, Object.keys(PARAMS).length);
});

test('each register allows its own motion; quiet allows none', () => {
  assert.deepEqual(profileFor('quiet'), { parallax: 0, sea: 0, swell: 0 });
  assert.equal(profileFor('warm').parallax, 0, 'warm: the pointer never moves the camera');
  assert.ok(profileFor('playful').sea > profileFor('warm').sea);
  assert.deepEqual(profileFor('unknown'), profileFor('warm'));
});

test('the sea flows faster nearer the shore and never stops inside its band', () => {
  const h = 0.334, s = 0.478;
  assert.ok(seaFlow(h, h, s) > 0);
  assert.ok(seaFlow(s, h, s) > seaFlow((h + s) / 2, h, s));
  assert.ok(seaFlow((h + s) / 2, h, s) > seaFlow(h, h, s));
  assert.equal(seaFlow(1, h, s), seaFlow(s, h, s), 'clamped beyond the shore');
});

const view = { register: 'warm', va: 390 / 844, pa: 0.75, keep: [0.46, 0.56], path: [0, -0.05, 0.3, -3] };

test('blur: the bay is sharp and the plate soft when focused far, and the other way round', () => {
  const far = frameState({ ...defaults(), focus: 0.21 }, view);
  const near = frameState({ ...defaults(), focus: 0.874 }, view);
  assert.equal(blurPx(far, 0.21, 844), 0);
  assert.ok(blurPx(far, 0.874, 844) > 8, `plate at far focus: ${blurPx(far, 0.874, 844)} px`);
  assert.equal(blurPx(near, 0.874, 844), 0);
  assert.ok(Math.abs(blurPx(near, 0.21, 844) - blurPx(far, 0.874, 844)) < 1e-9, 'the lens is symmetric');
  const quiet = frameState({ ...defaults(), focus: 0.21 }, { ...view, register: 'quiet' });
  assert.ok(blurPx(quiet, 0.874, 844) < 4, 'quiet blurs only a whisper');
});

test('the dolly brings the plate closer: it grows on screen', () => {
  const size = dolly => {
    const s = frameState({ ...defaults(), dolly }, view);
    const [x0] = placeOnStage(s, 0.293, 0.6, 0.874, 390, 844), [x1] = placeOnStage(s, 0.608, 0.6, 0.874, 390, 844);
    return x1 - x0;
  };
  assert.ok(size(1) > size(0) * 1.2, `plate ${size(0).toFixed(1)} px wide at rest, ${size(1).toFixed(1)} px after the dolly`);
});

test('playful parallax moves the plate a measured distance for a full pointer lean; warm does not', () => {
  const at = (register, pointer) => placeOnStage(frameState(defaults(), { ...view, register, pointer }), 0.466, 0.6, 0.874, 390, 844)[0];
  const travel = at('playful', [1, 0]) - at('playful', [0, 0]);
  assert.ok(Math.abs(travel) > 5 && Math.abs(travel) < 60, `playful travel ${travel.toFixed(1)} px`);
  assert.equal(at('warm', [1, 0]), at('warm', [0, 0]));
});
