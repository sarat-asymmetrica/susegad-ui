// Quaternion maths for the words-in-world primitive: the pure part. No DOM, no
// renderer, no library, no imports, so it runs in Node.
//
// A quaternion is [x, y, z, w], right-handed, w last, unit-norm, with angles in
// radians unless a name says Deg. One orientation is one slerp, one matrix3d.

const DEG = Math.PI / 180;
const EPS = 1e-12;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const vnorm = v => { const n = Math.hypot(v[0], v[1], v[2]); return n < EPS ? [0, 0, 0] : [v[0] / n, v[1] / n, v[2] / n]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** The orientation that faces the viewer. */
export const IDENTITY = [0, 0, 0, 1];

/** The Hamilton product a * b: b turns first, then a. */
export function qMul(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Unit-norm; a zero-length quaternion becomes identity. */
export function qNorm(a) {
  const n = Math.hypot(a[0], a[1], a[2], a[3]);
  return n < EPS ? [0, 0, 0, 1] : [a[0] / n, a[1] / n, a[2] / n, a[3] / n];
}

/** The conjugate: the same turn backwards. */
export const qConj = a => [-a[0], -a[1], -a[2], a[3]];

/** The dot product; its sign gives the short way or the long way. */
export const qDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

/** The angle between two orientations, 0 to PI; q and -q are one turn. */
export const qAngle = (a, b) => 2 * Math.acos(clamp(Math.abs(qDot(a, b)), 0, 1));

/** A turn of `rad` about `axis`; a zero axis leaves the orientation alone. */
export function fromAxisAngle(axis, rad) {
  const n = Math.hypot(axis[0], axis[1], axis[2]);
  if (n < EPS) return [0, 0, 0, 1];
  const s = Math.sin(rad / 2) / n;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(rad / 2)];
}

/** Euler degrees: roll (Z), then yaw (Y), then pitch (X). */
export const fromEuler = (pitchDeg, yawDeg, rollDeg) => qMul(qMul(
  fromAxisAngle([1, 0, 0], pitchDeg * DEG),
  fromAxisAngle([0, 1, 0], yawDeg * DEG)),
  fromAxisAngle([0, 0, 1], rollDeg * DEG));

/** A 3x3 column-major rotation matrix, as toMatrix3 returns it, read back as an orientation. */
export function fromMatrix(m) {
  const [m00, m10, m20, m01, m11, m21, m02, m12, m22] = m, tr = m00 + m11 + m22;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; return qNorm([(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]); }
  if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; return qNorm([0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]); }
  if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; return qNorm([(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]); }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return qNorm([(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]);
}

/** The rotation as a 3x3 column-major matrix. */
export function toMatrix3(q) {
  const [x, y, z, w] = qNorm(q);
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy),
    2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx),
    2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy),
  ];
}

/** The rotation as a 4x4 column-major matrix: the numbers a CSS matrix3d wants. */
export const toMatrix4 = q => {
  const m = toMatrix3(q);
  return [m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1];
};

/** The vector v turned by the orientation q. */
export function rotate(q, v) {
  const [x, y, z, w] = qNorm(q);
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

/** The orientation of a plane at `from` facing `to`, with `up` roughly upward. */
export function lookAt(from, to, up = [0, 1, 0]) {
  const z = vnorm([from[0] - to[0], from[1] - to[1], from[2] - to[2]]);
  if (!z[0] && !z[1] && !z[2]) return [0, 0, 0, 1];             // facing itself: no direction to take
  let x = vnorm(cross(up, z));
  if (!x[0] && !x[1] && !x[2]) x = vnorm(cross([0, 0, 1], z));  // up in line with the look: choose another
  const y = cross(z, x);
  return fromMatrix([x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]]);
}

/** The shortest turn from a to b, t clamped to 0..1. */
export function slerp(a, b, t) {
  const k = clamp(t, 0, 1);
  let d = qDot(a, b), [bx, by, bz, bw] = b;
  if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }  // the short way round, never the long one
  if (d > 0.9995) return qNorm([a[0] + (bx - a[0]) * k, a[1] + (by - a[1]) * k, a[2] + (bz - a[2]) * k, a[3] + (bw - a[3]) * k]);
  const th = Math.acos(clamp(d, -1, 1)), s = Math.sin(th);
  const w0 = Math.sin((1 - k) * th) / s, w1 = Math.sin(k * th) / s;
  return qNorm([a[0] * w0 + bx * w1, a[1] * w0 + by * w1, a[2] * w0 + bz * w1, a[3] * w0 + bw * w1]);
}

/** Slerp toward b with k = 1 - exp(-dt / tau): any frame rate settles alike. */
export const damp = (a, b, dt, tau) => slerp(a, b, 1 - Math.exp(-Math.max(0, dt) / Math.max(1e-3, tau)));

/** The -Z axis: where a camera looks, and where a text plane faces. */
export const forward = q => rotate(q, [0, 0, -1]);

/** The +Y axis of the orientation. */
export const up = q => rotate(q, [0, 1, 0]);

/** "matrix3d(...)": sixteen numbers at six decimals. */
export const cssMatrix3d = q => `matrix3d(${toMatrix4(q).map(n => n.toFixed(6)).join(',')})`;