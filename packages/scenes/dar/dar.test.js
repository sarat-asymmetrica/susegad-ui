import test from 'node:test';
import assert from 'node:assert/strict';
import { model, arrival, swingAngle, boltAt, weather, HOOK, ARRIVE, SWING, BOLTING, REST, DOOR, WINDOW } from './model.js';

test('the key is out of sight at first, on its way in, then on the hook', () => {
  assert.equal(model({ time: 0 }).key.visible, false);
  const mid = model({ time: (ARRIVE.start + ARRIVE.end) / 2 }).key;
  assert.ok(mid.visible && !mid.onHook);
  const on = model({ time: ARRIVE.end + 0.01 }).key;
  assert.ok(on.onHook && on.x === HOOK.x && on.y === HOOK.y);
});

test('arrival ends exactly at the hook, tilted as far as the swing begins: no jump', () => {
  const end = arrival(1);
  assert.ok(Math.abs(end.x - HOOK.x) < 1e-9 && Math.abs(end.y - HOOK.y) < 1e-9);
  assert.ok(Math.abs(end.angle - swingAngle(ARRIVE.end)) < 1e-9);
});

test('the swing dies away: smaller and smaller, and nearly still before the rest', () => {
  const peaks = [];
  for (let k = 0; k < 5; k++) peaks.push(Math.abs(swingAngle(ARRIVE.end + (k * Math.PI) / SWING.omega)));
  for (let k = 1; k < peaks.length; k++) assert.ok(peaks[k] < peaks[k - 1]);
  assert.ok(Math.abs(swingAngle(REST - 0.01)) < 0.02, `at rest time: ${swingAngle(REST - 0.01)}`);
});

test('a push swings the key away from the hand, then it settles again', () => {
  const t0 = 20, right = swingAngle(t0 + 0.3, [{ t: t0, dir: 1 }]), left = swingAngle(t0 + 0.3, [{ t: t0, dir: -1 }]);
  assert.ok(right > 0 && left < 0);
  assert.ok(Math.abs(swingAngle(t0 + 12, [{ t: t0, dir: 1 }])) < 0.01);
});

test('the bolt slides home once, after the key has all but settled', () => {
  assert.equal(boltAt(BOLTING.start - 0.01), 0);
  assert.equal(boltAt(BOLTING.end + 0.01), 1);
  assert.ok(Math.abs(swingAngle(BOLTING.start)) < 0.05, 'the key is nearly still before the bolt moves');
});

test('a toggle draws the bolt back; another sends it home again', () => {
  assert.equal(boltAt(30, [20]), 0);
  assert.equal(boltAt(30, [20, 25]), 1);
  const half = boltAt(20.2, [20]);
  assert.ok(half > 0 && half < 1);
});

test('warm and quiet settle: the element stops drawing once the bolt is home', () => {
  assert.equal(model({ time: REST + 0.1, register: 'warm' }).settled, true);
  assert.equal(model({ time: 0, register: 'quiet' }).settled, true);
  assert.equal(model({ time: REST + 0.1, register: 'playful' }).settled, false, 'playful stays awake for a push');
});

test('the still: key at rest on its hook, bolt home', () => {
  const s = model({ time: 1e6, register: 'warm' });
  assert.ok(s.key.onHook && s.key.angle === 0 && s.bolt === 1);
});

test('weather: seeded, and never over the door or the window', () => {
  assert.deepEqual(weather(3), weather(3));
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9]) for (const p of weather(seed).patches) {
    const overDoor = p.x + p.r > DOOR.x0 - DOOR.frame && p.x - p.r < DOOR.x1 + DOOR.frame && p.y + p.r > DOOR.top - DOOR.lintel;
    const overWindow = p.x + p.r > WINDOW.x0 - 90 && p.x - p.r < WINDOW.x1 + 90 && p.y + p.r > WINDOW.top && p.y - p.r < WINDOW.bottom;
    assert.ok(!overDoor && !overWindow, `seed ${seed}: patch at ${p.x.toFixed(0)}, ${p.y.toFixed(0)}`);
  }
});
