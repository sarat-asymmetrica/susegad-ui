// Ghat: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the old sheet with its foxing, folds and graticule, the sea
// and its water-lines, the layer tint and hill shading, the hachures and
// contours, the rivers, the dotted road, the hand lettering, the cartouche,
// the scale and the north point, and the monsoon clouds are the plate's own
// code. The layers are painted once, in slices, behind a ready promise. What
// the port adds: the reveal driven by `progress` or by time instead of the
// page's scroll, the registers (quiet is the inked sheet, warm inks it and
// lets the clouds drift, playful adds the keyboard hand), the height under
// the hand as real text, the calm zone (no cloud or name over the page's
// words), the sheet by lamplight on a dark page, the library's own serif, and
// a redraw only when something changed.

import { stage, ink, paper, grainPattern, hexToRgb, rng, clamp, lerp, TAU, measure, makeNoise, ease, phase, smoothstep, N } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import {
  W, H, M, C, GW, GH, STEP, INDEX, M_PER_UNIT, SEPIA, SEPIA_DARK, BLUE, BLUE_PALE, PAPER, RED, FONT,
  gx, gy, hAt, ghatSteps, builtGeo, keepGeo, TL, front, revealAt, heightAt, heightText,
} from './model.js';

// ── Drawing (the plate's own) ─────────────────────────────────────────────

const css = (c, a = 1) => { const [r0, g0, b0] = typeof c === 'string' ? hexToRgb(c) : c; return `rgba(${Math.round(r0)},${Math.round(g0)},${Math.round(b0)},${a})`; };
const mixc = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return [0, 1, 2].map(i => lerp(A[i], B[i], t)); };
const pathOf = (pts, closed) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (closed) p.closePath(); return p; };

