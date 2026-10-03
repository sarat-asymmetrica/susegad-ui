// Saanj: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the land, the palms, the flooded plots holding the sky, the
// sky strip mixed in OKLCH, the stars and the birds as batched ink ticks are
// the plate's own drawing code. What the port adds: the registers (a still in
// quiet, an easier dusk in warm, the hawk in playful), a keyboard hawk you can
// see, Enter to startle the flock, the calm zone the flock flies round, a later
// hour for dark pages, and the governor's share of birds.

import {
  stage, ink, hatch, rng, makeNoise, clamp, lerp, smoothstep, ease, TAU, grainPattern, rgba, toPath,
} from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import {
  W, H, HZ, NB, CYCLE, STILL_TIME, STILL_DARK, HAWK, skyLch, skyS, oklchToRgb, nightFor,
  createFlock, resetFlock, stepFlock, simulate, startle,
} from './model.js';

const INK = '#1a1520';

function palmPts(p) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const s = i / 14;
    pts.push([p.x + p.lean * p.h * Math.pow(s, 1.5) + p.bend * p.h * s * s, p.y - p.h * s]);
  }
  return pts;
}

/** A coconut palm in ink: a trunk that thins as it rises, then the crown. */
function drawPalm(g, p) {
  const pts = palmPts(p), r = rng(`palm:${p.seed}`), n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], s = i / (n - 1);
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const w = p.w * (1 - 0.45 * s + 0.35 * Math.pow(1 - s, 6)) / 2 * (1 + 0.12 * Math.sin(i * 2.3 + p.seed));
    const off = Math.sin(s * 5 + p.seed) * 0.6;
    L.push([pts[i][0] - ty * (w + off), pts[i][1] + tx * (w + off)]); R.push([pts[i][0] + ty * (w - off), pts[i][1] - tx * (w - off)]);
  }
  const col = p.color || INK;
  g.save();
  g.fillStyle = col;
  g.beginPath(); L.forEach((q, i) => (i ? g.lineTo(...q) : g.moveTo(...q))); R.reverse().forEach(q => g.lineTo(...q)); g.closePath(); g.fill();
  // ring scars on the trunk, catching the last light
  g.strokeStyle = rgba('#f0c49a', 0.13); g.lineWidth = 0.6;
  if (!p.fine) for (let i = 2; i < 13; i++) { const [x, y] = pts[i]; g.beginPath(); g.moveTo(x - p.w * 0.35, y); g.lineTo(x + p.w * 0.35, y + 0.6); g.stroke(); }
  const [cx, cy] = pts[n - 1];
  const spines = new Path2D(), leaves = new Path2D();
  for (let k = 0; k < p.n; k++) {
    const a = lerp(-Math.PI - 0.6, 0.6, k / (p.n - 1)) + r.range(-0.14, 0.14);
    const len = p.frond * r.range(0.8, 1.15);
    const droop = 0.45 + 0.4 * (1 - Math.abs(Math.cos(a))) + r.range(-0.12, 0.12);
    const P = u => [cx + Math.cos(a) * len * u, cy + Math.sin(a) * len * u + len * droop * u * u];
    const Tn = u => { const tx = Math.cos(a) * len, ty = Math.sin(a) * len + 2 * len * droop * u; const l = Math.hypot(tx, ty) || 1; return [tx / l, ty / l]; };
    spines.moveTo(cx, cy);
    for (let u = 0.1; u <= 1.001; u += 0.1) spines.lineTo(...P(u));
    for (let u = 0.08; u <= 1; u += 0.045) {
      const [x, y] = P(u), [tx, ty] = Tn(u), LL = len * 0.28 * (1 - 0.6 * u) + 2;
      for (const sd of [-1, 1]) {
        const ca = Math.cos(0.95 * sd), sa = Math.sin(0.95 * sd);
        let dx = tx * ca - ty * sa, dy = tx * sa + ty * ca;
        dy += 0.9; const l = Math.hypot(dx, dy) || 1;
        leaves.moveTo(x, y); leaves.quadraticCurveTo(x + (dx / l) * LL * 0.6, y + (dy / l) * LL * 0.4, x + (dx / l) * LL, y + (dy / l) * LL + 1.5);
      }
    }
  }
  g.strokeStyle = col; g.lineCap = 'round';
  g.lineWidth = p.fine ? 0.7 : 2; g.stroke(spines);
  g.lineWidth = p.fine ? 0.45 : 1.1; g.stroke(leaves);
  g.fillStyle = col;
  if (!p.fine) for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx + r.range(-6, 6), cy + r.range(3, 9), r.range(2.6, 4), 0, TAU); g.fill(); }
  g.restore();
}

