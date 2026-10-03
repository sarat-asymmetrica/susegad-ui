// Toran: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the doorway, the marigold and leaf sprites, the chappals and
// the lota are the plate's own drawing code, brought across line for line.
// What the port adds: the garland comes from the pure doorwayAt() with the
// hand's strokes as timestamped input; the registers; the calm zone; night
// with a lantern for dark pages; a first paint spread over frames that tells
// the element when it is ready; the governor dropping shadows when frames run
// slow; and no redraw at all while nothing moves.

import {
  stage, rng, N, clamp, lerp, TAU, ease, ink, hatch, wash, paper, grainPattern, rgba, mix, roughen, toPath,
} from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import {
  W, H, FRAME, OPEN, CORNICE, STEP, SEAT, NAILS, EAVE_Y, doorwayAt, tapStrokes, sweepStrokes,
} from './model.js';

// ── Side-effect edge: sprites ─────────────────────────────────────────────

const HUES = {
  orange: { h: [18, 28], s: [82, 92], l: [40, 57], rim: '#7a2a06' },
  saffron: { h: [34, 42], s: [85, 95], l: [46, 62], rim: '#8a4a05' },
};
const hsl = (h, s, l) => `hsl(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%)`;
const FR = 14.5, FS = 42, LEAF_L = 60, LEAF_S = [72, 26];

/** One ruffled petal pointing up (−y) from its base at the origin: a narrow
 *  claw opening into a fan whose rim is a row of rounded frills. */
function petalShape(g, s, frill = 5, spread = 0.8) {
  g.beginPath();
  g.moveTo(-s * 0.1, 0);
  const n = frill, rim = [];
  for (let k = 0; k <= n; k++) {
    const a = lerp(-spread, spread, k / n) - Math.PI / 2;
    rim.push([Math.cos(a) * s * 0.8, s * 0.12 + Math.sin(a) * s]);
  }
  g.lineTo(rim[0][0], rim[0][1] + s * 0.18);
  g.lineTo(rim[0][0], rim[0][1]);
  for (let k = 1; k <= n; k++) {
    const [x0, y0] = rim[k - 1], [x1, y1] = rim[k], mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const l = Math.hypot(mx, my - s * 0.12) || 1, bulge = s * 0.22;
    g.quadraticCurveTo(mx + (mx / l) * bulge, my + ((my - s * 0.12) / l) * bulge, x1, y1);
  }
  g.lineTo(rim[n][0], rim[n][1] + s * 0.18);
  g.lineTo(s * 0.1, 0);
  g.closePath();
}

/** A marigold face: rings of frilled petals from the rim inward, each petal
 *  laid over a dark crevice so the flower reads as a crumpled pompom. */
function drawMarigold(g, cx, cy, kind, seed) {
  const r = rng(`mg:${kind}:${seed}`), H0 = HUES[kind];
  g.save(); g.translate(cx, cy);
  g.fillStyle = hsl(H0.h[0] - 4, 75, 22);
  g.beginPath(); g.arc(0, 0, FR * 0.86, 0, TAU); g.fill();
  // [base radius, petal length, count], in units of FR
  const rings = [[0.36, 0.66, 17], [0.26, 0.6, 15], [0.16, 0.52, 13], [0.07, 0.42, 10], [0, 0.3, 6]];
  rings.forEach(([base, len, count], ri) => {
    const depth = ri / (rings.length - 1);
    const off = r() * TAU;
    for (let i = 0; i < count; i++) {
      const a = off + (i / count) * TAU + r.range(-0.18, 0.18);
      const s = FR * len * r.range(0.85, 1.15), d = FR * base * r.range(0.8, 1.2);
      g.save();
      g.translate(Math.cos(a) * d, Math.sin(a) * d);
      g.rotate(a + Math.PI / 2 + r.range(-0.3, 0.3));
      const frill = r.int(3, 5), spread = r.range(0.6, 0.9);
      // the crevice under the petal
      g.save(); g.translate(0.5, 0.8); g.scale(1.08, 1.06);
      petalShape(g, s, frill, spread); g.fillStyle = rgba(H0.rim, 0.55); g.fill();
      g.restore();
      const l = lerp(H0.l[0], H0.l[1], Math.min(1, depth * 0.75 + r() * 0.35));
      const h = r.range(H0.h[0], H0.h[1]), sat = r.range(H0.s[0], H0.s[1]);
      const pg = g.createLinearGradient(0, 0, 0, -s);
      pg.addColorStop(0, hsl(h - 3, sat, l - 12)); pg.addColorStop(0.7, hsl(h, sat, l)); pg.addColorStop(1, hsl(h + 3, sat, Math.min(78, l + 8)));
      g.fillStyle = pg;
      petalShape(g, s, frill, spread); g.fill();
      g.strokeStyle = rgba(H0.rim, 0.5); g.lineWidth = 0.4; g.stroke();
      // a pleat or two down the petal
      g.strokeStyle = rgba(H0.rim, 0.28); g.lineWidth = 0.35; g.beginPath();
      for (let k = 0; k < 2; k++) { const x = r.range(-0.3, 0.3) * s; g.moveTo(x * 0.3, -s * 0.15); g.lineTo(x, -s * 0.85); }
      g.stroke();
      g.restore();
    }
  });
  // pencil grain over the lot
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.14; g.fillStyle = grainPattern(g, '#3a1a06', { lo: 0, hi: 0.9 }); g.fillRect(-FS, -FS, FS * 2, FS * 2);
  g.restore();
}

/** Light that does not turn with the flower: warm top-left, rust bottom-right. */
function drawShade(g, cx, cy) {
  g.save(); g.translate(cx, cy);
  const gr = g.createRadialGradient(-FR * 0.4, -FR * 0.45, 1, 0, 0, FR * 1.05);
  gr.addColorStop(0, 'rgba(255,238,190,0.3)'); gr.addColorStop(0.45, 'rgba(255,220,160,0.05)');
  gr.addColorStop(0.75, 'rgba(90,30,5,0.12)'); gr.addColorStop(1, 'rgba(70,20,0,0.4)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, FR * 1.02, 0, TAU); g.fill();
  g.restore();
}

function leafOutline(len, wid, r) {
  const side = [], n = 22, curl = r.range(-0.06, 0.06);
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = 6 + u * (len - 6);
    const w = (wid / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.85);
    side.push([x, curl * x * u * 3, w]);
  }
  return [...side.map(([x, c, w]) => [x, c + w]), ...side.slice(1, -1).reverse().map(([x, c, w]) => [x, c - w])];
}

