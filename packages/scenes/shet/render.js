// Shet: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the clouds, the tree line, the dry and wet ground, the water
// and its reflection, the bunds, the canopy, the rice leaf by leaf, the rain,
// the egrets and the paper are the plate's own code, and so is its layering
// (the slow parts painted once in time slices, the sky and the field
// composited every fourth frame, the far rows repainted once per season step).
// What the port adds: the registers, the held year for progress, the
// keyboard hand and its gust, the calm zone, dusk for the dark theme, a
// redraw 24 or 30 times a second, and the governor's lighter frames.
//
// Shet is a scape (decision 0020): this file and the model are its first
// sight, the ripe field that is its still. Everything only the turning year
// needs (the dry ground and stubble, the flood and its reflection, the rain,
// the masks, the dusty bunds, the egrets in flight) is in year.js, loaded
// with a dynamic import() when the field has to move.

import {
  stage, ink, hatch, makeNoise, N, rng, clamp, lerp, TAU, phase, ease, smoothstep,
  hexToRgb, grainPattern, paper,
} from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import {
  W, H, HY, F, CX, Y_FAR, NEAR_Y, proj, unproj, T, buildField, season, windAt, gustAt, settledEgrets, STILL_AT,
} from './model.js';

// ── Side-effect edge ──────────────────────────────────────────────────────

/** year.js once it has loaded (the egrets' flight is drawn from it). */
let Y = null;

const rgbOf = h => (typeof h === 'string' ? hexToRgb(h) : h);
const mixc = (a, b, t) => { const A = rgbOf(a), Bc = rgbOf(b); return [0, 1, 2].map(i => lerp(A[i], Bc[i], t)); };
const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

const WET = { mud: '#5b4432', mudNear: '#4a3627', ghost: '#35261a', sheen: '#9c8a78' };
const BUND = {
  dry: { top: '#b39566', face: '#6f573c', ink: '#3f2e20', grass: '#8f7a4b' },
  green: { top: '#7b8f4c', face: '#555236', ink: '#34331e', grass: '#4f7f32' },
};
const RICE = { young: '#a3c464', lush: '#5b8b3b', ripe: '#c9a247', darkG: '#2f4b26', darkR: '#7a5c27', sheenG: '#e9f1bf', sheenR: '#f5e6ab', haze: '#bcc4b3' };

// The light of the year. Keyframes: t, sky top, sky at the horizon, the grade laid
// over everything and its strength, heavy cloud, high wisps, cloud shadows,
// haze, the sun's glare and its height, heat shimmer. The still is lit between
// the end of the monsoon and the gold; the rest of the year's light is in year.js.
const GOLDK = ['#d8b583', '#f7dca4', '#ff9b3d', 0.11, 0.12, 0.6, 0.32, 0.3, 0.9, 96, 0];
const LATE = [55, '#a6b9c0', '#e5e9df', '#1c2935', 0, 0.35, 0.5, 0.4, 0.25, 0.3, -30, 0];
const STILL_KEYS = [LATE, [62, ...GOLDK], [69, ...GOLDK]];
function sky(t) {
  const KEYS = Y?.KEYS ?? STILL_KEYS;
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++;
  const a = KEYS[i], b = KEYS[i + 1], u = ease.inOutSine(phase(t, a[0], b[0]));
  return {
    top: mixc(a[1], b[1], u), bottom: mixc(a[2], b[2], u), tint: mixc(a[3], b[3], u), tintA: lerp(a[4], b[4], u),
    heavy: lerp(a[5], b[5], u), wisps: lerp(a[6], b[6], u), shade: lerp(a[7], b[7], u), mist: lerp(a[8], b[8], u),
    sun: lerp(a[9], b[9], u), sunY: lerp(a[10], b[10], u), shimmer: lerp(a[11], b[11], u),
  };
}
const SUN_X = 830;

const fillPoly = (g, pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); };
const addPoly = (path, pts) => { pts.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1]))); path.closePath(); };
const projPoly = pts => pts.map(p => proj(p[0], p[1]));
/** A ground segment, resampled on the ground so perspective bends it correctly. */
const projSeg = (a, b, n = 6) => Array.from({ length: n + 1 }, (_, i) => proj(lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)));

/** A noise field painted into a tiny canvas and stretched: soft skies for free. */
function noiseWash(g, x, y, w, h, fn, res = 6) {
  const cw = Math.max(2, Math.round(w / res)), ch = Math.max(2, Math.round(h / res));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const cg = c.getContext('2d'), img = cg.createImageData(cw, ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const [R, G, Bl, A] = fn(x + (i / cw) * w, y + (j / (ch - 1)) * h);
    const k = (j * cw + i) * 4;
    img.data[k] = R; img.data[k + 1] = G; img.data[k + 2] = Bl; img.data[k + 3] = clamp(A) * 255;
  }
  cg.putImageData(img, 0, 0);
  g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(c, x, y, w, h); g.restore();
}
/** Noise that wraps around horizontally, so a layer can drift forever. */
const wrapN = (nz, x, y, R, z = 0) => { const a = (x / W) * TAU; return nz.fbm(Math.cos(a) * R + 10, Math.sin(a) * R + 10, y + z, 4); };

function* paintClouds(g, heavy, seed) {
  const nz = makeNoise(seed * 3 + (heavy ? 71 : 17));
  if (heavy) {
    noiseWash(g, 0, 0, W, Y_FAR + 10, (x, y) => {
      const v = wrapN(nz, x, y * 0.011, 1.6);
      const body = smoothstep(-0.12, 0.2, v + (y / Y_FAR) * 0.18 - 0.05);
      const under = smoothstep(0.35, 1, y / Y_FAR), lit = smoothstep(0.05, 0.35, v - (y / Y_FAR) * 0.2);
      const c = mixc(mixc('#8f999b', '#5e686d', under), '#d9ddd6', lit * (1 - under) * 0.8);
      return [c[0], c[1], c[2], body * 0.92];
    }, 5);
    yield;
    // slanting curtains of rain under the clouds
    noiseWash(g, 0, 40, W, Y_FAR - 30, (x, y) => {
      const v = wrapN(nz, x - y * 0.5, 7.5, 3.2);
      return [120, 132, 136, Math.max(0, v) * 0.5 * smoothstep(40, 150, y)];
    }, 5);
  } else {
    noiseWash(g, 0, 0, W, 170, (x, y) => {
      const v = wrapN(nz, x, y * 0.03, 2.4);
      const streak = wrapN(nz, x, y * 0.09, 5.5, 4);
      return [255, 252, 244, clamp(smoothstep(0.02, 0.3, v) * 0.55 + Math.max(0, streak) * 0.3) * (1 - smoothstep(90, 170, y))];
    }, 5);
  }
}

/** A coconut palm in ink: a trunk that thins as it rises, then a crown of
 *  spines with hanging leaflets (after Saanj's palms). */