/** Plots of the paddy in rough perspective, between wandering bunds; some flooded. */
function fieldPlots(seed) {
  const r = rng(`fields:${seed}`), nz = makeNoise(seed + 17), rows = 6, top = HZ + 3, bot = H + 30, VP = [W / 2, HZ - 10];
  const ys = Array.from({ length: rows + 1 }, (_, k) => top + (bot - top) * Math.pow(k / rows, 1.7));
  const bund = (k, x) => ys[k] + (k ? nz(x * 0.0035, k * 1.7, 0.3) * lerp(4, 34, k / rows) + nz(x * 0.02, k, 2.2) * lerp(0.5, 4, k / rows) : 0);
  const plots = [];
  for (let k = 0; k < rows; k++) {
    const y0 = ys[k], y1 = ys[k + 1], ym = (y0 + y1) / 2, count = Math.round(lerp(5, 2, k / (rows - 1)));
    const lines = [-500];
    for (let j = 1; j < count; j++) lines.push(lerp(-80, W + 80, (j + r.range(-0.35, 0.35)) / count));
    lines.push(W + 500);
    const xAt = (xm, y) => xm + clamp((xm - VP[0]) / (ym - VP[1]), -2.2, 2.2) * (y - ym);
    for (let j = 0; j < lines.length - 1; j++) {
      const a = lines[j], b = lines[j + 1], poly = [];
      const ta = xAt(a, y0), tb = xAt(b, y0), ba = xAt(a, y1), bb = xAt(b, y1);
      // the little ridges between plots wander too
      const ridge = (xt, xb, id) => Array.from({ length: 9 }, (_, s) => {
        const u = s / 8, x = lerp(xt, xb, u) + Math.sin(Math.PI * u) * nz(id * 0.37, k * 3.1, 5.5) * lerp(4, 40, k / rows);
        return [x, lerp(bund(k, xt), bund(k + 1, xb), u)];
      });
      const left = ridge(ta, ba, a), right = ridge(tb, bb, b);
      for (let s = 0; s <= 16; s++) { const x = lerp(ta, tb, s / 16); poly.push([x, bund(k, x)]); }
      poly.push(...right.slice(1, -1));
      for (let s = 16; s >= 0; s--) { const x = lerp(ba, bb, s / 16); poly.push([x, bund(k + 1, x)]); }
      poly.push(...left.slice(1, -1).reverse());
      plots.push({ poly, k, flooded: r.chance(k === 0 ? 0.75 : 0.66), seed: k * 31 + j, div: j ? left : null });
    }
  }
  const water = new Path2D();
  for (const q of plots) if (q.flooded) { q.poly.forEach((v, i) => (i ? water.lineTo(...v) : water.moveTo(...v))); water.closePath(); }
  return { plots, ys, rows, bund, water };
}

