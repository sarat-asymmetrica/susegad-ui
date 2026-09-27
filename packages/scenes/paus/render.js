// Paus: the renderer. Owns the canvases, the fog mask, the drop stepper,
// wiping, the time-sliced first paint and the quality levels. It draws what
// model.js describes; every choice about what the window shows lives there.

import { stage, ink, hatch, paper, makeNoise, N, rng, clamp, lerp, TAU, mix, boil, grainPattern } from '../../engine/index.js';
import { createGovernor } from '../../engine/src/governor.js';
import {
  W, H, OUT, T, IN, CAP, RAIL, GLASS_Y0, MULL, PANES, R, MW, MH, HORIZON, CUP, sk, createDrops, fogField, ghostPath, cover,
} from './model.js';

const WOOD = '#5a3924', WOOD_LIGHT = '#7b5337', WOOD_DARK = '#26170d';

// The same window in two lights: day, and dusk for dark pages, with a lamp lit inside.
const THEMES = {
  light: {
    wall: '#e4ded0', fiber: '#6b5a3e', speck: '#3a2f22', vig: 0.16, sky: null, wood: null, lamp: 0, palm: 0,
    haze: ['rgba(214,222,217,0.55)', 'rgba(226,231,227,0.78)'], fleck: 0.55, rain: 'rgba(232,238,234,0.42)', ring: 'rgba(240,244,240,0.6)',
    bead: 'rgba(34,48,42,0.2)', glint: 0.6, rim: 'rgba(28,38,34,0.42)', steam: '#f8f5ee', grain: 0.07,
  },
  dark: {
    wall: '#2f2a24', fiber: '#d8c4a0', speck: '#0b0906', vig: 0.34, sky: 'rgba(16,28,44,0.5)', wood: 'rgba(12,8,10,0.36)', lamp: 1, palm: 0.5,
    haze: ['rgba(54,64,72,0.64)', 'rgba(62,70,76,0.84)'], fleck: 0.12, rain: 'rgba(186,200,208,0.3)', ring: 'rgba(196,208,212,0.42)',
    bead: 'rgba(0,0,0,0.3)', glint: 0.42, rim: 'rgba(0,0,0,0.5)', steam: '#e8dfcf', grain: 0.1,
  },
};

// Detail levels the governor steps through, exactly as the sketchbook piece did.
const LEVELS = [{ lens: Infinity, fogEvery: 4, rain: 1 }, { lens: 36, fogEvery: 8, rain: 0.65 }, { lens: 18, fogEvery: 12, rain: 0.48 }];

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const trace = (g, pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); };
const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; };

// A smooth noise field painted into a tiny canvas and stretched: soft clouds for free.
function noiseWash(g, x, y, w, h, fn, res = 8) {
  const cw = Math.max(2, Math.round(w / res)), ch = Math.max(2, Math.round(h / res));
  const c = mk(cw, ch), cg = c.getContext('2d'), img = cg.createImageData(cw, ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const [r, gg, b, a] = fn(x + (i / (cw - 1)) * w, y + (j / (ch - 1)) * h), k = (j * cw + i) * 4;
    img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = clamp(a) * 255;
  }
  cg.putImageData(img, 0, 0);
  g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c, x, y, w, h); g.restore();
}

function ridge(x0, x1, base, amp, freq, seed, nz) {
  const pts = [];
  for (let x = x0; x <= x1; x += 4) pts.push([x, base + nz.fbm(x * freq, seed, 0.3, 4) * amp]);
  return pts;
}

/** A band of hill: fill, hatch, inked ridge line, then mist settling at its foot. */
function hill(g, pts, fill, line, h, mist) {
  const poly = [...pts, [IN.x1 + 10, HORIZON + 30], [IN.x0 - 10, HORIZON + 30]];
  g.fillStyle = fill; trace(g, poly); g.fill();
  hatch(g, poly, h);
  if (line) ink(g, pts, line);
  g.fillStyle = lin(g, 0, mist[0], 0, mist[1], mist[2]); g.fillRect(IN.x0, mist[0], IN.x1 - IN.x0, mist[1] - mist[0] + 30);
  return poly;
}

// ── The view outside ──────────────────────────────────────────────────────

function* drawSky(g, seed) {
  const nz = makeNoise(seed === 1 ? 21 : sk(seed, 'sky'));
  g.save();
  g.beginPath(); g.rect(IN.x0, IN.y0, IN.x1 - IN.x0, IN.y1 - IN.y0); g.clip();
  g.fillStyle = lin(g, 0, IN.y0, 0, HORIZON + 30, [[0, '#98a7a2'], [0.55, '#b8c3bd'], [1, '#d2d8cf']]);
  g.fillRect(IN.x0, IN.y0, IN.x1 - IN.x0, IN.y1 - IN.y0);
  // low cloud and slanting curtains of rain
  noiseWash(g, IN.x0, IN.y0, IN.x1 - IN.x0, HORIZON - IN.y0 + 20, (x, y) => {
    const c = nz.fbm(x * 0.0024, y * 0.0065, 0, 4), curtain = nz((x - y * 0.32) * 0.011, 5.5, 0.2);
    const dark = Math.max(0, -c) * 0.3 + Math.max(0, curtain) * 0.22, light = Math.max(0, c) * 0.4;
    return light > dark ? [238, 242, 238, light] : [74, 90, 86, dark];
  }, 6);
  yield;
  const M = 'rgba(206,214,205,';
  // far ghats, then nearer hills
  hill(g, ridge(IN.x0 - 10, IN.x1 + 10, 372, 70, 0.0024, 3.3, nz), '#90a298', { width: 0.9, color: '#5d7369', alpha: 0.35, jitter: 0.4, seed: 4, taper: 0 },
    { angle: -1.1, spacing: 4.5, seg: [5, 14], width: 0.7, color: '#5d7369', alpha: 0.2, seed: 3 }, [360, HORIZON, [[0, M + '0)'], [1, M + '0.85)']]]);
  yield;
  hill(g, ridge(IN.x0 - 10, IN.x1 + 10, 418, 46, 0.0042, 7.7, nz).map(([x, y]) => [x, y - Math.abs(nz(x * 0.035, 2.2)) * 6]), '#7a917f',
    { width: 1, color: '#4a6353', alpha: 0.4, jitter: 0.5, seed: 9, taper: 0 },
    { angle: -1.2, spacing: 3.6, seg: [4, 11], width: 0.7, color: '#4a6353', alpha: 0.26, seed: 8 }, [410, HORIZON + 4, [[0, M + '0)'], [1, M + '0.7)']]]);
  yield;
  // the tree line along the edge of the fields
  const trees = [];
  for (let x = IN.x0 - 10; x <= IN.x1 + 10; x += 3) {
    trees.push([x, HORIZON - 4 - Math.pow(Math.abs(nz.fbm(x * 0.028, 9.1, 0, 3)), 0.8) * 30 - Math.max(0, nz(x * 0.008, 4.4)) * 12]);
  }
  const poly = hill(g, trees, '#5a735f', null, { angle: -0.9, spacing: 2.8, seg: [3, 8], width: 0.7, color: '#304536', alpha: 0.35, seed: 12 },
    [HORIZON - 40, HORIZON + 8, [[0, M + '0.35)'], [0.6, M + '0)'], [1, M + '0.25)']]]);
  yield;
  hatch(g, poly, { angle: 0.7, spacing: 4, seg: [3, 7], width: 0.6, color: '#304536', alpha: 0.2, seed: 13 });
  g.restore();
}