function drawLeaf(g, variant, shadow = false) {
  const r = rng(`leaf:${variant}`), len = LEAF_L, wid = r.range(13, 16);
  const pts = leafOutline(len, wid, r);
  const path = toPath(pts, true);
  if (shadow) { g.fillStyle = '#000'; g.fill(path); g.lineWidth = 1.6; g.strokeStyle = '#000'; g.beginPath(); g.moveTo(0, 0); g.lineTo(8, 0); g.stroke(); return; }
  const tones = [['#2f5226', '#557c34'], ['#35592a', '#6a8a3a'], ['#2a4a22', '#4e7431'], ['#4a6a2c', '#86984a']][variant % 4];
  const gr = g.createLinearGradient(0, -wid / 2, 0, wid / 2);
  gr.addColorStop(0, tones[1]); gr.addColorStop(0.5, tones[0]); gr.addColorStop(1, mix(tones[0], '#132410', 0.4));
  g.fillStyle = gr; g.fill(path);
  // gloss along the upper half, veins, midrib
  g.save(); g.clip(path);
  g.fillStyle = 'rgba(230,240,190,0.16)'; g.beginPath(); g.ellipse(len * 0.45, -wid * 0.22, len * 0.33, wid * 0.14, -0.02, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(200,215,150,0.28)'; g.lineWidth = 0.55; g.beginPath();
  for (let x = 14; x < len - 6; x += 5.5) for (const s of [-1, 1]) { g.moveTo(x, 0); g.quadraticCurveTo(x + 4, s * wid * 0.2, x + 8, s * wid * 0.42); }
  g.stroke();
  g.globalAlpha = 0.25; g.fillStyle = grainPattern(g, '#0e1a08', { lo: 0, hi: 0.9 }); g.fillRect(0, -wid, len, wid * 2);
  g.restore();
  ink(g, [[1, 0], [len * 0.7, 0], [len - 2, 0]], { width: 1.1, color: '#c9d49a', alpha: 0.65, jitter: 0.2, taper: 10, seed: variant });
  ink(g, pts, { width: 0.8, color: '#132410', alpha: 0.7, jitter: 0.25, closed: true, seed: variant + 5 });
  ink(g, [[0, 0], [7, 0]], { width: 1.8, color: '#4a3a1c', alpha: 0.9, jitter: 0.1, taper: 2, seed: variant + 9 });
}

function sprite(w, h, k, paint) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
  const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
  paint(g);
  return c;
}