/** A moving average: a line calm enough to letter along. */
function smoothLine(pts, k) {
  return pts.map((_, i) => {
    let x = 0, y = 0, n = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(pts.length - 1, i + k); j++) { x += pts[j][0]; y += pts[j][1]; n++; }
    return [x / n, y / n];
  });
}
/** Where between fractions a and b a stretch of length len turns least. */
function calmest(m, a, b, len) {
  let best = m.length * a, bestT = Infinity;
  for (let d = m.length * a; d < m.length * b - len; d += 6) {
    let turn = 0, prev = null;
    for (let e = d; e <= d + len; e += 8) { const p0 = m.at(e), p1 = m.at(e + 4), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]); if (prev !== null) turn += Math.abs(Math.atan2(Math.sin(ang - prev), Math.cos(ang - prev))); prev = ang; }
    if (turn < bestT) { bestT = turn; best = d; }
  }
  return best;
}
/** Letters placed one by one along a line, each turned to follow it: lettering by hand. */
function textAlong(g, text, m, start, { size = 13, spacing = 1.15, offset = 0, italic = true, color = BLUE, halo = true, seed = 0, alpha = 1 } = {}) {
  g.save();
  g.font = `${italic ? 'italic ' : ''}${size}px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const widths = [...text].map(ch => g.measureText(ch).width * spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  // a steady tangent: the line's direction measured across a few letters
  const tangent = d => { const a = m.at(d - 6), b = m.at(d + 6); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  // read left to right: if the line runs leftward here, letter it backwards
  const flip = Math.cos(tangent(start + total / 2)) < 0;
  const r = rng(`letters:${seed}:${text}`);
  let cum = 0;
  [...text].forEach((ch, i) => {
    const w = widths[i], at = flip ? start + total - cum - w / 2 : start + cum + w / 2;
    cum += w;
    const [x, y] = m.at(at), ang = tangent(at), a = ang + (flip ? Math.PI : 0), nx = -Math.sin(a), ny = Math.cos(a);
    g.save();
    g.translate(x + nx * offset, y + ny * offset); g.rotate(a + r.range(-0.04, 0.04));
    g.globalAlpha = alpha;
    const dy = r.range(-0.4, 0.4);
    if (halo) { g.strokeStyle = 'rgba(239,230,207,0.9)'; g.lineWidth = 3.5; g.lineJoin = 'round'; g.strokeText(ch, 0, dy); }
    g.fillStyle = color; g.fillText(ch, 0, dy);
    g.restore();
  });
  g.restore();
  return total;
}
function label(g, text, x, y, { size = 12, italic = true, color = SEPIA_DARK, angle = 0, alpha = 1, align = 'center', halo = true, spacing = 0 } = {}) {
  g.save();
  g.translate(x, y); g.rotate(angle); g.globalAlpha = alpha;
  g.font = `${italic ? 'italic ' : ''}${size}px ${FONT}`;
  g.textAlign = align; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  if (halo) { g.strokeStyle = 'rgba(239,230,207,0.92)'; g.lineWidth = 3.5; g.lineJoin = 'round'; g.strokeText(text, 0, 0); }
  g.fillStyle = color; g.fillText(text, 0, 0);
  g.restore();
}

function* paintSheet(g, geo, seed) {
  paper(g, W, H, { base: PAPER, seed: 40 + seed, mottle: 0.08, grain: 0.1, fibers: 90, vignette: 0.14 });
  const r = rng(`sheet:${seed}`);
  // foxing: small rust spots of an old sheet
  for (let i = 0; i < 26; i++) {
    const x = r.range(0, W), y = r.range(0, H), rad = r.range(1.5, 7);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(150,96,50,${r.range(0.08, 0.2)})`); gr.addColorStop(1, 'rgba(150,96,50,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
  }
  // fold lines
  for (const [x0, y0, x1, y1] of [[W / 2, 0, W / 2, H], [0, H / 2, W, H / 2]]) {
    const gr = g.createLinearGradient(x0 - (y1 - y0 ? 6 : 0), y0 - (x1 - x0 ? 6 : 0), x0 + (y1 - y0 ? 6 : 0), y0 + (x1 - x0 ? 6 : 0));
    gr.addColorStop(0, 'rgba(90,70,40,0)'); gr.addColorStop(0.45, 'rgba(90,70,40,0.07)'); gr.addColorStop(0.55, 'rgba(255,250,235,0.12)'); gr.addColorStop(1, 'rgba(255,250,235,0)');
    g.fillStyle = gr;
    if (x0 === x1) g.fillRect(x0 - 6, 0, 12, H); else g.fillRect(0, y0 - 6, W, 12);
  }
  yield;
  // neat line, border and graticule
  g.strokeStyle = SEPIA_DARK; g.lineWidth = 1.6; g.strokeRect(M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0);
  g.lineWidth = 0.6; g.strokeRect(M.x0 - 8, M.y0 - 8, M.x1 - M.x0 + 16, M.y1 - M.y0 + 16);
  const lons = ['73°55′', '74°00′', '74°05′', '74°10′', '74°15′'], lats = ['15°40′', '15°35′', '15°30′', '15°25′'];
  g.save();
  g.setLineDash([2, 4]); g.strokeStyle = 'rgba(63,111,138,0.35)'; g.lineWidth = 0.6;
  lons.forEach((t, i) => {
    const x = lerp(M.x0, M.x1, (i + 0.5) / lons.length);
    g.beginPath(); g.moveTo(x, M.y0); g.lineTo(x, M.y1); g.stroke();
    label(g, t, x, M.y0 - 20, { size: 10, italic: false, color: SEPIA_DARK, halo: false });
    label(g, t, x, M.y1 + 20, { size: 10, italic: false, color: SEPIA_DARK, halo: false });
  });
  lats.forEach((t, i) => {
    const y = lerp(M.y0, M.y1, (i + 0.5) / lats.length);
    g.beginPath(); g.moveTo(M.x0, y); g.lineTo(M.x1, y); g.stroke();
    label(g, t, M.x0 - 22, y, { size: 10, italic: false, color: SEPIA_DARK, halo: false, angle: -Math.PI / 2 });
    label(g, t, M.x1 + 22, y, { size: 10, italic: false, color: SEPIA_DARK, halo: false, angle: Math.PI / 2 });
  });
  g.restore();
  yield;
}

