import test from 'node:test';
import assert from 'node:assert/strict';
import kairi from './index.js';
import {
  model, buildBorder, border, dft, chain, curve, resampleN, paisley, stageAt, doneSlots, clockOfProgress, nextSlotClock, seedAfter,
  SLOTS, N, INTRO, DONE, CYCLE, SLOT_T, STILL_TIME, W, H, BAND,
} from './model.js';
import { meta } from './meta.js';
import { defaultParams } from '../../core/define-scene.js';

const P = (o = {}) => ({ ...defaultParams(kairi.params), ...o });
const b1 = buildBorder(1);

test('the full chain closes on the paisley: every one of the 256 terms lands on the resampled outline', () => {
  for (const s of b1.slots) {
    for (let j = 0; j < N; j += 17) {
      const joints = chain(s.terms, N, j / N), [x, y] = joints[joints.length - 1];
      assert.ok(Math.hypot(x - s.outline[j][0], y - s.outline[j][1]) < 1e-6, `slot ${s.i}, point ${j}`);
    }
    // and the drawn curve (K circles) closes: its end meets its start, within a stroke
    const c = s.full, [a, z] = [c[0], chain(s.terms, s.K, 1).at(-1)];
    assert.ok(Math.hypot(a[0] - z[0], a[1] - z[1]) < 1e-6, `slot ${s.i} closes`);
  }
});

test('more circles, a closer sketch: the K-term curve is near the outline, a 3-term one is not', () => {
  const s = b1.slots[2], err = k => {
    const c = curve(s.terms, k, N);
    return Math.max(...c.map(([x, y], i) => Math.hypot(x - s.outline[i][0], y - s.outline[i][1])));
  };
  assert.ok(err(s.K) < 6, `K=${s.K}: ${err(s.K).toFixed(2)}`);
  assert.ok(err(3) > 20, `3 terms: ${err(3).toFixed(2)}`);
  assert.ok(err(s.K) < err(12) && err(12) < err(3));
});

test('dft: the centre first, then terms by size, 256 of them', () => {
  const t = b1.slots[0].terms;
  assert.equal(t.length, N);
  assert.equal(t[0].f, 0);
  for (let i = 2; i < t.length; i++) assert.ok(t[i - 1].amp >= t[i].amp);
  assert.equal(resampleN(paisley(1, 0).outline).length, N);
});

test('five paisleys inside the band, in order across the cloth, each different', () => {
  assert.equal(b1.slots.length, SLOTS);
  assert.equal(b1.buti.length, SLOTS - 1);
  for (const s of b1.slots) for (const [x, y] of s.full) assert.ok(x > 0 && x < W && y > BAND.y0 - 30 && y < BAND.y1 + 30, `slot ${s.i}`);
  for (let i = 1; i < SLOTS; i++) assert.ok(b1.slots[i].cx > b1.slots[i - 1].cx);
  assert.notDeepEqual(paisley(1, 0).outline, paisley(1, 1).outline);
});

test('deterministic: the same seed is the same border; another seed another; string seeds work', () => {
  assert.deepEqual(buildBorder(1).slots[3].full, b1.slots[3].full);
  assert.notDeepEqual(buildBorder(2).slots[3].full, b1.slots[3].full);
  assert.deepEqual(buildBorder('goa').slots[0].terms.slice(0, 5), buildBorder('goa').slots[0].terms.slice(0, 5));
  assert.equal(border(1), border(1));
  const a = model({ time: 12, seed: 1, register: 'warm', params: P() }), b = model({ time: 12, seed: 1, register: 'warm', params: P() });
  assert.deepEqual({ ...a, border: 0 }, { ...b, border: 0 });
});

test('the timeline: intro, then build, trace, echo, fill, move for each paisley, then hold and fade', () => {
  assert.equal(stageAt(0.5).stage, 'intro');
  assert.equal(stageAt(INTRO + 0.1).stage, 'build');
  assert.equal(stageAt(INTRO + 3).stage, 'trace');
  assert.equal(stageAt(INTRO + SLOT_T + 0.1).slot, 1);
  assert.equal(stageAt(DONE + 1).stage, 'hold');
  assert.equal(stageAt(CYCLE - 0.1).stage, 'fade');
  assert.equal(doneSlots(stageAt(STILL_TIME)), SLOTS);
  assert.equal(doneSlots(stageAt(INTRO + 0.1)), 0);
});

test('progress: monotonic in the finished paisleys, 0 is the bare border, 1 the finished one, and time stands still', () => {
  let last = -1, lastClock = -1;
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const m = model({ time: 99, register: 'warm', params: P({ progress: p }) });
    assert.ok(m.done >= last && m.clock >= lastClock, `p=${p}`);
    last = m.done; lastClock = m.clock;
    assert.equal(m.settled, true);
    assert.deepEqual(m.clock, model({ time: 3, register: 'playful', params: P({ progress: p }) }).clock);
  }
  assert.equal(model({ params: P({ progress: 0 }) }).done, 0);
  assert.equal(model({ params: P({ progress: 1 }) }).done, SLOTS);
  assert.equal(clockOfProgress(1), DONE);
  assert.equal(clockOfProgress(2), DONE);
  assert.equal(kairi.status(P({ progress: 0.4 })), '40% done');
  assert.equal(kairi.status(P()), '');
});

test('registers: quiet and warm settle on the finished border; playful cycles on to the next seed', () => {
  for (const register of ['quiet', 'warm']) {
    const m = model({ time: STILL_TIME + 50, register, params: P() });
    assert.equal(m.settled, true); assert.equal(m.done, SLOTS); assert.equal(m.S.stage, 'hold');
    assert.equal(model({ time: 10, register, params: P() }).settled, false);
  }
  const p = model({ time: CYCLE + 1, seed: 1, register: 'playful', params: P() });
  assert.equal(p.settled, false); assert.equal(p.seed, 2); assert.equal(p.S.stage, 'intro');
  assert.equal(seedAfter('goa', 1), 'goa+1');
  // the still (meta.stillTime) is the finished border in every register
  for (const register of ['quiet', 'warm', 'playful']) assert.equal(model({ time: meta.stillTime, register, params: P() }).done, SLOTS);
});

test('Enter goes on to the next paisley, and past the last one there is nothing further', () => {
  assert.equal(nextSlotClock(0.2), INTRO);
  assert.equal(nextSlotClock(INTRO + 1), INTRO + SLOT_T);
  assert.equal(nextSlotClock(DONE + 2), null);
});

test('meta: the sizes, the still and no em dashes in the words', () => {
  assert.equal(meta.W, W); assert.equal(meta.H, H); assert.equal(meta.stillTime, STILL_TIME);
  for (const k of ['title', 'gloss', 'alt', 'caption', 'keys', 'credit', 'prompt']) assert.ok(!meta[k].includes('—'), k);
  for (const [phrase] of meta.map) assert.ok(meta.prompt.includes(phrase), phrase);
});
