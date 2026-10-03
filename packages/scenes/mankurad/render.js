// Mankurad: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the paper and its sun stripes, the sun, the clouds, the red
// laterite ground, the new grass, the puddle with its rain rings and the
// resting mango's reflection, the leaves, the branch, the koel and its wing,
// the mango with its blush and raindrops, the splash, the rain, the cooler
// light and the hand-lettered words are the plate's own painters, and so is
// its sprite cache (every hatched shape painted once per boil variant, then
// moved). The port adds the registers, progress, the calm zone, dusk for dark
// pages, the library's own Kalam, the governor and a ready promise.

import { stage, rng, N, TAU, clamp, lerp, phase, ease, smoothstep, catmull, resample, bbox, paper, ink, hatch, wash } from '../../engine/index.js';
import {
  W, H, T, T_FALL, S, MANGO_C, PAPER, INK, mixHex, beats, MANGO, MANGO_B, BRANCH, KOEL, KOEL_WING, CLOUDS, LEAVES, leafGeom,
  GROUND, GROUND_TOP, LAND, PUDDLE as P, ANCHOR as A, PIVOT_I, PERCH_I, STEM, rotAbout, branchBend, mangoAt, SPLASH, RAIN,
} from './model.js';
import { readColors } from '../../core/colors.js';

function stripes(g, W, H) {
  g.save();
  g.translate(W / 2, H / 2); g.rotate(-0.62);
  g.fillStyle = '#f0d4a0'; g.globalAlpha = 0.34;
  for (let x = -W * 1.2; x < W * 1.2; x += 150) g.fillRect(x, -H * 1.2, 72, H * 2.4);
  g.restore();
}

function groundLayer(g) {
  const pts = GROUND.poly;
  wash(g, pts, { color: '#c46a4a', alpha: 0.6 });
  wash(g, pts, { color: '#aa4f36', alpha: 0.55 });
  hatch(g, pts, { angle: -0.16, spacing: 3.6, width: 0.95, color: '#8a3b27', alpha: 0.6, seed: 4, seg: [10, 28], density: (x, y) => 0.35 + 0.55 * smoothstep(790, 860, y) });
  hatch(g, pts, { angle: 0.9, spacing: 5.4, width: 0.8, color: '#6e2c1d', alpha: 0.42, seed: 5, density: (x, y) => 0.6 * smoothstep(800, 880, y) + (Math.abs(x - 515) > 300 ? 0.3 : 0) });
  const r = rng('pores');
  g.save(); g.clip(new Path2D(pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('') + 'Z'));
  for (let i = 0; i < 260; i++) {
    const x = r.range(175, 860), y = r.range(770, 900), rr = r.range(0.8, 3.1);
    g.fillStyle = r.chance(0.78) ? `rgba(92,34,20,${r.range(0.25, 0.6)})` : `rgba(240,178,138,${r.range(0.35, 0.65)})`;
    g.beginPath(); g.ellipse(x, y, rr * 1.4, rr, r.range(-0.3, 0.3), 0, TAU); g.fill();
  }
  g.restore();
  // sunlit top surface: a narrow band of lighter strokes just under the horizon
  const rim = [...GROUND_TOP, ...GROUND_TOP.slice().reverse().map(([x, y]) => [x, y + 16 + 4 * Math.sin(x * 0.03)])];
  hatch(g, rim, { angle: -0.08, spacing: 2.6, width: 0.9, color: '#e39a72', alpha: 0.55, seed: 13, seg: [8, 22], density: () => 0.8 });
  ink(g, GROUND_TOP, { width: 1.9, color: '#6b2f20', alpha: 0.85, jitter: 1, seed: 12, taper: 60 });
}

function paintSun(g, v) {
  const disc = catmull(Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * TAU; return [Math.cos(a) * 62, Math.sin(a) * 62]; }), 6, true);
  wash(g, disc, { color: '#f6c24c', alpha: 0.92 });
  hatch(g, disc, { angle: -0.7, spacing: 3.4, color: '#e3862a', alpha: 0.7, width: 1, seed: v, density: (x, y) => 0.3 + 0.65 * smoothstep(-40, 70, x + y) });
  ink(g, disc, { width: 1.8, color: '#c86a26', alpha: 0.9, closed: true, seed: 40 + v });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + 0.1, r0 = 80, r1 = i % 2 ? 100 : 113;
    ink(g, [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]], { width: 2.3, color: '#d98a2e', alpha: 0.85, taper: 5, seed: i * 3 + v * 11 });
  }
}