/** Every sprite, one per step, so the first paint can be spread over frames. */
function* buildSprites(px, S) {
  const k = px * 1.6;
  S.flowers = {};
  for (const kind of Object.keys(HUES)) {
    S.flowers[kind] = [];
    for (let v = 0; v < 6; v++) { S.flowers[kind].push(sprite(FS, FS, k, g => drawMarigold(g, FS / 2, FS / 2, kind, v))); yield S.flowers[kind][v]; }
  }
  S.shade = sprite(FS, FS, k, g => drawShade(g, FS / 2, FS / 2));
  S.fshadow = sprite(FS * 1.4, FS * 1.4, px, g => {
    const c = FS * 0.7, gr = g.createRadialGradient(c, c, 0, c, c, FR * 1.35);
    gr.addColorStop(0, 'rgba(60,30,20,0.34)'); gr.addColorStop(0.6, 'rgba(60,30,20,0.22)'); gr.addColorStop(1, 'rgba(60,30,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, FS * 1.4, FS * 1.4);
  });
  // leaves are drawn along +x from the stem at (4, LEAF_S[1]/2)
  yield S.fshadow;
  S.leaves = [];
  for (let v = 0; v < 4; v++) { S.leaves.push(sprite(LEAF_S[0], LEAF_S[1], k, g => { g.translate(4, LEAF_S[1] / 2); drawLeaf(g, v); })); yield S.leaves[v]; }
  S.lshadow = sprite(LEAF_S[0], LEAF_S[1], px, g => {
    g.filter = 'blur(1.6px)'; g.globalAlpha = 0.2; g.translate(4, LEAF_S[1] / 2); drawLeaf(g, 0, true);
  });
  yield S.lshadow;
}

function drawPetal(g, p, alpha = 1) {
  const H0 = HUES[p.colour];
  g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = alpha;
  g.fillStyle = hsl(lerp(H0.h[0], H0.h[1], p.shade), 88, lerp(H0.l[0], H0.l[1], p.shade));
  petalShape(g, p.s, 5); g.fill();
  g.strokeStyle = rgba(H0.rim, 0.45); g.lineWidth = 0.5; g.stroke();
  g.restore();
}

// ── Side-effect edge: the doorway, painted once ───────────────────────────

const WALL = '#d6a65a', LIME = '#efe8d9', TEAK = '#5e3b22', TEAK_D = '#2e1b0e';
const quad = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const fillQuad = (g, q, c) => { g.fillStyle = c; g.beginPath(); q.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill(); };
const edge = (g, a, b, o = {}) => ink(g, [a, b], { width: 1, color: '#3a2616', alpha: 0.55, jitter: 0.35, taper: 6, seed: a[0] * 0.37 + b[1] * 0.11, ...o });

function* paintDoorway(g, st) {
  // wall: ochre lime wash, brushed on in long uneven strokes
  paper(g, W, H, { base: WALL, seed: 17, mottle: 0.14, grain: 0.08, fibers: 30, vignette: 0.14, speck: '#5a3a14', fiber: '#6a4a1e' });
  yield;
  const wallQ = quad(0, 0, W, H);
  hatch(g, wallQ, { angle: -1.48, spacing: 7, seg: [40, 140], gap: 0.4, width: 2.4, color: '#ecc57e', alpha: 0.16, wobble: 2, seed: 3 });
  hatch(g, wallQ, { angle: -1.52, spacing: 11, seg: [30, 110], gap: 0.8, width: 1.6, color: '#9c6a28', alpha: 0.09, wobble: 2, seed: 4 });
  yield;
  // monsoon damp at the foot of the wall
  const damp = g.createLinearGradient(0, 560, 0, H);
  damp.addColorStop(0, 'rgba(96,98,70,0)'); damp.addColorStop(1, 'rgba(96,98,70,0.22)');
  g.fillStyle = damp; g.fillRect(0, 560, W, H - 560);

  // cast shadow of the frame on the wall (sun from the upper left)
  g.fillStyle = 'rgba(92,52,30,0.2)';
  g.beginPath(); g.moveTo(FRAME.x1, CORNICE.y1 + 6); g.lineTo(FRAME.x1 + 16, CORNICE.y1 + 20); g.lineTo(FRAME.x1 + 16, FRAME.y1); g.lineTo(FRAME.x1, FRAME.y1); g.fill();
  g.beginPath(); g.moveTo(CORNICE.x1, CORNICE.y1); g.lineTo(CORNICE.x1 + 14, CORNICE.y1 + 14); g.lineTo(FRAME.x1 + 16, CORNICE.y1 + 20); g.lineTo(FRAME.x1, CORNICE.y1); g.fill();
  hatch(g, quad(FRAME.x1, CORNICE.y1, FRAME.x1 + 17, FRAME.y1), { angle: -0.9, spacing: 3.2, seg: [5, 12], width: 0.7, color: '#6a3f1c', alpha: 0.3, seed: 11 });
  yield;

  // lime-washed frame, cornice, plinths
  const face = new Path2D();
  face.rect(FRAME.x0, FRAME.y0, FRAME.x1 - FRAME.x0, FRAME.y1 - FRAME.y0);
  face.rect(OPEN.x0, OPEN.y0, OPEN.x1 - OPEN.x0, OPEN.y1 - OPEN.y0);
  g.save();
  g.fillStyle = LIME; g.fill(face, 'evenodd');
  g.clip(face, 'evenodd');
  hatch(g, quad(FRAME.x0, FRAME.y0, FRAME.x1, FRAME.y1), { angle: -1.5, spacing: 4, seg: [18, 70], width: 1.1, color: '#c9bfa8', alpha: 0.22, wobble: 1.2, seed: 21 });
  // where the lime has flaked, the ochre coat underneath
  const r = rng('flake');
  for (let i = 0; i < 7; i++) {
    const x = r.pick([r.range(FRAME.x0 + 6, OPEN.x0 - 8), r.range(OPEN.x1 + 8, FRAME.x1 - 6)]), y = r.range(300, 760);
    const pts = roughen([[x, y], [x + r.range(5, 14), y + r.range(-2, 2)], [x + r.range(4, 11), y + r.range(4, 10)], [x - r.range(1, 4), y + r.range(3, 8)]], { amp: 1.6, freq: 0.2, seed: i, step: 2 });
    wash(g, pts, { color: '#d8c49a', alpha: 0.4 });
    ink(g, pts.slice(0, Math.ceil(pts.length * 0.6)), { width: 0.5, color: '#8a7250', alpha: 0.45, jitter: 0.3, seed: i + 40 });
  }
  g.restore();
  yield;
  // mouldings: a sunk line around the frame, the plinths, the lintel band
  const m = 12;
  ink(g, [[FRAME.x0 + m, FRAME.y1 - 62], [FRAME.x0 + m, FRAME.y0 + m], [FRAME.x1 - m, FRAME.y0 + m], [FRAME.x1 - m, FRAME.y1 - 62]], { width: 1.1, color: '#8d8270', alpha: 0.55, jitter: 0.4, taper: 8, seed: 31 });
  ink(g, [[OPEN.x0 - m, FRAME.y1 - 62], [OPEN.x0 - m, OPEN.y0 - m], [OPEN.x1 + m, OPEN.y0 - m], [OPEN.x1 + m, FRAME.y1 - 62]], { width: 1.1, color: '#8d8270', alpha: 0.55, jitter: 0.4, taper: 8, seed: 32 });
  ink(g, [[FRAME.x0 + m + 1.5, FRAME.y0 + m + 2], [FRAME.x1 - m - 1, FRAME.y0 + m + 2]], { width: 1.4, color: '#fffdf6', alpha: 0.7, jitter: 0.3, taper: 8, seed: 33 });
  for (const [x0, x1] of [[FRAME.x0 - 6, OPEN.x0], [OPEN.x1, FRAME.x1 + 6]]) {
    const pl = quad(x0, FRAME.y1 - 58, x1, FRAME.y1);
    fillQuad(g, pl, '#e6ddca');
    hatch(g, pl, { angle: -1.2, spacing: 3.6, seg: [6, 14], width: 0.7, color: '#a09078', alpha: 0.25, seed: x0 });
    fillQuad(g, quad(x0 - 2, FRAME.y1 - 62, x1 + 2, FRAME.y1 - 56), '#f6f1e6');
    edge(g, [x0 - 2, FRAME.y1 - 56], [x1 + 2, FRAME.y1 - 56], { color: '#7d7060' });
  }
  // cornice: a projecting band with its own shadow underneath
  const shade = g.createLinearGradient(0, CORNICE.y1, 0, CORNICE.y1 + 16);
  shade.addColorStop(0, 'rgba(80,60,50,0.34)'); shade.addColorStop(1, 'rgba(80,60,50,0)');
  g.fillStyle = shade; g.fillRect(CORNICE.x0 + 8, CORNICE.y1, CORNICE.x1 - CORNICE.x0, 16);
  fillQuad(g, quad(CORNICE.x0, CORNICE.y0, CORNICE.x1, CORNICE.y1), '#f4efe3');
  fillQuad(g, quad(CORNICE.x0, CORNICE.y1 - 9, CORNICE.x1, CORNICE.y1), '#ddd3bf');
  fillQuad(g, quad(CORNICE.x0 + 10, CORNICE.y0 - 10, CORNICE.x1 - 10, CORNICE.y0), '#e9e1d0');
  hatch(g, quad(CORNICE.x0, CORNICE.y1 - 9, CORNICE.x1, CORNICE.y1), { angle: -0.8, spacing: 3, seg: [4, 9], width: 0.6, color: '#8a7a64', alpha: 0.35, seed: 41 });
  edge(g, [CORNICE.x0, CORNICE.y1], [CORNICE.x1, CORNICE.y1], { color: '#6d5f50', width: 1.2 });
  edge(g, [CORNICE.x0, CORNICE.y0], [CORNICE.x1, CORNICE.y0], { color: '#8d8270' });
  edge(g, [CORNICE.x0 + 10, CORNICE.y0 - 10], [CORNICE.x1 - 10, CORNICE.y0 - 10], { color: '#8d8270' });
  edge(g, [CORNICE.x0, CORNICE.y0], [CORNICE.x0, CORNICE.y1], { color: '#8d8270' });
  edge(g, [CORNICE.x1, CORNICE.y0], [CORNICE.x1, CORNICE.y1], { color: '#6d5f50' });
  ink(g, quad(FRAME.x0, FRAME.y0, FRAME.x1, FRAME.y1), { width: 1.1, color: '#6d5f50', alpha: 0.5, jitter: 0.5, closed: true, seed: 45 });
  yield;

  // the door: two teak leaves with raised panels
  const doorQ = quad(OPEN.x0, OPEN.y0, OPEN.x1, OPEN.y1);
  fillQuad(g, doorQ, TEAK);
  const dg = g.createLinearGradient(OPEN.x0, 0, OPEN.x1, 0);
  dg.addColorStop(0, 'rgba(255,200,140,0.1)'); dg.addColorStop(0.5, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(20,8,0,0.18)');
  g.fillStyle = dg; g.fillRect(OPEN.x0, OPEN.y0, OPEN.x1 - OPEN.x0, OPEN.y1 - OPEN.y0);
  hatch(g, doorQ, { angle: Math.PI / 2, spacing: 2.6, seg: [40, 160], gap: 0.1, width: 0.7, color: TEAK_D, alpha: 0.35, wobble: 1.1, seed: 51 });
  hatch(g, doorQ, { angle: Math.PI / 2, spacing: 7, seg: [20, 90], gap: 0.6, width: 0.6, color: '#b07a4a', alpha: 0.25, wobble: 0.8, seed: 52 });
  yield;
  const mid = (OPEN.x0 + OPEN.x1) / 2;
  const panelRows = [[OPEN.y0 + 30, OPEN.y0 + 196], [OPEN.y0 + 220, OPEN.y0 + 372], [OPEN.y0 + 396, OPEN.y1 - 26]];
  for (const [x0, x1] of [[OPEN.x0 + 24, mid - 22], [mid + 22, OPEN.x1 - 24]]) {
    for (const [y0, y1] of panelRows) {
      const b = 9;
      fillQuad(g, [[x0, y0], [x1, y0], [x1 - b, y0 + b], [x0 + b, y0 + b]], 'rgba(255,214,160,0.2)');
      fillQuad(g, [[x0, y0], [x0 + b, y0 + b], [x0 + b, y1 - b], [x0, y1]], 'rgba(255,214,160,0.12)');
      fillQuad(g, [[x1, y0], [x1, y1], [x1 - b, y1 - b], [x1 - b, y0 + b]], 'rgba(20,8,0,0.28)');
      fillQuad(g, [[x0, y1], [x1, y1], [x1 - b, y1 - b], [x0 + b, y1 - b]], 'rgba(20,8,0,0.36)');
      const s = x0 * 0.1 + y0 * 0.01;
      ink(g, quad(x0, y0, x1, y1), { width: 1, color: TEAK_D, alpha: 0.75, jitter: 0.4, closed: true, seed: s });
      ink(g, quad(x0 + b, y0 + b, x1 - b, y1 - b), { width: 0.8, color: TEAK_D, alpha: 0.5, jitter: 0.4, closed: true, seed: s + 1 });
    }
  }
  // the meeting stiles, a brass hasp and two ring pulls
  fillQuad(g, quad(mid - 5, OPEN.y0, mid + 5, OPEN.y1), '#4a2c17');
  edge(g, [mid - 5, OPEN.y0], [mid - 5, OPEN.y1], { color: TEAK_D, alpha: 0.8 });
  edge(g, [mid + 5, OPEN.y0], [mid + 5, OPEN.y1], { color: '#8a5a34', alpha: 0.5 });
  for (const x of [mid - 22, mid + 22]) {
    g.fillStyle = 'rgba(20,8,0,0.35)'; g.beginPath(); g.arc(x + 2, 500 + 3, 9, 0, TAU); g.fill();
    g.strokeStyle = '#b8893a'; g.lineWidth = 2.6; g.beginPath(); g.arc(x, 506, 9, 0.2, TAU + 0.2); g.stroke();
    g.fillStyle = '#d7ad5a'; g.beginPath(); g.arc(x, 496, 3.2, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,236,190,0.7)'; g.lineWidth = 1; g.beginPath(); g.arc(x, 506, 9, 3.6, 4.6); g.stroke();
  }
  fillQuad(g, quad(mid - 20, 452, mid + 20, 460), '#a57a34');
  edge(g, [mid - 20, 460], [mid + 20, 460], { color: '#5a3a14' });
  // the recess: the lintel and left jamb shade the top and left of the door
  g.fillStyle = 'rgba(30,14,4,0.42)';
  g.beginPath(); g.moveTo(OPEN.x0, OPEN.y0); g.lineTo(OPEN.x1, OPEN.y0); g.lineTo(OPEN.x1 - 10, OPEN.y0 + 20); g.lineTo(OPEN.x0 + 18, OPEN.y0 + 20); g.lineTo(OPEN.x0 + 18, OPEN.y1); g.lineTo(OPEN.x0, OPEN.y1); g.fill();
  ink(g, [[OPEN.x0, OPEN.y1], [OPEN.x0, OPEN.y0], [OPEN.x1, OPEN.y0], [OPEN.x1, OPEN.y1]], { width: 1.3, color: '#2a1a0e', alpha: 0.7, jitter: 0.4, taper: 4, seed: 61 });
  yield;

  // threshold sill and the step: laterite riser, pale stone tread
  fillQuad(g, quad(OPEN.x0 - 14, OPEN.y1 - 2, OPEN.x1 + 14, STEP.top), '#4d2f1a');
  hatch(g, quad(OPEN.x0 - 14, OPEN.y1 - 2, OPEN.x1 + 14, STEP.top), { angle: 0, spacing: 2.4, seg: [30, 110], width: 0.6, color: TEAK_D, alpha: 0.5, seed: 71 });
  edge(g, [OPEN.x0 - 14, OPEN.y1 - 2], [OPEN.x1 + 14, OPEN.y1 - 2], { color: '#b88a5a', alpha: 0.5 });

  const riser = quad(STEP.x0, STEP.edge, STEP.x1, STEP.bot);
  fillQuad(g, riser, '#8c4630');
  hatch(g, riser, { angle: -0.5, spacing: 3, seg: [4, 10], width: 0.7, color: '#4a1e10', alpha: 0.35, seed: 72 });
  const pr = rng('pits');
  for (let i = 0; i < 90; i++) {
    const x = pr.range(STEP.x0 + 4, STEP.x1 - 4), y = pr.range(STEP.edge + 4, STEP.bot - 3), rx = pr.range(1, 3.5);
    g.fillStyle = 'rgba(48,16,6,0.55)'; g.beginPath(); g.ellipse(x, y, rx, rx * pr.range(0.5, 0.9), pr() * TAU, 0, TAU); g.fill();
    g.fillStyle = 'rgba(214,140,100,0.35)'; g.beginPath(); g.ellipse(x - 0.6, y + rx * 0.5, rx * 0.6, rx * 0.3, 0, 0, TAU); g.fill();
  }
  const tread = quad(STEP.x0 - 4, STEP.top, STEP.x1 + 4, STEP.edge);
  const tg = g.createLinearGradient(0, STEP.top, 0, STEP.edge);
  tg.addColorStop(0, '#a79f8e'); tg.addColorStop(1, '#c9c1ae');
  fillQuad(g, tread, tg);
  hatch(g, tread, { angle: 0.05, spacing: 3.2, seg: [20, 80], width: 0.6, color: '#6d665a', alpha: 0.22, seed: 73 });
  const sill = g.createLinearGradient(0, STEP.top, 0, STEP.top + 12);
  sill.addColorStop(0, 'rgba(40,24,12,0.35)'); sill.addColorStop(1, 'rgba(40,24,12,0)');
  g.fillStyle = sill; g.fillRect(STEP.x0, STEP.top, STEP.x1 - STEP.x0, 12);
  ink(g, [[STEP.x0 - 4, STEP.edge], [STEP.x1 + 4, STEP.edge]], { width: 1.6, color: '#f4efe2', alpha: 0.6, jitter: 0.4, taper: 10, seed: 74 });
  ink(g, [[STEP.x0 - 4, STEP.edge + 2], [STEP.x1 + 4, STEP.edge + 2]], { width: 1, color: '#3a2014', alpha: 0.6, jitter: 0.4, taper: 10, seed: 75 });
  yield;

  // balcão seats either side of the step
  for (const [x0, x1, s] of [[-20, STEP.x0, 81], [STEP.x1, W + 20, 82]]) {
    const body = quad(x0, SEAT.face, x1, STEP.bot);
    fillQuad(g, body, '#ebe3d2');
    hatch(g, body, { angle: -1.5, spacing: 4.5, seg: [16, 60], width: 1, color: '#bdb29a', alpha: 0.25, wobble: 1, seed: s });
    const lo = g.createLinearGradient(0, SEAT.face, 0, STEP.bot);
    lo.addColorStop(0, 'rgba(90,60,40,0.18)'); lo.addColorStop(0.2, 'rgba(90,60,40,0)'); lo.addColorStop(1, 'rgba(90,90,60,0.2)');
    g.fillStyle = lo; g.fillRect(x0, SEAT.face, x1 - x0, STEP.bot - SEAT.face);
    const top = quad(x0, SEAT.top, x1, SEAT.face);
    fillQuad(g, top, '#8a3324');
    const gl = g.createLinearGradient(0, SEAT.top, 0, SEAT.face);
    gl.addColorStop(0, 'rgba(255,200,170,0.28)'); gl.addColorStop(1, 'rgba(40,6,0,0.2)');
    g.fillStyle = gl; g.fillRect(x0, SEAT.top, x1 - x0, SEAT.face - SEAT.top);
    edge(g, [x0, SEAT.face], [x1, SEAT.face], { color: '#3a1008', width: 1.3, alpha: 0.7 });
    edge(g, [x0, SEAT.top], [x1, SEAT.top], { color: '#5a1a10', alpha: 0.5 });
    // the slab's shadow on the face, a moulding, and a plinth band at the foot
    const us = g.createLinearGradient(0, SEAT.face, 0, SEAT.face + 16);
    us.addColorStop(0, 'rgba(70,40,30,0.3)'); us.addColorStop(1, 'rgba(70,40,30,0)');
    g.fillStyle = us; g.fillRect(x0, SEAT.face, x1 - x0, 16);
    edge(g, [x0, SEAT.face + 22], [x1, SEAT.face + 22], { color: '#9a8c74', alpha: 0.5 });
    edge(g, [x0, SEAT.face + 25], [x1, SEAT.face + 25], { color: '#fffaf0', alpha: 0.6 });
    const plinth = quad(x0, STEP.bot - 34, x1, STEP.bot);
    fillQuad(g, plinth, '#a9a08c');
    hatch(g, plinth, { angle: -1.2, spacing: 3.2, seg: [5, 12], width: 0.6, color: '#5a5040', alpha: 0.3, seed: s + 5 });
    edge(g, [x0, STEP.bot - 34], [x1, STEP.bot - 34], { color: '#5a5040', alpha: 0.6 });
  }
  lota(g, 206, SEAT.top + 10);
  // the seats' ends catch the sun on the left and fall into shade on the right
  fillQuad(g, [[STEP.x1, SEAT.face], [STEP.x1 + 10, SEAT.face + 6], [STEP.x1 + 10, STEP.bot], [STEP.x1, STEP.bot]], 'rgba(60,40,30,0.22)');
  edge(g, [STEP.x0, SEAT.top], [STEP.x0, STEP.bot], { color: '#6d5f50' });
  edge(g, [STEP.x1, SEAT.top], [STEP.x1, STEP.bot], { color: '#6d5f50' });
  // the earth in front
  const earth = quad(-10, STEP.bot, W + 10, H + 10);
  fillQuad(g, earth, '#7a4029');
  hatch(g, earth, { angle: 0.1, spacing: 2.6, seg: [4, 12], width: 0.7, color: '#3a160a', alpha: 0.4, seed: 91 });
  const es = g.createLinearGradient(0, STEP.bot, 0, H);
  es.addColorStop(0, 'rgba(30,10,4,0.5)'); es.addColorStop(1, 'rgba(30,10,4,0.1)');
  g.fillStyle = es; g.fillRect(0, STEP.bot, W, H - STEP.bot);
  yield;

  // chappals left on the step: someone has just gone in
  chappals(g);

  // the eave: tile ends, a fascia board, and its shadow on the wall
  const shadowPts = [[-10, 0], [W + 10, 0]];
  for (let x = W + 10; x >= -10; x -= 6) {
    const rafter = ((x + 1000) % 96) < 18 ? 14 : 0;
    shadowPts.push([x, 104 + rafter + 7 * N(x * 0.01, 5.5, 0)]);
  }
  g.save();
  g.fillStyle = 'rgba(70,40,60,0.26)'; g.beginPath(); shadowPts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill();
  g.restore();
  hatch(g, shadowPts, { angle: -0.95, spacing: 3.4, seg: [6, 16], width: 0.7, color: '#5a2e36', alpha: 0.22, seed: 95 });
  fillQuad(g, quad(-10, EAVE_Y - 22, W + 10, EAVE_Y), '#4a2e1c');
  hatch(g, quad(-10, EAVE_Y - 22, W + 10, EAVE_Y), { angle: 0, spacing: 2.6, seg: [30, 120], width: 0.6, color: '#1e1008', alpha: 0.45, seed: 96 });
  edge(g, [-10, EAVE_Y], [W + 10, EAVE_Y], { color: '#1a0c04', width: 1.4, alpha: 0.8 });
  const tr = rng('tiles');
  for (let x = -30; x < W + 30; x += 46) {
    const cx = x + tr.range(-2, 2), y = EAVE_Y - 22, rw = 21, rh = tr.range(22, 28);
    const tile = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI + (i / 16) * Math.PI; tile.push([cx + Math.cos(a) * rw, y + Math.sin(a) * rh]); }
    const tp = [...tile, [cx + rw, y - 60], [cx - rw, y - 60]];
    const tgr = g.createLinearGradient(cx - rw, 0, cx + rw, 0);
    tgr.addColorStop(0, '#c56a42'); tgr.addColorStop(0.5, '#a54c2c'); tgr.addColorStop(1, '#6e2c18');
    g.fillStyle = tgr; g.beginPath(); tp.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill();
    g.fillStyle = '#2a120a'; g.beginPath(); g.ellipse(cx, y, rw * 0.72, rh * 0.5, 0, Math.PI, TAU); g.fill();
    ink(g, tile, { width: 1, color: '#3a160a', alpha: 0.7, jitter: 0.3, taper: 4, seed: x });
  }
  yield;

  // morning light: a warm lift from the upper left, and one sheet of grain
  const sun = g.createRadialGradient(140, 160, 20, 300, 300, 1000);
  sun.addColorStop(0, 'rgba(255,236,190,0.22)'); sun.addColorStop(0.5, 'rgba(255,220,170,0.06)'); sun.addColorStop(1, 'rgba(60,30,40,0.12)');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.06; g.fillStyle = grainPattern(g, '#3a2f22', { lo: 0, hi: 0.9 }); g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  // the three nails
  for (const [x, y] of NAILS) {
    g.fillStyle = 'rgba(40,20,10,0.3)'; g.beginPath(); g.arc(x + 2.5, y + 3, 3.4, 0, TAU); g.fill();
    g.fillStyle = '#3b3530'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
  }
}

/** A brass lota of water by the door, for washing feet before going in. */
function lota(g, cx, base) {
  const R = 25, cy = base - R * 0.95;
  g.save();
  g.fillStyle = 'rgba(50,14,6,0.35)'; g.beginPath(); g.ellipse(cx + 14, base - 1, R * 1.1, 5, 0, 0, TAU); g.fill();
  const body = g.createRadialGradient(cx - R * 0.4, cy - R * 0.35, 2, cx, cy, R * 1.1);
  body.addColorStop(0, '#fff0b8'); body.addColorStop(0.25, '#e0b458'); body.addColorStop(0.7, '#a4722a'); body.addColorStop(1, '#5a3a12');
  g.fillStyle = body;
  g.beginPath(); g.ellipse(cx, cy, R, R * 0.9, 0, 0, TAU); g.fill();
  // neck and flared rim
  const neck = g.createLinearGradient(cx - 12, 0, cx + 12, 0);
  neck.addColorStop(0, '#f2d487'); neck.addColorStop(0.5, '#b8862e'); neck.addColorStop(1, '#6a4414');
  g.fillStyle = neck;
  g.beginPath(); g.moveTo(cx - 9, cy - R * 0.78); g.quadraticCurveTo(cx - 8, cy - R * 1.2, cx - 14, cy - R * 1.36);
  g.lineTo(cx + 14, cy - R * 1.36); g.quadraticCurveTo(cx + 8, cy - R * 1.2, cx + 9, cy - R * 0.78); g.fill();
  g.fillStyle = '#4a2e0e'; g.beginPath(); g.ellipse(cx, cy - R * 1.36, 14, 3.2, 0, 0, TAU); g.fill();
  g.strokeStyle = '#f6dc98'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy - R * 1.36, 14, 3.2, 0, Math.PI, TAU); g.stroke();
  // a band turned on the lathe, and the window reflected in the brass
  g.strokeStyle = 'rgba(90,56,16,0.55)'; g.lineWidth = 0.9; g.beginPath(); g.ellipse(cx, cy - R * 0.2, R * 0.98, 4, 0, 0, Math.PI); g.stroke();
  g.fillStyle = 'rgba(255,250,225,0.7)'; g.beginPath(); g.ellipse(cx - R * 0.45, cy - R * 0.3, 3, 6.5, -0.4, 0, TAU); g.fill();
  g.restore();
  ink(g, [[cx - 9, cy - R * 0.8], [cx - 16, cy - R * 0.5], [cx - R, cy], [cx - R * 0.7, cy + R * 0.65], [cx, cy + R * 0.9], [cx + R * 0.7, cy + R * 0.65], [cx + R, cy], [cx + 16, cy - R * 0.5], [cx + 9, cy - R * 0.8]], { width: 1, color: '#3a2208', alpha: 0.7, jitter: 0.3, taper: 4, seed: 7 });
}