function drawPalm(g, p) {
  const pts = [], r = rng(`shet-palm:${p.seed}`);
  for (let i = 0; i <= 14; i++) { const s = i / 14; pts.push([p.x + p.lean * p.h * Math.pow(s, 1.5) + p.bend * p.h * s * s, p.y - p.h * s]); }
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], s = i / (n - 1);
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const w = (p.w * (1 - 0.45 * s + 0.35 * Math.pow(1 - s, 6)) / 2) * (1 + 0.12 * Math.sin(i * 2.3 + p.seed));
    L.push([pts[i][0] - ty * w, pts[i][1] + tx * w]); R.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
  }
  g.save();
  g.fillStyle = p.color;
  g.beginPath(); L.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); R.reverse().forEach(q => g.lineTo(q[0], q[1])); g.closePath(); g.fill();
  const [cx, cy] = pts[n - 1];
  const spines = new Path2D(), leaves = new Path2D();
  for (let k = 0; k < p.n; k++) {
    const a = lerp(-Math.PI - 0.6, 0.6, k / (p.n - 1)) + r.range(-0.16, 0.16);
    const len = p.frond * r.range(0.75, 1.2);
    const droop = 0.4 + 0.45 * (1 - Math.abs(Math.cos(a))) + r.range(-0.15, 0.15);
    const P = u => [cx + Math.cos(a) * len * u, cy + Math.sin(a) * len * u + len * droop * u * u];
    const Tn = u => { const tx = Math.cos(a) * len, ty = Math.sin(a) * len + 2 * len * droop * u; const l = Math.hypot(tx, ty) || 1; return [tx / l, ty / l]; };
    spines.moveTo(cx, cy);
    for (let u = 0.1; u <= 1.001; u += 0.1) { const q = P(u); spines.lineTo(q[0], q[1]); }
    for (let u = 0.1; u <= 1; u += p.fine ? 0.09 : 0.055) {
      const [x, y] = P(u), [tx, ty] = Tn(u), LL = len * 0.3 * (1 - 0.6 * u) + 1.5;
      for (const sd of [-1, 1]) {
        const ca = Math.cos(0.95 * sd), sa = Math.sin(0.95 * sd);
        let dx = tx * ca - ty * sa, dy = tx * sa + ty * ca;
        dy += 0.9; const l = Math.hypot(dx, dy) || 1;
        leaves.moveTo(x, y); leaves.quadraticCurveTo(x + (dx / l) * LL * 0.6, y + (dy / l) * LL * 0.4, x + (dx / l) * LL, y + (dy / l) * LL + 1);
      }
    }
  }
  g.strokeStyle = p.color; g.lineCap = 'round';
  g.lineWidth = p.fine ? 0.8 : 1.5; g.stroke(spines);
  g.lineWidth = p.fine ? 0.45 : 0.8; g.stroke(leaves);
  g.fillStyle = p.color;
  if (!p.fine) for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx + r.range(-4, 4), cy + r.range(2, 6), r.range(1.8, 2.8), 0, TAU); g.fill(); }
  g.restore();
}

/** The horizon: the Sahyadri in the haze, a hazy back row of trees, then mango,
 *  cashew and jackfruit crowns and coconut palms in ink, all fading with distance. */
function* paintTrees(g, seed) {
  const r = rng(`shet-trees:${seed}`), nz = makeNoise(seed + 404);
  const base = Y_FAR + 6;
  for (const [k, y0, amp, col, lineA] of [[0, 150, 58, '#c3cac6', 0.22], [1, 174, 34, '#aab5ae', 0.32]]) {
    const hill = [];
    for (let x = -10; x <= W + 10; x += 5) {
      const v = nz.fbm(x * 0.0026 + k * 7 + 3, 0.5 + k, 0, 5);
      hill.push([x, y0 - amp * (0.55 + v * 1.4) - Math.abs(nz(x * 0.011, 2 + k)) * 7 * (1 - k * 0.4)]);
    }
    const poly = [...hill, [W + 10, base], [-10, base]];
    g.fillStyle = col; fillPoly(g, poly);
    hatch(g, poly, { angle: -1.2, spacing: 3.4, seg: [4, 12], width: 0.55, color: '#6b7a76', alpha: 0.14 + k * 0.06, seed: seed + 3 + k });
    ink(g, hill, { width: 0.8, color: '#6b7a76', alpha: lineA, jitter: 0.6, taper: 0, seed: seed + 4 + k });
    const mist = g.createLinearGradient(0, y0 - 20, 0, y0 + 40);
    mist.addColorStop(0, 'rgba(240,238,228,0)'); mist.addColorStop(1, 'rgba(240,238,228,0.7)');
    g.fillStyle = mist; g.fillRect(0, y0 - 20, W, base - y0 + 20);
  }
  yield;
  const crowns = (y, rmin, rmax, stepMin, stepMax) => {
    const out = [];
    for (let x = -20; x < W + 30; x += r.range(stepMin, stepMax)) {
      const rad = r.range(rmin, rmax), cy = y - rad * r.range(0.45, 1);
      out.push({ x, rad, lobes: Array.from({ length: r.int(3, 6) }, () => [x + r.range(-0.8, 0.8) * rad, cy + r.range(-0.55, 0.3) * rad, rad * r.range(0.4, 0.72)]) });
    }
    return out;
  };
  // the back row, far and pale
  const back = crowns(base - 8, 8, 16, 10, 20), backPath = new Path2D();
  backPath.rect(-10, base - 14, W + 20, 16);
  for (const c of back) for (const [lx, ly, lr] of c.lobes) addPoly(backPath, blobPts(lx, ly, lr, lx));
  g.fillStyle = '#9aa69c'; g.fill(backPath);
  hatch(g, backPath, { bounds: { x: -10, y: 120, w: W + 20, h: base - 120 + 4 }, angle: -0.9, spacing: 2.8, seg: [2, 6], width: 0.5, color: '#55635a', alpha: 0.3, seed: seed + 20 });
  // far palms, fine and pale, standing out of the back row
  for (let i = 0, n = r.int(14, 22); i < n; i++) {
    const h = r.range(34, 62);
    drawPalm(g, { x: r.range(0, W), y: base - 6, h, lean: r.range(-0.18, 0.18), bend: r.range(-0.05, 0.05), n: r.int(8, 11), frond: h * r.range(0.24, 0.3), w: 1.3, seed: r() * 100, color: '#7c8a82', fine: true });
  }
  yield;
  // a house among the trees: whitewash and a red-tile roof
  const hx = r.range(260, 940), hw = r.range(30, 40);
  g.fillStyle = '#efe9db'; g.fillRect(hx - hw / 2, base - 24, hw, 20);
  const roof = [[hx - hw / 2 - 5, base - 23], [hx - hw / 2 + 6, base - 35], [hx + hw / 2 - 6, base - 35], [hx + hw / 2 + 5, base - 23]];
  g.fillStyle = '#a65a40'; fillPoly(g, roof);
  hatch(g, roof, { angle: Math.PI / 2, spacing: 2.2, seg: [3, 8], width: 0.5, color: '#6d2e20', alpha: 0.5, seed: 9 });
  ink(g, [roof[0], roof[3]], { width: 0.8, color: '#4a2016', alpha: 0.7, jitter: 0.3, taper: 0, seed: 10 });
  ink(g, [[hx - hw / 2, base - 23], [hx - hw / 2, base - 4]], { width: 0.6, color: '#4a3a2c', alpha: 0.6, jitter: 0.2, taper: 0, seed: 11 });
  g.fillStyle = '#5a4b3c'; g.fillRect(hx - 4, base - 15, 5, 11); g.fillRect(hx + hw / 2 - 11, base - 19, 4, 4);
  // the front row: mango, cashew and jackfruit in muted green, shaded by hatching
  const front = crowns(base - 2, 11, 24, 16, 34).filter(c => !(Math.abs(c.x - hx) < hw * 0.7 && r() < 0.85));
  const mass = new Path2D();
  mass.rect(-10, base - 10, W + 20, 14);
  for (const c of front) for (const [lx, ly, lr] of c.lobes) addPoly(mass, blobPts(lx, ly, lr, c.x + lx));
  g.fillStyle = '#65735d'; g.fill(mass);
  for (const c of front) {
    g.fillStyle = 'rgba(226,230,200,0.2)';
    for (const [lx, ly, lr] of c.lobes) fillPoly(g, blobPts(lx - lr * 0.22, ly - lr * 0.25, lr * 0.55, c.x + lx + 3));
  }
  yield;
  const bounds = { x: -10, y: 100, w: W + 20, h: base - 100 + 6 };
  hatch(g, mass, { bounds, angle: -0.95, spacing: 2, seg: [2, 6], width: 0.55, color: '#26302a', alpha: 0.55, seed: seed + 12,
    density: (x, y) => 0.25 + 0.75 * smoothstep(base - 34, base - 2, y) });
  hatch(g, mass, { bounds, angle: 0.6, spacing: 2.8, seg: [2, 5], width: 0.5, color: '#26302a', alpha: 0.4, seed: seed + 13,
    density: (x, y) => smoothstep(base - 20, base, y) });
  // inked edges along the tops of the crowns, broken and wobbly
  for (const c of front) for (const [lx, ly, lr] of c.lobes) if (r() < 0.65) {
    const pts = blobPts(lx, ly, lr, c.x + lx), k = r.int(18, 24);
    ink(g, pts.slice(k, k + r.int(10, 16)), { width: 0.8, color: '#26302a', alpha: 0.6, jitter: 0.5, taper: 5, seed: lx * 3 });
  }
  yield;
  // coconut palms in clumps, leaning away from each other
  for (let i = 0, n = r.int(7, 11); i < n; i++) {
    const x = r.range(10, W - 10), count = r.pick([1, 1, 2, 2, 3]);
    for (let j = 0; j < count; j++) {
      const h = r.range(70, 132) * (j ? r.range(0.7, 0.95) : 1);
      drawPalm(g, { x: x + j * r.range(-14, 14), y: base - 2, h, lean: (j ? r.sign() : 1) * r.range(-0.22, 0.22), bend: r.range(-0.08, 0.08), n: r.int(10, 14), frond: h * r.range(0.26, 0.33), w: r.range(2.8, 4), seed: r() * 100, color: '#39443c' });
    }
  }
}
const blobPts = (x, y, rad, sd) => { const out = []; for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU, k = 1 + 0.16 * N(Math.cos(a) * 1.6 + sd * 0.37, Math.sin(a) * 1.6, sd * 0.11) * 2; out.push([x + Math.cos(a) * rad * k, y + Math.sin(a) * rad * k * 0.82]); } return out; };

