// Ferry: the canvas renderer. Owns every side effect.
//
// quiet    a hairline still: the far bank, the route, the four stops and the
//          ferry at its stop
// warm     a ballpoint river: the water boils on twos, the ferry bobs at its
//          stop, and sails to a new one only when `step` changes
// playful  the same, brisker; a click, Enter or Space sends it on to the
//          next stop (after the fourth, home to the first); a kite circles
//
// The world is painted once; the water is three cels cycled on twos. A
// frame is two blits, four lamps and the ferry.

import { stage, rng, N, clamp, lerp, TAU, smoothstep, hexToRgb, ink, hatch, wash, toPath, paper, ellipse, roughen } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, HORIZON, STOPS, STOP_AT, scaleAt, getRoute, ferryAt, journey, journeyTime } from './model.js';

const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };

/** The near bank, bottom right, as a polygon: the ground you stand on. */
export const NEAR = [[742, 800], [800, 764], [878, 734], [968, 716], [1052, 694], [1116, 648], [1160, 612], [1200, 596], [1200, 800]];
/** The near jetty: a concrete ramp from the bank into the water at the fourth stop. */
const RAMP = [[1030, 646], [1072, 628], [1200, 578], [1200, 612], [1122, 650], [1062, 672]];

/** Where each stop's lamp hangs, in logical units, and how big it is drawn. */
export function lampAt(i) {
  const s = STOP_AT[i], k = scaleAt(s.y);
  if (i === 0) return { x: s.x + 72 * k, y: s.y - 118 * k, k };
  if (i === STOPS - 1) return { x: 1092, y: 520, k: 1 };
  return { x: s.x + 134 * k, y: s.y - 104 * k, k };
}

