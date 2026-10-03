import test from 'node:test';
import assert from 'node:assert/strict';
import {
  model,
  scaleAngle,
  flapOpening,
  stampState,
  sortingProgress,
  makeRackData,
  W,
  H,
  REST,
  CUBBIES_COUNT,
  SCALE,
  POSTBOX,
  RACK,
} from './model.js';

test('posta model is 100% deterministic for a given seed and time', () => {
  const m1 = model({ time: 3.2, seed: 42, register: 'warm' });
  const m2 = model({ time: 3.2, seed: 42, register: 'warm' });
  assert.deepEqual(m1, m2);

  const m3 = model({ time: 6.8, seed: 99, register: 'playful' });
  const m4 = model({ time: 6.8, seed: 99, register: 'playful' });
  assert.deepEqual(m3, m4);
});

test('quiet register produces a settled hairline elevation state', () => {
  const q0 = model({ time: 0, register: 'quiet' });
  assert.equal(q0.settled, true);
  assert.equal(q0.progress, 1);
  assert.equal(q0.rack.sortedCount, CUBBIES_COUNT);
  assert.equal(q0.postbox.flap, 0);
  assert.equal(q0.scale.angle, 0);
  assert.equal(q0.scale.leftPanY, SCALE.panRestY);
  assert.equal(q0.scale.rightPanY, SCALE.panRestY);
  assert.equal(q0.manifest.stamped, true);

  const qLater = model({ time: 100, register: 'quiet' });
  assert.equal(qLater.settled, true);
});

test('warm register animates and settles once REST time is reached', () => {
  const early = model({ time: 1.0, register: 'warm' });
  assert.equal(early.settled, false);
  assert.ok(early.postbox.flap > 0, 'flap is opening for incoming letter');

  const mid = model({ time: 4.0, register: 'warm' });
  assert.equal(mid.settled, false);
  assert.ok(mid.progress > 0 && mid.progress < 1, 'progress is advancing');

  const done = model({ time: REST + 0.1, register: 'warm' });
  assert.equal(done.settled, true, 'warm settles after REST time');
  assert.equal(done.progress, 1);
  assert.equal(done.postbox.flap, 0);
  assert.equal(done.rack.sortedCount, CUBBIES_COUNT);
});

test('playful register stays awake for interactive pushes and taps', () => {
  const p = model({ time: REST + 2.0, register: 'playful' });
  assert.equal(p.settled, false, 'playful stays awake');
});

test('explicit progress param sets sorted cubbies exactly and overrides clock', () => {
  const p0 = model({ time: 5.0, params: { progress: 0 } });
  assert.equal(p0.progress, 0);
  assert.equal(p0.rack.sortedCount, 0);
  assert.equal(p0.waitingCount, CUBBIES_COUNT);

  const pHalf = model({ time: 5.0, params: { progress: 0.5 } });
  assert.equal(pHalf.progress, 0.5);
  assert.equal(pHalf.rack.sortedCount, 6);
  assert.equal(pHalf.waitingCount, 6);

  const pFull = model({ time: 1.0, params: { progress: 1 } });
  assert.equal(pFull.progress, 1);
  assert.equal(pFull.rack.sortedCount, 12);
  assert.equal(pFull.waitingCount, 0);
});

test('explicit flap param sets brass flap opening directly', () => {
  const f1 = model({ time: 0, params: { flap: 0.75 } });
  assert.equal(f1.postbox.flap, 0.75);

  const fClosed = model({ time: 1.4, params: { flap: 0 } });
  assert.equal(fClosed.postbox.flap, 0);
});

test('explicit stamped param controls rubber stamp descent and ink mark', () => {
  const s0 = model({ time: 0, params: { stamped: 0 } });
  assert.equal(s0.stamp.descent, 0);
  assert.equal(s0.stamp.inkMark, false);

  const s1 = model({ time: 0, params: { stamped: 1 } });
  assert.equal(s1.stamp.descent, 1);
  assert.equal(s1.stamp.inkMark, true);
  assert.equal(s1.manifest.stamped, true);
});

test('brass balance scale oscillation damps toward equilibrium', () => {
  const a0 = Math.abs(scaleAngle(0.6));
  const a1 = Math.abs(scaleAngle(2.5));
  const a2 = Math.abs(scaleAngle(5.5));
  assert.ok(a0 > a1, 'amplitude decreases from early swing');
  assert.ok(a1 > a2, 'amplitude continues to decay');
  assert.ok(Math.abs(scaleAngle(REST + 1)) < 0.01, 'scale is settled at rest');
});

test('letterbox flap swings open on arrival, bounces and settles', () => {
  const opening = flapOpening(1.4);
  assert.ok(opening > 0.5, 'flap lifts to receive mail');
  const settling = flapOpening(4.5);
  assert.ok(settling < 0.05, 'flap has settled down');
  assert.equal(flapOpening(6.0), 0);
});

test('seed determines cubby layout and letter variations reproducibly', () => {
  const r1 = makeRackData(7);
  const r2 = makeRackData(7);
  assert.deepEqual(r1, r2);

  const rOther = makeRackData(8);
  assert.notDeepEqual(r1.cubbies[0].bundles, rOther.cubbies[0].bundles);
});
