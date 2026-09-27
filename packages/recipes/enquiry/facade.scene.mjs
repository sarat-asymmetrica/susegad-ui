// The front elevation of a Goan villa, as strokes. Pure; runs in Node.
//
// Harvested from the villa redesign's elevation.js (buildScene and its
// helpers), where it draws itself in ink over the
// photograph. Copied, not edited at the source: the imports now come from the
// engine, and the tone, notes and title block are left out, because the
// enquiry page uses a still line drawing only. facade.bake.mjs turns these
// strokes into facade.svg.

import { clamp, lerp, dist, TAU } from '../../engine/src/math.js';
import { rng } from '../../engine/src/rng.js';

export const W = 1080, H = 1200;

// ── geometry helpers (pure) ─────────────────────────────────────────────

const seg = (x1, y1, x2, y2) => [[x1, y1], [x2, y2]];
const poly = (...xy) => { const o = []; for (let i = 0; i < xy.length; i += 2) o.push([xy[i], xy[i + 1]]); return o; };
/** Upper half of an ellipse from the left end to the right end (a: π → 2π). */
function upperArc(cx, cy, rx, ry, n = 48) {
  const o = [];
  for (let i = 0; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI; o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return o;
}
function circle(cx, cy, r, n = 64, a0 = -Math.PI / 2) {
  const o = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * TAU; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return o;
}
/** A jamb–arch–jamb outline: up the left, over the arch, down the right. */
function archOpening(cx, spring, r, bottom, n = 40) {
  return [[cx - r, bottom], ...upperArc(cx, spring, r, r, n), [cx + r, bottom]];
}
const lengthOf = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; };

// ── the scene (pure) ────────────────────────────────────────────────────

const CX = 526;               // the facade's centre line
const GABLE_TOP = [
  ...poly(42, 400, 172, 400, 172, 375, 262, 375, 262, 329),
  ...upperArc(CX, 330, 186, 128, 56),
  ...poly(772, 330, 772, 358, 888, 358, 888, 395, 1080, 395),
];
export const SILHOUETTE = [[0, 1140], [0, 512], [42, 512], ...GABLE_TOP, [1080, 1140]];