function* paintWet(g, geo, seed) {
  const top = Y_FAR - 2, nz = makeNoise(seed + 808);
  const gr = g.createLinearGradient(0, top, 0, H);
  gr.addColorStop(0, '#6d5a47'); gr.addColorStop(0.3, WET.mud); gr.addColorStop(1, WET.mudNear);
  g.fillStyle = gr; g.fillRect(0, top, W, H - top);
  noiseWash(g, 0, top, W, H - top, (x, y) => {
    const [gx, gz] = unproj(x, y), v = nz.fbm(gx * 2.2, gz * 2.2, 0.5, 4);
    return v > 0 ? [150, 128, 104, v * 0.35] : [30, 20, 12, -v * 0.5];
  }, 4);
  yield;
  // the cracks swell shut but leave a trace
  for (const [a, b] of geo.pEdges) {
    const z = (a[1] + b[1]) / 2;
    ink(g, projSeg(a, b, 6), { width: 2.2 / Math.pow(z, 0.85), color: WET.ghost, alpha: 0.28, jitter: 0.5 / z, freq: 0.05, taper: 6, seed: a[0] * 131 });
  }
  yield;
  // wet shine: long soft strokes that catch the sky
  const field = new Path2D(); field.rect(0, top, W, H - top);
  hatch(g, field, { bounds: { x: 0, y: top, w: W, h: H - top }, angle: -0.04, spacing: 2.6, seg: [10, 40], gap: 1.1, width: 0.7, color: WET.sheen, alpha: 0.13, seed: seed + 5,
    density: (x, y) => 0.4 + 0.6 * smoothstep(0, 0.4, nz(x * 0.01, y * 0.03, 2)) });
  yield;
  haze(g, '#b9b4a6', 0.5);
  grain(g, top);
}

function haze(g, color, a) {
  const top = Y_FAR - 2, [R, G, Bl] = hexToRgb(color);
  const hz = g.createLinearGradient(0, top, 0, top + 150);
  hz.addColorStop(0, `rgba(${R},${G},${Bl},${a})`); hz.addColorStop(1, `rgba(${R},${G},${Bl},0)`);
  g.fillStyle = hz; g.fillRect(0, top, W, 150);
}
function grain(g, top = 0) {
  g.save(); g.globalAlpha = 0.08; g.fillStyle = grainPattern(g, '#2e2218', { lo: 0, hi: 0.9 }); g.fillRect(0, top, W, H - top); g.restore();
}

