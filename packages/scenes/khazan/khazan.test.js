import test from 'node:test';
import assert from 'node:assert/strict';
import khazan from './index.js';
import { model, neighbours, kuramoto, localOrder, order, flash, swarm, scatter, wavePhases, heldPhases, runSwarm, LOOKS, WATER_Y } from './model.js';
import { meta } from './meta.js';
import { TAU } from '../../engine/index.js';

test('neighbours are found both ways and only within the radius', () => {
  const xs = [0, 10, 200], ys = [0, 0, 0], nb = neighbours(xs, ys, 50);
  assert.deepEqual([...nb[0]], [1]); assert.deepEqual([...nb[1]], [0]); assert.deepEqual([...nb[2]], []);
});

test('the swarm: about four hundred fireflies in the canopies, a few free wanderers', () => {
  const sw = swarm();
  assert.ok(sw.n > 380 && sw.n < 480, `${sw.n}`);
  assert.equal(sw.free.filter(Boolean).length, 34);
  for (let i = 0; i < sw.n; i++) if (sw.free[i]) assert.equal(sw.nbrs[i].length, 0, 'wanderers keep their own time');
  assert.ok(sw.ys.every(y => y < WATER_Y + 61));
});

test('Kuramoto coupling: from scattered blinking the bank falls into step', () => {
  const sw = swarm(), start = scatter(1, sw.n).phase;
  const before = localOrder(start, sw.nbrs), after = localOrder(runSwarm(1, 1800), sw.nbrs);
  assert.ok(before < 0.35, `starts out of step: ${before}`);
  assert.ok(after > 0.8, `in step after 30 s: ${after}`);
});

test('the same seed falls into step the same way', () => {
  assert.deepEqual(Array.from(runSwarm(3, 300)), Array.from(runSwarm(3, 300)));
  assert.notDeepEqual(Array.from(runSwarm(3, 300)), Array.from(runSwarm(4, 300)));
});

test('a single uncoupled oscillator just turns at its own rate', () => {
  const p = new Float32Array([0]), w = new Float32Array([1]);
  kuramoto(p, w, [new Int32Array(0)], 0.95, 0.5);
  assert.ok(Math.abs(p[0] - 0.5) < 1e-6);
  assert.ok(order(new Float32Array([1, 1, 1])) > 0.999);
});

test('progress: the more work done, the more in step, and time never changes how much', () => {
  const sw = swarm();
  let prev = -1;
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    const r = localOrder(heldPhases(2, p, 0), sw.nbrs);
    assert.ok(r > prev, `progress ${p}: ${r}`); prev = r;
  }
  const a = localOrder(heldPhases(2, 0.4, 0), sw.nbrs), b = localOrder(heldPhases(2, 0.4, 37.5), sw.nbrs);
  assert.ok(Math.abs(a - b) < 1e-4, 'a shared beat moves everyone together');
  assert.equal(khazan.status({ progress: 0.4 }), '40% done');
  assert.equal(khazan.status({ progress: null }), '');
  assert.equal(model({ params: { progress: 2 } }).progress, 1);
});

test('the flash: a quick rise through zero, a slow afterglow, never quite dark', () => {
  assert.ok(flash(0) > 0.95);
  assert.ok(flash(TAU - 0.07) < flash(0));
  assert.ok(flash(0.5) > flash(1.5));
  assert.ok(flash(3) >= 0.03);
});

test('the still is a wave, the same every time', () => {
  const sw = swarm();
  assert.deepEqual(wavePhases(sw.xs, sw.ys), wavePhases(sw.xs, sw.ys));
  assert.ok(localOrder(wavePhases(sw.xs, sw.ys), sw.nbrs) > 0.9);
});

test('registers and words', () => {
  assert.equal(LOOKS.quiet.pace, 0); assert.ok(!LOOKS.warm.hand && LOOKS.playful.hand);
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
});