function paintCloud(g, c, v, dark) {
  const pts = c.pts;
  wash(g, pts, { color: '#f6f3ec', alpha: 1, grainy: false });
  wash(g, pts, { color: mixHex('#aeb6bd', '#8a94a0', dark), alpha: 0.72 });
  hatch(g, pts, { angle: -0.55, spacing: 4.2, width: 0.9, color: '#5d6875', alpha: 0.6, seed: c.seed * 7 + v, density: (x, y) => 0.1 + 0.8 * smoothstep(-c.h * 0.45, 6, y) });
  if (dark > 0.2) hatch(g, pts, { angle: 0.6, spacing: 5.2, width: 0.8, color: '#4b5663', alpha: 0.5 * dark, seed: c.seed * 11 + v, density: (x, y) => smoothstep(-14, 8, y) });
  ink(g, pts, { width: 1.5, color: '#4c5765', alpha: 0.8, jitter: 0.8, closed: true, seed: c.seed + v * 0.37 });
}

function paintLeaf(g, L, v) {
  const G = L.geo;
  wash(g, G.poly, { color: L.tone, alpha: 0.88 });
  hatch(g, G.half, { angle: 0.75, spacing: 3.3, width: 0.85, color: '#324a1f', alpha: 0.6, seed: L.i * 5 + v, seg: [6, 14] });
  hatch(g, G.poly, { angle: -0.5, spacing: 5.5, width: 0.7, color: '#b4c97a', alpha: 0.35, seed: L.i * 9 + v, seg: [5, 12], density: () => 0.45 });
  ink(g, G.mid.slice(1, -2), { width: 1.1, color: '#2f4020', alpha: 0.6, jitter: 0.4, taper: 30, seed: L.i + v });
  ink(g, G.poly, { width: 1.35, color: '#2b3822', alpha: 0.88, jitter: 0.6, closed: true, seed: L.i * 2 + v });
}

