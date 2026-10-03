// Neel: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the khadi cloth with its warp, weft and slubs, the carved
// faces stamped as images, the starved ink, the multiply print layer and the
// wooden block with its shadow, grain, smudges and handle are the plate's own
// code. The port adds: the registers, a printer driven by the scene's clock
// (printerAt in model.js), progress, the still printed in slices behind a
// ready promise, presses under the hand in playful, the calm zone, the table
// by lamplight on dark pages, the governor and a frame skip at rest.

import { rng, makeNoise, N, clamp, lerp, ease, TAU, paper, grainPattern, toPath, stage } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, BLOCK, TEMP, printerAt, visibleSeq, pressAt } from './model.js';

// ── Side-effect edge ──────────────────────────────────────────────────────

let masks = null;
/** Low-res noise masks: where the block ran dry. Drawn with destination-out. */
function starveMasks() {
  if (masks) return masks;
  masks = [0, 1, 2, 3].map(v => {
    const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S), nz = makeNoise(300 + v);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = nz.fbm(x * 0.075, y * 0.075, 0.3, 3), i = (y * S + x) * 4;
      img.data[i + 3] = 255 * clamp((n - 0.02) / 0.1);
    }
    g.putImageData(img, 0, 0);
    return c;
  });
  return masks;
}

function cloth(g, base, seed) {
  paper(g, W, H, { base, seed, mottle: 0.05, grain: 0.05, fibers: 0, vignette: 0.1, speck: '#4a3b28' });
  const r = rng(seed + 5), gap = 2.6, buckets = 5;
  g.save();
  g.lineCap = 'butt';
  for (const dir of [0, 1]) {
    const paths = Array.from({ length: buckets }, () => new Path2D());
    const span = dir ? W : H, run2 = dir ? H : W;
    for (let a = 0; a < span; a += gap * (1 + (r() - 0.5) * 0.3)) {
      let b = 0;
      while (b < run2) {
        const len = r.range(22, 60), v = 0.5 + N(b * 0.01, a * 0.35, dir * 9) * 1.2;
        const k = clamp(Math.floor(v * buckets), 0, buckets - 1);
        if (dir) { paths[k].moveTo(a, b); paths[k].lineTo(a, b + len); } else { paths[k].moveTo(b, a); paths[k].lineTo(b + len, a); }
        b += len;
      }
    }
    paths.forEach((p, k) => { g.strokeStyle = `rgba(92,72,44,${0.035 + k * 0.022})`; g.lineWidth = 0.6; g.stroke(p); });
    const hi = new Path2D();
    for (let a = gap / 2; a < span; a += gap * 2.1) { if (dir) { hi.moveTo(a, 0); hi.lineTo(a, H); } else { hi.moveTo(0, a); hi.lineTo(W, a); } }
    g.strokeStyle = 'rgba(255,253,246,0.18)'; g.lineWidth = 0.5; g.stroke(hi);
  }
  // slubs: the thick, uneven threads that make khadi khadi
  g.lineCap = 'round';
  for (let i = 0; i < 240; i++) {
    const x = r() * W, y = r() * H, len = r.range(10, 60), horiz = r() < 0.8;
    g.strokeStyle = r() < 0.75 ? `rgba(120,96,62,${r.range(0.06, 0.12)})` : `rgba(255,252,242,${r.range(0.18, 0.32)})`;
    g.lineWidth = r.range(0.9, 1.9);
    g.beginPath();
    if (horiz) { g.moveTo(x, y); g.quadraticCurveTo(x + len / 2, y + r.range(-0.6, 0.6), x + len, y); }
    else { g.moveTo(x, y); g.quadraticCurveTo(x + r.range(-0.6, 0.6), y + len / 2, x, y + len); }
    g.stroke();
  }
  g.restore();
}

/** Paint one horizontal band of the cloth. cloth() is fully seeded, so every
 *  band agrees with its neighbours; only the clipped part is rasterised. */
function clothBand(g, base, i, bands) {
  g.save();
  g.beginPath(); g.rect(0, (i * H) / bands, W, H / bands + 1); g.clip();
  cloth(g, base, 11);
  g.restore();
}