export function buildScene(seed = 1) {
  const r = rng(`elevation:${seed}`);
  const strokes = [];
  // A "pen" hands out start times: each stroke starts `overlap` of the way
  // through the previous one, and lasts as long as its length at `speed`.
  const pen = (start, speed, overlap, min = 0.12, max = 0.9) => {
    let cursor = start;
    const mine = [];
    const add = (pts, o = {}) => {
      const dur = clamp(lengthOf(pts) / speed, min, max);
      const s = { pts, t0: cursor, dur, ...o };
      strokes.push(s); mine.push(s);
      cursor += dur * overlap;
      return s;
    };
    /** Squeeze this pen's strokes so the last one finishes by `end`. */
    add.fit = end => {
      const last = Math.max(...mine.map(s => s.t0 + s.dur));
      if (last <= end) return;
      const k = (end - start) / (last - start);
      for (const s of mine) { s.t0 = start + (s.t0 - start) * k; s.dur = Math.max(0.06, s.dur * Math.min(1, k * 1.6)); }
    };
    return add;
  };

  // 1 · construction lines: faint, straight, run past the building
  const con = pen(0.1, 2600, 0.22, 0.25, 0.5);
  for (const y of [330, 400, 512, 548, 712, 895, 1095]) con(seg(-20, y, 1100, y), { kind: 'construct' });
  for (const x of [202, 853]) con(seg(x, 560, x, 1160), { kind: 'construct' });
  con(circle(CX, 712, 118, 72), { kind: 'construct' });
  con(circle(202, 712, 116, 72), { kind: 'construct' });
  con(circle(853, 712, 116, 72), { kind: 'construct' });
  con(circle(524, 297, 62, 56), { kind: 'construct' });
  // the centre line, dash-dot, as architects draw an axis of symmetry
  for (let y = 168, i = 0; y < 1200; i++) {
    const len = i % 2 ? 7 : 34;
    con(seg(CX, y, CX, y + len), { kind: 'construct', dash: true });
    y += len + 10;
  }

  con.fit(1.4);

  // 2 · outlines: one confident pen per edge
  const out = pen(0.95, 2300, 0.55, 0.14, 0.8);
  out(GABLE_TOP, { kind: 'line' });
  out(seg(42, 402, 42, 512), { kind: 'line' });
  // cap mouldings under each ledge
  out(seg(42, 411, 172, 411), { kind: 'detail' });
  out(seg(172, 386, 262, 386), { kind: 'detail' });
  out(seg(262, 339, 346, 339), { kind: 'detail' });
  out(upperArc(CX, 332, 162, 104, 48), { kind: 'line' });
  out(seg(706, 340, 772, 340), { kind: 'detail' });
  out(seg(772, 369, 888, 369), { kind: 'detail' });
  out(seg(888, 406, 1080, 406), { kind: 'detail' });
  out(seg(1010, 408, 1010, 512), { kind: 'detail' });
  // oculus
  out(circle(524, 297, 48, 60), { kind: 'line' });
  out(circle(524, 297, 40, 56), { kind: 'detail' });
  out(circle(524, 297, 28, 48), { kind: 'line' });
  // cornice band
  out(seg(0, 512, 1080, 512), { kind: 'line' });
  out(seg(0, 523, 1080, 523), { kind: 'detail' });
  out(seg(0, 548, 1080, 548), { kind: 'line' });
  // pilasters and their capitals
  for (const [a, b] of [[330, 400], [652, 724]]) {
    out(poly(a - 6, 548, a - 6, 562, b + 6, 562, b + 6, 548), { kind: 'detail' });
    out(seg(a, 562, a, 1095), { kind: 'line' });
    out(seg(b, 562, b, 1095), { kind: 'line' });
  }
  // the front door: surround, leaves, the meeting stile
  out(archOpening(528, 712, 108, 1045, 44), { kind: 'line' });
  out(archOpening(528, 712, 96, 1045, 40), { kind: 'detail' });
  out(seg(528, 617, 528, 1045), { kind: 'detail' });
  // windows
  for (const cx of [202, 853]) {
    out(archOpening(cx, 710, 106, 895, 44), { kind: 'line' });
    out(archOpening(cx, 710, 94, 889, 40), { kind: 'detail' });
    out(seg(cx - 94, 889, cx + 94, 889), { kind: 'detail' });
    out(poly(cx - 116, 894, cx + 116, 894, cx + 116, 906, cx - 116, 906, cx - 116, 894), { kind: 'line' });
  }
  // landing, step, plinth, ground
  out(poly(408, 1085, 408, 1045, 648, 1045, 648, 1085), { kind: 'line' });
  out(poly(318, 1136, 318, 1085, 730, 1085, 730, 1136), { kind: 'line' });
  out(seg(0, 1095, 318, 1095), { kind: 'detail' });
  out(seg(730, 1095, 1080, 1095), { kind: 'detail' });
  out(seg(0, 1140, 1080, 1140), { kind: 'line' });

  out.fit(4.2);

  // 3 · details: joinery, lamps, plants, palms, the path
  const det = pen(3.55, 2400, 0.3, 0.08, 0.45);
  for (const cx of [202, 853]) {
    det(seg(cx - 94, 716, cx + 94, 716), { kind: 'detail' });
    det(seg(cx - 94, 726, cx + 94, 726), { kind: 'detail' });
    det(upperArc(cx, 716, 32, 32, 24), { kind: 'detail' });
    det(upperArc(cx, 716, 64, 64, 36), { kind: 'fine' });
    for (const a of [Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75]) {
      det(seg(cx + Math.cos(a) * 32, 716 + Math.sin(a) * 32, cx + Math.cos(a) * 94, 716 + Math.sin(a) * 94), { kind: 'fine' });
    }
    det(seg(cx - 5, 726, cx - 5, 889), { kind: 'fine' });
    det(seg(cx + 5, 726, cx + 5, 889), { kind: 'fine' });
    det(seg(cx - 94, 806, cx + 94, 806), { kind: 'fine' });
    for (const s of [-1, 1]) {
      const a = cx + s * 14, b = cx + s * 84;
      det(poly(a, 736, b, 736, b, 798, a, 798, a, 736), { kind: 'fine' });
      det(poly(a, 814, b, 814, b, 880, a, 880, a, 814), { kind: 'fine' });
    }
  }
  // door panels
  for (const [a, b] of [[446, 514], [542, 610]]) {
    for (const [y0, y1] of [[676, 728], [742, 790], [806, 876], [892, 958], [974, 1030]]) det(poly(a, y0, b, y0, b, y1, a, y1, a, y0), { kind: 'fine' });
  }
  // wall lanterns
  for (const x of [362, 690]) {
    det(poly(x - 12, 688, x, 672, x + 12, 688), { kind: 'detail' });
    det(poly(x - 10, 688, x - 8, 716, x + 8, 716, x + 10, 688, x - 10, 688), { kind: 'detail' });
    det(seg(x, 716, x, 726), { kind: 'fine' });
  }
  // potted plants
  const plant = (cx) => {
    det(poly(cx - 21, 1088, cx - 16, 1128, cx + 16, 1128, cx + 21, 1088, cx - 21, 1088), { kind: 'detail' });
    const n = r.int(4, 6);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 1.9 + r.range(-0.12, 0.12);
      const len = r.range(70, 118), bend = r.range(8, 22) * Math.sign(Math.cos(a) || 1);
      const bx = cx + r.range(-6, 6), by = 1086;
      const tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
      const nx = -Math.sin(a), ny = Math.cos(a);
      const leaf = [];
      for (let k = 0; k <= 10; k++) { const u = k / 10, w = Math.sin(u * Math.PI) * 10; leaf.push([lerp(bx, tx, u) + nx * (w + bend * u * u), lerp(by, ty, u) + ny * (w + bend * u * u)]); }
      for (let k = 10; k >= 0; k--) { const u = k / 10, w = Math.sin(u * Math.PI) * 10; leaf.push([lerp(bx, tx, u) - nx * (w - bend * u * u), lerp(by, ty, u) - ny * (w - bend * u * u)]); }
      det(leaf, { kind: 'soft' });
    }
  };
  [140, 195, 248, 302, 876, 926, 988].forEach(plant);
  // palms behind the right of the gable (ink only; they sit outside the silhouette)
  const palm = (x, y, span, n) => {
    for (let i = 0; i < n; i++) {
      // fronds fan out and arch over: steeper ones rise, flatter ones droop
      const a = -Math.PI * 0.98 + (i / (n - 1)) * Math.PI * 0.96 + r.range(-0.08, 0.08);
      const len = span * r.range(0.8, 1.08);
      const lift = Math.max(0, -Math.sin(a)) * 0.55;
      const spine = [];
      for (let k = 0; k <= 14; k++) {
        const u = k / 14;
        spine.push([x + Math.cos(a) * len * u, y + Math.sin(a) * len * u * (1 - u * 0.35) - lift * len * u * 0.2 + len * u * u * 0.5]);
      }
      det(spine, { kind: 'soft', outside: true });
      // leaflets hang from the spine, drawn along with it
      const leaflets = [];
      for (let k = 2; k < 14; k++) {
        const [px, py] = spine[k], [qx, qy] = spine[k + 1];
        const tang = Math.atan2(qy - py, qx - px);
        for (const side of [-1, 1]) {
          const ang = tang + side * r.range(0.75, 1.05);
          const l = (40 - k * 2) * r.range(0.85, 1.1);
          const mx = px + Math.cos(ang) * l * 0.5, my = py + Math.sin(ang) * l * 0.5 + 3;
          leaflets.push([[px, py], [mx, my], [px + Math.cos(ang) * l, py + Math.sin(ang) * l + 12]]);
        }
      }
      strokes[strokes.length - 1].leaflets = leaflets;
    }
  };
  palm(866, 236, 150, 11);
  palm(1082, 300, 118, 7);
  // the path: stone slabs in the lawn
  const slabs = [
    [-10, 1206, 108, 1270], [188, 1203, 352, 1268], [398, 1203, 556, 1268], [612, 1204, 780, 1268], [824, 1207, 1034, 1272],
    [-10, 1290, 160, 1400], [212, 1288, 430, 1400], [500, 1290, 704, 1400], [762, 1292, 1030, 1400],
  ];
  for (const [x0, y0, x1, y1] of slabs) det(poly(x0, y0, x1, y0 + r.range(-2, 2), x1 + r.range(-3, 3), y1, x0, y1 + r.range(-2, 2), x0, y0), { kind: 'slab', outside: true });
  det(seg(0, 1196, 1080, 1198), { kind: 'soft', outside: true });

  det.fit(5.9);

  return { strokes };
}

