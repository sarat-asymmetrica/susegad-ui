import test from 'node:test';
import assert from 'node:assert/strict';
import { model, getRoute, ferryAt, scaleAt, journey, journeyTime, bob, bank, kiteAt, STOPS, STOP_AT, LOOKS } from './model.js';

test('step absent: the ferry waits at the first stop, whatever the time', () => {
  for (const t of [0, 5, 60, 3600]) assert.equal(model({ time: t, seed: 1, register: 'warm' }).target, 1);
});

test('step set: the ferry goes to that stop, clamped to 1..4', () => {
  assert.equal(model({ seed: 1, params: { step: 3 } }).target, 3);
  assert.equal(model({ seed: 1, params: { step: 9 } }).target, 4);
  assert.equal(model({ seed: 1, params: { step: 0 } }).target, 1);
});

test('no clock drives the stops: the target never depends on time', () => {
  const a = model({ time: 1, seed: 1, register: 'playful', params: { step: 2 } });
  const b = model({ time: 99, seed: 1, register: 'playful', params: { step: 2 } });
  assert.equal(a.target, b.target);
});

test('the route passes through all four stops, in order', () => {
  const R = getRoute();
  for (let i = 0; i < STOPS; i++) {
    const f = ferryAt(i);
    assert.ok(Math.hypot(f.x - STOP_AT[i].x, f.y - STOP_AT[i].y) < 3, `stop ${i + 1} at ${f.x.toFixed(1)}, ${f.y.toFixed(1)}`);
  }
  for (let i = 1; i < STOPS; i++) assert.ok(R.stopAt[i] > R.stopAt[i - 1]);
});

test('the ferry grows as it comes toward you', () => {
  let prev = 0;
  for (let u = 0; u <= 3; u += 0.25) { const s = ferryAt(u).s; assert.ok(s >= prev - 1e-9, `scale fell at ${u}`); prev = s; }
  assert.ok(ferryAt(0).s < 0.6 && ferryAt(3).s > 0.95);
  assert.equal(scaleAt(-100), scaleAt(0));
});

test('journey: starts where it was, ends where it is going, and eases in between', () => {
  assert.equal(journey(0, 2, 0, 4), 0);
  assert.equal(journey(0, 2, 4, 4), 2);
  assert.equal(journey(0, 2, 99, 4), 2);
  const early = journey(0, 2, 0.4, 4), mid = journey(0, 2, 2, 4);
  assert.ok(early < 0.1 * 2 && Math.abs(mid - 1) < 1e-9);
});

test('journeyTime: quiet jumps; longer journeys take longer, up to a cap', () => {
  assert.equal(journeyTime(0, 3, 'quiet'), 0);
  assert.ok(journeyTime(0, 1, 'warm') < journeyTime(0, 2, 'warm'));
  assert.equal(journeyTime(0, 3, 'warm'), journeyTime(0, 2.2, 'warm'));
  assert.ok(journeyTime(0, 1, 'playful') < journeyTime(0, 1, 'warm'));
});

test('bob: on twos, small, and nothing at all in quiet', () => {
  assert.deepEqual(bob(12.3, 0), bob(0, 0));
  const a = bob(1.0, 7), b = bob(1.1, 7);
  assert.deepEqual(a, b, 'the same drawing within one step of the boil');
  for (let t = 0; t < 20; t += 0.37) { const q = bob(t, 12); assert.ok(Math.abs(q.dy) < 3 && Math.abs(q.roll) < 0.02); }
});

test('bank: the same seed draws the same far bank; palms stand on it', () => {
  assert.deepEqual(bank(4), bank(4));
  assert.ok(bank(4).palms.length > 10);
  assert.notDeepEqual(bank(4).palms[0], bank(5).palms[0]);
});

test('kite: only in playful, and it stays over the river', () => {
  assert.equal(model({ time: 3, seed: 1, register: 'warm' }).kite, null);
  const k = bank(1).kite;
  for (let t = 0; t < 60; t += 1.3) { const p = kiteAt(k, t); assert.ok(p.y > 20 && p.y < 200 && p.x > 300 && p.x < 1100); }
  assert.ok(LOOKS.playful.kite && !LOOKS.quiet.kite);
});

test('quiet is settled; warm and playful keep the water moving', () => {
  assert.equal(model({ seed: 1, register: 'quiet' }).settled, true);
  assert.equal(model({ seed: 1, register: 'warm' }).settled, false);
});