function drawLand(g, scene, fields, seed) {
  const nz = makeNoise(seed + 5), { plots, rows, bund, water } = fields;
  // far tree line, pale with distance
  const trees = [];
  for (let x = -10; x <= W + 10; x += 3) trees.push([x, HZ - 2 - Math.pow(Math.abs(nz.fbm(x * 0.02, 1.3, 0, 3)), 0.8) * 20 - Math.max(0, nz(x * 0.006, 4.4)) * 15]);
  const treePoly = [...trees, [W + 10, HZ + 10], [-10, HZ + 10]];
  g.fillStyle = '#4b3a55'; g.beginPath(); treePoly.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.fill();
  hatch(g, treePoly, { angle: -1.0, spacing: 2.6, seg: [3, 7], width: 0.6, color: '#261e2e', alpha: 0.4, seed: seed + 2 });
  // tiny palms far off along the tree line
  const fr = rng(`farpalms:${seed}`);
  for (let i = 0; i < 14; i++) {
    const h = fr.range(24, 46);
    drawPalm(g, { x: fr.range(20, W - 20), y: HZ + 2, h, lean: fr.range(-0.15, 0.15), bend: 0, n: 9, frond: h * 0.24, w: 1.1, seed: fr() * 100, color: '#3a2d45', fine: true });
  }
  // dry plots: dark earth, and rows of rice running off towards the horizon
  const VP = [W / 2, HZ - 10];
  for (const p of plots) {
    if (p.flooded) continue;
    const d = (p.k + 0.5) / rows, path = toPath(p.poly), y0 = fields.ys[p.k], y1 = fields.ys[p.k + 1];
    g.fillStyle = p.k % 2 ? '#272619' : '#2c2a1f'; g.fill(path);
    g.save(); g.clip(path);
    const xs = p.poly.map(q => q[0]), xa = Math.min(...xs), xb = Math.max(...xs), gap = lerp(4, 16, d);
    const rowsPath = new Path2D(), litPath = new Path2D();
    for (let x = xa - 400; x < xb + 400; x += gap) {
      const k0 = (y0 - 30 - VP[1]) / (y0 - VP[1]), x0 = VP[0] + (x - VP[0]) * k0, x1 = VP[0] + (x - VP[0]) * (y1 + 30 - VP[1]) / (y0 - VP[1]);
      rowsPath.moveTo(x0, y0 - 30); rowsPath.lineTo(x1, y1 + 30);
      litPath.moveTo(x0 + gap * 0.3, y0 - 30); litPath.lineTo(x1 + gap * 0.3, y1 + 30);
    }
    g.setLineDash([lerp(8, 30, d), lerp(1, 4, d)]);
    g.strokeStyle = '#11110c'; g.globalAlpha = 0.6; g.lineWidth = lerp(0.6, 2, d); g.stroke(rowsPath);
    g.setLineDash([lerp(3, 12, d), lerp(3, 12, d)]);
    g.strokeStyle = '#d9a67e'; g.globalAlpha = 0.1; g.lineWidth = lerp(0.4, 1, d); g.stroke(litPath);
    g.setLineDash([]); g.globalAlpha = 1;
    // the last light catching the far edge of the plot
    const sheen = g.createLinearGradient(0, y0, 0, y1);
    sheen.addColorStop(0, 'rgba(230,170,130,0.1)'); sheen.addColorStop(1, 'rgba(230,170,130,0)');
    g.fillStyle = sheen; g.fill(path);
    g.restore();
  }
  // flooded plots: the palm trunks upside down near the horizon, and a few glints
  g.save();
  const near = new Path2D(); near.rect(0, HZ, W, fields.ys[2] - HZ);
  g.clip(water); g.clip(near);
  g.globalAlpha = 0.42;
  for (const p of scene.palms) { g.save(); g.translate(0, p.y * 2 + 4); g.scale(1, -1); drawPalm(g, p); g.restore(); }
  g.restore();
  g.save(); g.clip(water);
  for (const p of plots) {
    if (!p.flooded) continue;
    const d = (p.k + 0.5) / rows;
    hatch(g, p.poly, { angle: 0, spacing: lerp(5, 18, d), seg: [lerp(10, 40, d), lerp(40, 160, d)], gap: 1.8, width: lerp(0.4, 1.1, d), color: '#fff2e2', alpha: 0.28, wobble: 0.25, seed: p.seed });
    hatch(g, p.poly, { angle: 0, spacing: lerp(6, 22, d), seg: [lerp(8, 30, d), lerp(20, 90, d)], gap: 2.2, width: lerp(0.5, 1.4, d), color: '#1d1824', alpha: 0.2, wobble: 0.25, seed: p.seed + 5 });
  }
  g.restore();
  // bunds and the little dividing ridges
  for (let k = 1; k <= rows; k++) {
    const d = k / rows, pts = [];
    for (let x = -20; x <= W + 20; x += 12) pts.push([x, bund(k, x)]);
    ink(g, pts, { width: lerp(1, 5, d), color: '#1a1714', alpha: 0.9, jitter: lerp(0.3, 1.4, d), seed: seed + k * 3, taper: 0, step: 3 });
  }
  for (const p of plots) {
    if (!p.div) continue;
    const d = (p.k + 0.5) / rows;
    ink(g, p.div, { width: lerp(0.8, 3.4, d), color: '#1a1714', alpha: 0.8, jitter: 0.6, seed: p.seed + 0.5, taper: 0 });
  }
  for (const p of scene.palms) drawPalm(g, p);
}

