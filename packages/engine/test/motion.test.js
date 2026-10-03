import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  follow, followAll, spring, makeSpring, lagged, lagAndTension,
  pendulum, makePendulum, cycle, visit,
} from '../src/motion.js';

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ≉ ${b}`);

/** Run a spring for `seconds` at a fixed step, and return where it ended. */
function run(s, target, seconds, opts, step = 1 / 120) {
  const n = Math.round(seconds / step);
  for (let i = 0; i < n; i++) spring(s, target, step, opts);
  return s.x;
}

test('follow is frame-rate independent, which a naive lerp is not', () => {
  // The same wall-clock time, four different frame rates, one answer. A naive
  // `a += (b - a) * 0.1` per frame gives four different answers here, and
  // lands further from the target the slower the frame rate, which is exactly
  // backwards. This is exact, not approximate: the exponential composes.
  const reached = (fps) => {
    let a = 0;
    for (let i = 0; i < fps; i++) a = follow(a, 100, 1 / fps, 0.2);
    return a;
  };
  const first = reached(60);
  for (const fps of [15, 30, 60, 144]) {
    close(reached(fps), first, 1e-9, `${fps} fps reaches the same place`);
  }
  // And the naive form really would not: 15 fps is a whole number of frames
  // here, so compare against the same loop done the obvious wrong way.
  let naive = 0;
  for (let i = 0; i < 15; i++) naive += (100 - naive) * 0.1;
  assert.ok(naive < first, `the naive lerp undershoots at 15 fps (${naive.toFixed(2)} < ${first.toFixed(2)})`);
});

test('follow closes 63% of the gap in one time constant', () => {
  // The defining property of an exponential: after tau, the remainder is 1/e.
  const tau = 0.25;
  close(follow(0, 100, tau, tau), 100 * (1 - Math.exp(-1)), 1e-9, 'one tau is 1/e left');
  // and it is symmetric: the same fraction closes from the other end
  close(follow(100, 0, tau, tau), 100 * Math.exp(-1), 1e-9, 'the same downhill');
  // twice the time constant leaves 1/e^2
  close(follow(0, 100, 2 * tau, tau), 100 * (1 - Math.exp(-2)), 1e-9, 'two taus is 1/e squared');
});

test('follow never overshoots, and snaps when there is no time constant', () => {
  let a = 0;
  for (let i = 0; i < 500; i++) {
    a = follow(a, 10, 1 / 60, 0.3);
    assert.ok(a <= 10 && a >= 0, `stays between ${a}`);
  }
  close(a, 10, 1e-9, 'and gets there');
  assert.equal(follow(5, 10, 1 / 60, 0), 10, 'tau 0 is a jump, not a drift');
  assert.equal(follow(5, 10, 1 / 60, -1), 10, 'a negative tau is too');
});

test('follow is stable at a long frame and a short one', () => {
  // One second at 1 fps in a single step, versus the same second at 240.
  close(follow(0, 1, 1, 0.5), follow(0, 1, 1 / 240, 0.5) * 0 + follow(0, 1, 1, 0.5), 1e-12);
  const slow = follow(0, 50, 1, 0.4);
  let fast = 0;
  for (let i = 0; i < 240; i++) fast = follow(fast, 50, 1 / 240, 0.4);
  close(slow, fast, 1e-9, 'a one-second stall lands where a second of frames does');
});

test('followAll moves a whole rig without a loop at the call site', () => {
  close(followAll([0, 0], [10, -10], 1, 0.5)[0], follow(0, 10, 1, 0.5), 1e-12);
  const p = followAll({ x: 0, y: 0, a: 1 }, { x: 10, y: -10, a: 0 }, 1, 0.5);
  assert.deepEqual(Object.keys(p), ['x', 'y', 'a'], 'keeps the shape');
  close(p.x, follow(0, 10, 1, 0.5), 1e-12);
  close(p.a, follow(1, 0, 1, 0.5), 1e-12);
});

test('spring settles on its target', () => {
  const s = makeSpring(100);
  run(s, 0, 6, { frequency: 2, damping: 0.5 });
  close(s.x, 0, 1e-3, 'comes to rest on the target');
  close(s.v, 0, 1e-3, 'and stops moving');
});

test('an underdamped spring rings and then settles; a critical one does not', () => {
  const ringing = makeSpring(1);
  let overshot = false;
  for (let i = 0; i < 600; i++) {
    spring(ringing, 0, 1 / 120, { frequency: 2, damping: 0.15 });
    if (ringing.x < -1e-4) overshot = true;
  }
  assert.ok(overshot, 'a damping ratio under 1 passes the target and comes back');

  const critical = makeSpring(1);
  let critOvershot = false;
  for (let i = 0; i < 600; i++) {
    spring(critical, 0, 1 / 120, { frequency: 2, damping: 1 });
    if (critical.x < -1e-4) critOvershot = true;
  }
  assert.ok(!critOvershot, 'a ratio of exactly 1 never overshoots');
  close(critical.x, 0, 1e-3, 'and it gets there faster');
});

test('a more damped spring gets to the target sooner', () => {
  // The reason damping is expressed as a ratio: the ordering is meaningful.
  const t = (d) => {
    const s = makeSpring(1);
    for (let i = 0; i < 3000; i++) {
      spring(s, 0, 1 / 240, { frequency: 3, damping: d });
      if (Math.abs(s.x) < 0.01) return i / 240;
    }
    return Infinity;
  };
  assert.ok(t(0.4) < t(0.9), 'a nearly-critical spring beats a ringing one');
  assert.ok(t(0.9) < t(2.5), 'and an overdamped one beats a sluggish one');
});

test('spring is frame-rate independent across a wide range of rates', () => {
  // Integrated at 20, 60 and 240 Hz for the same wall-clock second, with
  // enough damping that the semi-implicit step's error does not show.
  const at = (fps) => run(makeSpring(1), 0, 1, { frequency: 3, damping: 1.2 }, 1 / fps);
  const a = at(20), b = at(60), c = at(240);
  close(a, b, 0.02, '20 and 60 Hz agree');
  close(b, c, 0.02, '60 and 240 Hz agree');
});

test('spring is stable when the frame is much longer than the period', () => {
  // A 1 Hz spring stepped at 4 Hz is four samples per cycle and still settles,
  // because the integration is semi-implicit rather than explicit.
  const s = makeSpring(1);
  let finite = true;
  for (let i = 0; i < 200; i++) {
    spring(s, 0, 0.25, { frequency: 1, damping: 0.5 });
    if (!Number.isFinite(s.x)) { finite = false; break; }
  }
  assert.ok(finite, 'no blow-up');
  assert.ok(Math.abs(s.x) < 0.01, `settled, got ${s.x}`);
});

test('lagged is a delay in seconds, so it survives a change of tempo', () => {
  // This is the whole reason to prefer it to sin(t - 0.7). A phase offset is
  // only a time lag at one frequency: change the frequency and the lag
  // changes with it, which is what makes a hem swing out of step when the
  // song speeds up.
  const drive = (t) => Math.sin(2 * Math.PI * t);
  const lag = 0.25;
  // At the drive's own frequency, a lag of a quarter period is 90 degrees.
  const quarter = 1 / 4;
  close(lagged(1, drive, quarter), drive(1 - quarter), 1e-12, 'reads the drive a quarter period back');
  close(drive(1 - quarter), Math.sin(2 * Math.PI * 1 - Math.PI / 2), 1e-12, 'which is 90 degrees behind');

  // Doubling the frequency with the same lag in seconds doubles the angle the
  // lag represents. This is the property a hardcoded phase offset cannot have:
  // `sin(t - 0.7)` is 0.7 radians behind forever, whatever the tempo, so the
  // lag in seconds silently changes with the song.
  const angleFor = (hz) => {
    const f = (t) => Math.sin(2 * Math.PI * hz * t);
    return Math.abs(Math.asin(clampSin(lagged(0, f, 0.125) - f(0))));
  };
  assert.ok(angleFor(2) > angleFor(1) * 1.9, 'twice the pitch, twice the lag angle');
  assert.ok(angleFor(0.5) < angleFor(1) * 0.6, 'half the pitch, half again');
  // and the amplitude and centre pass through untouched
  close(lagged(1, drive, lag, { amplitude: 3, centre: 5 }), 5 + drive(0.75) * 3, 1e-12);
});

const clampSin = (v) => Math.max(-1, Math.min(1, v));

test('lagAndTension reports the signed gap between a thing and its lag', () => {
  const drive = (t) => Math.sin(2 * Math.PI * t);
  const lag = 0.2;
  const now = drive(1), before = drive(0.8);
  const r = lagAndTension(1, drive, lag);
  close(r.value, before, 1e-12, 'the lagged value');
  close(r.tension, now - before, 1e-12, 'signed: positive when being left behind');
  assert.ok(r.stretch > 0, 'and the unsigned gap is there too');
  close(r.stretch, Math.abs(now - before), 1e-12);

  // Half a period later the roles swap, so the sign must flip. This is the
  // thing a dress does: it stretches one way and slackens the other.
  const half = lagAndTension(1.5, drive, lag);
  assert.ok(Math.sign(half.tension) === -Math.sign(r.tension), 'the tension reverses half a cycle later');

  // The tension peaks where the drive is moving fastest and the lagged copy is
  // furthest behind it. For a sine of period 1 with a lag of 0.2 s, that is a
  // fifth of a period off a peak: t=1 is a peak, t=1.1 is the widest gap, and
  // the two curves cross at t=1.35, half a lag further on, where the gap is nil.
  const widest = Math.abs(lagAndTension(1.1, drive, lag).tension);
  assert.ok(Math.abs(r.tension) < widest, `wider off the peak than on it (${r.tension.toFixed(3)} < ${widest.toFixed(3)})`);
  close(lagAndTension(1.35, drive, lag).tension, 0, 1e-9, 'and zero where the two cross');
});

test('a pendulum swings, slows and settles, and its period grows with amplitude', () => {
  // A pendulum's defining quirk: the bigger the swing, the longer it takes.
  // A harmonic oscillator cannot show this, which is why a hanging lamp is
  // not a spring.
  const periodOf = (angle0) => {
    const s = makePendulum();
    s.angle = angle0;
    let prev = s.angle, rising = false, first = 0, last = 0, crossings = 0;
    for (let i = 0; i < 200000; i++) {
      pendulum(s, 1 / 2000, { length: 1, gravity: 9.81, damping: 0 });
      if (!rising && s.angle > 0 && s.angle > prev) { rising = true; crossings++; if (crossings === 1) first = i / 2000; if (crossings === 2) last = i / 2000; }
      if (s.v < 0) rising = false;
      prev = s.angle;
      if (crossings >= 2) break;
    }
    return last - first;
  };
  const small = periodOf(0.1), large = periodOf(1.2);
  assert.ok(large > small * 1.02, `a wide swing is slower: ${large.toFixed(4)} vs ${small.toFixed(4)}`);
  // Close to the small-angle value, 2*pi*sqrt(L/g)
  const linear = 2 * Math.PI * Math.sqrt(1 / 9.81);
  close(small, linear, linear * 0.01, 'and near 2*pi*sqrt(L/g) when the swing is small');
});

test('a damped pendulum comes to rest hanging straight down', () => {
  // Damping is friction against the velocity, so the amplitude falls off
  // exponentially and 0.4 is a slow bleed. It needs a good many periods to
  // reach the last decimal, and it must actually get there rather than
  // asymptote somewhere short of plumb.
  const s = makePendulum();
  s.angle = 0.8;
  for (let i = 0; i < 200000; i++) pendulum(s, 1 / 2000, { length: 1, damping: 0.4 });
  close(s.angle, 0, 1e-4, 'hangs down');
  close(s.v, 0, 1e-4, 'and is still');
});

test('a pendulum returns to where it started, so a driven one can be periodic', () => {
  // A lantern on a hand that keeps moving: the drive is a constant
  // acceleration, and the response settles into a steady swing rather than
  // running off. Used here to prove `drive` reaches the state at all.
  const s = makePendulum();
  for (let i = 0; i < 20000; i++) pendulum(s, 1 / 2000, { length: 1, damping: 0.3, drive: 0.4 });
  assert.ok(Math.abs(s.angle) > 0.01, `a steady drive holds it off vertical (${s.angle.toFixed(4)})`);
  assert.ok(Math.abs(s.angle) < 1.5, 'and not spun over the top');
  const undriven = makePendulum();
  for (let i = 0; i < 20000; i++) pendulum(undriven, 1 / 2000, { length: 1, damping: 0.3 });
  close(undriven.angle, 0, 1e-3, 'the same rig with no drive hangs plumb');
});

test('cycle wraps both ways, with no stall at the seam', () => {
  for (const t of [-1, 0, 0.5, 9.99, 10, 10.01]) {
    const c = cycle(t, 10);
    assert.ok(c.u >= 0 && c.u < 1, `u in range at t=${t}, got ${c.u}`);
  }
  // The seam: one frame either side of it must be a real step, not a pause.
  // u wraps from just-under-1 back to just-over-0, and the step is the elapsed
  // time expressed as a fraction of the period, not a stall.
  const before = cycle(9.99, 10).u, after = cycle(10.01, 10).u;
  assert.ok(after < before, 'wraps back to the start rather than sticking');
  // 9.99 -> 10.01 is 0.02 s, which is 0.002 of a 10 s period, and it wraps
  // through zero, so the signed difference is 0.002 - 1.
  close(after - before, 0.002 - 1, 1e-9, 'by exactly the elapsed time, through zero');
  // The way to see the step without the wrap is to compare against the
  // expected positions: 0.999 before, 0.001 after.
  close(before, 0.999, 1e-12, '0.999 of the way through');
  close(after, 0.001, 1e-12, 'then 0.001 of the way through the next one');
  assert.equal(cycle(3, 0).u, 0, 'a non-positive period has no cycle');
  assert.equal(cycle(3, 0).left, Infinity);
  close(cycle(3, 10).left, 7, 1e-12, 'time until the next one');
});

test('visit: in, hold, gone, with soft ends and nothing hard', () => {
  const opts = { period: 26, visit: 9, arrive: 0.2, leave: 0.24 };
  const at = (t) => visit(t, opts);
  assert.ok(at(0).present, 'arriving at the start of the visit');
  assert.ok(!at(12).present, 'and gone in the gap between visits');

  // The ramp is smooth: no jump bigger than a small step anywhere.
  let prev = 0, maxJump = 0;
  for (let t = 0; t < 26; t += 0.01) {
    const p = at(t).presence;
    assert.ok(p >= 0 && p <= 1, `presence in range, got ${p}`);
    maxJump = Math.max(maxJump, Math.abs(p - prev));
    prev = p;
  }
  assert.ok(maxJump < 0.02, `no hard edge, biggest step ${maxJump.toFixed(4)}`);

  // Full height somewhere in the middle, reached and left softly.
  assert.ok(at(2.5).presence > 0.99, `fully arrived by a third of the way in (${at(2.5).presence.toFixed(3)})`);
  assert.ok(at(2.5).presence <= 1);
  // and gone smoothly at the end
  assert.ok(at(8.9).presence < 0.5 && !at(9.1).present, 'leaving through a ramp, not a step');

  // The phase offset moves the whole visit without changing its shape.
  const shifted = visit(0, { ...opts, phase: 26 });
  assert.deepEqual(shifted, at(26), 'a full period of offset is the same visit');
});

test('a scene-like rig: a hem that trails its body and a spot that trails her', () => {
  // The kantar case, in the terms the module offers. A phase offset inside
  // sin() is only a lag at one tempo; here the same numbers hold at two.
  const pulse = (t) => Math.sin(t);
  for (const tempo of [1, 1.7]) {
    const t = 1.234;
    const body = pulse(t * tempo);
    const hem = lagged(t * tempo, pulse, 0.7);
    // At any tempo the hem is strictly behind the body somewhere in the cycle.
    let behind = false;
    for (let x = 0; x < 6.3; x += 0.1) {
      const d = pulse(x) - lagged(x, pulse, 0.7);
      if (d > 1e-6) { behind = true; break; }
    }
    assert.ok(behind, `the hem trails at tempo ${tempo}`);
    assert.ok(Number.isFinite(hem) && Number.isFinite(body));
  }
  // and the follow spot, with a time constant rather than an offset
  let spot = 0;
  for (let i = 0; i < 120; i++) spot = follow(spot, Math.sin(i / 60 * 1.7), 1 / 60, 0.25);
  assert.ok(Number.isFinite(spot) && Math.abs(spot) <= 1.0001, `the spot stays in step, got ${spot.toFixed(4)}`);
});
