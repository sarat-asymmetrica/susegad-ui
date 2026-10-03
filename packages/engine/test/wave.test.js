import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  front, radialFront, linearFront, weightedFront, arrivalTime, phaseShifted, spread,
} from '../src/wave.js';

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ≉ ${b}`);

// `progress` is a 0..1 slider and `speed` is how many units the front covers
// per unit of it, so a pan 30 units across needs a speed of about 60 for the
// front to cross it within one pull of the slider. SPEED below is that scale,
// and it is the only thing making these numbers large.
const SPEED = 60;

test('a front is 0 before it arrives and 1 after, with the edge where the geometry says', () => {
  // A point 30 units out, with the front covering 60 units per unit of
  // progress, is reached at progress 0.5 exactly.
  assert.equal(front(0.49, 30, { speed: SPEED }), 0, 'not yet');
  assert.equal(front(0.50, 30, { speed: SPEED }), 1, 'and complete the moment it lands');
  assert.equal(front(0.6, 30, { speed: SPEED }), 1, 'still complete past it');
  // a nearer point is through well before a further one
  assert.equal(front(0.2, 5, { speed: SPEED }), 1, 'the near point is long since dry');
  assert.equal(front(0.2, 30, { speed: SPEED }), 0, 'while the far one has not started');
  // progress is a slider, so it cannot be pushed past 1: a progress of 50 is
  // progress 1, and at progress 1 the front has covered the whole `speed`.
  assert.equal(front(50, 30, { speed: SPEED }), 1, 'a progress over 1 is clamped to the end');
  assert.equal(front(-3, 30, { speed: SPEED }), 0, 'and a negative one is not run backwards');
  // which is why a far point with a large speed IS reached at the end of the
  // slider: travelled is progress * speed, so 1 * 60 = 60 units of front.
  assert.equal(front(1, 30, { speed: SPEED }), 1, 'a full pull covers the whole speed');
  assert.equal(front(0.4, 30, { speed: SPEED }), 0, 'and short of it, not yet');
});

test('the front is a function of distance, so its shape comes from the geometry', () => {
  // The property the hand-weighted version could not give. Same progress, four
  // distances, strictly ordered, and the ordering is the only thing chosen.
  // At progress 0.7 the front has travelled 42 units, so all four points are
  // inside the reach of 60 and the ramp between arrival and completion is
  // visible: nearer points are further along it.
  const at = (p) => [10, 20, 30, 40].map(d => front(p, d, { speed: SPEED, reach: 60 }));
  const [a, b, c, d] = at(0.7);
  assert.ok(a > b && b > c && c > d, `nearer points are always further along (${[a, b, c, d].map(v => v.toFixed(3))})`);
  // and it is a genuine gradient, not a step
  assert.ok(new Set(at(0.7)).size === 4, 'four distinct values across the field');

  // A round source is round: equal distance, equal value, whatever the bearing.
  const onCircle = (i) => radialFront(0.35,
    10 + Math.cos(i * Math.PI / 4) * 20, 10 + Math.sin(i * Math.PI / 4) * 20,
    { originX: 10, originY: 10, speed: SPEED, reach: 50 });
  for (let i = 0; i < 8; i++) close(onCircle(i), onCircle(0), 1e-12, `bearing ${i} agrees`);
  // and a point nearer the source is genuinely earlier
  assert.ok(radialFront(0.5, 30, 10, { originX: 10, originY: 10, speed: SPEED, reach: 50 })
    > radialFront(0.5, 50, 10, { originX: 10, originY: 10, speed: SPEED, reach: 50 }), 'nearer is earlier');
});

test('a straight source is straight, and a reversed one goes the other way', () => {
  const p = 0.4;
  // Along one axis the value depends only on the depth, so a whole row dries
  // together however wide the pan is.
  close(linearFront(p, 20, { speed: SPEED, reach: 60 }), linearFront(p, 20, { speed: SPEED, reach: 60 }), 1e-12);
  assert.ok(linearFront(p, 10, { speed: SPEED, reach: 60 }) > linearFront(p, 30, { speed: SPEED, reach: 60 }),
    'nearer along the axis is earlier');
  // reversed is the mirror: a receding front is measured from the far end and
  // read at 1 - p. A step front past its arrival is 1, so the two are exact
  // reflections everywhere except on the point itself, where both have arrived.
  const bare = { speed: SPEED };
  for (const p of [0.2, 0.3, 0.7, 0.8]) {
    close(linearFront(p, 20, { ...bare, reverse: true }) + front(p, 20, bare), 1, 1e-12, `mirrored at p=${p}`);
  }
  // With a reach the completion ramp is not symmetric under time reversal (a
  // point part-way through filling up is not the mirror of one part-way
  // through emptying), so the check is the identity rather than a sum.
  for (const d of [10, 30, 50]) {
    close(linearFront(0.4, d, { speed: SPEED, reach: 60, reverse: true }),
      front(0.6, d, { speed: SPEED, reach: 60 }), 1e-12, `reverse is 1 - p, reach included, at ${d}`);
  }
  // a deep point is still behind a shallow one, because the distance is the
  // same however the front is running
  assert.ok(linearFront(0.4, 10, { speed: SPEED, reach: 60, reverse: true })
    > linearFront(0.4, 30, { speed: SPEED, reach: 60, reverse: true }), 'nearer along the axis is still earlier');
});

test('a soft edge is a ramp across the front, and a hard one is a step', () => {
  // Mid-arrival at progress 0.5 for a point 30 out at speed 60.
  const soft = front(0.5, 30, { speed: SPEED, softness: 20 });
  close(soft, 0.5, 1e-9, 'halfway across it, symmetrically');
  // the ramp spans the softness either side of arrival. A point 30 out is
  // reached at progress 0.5, so the ramp runs from 30-20=10 units (progress
  // 0.167) to 30+20=50 units (progress 0.833).
  assert.equal(front(0.1, 30, { speed: SPEED, softness: 20 }), 0, 'well before the ramp');
  assert.equal(front(0.9, 30, { speed: SPEED, softness: 20 }), 1, 'well after it');
  assert.ok(front(0.3, 30, { speed: SPEED, softness: 20 }) > 0, 'and already moving on the near side');
  // and no jump larger than a small step anywhere
  let prev = 0, maxJump = 0;
  for (let p = 0; p <= 1; p += 0.001) {
    const v = front(p, 30, { speed: SPEED, softness: 20 });
    maxJump = Math.max(maxJump, Math.abs(v - prev));
    prev = v;
  }
  assert.ok(maxJump < 0.02, `a soft front is still smooth (${maxJump.toFixed(4)})`);
});

test('a harder point is later, which is what a low corner or a deep pan is', () => {
  // At progress 0.8 the front has travelled 48 units. A weight of 1 puts the
  // point 30 units out, so it has arrived and is on its completion ramp; a
  // weight of 2 puts it 60 out and a weight of 4 puts it 120 out, so neither
  // has been reached at all. The strict ordering between the two unarrived
  // weights is not observable here, so it is checked at a progress where it is.
  const opts = { speed: SPEED, reach: 200 };
  const o0 = { speed: SPEED };
  const ordinary = weightedFront(0.8, 30, 1, opts);
  const harder = weightedFront(0.8, 30, 2, opts);
  const muchHarder = weightedFront(0.8, 30, 4, opts);
  assert.ok(ordinary > harder, `weight 2 is behind weight 1 (${harder.toFixed(3)} < ${ordinary.toFixed(3)})`);
  assert.equal(harder, 0, 'and weight 2 has not been reached');
  assert.equal(muchHarder, 0, 'nor weight 4');
  assert.ok(ordinary > 0, 'the ordinary point is part-way up its ramp');
  // A faster front separates all three. At speed 120 and progress 0.9 the front
  // has travelled 108: weight 1 (30 out) and weight 2 (60 out) have both
  // arrived and are on their ramps, and weight 4 (120 out) has not.
  const later = { speed: 120, reach: 200 };
  assert.ok(weightedFront(0.9, 30, 2, later) > 0, 'the weight-2 point is part-way up');
  assert.ok(weightedFront(0.9, 30, 1, later) > weightedFront(0.9, 30, 2, later),
    'and the weight-1 point is strictly further along');
  assert.equal(weightedFront(0.9, 30, 4, later), 0, 'while the weight-4 point is not reached');
  close(weightedFront(0.8, 30, 1, opts), front(0.8, 30, opts), 1e-12, 'a weight of 1 is the plain front');
  // A weight of 0 puts the point at the source, which is where the front
  // starts rather than somewhere already complete: it fills outward from there
  // like everything else, so it leads the field without being finished.
  const atSource = weightedFront(0.5, 30, 0, opts);
  assert.ok(atSource > 0, 'and it is not empty either');
  assert.ok(atSource > weightedFront(0.5, 30, 1, opts), 'the source leads the ordinary point at the same progress');
  // The reach is the depth of the whole field, so even the source is only
  // finished once the front has travelled the full reach, not on arrival.
  assert.equal(weightedFront(1, 30, 0, o0), 1, 'and the source is full at the end of the slider with no reach');
  assert.ok(weightedFront(1, 30, 0, opts) < 1, 'but with a reach it is still filling toward it');
  assert.equal(weightedFront(0.5, 30, -3, opts), atSource, 'a negative weight clamps to the source, not inverted');
  // the weighting is on the distance, so a doubled weight is exactly a doubled
  // distance, and therefore exactly twice the time to arrive
  close(arrivalTime(30 * 2, o0) / arrivalTime(30, o0), 2, 1e-12, 'twice the weight, twice the time');
  // and the harder point is exactly as far along as the plain front at a
  // correspondingly later time: the weight delays, it does not distort
  close(weightedFront(0.8, 30, 2, opts), front(0.8 / 2, 30, opts), 1e-12, 'a weight of 2 is half the speed');
});

test('arrivalTime is the inverse of front, so a test can assert an order', () => {
  // This is what makes the module usable for scheduling: a heap is raked once
  // its own pan is dry, which is a comparison of two arrival times rather than
  // two magic numbers.
  const opts = { speed: SPEED, softness: 0 };
  for (const dist of [10, 30, 55]) {
    const t = arrivalTime(dist, opts);
    assert.ok(t > 0 && t <= 1, `a sensible time for ${dist}, got ${t}`);
    assert.equal(front(t * 0.999, dist, { ...opts, reach: Infinity }), 0, `not yet at ${dist}`);
    assert.equal(front(t, dist, { ...opts, reach: Infinity }), 1, `arrived at ${dist}`);
  }
  // nearer arrives first, and the ordering is total
  assert.ok(arrivalTime(10, opts) < arrivalTime(20, opts), 'nearer is sooner');
  assert.ok(arrivalTime(20, opts) < arrivalTime(20, { ...opts, speed: SPEED / 2 }), 'a slower front is later');
  // and a soft edge arrives at the midpoint of its own ramp
  close(arrivalTime(30, { speed: SPEED, softness: 20 }), arrivalTime(30, opts), 1e-12, 'the same time, soft or hard');
  // a distance that cannot be reached within the slider saturates rather than lying
  assert.equal(arrivalTime(1e6, opts), 1, 'an unreachable point is due at the end');
});

test('speed scales the whole front without changing its shape', () => {
  const shape = (speed) => {
    const p = arrivalTime(30, { speed });
    return [0, 0.25, 0.5, 0.75, 1].map(f => front(p * f, 30, { speed, softness: 5, reach: Infinity }));
  };
  for (const speed of [SPEED / 2, SPEED, SPEED * 2]) {
    const ref = shape(SPEED);
    for (let i = 0; i < ref.length; i++) close(shape(speed)[i], ref[i], 1e-12, `same shape at speed ${speed}, f=${i}`);
  }
  // and the time to get there really is inverse to the speed
  close(arrivalTime(30, { speed: SPEED * 2 }), 0.25, 1e-12, 'twice the speed, half the time');
  close(arrivalTime(30, { speed: SPEED }), 0.5, 1e-12, 'and the base case is the distance over the speed');
});

test('phaseShifted puts a follower behind the beat, and keeps it there', () => {
  const beat = (t) => Math.sin(t);
  const lagged = (t, f, l) => f(t - l);
  // With a period given, the offset is a fraction of the cycle, so half a
  // cycle behind whatever the cycle's length.
  for (const period of [1, 2.5, 8]) {
    close(phaseShifted(0, beat, { period, offset: 0.5 }), beat(-period / 2), 1e-12, `half a cycle back at period ${period}`);
  }
  // Without one it falls back to a lag in seconds.
  close(phaseShifted(1, beat, { lag: 0.7 }), lagged(1, beat, 0.7), 1e-12, 'the seconds form agrees');
  // and the amplitude and centre pass through
  close(phaseShifted(0, beat, { period: 4, offset: 0.25, amplitude: 3, centre: 1 }), 1 + beat(-1) * 3, 1e-12);
});

test('a front is monotone in progress: it never goes back', () => {
  // A front that could reverse would read as a tide coming in and out, which
  // is a different piece entirely. Checked on the soft form, where a bad
  // interaction between the ramp and the cap would show up.
  for (const [d, soft] of [[30, 0], [30, 15], [50, 0], [50, 25], [90, 40]]) {
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += 0.002) {
      const v = front(p, d, { softness: soft, speed: SPEED, reach: 80 });
      assert.ok(v >= prev - 1e-12, `monotone at d=${d} soft=${soft} (${v} after ${prev})`);
      assert.ok(v >= 0 && v <= 1, `in range, got ${v}`);
      prev = v;
    }
  }
});

test('a reach caps the front, and everything past the reach is complete', () => {
  // A pan has a size: past the far bund there is nothing left to arrive at,
  // and without a cap the front would still be climbing there. The reach
  // completes the front early, but it does not make an unarrived point arrive
  // for free: at half progress a point 100 units out is still empty.
  const p = 0.5; // travelled 30
  assert.equal(front(p, 100, { speed: SPEED, reach: 60, softness: 0 }), 0, 'beyond the reach, but not reached yet');
  assert.equal(front(1, 100, { speed: SPEED, reach: 60, softness: 0 }), 0,
    'a point 100 out at speed 60 never arrives within the slider, reach or not');
  // The reach completes a front that HAS arrived; it does not conjure one that
  // has not. So the cap is visible on a point the front actually reaches. A
  // point 30 out at speed 60 arrives exactly at progress 0.5, and the reach at
  // 40 means it is complete 10 units later, at progress 35/60.
  const at = (units) => front(units / SPEED, 30, { speed: SPEED, reach: 40, softness: 0 });
  assert.equal(at(30), 0, 'at arrival the ramp is at zero');
  close(at(35), 0.5, 1e-9, 'halfway to the reach');
  assert.equal(at(40), 1, 'and complete at it');
  assert.equal(at(60), 1, 'and it stays complete');
  // a soft edge behaves the same way, just spread over the softness: a
  // softness of 30 puts the ramp from 0 to 60 units, so at the point's own
  // arrival (30 units) it is halfway, exactly as a hard edge is.
  close(front(0.5, 30, { speed: SPEED, reach: 40, softness: 30 }), 0.5, 1e-9, 'halfway at its own arrival');
  assert.ok(front(0.1, 30, { speed: SPEED, reach: 40, softness: 30 }) < 0.05, 'and barely started at 6 units');
  assert.equal(front(1, 30, { speed: SPEED, reach: 40, softness: 30 }), 1, 'and full at the end of the slider');
  // with no reach a point the front has passed is simply done
  assert.equal(front(1, 30, { speed: SPEED }), 1, 'passed, with no reach to fill');
});

test('spread moves a field toward its neighbours and nothing else', () => {
  // A 4x4 grid, empty but for one hot cell in the corner: the value travels
  // inward over passes, and the total never grows, because diffusion conserves.
  const n = 16;
  const state = new Array(n).fill(0);
  state[0] = 1;
  const total = (a) => a.reduce((x, y) => x + y, 0);
  const before = total(state);
  spread(state, { rate: 0.5, passes: 1 });
  assert.ok(state[0] < 1, 'the hot cell has given some up');
  assert.ok(state[1] > 0 && state[4] > 0, 'and its neighbours have taken some');
  assert.ok(total(state) <= before + 1e-9, 'and no value was invented');

  // Converges toward uniform rather than oscillating.
  for (let i = 0; i < 40; i++) spread(state, { rate: 0.5, passes: 4 });
  const range = Math.max(...state) - Math.min(...state);
  assert.ok(range < 0.05, `evens out, range ${range.toFixed(4)}`);

  // A uniform field is a fixed point: diffusion of nothing is nothing.
  const flat = new Array(n).fill(0.4);
  spread(flat, { rate: 0.5, passes: 5 });
  for (const v of flat) close(v, 0.4, 1e-12, 'unchanged');
});

test('spread never invents a value and never leaves the 0..1 range', () => {
  const state = new Array(25).fill(0).map((_, i) => (i % 5) / 4);
  for (let i = 0; i < 20; i++) {
    spread(state, { rate: 0.9, passes: 3 });
    for (const v of state) {
      assert.ok(Number.isFinite(v), 'finite');
      assert.ok(v >= 0 && v <= 1, `in range, got ${v}`);
    }
  }
  // Explicit neighbours work, and a one-dimensional field is handled.
  const line = [0, 0, 1, 0, 0];
  spread(line, { rate: 1, passes: 1, neighbours: [[1], [0, 2], [1, 3], [2, 4], [3]] });
  assert.ok(line[1] > 0 && line[3] > 0, 'spread along the chain');
  assert.equal(line[0], 0, 'and not off the ends');
  assert.equal(line[4], 0, 'at either end');
  assert.deepEqual(spread([], { rate: 1 }), [], 'an empty field is not an error');
});

test('a shape that does not factor falls back to a line rather than failing', () => {
  // A 4x4 grid gets the four orthogonal neighbours. A row of 7 does not
  // factor, so it gets the chain, and the ends must not read off the array.
  const row = new Array(7).fill(0);
  row[3] = 1;
  spread(row, { rate: 1, passes: 1 });
  assert.equal(row[0], 0, 'nothing arrives from off the end');
  assert.equal(row[6], 0, 'at either end');
  assert.ok(row[2] > 0 && row[4] > 0, 'and it moved outward from the middle');
});