/** Wind-combed streaks of cloud low in the sky. */
function drawClouds(g, seed, color) {
  const r = rng(`clouds:${seed}`);
  g.save();
  g.strokeStyle = color; g.lineCap = 'round';
  for (let b = 0; b < 6; b++) {
    const y0 = r.range(250, HZ - 50), x0 = r.range(-150, W - 250), len = r.range(260, 640), thick = r.range(6, 18);
    for (let i = 0; i < 30; i++) {
      const y = y0 + r.gauss() * thick * 0.5, x = x0 + r.range(0, len * 0.4), l = r.range(40, len * 0.7);
      g.globalAlpha = r.range(0.12, 0.45) * clamp(1 - Math.abs(y - y0) / (thick * 1.4));
      g.lineWidth = r.range(0.5, 1.8);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - r.range(-2, 3), x + l, y + r.range(-2, 2)); g.stroke();
    }
  }
  g.restore();
}

// ── The renderer ──────────────────────────────────────────────────────────

export function createRenderer(host, { scene: sceneEl = null, invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  const sky = document.createElement('canvas'); sky.width = 1; sky.height = 160;
  const skyG = sky.getContext('2d'), skyImg = skyG.createImageData(1, 160);
  let seed = null, S = null, fields = null, flock = null, landTop = 0, simT = 0, cycle = -1, epoch = -1;
  let skyL = null, landL = null, skyKey = -1, landKey = -1, lastStill = false, hawk = null, colors = null, lastPointer = null;
  st.onresize = () => { skyL = null; invalidate(); };

  function palette() {
    return (colors ??= readColors(host, { dark: 'light-dark(#000000, #ffffff)' }));
  }
  const isDark = () => palette().dark !== '#000000';

  function prepare(data) {
    seed = data.seed; S = data.S;
    fields = fieldPlots(seed);
    flock = createFlock(seed, NB, S);
    landTop = Math.max(0, Math.min(...S.palms.map(q => q.crown[1] - q.frond)) - 10);
    simT = 0; cycle = data.cycle; skyKey = landKey = -1;
    st.memo.clear();
  }
  const fseed = () => seed;

  /** The sky strip: 160 rows mixed in OKLCH. */
  function paintStrip(d) {
    for (let j = 0; j < 160; j++) {
      const [L, C, h] = skyLch(skyS(j / 159, d));
      const [r, g, b] = oklchToRgb(L, C, h), k = j * 4;
      skyImg.data[k] = r; skyImg.data[k + 1] = g; skyImg.data[k + 2] = b; skyImg.data[k + 3] = 255;
    }
    skyG.putImageData(skyImg, 0, 0);
  }
  const paperLayer = () => st.cached('paper', pg => {
    pg.globalAlpha = 0.09; pg.fillStyle = grainPattern(pg, '#2a2030', { lo: 0, hi: 0.9 }); pg.fillRect(0, 0, W, H);
    pg.globalAlpha = 1;
    const vg = pg.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    vg.addColorStop(0, 'rgba(30,15,20,0)'); vg.addColorStop(1, 'rgba(30,15,20,0.24)');
    pg.fillStyle = vg; pg.fillRect(0, 0, W, H);
  });

  // The sky and the land are each one baked layer, repainted only when the
  // light has moved on, and never both in the same frame.
  function paintSky(d) {
    paintStrip(d);
    const g = skyL.getContext('2d');
    g.setTransform(st.px, 0, 0, st.px, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(sky, 0, 0, 1, 160, 0, 0, W, HZ + 4);
    const glowA = Math.pow(1 - clamp(d / 0.8), 1.6);
    if (glowA > 0.01) {
      const gl = g.createRadialGradient(S.sunX, HZ, 0, S.sunX, HZ, 540);
      gl.addColorStop(0, `rgba(255,214,160,${0.42 * glowA})`); gl.addColorStop(0.4, `rgba(255,170,140,${0.15 * glowA})`); gl.addColorStop(1, 'rgba(255,170,140,0)');
      g.fillStyle = gl; g.fillRect(0, 0, W, HZ + 4);
      const sunY = lerp(HZ - 60, HZ + 40, ease.inOutSine(clamp(d / 0.4)));
      if (sunY < HZ + 30) { g.fillStyle = `rgba(255,238,206,${0.9 * clamp(glowA * 1.4)})`; g.beginPath(); g.arc(S.sunX, sunY, 25, 0, TAU); g.fill(); }
    }
    const cs = fseed();
    g.globalAlpha = 0.95 * (1 - smoothstep(0.15, 0.6, d));
    st.blit(st.cached(`clouds-lit:${cs}`, cg => drawClouds(cg, cs, '#ffe3cc')), g);
    g.globalAlpha = 0.6 * smoothstep(0.2, 0.7, d) * (1 - 0.5 * smoothstep(0.85, 1, d));
    st.blit(st.cached(`clouds-dim:${cs}`, cg => drawClouds(cg, cs, '#3a2e4e')), g);
    g.globalAlpha = 1;
    st.blit(paperLayer(), g);
  }
  function paintLand(d) {
    const g = landL.getContext('2d'), fs = fseed();
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, landL.width, landL.height);
    g.setTransform(st.px, 0, 0, st.px, 0, 0);
    // the flooded plots hold the sky, upside down
    g.save(); g.clip(fields.water);
    g.translate(0, HZ * 2 + 4); g.scale(1, -1);
    g.drawImage(sky, 0, 0, 1, 160, 0, HZ - 330, W, 334);
    g.restore();
    g.save(); g.clip(fields.water); g.fillStyle = 'rgba(40,24,48,0.2)'; g.fillRect(0, HZ, W, H - HZ); g.restore();
    const land = st.cached(`land:${fs}`, lg => drawLand(lg, S, fields, fs));
    st.blit(land, g);
    // night comes down over the land too
    if (d > 0.01) {
      g.globalAlpha = d;
      st.blit(st.cached(`land-night:${fs}`, ng => {
        st.blit(land, ng);
        ng.globalCompositeOperation = 'source-atop'; ng.fillStyle = 'rgba(10,7,24,0.6)'; ng.fillRect(0, 0, W, H);
      }), g);
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-atop'; st.blit(paperLayer(), g); g.globalCompositeOperation = 'source-over';
  }

  function drawBirds(g, n) {
    const B = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], widths = [0.55, 0.85, 1.2, 1.6];
    const F = flock;
    for (let i = 0; i < n; i++) {
      if (F.state[i]) continue;
      const x = F.x[i], y = F.y[i];
      if (x < -20 || x > W + 20 || y < -20 || y > H) continue;
      const h = F.head[i], s = F.size[i];
      let vis = 0.18 + 0.82 * Math.abs(Math.sin(h * 1.3 + F.roll[i] * 1.6));
      vis = Math.max(vis, F.alarm[i] * 0.95);
      const flap = Math.sin(F.flap[i]);
      const span = (1.5 + 2.1 * vis) * s, fx = Math.cos(h), fy = Math.sin(h), nx = -fy, ny = fx;
      const back = (0.7 + flap * 0.8) * s;
      const P = B[Math.min(3, Math.floor(vis * 3.99))];
      P.moveTo(x + nx * span - fx * back, y + ny * span - fy * back);
      P.lineTo(x + fx * 0.7 * s, y + fy * 0.7 * s);
      P.lineTo(x - nx * span - fx * back, y - ny * span - fy * back);
    }
    g.save();
    g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = 0.9;
    for (let k = 0; k < 4; k++) { g.lineWidth = widths[k]; g.stroke(B[k]); }
    g.restore();
  }

  function drawStars(g, t, d, still) {
    g.save();
    g.fillStyle = '#fff6e8';
    for (const s of S.stars) {
      const a = smoothstep(0.66 + s.th, 0.76 + s.th, skyS(s.y / HZ, d));
      if (a <= 0.01) continue;
      const tw = still ? 1 : 0.75 + 0.25 * Math.sin(t * s.tw + s.ph);
      g.globalAlpha = a * tw * (0.45 + 0.55 * s.b);
      const rad = 0.6 + s.b * 1.3;
      g.beginPath(); g.arc(s.x, s.y, rad, 0, TAU); g.fill();
      if (s.b > 0.5) { g.globalAlpha *= 0.4; g.fillRect(s.x - rad * 3, s.y - 0.3, rad * 6, 0.6); g.fillRect(s.x - 0.3, s.y - rad * 3, 0.6, rad * 6); }
    }
    // the evening star, first out and low in the west
    const va = smoothstep(0.3, 0.45, d);
    if (va > 0) {
      const { x, y } = S.planet;
      g.globalAlpha = va;
      const pg = g.createRadialGradient(x, y, 0, x, y, 9);
      pg.addColorStop(0, 'rgba(255,250,236,0.9)'); pg.addColorStop(1, 'rgba(255,250,236,0)');
      g.fillStyle = pg; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
      g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill();
    }
    g.restore();
  }

  /** The keyboard hawk, drawn faintly so a sighted keyboard user sees where it is. */
  function drawHawk(g) {
    g.save();
    g.translate(hawk.x, hawk.y); g.rotate(hawk.ang);
    g.strokeStyle = '#fff2e2'; g.globalAlpha = 0.55; g.lineCap = 'round';
    for (const [ax, ay, bx, by, rad] of HAWK) { g.lineWidth = rad * 0.5; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
    g.restore();
  }

  function render(data, frame) {
    if (data.seed !== seed || data.S !== S || frame.epoch !== epoch) { prepare(data); epoch = frame.epoch; }
    const still = !!frame.still, look = data.look, calm = frame.calm || [];
    const active = Math.max(120, Math.round(NB * look.birds * clamp(frame.quality ?? 1, 0.25, 1)));
    // a new night: the birds come back from the right
    if (data.cycle !== cycle) { cycle = data.cycle; resetFlock(flock, cycle ? `${seed}:${cycle}` : seed); simT = 0; }
    if (still !== lastStill || data.local < simT - 1e-6) { // back in time, or into the still: start the evening again
      resetFlock(flock, cycle ? `${seed}:${cycle}` : seed); simT = 0; lastStill = still;
    }
    const target = still ? STILL_TIME : data.local;
    const p = frame.pointer;
    if (!still && look.hawk && p.inside) {
      // the hawk follows the pointer (or the keyboard hand), turning to face where it is going
      if (!hawk) hawk = { x: p.x, y: p.y, ang: Math.PI };
      const dx = p.x - hawk.x, dy = p.y - hawk.y;
      if (Math.hypot(dx, dy) > 1.5) { let da = Math.atan2(dy, dx) - hawk.ang; da -= Math.round(da / TAU) * TAU; hawk.ang += da * Math.min(1, (frame.dt || 1 / 60) * 6 * (p.keyboard ? 3 : 1)); }
      hawk.x = p.x; hawk.y = p.y;
    } else hawk = null;
    if (target - simT > 3) simT = simulate(flock, simT, target - 1, { calm, active }, 1 / 30); // catch up after a gap
    simT = simulate(flock, simT, target, { hawk, calm, active });
    lastPointer = p;

    const d0 = still ? STILL_DARK : data.dark, d = isDark() ? nightFor(d0) : d0;
    if (!skyL || skyL.width !== st.canvas.width || skyL.height !== st.canvas.height) {
      skyL = st.layer(); landL = st.layer(); skyKey = landKey = -1;
    }
    const key = Math.round(d * 160);
    if (skyKey < 0 || landKey < 0 || !frame.dt) {
      if (key !== skyKey) { paintSky(key / 160); skyKey = key; }
      if (key !== landKey) { paintLand(key / 160); landKey = key; }
    } else if (key !== skyKey) { paintSky(key / 160); skyKey = key; }
    else if (key !== landKey) { paintLand(key / 160); landKey = key; }

    const g = st.begin();
    st.blit(skyL);
    drawStars(g, data.time, key / 160, still);
    const px = st.px, y0 = Math.floor(landTop * px);
    g.drawImage(landL, 0, y0, landL.width, landL.height - y0, 0, y0 / px, W, H - y0 / px);
    drawBirds(g, active);
    if (hawk && p.keyboard) drawHawk(g);
  }

  return {
    render,
    setRegister() { skyKey = landKey = -1; },
    restyle() { colors = null; skyKey = landKey = -1; invalidate(); },
    /** Enter, Space or a tap in playful: the birds near the hawk startle, and a dark wave runs through the flock. */
    activate(p) { if (flock && p) startle(flock, p.x, p.y, 70); },
    destroy() { st.destroy(); },
  };
}

void CYCLE;
