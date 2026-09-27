// Kolam: the canvas renderer. Owns every side effect.
//
// quiet    the finished kolam in hairline ink on paper; nothing moves
// warm     rice flour on a polished red-oxide floor, drawn once at a hand's
//          pace; then light moves slowly through the dots
// playful  flour on laterite with rangoli powder on the dots; your hand
//          pours faster, a click draws it again, and ants come for the flour

import { stage, rng, hashSeed, hexToRgb, makeNoise, N, TAU, smoothstep } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { pointAt, FILL } from './model.js';

const STEP = 0.8; // flour is sprinkled every 0.8 logical units along the line
const ALPHA = [0.5, 0.68, 0.84, 1];

/** A small, fast seeded stream (mulberry32) for the hot sprinkle loop: no closures per sample. */
function stream(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.gauss = () => Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(TAU * next());
  return next;
}

/** Pixels paint as batches: one Path2D per alpha bucket, then four fills. */
function grains() {
  const paths = ALPHA.map(() => new Path2D());
  return {
    add(x, y, s, a) { paths[Math.min(3, (a * 4) | 0)].rect(x - s / 2, y - s / 2, s, s); },
    fill(g, color) {
      g.save(); g.fillStyle = color;
      paths.forEach((p, i) => { g.globalAlpha = ALPHA[i]; g.fill(p); });
      g.restore();
    },
  };
}

// ── Floors, painted once per size and theme ──────────────────────────────

function lowres(W, H, s, seed, f, px) {
  const nz = makeNoise(seed), mw = Math.ceil(W / s), mh = Math.ceil(H / s);
  const m = document.createElement('canvas'); m.width = mw; m.height = mh;
  const mg = m.getContext('2d'), img = mg.createImageData(mw, mh);
  for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) px(img.data, (j * mw + i) * 4, nz.fbm(i * s * f, j * s * f, 0, 4));
  mg.putImageData(img, 0, 0);
  return m;
}

function speckle(g, W, H, n, seed, dark, light) {
  const r = rng(seed), d = grains(), l = grains();
  for (let i = 0; i < n; i++) (r() < 0.5 ? d : l).add(r() * W, r() * H, 1, r());
  g.save(); g.globalAlpha = 0.12; d.fill(g, dark); g.globalAlpha = 0.07; l.fill(g, light); g.restore();
}

function vignette(g, W, H, a) {
  const v = g.createRadialGradient(W / 2, H / 2, W * 0.32, W / 2, H / 2, W * 0.78);
  v.addColorStop(0, 'rgba(20,6,2,0)'); v.addColorStop(1, `rgba(20,6,2,${a})`);
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}

/** Polished red-oxide, as in the sketchbook: gradient, cloudy polish, grain, window glare. */
function redOxide(g, W, H) {
  const base = g.createRadialGradient(W * 0.3, H * 0.22, 40, W * 0.45, H * 0.45, W * 0.95);
  base.addColorStop(0, '#9b3b2b'); base.addColorStop(0.55, '#7a2a20'); base.addColorStop(1, '#4e1a15');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const m = lowres(W, H, 5, 41, 0.004, (d, k, v) => {
    if (v > 0) { d[k] = 255; d[k + 1] = 190; d[k + 2] = 160; d[k + 3] = v * 0.07 * 255; }
    else { d[k] = 30; d[k + 1] = 5; d[k + 2] = 0; d[k + 3] = -v * 0.16 * 255; }
  });
  g.save(); g.imageSmoothingEnabled = true; g.drawImage(m, 0, 0, W, H); g.restore();
  speckle(g, W, H, 9000, 7, '#000000', '#ffdcc8');
  g.save();
  g.translate(W * 0.27, H * 0.2); g.rotate(-0.5); g.scale(1, 0.45);
  const glare = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.3);
  glare.addColorStop(0, 'rgba(255,225,200,0.13)'); glare.addColorStop(1, 'rgba(255,225,200,0)');
  g.fillStyle = glare; g.beginPath(); g.arc(0, 0, W * 0.3, 0, TAU); g.fill();
  g.restore();
  vignette(g, W, H, 0.25);
}