function paintBranch(g, v) {
  const bp = resample(BRANCH, 6), n = bp.length, Lb = [], Rb = [];
  bp.forEach((p, i) => {
    const q = bp[Math.min(n - 1, i + 1)], o = bp[Math.max(0, i - 1)];
    let tx = q[0] - o[0], ty = q[1] - o[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const w = lerp(20, 4, Math.pow(i / (n - 1), 0.8)) * (1 + 0.12 * N(i * 0.3, 4.4));
    Lb.push([p[0] - ty * w / 2, p[1] + tx * w / 2]); Rb.push([p[0] + ty * w / 2, p[1] - tx * w / 2]);
  });
  const bark = [...Lb, ...Rb.slice().reverse()];
  wash(g, bark, { color: '#806040', alpha: 0.92 });
  hatch(g, bark, { angle: -0.35, spacing: 2.4, width: 0.8, color: '#3e2a1b', alpha: 0.65, seed: 2 + v, seg: [5, 16], density: () => 0.7 });
  ink(g, Lb, { width: 1.9, color: '#33241a', alpha: 0.9, seed: 3 + v, taper: 20 });
  ink(g, Rb, { width: 1.4, color: '#33241a', alpha: 0.8, seed: 4 + v, taper: 20 });
}

function paintMango(g, v, ripen) {
  const bnd = MANGO_B;
  wash(g, MANGO, { color: '#f7d66c', alpha: 0.85 });
  wash(g, MANGO, { color: mixHex('#b9bd4c', '#f0b23c', ripen), alpha: 0.62 });
  // green shoulder by the stem, fading as it ripens
  hatch(g, MANGO, { bounds: bnd, angle: 0.4, spacing: 2.5, width: 0.75, color: '#7d9a36', alpha: 0.75, seed: 3 + v, seg: [4, 10],
    density: (x, y) => (1 - smoothstep(8, 80, y)) * (1.15 - ripen) * 1.6 });
  // saffron then red blush across the sunny cheek
  const cheek = (x, y, r) => Math.exp(-((x - 20) ** 2 + (y - 66) ** 2) / (r * r));
  hatch(g, MANGO, { bounds: bnd, angle: -0.5, spacing: 2.3, width: 0.85, color: '#ec7d26', alpha: 0.78, seed: 5 + v, seg: [4, 11], density: (x, y) => cheek(x, y, 56) * 1.15 * ripen });
  hatch(g, MANGO, { bounds: bnd, angle: 0.95, spacing: 2.1, width: 0.85, color: '#cf3b2a', alpha: 0.72, seed: 7 + v, seg: [3, 9], density: (x, y) => cheek(x, y, 36) * 1.25 * ripen });
  // warm mid-shadow on the far side, umber only in the core
  const shade = (x, y) => smoothstep(-5, 100, -x * 0.95 + (y - 76) * 0.7);
  hatch(g, MANGO, { bounds: bnd, angle: -0.85, spacing: 2.6, width: 0.8, color: '#b8662a', alpha: 0.6, seed: 9 + v, seg: [4, 12], density: shade });
  hatch(g, MANGO, { bounds: bnd, angle: 0.75, spacing: 3, width: 0.75, color: '#5d3a22', alpha: 0.5, seed: 11 + v, seg: [4, 10], density: (x, y) => Math.max(0, shade(x, y) - 0.5) * 2 });
  g.save(); g.clip(new Path2D(MANGO.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('') + 'Z'));
  g.fillStyle = 'rgba(255,246,222,0.5)'; g.beginPath(); g.ellipse(22, 36, 11, 20, -0.5, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,251,238,0.85)'; g.beginPath(); g.ellipse(25, 31, 4, 8.5, -0.5, 0, TAU); g.fill();
  g.restore();
  ink(g, MANGO, { width: 2.2, color: '#4a2e1f', alpha: 0.9, jitter: 0.9, closed: true, seed: 20 + v * 1.7 });
  ink(g, [[-3, 2], [1, -1], [5, 3]], { width: 2.4, color: '#3d3322', taper: 2, seed: 1 });
}

function paintWet(g, v, wet) {
  g.save();
  g.clip(new Path2D(MANGO.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('') + 'Z'));
  const r = rng(`drops:${v}`);
  g.globalAlpha = wet;
  for (let i = 0; i < 10; i++) {
    const x = r.range(-40, 44), y = r.range(28, 150), s = r.range(1.6, 3.4);
    g.fillStyle = 'rgba(70,40,20,0.35)'; g.beginPath(); g.ellipse(x + 0.5, y + 1, s, s * 1.25, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,252,242,0.92)'; g.beginPath(); g.ellipse(x - 0.4, y - 0.6, s * 0.55, s * 0.7, 0, 0, TAU); g.fill();
  }
  ink(g, [[34, 46], [41, 70], [43, 96]], { width: 1.9, color: '#fffaf0', alpha: 0.8, taper: 8, seed: 2 + v });
  g.restore();
}

function paintKoel(g, v) {
  wash(g, KOEL, { color: '#22232d', alpha: 0.94 });
  hatch(g, KOEL, { angle: -0.4, spacing: 3, width: 0.7, color: '#7a86a6', alpha: 0.5, seed: 3 + v, seg: [4, 9], density: (x, y) => 0.4 * smoothstep(-20, -52, y) });
  ink(g, KOEL, { width: 1.3, color: '#0f1017', closed: true, seed: 8 + v, jitter: 0.5 });
  g.fillStyle = '#b9c58e';
  g.beginPath(); g.moveTo(-37, -49); g.lineTo(-51, -45); g.lineTo(-37.5, -42.5); g.closePath(); g.fill();
  g.fillStyle = '#d23b2a'; g.beginPath(); g.arc(-29, -49, 2.7, 0, TAU); g.fill();
  g.fillStyle = '#16161c'; g.beginPath(); g.arc(-29, -49, 1.1, 0, TAU); g.fill();
}

function handText(g, text, x, y, size, color, alpha, align = 'center') {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  g.font = `${size}px Kalam, "Segoe Print", "Bradley Hand", "Comic Neue", cursive`;
  g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color;
  g.fillText(text, x, y);
  g.restore();
}


// ── The renderer ──────────────────────────────────────────────────────────

const inCalm = (x, y, calm, pad = 16) => calm.some(r => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);
const overlaps = (a, calm, pad = 12) => calm.some(r => a.x < r.x + r.w + pad && a.x + a.w > r.x - pad && a.y < r.y + r.h + pad && a.y + a.h > r.y - pad);

export function createRenderer(host, { invalidate = () => {}, scene: sceneEl = null } = {}) {
  const st = stage(host, { W, H });
  let colors = null, lastKey = '';
  st.onresize = () => { lastKey = ''; invalidate(); };
  function palette() {
    colors ??= readColors(host, { dark: 'light-dark(#000000, #ffffff)' });
    return { dark: colors.dark !== '#000000' };
  }

  const leaves = LEAVES.map((L, i) => ({ ...L, i, geo: leafGeom(L.len, L.wid, L.curl) }));
  leaves.forEach(L => { L.bounds = bbox(L.geo.poly); });

  // Sprite cache: paint once per (key, device scale), blit forever.
  // A hatched sprite costs 5-40ms to paint, so while playing they are built
  // from a queue with a small per-frame budget. Until a boil variant exists,
  // a sibling variant stands in (the drawing boils a touch less for a moment).
  // Stills build what they need in slices, then draw exactly.
  let sprites = new Map(), spritePx = 0, queue = [], queued = new Set(), sync = true, warm = false, refill = false;
  function build(key, b, scale, paintFn) {
    const pad = 8, k = st.px * scale, c = document.createElement('canvas');
    c.width = Math.ceil((b.w + pad * 2) * k); c.height = Math.ceil((b.h + pad * 2) * k);
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, (pad - b.x) * k, (pad - b.y) * k);
    paintFn(g);
    flush(c);
    const s = { c, x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
    sprites.set(key, s);
    return s;
  }
  // Canvas records paint commands and rasterises them lazily, on first use.
  // Drawing into a 1x1 scratch forces that work now, inside the job's budget.
  const scratch = document.createElement('canvas').getContext('2d');
  const flush = c => scratch.drawImage(c, 0, 0, 1, 1);
  function checkPx() {
    if (st.px === spritePx) return;
    sprites = new Map(); queue = []; queued = new Set(); spritePx = st.px; refill = warm;
  }
  function sprite(key, b, scale, paintFn, alts = []) {
    checkPx();
    const s = sprites.get(key);
    if (s) return s;
    if (!sync) for (const a of alts) { const f = sprites.get(a); if (f) { want({ key, b, scale, paint: paintFn }); return f; } }
    return build(key, b, scale, paintFn);
  }
  function want(job) { if (!queued.has(job.key) && !sprites.has(job.key)) { queued.add(job.key); queue.push(job); } }
  /** Build queued sprites until `budget` ms have gone (at least one per call). */
  function pump(budget) {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < budget) {
      const j = queue.shift(); queued.delete(j.key);
      if (j.run) j.run(); else if (!sprites.has(j.key)) build(j.key, j.b, j.scale, j.paint);
    }
  }
  const blit = (g, s) => g.drawImage(s.c, s.x, s.y, s.w, s.h);
  const others = (v, f) => [f((v + 1) % 3), f((v + 2) % 3)];

  const branchB = (() => { const b = bbox(BRANCH); return { x: b.x - 14, y: b.y - 14, w: b.w + 28, h: b.h + 28 }; })();
  const puddlePts = catmull(Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * TAU, k = 1 + 0.06 * Math.sin(i * 2.7);
    return [Math.cos(a) * P.rx * k, Math.sin(a) * P.ry * k];
  }), 6, true);

  // Every sprite the story uses, as { key, b, scale, paint } specs.
  const paperOpts = { base: PAPER, seed: 5, mottle: 0.03, vignette: 0.05, fibers: 110 };
  const SPEC = {
    sun: v => ({ key: `sun:${v}`, b: { x: -120, y: -120, w: 240, h: 240 }, scale: 1, paint: gg => paintSun(gg, v) }),
    cloud: (c, v, dk) => ({ key: `cloud:${c.seed}:${v}:${dk}`, b: bbox(c.pts), scale: 1, paint: gg => paintCloud(gg, c, v, dk / 2) }),
    ground: () => ({ key: 'ground', b: { x: 170, y: 760, w: 700, h: 150 }, scale: 1, paint: gg => groundLayer(gg) }),
    grass: (v, gk) => ({ key: `grass:${v}:${gk}`, b: { x: 220, y: 700, w: 640, h: 110 }, scale: 1, paint: gg => paintGrass(gg, v, gk) }),
    puddle: v => ({ key: `puddle:${v}`, b: bbox(puddlePts), scale: 1, paint: gg => paintPuddle(gg, v) }),
    leaf: (L, v) => ({ key: `leaf:${L.i}:${v}`, b: L.bounds, scale: 1, paint: gg => paintLeaf(gg, L, v) }),
    branch: v => ({ key: `branch:${v}`, b: branchB, scale: 1, paint: gg => paintBranch(gg, v) }),
    koel: v => ({ key: `koel:${v}`, b: bbox(KOEL), scale: 1.3, paint: gg => paintKoel(gg, v) }),
    mango: (v, rk) => ({ key: `mango:${v}:${rk}`, b: MANGO_B, scale: S, paint: gg => paintMango(gg, v, rk / 12) }),
  };
  const use = (spec, alts = []) => sprite(spec.key, spec.b, spec.scale, spec.paint, alts.map(a => a.key));
  const RK0 = Math.round(beats(0).ripen * 12), RK1 = Math.round(beats(T).ripen * 12);
  // Full-frame paper layers. The plain one is painted in horizontal bands
  // (paper() is seeded, so every band agrees) so no single frame rasterises a
  // whole page of grain; the lit one is the plain one plus the sun stripes.
  const BANDS = 8;
  let layers = new Map(), layersPx = 0;
  function layerCanvas(key) {
    if (st.px !== layersPx) { layers = new Map(); layersPx = st.px; }
    let L = layers.get(key);
    if (!L) {
      const c = document.createElement('canvas'); c.width = st.canvas.width; c.height = st.canvas.height;
      const g = c.getContext('2d'); g.setTransform(st.px, 0, 0, st.px, 0, 0);
      L = { c, g, bands: 0, done: false };
      layers.set(key, L);
    }
    return L;
  }
  function paperBand(i) {
    const L = layerCanvas('paper');
    if (L.done || i < L.bands) return L;
    L.g.save(); L.g.beginPath(); L.g.rect(0, (i * H) / BANDS, W, H / BANDS + 1); L.g.clip();
    paper(L.g, W, H, paperOpts);
    L.g.restore(); flush(L.c);
    L.bands = i + 1; L.done = L.bands >= BANDS;
    return L;
  }
  function paperLayer(key) {
    if (key === 'paper') { const L = layerCanvas('paper'); while (!L.done) paperBand(L.bands); return L.c; }
    const L = layerCanvas('paperLit');
    if (!L.done) { L.g.drawImage(paperLayer('paper'), 0, 0, W, H); L.g.globalAlpha = 0.9; stripes(L.g, W, H); flush(L.c); L.done = true; }
    return L.c;
  }
  const layerJobs = () => [...Array.from({ length: BANDS }, (_, i) => ({ key: `paper:${i}`, run: () => paperBand(i) })), { key: 'paperLit', run: () => paperLayer('paperLit') }];

  /** What the opening frames need, in the order they are drawn. */
  const essentials = () => [
    ...layerJobs(), SPEC.sun(0), SPEC.ground(),
    ...leaves.map(L => SPEC.leaf(L, 0)), SPEC.branch(0), SPEC.koel(0), SPEC.mango(0, RK0),
  ];
  /** Everything else, roughly in the order the story reaches it. */
  function enqueueRest() {
    for (const v of [1, 2]) [SPEC.sun(v), ...leaves.map(L => SPEC.leaf(L, v)), SPEC.branch(v), SPEC.koel(v)].forEach(want);
    for (let rk = RK0; rk <= RK1; rk++) for (const v of [0, 1, 2]) want(SPEC.mango(v, rk));
    for (const dk of [0, 1, 2]) for (const v of [0, 1, 2]) CLOUDS.forEach(c => want(SPEC.cloud(c, v, dk)));
    for (const v of [0, 1, 2]) want(SPEC.puddle(v));
    for (let gk = 1; gk <= 10; gk++) for (const v of [0, 1, 2]) want(SPEC.grass(v, gk));
  }
  function paintGrass(gg, v, gk) {
    const r = rng('grass');
    for (let k = 0; k < 13; k++) {
      const gx = lerp(250, 820, k / 12) + r.range(-16, 16);
      let gy = 800; for (const p of GROUND_TOP) if (p[0] >= gx) { gy = p[1] + 3; break; }
      const grow = clamp((gk / 10) * 1.6 - r() * 0.6);
      for (let j = 0; j < 4; j++) {
        const lean = r.range(-0.6, 0.6), len = r.range(12, 28) * grow;
        if (len < 2) continue;
        ink(gg, [[gx + j * 3, gy], [gx + j * 3 + Math.sin(lean) * len * 0.5, gy - len * 0.6], [gx + j * 3 + Math.sin(lean) * len, gy - len]], { width: 1.8, color: '#5b8a38', alpha: 0.9, taper: 8, seed: k * 4 + j + v });
      }
    }
  }
  function paintPuddle(gg, v) {
    wash(gg, puddlePts, { color: '#8398a8', alpha: 0.82 });
    hatch(gg, puddlePts, { angle: 0.04, spacing: 4, width: 0.8, color: '#e8eef0', alpha: 0.55, seed: 3 + v, seg: [8, 30], gap: 0.8 });
    hatch(gg, puddlePts, { angle: 0.02, spacing: 4.6, width: 0.8, color: '#4d6072', alpha: 0.5, seed: 8 + v, seg: [6, 20], density: (x, y) => smoothstep(-5, P.ry, y) });
    ink(gg, puddlePts, { width: 1.4, color: '#44566a', alpha: 0.85, closed: true, seed: 30 + v, jitter: 0.8 });
  }

  function mango(g, x, y, r, v, ripen, wet, alpha = 1) {
    const rk = Math.round(ripen * 12);
    g.save();
    g.globalAlpha *= alpha;
    g.translate(x, y); g.rotate(r); g.scale(S, S); g.translate(0, -MANGO_C);
    const alts = [...others(v, w => SPEC.mango(w, rk)), ...[rk - 1, rk - 2, rk - 3].flatMap(q => [0, 1, 2].map(w => SPEC.mango(w, q)))];
    blit(g, use(SPEC.mango(v, rk), alts));
    if (wet > 0.01) paintWet(g, v, wet);
    g.restore();
  }

  let resolveReady = null;
  const ready = new Promise(r => { resolveReady = r; });
  // Canvas text never asks for a web font: load Kalam ourselves, then redraw.
  document.fonts?.load?.('26px Kalam').then(() => { lastKey = ''; invalidate(); }, () => {});

  function render(data, frame) {
    const still = frame.still || data.held || data.register === 'quiet';
    const calm = frame.calm || [], q = frame.quality ?? 1, dark = palette().dark;
    checkPx();
    // Warm-up: the opening sprites are painted in slices before the first frame,
    // whether the scene is moving or a still, so no frame stalls on them.
    if (!warm) {
      essentials().forEach(want);
      pump(14);
      if (queue.length) { const g = st.begin(); g.fillStyle = PAPER; g.fillRect(0, 0, W, H); invalidate(); return; }
      warm = true; enqueueRest();
    }
    if (refill) { refill = false; essentials().forEach(want); enqueueRest(); }
    sync = still;
    if (!still) pump(6);
    const lt = data.lt, B = data.B, v = data.v, wind = data.wind;
    const calmKey = calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
    const key = `${lt.toFixed(4)}|${v}|${calmKey}|${dark}|${st.canvas.width}|${q}`;
    if (key === lastKey) return;
    lastKey = key;
    const g = st.begin();

    const beta = branchBend(lt);
    const branchAt = i => rotAbout(BRANCH[i], beta);
    const M = mangoAt(lt);

    // ── paint, back to front ──
    const lit = clamp(B.sun);
    if (lit < 0.99) st.blit(paperLayer('paper'));
    if (lit > 0.01) {
      g.save(); g.globalAlpha = lit;
      st.blit(paperLayer('paperLit'));
      g.restore();
    }

    const sunA = clamp(B.sun) * (1 - 0.35 * B.mood);
    if (sunA > 0.01) {
      g.save(); g.globalAlpha = sunA; g.translate(190, 190);
      blit(g, use(SPEC.sun(v), others(v, SPEC.sun)));
      g.restore();
    }

    const dk = Math.round(B.rain * 2);
    CLOUDS.forEach(c => {
      const inU = ease.inOutSine(phase(lt, 9.5 + c.delay, 17.5 + c.delay));
      const a = inU * (1 - 0.4 * B.cloudsLeave);
      if (a < 0.01) return;
      const ox = (1 - inU) * (1160 - c.x) - B.cloudsLeave * (c.x + c.w + 140) + N(lt * 0.05, c.seed) * 30;
      g.save(); g.globalAlpha = a; g.translate(c.x + ox, c.y);
      const alts = [...others(v, w => SPEC.cloud(c, w, dk)), ...[dk - 1, dk + 1, dk - 2, dk + 2].filter(q2 => q2 >= 0 && q2 <= 2).flatMap(q2 => [0, 1, 2].map(w => SPEC.cloud(c, w, q2)))];
      blit(g, use(SPEC.cloud(c, v, dk), alts));
      g.restore();
    });

    // ground, new grass, puddle
    blit(g, use(SPEC.ground()));
    if (B.grass > 0.02) {
      const gk = Math.round(B.grass * 10);
      if (gk > 0) {
        const alts = [...others(v, w => SPEC.grass(w, gk)), ...Array.from({ length: gk - 1 }, (_, i) => gk - 1 - i).flatMap(q2 => [0, 1, 2].map(w => SPEC.grass(w, q2)))];
        blit(g, use(SPEC.grass(v, gk), alts));
      }
    }
    if (B.puddle > 0.02) {
      g.save();
      g.translate(P.x, P.y); g.scale(B.puddle, B.puddle);
      blit(g, use(SPEC.puddle(v), others(v, SPEC.puddle)));
      g.beginPath(); g.ellipse(0, 0, P.rx * 0.97, P.ry * 0.93, 0, 0, TAU); g.clip();
      g.scale(1 / B.puddle, 1 / B.puddle); g.translate(-P.x, -P.y);
      // rain rings (none under the page's words, fewer on a slow machine)
      if (q >= 0.5) {
        g.lineWidth = 1.1;
        const slot = 0.08, now = Math.floor(lt / slot);
        for (let j = now - 16; j <= now; j++) {
          const r = rng(`ring:${j}`), age = lt - j * slot;
          if (r() > B.rain * 0.95 || age < 0) continue;
          const u = age / 1.2; if (u > 1) continue;
          const x = P.x + r.range(-0.85, 0.85) * P.rx * B.puddle, y = P.y + r.range(-0.6, 0.6) * P.ry * B.puddle, rad = 4 + 32 * ease.outCubic(u);
          if (calm.length && inCalm(x, y, calm, rad + 8)) continue;
          g.strokeStyle = `rgba(238,244,246,${(1 - u) * 0.85})`;
          g.beginPath(); g.ellipse(x, y, rad, rad * 0.2, 0, 0, TAU); g.stroke();
        }
      }
      if (M.phase === 'down') {
        const age = lt - M.landed;
        // the resting mango's reflection
        g.save(); g.translate(0, P.y * 2 + 6); g.scale(1, -1);
        mango(g, 560, LAND, -1.42, v, B.ripen, 0, 0.22);
        g.restore();
        for (let k = 0; k < 4; k++) {
          const u = (age - k * 0.35) / 3.2; if (u < 0 || u > 1) continue;
          const rad = 60 + 200 * ease.outCubic(u);
          g.strokeStyle = `rgba(246,249,249,${(1 - u) * 0.9})`; g.lineWidth = 1.8 * (1 - u) + 0.6;
          g.beginPath(); g.ellipse(560, P.y + 4, rad, rad * 0.15, 0, 0, TAU); g.stroke();
        }
      }
      g.restore();
    }

    // back leaves, branch
    const drawLeaves = front => leaves.forEach(L => {
      if (L.front !== front) return;
      const bi = Math.min(BRANCH.length - 1, Math.floor(L.at * (BRANCH.length - 1)));
      const base = branchAt(bi);
      const sway = 0.07 * wind * Math.sin(lt * 1.7 + L.i) + 0.05 * wind + N(lt * 0.6, L.i * 3.3) * 0.05 * B.wind;
      g.save(); g.translate(base[0], base[1]); g.rotate(L.a + sway);
      blit(g, use(SPEC.leaf(L, v), others(v, w => SPEC.leaf(L, w))));
      g.restore();
    });
    drawLeaves(false);
    g.save(); g.translate(A[0], A[1]); g.rotate(beta); g.translate(-A[0], -A[1]);
    blit(g, use(SPEC.branch(v), others(v, SPEC.branch)));
    g.restore();

    // koel: perches, calls, drops off the branch and glides up and away
    // over the canopy, leaving through the top edge well clear of the sun
    if (B.fly < 1) {
      const perch = branchAt(PERCH_I);
      let x = perch[0], y = perch[1] - 7, r = -0.05 + 0.02 * Math.sin(lt * 1.3), flap = null;
      if (B.fly > 0) {
        const u = ease.inOutSine(B.fly);
        const drop = u < 0.34 ? Math.sin((u / 0.34) * Math.PI) * 38 : 0;
        x = lerp(perch[0], 360, u);
        y = lerp(perch[1] - 7, -95, ease.inQuad(u)) + drop;
        r = lerp(-0.05, 0.38, ease.inOutSine(u)) + 0.04 * Math.sin(lt * 5);
        flap = (Math.sin(lt * 20) + 1) / 2;
      }
      g.save(); g.translate(x, y); g.rotate(r); g.scale(1.3, 1.3);
      blit(g, use(SPEC.koel(v), others(v, SPEC.koel)));
      // in flight the wing swings about the shoulder
      const ang = flap === null ? 0 : 0.35 - 1.35 * flap, ca = Math.cos(ang), sa = Math.sin(ang);
      const wing = KOEL_WING.map(([wx, wy]) => { const dx = wx + 6, dy = wy + 40; return [-6 + dx * ca - dy * sa, -40 + dx * sa + dy * ca]; });
      wash(g, wing, { color: '#16171e', alpha: 0.95 });
      ink(g, wing, { width: 1.2, color: '#0b0c12', closed: true, seed: 5 + v, jitter: 0.5 });
      if (flap === null) {
        ink(g, [[-6, -9], [-8, 4]], { width: 1.3, color: '#3d3322', taper: 2, seed: 9 });
        ink(g, [[5, -9], [3, 4]], { width: 1.3, color: '#3d3322', taper: 2, seed: 10 });
      }
      g.restore();
    }

    // stem and mango
    if (M.phase === 'hang') {
      const top = [M.pivot[0] - Math.sin(M.theta) * STEM, M.pivot[1] + Math.cos(M.theta) * STEM];
      ink(g, [M.knot, M.pivot, top], { width: 3, color: '#4f3f2b', taper: 3, seed: 6 + v, jitter: 0.5 });
    } else ink(g, [M.knot, M.pivot], { width: 3, color: '#4f3f2b', taper: 3, seed: 6 + v, jitter: 0.5 });
    mango(g, M.x, M.y, M.r, v, B.ripen, B.wet);
    drawLeaves(true);

    // splash, as it lands
    if (M.phase === 'down' && q >= 0.5) {
      for (const d of SPLASH) {
        const a = lt - M.landed; if (a < 0 || a > 0.9) continue;
        const x = d.x + d.vx * a, y = 836 + d.vy * a + 450 * a * a;
        if (y > 854 || (calm.length && inCalm(x, y, calm))) continue;
        g.fillStyle = `rgba(110,138,160,${0.85 * (1 - a / 0.9)})`;
        g.beginPath(); g.ellipse(x, y, d.s, d.s * 1.3, 0, 0, TAU); g.fill();
      }
    }

    // rain: none across the page's words, half as much on a slow machine
    const count = Math.floor(RAIN.length * B.rain * (q < 0.75 ? 0.5 : 1));
    if (count) {
      g.save(); g.lineCap = 'round'; g.lineWidth = 1.15;
      for (let i = 0; i < count; i++) {
        const d = RAIN[i], y = ((d.phase + lt * d.speed) % (H + 220)) - 110, x = d.x - (y + 110) * 0.3 - wind * 6;
        if (calm.length && (inCalm(x, y, calm) || inCalm(x - d.len * 0.3, y + d.len, calm))) continue;
        g.strokeStyle = `rgba(62,78,104,${d.a * Math.min(1, B.rain * 1.3)})`;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - d.len * 0.3, y + d.len); g.stroke();
      }
      g.restore();
    }

    // cooler light under the clouds
    if (B.mood > 0.01) {
      g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = B.mood * 0.5;
      g.fillStyle = '#c3ccd6'; g.fillRect(0, 0, W, H); g.restore();
    }
    // dusk on a dark page: the same story later in the day, never inverted
    if (dark) { g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(110,116,170,0.5)'; g.fillRect(0, 0, W, H); g.restore(); }

    // words, kept off the page's own
    const word = (text, x, y, size, alpha, align = 'center', box) => { if (!calm.length || !overlaps(box, calm)) handText(g, text, x, y, size, dark ? '#f2ead8' : INK, alpha, align); };
    if (B.call > 0) { const perch = branchAt(PERCH_I); word('ku-hoo', perch[0] - 150, perch[1] - 64, 26, B.call * 0.6, 'center', { x: perch[0] - 200, y: perch[1] - 84, w: 100, h: 40 }); }
    word('mankurad · the first rain', W / 2, 560, 38, B.card * (1 - B.fadeOut) * 0.85, 'center', { x: W / 2 - 220, y: 535, w: 440, h: 50 });
    word('susegad', W - 52, H - 40, 26, 0.6, 'right', { x: W - 160, y: H - 60, w: 110, h: 40 });

    // fade through paper at the loop seam
    const veil = still ? 0 : Math.max(1 - B.fadeIn, B.fadeOut);
    if (veil > 0.001) { g.save(); g.globalAlpha = veil; g.fillStyle = PAPER; g.fillRect(0, 0, W, H); g.restore(); }
    host.dataset.lt = lt.toFixed(2);
    host.dataset.mango = M.phase;
    if (resolveReady) { resolveReady(); resolveReady = null; }
  }

  return {
    render,
    ready,
    setRegister() { lastKey = ''; },
    restyle() { colors = null; lastKey = ''; },
    /** Enter, Space or a tap in playful: the story starts again. */
    activate() { sceneEl?.replay?.(); },
    destroy() { st.destroy(); },
  };
}

