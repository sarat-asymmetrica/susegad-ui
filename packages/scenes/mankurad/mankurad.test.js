import test from 'node:test';
import assert from 'node:assert/strict';
import mankurad from './index.js';
import { model, beats, swingAt, mangoAt, branchBend, beatOf, LOOKS, T, T_FALL, STILL_LT, LAND, MANGO, RAIN, SPLASH, CLOUDS, LEAVES, P0, P1 } from './model.js';
import { meta } from './meta.js';

test('the timeline: the koel calls and flies, clouds come, the rain comes and goes, the grass grows', () => {
  const early = beats(3), storm = beats(25), after = beats(42);
  assert.ok(early.call > 0.9 && early.rain === 0 && early.fly === 0);
  assert.ok(storm.rain > 0.9 && storm.mood > 0.8 && storm.fly === 1);
  assert.ok(after.rain === 0 && after.grass > 0.9 && after.card === 1);
  for (let t = 0; t < T; t += 0.5) assert.ok(beats(t + 0.5).ripen >= beats(t).ripen, 'the mango only ripens');
});

test('the pendulum is a pure function of the story’s clock: the same moment, the same swing', () => {
  assert.equal(swingAt(12.34), swingAt(12.34));
  const swings = [0, 5, 10, 15, 20, 25].map(swingAt);
  assert.ok(new Set(swings).size > 3, 'it moves');
  for (const s of swings) assert.ok(Math.abs(s) < 0.6, `a swing, not a spin: ${s}`);
});

test('the mango hangs, falls at 28.6 s, lands on the laterite and settles on its side', () => {
  assert.equal(mangoAt(T_FALL - 0.01).phase, 'hang');
  assert.equal(mangoAt(T_FALL + 0.2).phase, 'fall');
  const down = mangoAt(40);
  assert.equal(down.phase, 'down');
  assert.equal(down.y, LAND); assert.equal(down.x, 560);
  assert.ok(Math.abs(down.r + 1.42) < 0.01);
  // the fall is continuous: where it lets go is where it hung
  const a = mangoAt(T_FALL - 1e-6), b = mangoAt(T_FALL);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1.5, `${a.x},${a.y} to ${b.x},${b.y}`);
  // and it falls downward only
  let y = -1; for (let t = T_FALL; t < T_FALL + 0.6; t += 0.05) { const m = mangoAt(t); if (m.phase !== 'fall') break; assert.ok(m.y >= y); y = m.y; }
});

test('the branch springs back once the fruit lets go', () => {
  const kickless = t => 0; void kickless;
  assert.notEqual(branchBend(T_FALL + 0.1), branchBend(T_FALL - 0.1));
});

test('registers: quiet is the plate’s still; warm is easier; playful tells it again on Enter', () => {
  const q = model({ time: 99, register: 'quiet' });
  assert.equal(q.lt, STILL_LT); assert.ok(q.settled);
  assert.equal(model({ time: 0, register: 'playful' }).lt, 0, 'playful starts the story at its start');
  const w1 = model({ time: 10, register: 'warm' }).lt, w2 = model({ time: 20, register: 'warm' }).lt;
  assert.ok(Math.abs(w2 - w1 - 8) < 1e-9, 'warm at 0.8 pace');
  for (const r of ['warm', 'playful']) assert.equal(model({ time: STILL_LT, register: r }).lt, STILL_LT, `${r}: the still is the plate’s moment`);
  assert.ok(LOOKS.playful.again && !LOOKS.warm.again);
  assert.ok(model({ time: 1000, register: 'playful' }).lt < T, 'the story loops');
});

test('progress holds the story at a beat, and time never moves it', () => {
  assert.equal(beatOf(0), P0); assert.equal(beatOf(1), P1);
  const a = model({ time: 0, register: 'warm', params: { progress: 0.62 } }), b = model({ time: 500, register: 'warm', params: { progress: 0.62 } });
  assert.equal(a.lt, b.lt); assert.ok(a.settled);
  assert.equal(mangoAt(beatOf(1)).phase, 'down', 'done: the mango is down in the puddle');
  assert.equal(mangoAt(beatOf(0)).phase, 'hang');
  assert.equal(mankurad.status({ progress: 0.4 }), '40% done');
  assert.equal(mankurad.status({ progress: null }), '');
});

test('the plate’s shapes and particles are all here', () => {
  assert.ok(MANGO.length > 100); assert.equal(RAIN.length, 320); assert.equal(SPLASH.length, 18);
  assert.equal(CLOUDS.length, 4); assert.equal(LEAVES.length, 12);
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
});