/** A pair of chappals, toes to the door, foreshortened on the tread. */
function chappals(g) {
  for (const [cx, cy, a, sc, seed] of [[468, 812, -0.12, 1.25, 1], [508, 816, 0.06, 1.28, 2]]) {
    const sole = [];
    for (let i = 0; i < 48; i++) {
      // wide at the ball of the foot, pinched at the arch, round at the heel
      const u = (i / 48) * TAU, v = -Math.cos(u);
      const w = v < -0.35 ? lerp(10.4, 9.8, (-0.35 - v) / 0.65) : v < 0.35 ? lerp(10.4, 7.4, ease.inOutSine((v + 0.35) / 0.7)) : lerp(7.4, 8.6, ease.inOutSine((v - 0.35) / 0.65));
      sole.push([Math.sin(u) * w * sc, v * 14 * sc]);
    }
    const at = (dx, dy, k = 1) => sole.map(([x, y]) => [cx + (x * Math.cos(a) - y * Math.sin(a)) * k + dx, cy + (x * Math.sin(a) + y * Math.cos(a)) * k + dy]);
    const shape = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill(); };
    shape(at(3, 5), 'rgba(40,24,14,0.3)');
    shape(at(0, 3), '#3a2014');
    shape(at(0, 0), '#7a4a2a');
    shape(at(-0.4, -0.6, 0.86), '#9a6238');
    ink(g, at(0, 0), { width: 0.7, color: '#2a140a', alpha: 0.7, jitter: 0.2, closed: true, seed });
    // the toe post and the strap across the foot
    const rot = (x, y) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
    ink(g, [rot(-10.5 * sc, 3), rot(0, -8), rot(10.5 * sc, 3)], { width: 3.8, color: '#5a1e10', alpha: 0.95, jitter: 0.2, taper: 3, seed: seed + 3 });
    ink(g, [rot(0, -8), rot(0, -13)], { width: 1.8, color: '#5a1e10', alpha: 0.9, jitter: 0.1, taper: 1, seed: seed + 4 });
    ink(g, [rot(-6, -3), rot(0, -7), rot(6, -3)], { width: 0.9, color: '#e0a870', alpha: 0.5, jitter: 0.1, taper: 3, seed: seed + 5 });
  }
}

