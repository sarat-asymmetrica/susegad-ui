// Chiro: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the pencil work over the stone, the plaster remnant, the red
// earth, the frond's shadow, the colouring pass (pits, crust, clay, wetness,
// moss, bleach), the grass, the rain and the red dust are the plate's own
// code. What the port adds: the registers (quiet is the plate's still, warm an
// easier year, playful the hand on the wall), the build in time slices behind
// a ready promise, the still simulated in slices too, the calm zone (no rain
// or dust over the page's words), night for the dark theme, the keyboard hand,
// and a redraw at most 30 times a second.

import { stage, ink, hatch, makeNoise, rng, clamp, lerp, smoothstep, ease, N, grainPattern, blob, toPath, mix } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import {
  W, H, GW, GH, NC, GROUND, STONE_RATE, STONE_MAX, STILL_T, INK, PIT, CLAY, CRUST, groundY,
  buildWall, rasterWall, allocFields, fieldRows, gsStep, reaction, seedStone, mossTimes, seasons, stampHand,
} from './model.js';

/** Pencil work over the stone, painted once per size: tool marks, shading,
 *  outlines, the plaster remnant and the ground. Yields between steps. */
function* paintOverlay(g, wall) {
  for (const b of wall.blocks) {
    const path = toPath(b.outline, true), bounds = { x: b.x, y: b.y, w: b.w, h: b.h };
    const r = rng(`marks:${wall.seed}:${b.id}`);
    g.save(); g.clip(path);
    if (b.marks === 'saw') {
      // a circular saw leaves long faint arcs across the face
      const R = r.range(420, 700), cx = b.x + b.w * r.range(0.2, 0.8), cy = b.y + b.h + R * r.range(0.55, 0.85);
      g.strokeStyle = 'rgba(58,20,12,0.2)'; g.lineWidth = 1.2;
      for (let k = 0; k < 20; k++) {
        const rr = R - k * r.range(7, 12);
        if (rr < R - b.h * 1.6) break;
        g.beginPath(); g.arc(cx, cy, rr, Math.PI * 1.25, Math.PI * 1.75); g.stroke();
      }
    } else if (b.marks === 'pick') {
      hatch(g, path, { bounds, angle: -1.1 + b.markAngle, spacing: 10, seg: [8, 20], gap: 1.2, width: 1.4, color: '#3a150d', alpha: 0.22, wobble: 1.5, seed: b.id * 3 + 1 });
    }
    g.restore();
    // form shading: the weathered face turns away at the bottom and right
    hatch(g, path, {
      bounds, angle: -0.95, spacing: 3.8, seg: [6, 16], width: 0.8, color: '#43170e', alpha: 0.26, seed: b.id * 7,
      density: (x, y) => 0.12 + 0.75 * smoothstep(b.y + b.h * 0.45, b.y + b.h, y) + 0.45 * smoothstep(b.x + b.w * 0.72, b.x + b.w, x),
    });
    // a pale lip where the top arris catches the light
    const top = b.outline.filter(p => p[1] < b.y + 10 && p[0] > b.x + 12 && p[0] < b.x + b.w - 12).map(p => [p[0], p[1] + 2.2]);
    if (top.length > 4) ink(g, top, { width: 1.6, color: '#f0c9a0', alpha: 0.28, jitter: 0.5, seed: b.id + 50, taper: 20 });
    ink(g, b.outline, { closed: true, width: 1.3, color: INK, alpha: 0.6, jitter: 0.7, freq: 0.05, seed: b.id * 7 + 3 });
    yield;
  }
  yield;

  // the plaster remnant: lime over the stone, cracked, with a shadow under its edge
  const pl = toPath(wall.plaster, true);
  g.save(); g.translate(2.5, 3.5); g.fillStyle = 'rgba(40,14,8,0.35)'; g.fill(pl); g.restore();
  g.save();
  g.fillStyle = '#e4ddca'; g.fill(pl);
  g.clip(pl);
  g.globalAlpha = 0.5; g.fillStyle = grainPattern(g, '#9c8f76', { lo: 0.1, hi: 0.9 }); g.fill(pl); g.globalAlpha = 1;
  const pr = rng(`plaster:${wall.seed}`), pb = wall.plaster.reduce((m, q) => [Math.min(m[0], q[0]), Math.min(m[1], q[1]), Math.max(m[2], q[0]), Math.max(m[3], q[1])], [1e9, 1e9, -1e9, -1e9]);
  const lg = g.createLinearGradient(0, pb[1], 0, pb[3]);
  lg.addColorStop(0, 'rgba(255,250,236,0.35)'); lg.addColorStop(1, 'rgba(120,100,80,0.18)');
  g.fillStyle = lg; g.fill(pl);
  for (let k = 0; k < 9; k++) {
    const x = pr.range(pb[0], pb[2]), y = pr.range(pb[1], pb[3]), rad = pr.range(14, 46);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, pr.pick(['rgba(110,122,104,0.22)', 'rgba(168,120,80,0.2)', 'rgba(80,76,70,0.16)'])); gr.addColorStop(1, 'rgba(120,120,110,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // the broken edge shows the thickness of the lime coat
  ink(g, wall.plaster, { closed: true, width: 3.2, color: '#fbf5e8', alpha: 0.55, jitter: 0.6, seed: 87 });
  hatch(g, pl, { angle: -0.95, spacing: 4.5, seg: [5, 14], width: 0.7, color: '#6f6552', alpha: 0.2, seed: 77 });
  g.restore();
  for (const [k, c] of wall.cracks.entries()) ink(g, c, { width: 0.8, color: '#4d4436', alpha: 0.55, jitter: 0.4, seed: 90 + k, taper: 8 });
  ink(g, wall.plaster, { closed: true, width: 1.1, color: '#5a4a3a', alpha: 0.6, jitter: 0.5, seed: 88 });
  yield;

  // red earth at the foot of the wall, and the damp line just above it
  const gp = [...wall.ground, [W + 10, H + 10], [-10, H + 10]];
  const sh = g.createLinearGradient(0, GROUND - 40, 0, GROUND + 4);
  sh.addColorStop(0, 'rgba(40,14,8,0)'); sh.addColorStop(1, 'rgba(40,14,8,0.32)');
  g.fillStyle = sh; g.fillRect(0, GROUND - 40, W, 50);
  const eg = g.createLinearGradient(0, GROUND - 10, 0, H);
  eg.addColorStop(0, '#7e3a22'); eg.addColorStop(1, '#5c2716');
  g.fillStyle = eg; g.beginPath(); gp.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
  hatch(g, gp, { angle: -0.2, spacing: 3.2, seg: [4, 12], gap: 0.8, width: 0.8, color: '#3a150b', alpha: 0.3, seed: 12 });
  const r = rng(`ground:${wall.seed}`);
  for (let k = 0; k < 70; k++) {
    const x = r() * W, y = GROUND + 12 + Math.pow(r(), 0.8) * (H - GROUND - 14), s = r.range(2, 7);
    const pts = blob(x, y, s, { seed: k * 1.7, wobble: 0.3, squash: r.range(0.5, 0.8), n: 14 });
    g.fillStyle = mix('#a3502f', '#c88a55', r() * 0.6); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.fill();
    ink(g, pts, { closed: true, width: 0.6, color: '#2d0f07', alpha: 0.5, jitter: 0.2, seed: k });
  }
  ink(g, wall.ground, { width: 1.4, color: '#2d0f07', alpha: 0.55, jitter: 0.8, seed: 5, taper: 0 });
  yield;

  // one sheet of grain over everything ties the pencil and the pixels together
  g.globalAlpha = 0.1; g.fillStyle = grainPattern(g, '#2b140c', { lo: 0, hi: 0.9 }); g.fillRect(0, 0, W, H); g.globalAlpha = 1;
}

/** The shadow of a coconut frond, drawn small so stretching it softens it. */
function frondSprite() {
  const c = document.createElement('canvas'); c.width = 240; c.height = 120;
  const g = c.getContext('2d'), s = 240 / 1000;
  g.scale(s, s);
  g.strokeStyle = 'rgb(96,62,88)'; g.fillStyle = 'rgb(96,62,88)'; g.lineCap = 'round';
  const rib = u => [u * 950, 60 + Math.pow(u, 1.6) * 330];
  g.lineWidth = 16; g.beginPath(); for (let u = 0; u <= 1.001; u += 0.05) { const [x, y] = rib(u); u ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.lineWidth = 14;
  for (let u = 0.06; u < 0.98; u += 0.035) {
    const [x, y] = rib(u), [x2, y2] = rib(u + 0.01), a = Math.atan2(y2 - y, x2 - x), L = 210 * (1 - u * 0.6);
    for (const side of [-1, 1]) {
      const b = a + side * 0.95 + 0.25;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(b) * L * 0.6, y + Math.sin(b) * L * 0.6, x + Math.cos(b + side * 0.25) * L + 20, y + Math.sin(b + side * 0.25) * L + L * 0.35); g.stroke();
    }
  }
  return c;
}


// ── The renderer ──────────────────────────────────────────────────────────

const inCalm = (x, y, calm, pad = 30) => calm.some(r => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);

export function createRenderer(host, { invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const buf = mk(GW, GH), bufG = buf.getContext('2d'), img = bufG.createImageData(GW, GH), data = img.data;
  const damp = new Float32Array(NC), handNz = makeNoise('hand');
  const stone = reaction();
  let core = null, overlay = null, sprite = null, groundPath = null, plasterPath = null, colors = null;
  let builder = null, built = false, readyAt = -Infinity, sizeKey = '', start = null, stillDone = false;
  let stoneSteps = 0, mossCycle = -1, dampOn = false, epoch = -1, lastKey = '', lastP = null, wasDown = false, dustN = 0, lastT = 0, prevX = null, prevY = null;
  const dust = [];
  let resolveReady = null;
  const ready = new Promise(r => { resolveReady = r; });
  st.onresize = () => { lastKey = ''; invalidate(); };

  function palette() {
    return (colors ??= readColors(host, { dark: 'light-dark(#000000, #ffffff)' }));
  }

  function* buildCore(seed) {
    const wall = buildWall(seed);
    yield;
    const grid = rasterWall(wall);
    yield;
    const fl = allocFields();
    for (let j = 0; j < GH; j += 2) { fieldRows(wall, grid, fl, j, j + 2); yield; }
    seedStone(stone, wall, grid, fl.F);
    core = { seed, wall, grid, fl };
    groundPath = toPath([...wall.ground, [W + 10, H + 10], [-10, H + 10]], true);
    plasterPath = toPath(wall.plaster, true);
    stoneSteps = 0; mossCycle = -1; damp.fill(0); dampOn = false; dust.length = 0; start = null; stillDone = false;
    yield;
  }
  function* warmup(seed) {
    if (!core || core.seed !== seed) yield* buildCore(seed);
    const L = st.layer();
    for (const _ of paintOverlay(L.getContext('2d'), core.wall)) yield L;
    sprite = sprite || frondSprite();
    overlay = L;
  }

  // Canvas records draw calls and rasterises when read; a 1x1 read after each
  // slice makes the raster happen inside the slice, not in one later hitch.
  const tap = mk(1, 1), tapG = tap.getContext('2d');
  function build(budget) {
    const t0 = performance.now();
    while (!built && performance.now() - t0 < budget) {
      const s = builder.next();
      if (s.value) tapG.drawImage(s.value, 0, 0, 1, 1);
      if (s.done) built = true;
    }
    return built;
  }

  /** Step the reactions toward where the timeline says they should be. */
  function simulate(local, S, budget) {
    const t0 = performance.now();
    const stoneTarget = Math.min(STONE_MAX, Math.floor(local * STONE_RATE));
    while (stoneSteps < stoneTarget && performance.now() - t0 < budget) {
      gsStep(stone.U, stone.V, stone.U2, stone.V2, core.fl.F, core.fl.K, core.grid.onStone, core.fl.D, core.grid.stoneSpans);
      stone.swap(); stoneSteps++;
    }
    if (S.cycle >= 0 && S.cycle !== mossCycle && stoneSteps >= stoneTarget) { mossTimes(core.wall, core.grid, core.fl, stone.V); mossCycle = S.cycle; }
    return stoneSteps >= stoneTarget && (S.cycle < 0 || mossCycle === S.cycle);
  }

  /** Colour every cell from stone, wetness, dampness, moss and bleach: one ImageData. */
  function colour(S, dt) {
    const { mask } = core.grid, fl = core.fl, R = fl.R, Gc = fl.G, B = fl.B, V = stone.V;
    const { wf, df, mossVis, mossG, brown, bleach } = S;
    const decay = Math.exp(-dt / 3.2);
    let anyDamp = false;
    // three greens for the moss (crevice, cushion, tips), browning in the dry
    const MG = [[44, 58, 30], [80, 96, 44], [128, 138, 70]].map((gc, k) => gc.map((v, n) => lerp(v, [[78, 64, 36], [118, 96, 56], [160, 138, 88]][k][n], brown)));
    for (let c = 0; c < NC; c++) {
      const m = mask[c], k = c << 2;
      let r = R[c], g = Gc[c], b = B[c], hollow = 0;
      if (m === 2) {
        const v = V[c];
        if (v > 0.02) {
          // a dithered threshold: ragged hollows, not smooth tubes
          const vd = v + fl.dith[c] * 0.02;
          let p = (vd - fl.thr[c]) / 0.07; p = p < 0 ? 0 : p > 1 ? 1 : p; p *= fl.pitN[c];
          let rim = (vd - fl.thr[c] + 0.07) / 0.05; rim = (rim < 0 ? 0 : rim > 1 ? 1 : rim) * (1 - p);
          let e = (V[c - GW - 1] - V[c + GW + 1]) * 3; e = e < -1 ? -1 : e > 1 ? 1 : e;
          // a paler crust of iron oxide rings each hollow
          r += (CRUST[0] - r) * rim * 0.32; g += (CRUST[1] - g) * rim * 0.32; b += (CRUST[2] - b) * rim * 0.32;
          if (fl.clay[c]) { r += (CLAY[0] - r) * p * 0.6; g += (CLAY[1] - g) * p * 0.6; b += (CLAY[2] - b) * p * 0.6; }
          else { r += (PIT[0] - r) * p * 0.8; g += (PIT[1] - g) * p * 0.8; b += (PIT[2] - b) * p * 0.8; }
          r += e * 16; g += e * 11; b += e * 8;
          hollow = p;
        }
      }
      let w = 0;
      if (wf > 0) { const x = (wf - fl.wetO[c]) * 7 + 0.5; w = x < 0 ? 0 : x > 1 ? 1 : x; }
      if (df > 0 && w > 0) { const x = (df - fl.dryO[c]) * 7 + 0.5; w *= 1 - (x < 0 ? 0 : x > 1 ? 1 : x); }
      if (dampOn) { const d = damp[c]; if (d > 0.002) { r *= 1 - 0.3 * d; g *= 1 - 0.4 * d; b *= 1 - 0.36 * d; if (d > w) w = d; damp[c] = d * decay; anyDamp = true; } else damp[c] = 0; }
      if (w > 0.003 && m) {
        const kw = m === 2 ? 1 : 0.55;
        r *= 1 - 0.38 * w * kw; g *= 1 - 0.52 * w * kw; b *= 1 - 0.5 * w * kw;
      }
      if (mossVis > 0 && (m === 1 || m === 2)) {
        let a = (mossG - fl.mossT[c]) * 3; a = a < 0 ? 0 : a > 1 ? 1 : a;
        if (a > 0) {
          // a soft cushion where it is thick, and specks everywhere it reaches,
          // so the front frays into scattered dots
          const h = fl.hash[c], crev = m === 1 || hollow > 0.3;
          let cush = (a - 0.6) / 0.4; cush = (cush < 0 ? 0 : cush) * mossVis * (0.75 - hollow * 0.6);
          const base = m === 1 ? MG[0] : MG[1];
          r += (base[0] - r) * cush; g += (base[1] - g) * cush; b += (base[2] - b) * cush;
          if (h < a * (0.55 - hollow * 0.2)) {
            const tc = crev || h < a * 0.12 ? MG[0] : fl.mossN[c] + fl.dith[c] * 0.4 > 0.05 ? MG[2] : MG[1];
            const al = mossVis * 0.85;
            r += (tc[0] - r) * al; g += (tc[1] - g) * al; b += (tc[2] - b) * al;
          }
        }
      }
      if (bleach > 0 && m) { const kb = bleach * (m === 2 ? 0.26 : 0.12); r += (242 - r) * kb; g += (212 - g) * kb; b += (182 - b) * kb; }
      data[k] = r; data[k + 1] = g; data[k + 2] = b; data[k + 3] = 255;
    }
    dampOn = anyDamp;
    bufG.putImageData(img, 0, 0);
  }

  let sunG = null;
  const sunGrad = c => {
    if (sunG) return sunG;
    sunG = c.createRadialGradient(W * 0.15, -H * 0.1, 50, W * 0.3, H * 0.2, W * 1.05);
    sunG.addColorStop(0, 'rgba(255,214,150,0.18)'); sunG.addColorStop(1, 'rgba(255,214,150,0)');
    return sunG;
  };

  function grass(g, S, t) {
    const amt = S.grass * S.grassFade;
    if (amt <= 0.01) return;
    const col = mix('#5e7c2c', '#9a8248', S.grassBrown);
    for (const b of core.wall.tufts) {
      const u = clamp((S.grass - b.delay) / (1 - b.delay));
      if (u <= 0) continue;
      const h = b.h * ease.outCubic(u) * (1 - S.grassBrown * 0.25), sway = 0.06 * N(t * 0.5, b.seed * 0.3, 1.1);
      const lean = b.lean + sway + S.grassBrown * b.bend * 0.8;
      const pts = [];
      for (let k = 0; k <= 6; k++) { const s = k / 6; pts.push([b.x + Math.sin(lean) * h * s + b.bend * h * s * s * 0.4, b.y - Math.cos(lean) * h * s + S.grassBrown * h * s * s * 0.3]); }
      ink(g, pts, { width: 1.8, color: col, alpha: 0.85 * S.grassFade, jitter: 0.3, seed: b.seed, taper: 10, step: 3 });
    }
  }

  /** A hand on the wall: a damp print where it presses, red dust where it brushes in the dry. */
  function touch(p, S) {
    if (!p.inside) { wasDown = false; lastP = null; prevX = prevY = null; return; }
    if (p.down && !wasDown) { stampHand(damp, p.x, p.y, (p.x - W / 2) / W * 0.4, handNz); dampOn = true; lastP = { x: p.x, y: p.y }; }
    else if (p.down && lastP && Math.hypot(p.x - lastP.x, p.y - lastP.y) > 24) { stampHand(damp, p.x, p.y, 0, handNz, 0.55); dampOn = true; lastP = { x: p.x, y: p.y }; }
    wasDown = p.down;
    if (!p.down) lastP = null;
    const dry = (1 - clamp(S.wf) * (1 - clamp(S.df))) * (1 - S.rain);
    const moved = prevX !== null && (p.x !== prevX || p.y !== prevY);
    if (moved && !p.down && !p.keyboard && dry > 0.5 && p.y < GROUND && dust.length < 160) {
      const r = rng(`dust:${dustN++}`);
      for (let k = 0; k < 2; k++) {
        const max = r.range(0.8, 2.2);
        dust.push({ x: p.x + r.range(-10, 10), y: p.y + r.range(-6, 6), vx: r.range(-12, 12), vy: r.range(-4, 14), life: max, max, s: r.range(1, 2.4), col: r.pick(['#a8492b', '#c06a3d', '#8a3a22', '#d19060']) });
      }
    }
    prevX = p.x; prevY = p.y;
  }

  function render(model, frame) {
    const t = frame.time, look = model.look, calm = frame.calm || [], still = frame.still || look.pace === 0;
    const dark = palette().dark !== '#000000';
    if (frame.epoch !== epoch) {
      // replay: the same wall; the pits grow again from their seed spots
      if (epoch !== -1 && core && core.seed === model.seed) { seedStone(stone, core.wall, core.grid, core.fl.F); stoneSteps = 0; mossCycle = -1; damp.fill(0); dust.length = 0; start = null; stillDone = false; }
      epoch = frame.epoch;
    }
    const key = `${st.canvas.width}x${st.canvas.height}|${model.seed}`;
    if (key !== sizeKey) {
      sizeKey = key; lastKey = '';
      if (built && core && core.seed === model.seed) { for (const _ of warmup(model.seed)); }
      else { built = false; builder = warmup(model.seed); }
    }
    const g = st.begin();
    if (!built && build(8)) readyAt = t;
    if (!built) { g.fillStyle = '#b3563a'; g.fillRect(0, 0, W, H); invalidate(); return; }
    if (still && !stillDone) {
      // the still is simulated in slices: every frame until it is there, then never again
      stillDone = simulate(STILL_T, seasons(STILL_T), 10);
      if (!stillDone) { g.fillStyle = '#b3563a'; g.fillRect(0, 0, W, H); invalidate(); return; }
      lastKey = '';
    }
    if (start === null) start = t;
    const local = still ? STILL_T : (t - start) * look.pace;
    const S = seasons(local);
    if (!still) simulate(local, S, 3.5);
    if (look.touch) touch(frame.pointer, S);
    // at most 30 redraws a second, fewer when the governor says frames are slow; every frame while a print or dust fades
    const q = frame.quality ?? 1, fps = q < 0.5 ? 12 : q < 0.75 ? 20 : 30;
    const calmKey = calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
    const fading = still ? false : t - readyAt < 0.7;
    const fk = `${still ? 's' : Math.floor(t * fps)}|${stoneSteps}|${dampOn || dust.length || fading ? t : ''}|${calmKey}|${dark}|${frame.pointer.keyboard ? `${frame.pointer.x | 0},${frame.pointer.y | 0}` : ''}`;
    if (fk === lastKey) return;
    lastKey = fk;
    const dt = still ? 0 : Math.max(0, Math.min(0.1, t - lastT)); lastT = t;

    colour(S, dt);
    // light: warm sun with a frond's shadow in the dry months, painted into the
    // small grid canvas (cheap there, and soft once stretched); none at night
    if (S.sun > 0.01 && !dark) {
      bufG.save(); bufG.scale(GW / W, GH / H);
      bufG.fillStyle = sunGrad(bufG); bufG.globalAlpha = S.sun; bufG.fillRect(0, 0, W, H);
      const sway = still ? 0 : 0.045 * N(t * 0.22, 3.3, 0.7) + 0.012 * Math.sin(t * 0.9);
      bufG.globalCompositeOperation = 'multiply'; bufG.globalAlpha = 0.34 * S.sun;
      bufG.translate(-120, -90); bufG.rotate(0.3 + sway);
      bufG.drawImage(sprite, 0, 0, 1000, 500);
      bufG.restore();
    }

    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';
    g.drawImage(buf, 0, 0, W, H); g.restore();
    st.blit(overlay);

    const grey = clamp(1 - S.sun) * 0.1 + S.rain * 0.12;
    if (grey > 0.005) { g.fillStyle = `rgba(52,62,70,${grey})`; g.fillRect(0, 0, W, H); }

    // wet ground and wet plaster
    const wetAll = clamp(S.wf) * (1 - clamp(S.df * 0.9));
    if (wetAll > 0.01) {
      g.save(); g.fillStyle = `rgba(30,8,4,${0.35 * wetAll})`; g.fill(groundPath);
      g.fillStyle = `rgba(70,78,82,${0.2 * wetAll})`; g.fill(plasterPath); g.restore();
    }
    grass(g, S, still ? 0 : t);

    // rain and small splashes where it hits the earth, kept off the page's words
    if (S.rain > 0.01 && !still) {
      g.save(); g.lineCap = 'round';
      // a drop or a splash near the page's words is simply not drawn (a clip with holes would
      // fill again wherever two text boxes overlap)
      g.strokeStyle = `rgba(232,236,240,${0.32 * S.rain})`; g.lineWidth = 1;
      g.beginPath();
      const rr = rng('chiro-rain'), count = Math.round(170 * S.rain * Math.max(0.4, q)), span = H + 80;
      for (let i = 0; i < count; i++) {
        const sp = rr.range(560, 760), len = rr.range(16, 34), x0 = rr.range(-100, W), y0 = rr() * span;
        const y = ((y0 + t * sp) % span) - 40, x = x0 + y * 0.14;
        if (calm.length && (inCalm(x, y, calm) || inCalm(x - len * 0.14, y - len, calm))) continue;
        g.moveTo(x, y); g.lineTo(x - len * 0.14, y - len);
      }
      g.stroke();
      g.strokeStyle = `rgba(236,232,226,${0.5 * S.rain})`; g.lineWidth = 0.9;
      g.beginPath();
      const tick = Math.floor(t * 9);
      for (let i = 0; i < 26 * S.rain; i++) {
        const pr = rng(tick * 97 + i), x = pr() * W, y = groundY(x, core.wall.nz) + pr.range(4, 60), f = (t * 9) % 1;
        const rad = lerp(1, 6, f);
        if (calm.length && inCalm(x, y, calm)) continue;
        g.moveTo(x + rad, y); g.ellipse(x, y, rad, rad * 0.35, 0, 0, Math.PI, true);
      }
      g.stroke();
      g.restore();
    }

    // red dust rubbed loose by a passing hand
    if (dust.length) {
      g.save();
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        if (dt > 0) { d.vy += 60 * dt; d.vx *= 0.97; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }
        if (d.life <= 0 || d.y > H) { dust.splice(i, 1); continue; }
        if (inCalm(d.x, d.y, calm)) continue;
        g.globalAlpha = clamp(d.life / d.max) * 0.85; g.fillStyle = d.col;
        g.fillRect(d.x, d.y, d.s, d.s);
      }
      g.restore();
    }
    // the keyboard hand, so a sighted keyboard user sees where it will press
    const p = frame.pointer;
    if (look.touch && p.keyboard && p.inside) {
      g.save(); g.strokeStyle = '#f6e7cf'; g.lineWidth = 2; g.globalAlpha = 0.95;
      g.beginPath(); g.arc(p.x, p.y, 14, 0, Math.PI * 2); g.moveTo(p.x - 6, p.y); g.lineTo(p.x + 6, p.y); g.moveTo(p.x, p.y - 6); g.lineTo(p.x, p.y + 6); g.stroke(); g.restore();
    }

    // night on a dark page: the same wall under a lamp-blue sky, never an inverted one
    if (dark) { g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(92,100,150,0.62)'; g.fillRect(0, 0, W, H); g.restore(); }

    const up = still ? 1 : (t - readyAt) / 0.6;
    if (up < 1) { g.globalAlpha = 1 - clamp(up); g.fillStyle = '#b3563a'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    host.dataset.steps = String(stoneSteps);
    host.dataset.season = S.s < 0 ? 'pits' : S.s.toFixed(1);
    if (resolveReady && (!still || stillDone)) { resolveReady(); resolveReady = null; }
  }

  return {
    render,
    ready,
    setRegister() { lastKey = ''; stillDone = false; },
    restyle() { colors = null; lastKey = ''; },
    /** Enter or Space in playful: press a hand to the wall where the keyboard hand is. */
    activate(p) {
      if (!p || !core) return;
      stampHand(damp, p.x, p.y, (p.x - W / 2) / W * 0.4, handNz); dampOn = true; lastKey = ''; invalidate();
    },
    destroy() { st.destroy(); },
  };
}