function* drawFields(g, F) {
  const MIST = '#c9d0c7';
  g.save();
  g.beginPath(); g.rect(IN.x0, IN.y0, IN.x1 - IN.x0, IN.y1 - IN.y0); g.clip();
  for (const [i, p] of F.plots.entries()) {
    if (i % 4 === 3) yield;
    const d = (p.k + 0.5) / F.n, m = Math.pow(1 - d, 1.4) * 0.6;
    g.fillStyle = p.flooded ? mix('#a9bab4', MIST, m * 0.6) : mix(p.tone, MIST, m); trace(g, p.quad); g.fill();
    if (p.flooded) {
      hatch(g, p.quad, { angle: 0, spacing: lerp(1.8, 6, d), seg: [lerp(6, 18, d), lerp(18, 60, d)], gap: 0.6, width: lerp(0.4, 1, d), color: '#eef2ee', alpha: 0.5, wobble: 0.3, seed: p.seed });
      hatch(g, p.quad, { angle: 0, spacing: lerp(4, 11, d), seg: [lerp(4, 10, d), lerp(8, 30, d)], gap: 1.2, width: lerp(0.4, 0.9, d), color: '#6f837c', alpha: 0.25, wobble: 0.3, seed: p.seed + 5 });
    } else {
      hatch(g, p.quad, { angle: -1.42, spacing: lerp(1.7, 4.2, d), seg: [lerp(1.5, 4, d), lerp(3, 10, d)], gap: 0.9, width: lerp(0.4, 1, d), color: '#46613a', alpha: lerp(0.2, 0.45, d), wobble: 0.4, seed: p.seed });
    }
  }
  yield;
  // wet laterite path cutting across the fields
  const path = [[250, F.bot + 4], [300, F.bot + 4], [512, F.ys[3]], [504, F.ys[3]]];
  g.fillStyle = mix('#98604a', MIST, 0.25); trace(g, path); g.fill();
  hatch(g, path, { angle: -0.4, spacing: 2.4, seg: [3, 8], width: 0.6, color: '#5e3423', alpha: 0.35, seed: 71 });
  yield;
  // bunds: a green top edge and an earth shadow under it
  const bund = (a, b, w, d, s, dx, dy) => {
    ink(g, [a, b], { width: w * 1.6, color: '#a6b889', alpha: 0.55, jitter: lerp(0.3, 1.2, d), seed: s, taper: 0 });
    ink(g, [[a[0] + dx, a[1] + dy], [b[0] + dx, b[1] + dy]], { width: w, color: '#5b4d3b', alpha: lerp(0.35, 0.6, d), jitter: lerp(0.3, 1.2, d), seed: s + 1, taper: 0 });
  };
  for (let k = 1; k <= F.n; k++) {
    const y = F.ys[k], d = k / F.n, w = lerp(0.5, 2.6, d);
    bund([IN.x0 - 20, y], [IN.x1 + 20, y + (k % 2 ? 1.5 : -1.5)], w, d, k * 3, 0, w * 0.7);
  }
  yield;
  for (const s of F.splits) {
    const d = (s.k + 0.5) / F.n, w = lerp(0.4, 1.8, d);
    bund(s.a, s.b, w * 0.94, d * 0.8, s.k * 11 + s.a[0], w * 0.6, 0);
  }
  g.restore();
}

function palm(g, p, sway, color) {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const s = i / 16; pts.push([p.x + p.lean * p.h * Math.pow(s, 1.5) + sway * p.h * 0.35 * s * s, p.y - p.h * s]); }
  ink(g, pts, { width: p.w, color, taper: 0, jitter: 0.4, seed: p.id, pressure: 0.15 });
  const [cx, cy] = pts[16], wind = sway * 3.2;
  g.save();
  g.strokeStyle = color; g.lineCap = 'round';
  const spines = new Path2D(), leaves = new Path2D();
  for (let k = 0; k < p.n; k++) {
    const a = lerp(-Math.PI - 0.45, 0.45, k / (p.n - 1)) + N(k * 1.7, p.id, 0.4) * 0.2;
    const len = p.frond * (0.8 + 0.3 * Math.abs(N(k * 2.3, p.id * 0.7, 1.1) * 2));
    const droop = 0.55 + 0.25 * (1 - Math.abs(Math.cos(a)));
    const P = u => [cx + Math.cos(a) * len * u + wind * len * 0.6 * u * u, cy + Math.sin(a) * len * u + len * droop * u * u];
    spines.moveTo(cx, cy);
    for (let u = 0.1; u <= 1.001; u += 0.1) spines.lineTo(...P(u));
    for (let u = 0.12; u <= 1; u += 0.07) {
      const [x, y] = P(u), L = len * 0.24 * (1 - 0.55 * u) + 2;
      let tx = Math.cos(a) * len + 2 * wind * len * 0.6 * u, ty = Math.sin(a) * len + 2 * len * droop * u;
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      for (const side of [-1, 1]) {
        const ca = Math.cos(1.05 * side), sa = Math.sin(1.05 * side);
        const dx = tx * ca - ty * sa + wind * 0.6, dy = tx * sa + ty * ca + 0.75, l = Math.hypot(dx, dy) || 1;
        leaves.moveTo(x, y); leaves.lineTo(x + (dx / l) * L, y + (dy / l) * L);
      }
    }
  }
  g.lineWidth = p.near ? 1.6 : 0.9; g.stroke(spines);
  g.lineWidth = p.near ? 1.05 : 0.7; g.globalAlpha = 0.9; g.stroke(leaves);
  g.restore();
}

// ── The room ──────────────────────────────────────────────────────────────

/** Run a full-canvas paint as horizontal bands clipped on device-pixel rows:
 *  the same pixels as one call, but the raster work arrives in pieces. */
