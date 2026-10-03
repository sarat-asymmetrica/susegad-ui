import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDENTITY, qMul, qNorm, qConj, qDot, qAngle, fromAxisAngle, fromEuler, fromMatrix, toMatrix3, toMatrix4, rotate, lookAt, slerp, damp, forward, up, cssMatrix3d } from './quat.core.js';

const DEG = Math.PI / 180;
const src = readFileSync(new URL('./quat.core.js', import.meta.url), 'utf8');
const a = fromEuler(18, -42, 9);              // one orientation to reuse, not a degenerate one
const b = fromAxisAngle([0.3, 1, -0.2], 1.2);
const near = (x, y, eps = 1e-9) => Math.abs(x - y) < eps;
const unit = (q, eps = 1e-9) => Math.abs(Math.hypot(q[0], q[1], q[2], q[3]) - 1) < eps;

test('the core imports nothing, so it is pure maths and runs in Node', () => {
  assert.equal(/^\s*import\b/m.test(src), false, 'no import statement');
  assert.equal(/require\s*\(/.test(src), false, 'no require');
  for (const lib of ['preact', 'react', 'gl-matrix', 'requestAnimationFrame', 'document']) assert.equal(new RegExp(lib, 'i').test(src), false, lib);
});

test('every orientation this core hands out is unit-norm', () => {
  const qs = [
    IDENTITY, qNorm([0, 0, 0, 0]), qNorm([0, 0, 0, 7]), qNorm([1, 2, 3, 4]),
    qMul(a, b), qConj(a), fromAxisAngle([1, 2, 3], 1.1), fromEuler(12, -30, 7),
    fromMatrix(toMatrix3(a)), slerp(a, b, 0.37), damp(a, b, 0.5, 0.9),
    lookAt([0, 0, 3], [0, 0, 0]), lookAt([0, 0, 0], [0, 0, 0]),
  ];
  for (const q of qs) assert.ok(unit(q), `not unit: ${JSON.stringify(q)}`);
  assert.deepEqual(qNorm([0, 0, 0, 0]), IDENTITY, 'a degenerate input has no orientation to keep');
  assert.deepEqual(fromAxisAngle([0, 0, 0], 1), IDENTITY, 'a zero axis leaves the orientation alone');
});

test('qAngle ignores the sign, because q and -q are the same orientation', () => {
  assert.ok(near(qDot(a, a), 1, 1e-12));
  assert.ok(near(qAngle(a, qNorm([-a[0], -a[1], -a[2], -a[3]])), 0));
  assert.ok(near(qAngle(IDENTITY, fromAxisAngle([0, 1, 0], Math.PI)), Math.PI));
  const v = rotate(qMul(a, qConj(a)), [0.4, -1, 2]);
  assert.ok(near(v[0], 0.4) && near(v[1], -1) && near(v[2], 2), 'conjugation undoes the turn');
  assert.ok(near(qAngle(a, qNorm([a[0] * 3, a[1] * 3, a[2] * 3, a[3] * 3])), 0), 'and scale does not move it');
});

test('slerp takes the short way round and turns at a steady rate', () => {
  const stored = fromAxisAngle([0, 1, 0], 200 * DEG);  // stored as a 200 degree turn, the long reading of the pair
  assert.ok(qDot(IDENTITY, stored) < 0, 'the pair as stored is more than a right angle apart');
  assert.ok(qAngle(slerp(IDENTITY, stored, 0.5), IDENTITY) < Math.PI / 2, 'the midpoint is under a right angle from the start');
  assert.ok(near(qAngle(slerp(IDENTITY, stored, 1), stored), 0), 't = 1 lands on the target, whichever way it was stored');
  let last = -1;
  for (let i = 0; i <= 10; i++) {
    const d = qAngle(slerp(IDENTITY, stored, i / 10), IDENTITY);
    assert.ok(d >= last - 1e-9, `grows with t, at ${i / 10}`);
    last = d;
  }
  assert.ok(near(last, qAngle(IDENTITY, stored), 1e-6), 'and ends at the geodesic angle between them');
  assert.ok(near(qAngle(slerp(a, b, -5), a), 0), 't is clamped below');
  assert.ok(near(qAngle(slerp(a, b, 5), b), 0), 'and above');
});

test('damp settles the same at any frame rate, on the exponential curve', () => {
  for (const tau of [0.45, 0.9, 2.4]) {
    let q = IDENTITY;
    for (let i = 0; i < 100; i++) q = damp(q, b, 0.01, tau);      // a hundred slow frames
    const one = damp(IDENTITY, b, 1, tau);                        // one long frame of the same second
    assert.ok(qAngle(q, one) < 1e-3, `tau ${tau}: ${qAngle(q, one)} rad apart`);
  }
  assert.ok(near(qAngle(damp(IDENTITY, b, 0.9, 0.9), b), qAngle(IDENTITY, b) / Math.E, 1e-6), 'one time constant leaves 1/e of the turn');
});

test('the matrix and the quaternion are two spellings of one rotation', () => {
  for (const q of [IDENTITY, a, fromAxisAngle([1, 1, 0], 2)]) {
    assert.ok(near(qAngle(fromMatrix(toMatrix3(q)), q), 0, 1e-7), 'a round trip comes back to the same orientation');
  }
  const m = toMatrix3(fromAxisAngle([0, 1, 0], Math.PI / 2));
  assert.ok(near(m[6], 1, 1e-9) && near(m[8], 0, 1e-9), 'column 2 of a right turn about +Y is +X');
  const v = rotate(fromAxisAngle([0, 1, 0], Math.PI / 2), [0, 0, 1]);
  assert.ok(near(v[0], 1) && near(v[2], 0), 'so a positive turn about +Y carries +Z to +X, to the right');
  const four = toMatrix4(IDENTITY);
  assert.equal(four.length, 16);
  assert.deepEqual(four.slice(12), [0, 0, 0, 1], 'the last column is the untouched translation');
});

test('fromEuler turns roll, then yaw, then pitch, in that order', () => {
  const f = forward(fromEuler(0, 90, 0));
  assert.ok(near(f[0], -1) && near(f[2], 0), 'a right turn about +Y carries the face from -Z to -X');
  const u = up(fromEuler(0, 0, 90));
  assert.ok(near(u[0], -1) && near(u[1], 0), 'a roll about +Z carries up to -X');
  const both = up(fromEuler(90, 90, 0));
  assert.ok(near(both[2], 1) && near(both[0], 0), 'pitch lands on the already yawed frame, not before it');
});

test('lookAt faces the target, and forward and up read the axes back', () => {
  const q = lookAt([0, 0, 3], [0, 0, 0]);
  const f = forward(q);
  assert.ok(near(f[0], 0) && near(f[1], 0) && near(f[2], -1), 'from z = 3 the words face back along -Z');
  const side = lookAt([3, 0, 0], [0, 0, 0]);
  const g = forward(side);
  assert.ok(near(g[0], -1) && near(g[2], 0), 'from x = 3 they face along -X');
  assert.ok(near(up(side)[1], 1, 1e-9), 'and up is still up');
  assert.deepEqual(lookAt([1, 1, 1], [1, 1, 1]), IDENTITY, 'a plane looking at itself has no turn to take');
  assert.equal(unit(lookAt([5, 0, 0], [0, 0, 0], [1, 0, 0])), true, 'and it survives an up in line with the look');
});

test('cssMatrix3d is a matrix3d string of sixteen numbers at six decimals', () => {
  assert.match(cssMatrix3d(fromEuler(0, 6, 0)), /^matrix3d\(-?\d+\.\d{6}(,-?\d+\.\d{6}){15}\)$/);
  assert.equal(cssMatrix3d(IDENTITY),
    'matrix3d(1.000000,0.000000,0.000000,0.000000,0.000000,1.000000,0.000000,0.000000,0.000000,0.000000,1.000000,0.000000,0.000000,0.000000,0.000000,1.000000)');
  assert.equal(cssMatrix3d(a).includes('e'), false, 'never exponential notation');
});