/** Laterite: the porous red stone Goa is built from. Blocks in running bond, pitted, sun-warmed. */
function laterite(g, W, H, stone) {
  const base = g.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, stone); base.addColorStop(1, '#8a3a22');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // ochre and rust in drifts, as the iron settled in the stone
  const m = lowres(W, H, 4, 23, 0.0035, (d, k, v) => {
    if (v > 0) { d[k] = 226; d[k + 1] = 152; d[k + 2] = 70; d[k + 3] = Math.min(255, v * 0.62 * 255); }
    else { d[k] = 70; d[k + 1] = 18; d[k + 2] = 8; d[k + 3] = Math.min(255, -v * 0.5 * 255); }
  });
  g.save(); g.imageSmoothingEnabled = true; g.drawImage(m, 0, 0, W, H); g.restore();
  // vesicles: irregular open pores with a sunlit lip, clustered by noise
  const r = rng(11), nz = makeNoise(12), holes = new Path2D(), lips = new Path2D();
  const pore = (p, x, y, rad, sq, a, sides, jit) => {
    for (let k = 0; k <= sides; k++) {
      const t = (k % sides) / sides * TAU, rr = rad * jit[k % sides];
      const px = Math.cos(t) * rr, py = Math.sin(t) * rr * sq;
      const X = x + px * Math.cos(a) - py * Math.sin(a), Y = y + px * Math.sin(a) + py * Math.cos(a);
      k ? p.lineTo(X, Y) : p.moveTo(X, Y);
    }
    p.closePath();
  };
  for (let i = 0; i < 2600; i++) {
    const x = r() * W, y = r() * H;
    if (nz.fbm(x * 0.008, y * 0.008, 1, 2) + r() * 0.7 < 0.22) continue;
    const rad = 0.8 + Math.pow(r(), 2.6) * 6, sq = r.range(0.35, 0.9), a = r() * TAU, sides = 6;
    const jit = Array.from({ length: sides }, () => r.range(0.6, 1.25));
    pore(lips, x - 1, y - 1.2, rad * 1.05, sq, a, sides, jit);
    pore(holes, x, y, rad, sq, a, sides, jit);
  }
  g.save();
  g.fillStyle = 'rgba(244,184,120,0.3)'; g.fill(lips);
  g.fillStyle = 'rgba(48,12,4,0.78)'; g.fill(holes);
  g.restore();
  // mortar joints, running bond
  const bw = W / 3.2, bh = bw / 2, joints = new Path2D(), jr = rng(5);
  for (let y = -bh * 0.4, row = 0; y < H + bh; y += bh, row++) {
    joints.moveTo(0, y); for (let x = 0; x <= W; x += 40) joints.lineTo(x, y + jr.range(-0.8, 0.8));
    for (let x = (row % 2) * bw / 2 - bw; x < W + bw; x += bw) { joints.moveTo(x, y); joints.lineTo(x + jr.range(-1, 1), y + bh); }
  }
  g.save(); g.lineWidth = 3.2; g.strokeStyle = 'rgba(64,22,10,0.42)'; g.stroke(joints);
  g.translate(0.8, 1.6); g.lineWidth = 1.2; g.strokeStyle = 'rgba(250,196,150,0.16)'; g.stroke(joints); g.restore();
  speckle(g, W, H, 7000, 3, '#2a0c04', '#ffd9a8');
  vignette(g, W, H, 0.3);
}

const dusk = (g, W, H) => { g.fillStyle = 'rgba(12,10,32,0.4)'; g.fillRect(0, 0, W, H); };

// ── Ants, from the sketchbook ─────────────────────────────────────────────

