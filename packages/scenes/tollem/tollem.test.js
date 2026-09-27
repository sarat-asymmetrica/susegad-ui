import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  model, createPool, clearMemo, flowerShape, progressPose, ringImpulse, paletteFor, rectDistance,
  W, H, COPING, RING_C, MAX_TOUCH, MAX_FLOWERS, MAX_CALM, FALL, STILL_TIME, PALETTE_NAMES,
} from './model.js';

const round = v => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x)));

test('the pool is deterministic for a seed, whatever order it is asked in', () => {
  clearMemo();
  const a = model({ time: 40, seed: 7, register: 'playful' });
  clearMemo();
  // walk up to it frame by frame, with a detour back in time
  for (let t = 0; t < 20; t += 0.37) model({ time: t, seed: 7, register: 'playful' });
  model({ time: 3, seed: 7, register: 'playful' });
  for (let t = 3; t < 40; t += 0.5) model({ time: t, seed: 7, register: 'playful' });
  const b = model({ time: 40, seed: 7, register: 'playful' });
  assert.deepEqual(round(b), round(a));
  const c = model({ time: 40, seed: 8, register: 'playful' });
  assert.notDeepEqual(round(c.flowers), round(a.flowers));
});

test('touches are input: the same list gives the same pool', () => {
  const touches = [{ x: 500, y: 400, t: 6, amp: 1 }, { x: 700, y: 300, t: 9.2, amp: 0.7 }];
  clearMemo();
  const a = model({ time: 14, seed: 3, register: 'playful', touches });
  clearMemo();
  for (let t = 0; t <= 14; t += 1 / 30) model({ time: t, seed: 3, register: 'playful', touches: touches.filter(tc => tc.t <= t) });
  const b = model({ time: 14, seed: 3, register: 'playful', touches });
  assert.deepEqual(round(b), round(a));
  const none = model({ time: 14, seed: 3, register: 'playful' });
  assert.notDeepEqual(round(none.flowers), round(a.flowers), 'a ring reaching the flower pushes it');
});

test('the ring buffer never holds more than MAX_TOUCH rings', () => {
  const touches = Array.from({ length: 40 }, (_, i) => ({ x: 100 + i * 20, y: 300, t: 2 + i * 0.1, amp: 1 }));
  const d = model({ time: 6.5, seed: 1, register: 'playful', touches });
  assert.ok(d.rings.length <= MAX_TOUCH);
  assert.equal(d.uniforms.uTouch.length, MAX_TOUCH * 4);
  // the newest survive
  assert.equal(d.rings.at(-1).t, touches.at(-1).t);
  const pool = createPool(1, { register: 'playful' });
  pool.advance(60 * 8, touches);
  assert.ok(pool.rings.length <= MAX_TOUCH);
});

test('a ring impulse decays with age', () => {
  const ring = { x: 0, y: 0, t: 0, amp: 1 };
  let prev = Infinity;
  for (const age of [0.2, 0.8, 1.6, 3, 5, 6.9]) {
    // measure at the crest, where the packet is at that age
    const e = ringImpulse(ring, RING_C * age, 0, age).env;
    assert.ok(e < prev, `env at ${age}s (${e}) should be below ${prev}`);
    assert.ok(e > 0);
    prev = e;
  }
  assert.equal(ringImpulse(ring, 10, 0, 7.5).env, 0, 'gone after its life');
  assert.equal(ringImpulse(ring, 10, 0, -1).env, 0, 'nothing before it happens');
});

test('flowers drift but stay in the pool while they float', () => {
  for (const seed of [1, 2, 5, 11]) {
    const pool = createPool(seed, { register: 'playful' });
    for (let s = 1; s <= 60 * 240; s++) {
      pool.advance(s, []);
      assert.ok(pool.flowers.length <= MAX_FLOWERS);
      for (const f of pool.flowers) {
        if (!f.landed) continue;
        assert.ok(f.y >= COPING + 60, 'never under the coping');
        if (!f.leaving) {
          assert.ok(f.x >= 70 && f.x <= W - 70, `x ${f.x}`);
          assert.ok(f.y <= H - 60, `y ${f.y}`);
        } else {
          assert.ok(f.x > -120 && f.x < W + 120 && f.y < H + 120, 'removed once out of view');
        }
      }
    }
  }
});

test('flowers keep out of calm zones', () => {
  const calm = [{ x: 300, y: 250, w: 600, h: 300 }];
  const d = model({ time: 90, seed: 4, register: 'warm', calm });
  for (const f of d.flowers.filter(f => f.h === 0)) {
    const inside = f.x > 320 && f.x < 880 && f.y > 270 && f.y < 530;
    assert.ok(!inside, `flower at ${f.x},${f.y} sits under the text`);
  }
});