function drawItems(tg, motif, pal, pass) {
  tg.lineJoin = 'round'; tg.lineCap = 'round';
  for (const it of motif.items) {
    if (it.shape) {
      const path = toPath(it.shape, true);
      tg.globalCompositeOperation = 'destination-out';
      tg.fillStyle = '#000'; tg.fill(path);
      tg.globalCompositeOperation = 'source-over';
      if (pass === 0) {
        if (it.kind === 'tint') { tg.globalAlpha = 0.3; tg.fillStyle = pal.a; tg.fill(path); }
        tg.strokeStyle = pal.a;
        tg.globalAlpha = 0.18; tg.lineWidth = 4.6; tg.stroke(path);
        tg.globalAlpha = 1; tg.lineWidth = 2.7; tg.stroke(path);
      } else if (it.kind === 'fill') {
        tg.globalAlpha = 0.92; tg.fillStyle = pal.b; tg.fill(path); tg.globalAlpha = 1;
      }
    } else if (pass === 0 && it.line) {
      tg.strokeStyle = pal.a;
      tg.beginPath(); it.line.forEach(([x, y], i) => (i ? tg.lineTo(x, y) : tg.moveTo(x, y)));
      tg.globalAlpha = 0.18; tg.lineWidth = it.w * 1.3 + 2; tg.stroke();
      tg.globalAlpha = 1; tg.lineWidth = it.w * 1.3; tg.stroke();
    } else if (pass === 0 && it.dot) {
      const [x, y, rad] = it.dot;
      tg.fillStyle = pal.a; tg.beginPath(); tg.arc(x, y, rad, 0, TAU); tg.fill();
    }
  }
  tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over';
}