function* paintBunds(g, geo, pal, seed) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  let n = 0;
  for (const b of geo.bunds) {
    const s = 1 / Math.sqrt(b.z);
    // a soft shadow the bund throws on the field toward the eye
    g.save(); g.globalAlpha = 0.18; g.fillStyle = pal.ink; g.translate(2 * s, 3 * s); fillPoly(g, b.face); g.restore();
    g.fillStyle = pal.face; fillPoly(g, b.face);
    hatch(g, b.face, { angle: b.horiz ? 1.35 : 0.2, spacing: 1.5 * s + 0.5, seg: [2, 6], width: 0.6, color: pal.ink, alpha: 0.6, seed: seed + n });
    g.fillStyle = pal.top; fillPoly(g, b.top);
    g.save(); g.globalAlpha = 0.4; g.fillStyle = grainPattern(g, pal.ink, { lo: 0, hi: 0.8 }); fillPoly(g, b.top); g.restore();
    ink(g, b.edge, { width: 1.7 * s, color: pal.ink, alpha: 0.85, jitter: 1.1 * s, freq: 0.05, pressure: 0.5, taper: 0, seed: seed + n * 3 });
    ink(g, b.rim, { width: 0.9 * s, color: '#f4ecd6', alpha: 0.35, jitter: 0.4 * s, taper: 0, seed: seed + n * 3 + 1 });
    ink(g, b.back, { width: 0.9 * s, color: pal.ink, alpha: 0.55, jitter: 0.8 * s, freq: 0.05, taper: 0, seed: seed + n * 3 + 2 });
    // grass along the crest, in two greens (or two straws)
    const r = rng(seed * 7 + n), grass = [new Path2D(), new Path2D()];
    for (const line of [b.rim, b.back, b.rim]) for (let i = 0; i < line.length; i++) {
      if (r() > 0.8) continue;
      const [x, y] = line[i], hgt = r.range(1.5, 7) * s * s * 1.5, lean = r.range(-2, 2) * s;
      const path = grass[r() < 0.5 ? 0 : 1];
      path.moveTo(x, y + r.range(0, 2) * s); path.quadraticCurveTo(x + lean * 0.3, y - hgt * 0.6, x + lean, y - hgt);
    }
    g.strokeStyle = pal.grass; g.lineWidth = 0.75 * s; g.stroke(grass[0]);
    g.strokeStyle = pal.ink; g.globalAlpha = 0.55; g.lineWidth = 0.6 * s; g.stroke(grass[1]); g.globalAlpha = 1;
    if (++n % 3 === 0) yield;
  }
}

function* paintShade(g, seed) {
  const nz = makeNoise(seed + 999), top = Y_FAR - 2;
  noiseWash(g, 0, top, W, H - top, (x, y) => {
    const [, gz] = unproj(x, y), v = wrapN(nz, x, gz * 0.6, 1.4);
    return [34, 30, 36, smoothstep(0.02, 0.3, v) * 0.34];
  }, 6);
  yield;
}

function riceTones(green, ripe) {
  const base = mixc(mixc(RICE.young, RICE.lush, green), RICE.ripe, ripe);
  return [mixc(base, mixc(RICE.darkG, RICE.darkR, ripe), 0.45), base, mixc(base, mixc(RICE.sheenG, RICE.sheenR, ripe), 0.55)];
}
/** Blades of one clump into a path: each blade's own lean plus the wind's bend (sgn, signed). */
function clumpBlades(path, c, h, sgn, curve) {
  sgn += c.tilt;
  const sq = 1 - 0.3 * sgn * sgn;
  for (const [lean, len, off] of c.blades) {
    const L = h * len, x0 = c.x + off, tx = x0 + (lean + sgn * 0.85) * L, ty = c.y - L * sq;
    path.moveTo(x0, c.y);
    if (curve) path.quadraticCurveTo(x0 + (lean * 0.3 + sgn * 0.2) * L, c.y - L * 0.55, tx, ty);
    else { path.lineTo(x0 + (lean * 0.3 + sgn * 0.25) * L, c.y - L * 0.52); path.lineTo(tx, ty); }
  }
}
/** Near blades as thin filled leaves, wide at the root and tapering to a point. */
function clumpLeaves(path, c, h, sgn, w) {
  sgn += c.tilt;
  const sq = 1 - 0.3 * sgn * sgn;
  for (const [lean, len, off] of c.blades) {
    const L = h * len, x0 = c.x + off, tx = x0 + (lean + sgn * 0.85) * L, ty = c.y - L * sq;
    const cx = x0 + (lean * 0.3 + sgn * 0.2) * L, cy = c.y - L * 0.55;
    path.moveTo(x0 - w, c.y); path.quadraticCurveTo(cx - w * 0.7, cy, tx, ty); path.quadraticCurveTo(cx + w * 0.7, cy, x0 + w, c.y); path.closePath();
  }
}
/** Ripe panicles bow over the way their blades lean. */
function clumpHeads(path, c, h, sgn) {
  sgn += c.tilt;
  const sq = 1 - 0.3 * sgn * sgn;
  for (const k of [0, c.blades.length - 1]) {
    const [lean, len, off] = c.blades[k], L = h * len, x0 = c.x + off, tx = x0 + (lean + sgn * 0.85) * L, ty = c.y - L * sq;
    const dir = Math.sign(lean + sgn) || 1;
    path.moveTo(tx, ty); path.quadraticCurveTo(tx + dir * L * 0.14, ty - L * 0.03, tx + dir * L * 0.2, ty + L * 0.2);
  }
}
const HM = 0.13;
/** A clump's height at a moment: it pops in when planted, then grows. */
const clumpH = (c, local) => {
  const pop = ease.outBack(phase(local, c.plant, c.plant + 0.6)), grow = ease.outCubic(phase(local, c.plant, c.plant + T.grow));
  return [HM * c.sc * c.hk * (0.3 + 0.7 * grow) * (0.6 + 0.4 * pop), grow];
};
/** The green that closes over a plot, far plots most, as a cached layer. */
function paintCanopy(g, geo, tones) {
  const path = new Path2D();
  for (const pl of geo.plots) addPoly(path, projPoly(pl.quad));
  const cg = g.createLinearGradient(0, Y_FAR, 0, H);
  cg.addColorStop(0, css(mixc(tones[1], RICE.haze, 0.2), 0.92)); cg.addColorStop(0.3, css(tones[0], 0.62)); cg.addColorStop(1, css(tones[0], 0.34));
  g.fillStyle = cg; g.fill(path);
}
// ── The egrets ───────────────────────────────────────────────────────────

const EGRET_INK = '#2b2721', EGRET_WHITE = '#fcfbf6', EGRET_BILL = '#e0ad37';

/**
 * A cattle egret in ink and white. (x, y) is where its feet touch the ground,
 * s its scale, dir ±1 the way it faces. pose: { fly, flap, walk, peck }.
 */