// ── Night: the same doorway after dark, a lantern lit beside it ────────────

const LAMP = [262, 300];
function lantern(g) {
  const [x, y] = LAMP;
  ink(g, [[x, y - 120], [x, y - 34]], { width: 1.2, color: '#2a1a0e', alpha: 0.8, jitter: 0.2, taper: 0, seed: 3 });
  g.fillStyle = '#3b3530'; g.beginPath(); g.arc(x, y - 122, 3, 0, TAU); g.fill();
  // a brass cage round a glass chimney
  g.fillStyle = '#6a4414'; g.fillRect(x - 13, y - 36, 26, 6); g.fillRect(x - 15, y + 22, 30, 7);
  const glass = g.createLinearGradient(x - 11, 0, x + 11, 0);
  glass.addColorStop(0, 'rgba(255,236,170,0.95)'); glass.addColorStop(0.5, 'rgba(255,214,120,1)'); glass.addColorStop(1, 'rgba(230,160,70,0.95)');
  g.fillStyle = glass; g.beginPath(); g.ellipse(x, y - 4, 11, 26, 0, 0, TAU); g.fill();
  g.fillStyle = '#fff6d8'; g.beginPath(); g.ellipse(x, y + 2, 3, 7, 0, 0, TAU); g.fill();
  for (const dx of [-12, 12]) ink(g, [[x + dx, y - 30], [x + dx, y + 22]], { width: 1.4, color: '#8a5a1c', alpha: 0.9, jitter: 0.2, taper: 0, seed: dx });
}
/** Dusk over everything the day painted, then the lantern's pool of light. */
function night(g) {
  g.save();
  g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(88,96,150)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const [x, y] = LAMP, gl = g.createRadialGradient(x, y, 6, x + 60, y + 80, 520);
  gl.addColorStop(0, 'rgba(255,190,110,0.55)'); gl.addColorStop(0.35, 'rgba(210,130,60,0.18)'); gl.addColorStop(1, 'rgba(120,60,20,0)');
  g.fillStyle = gl; g.fillRect(0, 0, W, H);
  g.restore();
  lantern(g);
}