/** Cartouche, scale and north point: drawn over the sea, on top of everything. */
function paintFurniture(g, geo) {
  const x = M.x0 + 26, y = M.y1 - 150;
  g.save();
  g.fillStyle = 'rgba(239,230,207,0.9)'; g.fillRect(x - 10, y - 16, 236, 144);
  g.strokeStyle = SEPIA_DARK; g.lineWidth = 1; g.strokeRect(x - 10, y - 16, 236, 144);
  g.lineWidth = 0.5; g.strokeRect(x - 6, y - 12, 228, 136);
  g.restore();
  label(g, 'THE SAHYADRI', x + 108, y + 6, { size: 15, italic: false, color: SEPIA_DARK, halo: false, spacing: 3 });
  label(g, 'above Goa', x + 108, y + 26, { size: 13, color: SEPIA_DARK, halo: false });
  label(g, 'Contours at 50 metres;', x + 108, y + 50, { size: 10.5, color: SEPIA, halo: false });
  label(g, 'index contours every 250 metres', x + 108, y + 64, { size: 10.5, color: SEPIA, halo: false });
  // scale bar: 36 m per unit, so 5 km is about 139 units
  const sx = x + 38, sy = y + 94, km = 1000 / M_PER_UNIT;
  g.save();
  for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? PAPER : SEPIA_DARK; g.fillRect(sx + i * km, sy, km, 4); }
  g.strokeStyle = SEPIA_DARK; g.lineWidth = 0.7; g.strokeRect(sx, sy, km * 5, 4);
  g.restore();
  for (let i = 0; i <= 5; i++) label(g, String(i), sx + i * km, sy + 13, { size: 9, italic: false, color: SEPIA_DARK, halo: false });
  label(g, 'kilometres', sx + km * 2.5, sy + 26, { size: 9.5, color: SEPIA, halo: false });
  // north point
  const nx = M.x0 + 44, ny = M.y0 + 56;
  g.save();
  g.fillStyle = SEPIA_DARK; g.beginPath(); g.moveTo(nx, ny - 26); g.lineTo(nx + 6, ny + 8); g.lineTo(nx, ny + 2); g.closePath(); g.fill();
  g.strokeStyle = SEPIA_DARK; g.lineWidth = 0.8; g.beginPath(); g.moveTo(nx, ny - 26); g.lineTo(nx - 6, ny + 8); g.lineTo(nx, ny + 2); g.stroke();
  g.restore();
  label(g, 'N', nx, ny - 36, { size: 12, italic: false, color: SEPIA_DARK, halo: false });
}

function* paintSea(g, geo) {
  const { levels, coast } = geo;
  // the sea: everything west of the coastline
  const sea = new Path2D();
  sea.moveTo(M.x0, M.y0);
  for (let j = 0; j < GH; j++) sea.lineTo(coast[j] + 4, gy(j));
  sea.lineTo(M.x0, M.y1); sea.closePath();
  g.save(); g.beginPath(); g.rect(M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0); g.clip();
  g.save(); g.clip(sea);
  g.fillStyle = BLUE_PALE; g.globalAlpha = 0.75; g.fillRect(M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0);
  g.globalAlpha = 0.3; g.fillStyle = grainPattern(g, '#6f98a8', { lo: 0, hi: 0.6 }); g.fillRect(M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0);
  g.restore();
  yield;
  // water-lines: the depth contours, closest to the shore darkest
  for (const L of levels.filter(l => l.sea)) {
    const k = clamp(1 + L.level / 45);
    for (const ln of L.lines) ink(g, ln.pts, { width: 0.7, color: BLUE, alpha: 0.18 + 0.4 * k, jitter: 0.4, freq: 0.05, taper: 8, closed: ln.closed, seed: L.level * 13 + ln.pts.length });
  }
  g.restore();
}