function drawEgret(g, x, y, s, dir, pose) {
  g.save();
  g.translate(x, y); g.scale(dir * s, s);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const outline = (path, w) => { g.strokeStyle = EGRET_INK; g.lineWidth = w; g.stroke(path); };
  if (pose.fly) {
    Y?.drawFlying(g, pose, outline, EGRET_INK, EGRET_WHITE, EGRET_BILL); // in flight only once the year turns (year.js)
  } else {
    // legs, one lifted a little while walking
    const sw = Math.sin(pose.walk) * 1.6;
    g.strokeStyle = EGRET_INK; g.lineWidth = 0.55;
    g.beginPath();
    g.moveTo(-0.6, -6); g.lineTo(-0.6 + sw, 0);
    g.moveTo(0.6, -6); g.lineTo(0.6 - sw, -Math.max(0, Math.sin(pose.walk)) * 1.2);
    g.stroke();
    // the neck folds down to the ground when it pecks
    const pk = pose.peck, hx = lerp(5.4, 8.4, pk), hy = lerp(-15.6, -4.2, pk);
    const neck = new Path2D(); neck.moveTo(2.6, -9.2); neck.bezierCurveTo(lerp(5.6, 6, pk), lerp(-11, -9, pk), lerp(2.4, 8, pk), lerp(-14, -7, pk), hx, hy);
    g.strokeStyle = EGRET_INK; g.lineWidth = 2.5; g.stroke(neck);
    g.strokeStyle = EGRET_WHITE; g.lineWidth = 1.7; g.stroke(neck);
    // body, tail down, over the base of the neck
    const body = new Path2D(); body.ellipse(-0.4, -8.4, 5, 2.8, -0.32, 0, TAU);
    g.fillStyle = EGRET_WHITE; g.fill(body); outline(body, 0.45);
    // a buff wash on the back in the breeding season
    g.fillStyle = 'rgba(226,178,110,0.3)'; g.beginPath(); g.ellipse(0.6, -10, 2.4, 1, -0.3, 0, TAU); g.fill();
    const head = new Path2D(); head.arc(hx, hy, 1.45, 0, TAU);
    g.fillStyle = EGRET_WHITE; g.fill(head); outline(head, 0.4);
    g.strokeStyle = EGRET_BILL; g.lineWidth = 0.75; g.beginPath(); g.moveTo(hx + 1.1, hy + 0.1); g.lineTo(hx + 4, hy + lerp(0.6, 2.4, pk)); g.stroke();
    g.fillStyle = EGRET_INK; g.beginPath(); g.arc(hx + 0.4, hy - 0.3, 0.3, 0, TAU); g.fill();
  }
  g.restore();
}


// what the turning year (year.js) paints with
export { css, mixc, BUND, HM, fillPoly, addPoly, projPoly, projSeg, noiseWash, haze, grain, paintBunds, SUN_X, GOLDK, LATE };

// ── The renderer (the plate's mount(), adapted to the scene contract) ─────