export function createRenderer(host, { register, scene, invalidate }) {
  const st = stage(host, { W, H });
  let reg = register, colors = null, calmKey = '', lastKey = '';
  let pos = null, from = 0, goal = 0, since = 0, dur = 0, lastT = 0, epoch = -1;
  let ferrySprite = null, ferryKey = '';
  st.onresize = () => { ferrySprite = null; lastKey = ''; invalidate(); };

  function palette() {
    return (colors ??= readColors(host, {
      paper: 'var(--sg-paper, light-dark(#f1ede4, #151a2b))',
      ink: 'var(--sg-ink, light-dark(#1d2742, #ebe5d6))',
      pencil: 'var(--sg-pencil, light-dark(#8e93a6, #6e6a5e))',
      pen: 'var(--sg-ferry-pen, light-dark(#2a4596, #8fa6e6))',
      laterite: 'var(--sg-laterite, #b3563a)',
      mango: 'var(--sg-mango, #e4b24c)',
      indigo: 'var(--sg-indigo, #2b3a6b)',
      sea: 'var(--sg-sea, #6f98a8)',
      paddy: 'var(--sg-paddy, #5b8b3b)',
      kokum: 'var(--sg-kokum, #7c1d45)',
      cream: 'var(--sg-ferry-cream, #f3ecdb)',
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }
  const isDark = () => palette().dark !== '#000000';
  const hair = () => (1.1 * W) / (st.canvas.clientWidth || W);
  /** A pigment as it looks in this light: itself by day, sunk toward the night paper at dusk. */
  const tone = (hex, k = 0.42) => (isDark() ? mixHex(hex, palette().paper, k) : hex);

  // ── the painted-once world ────────────────────────────────────────────
  function world(g, mode) {
    const c = palette(), dark = isDark(), hw = hair(), pen = mode === 'hair' ? c.ink : c.pen;
    if (mode === 'hair') { g.fillStyle = c.paper; g.fillRect(0, 0, W, H); }
    else paper(g, W, H, { base: c.paper, seed: 8, mottle: 0.035, vignette: dark ? 0.05 : 0.06, fibers: 40, speck: dark ? '#000000' : '#3a2f22' });
    const bk = lastData.bank;
    // sky: long faint hatching, thinning toward the haze at the horizon
    if (mode === 'ink') {
      const sky = [[0, 0], [W, 0], [W, HORIZON - 40], [0, HORIZON - 40]];
      if (dark) { const gr = g.createLinearGradient(0, 0, 0, HORIZON); gr.addColorStop(0, 'rgba(10,12,40,0.5)'); gr.addColorStop(1, 'rgba(120,70,60,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, W, HORIZON); }
      hatch(g, sky, { angle: -0.02, spacing: 6, seg: [20, 80], gap: 0.6, width: 0.7, color: pen, alpha: dark ? 0.22 : 0.4, wobble: 0.8, seed: 2, density: (x, y) => clamp(0.55 * Math.pow(1 - y / HORIZON, 1.3) + 0.15 * N(x * 0.004, y * 0.02, 3)) });
      const haze = g.createLinearGradient(0, HORIZON - 70, 0, HORIZON + 10);
      haze.addColorStop(0, 'rgba(0,0,0,0)'); haze.addColorStop(1, dark ? 'rgba(230,150,90,0.18)' : 'rgba(240,200,150,0.28)');
      g.fillStyle = haze; g.fillRect(0, HORIZON - 70, W, 80);
    }
    // the hills behind the far bank, hatched pale
    for (const h of bk.hills) {
      const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([h.x - h.w / 2 + u * h.w, HORIZON - 26 - Math.sin(u * Math.PI) * h.h * (0.8 + 0.2 * N(u * 3, h.x))]); }
      const poly = [...pts, [h.x + h.w / 2, HORIZON - 20], [h.x - h.w / 2, HORIZON - 20]];
      if (mode === 'hair') { g.strokeStyle = c.pencil; g.lineWidth = hw * 0.8; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.stroke(); continue; }
      wash(g, poly, { color: tone(c.sea, 0.3), alpha: 0.3 });
      hatch(g, poly, { angle: -0.5, spacing: 3.2, seg: [5, 14], width: 0.6, color: pen, alpha: 0.35, seed: h.x | 0 });
    }
    // the far bank: canopy, roofs among the trees, palms above, mangrove at the water
    const base = HORIZON - 6;
    for (const tr of bk.trees) {
      const blob = ellipse(tr.x, base - tr.h - tr.r * 0.45, tr.r, tr.r * 0.62, { n: 20 });
      if (mode === 'hair') { g.strokeStyle = c.pencil; g.lineWidth = hw * 0.8; g.stroke(toPath(roughen(blob, { amp: 2, freq: 0.1, seed: tr.x | 0, step: 5 }))); continue; }
      const rough = roughen(blob, { amp: 2.4, freq: 0.1, seed: tr.x | 0, step: 4 });
      wash(g, rough, { color: tone(mixHex(c.paddy, '#1d3a2a', 0.25 + tr.tone * 0.3), 0.35), alpha: 0.9 });
      hatch(g, rough, { angle: -0.8, spacing: 2.2, seg: [3, 8], width: 0.6, color: pen, alpha: 0.45, seed: tr.x | 0, density: (x, y) => smoothstep(base - tr.h - tr.r * 1.1, base, y) * 0.9 + 0.1 });
    }
    for (const rf of bk.roofs) {
      const x = rf.x, y = base - rf.deep, w = rf.w, h = rf.h;
      const wall = [[x - w / 2, y], [x + w / 2, y], [x + w / 2, y - h], [x - w / 2, y - h]], roof = [[x - w / 2 - 4, y - h], [x + w / 2 + 4, y - h], [x + w / 2 - 6, y - h - 9], [x - w / 2 + 6, y - h - 9]];
      if (mode === 'hair') { g.strokeStyle = c.pencil; g.lineWidth = hw * 0.8; g.stroke(toPath(wall)); g.stroke(toPath(roof)); continue; }
      g.fillStyle = rf.white ? tone('#f1ebdf', 0.5) : tone(mixHex(c.mango, '#ffffff', 0.25), 0.4); g.fill(toPath(wall));
      wash(g, roof, { color: tone(c.laterite, 0.3), alpha: 0.95 });
      hatch(g, roof, { angle: 1.2, spacing: 2, width: 0.5, color: pen, alpha: 0.4, seed: x | 0 });
      ink(g, roof, { width: 0.8, color: pen, alpha: 0.75, closed: true, jitter: 0.2, seed: x | 0 });
      g.fillStyle = tone(c.indigo, 0.3); g.globalAlpha = 0.7;
      for (let i = 0; i < Math.round(w / 14); i++) g.fillRect(x - w / 2 + 5 + i * 13, y - h * 0.72, 4, h * 0.45);
      g.globalAlpha = 1;
    }
    for (const p of bk.palms) {
      const x = p.x, y0 = base - 4, top = [x + p.lean * p.h, y0 - p.h];
      const trunk = [[x, y0], [x + p.lean * p.h * 0.35, y0 - p.h * 0.5], top];
      if (mode === 'hair') { g.strokeStyle = c.pencil; g.lineWidth = hw * 0.8; g.beginPath(); g.moveTo(...trunk[0]); g.quadraticCurveTo(...trunk[1], ...trunk[2]); g.stroke(); }
      else ink(g, trunk, { width: 1.8, color: pen, alpha: 0.85, jitter: 0.3, seed: x | 0, taper: 8 });
      for (let f = 0; f < p.fr; f++) {
        // fronds spread sideways and droop, like the palms at Rampon, never straight up
        const a = lerp(-Math.PI - 0.45, 0.45, (f + 0.5) / p.fr) + p.ph, len = p.h * lerp(0.26, 0.36, (f * 7919 % 13) / 13);
        const pts = []; for (let u = 0; u <= 1.001; u += 0.2) pts.push([top[0] + Math.cos(a) * len * u, top[1] + Math.sin(a) * len * u * 0.6 + len * 0.55 * u * u]);
        if (mode === 'hair') { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(...q) : g.moveTo(...q))); g.stroke(); }
        else ink(g, pts, { width: 1.5, color: pen, alpha: 0.85, jitter: 0.3, seed: f + x, taper: 6 });
      }
    }
    const bankLine = []; for (let x = -10; x <= W + 10; x += 16) bankLine.push([x, HORIZON + N(x * 0.012, 1.3) * 3]);
    const fringe = [...bankLine.map(([x, y]) => [x, y - 8 - Math.abs(N(x * 0.05, 2.1)) * 10]), ...bankLine.slice().reverse()];
    if (mode === 'ink') {
      wash(g, fringe, { color: tone('#23402f', 0.3), alpha: 0.85 });
      hatch(g, fringe, { angle: -1.1, spacing: 1.8, seg: [3, 7], width: 0.7, color: pen, alpha: 0.6, seed: 4 });
      // the fringe's reflection, a dark smear broken by the water
      g.fillStyle = tone('#23402f', 0.3); g.globalAlpha = 0.28; g.fillRect(0, HORIZON + 1, W, 7); g.globalAlpha = 1;
    }
    // the river: a pale wash, deepening toward you
    if (mode === 'ink') {
      const river = g.createLinearGradient(0, HORIZON, 0, H);
      // the sky's light on the far water, the river's own colour nearer
      river.addColorStop(0, dark ? 'rgba(230,150,90,0.14)' : 'rgba(250,236,210,0.5)'); river.addColorStop(0.35, rgbaHex(tone(c.sea, 0.5), dark ? 0.16 : 0.1)); river.addColorStop(1, rgbaHex(tone(c.sea, 0.5), dark ? 0.32 : 0.26));
      g.fillStyle = river; g.fillRect(0, HORIZON, W, H - HORIZON);
      // the far bank upside down in the still water near it: broken dark strokes, palms stretched and shaken
      const rr = rng('refl');
      g.strokeStyle = tone('#23402f', 0.3); g.lineCap = 'round';
      for (let y = HORIZON + 3; y < HORIZON + 46; y += 2.6) {
        g.globalAlpha = 0.34 * (1 - (y - HORIZON) / 46); g.lineWidth = 1.6; g.beginPath();
        for (let x = rr.range(-20, 20); x < W; x += rr.range(14, 40)) { const l = rr.range(8, 30); g.moveTo(x, y); g.lineTo(x + l, y + rr.range(-0.5, 0.5)); }
        g.stroke();
      }
      for (const p of lastData.bank.palms) {
        g.globalAlpha = 0.22; g.lineWidth = 1.4; g.beginPath();
        for (let k = 0; k < p.h * 0.6; k += 4) { const x = p.x + p.lean * k * 0.6 + Math.sin(k * 0.5) * 2; g.moveTo(x - 2, HORIZON + 4 + k * 0.9); g.lineTo(x + 2, HORIZON + 4 + k * 0.9); }
        g.stroke();
      }
      g.globalAlpha = 1;
      // a current running across the river: a smoother, lighter band, the pen skipping over it
      const band = [];
      for (let x = -20; x <= W + 20; x += 30) band.push([x, currentY(x) - 9]);
      for (let x = W + 20; x >= -20; x -= 30) band.push([x, currentY(x) + 9 + x * 0.012]);
      g.save(); g.filter = 'blur(6px)'; g.fillStyle = dark ? 'rgba(200,210,230,0.08)' : 'rgba(255,252,240,0.45)'; g.fill(toPath(band)); g.restore();
      canoe(g);
    }
    // the route, dotted in pencil, stop to stop
    const R = getRoute();
    g.fillStyle = mode === 'hair' ? c.ink : c.pencil;
    for (let d = 0; d < R.length; d += 11) {
      const [x, y] = R.at(d), k = scaleAt(y);
      g.globalAlpha = mode === 'hair' ? 0.7 : 0.55; g.beginPath(); g.arc(x, y + 14 * k, 1.1 + k * 0.9, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    // the posts at the middle stops, and the far jetty
    for (const i of [1, 2]) post(g, i, mode);
    farJetty(g, mode);
    nearBank(g, mode);
  }
  const rgbaHex = (hex, a) => { const [r, g2, b] = hexToRgb(hex); return `rgba(${r},${g2},${b},${a})`; };
  let lastData = null;

  function post(g, i, mode) {
    const c = palette(), L = lampAt(i), k = L.k, x = L.x, base = STOP_AT[i].y + 8 * k, pen = mode === 'hair' ? c.ink : c.pen;
    for (const dx of [-5, 5]) {
      const pts = [[x + dx * k, base], [x + dx * k * 0.6, L.y + 10 * k]];
      if (mode === 'hair') { g.strokeStyle = c.ink; g.lineWidth = hair(); g.beginPath(); g.moveTo(...pts[0]); g.lineTo(...pts[1]); g.stroke(); continue; }
      ink(g, pts, { width: 5.5 * k, color: tone('#5a3b22', 0.3), alpha: 0.95, jitter: 0.3, seed: i * 7 + dx, taper: 0 });
      ink(g, pts, { width: 1.1, color: pen, alpha: 0.7, jitter: 0.3, seed: i * 9 + dx, taper: 0 });
      // the post's reflection, broken
      if (mode === 'ink') for (let j = 0; j < 6; j++) { const y = base + 4 + j * 5 * k; ink(g, [[x + dx * k - 3 * k, y], [x + dx * k + 3 * k, y + 0.5]], { width: 2.2 * k, color: tone('#5a3b22', 0.3), alpha: 0.35 - j * 0.05, jitter: 0.5, seed: j, taper: 1 }); }
    }
    // lashings
    if (mode === 'ink') for (const u of [0.35, 0.7]) { const y = lerp(base, L.y + 10 * k, u); ink(g, [[x - 7 * k, y], [x + 7 * k, y + 2 * k]], { width: 1.4, color: tone('#c9b58a', 0.4), alpha: 0.9, jitter: 0.2, seed: u * 10, taper: 0 }); }
  }

  function farJetty(g, mode) {
    const c = palette(), L = lampAt(0), k = L.k, pen = mode === 'hair' ? c.ink : c.pen;
    const x0 = L.x - 14 * k, deck = HORIZON + 4, end = STOP_AT[0].y - 6;
    const slab = [[x0, deck - 2], [x0 + 26 * k, deck - 2], [x0 + 30 * k, end], [x0 + 4 * k, end]];
    if (mode === 'hair') { g.strokeStyle = c.ink; g.lineWidth = hair(); g.stroke(toPath(slab)); }
    else { wash(g, slab, { color: tone('#b9ad96', 0.4), alpha: 0.95 }); hatch(g, slab, { angle: 0.3, spacing: 2, width: 0.6, color: pen, alpha: 0.5, seed: 12 }); ink(g, slab, { width: 0.9, color: pen, alpha: 0.8, closed: true, jitter: 0.3, seed: 13 }); }
    // the lamp post at the end
    const px = L.x, py0 = end - 2;
    if (mode === 'hair') { g.beginPath(); g.moveTo(px, py0); g.lineTo(px, L.y + 6 * k); g.stroke(); }
    else ink(g, [[px, py0], [px, L.y + 6 * k]], { width: 2.2 * k + 0.6, color: tone('#3a3530', 0.3), alpha: 0.95, jitter: 0.2, seed: 14, taper: 0 });
  }

  /** Where the current runs: a long sweep across the middle of the river. */
  const currentY = x => 440 + x * 0.1 - Math.sin(x / 260) * 26;

  /** A fisherman's canoe, anchored off the near side, and its broken reflection. */
  function canoe(g) {
    const c = palette(), pen = c.pen, x = 176, y = 612;
    for (let i = 0; i < 5; i++) ink(g, [[x - 60 + i * 6, y + 6 + i * 4], [x + 50 - i * 8, y + 6 + i * 4]], { width: 1.4, color: tone('#3a2a1a', 0.3), alpha: 0.35 - i * 0.05, jitter: 0.8, seed: i + 70, taper: 8 });
    const hull = [[x - 66, y - 12], [x - 48, y + 2], [x + 46, y + 2], [x + 66, y - 14], [x + 40, y - 6], [x - 40, y - 6]];
    wash(g, hull, { color: tone('#5a3b22', 0.3), alpha: 0.97 });
    hatch(g, hull, { angle: -0.9, spacing: 2, width: 0.7, color: pen, alpha: 0.5, seed: 71 });
    ink(g, hull, { width: 1.2, color: pen, alpha: 0.9, closed: true, jitter: 0.4, seed: 72 });
    ink(g, [[x + 10, y - 8], [x + 30, y - 6]], { width: 0.9, color: pen, alpha: 0.5, jitter: 0.8, seed: 73, taper: 2 }); // net in the bows
    const net = []; for (let i = 0; i < 20; i++) net.push([x + 8 + i * 1.6, y - 8 - Math.sin(i * 0.9) * 3 - Math.sin((i / 19) * Math.PI) * 6]);
    ink(g, net, { width: 0.8, color: pen, alpha: 0.7, jitter: 0.6, seed: 74, taper: 2 });
    // a fisherman sitting in the stern, a thin pole over the side
    g.fillStyle = tone(c.kokum, 0.3); g.beginPath(); g.ellipse(x - 26, y - 17, 6, 10, 0, 0, TAU); g.fill();
    g.fillStyle = tone('#3a2618', 0.3); g.beginPath(); g.arc(x - 26, y - 30, 4.5, 0, TAU); g.fill();
    ink(g, [[x - 22, y - 20], [x - 80, y - 46]], { width: 1.1, color: pen, alpha: 0.85, jitter: 0.2, seed: 75, taper: 3 });
    ink(g, [[x - 80, y - 46], [x - 84, y + 4]], { width: 0.5, color: pen, alpha: 0.5, jitter: 0.3, seed: 76, taper: 0 });
  }

  function nearBank(g, mode) {
    const c = palette(), pen = mode === 'hair' ? c.ink : c.pen;
    if (mode === 'hair') {
      g.strokeStyle = c.ink; g.lineWidth = hair(); g.stroke(toPath(NEAR)); g.stroke(toPath(RAMP));
      g.beginPath(); g.moveTo(1092, 628); g.lineTo(1092, 526); g.stroke();
      return;
    }
    // laterite and grass, the ramp of concrete worn to the colour of the stone
    wash(g, NEAR, { color: tone(c.laterite, 0.35), alpha: 0.85 });
    hatch(g, NEAR, { angle: 0.6, spacing: 2.6, seg: [5, 14], width: 0.7, color: tone('#4a1c0e', 0.2), alpha: 0.4, seed: 21 });
    const r = rng('pores');
    g.fillStyle = tone('#4a1c0e', 0.2); g.globalAlpha = 0.45;
    for (let i = 0; i < 140; i++) { const x = r.range(760, 1200), y = r.range(620, 800); if (g.isPointInPath(toPath(NEAR), x * st.px, y * st.px)) { g.beginPath(); g.ellipse(x, y, r.range(1, 3.5), r.range(0.8, 2), 0, 0, TAU); g.fill(); } }
    g.globalAlpha = 1;
    // grass along the lip of the bank
    for (let i = 0; i < 70; i++) { const u = i / 70, x = lerp(760, 1200, u) + r.range(-6, 6), y = interpY(x) + r.range(-2, 4); ink(g, [[x, y], [x + r.range(-5, 5), y - r.range(6, 16)]], { width: 1.1, color: tone(c.paddy, 0.3), alpha: 0.85, jitter: 0.2, seed: i, taper: 3 }); }
    ink(g, NEAR.slice(0, -1), { width: 1.4, color: pen, alpha: 0.85, jitter: 0.6, seed: 22, taper: 0 });
    wash(g, RAMP, { color: tone('#c8bca5', 0.4), alpha: 0.95 });
    hatch(g, RAMP, { angle: -0.4, spacing: 2.4, width: 0.6, color: pen, alpha: 0.35, seed: 23 });
    ink(g, RAMP, { width: 1.1, color: pen, alpha: 0.85, closed: true, jitter: 0.4, seed: 24 });
    // the lamp post on the ramp
    ink(g, [[1092, 632], [1092, 528]], { width: 3.4, color: tone('#3a3530', 0.3), alpha: 0.95, jitter: 0.2, seed: 25, taper: 0 });
    ink(g, [[1082, 634], [1102, 630]], { width: 2.4, color: tone('#3a3530', 0.3), alpha: 0.9, jitter: 0.2, seed: 26, taper: 0 });
  }
  const interpY = x => { for (let i = 1; i < NEAR.length - 1; i++) { const [x0, y0] = NEAR[i - 1], [x1, y1] = NEAR[i]; if (x >= x0 && x <= x1) return lerp(y0, y1, (x - x0) / (x1 - x0)); } return 800; };

  // ── water cels: three drawings of the boil, cycled ───────────────────────
  function waterCel(g, cel, calm, mode) {
    const c = palette(), pen = c.pen, nRows = 58;
    g.save();
    const clip = new Path2D(); clip.moveTo(0, HORIZON + 2); clip.lineTo(W, HORIZON + 2); clip.lineTo(W, 596); NEAR.slice(0, -1).reverse().forEach(p => clip.lineTo(p[0], p[1] + 6)); clip.lineTo(0, H); clip.closePath();
    g.clip(clip);
    g.lineCap = 'round'; g.strokeStyle = mode === 'hair' ? c.pencil : pen;
    for (let k = 0; k < nRows; k++) {
      const u = k / (nRows - 1), y0 = HORIZON + 4 + (H - HORIZON) * Math.pow(u, 1.7);
      const rr = rng(`w:${k}`), len = lerp(8, 64, Math.pow(u, 1.1)), gap = lerp(3, 26, u);
      g.globalAlpha = mode === 'hair' ? 0.35 : lerp(0.45, 0.75, u); g.lineWidth = mode === 'hair' ? hair() * 0.7 : lerp(0.55, 1.3, u);
      g.beginPath();
      let x = -40 + rr() * len;
      while (x < W + 40) {
        const L = len * rr.range(0.5, 1.3), keep = rr() < (0.62 + 0.45 * N(x * 0.004, y0 * 0.03, 1)) * (1 - 0.75 * Math.exp(-(((y0 - currentY(x)) / 12) ** 2)));
        const inCalm = calm.some(r => x + L > r.x - 20 && x < r.x + r.w + 20 && y0 > r.y - 20 && y0 < r.y + r.h + 20);
        const jr = rng(`${inCalm ? 0 : cel}:${k}:${Math.round(x)}`);
        if (keep && (mode === 'ink' || rr() < 0.35)) {
          const yj = y0 + (jr() - 0.5) * lerp(0.6, 2.6, u), b = (jr() - 0.5) * lerp(0.6, 2, u);
          g.moveTo(x + (jr() - 0.5) * 2, yj); g.quadraticCurveTo(x + L / 2, yj + b, x + L + (jr() - 0.5) * 2, yj + (jr() - 0.5) * lerp(0.4, 1.4, u));
        }
        x += L + gap * rr.range(0.4, 1.5);
      }
      g.stroke();
    }
    g.restore(); g.globalAlpha = 1;
  }

  // ── the ferry, painted once at full size ─────────────────────────────────
  function paintFerry(g, mode) {
    const c = palette(), pen = mode === 'hair' ? c.ink : c.pen, hw = hair(), r = rng('ferry');
    const hairStroke = pts => { g.strokeStyle = c.ink; g.lineWidth = hw; g.stroke(toPath(pts)); };
    const hull = [[-122, -20], [-108, -6], [-100, 0], [100, 0], [108, -6], [122, -20]];
    const band = [[-116, -14], [116, -14], [104, -3], [-104, -3]];
    // wheelhouse and its cabin, off centre
    const cabin = [[-44, -20], [22, -20], [22, -44], [-44, -44]], wh = [[-36, -44], [8, -44], [8, -70], [-36, -70]], roof = [[-42, -70], [14, -70], [12, -76], [-40, -76]];
    if (mode === 'hair') {
      hairStroke(hull); hairStroke(cabin); hairStroke(wh); hairStroke(roof);
      g.beginPath(); g.moveTo(-122, -20); g.lineTo(122, -20); g.stroke();
      for (let x = -112; x <= 112; x += 16) { if (x > -46 && x < 24) continue; g.beginPath(); g.moveTo(x, -20); g.lineTo(x, -32); g.stroke(); }
      g.beginPath(); g.moveTo(-114, -32); g.lineTo(-46, -32); g.moveTo(24, -32); g.lineTo(114, -32); g.stroke();
      return;
    }
    // hull: laterite below, cream above, an indigo line between
    wash(g, hull, { color: tone(c.laterite, 0.3), alpha: 0.95 });
    wash(g, band, { color: tone(c.cream, 0.45), alpha: 0.95 });
    ink(g, [[-110, -5], [110, -5]], { width: 2.2, color: tone(c.indigo, 0.3), alpha: 0.9, jitter: 0.3, seed: 3, taper: 0 });
    hatch(g, hull, { angle: -0.9, spacing: 2.4, seg: [4, 10], width: 0.7, color: pen, alpha: 0.35, seed: 4, density: (x, y) => smoothstep(-10, 0, y) });
    ink(g, hull, { width: 1.3, color: pen, alpha: 0.9, jitter: 0.4, seed: 5, taper: 0 });
    ink(g, [[-122, -20], [122, -20]], { width: 1.5, color: pen, alpha: 0.9, jitter: 0.4, seed: 6, taper: 0 });
    // the ramps at each end, raised for the crossing
    for (const s of [-1, 1]) { const rp = [[s * 118, -20], [s * 132, -34], [s * 136, -31], [s * 124, -18]]; wash(g, rp, { color: tone('#8c8578', 0.3), alpha: 0.95 }); ink(g, rp, { width: 1, color: pen, alpha: 0.85, closed: true, jitter: 0.3, seed: 7 + s }); }
    // the cabin and the wheelhouse
    wash(g, cabin, { color: tone('#e9e1cf', 0.45), alpha: 0.95 });
    wash(g, wh, { color: tone('#f1ebdd', 0.45), alpha: 0.95 });
    for (let i = 0; i < 3; i++) { const win = [[-30 + i * 14, -64], [-20 + i * 14, -64], [-20 + i * 14, -52], [-30 + i * 14, -52]]; wash(g, win, { color: tone(c.indigo, 0.2), alpha: 0.75 }); }
    for (let i = 0; i < 4; i++) { const win = [[-38 + i * 15, -38], [-29 + i * 15, -38], [-29 + i * 15, -29], [-38 + i * 15, -29]]; wash(g, win, { color: tone(c.sea, 0.2), alpha: 0.7 }); }
    wash(g, roof, { color: tone(c.sea, 0.3), alpha: 0.95 });
    for (const p of [cabin, wh, roof]) ink(g, p, { width: 1.1, color: pen, alpha: 0.9, closed: true, jitter: 0.35, seed: p[0][0] | 0 });
    hatch(g, [[4, -44], [22, -44], [22, -20], [4, -20]], { angle: -0.8, spacing: 2.2, width: 0.6, color: pen, alpha: 0.35, seed: 9 });
    ink(g, [[-10, -76], [-10, -92]], { width: 1.2, color: pen, alpha: 0.85, jitter: 0.2, seed: 10, taper: 0 }); // the mast
    // two scooters on the foredeck, a few people aft and forward
    scooter(g, 44, -20, 1, pen, c); scooter(g, 76, -20, -1, pen, c);
    const cols = [c.kokum, c.mango, c.sea, c.paddy, '#f1ebdd'];
    const folk = lastData?.bank.people ?? [];
    folk.forEach((f, i) => {
      const x = i < 3 ? -104 + i * 18 + r.range(-3, 3) : 96 + (i - 3) * 14, hh = 26 * f.h;
      const body = [[x - 4, -20], [x + 4, -20], [x + 3.2, -20 - hh * 0.72], [x - 3.2, -20 - hh * 0.72]];
      wash(g, body, { color: tone(cols[f.col], 0.3), alpha: 0.95 });
      ink(g, body, { width: 0.8, color: pen, alpha: 0.85, closed: true, jitter: 0.25, seed: i + 20 });
      g.fillStyle = tone('#6b4128', 0.3); g.beginPath(); g.arc(x, -20 - hh * 0.72 - 3.6, 3.4, 0, TAU); g.fill();
      g.fillStyle = tone('#1f1a16', 0.2); g.beginPath(); g.arc(x, -20 - hh * 0.72 - 4.8, 3.4, Math.PI, TAU); g.fill();
    });
    // the railing along both decks
    ink(g, [[-116, -32], [-46, -32]], { width: 1, color: pen, alpha: 0.85, jitter: 0.3, seed: 30, taper: 0 });
    ink(g, [[24, -32], [116, -32]], { width: 1, color: pen, alpha: 0.85, jitter: 0.3, seed: 31, taper: 0 });
    g.strokeStyle = pen; g.lineWidth = 0.9; g.globalAlpha = 0.8; g.beginPath();
    for (let x = -112; x <= 112; x += 12) { if (x > -46 && x < 24) continue; g.moveTo(x, -20); g.lineTo(x, -32); }
    g.stroke(); g.globalAlpha = 1;
  }
  function scooter(g, x, y, dir, pen, c) {
    for (const wx of [-9, 9]) { g.strokeStyle = pen; g.lineWidth = 1.2; g.beginPath(); g.arc(x + wx, y - 4, 3.6, 0, TAU); g.stroke(); }
    const body = [[x - 11 * dir, y - 8], [x + 6 * dir, y - 8], [x + 10 * dir, y - 15], [x + 12 * dir, y - 22], [x - 2 * dir, y - 14], [x - 12 * dir, y - 13]];
    wash(g, body, { color: tone(dir > 0 ? c.sea : c.kokum, 0.3), alpha: 0.95 });
    ink(g, body, { width: 0.9, color: pen, alpha: 0.85, closed: true, jitter: 0.3, seed: x });
    ink(g, [[x + 12 * dir, y - 22], [x + 9 * dir, y - 26], [x + 15 * dir, y - 26]], { width: 1, color: pen, alpha: 0.85, jitter: 0.2, seed: x + 1, taper: 0 });
  }
  function getFerry(mode) {
    const key = `${mode}|${isDark()}|${st.px}`;
    if (ferrySprite && ferryKey === key) return ferrySprite;
    const k = st.px, pad = 12, x0 = -140, y0 = -100, w = 280, h = 110;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
    const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    paintFerry(g, mode);
    ferrySprite = { cv, x0, y0, w, h, pad }; ferryKey = key;
    return ferrySprite;
  }

  function drawFerry(g, F, b, mode, moving, t) {
    const s = getFerry(mode), c = palette();
    // wake: two lines opening behind the stern while under way
    if (moving > 0.02 && mode === 'ink') {
      for (const side of [-1, 1]) {
        const pts = []; for (let i = 0; i <= 8; i++) { const d = i * 14 * F.s; pts.push([F.x - 118 * F.s - d, F.y + 2 + side * d * 0.12 + Math.sin(t * 6 + i) * 0.8]); }
        ink(g, pts, { width: 1.2 * F.s + 0.3, color: '#ffffff', alpha: 0.55 * moving, jitter: 0.6, seed: side + 40, taper: 20 });
      }
    }
    g.save(); g.translate(F.x, F.y + b.dy * F.s); g.rotate(b.roll); g.scale(F.s, F.s);
    // the reflection: the ferry flipped, faint and broken by the water's lines
    if (mode === 'ink') {
      g.save(); g.scale(1, -0.5); g.globalAlpha = 0.16; g.drawImage(s.cv, s.x0, s.y0, s.w, s.h); g.restore();
      g.strokeStyle = c.paper; g.lineWidth = 1; g.globalAlpha = 0.45; g.beginPath();
      for (let y = 3; y < 44; y += 5) { g.moveTo(-130, y); g.lineTo(130, y); }
      g.stroke(); g.globalAlpha = 1;
    }
    g.drawImage(s.cv, s.x0, s.y0, s.w, s.h);
    g.restore();
  }

  // ── lamps: lit behind, glowing where the ferry is, dark ahead ─────────────
  function lamp(g, i, state, mode) {
    const c = palette(), L = lampAt(i), k = L.k, x = L.x, y = L.y, pen = mode === 'hair' ? c.ink : c.pen;
    const bw = 8 * k + 2, bh = 12 * k + 2;
    if (state !== 'dark' && mode === 'ink') {
      const R = (state === 'here' ? 70 : 34) * (0.5 + k * 0.6), glow = g.createRadialGradient(x, y, 0, x, y, R);
      const a = state === 'here' ? (isDark() ? 0.75 : 0.55) : (isDark() ? 0.45 : 0.3);
      glow.addColorStop(0, `rgba(255,205,110,${a})`); glow.addColorStop(0.4, `rgba(255,180,80,${a * 0.35})`); glow.addColorStop(1, 'rgba(255,180,80,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
      // its light on the water, a broken column
      const wy = i === STOPS - 1 ? 700 : STOP_AT[i].y + 10 * k;
      for (let j = 0; j < 5; j++) { g.fillStyle = `rgba(255,200,110,${a * (0.5 - j * 0.08)})`; g.fillRect(x - (6 - j) * k * 1.5, wy + j * 6 * k, (12 - j * 2) * k * 1.5, 1.6 * k + 0.6); }
    }
    const box = [[x - bw / 2, y - bh / 2], [x + bw / 2, y - bh / 2], [x + bw / 2, y + bh / 2], [x - bw / 2, y + bh / 2]];
    if (mode === 'hair') {
      g.strokeStyle = c.ink; g.lineWidth = hair(); g.stroke(toPath(box));
      if (state !== 'dark') { g.fillStyle = c.ink; g.globalAlpha = state === 'here' ? 1 : 0.45; g.fill(toPath(box)); g.globalAlpha = 1; }
      g.beginPath(); g.moveTo(x - bw / 2 - 2, y - bh / 2); g.lineTo(x, y - bh / 2 - 4 * k - 2); g.lineTo(x + bw / 2 + 2, y - bh / 2); g.stroke();
      return;
    }
    g.fillStyle = state === 'dark' ? tone('#5d6470', 0.2) : state === 'here' ? '#fff3cf' : '#f6d38a'; g.fill(toPath(box));
    ink(g, box, { width: 1, color: pen, alpha: 0.9, closed: true, jitter: 0.2, seed: i });
    ink(g, [[x - bw / 2 - 2, y - bh / 2], [x, y - bh / 2 - 4 * k - 2], [x + bw / 2 + 2, y - bh / 2]], { width: 1.2, color: pen, alpha: 0.9, jitter: 0.2, seed: i + 5, taper: 0 });
  }

  function kite(g, K, mode) {
    if (!K || mode !== 'ink') return;
    const c = palette(), s = 1, x = K.x, y = K.y, span = 26 * s, lift = 5 + K.flap * 6;
    g.save(); g.translate(x, y); g.rotate(K.tilt); g.scale(K.dir, 1);
    const wing = side => [[0, 0], [side * span * 0.5, -lift * 0.6], [side * span, -lift * 0.2 + 3], [side * span * 0.55, 4], [0, 3]];
    for (const sd of [-1, 1]) { wash(g, wing(sd), { color: tone('#9a4a22', 0.3), alpha: 0.95 }); ink(g, wing(sd), { width: 0.8, color: c.pen, alpha: 0.9, closed: true, jitter: 0.2, seed: sd + 3 }); }
    g.fillStyle = tone('#f4efe4', 0.3); g.beginPath(); g.ellipse(4, 1, 5, 3, 0, 0, TAU); g.fill();
    g.fillStyle = tone('#9a4a22', 0.3); g.beginPath(); g.moveTo(-3, 1); g.lineTo(-12, -1); g.lineTo(-12, 5); g.fill();
    g.restore();
  }

  // ── a frame ────────────────────────────────────────────────────────────
  function stateOf(i, at) { const d = i - at; return Math.abs(d) < 0.02 ? 'here' : d < 0 ? 'lit' : 'dark'; }

  return {
    render(d, frame) {
      lastData = d;
      const mode = reg === 'quiet' ? 'hair' : 'ink', t = frame.time;
      const target = d.target - 1, still = frame.still || reg === 'quiet';
      if (frame.epoch !== epoch) { epoch = frame.epoch; pos = null; }
      // where the ferry is: it sails from where it was to where the page says, and nowhere by itself
      if (pos === null) { pos = target; from = goal = target; since = dur = 0; }
      else if (target !== goal) { from = pos; goal = target; since = 0; dur = journeyTime(from, goal, reg); }
      const dt = Math.max(0, t - lastT); lastT = t;
      if (still) { pos = goal; dur = 0; }
      else if (dur > 0) { since += Math.min(dt, 0.1); pos = journey(from, goal, since, dur); if (since >= dur) { pos = goal; dur = 0; } }
      const moving = dur > 0 ? Math.sin(Math.PI * clamp(since / dur)) : 0;

      const ck = frame.calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
      if (ck !== calmKey) { calmKey = ck; lastKey = ''; }
      const cel = still ? 0 : d.boil % 3;
      const kb = frame.pointer.keyboard && frame.pointer.inside && reg === 'playful' ? `${frame.pointer.x | 0},${frame.pointer.y | 0}` : '';
      const key = `${mode}|${isDark()}|${cel}|${pos.toFixed(4)}|${still ? 0 : d.boil}|${ck}|${kb}|${st.canvas.width}`;
      if (key === lastKey) return; // nothing new to draw: keep the last frame
      lastKey = key;

      const g = st.begin();
      st.blit(st.cached(`world|${mode}|${isDark()}|${d.seed}`, gg => world(gg, mode)));
      st.blit(st.cached(`water|${mode}|${isDark()}|${cel}|${ck}`, gg => waterCel(gg, cel, frame.calm, mode)));
      for (let i = 0; i < STOPS; i++) lamp(g, i, stateOf(i, Math.round(pos * 50) / 50), mode);
      const F = ferryAt(pos);
      drawFerry(g, F, still ? { dy: 0, roll: 0 } : d.bob, mode, moving, t);
      if (!still) kite(g, d.kite, mode);
      if (kb) {
        const p = frame.pointer;
        g.save(); g.lineWidth = 3; g.strokeStyle = 'rgba(20,24,40,0.55)'; g.beginPath(); g.arc(p.x, p.y, 16, 0, TAU); g.stroke();
        g.lineWidth = 1.6; g.strokeStyle = '#fbf8ef'; g.stroke(); g.restore();
      }
    },
    setRegister(r) { reg = r; ferrySprite = null; lastKey = ''; invalidate(); },
    restyle() { colors = null; ferrySprite = null; st.memo.clear(); lastKey = ''; invalidate(); },
    /** Click, Enter or Space in playful: on to the next stop; after the last, home to the first. */
    activate() {
      if (reg !== 'playful' || !scene) return;
      const now = scene.params.step ?? 1;
      scene.set({ step: now >= STOPS ? 1 : now + 1 });
    },
    destroy() { st.destroy(); ferrySprite = null; },
  };
}
