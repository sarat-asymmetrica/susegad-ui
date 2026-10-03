import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunAt, shadowLength, shadowDir, daylight, DEG } from '../src/light.js';

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ≉ ${b}`);

test('the sun is up between the two ends of the day and highest at noon', () => {
  const dawn = sunAt(0), noon = sunAt(0.5), dusk = sunAt(1);
  assert.ok(dawn.elevationDeg <= 0, `dawn is at or below the horizon, got ${dawn.elevationDeg}`);
  assert.ok(dusk.elevationDeg <= 0, 'dusk is at or below the horizon');
  assert.ok(noon.elevationDeg > 60, `noon is high, got ${noon.elevationDeg}`);
  // Symmetric about midday: the same height either side of it.
  close(sunAt(0.25).elevationDeg, sunAt(0.75).elevationDeg, 1e-9, 'symmetric about noon');
  // and the peak is exactly at 0.5
  for (const t of [0.3, 0.4, 0.45, 0.49]) {
    assert.ok(sunAt(t).elevationDeg < noon.elevationDeg, `rises up to noon (t=${t})`);
  }
});

test('the arc flattens toward the poles, as the real one does', () => {
  const equator = sunAt(0.5, { latitudeDeg: 0 }).elevationDeg;
  const goa = sunAt(0.5, { latitudeDeg: 15 }).elevationDeg;
  const arctic = sunAt(0.5, { latitudeDeg: 70 }).elevationDeg;
  assert.ok(goa < equator, `Goa is lower than the equator (${goa} < ${equator})`);
  assert.ok(arctic < goa, `and lower still up there (${arctic} < ${goa})`);
});

test('out of the day there is no light to speak of', () => {
  for (const t of [0, 1, -0.5, 1.5]) {
    const s = sunAt(t);
    assert.equal(s.altitude, 0, `no altitude outside the day at t=${t}`);
    // sin(pi) is not exactly zero in binary floating point, so compare closely.
    close(s.above, 0, 1e-12, `not above the horizon at t=${t}`);
  }
  // and out of range it clamps rather than extrapolating
  assert.deepEqual(sunAt(-3), sunAt(0));
  assert.deepEqual(sunAt(9), sunAt(1));
});

test('azimuth is a compass bearing running east to west across the day', () => {
  const dawn = sunAt(0).azimuthDeg, noon = sunAt(0.5).azimuthDeg, dusk = sunAt(1).azimuthDeg;
  assert.ok(dawn > 45 && dawn < 135, `starts in the east, got ${dawn}`);
  close(noon, 180, 1e-9, 'due south at noon in the northern hemisphere');
  assert.ok(dusk > 225 && dusk < 315, `ends in the west, got ${dusk}`);
  assert.ok(sunAt(0.5).azimuthDeg > sunAt(0.25).azimuthDeg, 'sweeps one way only');
  // South of the equator the noon sun is due north.
  const south = sunAt(0.5, { latitudeDeg: -30 }).azimuthDeg;
  close(south, 0, 1e-9, 'due north at noon in the southern hemisphere');
  assert.ok(sunAt(0, { latitudeDeg: -30 }).azimuthDeg < 135, 'still rises in the east');
  assert.ok(sunAt(1, { latitudeDeg: -30 }).azimuthDeg > 225, 'still sets in the west');
  // Degrees and radians agree.
  close(sunAt(0.3).azimuth, sunAt(0.3).azimuthDeg * DEG, 1e-12);
  close(sunAt(0.3).elevation, sunAt(0.3).elevationDeg * DEG, 1e-12);
});

// This is the test that the inline version could not have passed. The old
// shadow was lerp(1.45, 0.4, triangular) — linear in a triangle. These are
// the values a sundial gives.
test('shadowLength is h / tan(elevation), the geometry, not a ramp', () => {
  for (const e of [10, 25, 45, 60, 75]) {
    close(shadowLength(100, e), 100 / Math.tan(e * DEG), 1e-9, `${e} degrees`);
  }
  // At 45 degrees a shadow is exactly as long as the thing casting it.
  close(shadowLength(72, 45), 72, 1e-9, '45 degrees is the isoceles case');
});

test('a shadow shortens monotonically as the sun climbs', () => {
  let prev = Infinity;
  for (const e of [5, 10, 20, 30, 45, 60, 80]) {
    const len = shadowLength(72, e);
    assert.ok(len < prev, `shorter at ${e} than below it (${len} < ${prev})`);
    prev = len;
  }
});

test('a low sun throws a far longer shadow than a straight-line ramp would', () => {
  // The reason the old lerp was wrong: it could not be steep enough at dawn.
  // A ramp through the two endpoints is roughly linear; 1/tan is not.
  const dawn = shadowLength(72, 6);   // just up
  const noon = shadowLength(72, 72);  // near overhead
  const ratio = dawn / noon;
  assert.ok(ratio > 10, `dawn shadows are an order of magnitude longer, got ${ratio.toFixed(1)}x`);
  // A linear interpolation between the same two would be about 1/0.1 = 10x
  // only if it were exponential; the real curve is far more extreme than that
  // at the low end, which is the visible difference.
  assert.ok(dawn > 6 * 72, `a 6-degree sun throws a shadow over six body heights, got ${(dawn / 72).toFixed(1)}`);
});

test('a shadow below the horizon is held, not sent to infinity', () => {
  // The sun at or under the horizon has no defined shadow length, so the
  // result is the floor's, not a division by a vanishing tangent.
  const held = shadowLength(72, 0.5);  // the default minElevationDeg
  close(shadowLength(72, 0), held, 1e-9, 'at the horizon is the floor value');
  close(shadowLength(72, -3), held, 1e-9, 'below it does not run away');
  assert.ok(Number.isFinite(shadowLength(72, -90)), 'and is still a number');
  // and it does not run past the cap either, however far under
  assert.ok(shadowLength(72, -90) <= 24 * 72, 'held at the cap, not above it');
});

test('the cap is in heights of the caster, so it scales with the thing', () => {
  // A bug worth pinning: an absolute cap silently clamps every short caster
  // to the same few pixels, which looks fine for one height and wrong for all
  // the others.
  for (const h of [10, 72, 300]) {
    const capped = shadowLength(h, 0.2, { max: 4 });
    assert.equal(capped, 4 * h, `a ${h}-unit caster caps at 4 of its own heights`);
  }
  // A sun straight overhead gives a very short shadow, and that is geometry,
  // not the cap: 89.9 degrees means the shadow is a hundredth of the height.
  close(shadowLength(72, 89.9), 72 / Math.tan(89.9 * DEG), 1e-9, 'near the zenith is a stub');
  assert.ok(shadowLength(72, 89.9) < 1, 'and it really is tiny');
});

test('nothing is thrown without a caster, and a negative height is not one', () => {
  assert.equal(shadowLength(0, 40), 0);
  assert.equal(shadowLength(-10, 40), 0);
  assert.equal(shadowLength(72, 40, { max: 0 }), 0);
});

test('a shadow is thrown away from the sun, never toward it', () => {
  // Sun in the east (90) throws west: negative x, and the vector is a unit.
  const [x, y] = shadowDir(90);
  assert.ok(x < 0, 'away from the sun in x');
  close(Math.hypot(x, y), 1, 1e-12, 'unit length');
  close(shadowDir(90)[1], 0, 1e-12, 'due west, no north-south component');

  // And the exact opposite azimuth is the exact opposite direction.
  const east = shadowDir(90), behind = shadowDir(270);
  close(behind[0], -east[0], 1e-12, 'flipping the sun flips the shadow');
  close(behind[1], -east[1], 1e-12);

  // Sun in the south (180) throws north, which on screen is up, so -y.
  assert.ok(shadowDir(180)[1] < 0, 'a southern sun throws the shadow up the page');
});

test('seam: shadowDir fed sunAt output points away from the sun, all day, both hemispheres', () => {
  for (const latitudeDeg of [15, 50, -30]) {
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const b = sunAt(t, { latitudeDeg }).azimuthDeg * DEG;
      // The sun's direction on the ground: +x east, north up the page (-y).
      const toSun = [Math.sin(b), -Math.cos(b)];
      const d = shadowDir(sunAt(t, { latitudeDeg }).azimuthDeg);
      close(d[0] * toSun[0] + d[1] * toSun[1], -1, 1e-9, `shadow opposes the sun at t=${t}, lat ${latitudeDeg}`);
    }
  }
  // Morning sun is in the east, so the shadow falls west (-x); evening, east.
  assert.ok(shadowDir(sunAt(0.1).azimuthDeg)[0] < 0, 'morning shadow falls west');
  assert.ok(shadowDir(sunAt(0.9).azimuthDeg)[0] > 0, 'evening shadow falls east');
  assert.ok(shadowDir(sunAt(0.5).azimuthDeg)[1] < 0, 'noon shadow falls north, up the page');
});

test('daylight comes from the sun altitude, so it cannot drift from it', () => {
  const low = daylight(6), high = daylight(70);
  assert.ok(high.intensity > low.intensity, 'more light at noon');
  assert.ok(high.warmth < low.warmth, 'cooler light at noon, warmer at dawn');
  // 90 degrees straight down: no warmth left, full strength
  close(daylight(90).warmth, 0, 1e-12);
  close(daylight(90).intensity, 1, 1e-12);
  // below the horizon: no warmth claim beyond the floor, never negative
  const night = daylight(-5);
  assert.equal(night.warmth, 1, 'as warm as it gets, and no more');
  assert.ok(night.intensity > 0 && night.intensity <= 0.1, 'but only the floor of light');
});

test('sunAt and shadowLength agree: the shadow really does shorten across the day', () => {
  // The point of having both. Sampling the day through the model's own sun and
  // asking for the shadow, rather than trusting two curves to stay in step.
  let prev = Infinity, grew = false, shrank = false;
  for (let t = 0.05; t <= 0.95; t += 0.05) {
    const len = shadowLength(72, sunAt(t).elevationDeg);
    if (len > prev) grew = true;
    if (len < prev) shrank = true;
    prev = len;
  }
  assert.ok(grew && shrank, 'the shadow both lengthens at dawn and shortens toward noon');
  // The shortest point of the whole day is at noon.
  let shortest = Infinity, at = 0;
  for (let t = 0; t <= 1; t += 0.01) {
    const len = shadowLength(72, sunAt(t).elevationDeg);
    if (len < shortest) { shortest = len; at = t; }
  }
  assert.ok(Math.abs(at - 0.5) < 0.02, `the shortest shadow is at noon, found it at t=${at.toFixed(2)}`);
});