function ant(g, x, y, ang, t, scale, carrying, flour) {
  g.save();
  g.translate(x, y); g.rotate(ang); g.scale(scale, scale);
  g.strokeStyle = '#140a07'; g.lineWidth = 0.45; g.lineCap = 'round';
  g.beginPath();
  for (let k = 0; k < 3; k++) for (const side of [-1, 1]) {
    const swing = Math.sin(t * 22 + k * Math.PI + (side > 0 ? Math.PI : 0)) * 0.9, bx = -0.6 + k * 0.7;
    g.moveTo(bx, 0); g.lineTo(bx + (k - 1) * 1.2 + swing, side * 2.1); g.lineTo(bx + (k - 1) * 1.9 + swing, side * 3.1);
  }
  g.moveTo(2.8, -0.4); g.quadraticCurveTo(4, -1.8, 4.9, -1.6);
  g.moveTo(2.8, 0.4); g.quadraticCurveTo(4, 1.8, 4.9, 1.6);
  g.stroke();
  g.fillStyle = '#1b0f0b';
  for (const [ex, rx, ry] of [[-3.1, 2.2, 1.6], [0, 1.25, 0.85], [2.3, 1.1, 1.05]]) { g.beginPath(); g.ellipse(ex, 0, rx, ry, 0, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,200,170,0.25)'; g.beginPath(); g.ellipse(-3.5, -0.6, 0.8, 0.4, 0, 0, TAU); g.fill();
  if (carrying) { g.fillStyle = flour; g.fillRect(4.2, -0.7, 1.4, 1.3); }
  g.restore();
}

// ── Making room for the words ────────────────────────────────────────────

/**
 * Where the kolam sits: centred, unless slotted text (the calm rects) would
 * cover it. Then it moves into the largest clear band beside the text and
 * shrinks only as much as it must. Returns a transform { s, tx, ty }.
 */
export function fitAround(calm, W, H) {
  const id = { s: 1, tx: 0, ty: 0 }, side = Math.min(W, H) * FILL, pad = W * 0.03;
  if (!calm.length) return id;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of calm) { x0 = Math.min(x0, r.x - pad); y0 = Math.min(y0, r.y - pad); x1 = Math.max(x1, r.x + r.w + pad); y1 = Math.max(y1, r.y + r.h + pad); }
  const k0x = (W - side) / 2, k0y = (H - side) / 2;
  if (x1 < k0x || x0 > k0x + side || y1 < k0y || y0 > k0y + side) return id;
  const bands = [
    { x: 0, y: 0, w: W, h: y0 }, { x: 0, y: y1, w: W, h: H - y1 },
    { x: 0, y: 0, w: x0, h: H }, { x: x1, y: 0, w: W - x1, h: H },
  ];
  const b = bands.reduce((a, c) => (Math.min(c.w, c.h) > Math.min(a.w, a.h) ? c : a));
  const s = Math.min(1, (Math.min(b.w, b.h) * 0.9) / side);
  if (s < 0.5) return id; // too tight to move: stay put and let the scrim do its work
  return { s, tx: b.x + b.w / 2 - (W / 2) * s, ty: b.y + b.h / 2 - (H / 2) * s };
}

// ── The renderer ──────────────────────────────────────────────────────────