function* paintLand(g, geo) {
  const { h, hmax, levels, hachures } = geo;
  // layer tint and hill shading, lit from the north-west
  const c = document.createElement('canvas'); c.width = GW; c.height = GH;
  const cg = c.getContext('2d'), img = cg.createImageData(GW, GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const k = j * GW + i, v = h[k], o = k * 4;
    if (v <= 0) continue;
    const dx = (h[j * GW + Math.min(GW - 1, i + 1)] - h[j * GW + Math.max(0, i - 1)]) / (2 * C * M_PER_UNIT) * 5;
    const dy = (h[Math.min(GH - 1, j + 1) * GW + i] - h[Math.max(0, j - 1) * GW + i]) / (2 * C * M_PER_UNIT) * 5;
    const nl = Math.hypot(dx, dy, 1), shade = (-dx * -0.6 + -dy * -0.6 + 0.55) / nl; // light from the upper left
    const t = clamp(v / hmax);
    const base = t < 0.5 ? mixc('#dfe2c2', '#e8d6ae', t / 0.5) : mixc('#e8d6ae', '#dcbf95', (t - 0.5) / 0.5);
    const lit = shade - 0.55;
    const col = lit < 0 ? base.map(ch => ch * (1 + lit * 0.55)) : base.map(ch => ch + (255 - ch) * lit * 0.6);
    img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 170;
  }
  cg.putImageData(img, 0, 0);
  g.save();
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(c, M.x0 - C / 2, M.y0 - C / 2, GW * C, GH * C);
  g.restore();
  yield;
  // hachures
  g.save();
  g.lineCap = 'round';
  for (const [band, lo, hi] of [[0, 0.2, 0.5], [1, 0.5, 1.01]]) {
    g.strokeStyle = css(SEPIA, band ? 0.55 : 0.32); g.lineWidth = band ? 0.8 : 0.6;
    g.beginPath();
    for (const [x0, y0, x1, y1, , s] of hachures) if (s >= lo && s < hi) { g.moveTo(x0, y0); g.lineTo(x1, y1); }
    g.stroke();
  }
  g.restore();
  yield;
  // contours: fine brown lines, index lines heavier, the coast in dark ink
  let n = 0;
  for (const L of levels) {
    if (L.sea) continue;
    const w = L.coast ? 1.5 : L.index ? 1.35 : 0.6, col = L.coast ? SEPIA_DARK : SEPIA, a = L.coast ? 0.95 : L.index ? 0.9 : 0.7;
    for (const ln of L.lines) {
      ink(g, ln.pts, { width: w, color: col, alpha: a, jitter: L.index ? 0.45 : 0.3, freq: 0.04, pressure: 0.3, taper: ln.closed ? 0 : 6, closed: ln.closed, step: 2.5, seed: L.level + ln.pts.length });
      if (++n % 25 === 0) yield;
    }
  }
  // sand along the shore
  const r = rng(`sand:${geo.seed}`);
  g.fillStyle = css(SEPIA, 0.45);
  for (const ln of levels.find(l => l.coast).lines) {
    const m = measure(ln.pts, ln.closed);
    for (let d = 0; d < m.length; d += 2.2) {
      const [x, y, a] = m.at(d), o = r.range(1.5, 6);
      g.fillRect(x + Math.sin(a) * o * -1 + 1.5, y + Math.cos(a) * o, 0.8, 0.8);
    }
  }
}

function cloudSprite(seed) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), nz = makeNoise(900 + seed);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2), d = Math.hypot(dx, dy * 1.25);
    const v = nz.fbm(x * 0.035, y * 0.035, 0.5, 4);
    const a = clamp((1 - d) * 1.6 + v * 1.1 - 0.35);
    const k = (y * S + x) * 4;
    const shade = clamp(0.5 + dy * 0.5 - v * 0.6);
    img.data[k] = 250 - shade * 40; img.data[k + 1] = 250 - shade * 36; img.data[k + 2] = 248 - shade * 30;
    img.data[k + 3] = 255 * a * a;
  }
  g.putImageData(img, 0, 0);
  return c;
}


// ── The renderer ──────────────────────────────────────────────────────────