test('registers: quiet drops nothing, playful drops more often than warm', () => {
  const count = register => {
    const pool = createPool(9, { register });
    let seen = new Set();
    for (let s = 1; s <= 60 * 120; s += 6) { pool.advance(s, []); pool.flowers.forEach(f => seen.add(f.id)); }
    return seen.size;
  };
  assert.equal(count('quiet'), 0);
  assert.ok(count('playful') > count('warm'));
  assert.ok(count('warm') >= 2);
  assert.equal(model({ time: 30, seed: 1, register: 'warm', params: { flowers: false } }).flowers.length, 0);
});

test('the still shows the first flower down with its ring', () => {
  const d = model({ time: STILL_TIME, seed: 1, register: 'warm' });
  assert.equal(d.flowers.length, 1);
  assert.equal(d.flowers[0].h, 0);
  assert.equal(d.rings.length, 1);
  assert.ok(Math.abs(d.rings[0].t - FALL[1]) < 0.05);
});

test('progress places the flower and time never moves it', () => {
  const at = t => model({ time: t, seed: 2, register: 'warm', params: { progress: 0.4 } }).flowers;
  assert.deepEqual(at(1), at(50));
  assert.equal(at(1).length, 1);
  const p0 = progressPose(0, 2), p1 = progressPose(1, 2), ph = progressPose(0.5, 2);
  assert.ok(p0.x < ph.x && ph.x < p1.x);
  for (let p = 0; p <= 1; p += 0.05) {
    const q = progressPose(p, 2);
    assert.ok(q.x > 100 && q.x < W - 100 && q.y > COPING + 100 && q.y < H - 100);
  }
  const q = model({ time: 5, seed: 2, register: 'quiet', params: { progress: 0.9 } });
  assert.equal(q.flowers.length, 1, 'quiet still shows state');
});

test('uniforms are plain finite numbers', () => {
  const touches = [{ x: 400, y: 400, t: 1, amp: 1 }];
  for (const [register, seed] of [['quiet', 5], ['warm', 5], ['playful', 5], ['warm', 'monsoon']]) {
    const d = model({ time: 33.3, seed, register, touches, calm: [{ x: 10, y: 10, w: 100, h: 50 }], params: { swell: 0.8 } });
    for (const [name, v] of Object.entries(d.uniforms)) {
      const list = Array.isArray(v) ? v : [v];
      for (const n of list) assert.ok(typeof n === 'number' && Number.isFinite(n), `${register} ${name}`);
    }
    assert.equal(d.uniforms.uFlower.length, MAX_FLOWERS * 4);
    assert.equal(d.uniforms.uCalm.length, MAX_CALM * 4);
    assert.deepEqual(JSON.parse(JSON.stringify(d)), d, 'the whole frame is plain data');
  }
});

test('swell scales the waves and palettes resolve', () => {
  const lo = model({ time: 1, seed: 1, params: { swell: 0 } }), hi = model({ time: 1, seed: 1, params: { swell: 1 } });
  assert.equal(lo.uniforms.uSwell, 0);
  assert.ok(hi.uniforms.uSwell > 1.5);
  assert.equal(model({ time: 0, seed: 1, params: { palette: 'sky' } }).palette, 'sky');
  assert.ok(PALETTE_NAMES.includes(paletteFor(12, 'seed')));
});

test('flower shapes are five petals, deterministic', () => {
  const a = flowerShape(3), b = flowerShape(3);
  assert.equal(a.petals.length, 5);
  assert.deepEqual(a, b);
});

test('flowers leave the tree whole, from past the top-right edge, never fading in', () => {
  for (const seed of [1, 2, 3, 7, 11]) {
    const pool = createPool(seed, { register: 'playful' });
    const seen = new Set();
    for (let n = 1; n <= 60 * 60; n++) {
      pool.advance(n, []);
      for (const f of pool.snapshot(n / 60)) {
        assert.equal(f.alpha, 1);
        if (seen.has(f.id)) continue;
        seen.add(f.id);
        // its first frame: the whole flower (about 120 units across at full height) is still outside the picture
        assert.ok(f.x - 120 > W && f.h > 0.99, `flower ${f.id} of seed ${seed} starts at ${f.x},${f.y}`);
      }
    }
    assert.ok(seen.size >= 3);
  }
});

test('with text on the water, flowers land clear of it', () => {
  // a phone-sized reading panel over the lower two-thirds of the pool
  const calm = [{ x: 40, y: 300, w: 1120, h: 470 }];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const pool = createPool(seed, { register: 'playful', calm });
    pool.advance(60 * 40, []);
    const lands = [...pool.flowers.map(f => f.land)];
    assert.ok(lands.length > 0);
    for (const [x, y] of lands) assert.ok(rectDistance(x, y, calm[0]) > 0, `seed ${seed} landed at ${x},${y}`);
  }
});