export function createRenderer(host, { W, H, register, scene, invalidate, advance }) {
  const st = stage(host, { W, H });
  let reg = register, colors = null, layer = null, layerKey = '', drawnTo = 0, dotsDrawn = 0;
  let epoch = -1, travel = 0, glow = null, baked = null, bakedKey = '', fit = { s: 1, tx: 0, ty: 0 }, fitKey = '';
  st.onresize = () => { layer = null; invalidate(); };

  const hair = () => (1.15 * W) / (st.canvas.clientWidth || W) / fit.s;
  const place = g => g.transform(fit.s, 0, 0, fit.s, fit.tx, fit.ty);
  function palette() {
    return (colors ??= readColors(host, {
      paper: 'var(--sg-paper, light-dark(#f1ede4, #151a2b))',
      ink: 'var(--sg-ink, light-dark(#1d2742, #ebe5d6))',
      soft: 'var(--sg-ink-soft, light-dark(#48526e, #bdb7a8))',
      flour: 'var(--sg-kolam-flour, #f6f0e4)',
      stone: 'var(--sg-kolam-stone, #b3563a)',
      mango: 'var(--sg-mango, #e4b24c)',
      kokum: 'var(--sg-kolam-pink, #d9457a)',
      paddy: 'var(--sg-paddy, #5b8b3b)',
      indigo: 'var(--sg-kolam-blue, #3f63c4)',
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }
  const isDark = () => palette().dark !== '#000000';

  // ── quiet: hairline ink ────────────────────────────────────────────────
  function tracePath(geo, upTo) {
    const p = new Path2D();
    let left = upTo;
    for (const l of geo.loops) {
      if (left <= 0) break;
      p.moveTo(l.pts[0][0], l.pts[0][1]);
      for (let i = 1; i < l.pts.length; i++) {
        if (l.cum[i] > left) { const [x, y] = pointAt({ loops: [l], length: l.length }, left); p.lineTo(x, y); break; }
        p.lineTo(l.pts[i][0], l.pts[i][1]);
      }
      left -= l.length;
    }
    return p;
  }
  function quiet(g, d) {
    const c = palette(), geo = d.geo, hw = hair();
    g.fillStyle = c.paper; g.fillRect(0, 0, W, H);
    g.save(); place(g);
    g.lineJoin = g.lineCap = 'round';
    if (d.drawn < 1) { // what is left to draw, as a faint pencil guide
      g.save(); g.globalAlpha = 0.28; g.strokeStyle = c.soft; g.lineWidth = hw * 0.8; g.setLineDash([hw * 2, hw * 4]);
      g.stroke(tracePath(geo, geo.length)); g.restore();
    }
    g.strokeStyle = c.ink; g.lineWidth = hw; g.stroke(tracePath(geo, d.drawnLength));
    g.fillStyle = c.soft;
    const dots = new Path2D(), r = Math.max(hw * 1.6, geo.cell * 0.035);
    for (const [x, y] of geo.dots) { dots.moveTo(x + r, y); dots.arc(x, y, r, 0, TAU); }
    g.fill(dots);
    if (d.tip) { g.fillStyle = c.ink; g.beginPath(); g.arc(d.tip[0], d.tip[1], hw * 2.4, 0, TAU); g.fill(); }
    g.restore();
  }

  // ── warm and playful: rice flour ───────────────────────────────────────
  // Flour is painted straight into pixels: an RGBA field at device resolution,
  // each grain composited 'over' by hand, flushed as a dirty rectangle. About
  // six times faster than Path2D or fillRect for a hundred thousand grains.
  let field = null;
  function makeField(w, h) {
    const img = new ImageData(w, h), px = img.data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    const k = () => st.px * fit.s;
    return {
      /** A grain at logical (x, y) of logical size s, opacity a, colour [r, g, b]. */
      stamp(x, y, s, a, [r, g, b]) {
        const m = k(), X = (fit.tx + x * fit.s) * st.px, Y = (fit.ty + y * fit.s) * st.px;
        let n = s * m;
        if (n < 1) { a *= n * n * 1.6; n = 1; } // below a pixel, coverage becomes opacity
        n = Math.round(n);
        const xa = Math.round(X - n / 2), ya = Math.round(Y - n / 2);
        for (let yy = Math.max(0, ya); yy < Math.min(h, ya + n); yy++) for (let xx = Math.max(0, xa); xx < Math.min(w, xa + n); xx++) {
          const o = (yy * w + xx) * 4, da = px[o + 3] / 255, keep = da * (1 - a), oa = a + keep;
          px[o] = (r * a + px[o] * keep) / oa; px[o + 1] = (g * a + px[o + 1] * keep) / oa; px[o + 2] = (b * a + px[o + 2] * keep) / oa;
          px[o + 3] = oa * 255;
        }
        if (xa < x0) x0 = Math.max(0, xa); if (ya < y0) y0 = Math.max(0, ya);
        if (xa + n > x1) x1 = Math.min(w, xa + n); if (ya + n > y1) y1 = Math.min(h, ya + n);
      },
      flush(g) {
        if (x1 > x0 && y1 > y0) g.putImageData(img, 0, 0, x0, y0, x1 - x0, y1 - y0);
        x0 = w; y0 = h; x1 = y1 = -1;
      },
    };
  }

  const RANGOLI = ['mango', 'kokum', 'paddy', 'indigo'];
  const rgb = hex => hexToRgb(hex);
  function sprinkleDots(d, from, to) {
    const geo = d.geo, c = palette(), rad = geo.lineW * 0.8, mound = geo.cell * 0.26, white = rgb(c.flour);
    const heap = (r, x, y, R, n, lo, col, soft) => {
      for (let j = 0; j < n; j++) {
        const a = r() * TAU, dd = Math.min(1.25, Math.abs(r.gauss()) * 0.55) * R;
        field.stamp(x + Math.cos(a) * dd, y + Math.sin(a) * dd, r.range(0.8, 2.1), r.range(lo, 1) * soft, col);
      }
    };
    for (let i = from; i < to; i++) {
      const [x, y] = geo.dots[i], r = rng(`dot:${geo.seed}:${i}`);
      // rangoli: a mound of coloured powder under each dot, one colour per ring from the centre
      if (d.palette === 'rangoli') heap(r, x, y, mound, Math.round(mound * mound * 1.6), 0.5, rgb(c[RANGOLI[geo.rings[i] % RANGOLI.length]]), 0.95);
      heap(r, x, y, rad, 170, 0.55, white, 1);
    }
  }
  function sprinkle(d, from, to, q) {
    const geo = d.geo, seedHash = hashSeed(`${geo.seed}`), white = rgb(palette().flour);
    for (let i = from; i < to; i++) {
      const dist = i * STEP, [x, y, ang] = pointAt(geo, dist), r = stream(Math.imul(seedHash, 2654435761) ^ Math.imul(i + 1, 0x85ebca6b));
      const flow = 0.62 + 0.38 * (0.5 + N(dist * 0.0045, geo.seed * 1.7, 3.3));
      const count = Math.round((5 + 5 * r()) * flow * (0.55 + 0.45 * q));
      const nx = -Math.sin(ang), ny = Math.cos(ang), ca = Math.cos(ang), sa = Math.sin(ang);
      for (let j = 0; j < count; j++) {
        let off = r.gauss() * geo.lineW * 0.28;
        if (r() < 0.05) off *= 2.6;
        const along = (r() - 0.5) * STEP * 1.5;
        field.stamp(x + nx * off + ca * along, y + ny * off + sa * along, 0.7 + 1.2 * r(), (0.45 + 0.55 * r()) * (0.7 + 0.3 * flow), white);
      }
    }
  }
  function flour(d, q) {
    const key = `${d.geo.key}|${d.palette}|${st.canvas.width}|${fitKey}`, target = Math.floor(d.drawnLength / STEP);
    if (!layer || key !== layerKey || target < drawnTo || d.dots < dotsDrawn) {
      layer = document.createElement('canvas');
      layer.width = st.canvas.width; layer.height = st.canvas.height;
      field = makeField(layer.width, layer.height);
      layerKey = key; drawnTo = 0; dotsDrawn = 0;
    }
    if (d.dots > dotsDrawn) { sprinkleDots(d, dotsDrawn, d.dots); dotsDrawn = d.dots; }
    if (target > drawnTo) { sprinkle(d, drawnTo, target, q); drawnTo = target; }
    field.flush(layer.getContext('2d'));
    return layer;
  }

  /** 0 inside a calm rect (slotted text), 1 well clear of every one. */
  function calmAt(calm, x, y) {
    let k = 1;
    for (const r of calm) {
      const dx = Math.max(r.x - x, 0, x - r.x - r.w), dy = Math.max(r.y - y, 0, y - r.y - r.h);
      k = Math.min(k, smoothstep(0, 90, Math.hypot(dx, dy)));
    }
    return k;
  }

  function breathe(g, d, frame) {
    glow ??= (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const gg = c.getContext('2d'), gr = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,248,232,0.9)'); gr.addColorStop(0.4, 'rgba(255,240,215,0.35)'); gr.addColorStop(1, 'rgba(255,240,215,0)');
      gg.fillStyle = gr; gg.fillRect(0, 0, 64, 64); return c;
    })();
    const geo = d.geo, fade = smoothstep(0, 2.5, d.since), size = geo.lineW * 5.5;
    g.save(); g.globalCompositeOperation = 'lighter';
    geo.dots.forEach(([x, y], i) => {
      // a slow wave of light from the centre outwards, one breath every 7 seconds
      const w = 0.5 - 0.5 * Math.cos((d.since / 7) * TAU - geo.rings[i] * 0.9);
      const a = 0.26 * fade * w * (0.15 + 0.85 * calmAt(frame.calm, fit.tx + x * fit.s, fit.ty + y * fit.s));
      if (a < 0.01) return;
      g.globalAlpha = a; g.drawImage(glow, x - size / 2, y - size / 2, size, size);
    });
    g.restore();
  }

  function flourFrame(g, d, frame) {
    const c = palette(), dark = isDark();
    const floor = st.cached(`${reg}|${dark}`, gg => {
      reg === 'playful' ? laterite(gg, W, H, c.stone) : redOxide(gg, W, H);
      if (dark) dusk(gg, W, H);
    });
    const fl = flour(d, frame.quality);
    if (d.drawn >= 1 && d.dots >= d.geo.dots.length) {
      // finished: floor and flour become one layer, so a breathing frame is one blit
      const bk = `${reg}|${dark}|${layerKey}`;
      if (!baked || bakedKey !== bk || baked.width !== st.canvas.width) {
        baked = st.layer(gg => { gg.setTransform(1, 0, 0, 1, 0, 0); gg.drawImage(floor, 0, 0); gg.drawImage(fl, 0, 0); });
        bakedKey = bk;
      }
      st.blit(baked);
    } else { st.blit(floor); st.blit(fl); }
    g.save(); place(g);
    if (d.tip && !frame.still) { // the pinch of flour at the tip
      const [x, y] = d.tip, R = d.geo.lineW * 1.5, a = 0.55 * (0.3 + 0.7 * calmAt(frame.calm, fit.tx + x * fit.s, fit.ty + y * fit.s));
      const gl = g.createRadialGradient(x, y, 0, x, y, R);
      gl.addColorStop(0, `rgba(255,248,236,${a})`); gl.addColorStop(1, 'rgba(255,248,236,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
    }
    if (d.since >= 0 && !frame.still && frame.quality > 0.3) breathe(g, d, frame);
    for (const a of d.ants) ant(g, a.x, a.y, a.heading, a.t, 2.1, a.carrying, c.flour);
    g.restore();
    const p = frame.pointer;
    if (p.keyboard && p.inside && host.matches(':focus-visible')) { // where the keyboard hand is
      g.save(); g.lineWidth = 3; g.strokeStyle = 'rgba(20,8,4,0.6)';
      g.beginPath(); g.arc(p.x, p.y, 16, 0, TAU); g.stroke();
      g.lineWidth = 1.6; g.strokeStyle = c.flour; g.stroke(); g.restore();
    }
  }

  /** Playful: the hand pours faster. Pointer travel over the floor moves the drawing on. */
  function pour(d, frame) {
    const p = frame.pointer;
    if (frame.epoch !== epoch) { epoch = frame.epoch; travel = p.travel; }
    const moved = p.travel - travel;
    travel = p.travel;
    if (reg !== 'playful' || frame.still || d.settled || d.drawn >= 1 || !p.inside || moved <= 0) return;
    advance(((moved * (p.down ? 2.4 : 1.2)) / d.speed) * (d.drawn > 0 ? 1 : 0.5));
  }

  return {
    render(d, frame) {
      const g = st.begin();
      const fk = frame.calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
      if (fk !== fitKey) { fitKey = fk; fit = fitAround(frame.calm, W, H); }
      pour(d, frame);
      reg === 'quiet' ? quiet(g, d) : flourFrame(g, d, frame);
    },
    setRegister(r) { reg = r; layer = null; invalidate(); },
    restyle() { colors = null; layer = baked = null; st.memo.clear(); invalidate(); },
    resize() { layer = null; invalidate(); },
    /** Click, Enter or Space in playful: draw it again. */
    activate() { scene?.replay(); },
    destroy() { st.destroy(); layer = baked = field = null; },
  };
}