/** Pull a sprite toward the night, keeping its shape (only its own pixels are touched). */
function nightTint(c, a) {
  const g = c.getContext('2d');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a;
  g.fillStyle = 'rgb(38,42,86)'; g.fillRect(0, 0, c.width, c.height); g.restore();
}

// ── The renderer ──────────────────────────────────────────────────────────

export function createRenderer(host, { scene: sceneEl = null, invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  let colors = null, bg = null, sprites = null, builder = null, bgKey = '', built = false, dead = false, pumping = false;
  let fallenLayer = null, baked = 0, fallenFrom = null, strokes = [], epoch = -1, last = null, lastKey = '', lastTime = 0, sweeps = 0;
  let resolveReady; const ready = new Promise(r => (resolveReady = r));
  const tap = document.createElement('canvas').getContext('2d');

  function palette() {
    return (colors ??= readColors(sceneEl ?? host, {
      ink: 'var(--sg-ink, light-dark(#1d2742, #ebe5d6))',
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }
  const isDark = () => palette().dark !== '#000000';

  function* build() {
    const dark = isDark(), L = st.layer(), S = {};
    for (const _ of paintDoorway(L.getContext('2d'), st)) yield L;
    if (dark) { night(L.getContext('2d')); yield L; }
    yield* buildSprites(st.px, S);
    if (dark) {
      // the flowers and leaves sit in the same night as the wall
      for (const c of [...S.flowers.orange, ...S.flowers.saffron, ...S.leaves]) nightTint(c, 0.42);
      yield S.leaves[0];
    }
    bg = L; sprites = S;
  }
  function pumpBuild(budget) {
    const t0 = performance.now();
    while (!built && performance.now() - t0 < budget) {
      const s = builder.next();
      // read a pixel so the rasteriser does its work inside this slice
      if (s.value) tap.drawImage(s.value, 0, 0, 1, 1);
      if (s.done) built = true;
    }
    return built;
  }
  function pump() {
    pumping = false;
    if (dead || built || !builder) return;
    if (pumpBuild(12)) { lastKey = ''; invalidate(); } else { pumping = true; setTimeout(pump, 0); }
  }
  function ensureBuilt() {
    const key = `${st.canvas.width}x${st.canvas.height}|${isDark()}`;
    if (key !== bgKey) { bgKey = key; built = false; bg = null; builder = build(); fallenLayer = null; }
    if (!built) pumpBuild(9);
    if (!built && !pumping) { pumping = true; setTimeout(pump, 0); }
    return built;
  }
  st.onresize = () => { lastKey = ''; invalidate(); };

  /** A petal, pulled toward the night on a dark page (the same shape, filled again in dusk blue). */
  function petal(g, p, dark) {
    drawPetal(g, p, 1);
    if (dark) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = 'rgba(38,42,86,0.45)'; petalShape(g, p.s, 5); g.fill(); g.restore(); }
  }
  function bakePetal(g, p, dark) {
    g.save(); g.globalAlpha = 0.25; g.fillStyle = '#3a2418';
    g.beginPath(); g.ellipse(p.x + 1.5, p.y + 1.5, p.s * 0.7, p.s * 0.35, 0, 0, TAU); g.fill(); g.restore();
    petal(g, p, dark);
  }

  function render(data, frame) {
    const look = data.look, still = !!frame.still, p = frame.pointer, dark = isDark();
    if (frame.epoch !== epoch) { epoch = frame.epoch; strokes = []; last = null; }
    lastTime = data.time;
    // the hand's brushes, in playful: every move since the last frame becomes a stroke with a speed
    if (look.touch && !still && p.inside) {
      const at = [p.x, p.y];
      if (last && (at[0] !== last[0] || at[1] !== last[1])) {
        const dts = Math.max(0.008, frame.dt || 1 / 60);
        let vx = (at[0] - last[0]) / dts, vy = (at[1] - last[1]) / dts;
        // the keyboard hand jumps between frames; treat it as a firm brush, not a violent one
        const cap = p.keyboard ? 700 : 2600, sp = Math.hypot(vx, vy);
        if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
        strokes.push({ t: data.time, ax: last[0], ay: last[1], bx: at[0], by: at[1], vx, vy, R: 42 });
      }
      last = at;
    } else last = null;
    // the still is the garland hung and at rest, with the petals already on the step
    const d = still ? doorwayAt(data.seed, 'quiet', 0) : doorwayAt(data.seed, data.register, data.time, strokes, frame.calm || []);

    if (!ensureBuilt()) {
      const g = st.begin();
      g.fillStyle = dark ? '#3a3548' : '#d6a65a'; g.fillRect(0, 0, W, H);
      return;
    }
    // nothing moved, nothing to draw: the garland at rest and no petal in the air
    const q = frame.quality ?? 1;
    const moving = d.energy > 1e-4 || d.petals.length;
    const key = `${moving ? d.n : 'rest'}|${d.fallen.length}|${dark}|${st.canvas.width}|${q}|${p.keyboard && p.inside && look.touch ? `${p.x | 0},${p.y | 0}` : ''}`;
    if (key === lastKey) return;
    lastKey = key;

    if (!fallenLayer || fallenFrom !== d.fallen || fallenLayer.width !== st.canvas.width) {
      fallenLayer = st.layer(); fallenFrom = d.fallen; baked = 0;
    }
    if (baked < d.fallen.length) {
      const fg = fallenLayer.getContext('2d');
      for (; baked < d.fallen.length; baked++) bakePetal(fg, d.fallen[baked], dark);
    }

    const g = st.begin(), sim = d.sim, P = sim.P, S = sprites;
    st.blit(bg);
    st.blit(fallenLayer);

    // shadows first: the sun is up and to the left; the door sits deeper, so shadows
    // that fall on it land further away and softer. The governor drops them when frames run slow.
    const shadowAt = (x, y) => (x > OPEN.x0 + 4 && x < OPEN.x1 && y > OPEN.y0 ? [16, 22] : [9, 12]);
    if (q > 0.5) {
      for (const L of sim.leaves) {
        const a = P[L.a], b = P[L.b], [ox, oy] = shadowAt(b.x, b.y);
        g.save(); g.translate(a.x + ox, a.y + oy); g.rotate(Math.atan2(b.y - a.y, b.x - a.x)); g.scale(L.len / LEAF_L, 1);
        g.drawImage(S.lshadow, -4, -LEAF_S[1] / 2, LEAF_S[0], LEAF_S[1]);
        g.restore();
      }
    }
    if (q > 0.25) {
      const fs = FS * 1.4;
      for (const fl of sim.flowers) { const qq = P[fl.p], [ox, oy] = shadowAt(qq.x, qq.y); g.drawImage(S.fshadow, qq.x + ox - fs / 2, qq.y + oy - fs / 2, fs, fs); }
    }

    // the thread, just visible between flowers
    g.save();
    g.strokeStyle = 'rgba(70,46,24,0.8)'; g.lineWidth = 1.1; g.lineJoin = 'round';
    g.beginPath();
    for (const c of sim.chains) c.idx.forEach((i, k) => (k ? g.lineTo(P[i].x, P[i].y) : g.moveTo(P[i].x, P[i].y)));
    g.stroke();
    g.restore();

    // leaves hang behind the flowers
    for (const L of sim.leaves) {
      const a = P[L.a], b = P[L.b];
      g.save(); g.translate(a.x, a.y); g.rotate(Math.atan2(b.y - a.y, b.x - a.x)); g.scale(L.len / LEAF_L, L.knot !== undefined ? 1.05 : 0.95);
      g.drawImage(S.leaves[L.variant], -4, -LEAF_S[1] / 2, LEAF_S[0], LEAF_S[1]);
      g.restore();
    }

    const drawFlower = (x, y, ang, fl, scale) => {
      const s = FS * scale;
      g.save(); g.translate(x, y); g.rotate(ang);
      g.drawImage(S.flowers[fl.colour][fl.variant], -s / 2, -s / 2, s, s);
      g.restore();
      g.drawImage(S.shade, x - s / 2, y - s / 2, s, s);
    };
    // strands first, then the swags over them; the nail knots on top
    for (const kind of ['strand', 'swag']) {
      for (const fl of sim.flowers) {
        const c = sim.chains[fl.chain];
        if (c.kind !== kind) continue;
        const qq = P[fl.p], prev = P[c.idx[fl.k - 1]];
        drawFlower(qq.x, qq.y, Math.atan2(qq.y - prev.y, qq.x - prev.x) + fl.spin, fl, fl.size * (1 - fl.lost * 0.025));
      }
    }
    sim.knots.forEach((pi, i) => drawFlower(P[pi].x, P[pi].y, i * 2.1, { colour: i === 1 ? 'orange' : 'saffron', variant: i + 2 }, 1.12));

    for (const pt of d.petals) petal(g, pt, dark);
    // the keyboard hand, so a sighted keyboard user sees where it is
    if (look.touch && p.keyboard && p.inside) {
      const ic = dark ? '#f4ecd8' : '#1d2742';
      ink(g, [[p.x - 12, p.y], [p.x + 12, p.y]], { width: 1.6, color: ic, alpha: 0.85, jitter: 0.2, taper: 3, seed: 1 });
      ink(g, [[p.x, p.y - 12], [p.x, p.y + 12]], { width: 1.6, color: ic, alpha: 0.85, jitter: 0.2, taper: 3, seed: 2 });
    }
    resolveReady?.(); resolveReady = null;
  }

  return {
    render,
    ready,
    setRegister() { lastKey = ''; },
    restyle() { colors = null; bgKey = ''; lastKey = ''; },
    /** A click in playful: a small push outward from the finger. Enter or Space: the keyboard hand sweeps through, one way then the other. */
    activate(p) {
      if (!p) return;
      strokes.push(...(p.keyboard ? sweepStrokes(lastTime, p.x, p.y, (sweeps++ % 2) ? -1 : 1) : tapStrokes(lastTime, p.x, p.y)));
      lastKey = ''; invalidate();
    },
    destroy() { dead = true; st.destroy(); },
  };
}
