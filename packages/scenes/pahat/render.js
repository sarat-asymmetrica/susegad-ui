// Pahat: the canvas renderer. Owns every side effect.
//
// quiet    a hairline still: the window and its shutters, the palms and a
//          neighbour's roof outside, a cat asleep on the sill, the notebook,
//          the laptop and the steel tumbler on the desk
// warm     ink and wash: the sky goes from indigo to first light, the stars
//          fade, the morning star holds on, the room comes out of the dark and
//          a few birds cross; then it rests
// playful  your hand moves the dawn: left is half past four, right is first
//          light; Enter or Space plays it again from the dark
//
// The room and the view are painted once, in ink and wash, time-sliced over
// the first frames so no single task is long; a night copy is that painting
// with the dark laid over it. A frame is the sky, the night copy, the day
// copy at the dawn's opacity, the light on the desk and the steam.

import { stage, rng, clamp, lerp, TAU, smoothstep, hexToRgb, ink, hatch, wash, toPath, ellipse, grainPattern, N, boil } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, WIN, DESK, DAWN, dawn } from './model.js';

const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const FR = 20, SILL = { y: WIN.sill, d: 26, over: 26 };
const TUMBLER = { x: 912, y: 706, r: 27, h: 78 };
const LAP = { base: [[572, 716], [772, 736], [812, 668], [628, 652]], lid: [[628, 652], [812, 668], [822, 538], [616, 522]] };
const CAT = { x: 868, y: SILL.y };

