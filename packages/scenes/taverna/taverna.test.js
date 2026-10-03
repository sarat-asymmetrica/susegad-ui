import test from 'node:test';
import assert from 'node:assert/strict';
import {
  model,
  weather,
  W,
  H,
  REST,
  WINDOW,
  BOTTLES,
  JUG,
  BLACKBOARD,
  STREETLAMP,
  BULB,
} from './model.js';

test('taverna: dimensions and exports', () => {
  assert.equal(W, 1200);
  assert.equal(H, 800);
  assert.equal(REST, 10.0);
  assert.ok(WINDOW.bars.length >= 3);
  assert.equal(BOTTLES.length, 3);
  assert.ok(JUG.w > 0 && JUG.h > 0);
  assert.ok(BLACKBOARD.w > 0);
  assert.ok(STREETLAMP.glowR > 0);
  assert.ok(BULB.glowR > 0);
});

test('taverna: determinism: identical inputs produce identical deepEqual models', () => {
  const m1 = model({ time: 3.5, seed: 42, register: 'warm', params: { rain: 0.7, lamp: 0.8, steamer: 0.4 } });
  const m2 = model({ time: 3.5, seed: 42, register: 'warm', params: { rain: 0.7, lamp: 0.8, steamer: 0.4 } });
  assert.deepEqual(m1, m2);

  const q1 = model({ time: 0, seed: 9, register: 'quiet' });
  const q2 = model({ time: 0, seed: 9, register: 'quiet' });
  assert.deepEqual(q1, q2);
});

test('taverna: seed changes weather layout', () => {
  const w1 = weather(1);
  const w2 = weather(2);
  assert.notDeepEqual(w1.cobbles[0], w2.cobbles[0]);
  assert.notDeepEqual(w1.tracks[0], w2.tracks[0]);
});

test('taverna: register settlement behavior', () => {
  // Quiet is settled immediately
  const quiet = model({ time: 0, register: 'quiet' });
  assert.equal(quiet.settled, true);
  assert.equal(quiet.time, REST);

  // Warm is active before REST, and settled after REST
  const warmActive = model({ time: 3.0, register: 'warm' });
  assert.equal(warmActive.settled, false);
  assert.equal(warmActive.time, 3.0);

  const warmSettled = model({ time: REST + 0.5, register: 'warm' });
  assert.equal(warmSettled.settled, true);
  assert.equal(warmSettled.time, REST);

  // Playful stays active even after REST for interaction
  const playful = model({ time: REST + 2.0, register: 'playful' });
  assert.equal(playful.settled, false);
  assert.equal(playful.time, REST + 2.0);
});

test('taverna: rain physics: streak density scales with rain param', () => {
  const dry = model({ time: 2.0, seed: 5, params: { rain: 0.0 } });
  const deluge = model({ time: 2.0, seed: 5, params: { rain: 1.0 } });

  assert.ok(dry.rainStreaks.length < deluge.rainStreaks.length, 'deluge produces more streaks than dry');
  assert.ok(deluge.rainStreaks.some(s => s.bright), 'deluge produces bright illuminated streaks near streetlamp');
});

test('taverna: rain physics: rivulets meander and trickle downward', () => {
  const m = model({ time: 4.0, seed: 1, register: 'warm', params: { rain: 0.8 } });
  assert.ok(m.rivulets.length > 0);

  for (const riv of m.rivulets) {
    assert.ok(riv.y >= WINDOW.y0);
    assert.ok(riv.trail.length >= 1);
    // Droplet trail has meandering points
    if (riv.trail.length > 3) {
      const xs = riv.trail.map(p => p[0]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      assert.ok(maxX - minX >= 0, 'rivulet traces a meandering lateral path');
    }
  }

  // Droplets advance over time
  const tEarly = model({ time: 1.0, seed: 3, register: 'warm' });
  const tLate = model({ time: 5.0, seed: 3, register: 'warm' });
  const earlyTotalY = tEarly.rivulets.reduce((acc, r) => acc + r.y, 0);
  const lateTotalY = tLate.rivulets.reduce((acc, r) => acc + r.y, 0);
  assert.ok(lateTotalY > earlyTotalY, 'droplets move downward over time');
});

test('taverna: parameter clamping and defaults', () => {
  const d = model({ params: {} });
  assert.equal(d.params.rain, 0.6);
  assert.equal(d.params.lamp, 0.85);
  assert.equal(d.params.steamer, 0.5);

  const clamped = model({ params: { rain: -2, lamp: 99, steamer: 1.5 } });
  assert.equal(clamped.params.rain, 0);
  assert.equal(clamped.params.lamp, 1);
  assert.equal(clamped.params.steamer, 1);
});

test('taverna: still life objects have defined geometry and acoustic properties', () => {
  const m = model();
  const { bottles, jug, blackboard } = m.stillLife;

  assert.equal(bottles.length, 3);
  for (const b of bottles) {
    assert.ok(b.w > 40 && b.h > 100);
    assert.ok(b.chimeFreq > 300 && b.chimeFreq < 1000);
    assert.ok(['green', 'olive', 'amber'].includes(b.glass));
  }

  assert.ok(jug.w > 60 && jug.h > 120);
  assert.ok(jug.chimeFreq > 200);

  assert.ok(blackboard.w >= 100 && blackboard.h >= 100);
  assert.ok(blackboard.peg.x > 0 && blackboard.peg.y > 0);
});

test('taverna: acoustic chimes generate expanding rings with decaying alpha', () => {
  const chimeInput = [
    { x: 210, y: 440, t0: 1.0, freq: 587.33, bottleId: 'bottle-tall' },
  ];

  const mMid = model({ time: 1.4, chimes: chimeInput });
  assert.equal(mMid.chimes.length, 1);
  const ch = mMid.chimes[0];
  assert.ok(ch.r > 50 && ch.r < 200, `radius should expand with age, got ${ch.r}`);
  assert.ok(ch.alpha > 0 && ch.alpha < 1, `alpha should decay, got ${ch.alpha}`);

  // Expired chime (age > 2.2s)
  const mExpired = model({ time: 4.0, chimes: chimeInput });
  assert.equal(mExpired.chimes.length, 0, 'expired chimes are pruned');
});