function drawBlock(g, px, x, y, h, rot, inkColor, seed) {
  const s = 1 + 0.07 * h, B = BLOCK * s, R = 10 * s, side = 7 * s;
  g.save();
  g.translate(x - 6 * h, y - 10 * h); g.rotate(rot);
  const rr = (x0, y0, w, hh, rad) => { g.beginPath(); g.roundRect(x0, y0, w, hh, rad); };
  // the block's shadow on the cloth: tight when pressed, soft and far when lifted
  g.save();
  g.shadowColor = `rgba(48,30,14,${0.34 - 0.14 * h})`;
  g.shadowBlur = (3 + 26 * h) * px; g.shadowOffsetX = (2 + 18 * h) * px; g.shadowOffsetY = (3 + 24 * h) * px;
  g.fillStyle = '#6b4526'; rr(-B / 2, -B / 2 + side, B, B, R); g.fill();
  g.restore();
  // carved face peeking at the lower edge, wet with ink
  g.fillStyle = inkColor; g.globalAlpha = 0.9; rr(-B / 2 + 2, -B / 2 + side + 1.5, B - 4, B, R); g.fill();
  g.globalAlpha = 1;
  // the side of the block
  g.fillStyle = '#7a4f2c'; rr(-B / 2, -B / 2 + side * 0.55, B, B, R); g.fill();
  // the top, with grain
  const top = g.createLinearGradient(-B / 2, -B / 2, B / 2, B / 2);
  top.addColorStop(0, '#c4915f'); top.addColorStop(1, '#9b6a3f');
  g.fillStyle = top; rr(-B / 2, -B / 2, B, B, R); g.fill();
  g.save(); g.clip();
  g.strokeStyle = 'rgba(92,56,28,0.22)'; g.lineWidth = 0.9;
  for (let i = 0; i < 16; i++) {
    const yy = -B / 2 + (i + 0.5) * (B / 16);
    g.beginPath();
    for (let xx = -B / 2; xx <= B / 2; xx += 6) {
      const w = Math.sin(xx * 0.03 + i * 0.9 + seed) * 2.2 + N(xx * 0.02, i * 0.5, seed) * 3;
      xx === -B / 2 ? g.moveTo(xx, yy + w) : g.lineTo(xx, yy + w);
    }
    g.stroke();
  }
  // ink smudges near the edges
  const r = rng(`smudge:${seed}`);
  g.fillStyle = inkColor;
  for (let i = 0; i < 9; i++) {
    const e = r.int(0, 3), t = r.range(-0.45, 0.45) * B;
    const [sx, sy] = [[t, -B / 2 + 2], [B / 2 - 2, t], [t, B / 2 - 2], [-B / 2 + 2, t]][e];
    g.globalAlpha = r.range(0.15, 0.4); g.beginPath(); g.ellipse(sx, sy, r.range(2, 6), r.range(1, 2.5), r() * TAU, 0, TAU); g.fill();
  }
  g.restore();
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(70,42,20,0.55)'; g.lineWidth = 1; rr(-B / 2, -B / 2, B, B, R); g.stroke();
  // turned handle
  const k = g.createRadialGradient(-6 * s, -7 * s, 2, 0, 0, 24 * s);
  k.addColorStop(0, '#d9a877'); k.addColorStop(0.6, '#a8713f'); k.addColorStop(1, '#6f4424');
  g.fillStyle = 'rgba(60,34,14,0.3)'; g.beginPath(); g.arc(4 * s, 5 * s, 24 * s, 0, TAU); g.fill();
  g.fillStyle = k; g.beginPath(); g.arc(0, 0, 23 * s, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(70,42,20,0.5)'; g.beginPath(); g.arc(0, 0, 23 * s, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,230,200,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 14 * s, 3.6, 5.2); g.stroke();
  g.restore();
}

// ── The renderer ──────────────────────────────────────────────────────────

const BANDS = 4, SS = 2;
/** How many impressions a still lays down per frame, so no frame stalls. */
const STILL_SLICE = 24;

export function createRenderer(host, { invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  // Canvas records paint commands and rasterises them lazily; drawing into a
  // 1x1 scratch forces that work into the frame that asked for it.
  const scratch = document.createElement('canvas').getContext('2d');
  const flush = c => scratch.drawImage(c, 0, 0, 1, 1);
  let colors = null, faces = [], facesKey = '', cloths = new Map(), clothsPx = 0, clothShown = 0, lastT = null;
  let seedNow = 1, temp = null, print = null, printKey = '', printed = 0, presses = [], epoch = -1, lastKey = '', seqKey = '', seq = null;
  let resolveReady = null;
  const ready = new Promise(r => { resolveReady = r; });
  st.onresize = () => { lastKey = ''; invalidate(); };

  function palette() {
    return (colors ??= readColors(host, { dark: 'light-dark(#000000, #ffffff)' }));
  }

  /** The carved face for one pass, drawn once per seed at 2x and then stamped
   *  as an image, so an impression costs one rotated drawImage. */
  function face(data, pass) {
    const key = `${st.px}|${data.seed}`;
    if (facesKey !== key) { faces = []; facesKey = key; }
    if (!faces[pass]) {
      const c = document.createElement('canvas');
      c.width = c.height = Math.ceil(TEMP * st.px * SS);
      const g = c.getContext('2d');
      g.setTransform(st.px * SS, 0, 0, st.px * SS, 0, 0);
      g.translate(TEMP / 2, TEMP / 2);
      drawItems(g, data.motif, data.palette, pass);
      faces[pass] = c;
    }
    return faces[pass];
  }

  /** The cloth layer for a colour, built one band per call until done. */
  function clothLayer(base, all = false) {
    if (clothsPx !== st.px) { cloths = new Map(); clothsPx = st.px; }
    let L = cloths.get(base);
    if (!L) {
      const c = document.createElement('canvas'); c.width = st.canvas.width; c.height = st.canvas.height;
      const g = c.getContext('2d'); g.setTransform(st.px, 0, 0, st.px, 0, 0);
      L = { c, g, bands: 0 };
      cloths.set(base, L);
    }
    while (L.bands < BANDS) { clothBand(L.g, base, L.bands++, BANDS); flush(L.c); if (!all) break; }
    L.done = L.bands >= BANDS;
    return L;
  }

  function impress(data, s, detail) {
    if (!temp || temp.width !== Math.ceil(TEMP * st.px)) { temp = document.createElement('canvas'); temp.width = temp.height = Math.ceil(TEMP * st.px); }
    const tg = temp.getContext('2d'), px = st.px;
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.globalCompositeOperation = 'source-over'; tg.globalAlpha = 1;
    tg.clearRect(0, 0, temp.width, temp.height);
    tg.setTransform(px, 0, 0, px, 0, 0);
    tg.translate(TEMP / 2, TEMP / 2); tg.rotate(s.rot);
    tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'low';
    tg.drawImage(face(data, s.pass), -TEMP / 2, -TEMP / 2, TEMP, TEMP);
    // ink starvation: soft patches, then fibres that did not take ink
    const starve = 0.35 + (1 - s.load) * 1.3;
    tg.globalCompositeOperation = 'destination-out';
    tg.globalAlpha = clamp(starve * 0.85);
    const m = starveMasks()[s.variant], big = TEMP * 1.5;
    tg.drawImage(m, -TEMP / 2 - s.mo[0] * (big - TEMP), -TEMP / 2 - s.mo[1] * (big - TEMP), big, big);
    tg.fillStyle = grainPattern(tg, '#000000', { lo: 0, hi: 0.5 });
    tg.globalAlpha = clamp(0.45 + starve * 0.55);
    tg.fillRect(-TEMP / 2, -TEMP / 2, TEMP, TEMP);
    if (detail >= 0.5) { tg.globalAlpha = clamp(starve * 0.5); tg.fillRect(-TEMP / 2, -TEMP / 2, TEMP, TEMP); }
    tg.globalCompositeOperation = 'source-over'; tg.globalAlpha = 1;

    const pg = print.getContext('2d');
    pg.save();
    pg.globalCompositeOperation = 'multiply';
    pg.globalAlpha = 0.9 + 0.1 * s.load;
    pg.drawImage(temp, s.x - TEMP / 2, s.y - TEMP / 2, TEMP, TEMP);
    pg.restore();
  }

  function render(data, frame) {
    const calm = frame.calm || [], still = frame.still || data.look.pace === 0, q = frame.quality ?? 1;
    const dark = palette().dark !== '#000000';
    seedNow = data.seed;
    if (frame.epoch !== epoch) { epoch = frame.epoch; presses = []; printKey = ''; }
    // the impressions that print at all: none under the page's words
    const calmKey = calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
    const sk = `${data.seed}|${calmKey}`;
    if (sk !== seqKey) { seqKey = sk; seq = visibleSeq(data.seq, data.motif.bounds, calm); printKey = ''; }
    // how many are down: all of them in a still, the progress share, or the printer's clock
    const P = still && !data.held ? printerAt(seq, Infinity) : data.held ? { applied: Math.round(data.progress * seq.length), block: null, done: true } : printerAt(seq, data.printerTime);
    const want = P.applied;
    // the print layer: rebuilt from nothing when the size, seed, words or epoch change, or time runs back
    const pk = `${st.canvas.width}x${st.canvas.height}|${seqKey}|${epoch}`;
    if (pk !== printKey || want < printed) {
      printKey = pk; print = st.layer(); printed = 0; lastKey = '';
      for (const s of presses) s.down = false;
    }
    const slice = still || data.held ? STILL_SLICE : 4;
    const upTo = Math.min(want, printed + slice);
    while (printed < upTo) impress(data, seq[printed++], q);
    for (const s of presses) if (!s.down) { impress(data, s, q); s.down = true; }
    const behind = printed < want;
    if (behind) invalidate();

    const cl = clothLayer(data.palette.cloth, still || data.held);
    if (!cl.done) invalidate();
    const t = frame.time, dt = lastT === null ? 0 : Math.max(0, t - lastT); lastT = t;
    clothShown = !cl.done ? 0 : still || data.held || !dt ? 1 : Math.min(1, clothShown + dt / 0.5);
    if (clothShown < 1 && cl.done) invalidate();

    const b = still || data.held ? null : P.block;
    const key = `${pk}|${printed}|${presses.length}|${b ? `${b.x.toFixed(1)},${b.y.toFixed(1)},${b.h.toFixed(3)}` : '-'}|${cl.bands}|${clothShown.toFixed(2)}|${dark}`;
    if (key === lastKey) return;
    lastKey = key;

    const g = st.begin();
    if (clothShown < 1) { g.fillStyle = data.palette.cloth; g.fillRect(0, 0, W, H); }
    if (clothShown > 0) { g.save(); g.globalAlpha = ease.inOutSine(clothShown); st.blit(cl.c); g.restore(); }
    g.save(); g.globalCompositeOperation = 'multiply'; st.blit(print); g.restore();
    if (b && b.x > -BLOCK && b.x < W + BLOCK) {
      drawBlock(g, q < 0.5 ? 0 : st.px, b.x, b.y, b.h, b.rot || 0, b.pass ? data.palette.b : data.palette.a, data.seed + (b.pass ? 0.5 : 0));
    }
    // the table by lamplight on a dark page: a warm pool in the middle, the corners in shadow, never inverted
    if (dark) {
      g.save(); g.globalCompositeOperation = 'multiply';
      const lamp = g.createRadialGradient(W * 0.5, H * 0.42, 60, W * 0.5, H * 0.5, W * 0.72);
      lamp.addColorStop(0, 'rgba(236,200,150,1)'); lamp.addColorStop(1, 'rgba(70,60,80,1)');
      g.fillStyle = lamp; g.fillRect(0, 0, W, H); g.restore();
    }
    host.dataset.printed = `${printed}/${seq.length}`;
    if (resolveReady && cl.done && !behind) { resolveReady(); resolveReady = null; }
  }

  return {
    render,
    ready,
    setRegister() { lastKey = ''; },
    restyle() { colors = null; lastKey = ''; },
    /** Enter, Space or a click in playful: press both blocks where the hand is, and they print at once. */
    activate(p) {
      if (!p) return;
      presses.push(...pressAt(seedNow, presses.length, p.x, p.y).map(s => ({ ...s, down: false })));
      lastKey = ''; invalidate();
    },
    destroy() { st.destroy(); },
  };
}