function* banded(g, paint, count = 2) {
  const k = g.getTransform().d;
  for (let i = 0; i < count; i++) {
    const y0 = Math.round((H * i / count) * k) / k, y1 = Math.round((H * (i + 1) / count) * k) / k;
    g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip(); paint(); g.restore();
    yield;
  }
}

function* drawWall(g, px, P) {
  yield* banded(g, () => paper(g, W, H, { base: P.wall, seed: 3, vignette: P.vig, mottle: 0.09, fibers: 50, fiber: P.fiber, speck: P.speck }), 4);
  // monsoon damp creeping up from the corners
  const r = rng('damp');
  for (let i = 0; i < 14; i++) {
    const x = r.pick([r.range(0, 120), r.range(1080, 1200)]), y = r.range(640, 800), rad = r.range(30, 90);
    const d = g.createRadialGradient(x, y, 0, x, y, rad);
    d.addColorStop(0, 'rgba(86,104,84,0.08)'); d.addColorStop(1, 'rgba(86,104,84,0)');
    g.fillStyle = d; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  yield;
  g.save();
  g.shadowColor = 'rgba(40,25,10,0.35)'; g.shadowBlur = 26 * px; g.shadowOffsetY = 8 * px;
  g.fillStyle = WOOD; g.fillRect(OUT.x0, OUT.y0, OUT.x1 - OUT.x0, OUT.y1 - OUT.y0);
  g.restore();
  yield;
  // pencil shading on the wall where the frame blocks the light
  hatch(g, [[OUT.x1, OUT.y0 + 20], [OUT.x1 + 34, OUT.y0 + 48], [OUT.x1 + 34, OUT.y1 + 40], [OUT.x1, OUT.y1 + 30]], { angle: -0.9, spacing: 3.2, seg: [6, 16], width: 0.7, color: '#6b5b45', alpha: 0.28, seed: 31 });
  yield;
  hatch(g, [[OUT.x0 - 40, 760], [OUT.x1 + 40, 760], [OUT.x1 + 20, 792], [OUT.x0 - 20, 792]], { angle: -0.9, spacing: 3.4, seg: [6, 14], width: 0.7, color: '#6b5b45', alpha: 0.22, seed: 32, density: (x, y) => 1 - (y - 760) / 34 });
  g.fillStyle = lin(g, 0, 758, 0, 800, [[0, 'rgba(40,25,10,0.28)'], [1, 'rgba(40,25,10,0)']]);
  g.fillRect(OUT.x0 - 40, 758, OUT.x1 - OUT.x0 + 80, 42);
}

function woodPiece(g, x, y, w, h, vertical, seed) {
  const pts = box(x, y, x + w, y + h), angle = vertical ? Math.PI / 2 : 0;
  g.fillStyle = WOOD; g.fillRect(x, y, w, h);
  g.fillStyle = vertical ? lin(g, x, 0, x + w, 0, WOOD_SHEEN) : lin(g, 0, y, 0, y + h, WOOD_SHEEN); g.fillRect(x, y, w, h);
  hatch(g, pts, { angle, spacing: 2.4, seg: [30, 120], gap: 0.12, width: 0.65, color: WOOD_DARK, alpha: 0.34, wobble: 0.8, seed });
  hatch(g, pts, { angle, spacing: 6.5, seg: [16, 60], gap: 0.7, width: 0.55, color: '#b58660', alpha: 0.28, wobble: 0.5, seed: seed + 3 });
  const edge = (a, b, s) => ink(g, [a, b], { width: 1.1, color: '#1d1009', alpha: 0.8, jitter: 0.35, taper: 5, seed: s });
  edge(pts[0], pts[1], seed + 1); edge(pts[1], pts[2], seed + 2); edge(pts[3], pts[2], seed + 3); edge(pts[0], pts[3], seed + 4);
}
const WOOD_SHEEN = [[0, 'rgba(255,215,170,0.12)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.2)']];

function capizCell(g, x, y, s, r) {
  const lit = r.range(0.85, 1.05) - 0.85;
  const gr = g.createRadialGradient(x + s * 0.4, y + s * 0.35, 2, x + s / 2, y + s / 2, s * 0.78);
  gr.addColorStop(0, mix('#f7f3ea', '#ffffff', lit)); gr.addColorStop(1, mix('#d2c9b6', '#e6dfcf', lit));
  g.fillStyle = gr; g.fillRect(x, y, s, s);
  g.fillStyle = `rgba(${r.pick(['228,196,206', '196,222,212', '226,214,186', '206,206,228'])},${r.range(0.14, 0.3)})`;
  g.beginPath(); g.ellipse(x + s * r.range(0.3, 0.7), y + s * r.range(0.3, 0.7), s * r.range(0.22, 0.42), s * r.range(0.18, 0.32), r() * TAU, 0, TAU); g.fill();
  const cx = x + s * r.range(-0.3, 0.3), cy = y + s * r.range(0.8, 1.3);
  g.save(); g.beginPath(); g.rect(x, y, s, s); g.clip();
  g.strokeStyle = 'rgba(140,124,100,0.2)'; g.lineWidth = 0.55;
  for (let k = 1; k < 8; k++) { g.beginPath(); g.arc(cx, cy, s * 0.16 * k + r() * 2, 0, TAU); g.stroke(); }
  g.restore();
}

function chaiGlass(g) {
  const { x, base, h, tw, bw } = CUP, top = base - h, liquidTop = top + 15;
  const at = y => lerp(tw, bw, (y - top) / h);
  g.save();
  g.fillStyle = 'rgba(30,15,5,0.28)'; g.beginPath(); g.ellipse(x + 6, base + 1, tw + 6, 4.5, 0, 0, TAU); g.fill();
  const lq = [[x - at(liquidTop) + 2.5, liquidTop], [x + at(liquidTop) - 2.5, liquidTop], [x + bw - 2.5, base - 4], [x - bw + 2.5, base - 4]];
  g.fillStyle = lin(g, x - tw, 0, x + tw, 0, [[0, '#c49466'], [0.5, '#a9784a'], [1, '#8a5d36']]); trace(g, lq); g.fill();
  hatch(g, lq, { angle: -1.2, spacing: 2.4, seg: [4, 10], width: 0.5, color: '#5d3a1e', alpha: 0.3, seed: 5 });
  g.fillStyle = '#dcbc93'; g.beginPath(); g.ellipse(x, liquidTop, at(liquidTop) - 2.5, 3.2, 0, 0, TAU); g.fill();
  // glass: faint body, ribs, rim, highlights
  g.fillStyle = 'rgba(235,240,236,0.14)'; trace(g, [[x - tw, top], [x + tw, top], [x + bw, base], [x - bw, base]]); g.fill();
  for (let k = -3; k <= 3; k++) {
    const f = k / 3.6;
    ink(g, [[x + f * at(top + 20), top + 20], [x + f * bw, base - 3]], { width: 0.9, color: k % 2 ? '#fdfaf2' : '#3a2a1e', alpha: k % 2 ? 0.35 : 0.18, jitter: 0.2, seed: 40 + k, taper: 6 });
  }
  const ol = { width: 1.1, color: '#2b241d', alpha: 0.7, jitter: 0.3, seed: 50 };
  ink(g, [[x - tw, top], [x - bw, base]], ol);
  ink(g, [[x + tw, top], [x + bw, base]], { ...ol, seed: 51 });
  g.strokeStyle = 'rgba(43,36,29,0.6)'; g.lineWidth = 1;
  g.beginPath(); g.ellipse(x, top, tw, 3.4, 0, 0, TAU); g.stroke();
  g.beginPath(); g.ellipse(x, base, bw, 2.8, 0, 0, Math.PI); g.stroke();
  ink(g, [[x - tw + 4, top + 5], [x - bw + 3.5, base - 6]], { width: 2.2, color: '#ffffff', alpha: 0.55, jitter: 0.3, seed: 52, taper: 10 });
  g.restore();
}

function* drawFrame(g) {
  // capiz band: a lattice of oyster-shell squares
  g.fillStyle = WOOD; g.fillRect(IN.x0, IN.y0, IN.x1 - IN.x0, CAP.y1 - IN.y0);
  hatch(g, box(IN.x0, IN.y0, IN.x1, CAP.y1), { angle: 0, spacing: 2.6, seg: [20, 80], width: 0.6, color: WOOD_DARK, alpha: 0.3, seed: 90 });
  yield;
  const r = rng('capiz');
  for (let j = 0; j < CAP.rows; j++) for (let i = 0; i < CAP.cols; i++) {
    const x = IN.x0 + CAP.gap + i * (CAP.cell + CAP.gap), y = IN.y0 + CAP.gap + j * (CAP.cell + CAP.gap);
    capizCell(g, x, y, CAP.cell, r);
    ink(g, box(x, y, x + CAP.cell, y + CAP.cell), { width: 0.9, color: '#2a180c', alpha: 0.55, jitter: 0.3, seed: i * 7 + j, closed: true });
    if (i % 4 === 3) yield;
  }
  // shadows cast on the glass by the rails
  g.fillStyle = lin(g, 0, GLASS_Y0, 0, GLASS_Y0 + 18, [[0, 'rgba(20,14,8,0.3)'], [1, 'rgba(20,14,8,0)']]);
  g.fillRect(IN.x0, GLASS_Y0, IN.x1 - IN.x0, 18);
  for (const q of PANES) {
    g.fillStyle = lin(g, q.x0, 0, q.x0 + 14, 0, [[0, 'rgba(20,14,8,0.22)'], [1, 'rgba(20,14,8,0)']]);
    g.fillRect(q.x0, q.y0, 14, q.y1 - q.y0);
  }
  yield;
  // rails and stiles
  for (const [x, y, w, h, v, s] of [
    [OUT.x0, OUT.y0, OUT.x1 - OUT.x0, T, 0, 100], [OUT.x0, IN.y1, OUT.x1 - OUT.x0, T, 0, 110], [IN.x0, CAP.y1, IN.x1 - IN.x0, RAIL, 0, 120],
    [MULL.x0, GLASS_Y0, MULL.x1 - MULL.x0, IN.y1 - GLASS_Y0, 1, 130], [OUT.x0, OUT.y0, T, OUT.y1 - OUT.y0, 1, 140], [IN.x1, OUT.y0, T, OUT.y1 - OUT.y0, 1, 150],
  ]) { woodPiece(g, x, y, w, h, v, s); yield; }
  // an iron latch on the meeting stile
  g.fillStyle = '#2a2622'; g.fillRect(MULL.x0 - 4, 436, MULL.x1 - MULL.x0 + 8, 9);
  g.beginPath(); g.arc(600, 440.5, 5.5, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,240,220,0.25)'; g.fillRect(MULL.x0 - 3, 437, MULL.x1 - MULL.x0 + 6, 1.5);
  // the sill
  const sill = [[OUT.x0 - 8, OUT.y1], [OUT.x1 + 8, OUT.y1], [OUT.x1 + 34, OUT.y1 + 18], [OUT.x0 - 34, OUT.y1 + 18]];
  g.fillStyle = WOOD_LIGHT; trace(g, sill); g.fill();
  hatch(g, sill, { angle: 0, spacing: 2.2, seg: [30, 120], gap: 0.1, width: 0.6, color: WOOD_DARK, alpha: 0.28, seed: 160 });
  yield;
  g.fillStyle = lin(g, 0, OUT.y1, 0, OUT.y1 + 8, [[0, 'rgba(20,12,6,0.35)'], [1, 'rgba(20,12,6,0)']]);
  g.fillRect(OUT.x0, OUT.y1, OUT.x1 - OUT.x0, 8);
  woodPiece(g, OUT.x0 - 34, OUT.y1 + 18, OUT.x1 - OUT.x0 + 68, 32, false, 170);
  yield;
  ink(g, [sill[3], sill[2]], { width: 1.2, color: '#f0d2ae', alpha: 0.35, jitter: 0.3, seed: 171, taper: 10 });
  chaiGlass(g);
}

/** Dusk: darken what is already painted, then let a lamp by the chai warm the sill. */
function dusk(g, shade, lamp) {
  if (!shade) return;
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = shade; g.fillRect(0, 0, W, H);
  if (lamp) {
    const gl = g.createRadialGradient(CUP.x, CUP.base - 30, 10, CUP.x, CUP.base - 30, 420);
    gl.addColorStop(0, 'rgba(255,176,96,0.26)'); gl.addColorStop(1, 'rgba(255,176,96,0)');
    g.fillStyle = gl; g.fillRect(0, 0, W, H);
  }
  g.restore();
}

// Where the frame layer has anything inside the glass area (rail shadows,
// the latch, the chai glass): the only strips worth copying each frame.
const FRAME_Y_TOP = GLASS_Y0 + 18, FRAME_Y_BOT = CUP.base - CUP.h - 8;

/** drawImage with the source rectangle clamped to the source canvas, and the
 *  destination trimmed by the same proportion, so every browser agrees. */
function drawClamped(g, src, sx, sy, sw, sh, dx, dy, dw, dh) {
  const kx = dw / sw, ky = dh / sh;
  if (sx < 0) { dx -= sx * kx; dw += sx * kx; sw += sx; sx = 0; }
  if (sy < 0) { dy -= sy * ky; dh += sy * ky; sh += sy; sy = 0; }
  if (sx + sw > src.width) { const o = sx + sw - src.width; sw -= o; dw -= o * kx; }
  if (sy + sh > src.height) { const o = sy + sh - src.height; sh -= o; dh -= o * ky; }
  if (sw > 0 && sh > 0 && dw > 0 && dh > 0) g.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
}

// ── The renderer ──────────────────────────────────────────────────────────

export function createRenderer(host, { seed = 1, invalidate = null, scene = null } = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  let dprCap = coarse && devicePixelRatio >= 2 && (navigator.hardwareConcurrency || 8) <= 4 ? 1.5 : 2;
  let st = stage(host, { W, H, maxDpr: dprCap });
  const PANES_PATH = new Path2D();
  for (const q of PANES) PANES_PATH.rect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0);

  // fog mask: alpha = how fogged. Fixed resolution, independent of screen size.
  const mask = mk(MW, MH), mg = mask.getContext('2d'), cov = mk(MW, MH);
  const mid = mk(168, 76), tiny = mk(52, 24), mid2 = mk(168, 76), fogC = mk(506, 229), fc = fogC.getContext('2d');
  let blurBase = null, view = null, frameNo = 0;
  const toM = (x, y) => [((x - R.x) * MW) / R.w, ((y - R.y) * MH) / R.h], mScale = MW / R.w;

  // theme: data-theme on an ancestor, else the system preference
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const readTheme = () => { const v = (scene ?? host.getRootNode().host ?? host).closest('[data-theme]')?.getAttribute('data-theme'); return v === 'dark' || (v !== 'light' && mq.matches) ? 'dark' : 'light'; };
  let theme = readTheme(), P, speck, haze, palmInk;
  function applyTheme() {
    P = THEMES[theme];
    const c = mk(64, 64), g = c.getContext('2d'), r = rng('speck');
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(255,255,255,${r.range(0.35, 0.9)})`; g.fillRect(r() * 64, r() * 64, 1, 1); }
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(40,55,50,${r.range(0.08, 0.2)})`; g.fillRect(r() * 64, r() * 64, 1, 1); }
    speck = fc.createPattern(c, 'repeat');
    haze = lin(fc, 0, 0, 0, fogC.height, [[0, P.haze[0]], [1, P.haze[1]]]);
    palmInk = new Map();
    blurBase = null;
  }
  applyTheme();

  let D = null, F = null, drops, simReady, layers, ghost, ghostR, lastInteract, regrowAcc, covP;
  let builder = null, sizeKey = '', ready = false, readyAt = -Infinity, pumping = false, dead = false, snapshot = null, sliceNext = false;
  let level = 0, lastDraw = 0, focused = false, poked = 0, resolveReady, kp = null;
  const readyP = new Promise(r => (resolveReady = r));

  function reset() {
    drops = createDrops(seed); simReady = false; ghost = null; ghostR = rng(sk(seed, 'ghost'));
    lastInteract = 0; regrowAcc = 0; ready = false; builder = null; sizeKey = ''; blurBase = null;
  }
  reset();

  function wipeMask(x0, y0, x1, y1, rad, k = 1) {
    const [a0, b0] = toM(x0, y0), [a1, b1] = toM(x1, y1), rr = rad * mScale;
    const n = Math.max(1, Math.ceil(Math.hypot(a1 - a0, b1 - b0) / (rr * 0.35)));
    mg.save(); mg.globalCompositeOperation = 'destination-out';
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n), b = lerp(b0, b1, i / n), gr = mg.createRadialGradient(a, b, 0, a, b, rr);
      gr.addColorStop(0, `rgba(0,0,0,${0.8 * k})`); gr.addColorStop(0.55, `rgba(0,0,0,${0.5 * k})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      mg.fillStyle = gr; mg.fillRect(a - rr, b - rr, rr * 2, rr * 2);
    }
    mg.restore();
  }
  const wipe = (x0, y0, x1, y1, rad) => { wipeMask(x0, y0, x1, y1, rad); drops.wipe(x0, y0, x1, y1, rad); };
  function trail({ x0, y0, x1, y1, w }) {
    const [a0, b0] = toM(x0, y0), [a1, b1] = toM(x1, y1);
    mg.save(); mg.globalCompositeOperation = 'destination-out';
    mg.strokeStyle = 'rgba(0,0,0,0.7)'; mg.lineWidth = Math.max(1, w * mScale); mg.lineCap = 'round';
    mg.beginPath(); mg.moveTo(a0, b0); mg.lineTo(a1, b1); mg.stroke();
    mg.restore();
  }
  // fog creeps back every half second, faster behind anything meant to be read
  function regrow(dt, rate, calm) {
    regrowAcc += dt;
    if (regrowAcc < 0.5) return;
    const k = 1 - Math.exp(-rate * regrowAcc);
    regrowAcc = 0;
    mg.fillStyle = `rgba(255,255,255,${k})`; mg.fillRect(0, 0, MW, MH);
    mg.fillStyle = `rgba(255,255,255,${Math.min(1, k * 3)})`;
    for (const c of calm) { const [a, b] = toM(c.x - 16, c.y - 16); mg.fillRect(a, b, (c.w + 32) * mScale, (c.h + 32) * mScale); }
  }
  function setCover(p) {
    if (p === covP) return;
    covP = p;
    if (p == null) return;
    const cg = cov.getContext('2d'), img = cg.createImageData(MW, MH);
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) img.data[(j * MW + i) * 4 + 3] = cover(p, R.x + ((i + 0.5) * R.w) / MW, R.y + ((j + 0.5) * R.h) / MH) * 255;
    cg.putImageData(img, 0, 0);
  }

  // ── Warm-up, in slices ──
  // The fog mask, a few seconds of rain already on the glass, and the four
  // painted layers are built a slice at a time across the first frames instead
  // of in one long hitch. Canvas rasterises lazily, so each slice is followed
  // by a 1×1 read that forces the raster right there.
  function* warmSim() {
    const a = new Uint8ClampedArray(MW * MH), img = mg.createImageData(MW, MH);
    for (const _ of fogField(seed, a)) yield;
    for (let i = 0; i < a.length; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = a[i]; }
    mg.putImageData(img, 0, 0);
    yield;
    // start with a wiped patch, as if someone just looked out
    drops.set({ rate: D.beadRate });
    for (let i = 0; i < 240; i++) { drops.step(1 / 30).forEach(trail); regrow(1 / 30, D.regrow, []); if (i % 40 === 39) yield; }
    // a few uneven strokes of a hand, not one clean stamp, then two seconds of
    // rain and fog on top so the patch looks wiped a moment ago
    const m = ghostPath(ghostR);
    for (const [dy, rad, k] of [[-20, 26, 0.07], [-8, 34, 0.1], [4, 38, 0.1], [16, 30, 0.08], [26, 22, 0.06]]) {
      let prev = m.at(0);
      for (let d = 8; d <= m.length; d += 8) { const q = m.at(d); wipeMask(prev[0], prev[1] + dy, q[0], q[1] + dy, rad, k); drops.wipe(prev[0], prev[1] + dy, q[0], q[1] + dy, rad * 0.7); prev = q; }
    }
    for (let i = 0; i < 60; i++) { drops.step(1 / 30).forEach(trail); regrow(1 / 30, D.regrow, []); }
    simReady = true;
  }
  function* buildLayers() {
    const L = {}, grain = g => { g.globalAlpha = P.grain; g.fillStyle = grainPattern(g, '#3a2f22', { lo: 0, hi: 0.9 }); };
    let g = (L.wall = st.layer()).getContext('2d');
    for (const _ of drawWall(g, st.px, P)) yield L.wall;
    // the wall never changes under the grain, so the grain is baked in
    for (const _ of banded(g, () => { grain(g); g.fillRect(0, 0, W, H); })) yield L.wall;
    if (P.lamp) dusk(g, 'rgba(0,0,0,0)', 1);
    g = (L.sky = st.layer()).getContext('2d');
    for (const _ of drawSky(g, seed)) yield L.sky;
    dusk(g, P.sky);
    yield L.sky;
    g = (L.fields = st.layer()).getContext('2d');
    for (const _ of drawFields(g, D.geo.fields)) yield L.fields;
    dusk(g, P.sky);
    yield L.fields;
    g = (L.frame = st.layer()).getContext('2d');
    for (const _ of drawFrame(g)) yield L.frame;
    dusk(g, P.wood, P.lamp);
    // bake the grain into the frame too, everywhere but the glass
    const outside = new Path2D(); outside.rect(0, 0, W, H); outside.addPath(PANES_PATH);
    for (const _ of banded(g, () => { g.clip(outside, 'evenodd'); g.globalCompositeOperation = 'source-atop'; grain(g); g.fillRect(0, 0, W, H); })) yield L.frame;
    layers = L;
  }
  function* warmup() { yield* warmSim(); yield* buildLayers(); }

  const tapG = mk(1, 1).getContext('2d');
  function advance(budget) {
    const t0 = performance.now();
    while (!ready && performance.now() - t0 < budget) {
      const s = builder.next();
      if (s.value) tapG.drawImage(s.value, 0, 0, 1, 1);
      if (s.done) { ready = true; resolveReady(); }
    }
    return ready;
  }
  // keeps building while nothing is calling render (a still, a paused scene)
  function pump() {
    pumping = false;
    if (dead || ready || !builder) return;
    if (advance(12)) { readyAt = -Infinity; if (performance.now() - lastDraw > 60) poke(); } else { pumping = true; setTimeout(pump, 0); }
  }
  const kick = () => { if (!ready && !pumping && !dead) { pumping = true; setTimeout(pump, 0); } };
  const redraw = () => D && !dead && render(D, { ...F, dt: 0 });
  // an input while nothing is animating: ask for one fresh frame
  const poke = () => { if (performance.now() - lastDraw > 50 && !poked) poked = requestAnimationFrame(() => { poked = 0; invalidate ? invalidate() : redraw(); }); };

  // ── Quality ──
  // The engine's governor, tuned like the sketchbook piece: it steps down
  // after sustained frames slower than about 30fps. A fast machine never
  // leaves level 0, which is exactly the original rendering. (The element's
  // own governor steps sooner; Paus keeps its thresholds as the baseline.)
  const own = createGovernor({ slow: 1.76, window: 150 });
  function govern(dt) {
    const q = own.sample(dt * 1000);
    level = q > 0.8 ? 0 : q > 0.55 ? 1 : 2;
    if (level === 2 && dprCap > 1.25) { dprCap = 1.25; restart(); }
  }
  // A new stage at a lower pixel density. The simulation carries on; the last
  // frame is held on screen while the layers repaint in slices, then crossfades.
  function restart() {
    setTimeout(() => {
      if (dead) return;
      const old = st.canvas;
      snapshot = mk(old.width, old.height); snapshot.getContext('2d').drawImage(old, 0, 0);
      sliceNext = true;
      st.destroy(); st = stage(host, { W, H, maxDpr: dprCap }); bind(); redraw();
    }, 0);
  }

  // ── Wiping: the pointer directly, the element's keyboard pointer in playful ──
  let lastP = null;
  function bind() {
    const c = st.canvas;
    st.onresize = () => poke();
    c.onpointermove = e => {
      if (!simReady || !D?.wipe) return;
      const [x, y] = st.toLogical(e.clientX, e.clientY), now = performance.now();
      if (lastP && now - lastP.t < 150) wipe(lastP.x, lastP.y, x, y, e.pointerType === 'touch' ? 46 : 38);
      lastP = { x, y, t: now }; lastInteract = F?.time ?? 0; poke();
    };
    c.onpointerleave = () => (lastP = null);
  }
  bind();
  const onFocus = e => { focused = e.type === 'focusin'; poke(); };
  host.addEventListener('focusin', onFocus);
  host.addEventListener('focusout', onFocus);
  const restyle = () => { const t = readTheme(); if (t !== theme) { theme = t; applyTheme(); poke(); } };

  // ── A frame ──
  function render(data, frame) {
    D = data; F = frame; lastDraw = performance.now();
    if (data.seed !== seed) { seed = data.seed; reset(); }
    const g = st.begin(), t = frame.time ?? data.time, dt = frame.dt || 0, px = st.px, look = data.look;
    const key = `${st.canvas.width}x${st.canvas.height}:${theme}:${seed}`;
    if (key !== sizeKey) {
      const sameLook = sizeKey.slice(sizeKey.indexOf(':')) === key.slice(key.indexOf(':'));
      view = null;
      if (ready && sameLook && !sliceNext) { for (const _ of buildLayers()); } // resize: repaint at once, no blink
      else {
        if (ready && !snapshot) { snapshot = mk(st.canvas.width, st.canvas.height); snapshot.getContext('2d').drawImage(st.canvas, 0, 0); }
        ready = false; builder = simReady ? buildLayers() : warmup();
      }
      sizeKey = key; sliceNext = false;
    }
    if (!ready && advance(8)) readyAt = t;
    if (!ready || readyAt === t) {
      if (snapshot) g.drawImage(snapshot, 0, 0, W, H); else { g.fillStyle = P.wall; g.fillRect(0, 0, W, H); }
      kick();
      return;
    }

    // arrow keys: the element moves its pointer and we wipe along the way
    const kb = frame.pointer;
    if (kb?.keyboard && look.keys && data.wipe && simReady) {
      if (kp && (kp.x !== kb.x || kp.y !== kb.y)) { wipe(kp.x, kp.y, kb.x, kb.y, 38); lastInteract = t; }
      kp = { x: kb.x, y: kb.y };
    } else kp = null;
    const calm = frame.calm || [];
    drops.set({ rate: data.beadRate, calm });
    setCover(data.progress);
    if (dt > 0) {
      govern(dt);
      drops.step(dt).forEach(trail);
      // the smallest hook the rain soundscape needs: the visible drops this frame, in the
      // scene's own logical units (0..W, 0..H), so it can turn each one into a panned tick.
      // composed so a listener on <sg-scene name="paus"> sees it across the shadow boundary.
      host.dispatchEvent(new CustomEvent('sg-paus-drops', { bubbles: true, composed: true, detail: { beads: drops.beads, runners: drops.runners, W, H } }));
      regrow(dt, data.regrow, calm);
      // a hand that wipes the glass now and then, so there is always a clear patch
      if (look.ghost && data.wipe) {
        if (!ghost && t - lastInteract > 15) ghost = { m: ghostPath(ghostR), t0: t, done: 0 };
        if (ghost) {
          const head = Math.min(ghost.m.length, ((t - ghost.t0) / 1.6) * ghost.m.length);
          let prev = ghost.m.at(ghost.done);
          for (let d = ghost.done + 8; d <= head; d += 8) { const q = ghost.m.at(d); wipe(prev[0], prev[1], q[0], q[1], 40); prev = q; ghost.done = d; }
          if (head >= ghost.m.length) { ghost = null; lastInteract = t; }
        }
      }
    }
    const lv = LEVELS[level];

    // copy a logical rect of a same-size layer 1:1
    const part = (src, x, y, w, h, dst = g) => dst.drawImage(src, x * px, y * px, w * px, h * px, x, y, w, h);
    // copy a rect snapped to whole device pixels; strips that share an edge
    // round it identically, so they meet without overlap or gap
    const strip = (src, x0, y0, x1, y1) => {
      const a = Math.round(x0 * px), b = Math.round(y0 * px), c = Math.round(x1 * px), d = Math.round(y1 * px);
      g.drawImage(src, a, b, c - a, d - b, a / px, b / px, (c - a) / px, (d - b) / px);
    };

    if (!view || view.width !== st.canvas.width || view.height !== st.canvas.height) view = st.layer();
    const vg = view.getContext('2d'), palms = data.geo.palms, far = palms.far.length;
    vg.setTransform(px, 0, 0, px, 0, 0);
    const pInk = p => {
      if (!palmInk.has(p.color)) palmInk.set(p.color, P.palm ? mix(p.color, '#0e161a', P.palm) : p.color);
      return palmInk.get(p.color);
    };
    // sky and fields are clipped to the window when painted, so only that part is copied
    part(layers.sky, IN.x0, IN.y0, IN.x1 - IN.x0, IN.y1 - IN.y0, vg);
    palms.far.forEach((q, i) => palm(vg, q, data.sway[i], pInk(q)));
    part(layers.fields, IN.x0, HORIZON, IN.x1 - IN.x0, IN.y1 - HORIZON, vg);
    palms.near.forEach((q, i) => palm(vg, q, data.sway[far + i], pInk(q)));
    // rain outside
    vg.save();
    vg.beginPath(); vg.rect(IN.x0, IN.y0, IN.x1 - IN.x0, IN.y1 - IN.y0); vg.clip();
    vg.strokeStyle = P.rain; vg.lineWidth = 0.9; vg.lineCap = 'round';
    vg.beginPath();
    const rr = rng(sk(seed, 'rain')), span = IN.y1 - IN.y0 + 60, count = Math.round(data.streaks * lv.rain);
    for (let i = 0; i < count; i++) {
      const sp = rr.range(420, 620), len = rr.range(14, 30), x0 = rr.range(IN.x0 - 120, IN.x1), y0 = rr() * span;
      const y = ((y0 + t * sp) % span) + IN.y0 - 30, x = x0 + (y - IN.y0) * 0.16;
      vg.moveTo(x, y); vg.lineTo(x - len * 0.16, y - len);
    }
    vg.stroke();
    // rings on the flooded plots
    vg.strokeStyle = P.ring;
    const ringR = rng(sk(seed, 'rings')), flooded = data.geo.flooded;
    for (let i = 0; i < data.rings && flooded.length; i++) {
      const per = ringR.range(1.2, 2.2), ph = ringR() * per, c = Math.floor((t + ph) / per), f = ((t + ph) % per) / per;
      const pr = rng(i * 131 + c * 7), plot = flooded[Math.floor(pr() * flooded.length)];
      const [a, b, cq, d] = plot.quad, u = pr.range(0.1, 0.9), v = pr.range(0.2, 0.8);
      const x = lerp(lerp(a[0], b[0], u), lerp(d[0], cq[0], u), v), y = lerp(a[1], d[1], v);
      if (x < IN.x0 || x > IN.x1) continue;
      const depth = (plot.k + 0.5) / data.geo.fields.n, rad = lerp(1, lerp(4, 11, depth), f);
      vg.globalAlpha = (1 - f) * 0.8; vg.lineWidth = lerp(0.4, 0.9, depth);
      vg.beginPath(); vg.ellipse(x, y, rad, rad * 0.32, 0, 0, TAU); vg.stroke();
    }
    vg.restore();

    // wall only in the margins, the view only inside the frame: fewer pixels to copy
    const wall = layers.wall;
    part(wall, 0, 0, W, OUT.y0); part(wall, 0, OUT.y1, W, H - OUT.y1);
    part(wall, 0, OUT.y0, OUT.x0, OUT.y1 - OUT.y0); part(wall, OUT.x1, OUT.y0, W - OUT.x1, OUT.y1 - OUT.y0);
    part(view, IN.x0, IN.y0, IN.x1 - IN.x0, IN.y1 - IN.y0);

    // fog: a blurred, hazed, speckled copy of the view (refreshed every few
    // frames, since it barely changes), shown only where the mask says
    if (!blurBase || frameNo % lv.fogEvery === 0) {
      const m = mid.getContext('2d');
      m.imageSmoothingQuality = 'low';
      drawClamped(m, view, R.x * px, R.y * px, R.w * px, R.h * px, 0, 0, mid.width, mid.height);
      tiny.getContext('2d').drawImage(mid, 0, 0, tiny.width, tiny.height);
      mid2.getContext('2d').drawImage(tiny, 0, 0, mid2.width, mid2.height);
      blurBase = blurBase || mk(fogC.width, fogC.height);
      const bb = blurBase.getContext('2d');
      bb.globalAlpha = 1; bb.drawImage(mid2, 0, 0, blurBase.width, blurBase.height);
      bb.fillStyle = haze; bb.fillRect(0, 0, blurBase.width, blurBase.height);
      bb.globalAlpha = P.fleck; bb.fillStyle = speck; bb.fillRect(0, 0, blurBase.width, blurBase.height); bb.globalAlpha = 1;
    }
    frameNo++;
    fc.globalCompositeOperation = 'copy'; fc.drawImage(blurBase, 0, 0);
    fc.globalCompositeOperation = 'destination-in'; fc.drawImage(mask, 0, 0, fogC.width, fogC.height);
    if (covP != null) fc.drawImage(cov, 0, 0, fogC.width, fogC.height);
    fc.globalCompositeOperation = 'source-over';
    g.save();
    g.clip(PANES_PATH);
    g.globalAlpha = data.fogAlpha; g.drawImage(fogC, R.x, R.y, R.w, R.h); g.globalAlpha = 1;

    // drops: tiny beads batched, bigger ones as little upside-down lenses
    const beads = drops.beads;
    g.fillStyle = P.bead;
    g.beginPath();
    for (const b of beads) if (b.r < 3) { g.moveTo(b.x + b.r, b.y); g.arc(b.x, b.y, b.r, 0, TAU); }
    g.fill();
    g.fillStyle = `rgba(255,255,255,${P.glint})`;
    g.beginPath();
    for (const b of beads) if (b.r < 3) { const q = b.r * 0.34; g.moveTo(b.x + b.r * 0.2 + q, b.y + b.r * 0.35); g.arc(b.x + b.r * 0.2, b.y + b.r * 0.35, q, 0, TAU); }
    g.fill();
    const big = beads.filter(b => b.r >= 3).concat(drops.runners);
    // on a struggling device only the largest drops carry the lens
    const lensMin = big.length > lv.lens ? big.map(d => d.r).sort((a, b) => b - a)[lv.lens - 1] : 0;
    g.lineCap = 'round';
    for (const d of big) {
      const ry = d.r * (d.vy ? 1.15 : 1.04);
      if (d.r >= lensMin) {
        g.save();
        g.beginPath(); g.ellipse(d.x, d.y, d.r, ry, 0, 0, TAU); g.clip();
        const k = 3.4, sw = d.r * 2 * k, sh = ry * 2 * k;
        g.translate(d.x, d.y); g.scale(1, -1);
        drawClamped(g, view, (d.x - sw / 2) * px, (d.y - sh / 2) * px, sw * px, sh * px, -d.r, -ry, d.r * 2, ry * 2);
        g.restore();
      }
      g.strokeStyle = P.rim; g.lineWidth = Math.max(0.6, d.r * 0.14);
      g.beginPath(); g.ellipse(d.x, d.y, d.r, ry, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = d.r * 0.26;
      g.beginPath(); g.ellipse(d.x, d.y + ry * 0.06, d.r * 0.72, ry * 0.72, 0, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(d.x - d.r * 0.36, d.y - ry * 0.4, d.r * 0.17, 0, TAU); g.fill();
    }
    // the keyboard's wiping cloth: a soft ring where the next wipe lands
    if (focused && kp) {
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(20,28,26,0.55)';
      g.beginPath(); g.arc(kp.x, kp.y, 38, 0, TAU); g.stroke();
      g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.setLineDash([6, 5]);
      g.beginPath(); g.arc(kp.x, kp.y, 38, 0, TAU); g.stroke(); g.setLineDash([]);
    }
    g.restore();

    // the frame: only the strips where it has paint (it is empty over the glass)
    const fr = layers.frame;
    strip(fr, OUT.x0 - 2, OUT.y0 - 2, OUT.x1 + 2, FRAME_Y_TOP);
    strip(fr, OUT.x0 - 36, FRAME_Y_BOT, OUT.x1 + 36, OUT.y1 + 52);
    strip(fr, OUT.x0 - 2, FRAME_Y_TOP, IN.x0 + 14, FRAME_Y_BOT);
    strip(fr, MULL.x0 - 5, FRAME_Y_TOP, MULL.x1 + 14, FRAME_Y_BOT);
    strip(fr, IN.x1 - 4, FRAME_Y_TOP, OUT.x1 + 2, FRAME_Y_BOT);

    // steam from the chai
    if (data.steam) {
      const bs = boil(t, 10);
      data.steam.forEach(({ pts, breathe }, k) => {
        for (let c = 0; c < 3; c++) ink(g, pts.slice(c * 8, c * 8 + 10), { width: 4.4 - c * 1.1, color: P.steam, alpha: (0.5 - c * 0.15) * breathe, jitter: 0.9, seed: bs + k * 13 + c, taper: 12 });
      });
    }
    // one sheet of paper grain ties the layers together (the wall and frame
    // already carry theirs, so here it only needs to cover the glass)
    g.save(); g.clip(PANES_PATH);
    g.globalAlpha = P.grain; g.fillStyle = grainPattern(g, '#3a2f22', { lo: 0, hi: 0.9 }); g.fillRect(R.x, R.y, R.w, R.h);
    g.restore();

    // fade in from the bare wall (or the held frame) once the warm-up is done
    const up = (t - readyAt) / 0.5;
    if (up < 1 && dt > 0) {
      g.globalAlpha = 1 - clamp(up);
      if (snapshot) g.drawImage(snapshot, 0, 0, W, H); else { g.fillStyle = P.wall; g.fillRect(0, 0, W, H); }
      g.globalAlpha = 1;
    } else snapshot = null;
  }

  return {
    render,
    /** Resolves once the painted layers are ready and a real frame can be drawn. */
    ready: readyP,
    setRegister() {},
    restyle,
    destroy() {
      dead = true; cancelAnimationFrame(poked);
      host.removeEventListener('focusin', onFocus); host.removeEventListener('focusout', onFocus);
      st.destroy();
    },
  };
}