export function createRenderer(host, { register, scene, invalidate }) {
  const st = stage(host, { W, H });
  let reg = register, colors = null, lastKey = '', epoch = -1, scrub = null, travel = 0;
  let layers = null, job = null, readyResolve = null;
  const ready = new Promise(r => { readyResolve = r; });
  st.onresize = () => { layers = null; job = null; lastKey = ''; invalidate(); };

  function palette() {
    return (colors ??= readColors(host, {
      paper: 'var(--sg-paper, light-dark(#f1ede4, #151a2b))',
      ink: 'var(--sg-ink, light-dark(#1d2742, #ebe5d6))',
      pencil: 'var(--sg-pencil, light-dark(#8e93a6, #6e6a5e))',
      lime: 'var(--sg-pahat-wall, #e3d8c3)',
      teak: 'var(--sg-pahat-teak, #8a5a33)',
      shutter: 'var(--sg-pahat-shutter, #3d6f78)',
      laterite: 'var(--sg-laterite, #b3563a)',
      paddy: 'var(--sg-paddy, #5b8b3b)',
      sea: 'var(--sg-sea, #6f98a8)',
      indigo: 'var(--sg-indigo, #2b3a6b)',
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }
  const isDark = () => palette().dark !== '#000000';
  const hairW = () => (1.1 * W) / (st.canvas.clientWidth || W);
  const SEPIA = '#2a1c12';

  /** One shape, in either hand: a wash with optional hatching and an inked edge, or a hairline. */
  function part(g, pts, mode, { fill = null, alpha = 0.95, shade = null, edge = SEPIA, ew = 1.1, closed = true, seed = 0, pencil = false } = {}) {
    const c = palette();
    if (mode === 'hair') {
      if (fill) { g.fillStyle = c.paper; g.fill(toPath(pts, closed)); }
      g.strokeStyle = pencil ? c.pencil : c.ink; g.lineWidth = hairW() * (pencil ? 0.8 : 1);
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); if (closed) g.closePath(); g.stroke();
      return;
    }
    if (fill) wash(g, pts, { color: fill, alpha, grainy: false });
    if (shade) hatch(g, pts, { spacing: 2.6, width: 0.7, color: SEPIA, alpha: 0.35, seed, ...shade });
    if (edge) ink(g, pts, { width: ew, color: edge, alpha: 0.85, closed, jitter: 0.45, seed: seed + 1, taper: closed ? 14 : 8 });
  }

  // ── the painting, as steps: each yields so a frame never waits long ─────
  function* paint(g, mode) {
    const c = palette(), d = lastData, S = d.night;
    const { x0, x1, top } = WIN, sy = SILL.y;
    // paper, then the lime-washed wall with the window cut out of it
    if (mode === 'hair') { g.fillStyle = c.paper; g.fillRect(0, 0, W, H); }
    else { // the paper's tooth comes from the one grain pass at the end
      g.fillStyle = '#efe7d6'; g.fillRect(0, 0, W, H);
      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
      vg.addColorStop(0, 'rgba(60,40,20,0)'); vg.addColorStop(1, 'rgba(60,40,20,0.12)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
    yield;
    const wall = rect(0, 0, W, DESK);
    if (mode === 'ink') {
      wash(g, wall, { color: c.lime, alpha: 0.7, grainy: false });
      yield;
      hatch(g, rect(0, 0, W, 60), { angle: 0.05, spacing: 3.2, seg: [20, 70], width: 0.7, color: SEPIA, alpha: 0.3, seed: 2, density: (x, y) => 1 - y / 60 });
      yield;
      hatch(g, rect(0, 0, 70, DESK), { angle: 1.45, spacing: 3, seg: [30, 90], width: 0.7, color: SEPIA, alpha: 0.3, seed: 3, density: x => 1 - x / 70 });
      yield;
      hatch(g, rect(x0 - 110, sy + SILL.d, x1 + 110, DESK), { angle: -0.9, spacing: 3.4, seg: [8, 20], width: 0.6, color: SEPIA, alpha: 0.28, seed: 4, density: (x, y) => (1 - (y - sy - SILL.d) / (DESK - sy - SILL.d)) * smoothstep(x0 - 110, x0 + 40, x) * smoothstep(x1 + 110, x1 - 40, x) });
    }
    part(g, [[70, 0], [70, DESK]], mode, { closed: false, pencil: true, edge: SEPIA, ew: 0.9, seed: 5 }); // the corner of the room
    yield;
    // the view: hills, a neighbour's house, three palms, clipped to the window
    g.save(); g.beginPath(); g.rect(x0, top, x1 - x0, sy - top); g.clip();
    g.clearRect(x0, top, x1 - x0, sy - top); // the sky is drawn beneath, per frame
    const hill = [[x0 - 10, sy - 60]];
    for (let x = x0; x <= x1 + 10; x += 16) hill.push([x, sy - 92 - Math.sin((x - x0) / 190) * 34 - N(x * 0.012, 3.1) * 14]);
    hill.push([x1 + 10, sy], [x0 - 10, sy]);
    part(g, hill, mode, { fill: mixHex(c.sea, '#3a4a44', 0.45), alpha: 0.9, shade: { angle: -0.5, spacing: 3.4, seg: [5, 14], alpha: 0.3 }, seed: 6, pencil: true });
    const hx = x0 + 400, hw = 200, hy = sy - 70;
    part(g, rect(hx, hy, hx + hw, sy), mode, { fill: '#e6dcc6', shade: { angle: -0.8, spacing: 2.8, density: x => smoothstep(hx + hw * 0.55, hx + hw, x) }, seed: 7, pencil: true });
    const roof = [[hx - 20, hy + 3], [hx + hw / 2, hy - 48], [hx + hw + 20, hy + 3]];
    part(g, roof, mode, { fill: c.laterite, shade: { angle: 1.2, spacing: 2.4, seg: [3, 8], alpha: 0.4 }, seed: 8 });
    if (mode === 'ink') for (let i = 1; i < 6; i++) { const y = hy + 3 - i * 8.5, half = (hw / 2 + 20) * (1 - i / 6.2); for (let x = hx + hw / 2 - half; x < hx + hw / 2 + half - 8; x += 14) ink(g, [[x, y], [x + 7, y - 4], [x + 14, y]], { width: 0.8, color: '#4a1a0c', alpha: 0.6, jitter: 0.3, seed: x + i, taper: 2 }); }
    part(g, rect(hx + 36, hy + 20, hx + 58, hy + 48), mode, { fill: '#3a3530', seed: 9 });
    yield;
    for (const p of S.palms) { palm(g, p, mode); yield; }
    g.restore();
    // shutters folded back against the wall, louvred and painted
    for (const [a, b] of [[x0 - FR - 96, x0 - FR - 8], [x1 + FR + 8, x1 + FR + 96]]) {
      const leaf = rect(a, top - 6, b, sy - 4);
      if (mode === 'ink') { g.fillStyle = 'rgba(40,24,10,0.2)'; g.fill(toPath(rect(a + 7, top + 2, b + 7, sy + 4))); }
      part(g, leaf, mode, { fill: c.shutter, seed: a | 0 });
      for (let y = top + 16; y < sy - 16; y += 11) part(g, [[a + 10, y], [b - 10, y + 3]], mode, { closed: false, edge: '#1d3438', ew: 1.1, seed: y, pencil: true });
      part(g, rect(a + 8, top + 8, b - 8, sy - 14), mode, { edge: '#1d3438', ew: 0.8, seed: a + 2, pencil: true });
    }
    yield;
    // the frame: teak jambs and head, iron bars, a deep sill
    const teak = mixHex(c.teak, '#3a2414', 0.1);
    for (const r of [rect(x0 - FR, top - FR, x1 + FR, top), rect(x0 - FR, top, x0, sy), rect(x1, top, x1 + FR, sy)]) part(g, r, mode, { fill: teak, shade: { angle: Math.PI / 2, spacing: 3, seg: [20, 60], alpha: 0.3 }, seed: r[0][0] | 0 });
    for (let i = 1; i <= 5; i++) { const x = lerp(x0, x1, i / 6); part(g, [[x, top], [x, sy]], mode, { closed: false, edge: '#141414', ew: 4.2, seed: 40 + i }); }
    part(g, rect(x0, top + 132, x1, top + 139), mode, { fill: '#1d1d1d', edge: '#141414', ew: 0.8, seed: 47 });
    const sill = [[x0 - FR - SILL.over, sy], [x1 + FR + SILL.over, sy], [x1 + FR + SILL.over + 8, sy + SILL.d * 0.55], [x0 - FR - SILL.over - 8, sy + SILL.d * 0.55]];
    const lip = rect(x0 - FR - SILL.over - 8, sy + SILL.d * 0.55, x1 + FR + SILL.over + 8, sy + SILL.d);
    part(g, sill, mode, { fill: mixHex(teak, '#e8c8a0', 0.15), seed: 50 });
    part(g, lip, mode, { fill: mixHex(teak, '#1a0c04', 0.25), shade: { angle: 0.1, spacing: 2.2, alpha: 0.35 }, seed: 51 });
    yield;
    cat(g, mode);
    yield;
    // the desk: a teak top with its grain
    const desk = rect(0, DESK, W, H);
    part(g, desk, mode, { fill: c.teak, alpha: 0.85, edge: null, seed: 60 });
    if (mode === 'ink') {
      const r = rng('desk'), nz = N;
      g.strokeStyle = SEPIA; g.lineCap = 'round';
      for (let k = 0; k < 20; k++) {
        const base = DESK + 8 + k * 10.5 + r.range(-3, 3);
        g.globalAlpha = r.range(0.12, 0.3); g.lineWidth = r.range(0.5, 1.1); g.beginPath();
        let x = r.range(-40, 120);
        while (x < W) { const len = r.range(90, 300); g.moveTo(x, base); for (let t = x + 12; t <= x + len; t += 12) g.lineTo(t, base + nz(t * 0.004, k, 2) * 6); x += len + r.range(20, 120); }
        g.stroke();
      }
      g.globalAlpha = 1;
      hatch(g, rect(0, DESK, W, DESK + 22), { angle: 0.05, spacing: 2.4, width: 0.6, color: SEPIA, alpha: 0.3, seed: 61, density: (x, y) => 1 - (y - DESK) / 22 });
    }
    part(g, [[0, DESK], [W, DESK]], mode, { closed: false, ew: 1.4, seed: 62 });
    yield;
    notebook(g, mode);
    yield;
    laptop(g, mode);
    tumbler(g, mode);
    if (mode === 'ink') { // one fine grain over everything painted: the paper's tooth
      g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = grainPattern(g, '#2a1c12', { lo: 0, hi: 0.5 }); g.globalAlpha = 0.14; g.fillRect(0, 0, W, H); g.restore();
    }
  }

  function palm(g, p, mode) {
    const c = palette(), sy = SILL.y, top = [p.x + p.lean * p.h, sy - p.h];
    const col = mixHex(c.paddy, '#1d2a22', 0.55);
    // a trunk that thickens toward the ground, ringed
    const trunk = []; for (let i = 0; i <= 16; i++) { const u = i / 16; trunk.push([p.x + p.lean * p.h * Math.pow(u, 1.3), sy + 30 - (p.h + 30) * u]); }
    if (mode === 'hair') part(g, trunk, mode, { closed: false, pencil: true });
    else {
      for (let i = 0; i < trunk.length - 1; i++) { const w = lerp(9, 5, i / 16); ink(g, [trunk[i], trunk[i + 1]], { width: w, color: '#3e3a30', alpha: 0.95, jitter: 0.2, seed: p.seed + i, taper: 0 }); }
      for (let i = 1; i < 15; i++) { const [x, y] = trunk[i], w = lerp(4.5, 2.5, i / 16); ink(g, [[x - w, y], [x + w, y + 1.5]], { width: 0.8, color: '#1a1712', alpha: 0.6, jitter: 0.2, seed: i, taper: 0 }); }
    }
    const r = rng(`fr:${p.seed}`);
    for (let f = 0; f < p.fr; f++) {
      const a = lerp(-Math.PI - 0.5, 0.5, (f + r.range(0.3, 0.7)) / p.fr) + p.ph, len = p.h * r.range(0.34, 0.46), droop = r.range(0.45, 0.75);
      const at = u => [top[0] + Math.cos(a) * len * u, top[1] + Math.sin(a) * len * u * 0.7 + len * droop * u * u];
      const spine = []; for (let u = 0; u <= 1.001; u += 0.1) spine.push(at(u));
      if (mode === 'hair') { part(g, spine, mode, { closed: false, pencil: true }); continue; }
      ink(g, spine, { width: 2.2, color: col, alpha: 0.95, jitter: 0.4, seed: p.seed + f, taper: 18 });
      g.strokeStyle = col; g.lineWidth = 1.3; g.lineCap = 'round'; g.globalAlpha = 0.85; g.beginPath();
      for (let u = 0.12; u < 0.98; u += 0.07) {
        const [x, y] = at(u), [x2, y2] = at(u + 0.01), l = Math.hypot(x2 - x, y2 - y) || 1, tx = (x2 - x) / l, ty = (y2 - y) / l, ll = len * 0.2 * (1 - 0.6 * u);
        for (const sd of [-1, 1]) { const dx = tx * 0.4 - ty * sd, dy = ty * 0.4 + tx * sd + 0.9; const m = Math.hypot(dx, dy); g.moveTo(x, y); g.lineTo(x + (dx / m) * ll, y + (dy / m) * ll); }
      }
      g.stroke(); g.globalAlpha = 1;
    }
  }

  function cat(g, mode) {
    const { x, y } = CAT, c = palette();
    const body = ellipse(x, y - 20, 50, 21, { n: 40 }).map(([px, py]) => [px, Math.min(py, y - 1)]);
    const head = ellipse(x - 44, y - 22, 17, 15, { n: 28 });
    const ears = [[[x - 56, y - 31], [x - 54, y - 46], [x - 45, y - 35]], [[x - 40, y - 36], [x - 31, y - 46], [x - 30, y - 30]]];
    const tail = [[x + 44, y - 8], [x + 30, y - 2], [x - 4, y - 1], [x - 30, y - 5]];
    const fur = '#8a7a66';
    if (mode === 'ink') { g.fillStyle = 'rgba(40,24,10,0.25)'; g.beginPath(); g.ellipse(x + 4, y + 2, 58, 4, 0, 0, TAU); g.fill(); }
    part(g, body, mode, { fill: fur, shade: { angle: -0.6, spacing: 2.2, seg: [3, 8], alpha: 0.45, density: (px, py) => smoothstep(y - 30, y, py) }, seed: 70 });
    for (const e of ears) part(g, e, mode, { fill: fur, seed: 71 });
    part(g, head, mode, { fill: fur, shade: { angle: -0.6, spacing: 2.4, seg: [3, 7], alpha: 0.3 }, seed: 72 });
    part(g, tail, mode, { closed: false, ew: 5, edge: mode === 'ink' ? '#6e604e' : SEPIA, seed: 73 });
    if (mode === 'ink') {
      // stripes, and eyes shut
      for (let i = 0; i < 6; i++) { const sx = x - 22 + i * 12; ink(g, [[sx, y - 38 + Math.abs(i - 2.5) * 2], [sx + 4, y - 24]], { width: 1.6, color: '#4a3c2c', alpha: 0.55, jitter: 0.3, seed: i + 80, taper: 4 }); }
      for (const ex of [x - 50, x - 38]) ink(g, [[ex - 3, y - 23], [ex, y - 21], [ex + 3, y - 23]], { width: 1, color: SEPIA, alpha: 0.9, jitter: 0.1, seed: ex | 0, taper: 1 });
      void c;
    }
  }

  function notebook(g, mode) {
    const c = palette(), cx = 205, cy = 690, a = -0.08;
    const P = (x, y) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
    const left = [P(-130, -46), P(0, -40), P(0, 50), P(-128, 44)], right = [P(0, -40), P(130, -46), P(128, 44), P(0, 50)];
    if (mode === 'ink') { g.fillStyle = 'rgba(40,24,10,0.25)'; g.fill(toPath([P(-126, -40), P(136, -40), P(134, 58), P(-124, 54)])); }
    for (const pg of [left, right]) part(g, pg, mode, { fill: '#f4ecd8', seed: pg[0][0] | 0 });
    for (let i = 0; i < 6; i++) {
      const y = -28 + i * 13;
      part(g, [P(-120, y), P(-8, y + 2)], mode, { closed: false, edge: '#9db4cf', ew: 0.6, seed: i, pencil: true });
      part(g, [P(8, y + 2), P(120, y)], mode, { closed: false, edge: '#9db4cf', ew: 0.6, seed: i + 9, pencil: true });
    }
    if (mode === 'ink') {
      const r = rng('notes');
      for (let i = 0; i < 5; i++) {
        let x = -114; const y = -32 + i * 13;
        while (x < (i === 4 ? -40 : -12)) { const l = r.range(10, 26); const pts = []; for (let u = 0; u <= l; u += 1.5) pts.push(P(x + u, y - Math.abs(Math.sin(u * 0.6 + i)) * 4)); ink(g, pts, { width: 0.9, color: c.indigo, alpha: 0.75, jitter: 0.3, seed: i * 10 + x, taper: 2 }); x += l + r.range(4, 8); }
      }
      ink(g, [P(-2, -40), P(-1, 50)], { width: 1.2, color: SEPIA, alpha: 0.6, jitter: 0.2, seed: 90, taper: 4 });
    }
    // a pencil across the right page
    const pen = [P(20, 28), P(122, -10)];
    part(g, pen, mode, { closed: false, ew: mode === 'ink' ? 6 : 1, edge: mode === 'ink' ? '#d9a33a' : SEPIA, seed: 91 });
    if (mode === 'ink') ink(g, [P(14, 30), P(22, 27)], { width: 3, color: '#3a2a1a', alpha: 0.9, jitter: 0.1, seed: 92, taper: 3 });
  }

  function laptop(g, mode) {
    const { base, lid } = LAP;
    if (mode === 'ink') { g.fillStyle = 'rgba(40,24,10,0.28)'; g.fill(toPath(base.map(([x, y]) => [x + 10, y + 8]))); }
    part(g, base, mode, { fill: '#8d9199', shade: { angle: 0.2, spacing: 2.6, alpha: 0.25 }, seed: 100 });
    const kb = [[602, 704], [758, 719], [786, 676], [640, 663]];
    part(g, kb, mode, { fill: '#5d6168', edge: SEPIA, ew: 0.7, seed: 101, pencil: true });
    part(g, lid, mode, { fill: '#2c3038', seed: 102 });
    part(g, [[636, 646], [800, 660], [808, 548], [630, 533]], mode, { fill: '#1d2433', edge: '#0e1118', ew: 0.8, seed: 103, pencil: true });
  }

  function tumbler(g, mode) {
    const { x, y, r, h } = TUMBLER;
    const body = [[x - r, y - h], [x + r, y - h], [x + r - 5, y], [x - r + 5, y]];
    if (mode === 'ink') { g.fillStyle = 'rgba(40,24,10,0.28)'; g.beginPath(); g.ellipse(x + 12, y + 3, r + 6, 6, 0, 0, TAU); g.fill(); }
    part(g, body, mode, { fill: '#b8bec4', shade: { angle: Math.PI / 2, spacing: 2.2, seg: [20, 60], alpha: 0.45, density: px => smoothstep(x - r * 0.2, x + r, px) + (px < x - r * 0.7 ? 0.5 : 0) }, seed: 110 });
    if (mode === 'ink') ink(g, [[x - r * 0.45, y - h + 8], [x - r * 0.4, y - 8]], { width: 3.2, color: '#ffffff', alpha: 0.7, jitter: 0.2, seed: 111, taper: 8 });
    part(g, ellipse(x, y - h, r, 6.5, { n: 30 }), mode, { fill: '#7a5230', seed: 112 });
    part(g, ellipse(x, y - h + 1, r - 3, 4.5, { n: 30 }), mode, { fill: '#c9a47a', edge: null, seed: 113 });
  }

  // ── building the layers, a slice at a time ─────────────────────────────
  function startBuild(mode) {
    const lit = document.createElement('canvas'); lit.width = st.canvas.width; lit.height = st.canvas.height;
    const g = lit.getContext('2d'); g.setTransform(st.px, 0, 0, st.px, 0, 0);
    job = { mode, lit, it: paint(g, mode), done: false };
  }
  function step(budget = 8) {
    const t0 = performance.now();
    while (!job.done && performance.now() - t0 < budget) {
      const r = job.it.next();
      job.lit.getContext('2d').getImageData(0, 0, 1, 1); // make the rasteriser do this slice's work now
      if (r.done) job.done = true;
    }
    if (!job.done) return false;
    const night = document.createElement('canvas'); night.width = job.lit.width; night.height = job.lit.height;
    const ng = night.getContext('2d');
    ng.drawImage(job.lit, 0, 0);
    ng.globalCompositeOperation = 'source-atop'; ng.fillStyle = 'rgba(10,12,34,0.84)'; ng.fillRect(0, 0, night.width, night.height);
    layers = { mode: job.mode, lit: job.lit, night, dark: isDark() };
    job = null;
    readyResolve?.(); readyResolve = null;
    return true;
  }

  // ── per frame ────────────────────────────────────────────────────────────
  function skyNow(g, f, S, t) {
    const gr = g.createLinearGradient(0, WIN.top, 0, SILL.y - 60);
    gr.addColorStop(0, f.sky.top); gr.addColorStop(1, f.sky.hor);
    g.fillStyle = gr; g.fillRect(WIN.x0, WIN.top, WIN.x1 - WIN.x0, SILL.y - WIN.top);
    // the sky is hatched too, faintly, so it sits with the drawing
    if (f.stars > 0.01) for (const s of S.stars) {
      const tw = 0.75 + 0.25 * Math.sin(t * 1.3 + s.tw);
      g.fillStyle = `rgba(255,248,230,${s.b * f.stars * tw})`; g.beginPath(); g.arc(s.x, s.y, 0.8 + s.b, 0, TAU); g.fill();
    }
    if (f.venus > 0.01) {
      const { x, y } = S.venus, gl = g.createRadialGradient(x, y, 0, x, y, 18);
      gl.addColorStop(0, `rgba(255,252,240,${f.venus})`); gl.addColorStop(0.25, `rgba(255,240,210,${0.5 * f.venus})`); gl.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x, y, 18, 0, TAU); g.fill();
    }
    g.strokeStyle = '#1b1a22'; g.lineWidth = 1.4; g.lineCap = 'round';
    for (const b of f.birds) {
      const lift = b.s * (0.2 + 0.4 * b.flap);
      g.globalAlpha = b.a; g.beginPath();
      g.moveTo(b.x - b.s, b.y - lift); g.quadraticCurveTo(b.x - b.s * 0.45, b.y - b.s * 0.2, b.x, b.y + b.s * 0.12);
      g.quadraticCurveTo(b.x + b.s * 0.45, b.y - b.s * 0.2, b.x + b.s, b.y - lift); g.stroke();
    }
    g.globalAlpha = 1;
  }
  function lightNow(g, v) {
    // the dawn through the bars, laid on the sill, the wall below and the desk
    if (v > 0.01) {
      g.save(); g.globalCompositeOperation = 'soft-light';
      g.translate((WIN.x0 + WIN.x1) / 2 + 60, SILL.y + 150); g.scale(1.9, 1);
      const pg = g.createRadialGradient(0, 0, 10, 0, 0, 260); pg.addColorStop(0, `rgba(255,214,160,${0.75 * v})`); pg.addColorStop(1, 'rgba(255,214,160,0)');
      g.fillStyle = pg; g.fillRect(-270, -200, 540, 480); g.restore();
    }
    // the laptop's glow, the same all night, so it matters less as the day comes
    const k = 1 - 0.7 * v, gl = g.createRadialGradient(720, 600, 10, 720, 600, 260);
    gl.addColorStop(0, `rgba(150,180,255,${0.22 * k})`); gl.addColorStop(1, 'rgba(150,180,255,0)');
    g.fillStyle = gl; g.fillRect(460, 340, 520, 460);
    g.strokeStyle = '#8fa6c9'; g.lineWidth = 2; g.lineCap = 'round'; g.globalAlpha = 0.55;
    const r = rng('code'); g.beginPath();
    for (let i = 0; i < 7; i++) { const y0 = 553 + i * 13, x0 = 642 + r.pick([0, 0, 10, 20]), len = r.range(40, 130); g.moveTo(x0, y0 + (x0 - 630) * 0.085); g.lineTo(x0 + len, y0 + (x0 + len - 630) * 0.085); }
    g.stroke(); g.globalAlpha = 1;
  }
  function steamNow(g, t, calm) {
    const { x, y, h } = TUMBLER;
    for (let i = 0; i < 3; i++) {
      const age = (t * 0.35 + i / 3) % 1, pts = [];
      for (let u = 0; u <= 1.001; u += 0.1) pts.push([x - 8 + i * 8 + Math.sin(u * 5 + t * 0.8 + i * 2) * 7 * u, y - h - 6 - u * 80 * (0.5 + age)]);
      const quiet = calm.some(r => x > r.x - 40 && x < r.x + r.w + 40 && y - h - 50 > r.y - 40 && y - h - 50 < r.y + r.h + 40);
      ink(g, pts, { width: 1.6, color: '#f4f1ea', alpha: Math.sin(Math.PI * age) * 0.5 * (quiet ? 0.2 : 1), jitter: 0.3, seed: i, taper: 16 });
    }
  }

  let lastData = null;
  return {
    ready,
    render(d, frame) {
      lastData = d;
      const mode = reg === 'quiet' ? 'hair' : 'ink', still = frame.still || reg === 'quiet', t = d.time, p = frame.pointer;
      if (layers && (layers.mode !== mode || layers.dark !== isDark())) layers = null;
      if (!layers) {
        if (!job || job.mode !== mode) startBuild(mode);
        if (!step()) { invalidate(); if (!lastKey) { const g = st.begin(); g.fillStyle = palette().paper; g.fillRect(0, 0, W, H); } return; }
        lastKey = '';
      }
      if (frame.epoch !== epoch) { epoch = frame.epoch; scrub = null; travel = p.travel; }
      let f = d;
      // the hand takes over the dawn only once it moves
      if (reg === 'playful' && !still && p.inside && p.travel !== travel) { travel = p.travel; scrub = clamp((p.x - WIN.x0 + 60) / (WIN.x1 - WIN.x0 + 120)); }
      if (scrub !== null && reg === 'playful') f = { ...d, ...dawn(scrub, t, d.seed, Math.max(0, t - 0.62 * DAWN.playful)) };
      const fps = reg === 'playful' ? 12 : 8, tick = still ? 0 : boil(t, fps);
      const kb = p.keyboard && p.inside && reg === 'playful' ? `${p.x | 0},${p.y | 0}` : '';
      const key = `${mode}|${isDark()}|${f.u.toFixed(3)}|${tick}|${f.birds.length}|${frame.calm.length}|${st.canvas.width}|${kb}`;
      if (key === lastKey) return;
      lastKey = key;
      const g = st.begin();
      if (mode === 'hair') { g.fillStyle = palette().paper; g.fillRect(0, 0, W, H); st.blit(layers.lit); return; }
      const tq = still ? t : tick / fps, v = smoothstep(0.15, 1, f.u);
      skyNow(g, f, d.night, tq);
      st.blit(layers.night);
      if (v > 0.001) { g.globalAlpha = v; st.blit(layers.lit); g.globalAlpha = 1; }
      lightNow(g, v);
      if (!still) steamNow(g, tq, frame.calm);
      if (isDark()) { g.fillStyle = 'rgba(8,10,24,0.16)'; g.fillRect(0, 0, W, H); }
      if (kb) {
        g.save(); g.lineWidth = 3; g.strokeStyle = 'rgba(20,24,40,0.55)'; g.beginPath(); g.arc(p.x, p.y, 16, 0, TAU); g.stroke();
        g.lineWidth = 1.6; g.strokeStyle = '#fbf8ef'; g.stroke(); g.restore();
      }
    },
    setRegister(r) { reg = r; lastKey = ''; invalidate(); },
    restyle() { colors = null; layers = null; job = null; lastKey = ''; invalidate(); },
    /** Enter, Space or a click in playful: the dawn again, from the dark. */
    activate() { if (reg === 'playful') scene?.replay(); },
    destroy() { st.destroy(); layers = null; job = null; },
  };
}
