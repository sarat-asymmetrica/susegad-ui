// Signature: the pure core. Runs in Node.
//
// A stroke is the samples the pointer gave us, [x, y, t, pressure], in the
// pad's logical units (600 × 200). The ink is the engine's hand-inked ribbon
// idea driven by the hand instead of by noise: width comes from the pen's
// pressure when there is a pen, and from speed always (a quick stroke thins,
// a slow one pools), with a soft start and a flicked or blunt end. The same
// ribbon is painted on the pad and exported as SVG path data, so what the
// server receives is exactly what the person saw.

import { clamp, smoothstep, lerp } from '../../engine/src/math.js';

/** Every word the component adds. Kathakar owns these. */
export const STRINGS = {
  help: 'Sign in the box with your finger, a pen or the mouse. Or type your full name below.',
  undo: 'Undo last stroke',
  clear: 'Start again',
  signed: 'Signed by drawing. You can undo or start again.',
  cleared: 'Signature cleared.',
  required: 'Sign in the box, or type your full name.',
};

/** The pad's logical size and where the signing line sits. */
export const PAD = { W: 600, H: 200, line: 150 };

/** The broad nib's edge, in radians (up and to the right on screen). */
const NIB = -35 * Math.PI / 180;

/** The pen for each register: quiet a plain pen, warm and playful a broad nib. */
export const penFor = register => (register === 'quiet' ? { base: 2.4, nib: 0 } : { base: 3.4, nib: 0.62 });

/**
 * Pen width at each sample. Pressure counts only from a real pen (a mouse
 * always reports 0.5, most touch screens 0 or 1); speed always counts.
 * @param {number[][]} pts [x, y, t, p]
 * @param {{ base?: number, pen?: boolean }} [opts]
 * @returns {{ widths: number[], endSpeed: number }}
 */
export function strokeWidths(pts, { base = 2.6, pen = false } = {}) {
  const widths = [];
  let v = 0, w = null;
  for (let i = 0; i < pts.length; i++) {
    if (i) {
      const [x0, y0, t0] = pts[i - 1], [x, y, t] = pts[i];
      v = v * 0.6 + (Math.hypot(x - x0, y - y0) / Math.max(4, t - t0)) * 0.4;
    }
    const pr = pen ? clamp(pts[i][3] ?? 0.5, 0.05, 1) : 0.5;
    const target = base * (0.45 + pr * 1.1) * (0.5 + 0.75 / (1 + 1.6 * v));
    w = w === null ? target : w + (target - w) * 0.35;
    widths.push(w);
  }
  return { widths, endSpeed: v };
}

/** Catmull-Rom through [x, y, w] triples, a few samples per segment. */
function smooth(P) {
  const n = P.length, out = [];
  const get = i => P[clamp(i, 0, n - 1)];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = P[i], p2 = P[i + 1], p3 = get(i + 2);
    const k = clamp(Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 3), 1, 8);
    for (let s = 0; s < k; s++) {
      const t = s / k, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(P[n - 1].slice());
  return out;
}

const cap = (out, [x, y], r, from, to, steps = 6) => {
  for (let i = 1; i < steps; i++) { const a = lerp(from, to, i / steps); out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
};

/**
 * The ink ribbon of one stroke as a closed polygon, round at both ends. A tap
 * is a dot. The start swells in over a few units; a quick lift flicks thin,
 * a slow one stays blunt. `nib` (0..1) is a broad nib held at 35 degrees:
 * strokes along its edge come out hairline, strokes across it full, which is
 * where handwriting gets its thick downstrokes and thin joins.
 * @param {number[][]} pts [x, y, t, p]
 * @param {{ base?: number, pen?: boolean, nib?: number }} [opts]
 * @returns {number[][]} polygon points [x, y]
 */
export function ribbon(pts, opts = {}) {
  const nib = opts.nib ?? 0;
  const P = [];
  for (const p of pts) { const q = P[P.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= 0.6) P.push(p); }
  if (!P.length) return [];
  const { widths, endSpeed } = strokeWidths(P, opts);
  if (P.length === 1) {
    const r = Math.max(1.3, widths[0] * 0.6), out = [];
    cap(out, P[0], r, 0, Math.PI * 2, 14);
    return out;
  }
  const C = smooth(P.map((p, i) => [p[0], p[1], widths[i]]));
  const n = C.length, cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));
  const total = cum[n - 1], flick = endSpeed > 0.9;
  const L = [], R = [], ang = [];
  for (let i = 0; i < n; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)];
    const t = Math.atan2(b[1] - a[1], b[0] - a[0]);
    let w = C[i][2] * (0.45 + 0.55 * smoothstep(0, 7, cum[i])) * (1 - nib + nib * Math.abs(Math.sin(t - NIB)));
    if (flick) w *= 0.25 + 0.75 * smoothstep(0, 16, total - cum[i]);
    const r = Math.max(0.35, w / 2), nx = -Math.sin(t) * r, ny = Math.cos(t) * r;
    L.push([C[i][0] + nx, C[i][1] + ny]); R.push([C[i][0] - nx, C[i][1] - ny]); ang.push([t, r]);
  }
  const out = [...L];
  cap(out, C[n - 1], ang[n - 1][1], ang[n - 1][0] + Math.PI / 2, ang[n - 1][0] - Math.PI / 2);
  for (let i = n - 1; i >= 0; i--) out.push(R[i]);
  cap(out, C[0], ang[0][1], ang[0][0] - Math.PI / 2, ang[0][0] - Math.PI * 1.5);
  return out;
}

const f1 = v => String(Math.round(v * 10) / 10);

/** Polygons to SVG path data, one decimal. @param {number[][][]} polys */
export function toPathData(polys) {
  return polys.filter(p => p.length > 2).map(p => `M${p.map(q => `${f1(q[0])} ${f1(q[1])}`).join('L')}Z`).join('');
}

/** A whole signature as a standalone SVG, the ink in `color`. */
export function toSVG(d, color = '#1d2742') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAD.W} ${PAD.H}"><path fill="${color}" d="${d}"/></svg>`;
}