const near = (x, y, calm, pad) => calm.some(r => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);
const shadowOf = sprite => {
  const c = document.createElement('canvas'); c.width = sprite.width; c.height = sprite.height;
  const g = c.getContext('2d');
  g.drawImage(sprite, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#3d4a58'; g.fillRect(0, 0, c.width, c.height);
  return c;
};

export function createRenderer(host, { invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tap = mk(1, 1).getContext('2d');
  const MS = 3, mw = Math.ceil(W / MS), mh = Math.ceil(H / MS);
  const mask = mk(mw, mh), mg = mask.getContext('2d'), maskImg = mg.createImageData(mw, mh);
  const sprites = [0, 1, 2].map(cloudSprite), shadows = sprites.map(shadowOf);
  let layers = null, builder = null, built = false, readyAt = -Infinity, sizeKey = '', colors = null;
  let revealV = null, lastFront = NaN, tmp = null, overlay = null, lastKey = '', lastT = null, told = '';
  let clouds = [], cloudR = null;
  let resolveReady = null;
  const ready = new Promise(r => { resolveReady = r; });
  st.onresize = () => { lastKey = ''; invalidate(); };

  // The height under the keyboard hand, said once each time it changes: real text, not only the pencilled note
  const live = document.createElement('div');
  live.className = 'vh';
  live.setAttribute('aria-live', 'polite');
  host.after(live);

  function palette() {
    return (colors ??= readColors(host, { dark: 'light-dark(#000000, #ffffff)' }));
  }

  function* buildLayers(seed) {
    let G = builtGeo(seed);
    if (!G) { G = yield* ghatSteps(seed); keepGeo(seed, G); }
    const L = {};
    L.sheet = st.layer(); for (const _ of paintSheet(L.sheet.getContext('2d'), G, G.seed)) { tap.drawImage(L.sheet, 0, 0, 1, 1); yield; }
    L.sea = st.layer(); for (const _ of paintSea(L.sea.getContext('2d'), G)) { tap.drawImage(L.sea, 0, 0, 1, 1); yield; }
    L.land = st.layer(); for (const _ of paintLand(L.land.getContext('2d'), G)) { tap.drawImage(L.land, 0, 0, 1, 1); yield; }
    L.furniture = st.layer(); paintFurniture(L.furniture.getContext('2d'), G); yield;
    L.geo = G;
    return L;
  }
  function build(budget) {
    const t0 = performance.now();
    while (!built && performance.now() - t0 < budget) {
      const s = builder.next();
      if (s.done) { const first = !layers || layers.geo.seed !== s.value.geo.seed; layers = s.value; built = true; revealV = null; lastFront = NaN; overlay = null; if (first) warmClouds(); }
    }
    return built;
  }

  // the reveal mask: land shows where its place in the reveal is behind the front
  function revealMask(F) {
    const G = layers.geo;
    if (!revealV) {
      revealV = new Float32Array(mw * mh);
      for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
        const x = i * MS + MS / 2, y = j * MS + MS / 2, v = hAt(G.h, x, y);
        revealV[j * mw + i] = v <= 0 ? -1 : revealAt(clamp(v / G.hmax), (y - M.y0) / (M.y1 - M.y0));
      }
    }
    const d = maskImg.data;
    for (let k = 0; k < revealV.length; k++) d[k * 4 + 3] = revealV[k] < 0 ? 255 : 255 * clamp((F - revealV[k]) / 0.012 + 0.5);
    mg.putImageData(maskImg, 0, 0);
  }

  // monsoon clouds: they come off the sea and slow as the land rises under them (the plate's own)
  function spawn(anywhere) {
    const r = cloudR, y = r.range(M.y0 - 40, M.y1 + 40);
    return { x: anywhere ? r.range(M.x0 - 80, M.x1) : r.range(M.x0 - 140, M.x0 - 60), y, r: r.range(40, 88), s: r.int(0, 2), age: anywhere ? r.range(3, 30) : 0, life: r.range(55, 90), rot: r.range(-0.4, 0.4), k: r.range(0.8, 1.2) };
  }
  function stepClouds(dt, most = 26) {
    const G = layers.geo;
    while (clouds.length < most) clouds.push(spawn(false));
    for (const c of clouds) {
      const v = Math.max(0, hAt(G.h, c.x, c.y)), lift = smoothstep(60, 650, v);
      const vx = 15 * c.k * (1 - 0.88 * lift) + 2;
      c.x += vx * dt; c.y += (N(c.x * 0.004, c.y * 0.004, c.age * 0.05) * 5 - 1) * dt;
      c.r += dt * lift * 0.5; c.age += dt;
    }
    clouds = clouds.filter(c => c.age < c.life && c.x < M.x1 + 120);
  }
  function warmClouds() { clouds = []; cloudR = rng(`clouds:${layers.geo.seed}`); for (let i = 0; i < 12; i++) clouds.push(spawn(true)); for (let i = 0; i < 400; i++) stepClouds(0.1); }

  function drawRivers(g, G, u) {
    for (const rv of G.rivers) {
      const delay = rv.kind === 'main' ? 0 : rv.kind === 'trib' ? 0.25 : 0.4;
      const k = clamp((u - delay) / (1 - delay));
      if (k <= 0) continue;
      const len = rv.m.length * ease.inOutSine(k), pts = [];
      for (let d = 0; d <= len; d += 3) pts.push(rv.m.at(d).slice(0, 2));
      if (pts.length < 2) continue;
      ink(g, pts, { width: rv.kind === 'main' ? 1.9 : 1.1, color: BLUE, alpha: 0.9, jitter: 0.35, freq: 0.05, pressure: 0.25, taper: 10, seed: rv.cells[0] });
    }
  }
  function drawRoad(g, G, u) {
    if (u <= 0 || G.road.length < 2) return;
    const m = G.roadM || (G.roadM = measure(G.road)), end = m.length * u;
    g.save(); g.fillStyle = '#6b3a24';
    for (let d = 0; d < end; d += 6.5) { const [x, y] = m.at(d); g.beginPath(); g.arc(x, y, 1.25, 0, TAU); g.fill(); }
    g.restore();
  }
  function drawLabels(g, G, u, calm) {
    const items = [];
    // elevation figures on the index contours
    for (const L of G.levels) if (L.index) for (const ln of L.lines) if (ln.length > 160) items.push(['elev', L, ln]);
    items.push(['river'], ['sea'], ['range'], ['road'], ...G.peaks.map(pk => ['peak', pk]));
    items.forEach((it, i) => {
      const a = ease.outCubic(clamp(u * items.length * 0.5 - i * 0.5));
      if (a <= 0) return;
      const [kind] = it;
      if (kind === 'elev') {
        const [, L, ln] = it, m = ln.m || (ln.m = measure(ln.pts, ln.closed));
        const r = rng(`lab:${L.level}:${ln.pts.length}`), spots = ln.length > 520 ? [0.3, 0.72] : [r.range(0.3, 0.7)];
        for (const s of spots) {
          const [x, y, ang] = m.at(m.length * s);
          if (x < M.x0 + 20 || x > M.x1 - 20 || y < M.y0 + 14 || y > M.y1 - 14 || near(x, y, calm, 16)) continue;
          let rot = ang; if (Math.cos(rot) < 0) rot += Math.PI;
          label(g, String(L.level), x, y, { size: 10, italic: false, color: SEPIA_DARK, angle: rot, alpha: a });
        }
      } else if (kind === 'river') {
        const m = G.riverLetterM || (G.riverLetterM = measure(smoothLine(G.rivers[0].pts, 14)));
        for (const [name, lo, hi, len, size, sp, off, s] of [['Mhadei', 0.2, 0.5, 70, 14, 1.3, -9, 0], ['Mandovi', 0.66, 0.9, 72, 13, 1.25, -10, 1]]) {
          const at = calmest(m, lo, hi, len), [x, y] = m.at(at + len / 2);
          if (near(x, y, calm, 40)) continue;
          textAlong(g, name, m, at, { size, spacing: sp, offset: off, color: BLUE, seed: G.seed + s, alpha: a });
        }
      } else if (kind === 'sea') {
        const y = (M.y0 + M.y1) / 2 - 90, x = (M.x0 + G.coast[Math.round(GH * 0.4)]) / 2 + 4;
        if (!near(x, y, calm, 60)) label(g, 'ARABIAN  SEA', x, y, { size: 16, color: BLUE, angle: -Math.PI / 2, alpha: a * 0.85, spacing: 6 });
      } else if (kind === 'range') {
        const m = G.crestM || (G.crestM = measure(G.crestLine)), [x, y] = m.at(m.length * 0.32);
        if (!near(x, y, calm, 80)) textAlong(g, 'S A H Y A D R I', m, m.length * 0.22, { size: 15, spacing: 1.25, italic: false, color: SEPIA_DARK, seed: G.seed + 2, alpha: a * 0.8 });
      } else if (kind === 'road' && G.road.length > 8) {
        const m = G.roadM || (G.roadM = measure(G.road));
        const [x, y] = m.at(m.length * 0.12);
        if (!near(x, y, calm, 30)) label(g, 'ghat road', x + 10, y + 14, { size: 11, color: '#6b3a24', alpha: a, align: 'left' });
      } else if (kind === 'peak') {
        const [, [x, y, v]] = it;
        if (near(x, y, calm, 16)) return;
        g.save(); g.globalAlpha = a; g.fillStyle = SEPIA_DARK;
        g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 3.6, y + 2.4); g.lineTo(x - 3.6, y + 2.4); g.closePath(); g.fill(); g.restore();
        label(g, String(v), x + 6, y - 8, { size: 10, italic: false, color: SEPIA_DARK, alpha: a, align: 'left' });
      }
    });
  }

  // Canvas text never asks for a web font: load the serif ourselves, then paint the lettering again
  if (document.fonts?.load) {
    Promise.all([document.fonts.load(`15px ${FONT}`), document.fonts.load(`italic 13px ${FONT}`)])
      .then(() => { if (built) { sizeKey = ''; lastKey = ''; invalidate(); } }, () => {});
  }

  function render(data, frame) {
    const t = frame.time, look = data.look, calm = frame.calm || [], still = frame.still;
    const dark = palette().dark !== '#000000';
    const key = `${st.canvas.width}x${st.canvas.height}|${data.seed}`;
    if (key !== sizeKey) {
      const reuse = built && layers && layers.geo.seed === data.seed;
      sizeKey = key; tmp = null; overlay = null; lastFront = NaN; lastKey = '';
      builder = buildLayers(data.seed); built = false;
      if (reuse) while (!build(1000));
    }
    const g = st.begin();
    if (!built) {
      // nothing else is on screen yet, so a slice can take most of a frame
      if (build(14)) readyAt = still ? -Infinity : t;
      else { g.fillStyle = PAPER; g.fillRect(0, 0, W, H); invalidate(); return; }
    }
    const G = layers.geo, px = st.px;
    const P = still && !data.held ? 1 : data.P;
    const dt = lastT === null || still || data.held ? 0 : Math.max(0, Math.min(0.1, t - lastT));
    lastT = t;
    const moving = look.clouds && !still && !data.held;
    if (moving && dt > 0) stepClouds(dt, (frame.quality ?? 1) < 0.6 ? 14 : 26);

    // the pointer (hover in warm, hover and the keyboard hand in playful) reads the ground
    const p = frame.pointer, reading = look.read && p.inside && P > 0.3 && !near(p.x, p.y, calm, 10);
    const hv = reading ? heightAt(G, p.x, p.y) : null;
    host.dataset.height = hv === null ? '' : heightText(hv);
    if (hv !== null && p.keyboard) { const say = `Height here: ${heightText(hv)}`; if (say !== told) { told = say; live.textContent = say; } }

    // redraw when the ink moves, 30 times a second while clouds drift, at once for the pointer
    const fading = t - readyAt < 0.7;
    const fk = `${P.toFixed(4)}|${moving || fading ? Math.floor(t * 30) : 's'}|${reading ? `${p.x | 0},${p.y | 0}` : ''}|${calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';')}|${dark}|${key}`;
    if (fk === lastKey) return;
    lastKey = fk;

    g.drawImage(layers.sheet, 0, 0, W, H);
    // the sea
    const seaA = ease.inOutSine(phase(P, TL.sea[0], TL.sea[1]));
    if (seaA > 0) { g.save(); g.globalAlpha = seaA; g.drawImage(layers.sea, 0, 0, W, H); g.restore(); }
    // the land, inked from sea level upward
    const F = front(P);
    if (F >= 1.03) g.drawImage(layers.land, 0, 0, W, H);
    else if (F > -0.02) {
      if (!(Math.abs(F - lastFront) <= 0.0015)) { revealMask(F); lastFront = F; }
      if (!tmp || tmp.width !== st.canvas.width || tmp.height !== st.canvas.height) tmp = mk(st.canvas.width, st.canvas.height);
      const tg = tmp.getContext('2d');
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'copy';
      tg.drawImage(layers.land, 0, 0);
      tg.globalCompositeOperation = 'destination-in'; tg.imageSmoothingEnabled = true;
      tg.drawImage(mask, 0, 0, mw, mh, 0, 0, mw * MS * px, mh * MS * px);
      tg.globalCompositeOperation = 'source-over';
      g.drawImage(tmp, 0, 0, W, H);
    }
    // rivers, road and names: cached once the sheet is complete
    const uR = phase(P, TL.rivers[0], TL.rivers[1]), uRoad = phase(P, TL.road[0], TL.road[1]), uL = phase(P, TL.labels[0], TL.labels[1]);
    const calmKey = calm.map(r => `${r.x | 0},${r.y | 0}`).join(';');
    if (P >= 1) {
      if (!overlay || overlay.width !== st.canvas.width || overlay.calm !== calmKey) {
        overlay = st.layer(og => { drawRivers(og, G, 1); drawRoad(og, G, 1); drawLabels(og, G, 1, calm); });
        overlay.calm = calmKey;
      }
      g.drawImage(overlay, 0, 0, W, H);
    } else {
      overlay = null;
      drawRivers(g, G, uR);
      drawRoad(g, G, uRoad);
      if (uL > 0) drawLabels(g, G, uL, calm);
    }

    // clouds and their shadows; none over the page's words; none in quiet
    const cA = look.clouds ? smoothstep(TL.clouds[0], TL.clouds[1], P) : 0;
    if (cA > 0.01) {
      g.save();
      g.beginPath(); g.rect(M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0); g.clip();
      for (const pass of [0, 1]) for (const c of clouds) {
        if (near(c.x, c.y, calm, c.r * 1.2)) continue;
        const fade = smoothstep(0, 6, c.age) * (1 - smoothstep(c.life - 10, c.life, c.age)) * cA;
        if (fade <= 0.01) continue;
        const v = Math.max(0, hAt(G.h, c.x, c.y)), thick = 0.35 + 0.45 * smoothstep(80, 700, v);
        const s = c.r * 2.4;
        g.save();
        g.translate(c.x + (pass ? 0 : 16), c.y + (pass ? 0 : 20)); g.rotate(c.rot);
        if (pass === 0) { g.globalAlpha = fade * 0.13; g.globalCompositeOperation = 'multiply'; } else g.globalAlpha = fade * thick;
        g.drawImage(pass ? sprites[c.s] : shadows[c.s], -s / 2, -s * 0.4, s, s * 0.8);
        g.restore();
      }
      g.restore();
    }
    g.drawImage(layers.furniture, 0, 0, W, H);

    // the pointer: a pencilled height, and that contour picked out in red
    if (hv !== null) {
      const x = p.x, y = p.y;
      if (hv > 0) {
        const L = Math.max(STEP, Math.round(hv / STEP) * STEP), lev = G.levels.find(l => l.level === L);
        if (lev && revealAt(L / G.hmax, 0.5) < F + 0.1) {
          g.save(); g.strokeStyle = css(RED, 0.75); g.lineWidth = 1.6; g.lineJoin = 'round';
          for (const ln of lev.lines) g.stroke(ln.path || (ln.path = pathOf(ln.pts, ln.closed)));
          g.restore();
        }
      }
      g.save(); g.strokeStyle = css(RED, 0.9); g.lineWidth = 1; g.beginPath();
      g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.stroke(); g.restore();
      const right = x < M.x1 - 90;
      label(g, heightText(hv), x + (right ? 12 : -12), y - 14, { size: 14, color: RED, align: right ? 'left' : 'right' });
    }

    // the sheet by lamplight on a dark page: warm dark round the edges, a pool of light in the middle
    if (dark) {
      g.save(); g.globalCompositeOperation = 'multiply';
      const lamp = g.createRadialGradient(W * 0.55, H * 0.45, 80, W * 0.55, H * 0.45, W * 0.8);
      lamp.addColorStop(0, 'rgba(255,226,180,1)'); lamp.addColorStop(0.6, 'rgba(150,110,80,1)'); lamp.addColorStop(1, 'rgba(60,44,40,1)');
      g.fillStyle = lamp; g.fillRect(0, 0, W, H); g.restore();
    }

    const up = still ? 1 : (t - readyAt) / 0.6;
    if (up < 1) { g.fillStyle = css(PAPER, 1 - clamp(up)); g.fillRect(0, 0, W, H); }
    host.dataset.inked = P.toFixed(3);
    if (resolveReady) { resolveReady(); resolveReady = null; }
  }

  return {
    render,
    ready,
    setRegister() { lastKey = ''; },
    restyle() { colors = null; lastKey = ''; },
    destroy() { live.remove(); st.destroy(); },
  };
}