export function createRenderer(host, { invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  let seed = null, geo = null, layers = null, builder = null, built = false, readyAt = -Infinity;
  let sizeKey = '', origin = 0, lastLocal = -1, epoch = -1, lastKey = '', colors = null;
  let firstPaint = false, frameNo = 0, windDir = -0.75;
  const pv = { x: 0, y: 0, act: 0, lx: 0, ly: 0, lt: 0, mx: null, my: null, last: -Infinity };
  let egrets = null; // the simulation (egrets.js), once the year is here; the still places them itself
  let resolveReady = null;
  const ready = new Promise(r => { resolveReady = r; });
  st.onresize = () => { lastKey = ''; invalidate(); };

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const scratch = mk(1, 1).getContext('2d');
  // the turning year (year.js), loaded once the field has to move; until then the still is shown
  let year = null, yearing = null, yearBuilt = false, yearBuilder = null;
  function needYear() {
    yearing ??= import('./year.js').then(m => { Y = m; year = m.createYear(st, mk); if (seed !== null) { year.field(seed); egrets = m.makeEgrets(seed); } lastKey = ''; invalidate(); });
  }

  function palette() {
    return (colors ??= readColors(host, { dark: 'light-dark(#000000, #ffffff)' }));
  }

  function* buildLayers(g0, s) {
    const L = {};
    const layer = () => st.layer();
    L.wisps = layer(); yield* paintClouds(L.wisps.getContext('2d'), false, s); scratch.drawImage(L.wisps, 0, 0, 1, 1); yield;
    L.heavy = layer(); yield* paintClouds(L.heavy.getContext('2d'), true, s); scratch.drawImage(L.heavy, 0, 0, 1, 1); yield;
    L.trees = layer(); for (const _ of paintTrees(L.trees.getContext('2d'), s)) { scratch.drawImage(L.trees, 0, 0, 1, 1); yield; }
    L.wet = layer(); for (const _ of paintWet(L.wet.getContext('2d'), g0, s)) { scratch.drawImage(L.wet, 0, 0, 1, 1); yield; }
    L.bundGreen = layer(); for (const _ of paintBunds(L.bundGreen.getContext('2d'), g0, BUND.green, s + 1)) { scratch.drawImage(L.bundGreen, 0, 0, 1, 1); yield; }
    L.paper = layer(); paper(L.paper.getContext('2d'), W, H, { base: '#faf6ec', seed: s + 5, mottle: 0.07, grain: 0.08, fibers: 110, vignette: 0.12 }); scratch.drawImage(L.paper, 0, 0, 1, 1); yield;
    L.shade = layer(); yield* paintShade(L.shade.getContext('2d'), s); scratch.drawImage(L.shade, 0, 0, 1, 1);
    L.canopyG = layer(); paintCanopy(L.canopyG.getContext('2d'), g0, riceTones(1, 0)); scratch.drawImage(L.canopyG, 0, 0, 1, 1); yield;
    L.canopyR = layer(); paintCanopy(L.canopyR.getContext('2d'), g0, riceTones(1, 1)); scratch.drawImage(L.canopyR, 0, 0, 1, 1); yield;
    L.geo = g0;
    return L;
  }
  function start() { built = false; yearBuilt = false; yearBuilder = null; builder = buildLayers(geo, seed); }
  /** Paint layers for up to `budget` ms: the still's first, then (once year.js is here) the year's. */
  function advance(budget) {
    const t0 = performance.now();
    while (!built && performance.now() - t0 < budget) {
      const s = builder.next();
      if (s.done) { firstPaint = !layers; layers = s.value; built = true; }
    }
    if (built && year && !yearBuilt) {
      yearBuilder ??= Y.yearLayers(st, layers, layers.geo, seed, scratch);
      while (!yearBuilt && performance.now() - t0 < budget) yearBuilt = !!yearBuilder.next().done;
    }
    return built;
  }
  function newField(s) {
    seed = s; geo = buildField(seed); egrets = Y ? Y.makeEgrets(seed) : null; rl = null;
    year?.field(s); year?.unhold(); lastLocal = -1; bgStale = true;
    start();
  }

  // The middle and far rows barely move at that distance, so they are painted
  // into a layer per season step (growth every two seconds, colour in sixths),
  // double-buffered and repainted a few hundred clumps per frame.
  const Q = 6, quant = v => Math.round(v * Q) / Q;
  let rl = null;
  function farRice(local, S, now) {
    const tq = Math.min(T.plant + 18, Math.floor(local / 3) * 3 + 1.5), key = `${tq}|${quant(S.green)}|${quant(S.ripe)}`;
    if (!rl || rl.c.width !== st.canvas.width || rl.c.height !== st.canvas.height) rl = { c: st.layer(), back: st.layer(), key: '', pending: null, i: 0 };
    if (rl.key === key) return rl.c;
    const bg = rl.back.getContext('2d');
    if (rl.pending !== key) {
      rl.pending = key; rl.i = 0;
      bg.save(); bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, rl.back.width, rl.back.height); bg.restore();
    }
    const far = layers.geo.far, end = now ? Math.min(far.length, rl.i + 400) : far.length;
    const tn = riceTones(quant(S.green), quant(S.ripe)), headA = smoothstep(0.25, 0.7, quant(S.ripe));
    const styles = [css(mixc(tn[1], tn[0], 0.35)), css(mixc(tn[1], RICE.haze, 0.2))], headS = css(mixc('#d9b65c', '#b48532', 0.35), headA);
    bg.lineCap = 'butt'; bg.lineJoin = 'round';
    // small paths, a few dozen clumps each: rasterisers handle those far faster
    let paths = [new Path2D(), new Path2D()], heads = new Path2D(), count = 0;
    const flush = () => {
      bg.strokeStyle = styles[0]; bg.lineWidth = 1; bg.stroke(paths[0]);
      bg.strokeStyle = styles[1]; bg.lineWidth = 0.85; bg.stroke(paths[1]);
      if (headA > 0) { bg.strokeStyle = headS; bg.lineWidth = 1.5; bg.stroke(heads); }
      paths = [new Path2D(), new Path2D()]; heads = new Path2D(); count = 0;
    };
    for (; rl.i < end; rl.i++) {
      const c = far[rl.i];
      if (tq < c.plant) continue;
      const [h] = clumpH(c, tq), sgn = 0.18 + 0.12 * N(c.gx * 0.8, c.gz * 0.8, 5.5);
      clumpBlades(paths[c.band - 1], c, h, sgn, false);
      if (headA > 0 && c.band === 1) clumpHeads(heads, c, h, sgn);
      if (++count >= 30) flush();
    }
    flush();
    if (rl.i >= far.length) { [rl.c, rl.back] = [rl.back, rl.c]; rl.key = key; rl.pending = null; }
    return rl.key ? rl.c : null;
  }
  // gusts over the distance, as a tiny image of wind strength stretched over the field
  const SW = 120, SH = 40, sheen = mk(SW, SH), shg = sheen.getContext('2d'), shImg = shg.createImageData(SW, SH);
  function sheenField(local, col) {
    const d = shImg.data, top = Y_FAR - 2, span = NEAR_Y + 30 - top;
    for (let j = 0; j < SH; j++) {
      const y = top + ((j + 0.5) / SH) * span, gz = F / Math.max(1, y - HY);
      for (let i = 0; i < SW; i++) {
        const gx = ((((i + 0.5) / SW) * W - CX) * gz) / F, k = (j * SW + i) * 4;
        d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255 * clamp(gustAt(gx, gz, local, windDir) * 0.8);
      }
    }
    shg.putImageData(shImg, 0, 0);
  }

  // The sky and the ground change slowly, so each is composited into its own
  // cached layer every fourth frame (sky and field on alternate frames); a
  // frame is two copies, then the rice and the rain on top.
  let bgSky = null, bgField = null, bgStale = true;
  const partOf = (g, px) => (src, x, y, w, h) => g.drawImage(src, x * px, y * px, w * px, h * px, x, y, w, h);

  function sunGlare(g, K, y0, y1, k) {
    if (K.sun <= 0.01) return;
    const low = clamp((K.sunY + 60) / 156), col = mixc('#fffbf0', '#ffc36a', low);
    const gr = g.createRadialGradient(SUN_X, K.sunY, 0, SUN_X, K.sunY, 700);
    gr.addColorStop(0, css(col, 0.9 * K.sun * k)); gr.addColorStop(0.22, css(col, 0.38 * K.sun * k)); gr.addColorStop(1, css(col, 0));
    g.fillStyle = gr; g.fillRect(0, y0, W, y1 - y0);
  }

  function paintSky(g, t, K) {
    const px = st.px;
    const sk = g.createLinearGradient(0, 0, 0, Y_FAR);
    sk.addColorStop(0, css(K.top)); sk.addColorStop(0.65, css(mixc(K.top, K.bottom, 0.7))); sk.addColorStop(1, css(K.bottom));
    g.fillStyle = sk; g.fillRect(0, 0, W, Y_FAR + 12);
    sunGlare(g, K, 0, Y_FAR + 12, 1);
    if (K.sun > 0.01 && K.sunY > 0) { g.fillStyle = css(mixc('#fffaf0', '#ffe2a8', 0.5), 0.85 * K.sun); g.beginPath(); g.arc(SUN_X, K.sunY, 13, 0, TAU); g.fill(); }
    const drift = (layer, speed, a, h) => {
      if (a <= 0.01) return;
      const off = ((t * speed) % W + W) % W;
      g.save(); g.globalAlpha = a;
      g.drawImage(layer, 0, 0, (W - off) * px, h * px, off, 0, W - off, h);
      if (off > 0) g.drawImage(layer, (W - off) * px, 0, off * px, h * px, 0, 0, off, h);
      g.restore();
    };
    drift(layers.wisps, 3, K.wisps, 175);
    drift(layers.heavy, 7, K.heavy, Y_FAR + 10);
    // the tree line, wavering in the heat when the ground is baking
    if (K.shimmer > 0.02) Y.shimmer(g, layers.trees, K, t, px); // the dry months only: the turning year's
    else g.drawImage(layers.trees, 0, 40 * px, W * px, (Y_FAR + 12 - 40) * px, 0, 40, W, Y_FAR + 12 - 40);
    // the air between us and the horizon, in the sky's own colour
    const m = g.createLinearGradient(0, 60, 0, Y_FAR + 10);
    m.addColorStop(0, css(K.bottom, 0.12 + 0.2 * K.mist)); m.addColorStop(0.6, css(K.bottom, 0.3 + 0.35 * K.mist)); m.addColorStop(1, css(K.bottom, 0.25 + 0.6 * K.mist));
    g.fillStyle = m; g.fillRect(0, 60, W, Y_FAR + 12 - 60);
    if (K.tintA > 0.005) { g.fillStyle = css(K.tint, K.tintA); g.fillRect(0, 0, W, Y_FAR + 12); }
  }

  function paintField(g, t, local, S, K, still, detail) {
    const px = st.px, part = partOf(g, px), top = Y_FAR - 2, fh = H - top;
    // the strip of trees the far bund overlaps
    g.drawImage(bgSky, 0, (top - 12) * px, W * px, 12 * px, 0, top - 12, W, 12);
    // the ground: dry, wet, or one showing through the other
    let mode;
    if (local < T.spots[0] || local >= T.dry[1]) mode = 'dry';
    else if (local < T.spots[1]) mode = 'spots';
    else if (local < T.dry[0]) mode = 'wet';
    else mode = 'drying';
    // the wet ground is the still's own; every other mode, and standing water, belong to the turning year
    if (mode === 'wet') part(layers.wet, 0, top, W, fh);
    else year.ground(g, layers, mode, local, S, part);
    if (S.water > 0) year.water(g, layers, t, local, K, S, still, detail, windDir, part);

    // the rice's canopy and its sheen sit under the bunds; the blades go over them
    const { canopy, yCut, cutting, tones } = riceState(local, S);
    if (canopy > 0.01 && yCut > top) {
      // the canopy closing: plots read as green long before each blade could
      g.save(); g.globalAlpha = canopy * (1 - S.ripe); part(layers.canopyG, 0, top, W, yCut - top);
      if (S.ripe > 0.01) { g.globalAlpha = canopy * S.ripe; part(layers.canopyR, 0, top, W, yCut - top); }
      g.restore();
      // wind over the distance: the pale undersides of the leaves, in moving patches
      sheenField(local, tones[2]);
      const y1 = Math.min(yCut, NEAR_Y + 30), span = NEAR_Y + 30 - top;
      g.save(); g.globalAlpha = canopy; g.imageSmoothingEnabled = true;
      g.drawImage(sheen, 0, 0, SW, (SH * (y1 - top)) / span, 0, top, W, y1 - top);
      g.restore();
    }
    if (cutting && yCut < H) { g.save(); g.globalAlpha = 1 - S.dry; part(layers.stubble, 0, yCut, W, H - yCut); g.restore(); }

    // bunds: dusty or grassed
    const greenB = smoothstep(T.spots[1], T.plant + 6, local) * (1 - smoothstep(T.cut[0], T.dry[1], local));
    if (greenB < 0.99) part(layers.bundDry, 0, top - 10, W, fh + 10);
    if (greenB > 0.01) { g.save(); g.globalAlpha = greenB; part(layers.bundGreen, 0, top - 10, W, fh + 10); g.restore(); }

    // cloud shadows sliding over the field
    if (K.shade > 0.01) {
      const off = ((t * 9) % W + W) % W;
      g.save(); g.globalAlpha = K.shade;
      g.drawImage(layers.shade, 0, top * px, (W - off) * px, fh * px, off, top, W - off, fh);
      if (off > 0) g.drawImage(layers.shade, (W - off) * px, top * px, off * px, fh * px, 0, top, off, fh);
      g.restore();
    }
    // the air: haze thickening toward the tree line, and the season's light
    const hz = g.createLinearGradient(0, top - 12, 0, top + 190);
    hz.addColorStop(0, css(K.bottom, 0.3 + 0.45 * K.mist)); hz.addColorStop(1, css(K.bottom, 0));
    g.fillStyle = hz; g.fillRect(0, top - 12, W, 202);
    sunGlare(g, K, top - 12, H, 0.35);
    if (K.tintA > 0.005) { g.fillStyle = css(K.tint, K.tintA); g.fillRect(0, top - 12, W, fh + 12); }
  }

  function riceState(local, S) {
    const cutting = local >= T.cut[0];
    return {
      tones: riceTones(S.green, S.ripe), cutting,
      yCut: cutting ? clamp(HY + F / Math.max(0.2, S.cut), Y_FAR - 4, H) : H,
      canopy: local >= T.plant ? smoothstep(T.plant + 2, T.plant + 16, local) : 0,
    };
  }

  function render(data, frame) {
    const look = data.look, calm = frame.calm || [], p = frame.pointer, now = performance.now();
    const dark = palette().dark !== '#000000';
    // a held season (progress) or a still: time stands still. Anything but the still waits for the
    // turning year (year.js) and its layers, and shows the still meanwhile.
    if (seed !== data.seed) { const keep = layers; newField(data.seed); layers = keep; }
    if (frame.epoch !== epoch) {
      if (epoch !== -1) { origin = frame.time * (look.pace || 1); lastLocal = -1; year?.restart(); bgStale = true; }
      epoch = frame.epoch;
    }
    const key = `${st.canvas.width}x${st.canvas.height}`;
    if (key !== sizeKey) {
      sizeKey = key; year?.resize(); year?.unhold(); bgStale = true;
      const had = built && layers;
      start();
      if (had) { while (!advance(1000)); } // resize: repaint at once
    }
    if (!built && advance(8) && firstPaint) { readyAt = frame.time; bgStale = true; }
    // decided after a new field or a resize, which rebuild the layers (the year's come after the still's)
    const want = data.held ? data.local : frame.still || look.pace === 0 ? STILL_AT : null;
    const early = !(year && yearBuilt) && want !== STILL_AT;
    if (early) needYear();
    const still = early || !!frame.still || data.held || look.pace === 0;
    const t = still ? 0 : frame.time, dt = still ? 0 : Math.min(0.1, frame.dt || 0);
    if (built && year && !yearBuilt) { advance(early ? 24 : 8); lastKey = ''; invalidate(); } // the year's layers, in slices (bigger while only the still is shown)
    const g = st.begin();
    // bare paper until the first layers land, and while a held month earlier than the still's waits for the year:
    // the picture never shows a later month than the status names
    if (!layers || (early && data.held && data.local < STILL_AT)) {
      g.fillStyle = '#e8dfca'; g.fillRect(0, 0, W, H); invalidate();
      if (layers && built && resolveReady) { resolveReady(); resolveReady = null; } // an honest wait is a ready frame
      return;
    }
    if (!built) invalidate(); // a new field is still painting behind the old one

    const local = early ? STILL_AT : data.held ? data.local : still ? STILL_AT : (((frame.time * look.pace - origin) % T.cycle) + T.cycle) % T.cycle;
    // the pointer, in playful: its speed and how recently it moved
    if (look.touch && p.inside) {
      if (pv.mx !== p.x || pv.my !== p.y) pv.last = now;
      pv.mx = p.x; pv.my = p.y;
    }
    const pointerLive = look.touch && p.inside && now - pv.last < 700;
    // the people redraw the rice 30 times a second in playful (every frame while a hand moves), 24 in warm; fewer when frames run slow
    const q = frame.quality ?? 1, fps = (look.touch ? 30 : 24) * (q < 0.5 ? 0.5 : q < 0.75 ? 0.75 : 1);
    const calmKey = calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
    const fk = `${still ? `s${local}` : pointerLive || pv.act > 0.02 ? now : Math.floor(frame.time * fps)}|${calmKey}|${dark}|${key}|${built}|${frame.time - readyAt < 0.7 ? frame.time : ''}`;
    if (fk === lastKey) return;
    lastKey = fk;

    const G = layers.geo, px = st.px, top = Y_FAR - 2;
    if (local < lastLocal) { year?.restart(); bgStale = true; }
    lastLocal = local;
    const S = season(local), K = sky(local);

    if (!bgSky || bgSky.width !== st.canvas.width || bgSky.height !== st.canvas.height) { bgSky = st.layer(); bgField = st.layer(); bgStale = true; }
    const phase4 = frameNo++ % 4;
    if (bgStale || still || phase4 === 0) paintSky(bgSky.getContext('2d'), t, K);
    if (bgStale || still || phase4 === 2) paintField(bgField.getContext('2d'), t, local, S, K, still, q);
    bgStale = false;
    g.drawImage(bgSky, 0, 0, W * px, top * px, 0, 0, W, top);
    g.drawImage(bgField, 0, (top - 12) * px, W * px, (H - top + 12) * px, 0, top - 12, W, H - top + 12);

    // pointer: its speed on the screen, and the wind following it (the turning year's)
    if (year) windDir = Y.steer(pv, p, look.touch, dt, now, pointerLive, windDir);
    const pSpeed = Math.hypot(pv.x, pv.y);

    // the egrets: step them, then sort them into the rows by depth
    const egretsOn = local > T.spots[1] + 1 && local < T.dry[0] + 5;
    const near = pointerLive || (look.touch && p.inside && now - pv.last < 1500) ? [p.x, p.y] : null;
    const birds = egrets && !early ? Y.birdsNow(egrets, still, egretsOn, dt, local, S, near) : egretsOn ? settledEgrets(seed) : [];
    birds.sort((a, b) => b.gz - a.gz);
    const standing = birds.filter(e => !e.fly), flying = birds.filter(e => e.fly);
    const inWater = smoothstep(0.9, 1.2, S.water);
    const drawBird = e => {
      const b = e.b, pose = { fly: e.fly, flap: b.flap, walk: b.walk, peck: b.peck };
      if (!e.fly && S.water > 0.3) Y.reflectBird(g, e, S, local, drawEgret, pose);
      drawEgret(g, e.x, e.y, e.s, b.dir, pose);
    };
    let ei = 0;
    while (ei < standing.length && standing[ei].gz > 1.75) drawBird(standing[ei++]);

    // the rice
    if (local >= T.plant) {
      const { tones, cutting, yCut } = riceState(local, S);
      // the middle and far rows, from a layer repainted per season step
      const R = farRice(local, S, dt > 0);
      const yR = Math.min(yCut, NEAR_Y + 40);
      if (R && yR > top) g.drawImage(R, 0, (top - 30) * px, W * px, (yR - top + 30) * px, 0, top - 30, W, yR - top + 30);
      // the near rows, leaf by leaf, combed by the wind and the pointer
      const lw = 0.75 + 0.25 * S.green;
      // three greens per tone: some clumps a little darker, some yellower
      const styles = tones.map(c => [css(c), css(mixc(c, mixc(RICE.darkG, RICE.darkR, S.ripe), 0.22)), css(mixc(c, '#c8c26a', 0.18))]);
      const glint = css(mixc(tones[2], [255, 252, 232], 0.45));
      // reflections first, so the rice stands on them
      if (inWater > 0.01) Y.riceReflections(g, G, local, S, inWater, clumpH, RICE.darkG);
      // one small path per clump: a software rasteriser handles many small
      // paths far faster than one path spread across the whole field
      let lastStyle = '', nh = 0, heads2 = new Path2D();
      const headStyle = css(mixc('#d9b65c', '#b48532', 0.35), smoothstep(0.25, 0.7, S.ripe));
      const flushHeads = () => { g.lineCap = 'round'; g.strokeStyle = headStyle; g.lineWidth = 2; g.stroke(heads2); heads2 = new Path2D(); nh = 0; };
      const pr = 170, pr2 = 2 * pr * pr, pAct = pv.act, pdx = pSpeed > 40 ? pv.x / pSpeed : 0;
      const pStr = pSpeed > 40 ? Math.min(1, 0.35 + pSpeed / 450) : 0.45, gustAmp = 1 - S.ripe * 0.35;
      for (const c of G.near) {
        while (ei < standing.length && standing[ei].gz > c.gz) drawBird(standing[ei++]);
        if (local < c.plant) continue;
        if (c.gz < S.cut) continue; // cut: stubble (the turning year's)
        const [h, grow] = clumpH(c, local);
        const [wx, , m0, gust] = windAt(c.gx, c.gz, local, windDir, gustAmp);
        let m = m0 * (0.35 + 0.65 * grow), bx = wx, glow = gust;
        if (pAct > 0.01) [bx, m, glow] = Y.lean(c, p, bx, m, glow, pAct, pStr, pdx, pr2);
        const sgn = clamp(bx * Math.min(1.2, m), -1.1, 1.1);
        const tone = glow > 0.55 ? 2 : glow > 0.2 ? 1 : 0, path = new Path2D(), style = styles[tone][c.shade];
        if (style !== lastStyle) { g.fillStyle = style; lastStyle = style; }
        const w = (tone === 2 ? 0.7 : 0.85) * lw * Math.sqrt(c.sc / F) * 1.2;
        clumpLeaves(path, c, h, sgn, w);
        g.fill(path);
        if (c.glint >= 0 && q >= 0.5) {
          // one blade turned to the light
          const one = new Path2D(), bl = c.blades[c.glint];
          clumpLeaves(one, { x: c.x, y: c.y, tilt: c.tilt, blades: [[bl[0], bl[1] * 0.98, bl[2]]] }, h, sgn, w * 0.7);
          g.fillStyle = glint; g.fill(one); lastStyle = '';
        }
        if (S.ripe > 0.25) { clumpHeads(heads2, c, h, sgn); if (++nh >= 40) flushHeads(); }
      }
      if (nh) flushHeads();
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (cutting) Y.stubs(g, G.near, S, S.dry);
    }
    while (ei < standing.length) drawBird(standing[ei++]);

    // rain: streaks falling, and each early drop's splash where it lands (none near the page's words)
    if (!still) year.rain(g, G, local, S, calm);

    // egrets in the air go over everything
    for (const e of flying) drawBird(e);

    // the keyboard hand, so a sighted keyboard user sees where the wind will come from
    if (look.touch && p.keyboard && p.inside && year) Y.hand(g, p);

    // dusk on a dark page: the same field in the last light, never an inverted one
    if (dark) { g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(96,104,156,0.6)'; g.fillRect(0, 0, W, H); g.restore(); }

    // one sheet of paper under everything: grain, fibres and a soft vignette
    g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.7; g.drawImage(layers.paper, 0, 0, W, H); g.restore();

    // under the page's words the field holds still while the season turns round them
    if (calm.length && !still) year.hold(g, calm, local, calmKey);

    // fade in from bare paper once the first paint is done
    const up = still ? 1 : (frame.time - readyAt) / 0.6;
    if (up < 1) { g.fillStyle = `rgba(232,223,202,${1 - clamp(up)})`; g.fillRect(0, 0, W, H); invalidate(); }
    host.dataset.local = local.toFixed(2); // for tools and dev pages: the moment of the year, and the wind
    host.dataset.wind = windDir.toFixed(3);
    if (resolveReady && built) { resolveReady(); resolveReady = null; }
  }

  return {
    render,
    ready,
    setRegister() { lastKey = ''; bgStale = true; },
    restyle() { colors = null; lastKey = ''; },
    /** Enter or Space in playful: a gust from the keyboard hand, across the field in the wind's direction. */
    activate(p) {
      if (!p) return;
      pv.x = Math.cos(windDir) * 600; pv.y = -Math.sin(windDir) * 200; pv.act = 1; pv.last = performance.now(); pv.lt = 0;
      lastKey = ''; invalidate();
    },
    destroy() { st.destroy(); },
  };
}
