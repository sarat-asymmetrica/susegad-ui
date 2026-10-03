// Khazan: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the night, the far hills and palms, the mangroves with their
// prop roots and sky rim, the reflection, the ripples, the bund with its path
// and sluice gate, the reeds, the glow and halo sprites and the readout are
// the plate's own code, painted in slices behind a ready promise. What the
// port adds: the registers, progress as synchrony, the swarm stepped at fixed
// sixtieths (so a seed replays), the hand in playful from the pointer or the
// keyboard, the calm zone, and the governor.

import { stage, rng, ink, hatch, grainPattern, makeNoise, N, TAU, clamp, lerp, ease } from '../../engine/index.js';
import {
  W, H, WATER_Y, INK_FAR, INK_MID, INK_NEAR, RIM, swarm, scatter, wavePhases, heldPhases, kuramoto, localOrder, flash, K, pointIn,
} from './model.js';

const HAND = '"Kalam", "Segoe Print", cursive';

function fill(g, pts, color) {
  g.fillStyle = color; g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath(); g.fill();
}

function palm(g, x, base, h, lean, seed, color) {
  const r = rng(`palm${seed}`), trunk = [];
  for (let i = 0; i <= 12; i++) { const u = i / 12; trunk.push([x + lean * h * u * u, base - h * u]); }
  ink(g, trunk, { width: 2.6 * (h / 90), color, jitter: 0.4, seed, taper: 6 });
  const [tx, ty] = trunk[trunk.length - 1];
  const fronds = r.int(8, 11);
  for (let k = 0; k < fronds; k++) {
    const a = -Math.PI / 2 + (k / (fronds - 1) - 0.5) * Math.PI * 1.55 + r.range(-0.12, 0.12);
    const len = h * r.range(0.32, 0.44), pts = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8, droop = u * u * len * 0.55;
      pts.push([tx + Math.cos(a) * len * u, ty + Math.sin(a) * len * u + droop]);
    }
    ink(g, pts, { width: 2.4 * (h / 90), color, jitter: 0.5, seed: seed * 13 + k, taper: len * 0.6, pressure: 0.2 });
    for (let i = 2; i < 8; i++) {
      const [px, py] = pts[i], ang = Math.atan2(pts[i + 1][1] - py, pts[i + 1][0] - px);
      for (const side of [-1, 1]) {
        const la = ang + side * 0.9 + 0.35, ll = len * 0.2 * (1 - i / 10);
        ink(g, [[px, py], [px + Math.cos(la) * ll, py + Math.sin(la) * ll + ll * 0.4]], { width: 1.1 * (h / 90), color, jitter: 0.2, seed: seed + i * side, taper: ll * 0.5 });
      }
    }
  }
}

function* paintSilhouettes(g, scene) {
  const cv = g.canvas;
  // far hills of the ghats: two layers of haze
  for (const [k, color, base, amp, f] of [[0, '#1d2a5c', 64, 46, 0.0017], [1, '#16204a', 36, 30, 0.003]]) {
    const hills = [[0, WATER_Y]];
    for (let x = 0; x <= W; x += 8) hills.push([x, WATER_Y - base - amp * (0.5 + makeNoise(5 + k).fbm(x * f, 0.3, 0, 3))]);
    hills.push([W, WATER_Y]);
    fill(g, hills, color);
  }
  yield cv;
  // far bank and palms
  const bank = [[0, WATER_Y + 2]];
  for (let x = 0; x <= W; x += 6) bank.push([x, WATER_Y - 8 - 8 * (0.5 + N.fbm(x * 0.012, 7.7, 0, 3))]);
  bank.push([W, WATER_Y + 2]);
  fill(g, bank, INK_FAR);
  yield cv;
  for (const [i, [x, h, lean]] of [[40, 118, 0.12], [318, 138, -0.18], [338, 104, 0.1], [600, 150, 0.16], [952, 128, -0.12], [1172, 110, -0.2], [990, 96, 0.22]].entries()) {
    palm(g, x, WATER_Y - 6, h, lean, i + 1, INK_FAR);
    yield cv;
  }
  // mangroves: prop roots, then a rim of sky light, then the dark mass
  for (const [ci, c] of scene.clumps.entries()) {
    const rr = rng(`roots${ci}`);
    for (let k = 0; k < Math.round(c.w / 6); k++) {
      const x0 = c.x + rr.range(-0.46, 0.46) * c.w, y0 = WATER_Y - rr.range(18, 36);
      const x1 = x0 + rr.range(-26, 26), y1 = WATER_Y + rr.range(0, 4);
      const mx = (x0 + x1) / 2 + (x1 - x0) * 0.45, my = y0 - rr.range(2, 10), pts = [];
      for (let i = 0; i <= 10; i++) { const u = i / 10, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), cc = u * u; pts.push([a * x0 + b * mx + cc * x1, a * y0 + b * my + cc * y1]); }
      ink(g, pts, { width: rr.range(0.9, 2), color: INK_MID, jitter: 0.5, seed: ci * 100 + k, taper: 4 });
    }
    yield cv;
    g.save(); g.translate(0.4, -2.2);
    for (const b of c.blobs) fill(g, b, RIM);
    g.restore();
    for (const b of c.blobs) fill(g, b, INK_MID);
    yield cv;
  }
}

/** Paints the night in small slices: each `yield` is a safe place to pause,
 *  so the first paint can be spread across frames instead of one long hitch. */
function* paintScene(g, scene) {
  // split a full-width fill into two bands meeting on a device-pixel row, so
  // the result is identical to one fill but the raster work is halved per slice
  const bands = (y0, y1) => { const k = g.getTransform().d, m = Math.round(((y0 + y1) / 2) * k) / k; return [[y0, m], [m, y1]]; };
  // sky: deep at the zenith, a last violet haze at the horizon
  const sky = g.createLinearGradient(0, 0, 0, WATER_Y);
  sky.addColorStop(0, '#050817'); sky.addColorStop(0.45, '#0e1639'); sky.addColorStop(0.82, '#243468'); sky.addColorStop(1, '#3a4680');
  g.fillStyle = sky;
  for (const [a, b] of bands(0, WATER_Y + 2)) { g.fillRect(0, a, W, b - a); yield; }
  const glow = g.createRadialGradient(W * 0.64, WATER_Y, 10, W * 0.64, WATER_Y, W * 0.6);
  glow.addColorStop(0, 'rgba(150,130,190,0.28)'); glow.addColorStop(1, 'rgba(150,130,190,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, WATER_Y);
  yield;
  // the sky is drawn, not rendered: faint ballpoint strokes
  hatch(g, [[0, 0], [W, 0], [W, WATER_Y], [0, WATER_Y]], {
    angle: -0.06, spacing: 5.5, width: 0.7, color: '#8fa0e8', alpha: 0.07, seed: 3, seg: [30, 90], gap: 0.5, wobble: 0.6,
    density: (x, y) => 0.25 + 0.75 * (y / WATER_Y),
  });
  yield;
  const r = rng('stars');
  for (let i = 0; i < 130; i++) {
    const x = r() * W, y = Math.pow(r(), 1.5) * (WATER_Y - 110), s = r.range(0.5, 1.6);
    g.fillStyle = `rgba(226,230,255,${r.range(0.15, 0.75) * (1 - y / WATER_Y)})`;
    g.fillRect(x, y, s, s);
  }
  // water: the sky again, darker toward us
  const water = g.createLinearGradient(0, WATER_Y, 0, H);
  water.addColorStop(0, '#2c3a70'); water.addColorStop(0.3, '#141e48'); water.addColorStop(1, '#060a1b');
  g.fillStyle = water;
  for (const [a, b] of bands(WATER_Y, H)) { g.fillRect(0, a, W, b - a); yield; }
  yield;

  // silhouettes, and their reflection flipped about the waterline
  const sil = document.createElement('canvas');
  sil.width = g.canvas.width; sil.height = g.canvas.height;
  const sg = sil.getContext('2d');
  sg.setTransform(g.getTransform());
  yield* paintSilhouettes(sg, scene);
  g.save();
  g.beginPath(); g.rect(0, WATER_Y, W, H - WATER_Y); g.clip();
  g.translate(0, WATER_Y * 2); g.scale(1, -1);
  g.filter = 'blur(1.6px)';
  // only the band of silhouettes that lands in the water, plus a margin wider
  // than the blur, so the (costly) blur works on far fewer pixels
  const y0 = Math.max(0, 2 * WATER_Y - H - 12), y1 = WATER_Y + 12, k = sil.height / H;
  for (const [dx, a] of [[-3, 0.22], [0, 0.42], [3, 0.22]]) {
    g.globalAlpha = a;
    g.drawImage(sil, 0, y0 * k, sil.width, (y1 - y0) * k, dx, y0, W, y1 - y0);
    yield;
  }
  g.filter = 'none';
  g.restore();
  // ripples breaking the reflection
  const rr = rng('ripples');
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const depth = Math.pow(rr(), 1.2), y = WATER_Y + 3 + depth * (H - WATER_Y), len = rr.range(16, 120) * (0.4 + depth);
    const x = rr() * W;
    g.strokeStyle = rr() < 0.5 ? `rgba(140,160,220,${rr.range(0.05, 0.17) * (1 - depth * 0.6)})` : `rgba(3,5,14,${rr.range(0.2, 0.45)})`;
    g.lineWidth = rr.range(0.6, 1.5) * (0.6 + depth);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len / 2, y + rr.range(-0.8, 0.8), x + len, y); g.stroke();
    if (i % 150 === 149) yield;
  }
  g.drawImage(sil, 0, 0, W, H);
  g.strokeStyle = 'rgba(170,180,230,0.22)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, WATER_Y + 0.5); g.lineTo(W, WATER_Y + 0.5); g.stroke();
  yield;

  // the bund, nearest thing to us: dark face, a faintly lit path on top
  fill(g, scene.bund, INK_NEAR);
  const walk = [...scene.bundTop, ...[...scene.bundTop].reverse().map(([x, y], i, arr) => {
    const u = 1 - i / (arr.length - 1); return [x + lerp(48, 4, Math.pow(u, 0.8)), y + lerp(11, 1, u)];
  })];
  fill(g, walk, '#0b1128');
  yield;
  hatch(g, walk, { angle: -0.6, spacing: 3.2, width: 0.6, color: '#3a4a86', alpha: 0.35, seed: 8, seg: [4, 12], gap: 0.8 });
  ink(g, scene.bundTop, { width: 1.3, color: '#4a5a95', jitter: 0.7, seed: 4, alpha: 0.6, taper: 30 });
  yield;
  const gr = rng('grass');
  for (let i = 0; i < 150; i++) {
    const u = Math.pow(gr(), 0.9), idx = Math.floor(u * (scene.bundTop.length - 1));
    const [x, y] = scene.bundTop[idx], hgt = lerp(34, 5, u) * gr.range(0.4, 1.2), lean = gr.range(-0.6, 0.4);
    ink(g, [[x, y + 2], [x + lean * hgt * 0.4, y - hgt * 0.6], [x + lean * hgt, y - hgt]], { width: lerp(2, 0.6, u), color: INK_NEAR, jitter: 0.2, seed: i, taper: hgt * 0.7 });
    if (i % 50 === 49) yield;
  }
  // a small sluice gate where the bund meets the water
  const [sx, sy] = scene.bundTop[scene.bundTop.length - 4];
  for (const dx of [-8, 8]) ink(g, [[sx + dx, sy + 12], [sx + dx, sy - 18]], { width: 2.4, color: INK_NEAR, jitter: 0.3, seed: dx });
  ink(g, [[sx - 11, sy - 13], [sx + 11, sy - 14]], { width: 2, color: INK_NEAR, jitter: 0.3, seed: 9 });
  ink(g, [[sx - 8, sy + 2], [sx + 8, sy + 1]], { width: 5, color: INK_NEAR, jitter: 0.3, seed: 10 });
  // reeds in the foreground water, right corner
  const rd = rng('reeds');
  for (let i = 0; i < 46; i++) {
    const x = W + 10 - rd.range(0, 300) * Math.pow(rd(), 0.8), hgt = rd.range(40, 170), lean = rd.range(-0.35, 0.12);
    ink(g, [[x, H + 4], [x + lean * hgt * 0.4, H - hgt * 0.55], [x + lean * hgt, H - hgt]], { width: rd.range(1.2, 2.8), color: INK_NEAR, jitter: 0.3, seed: 50 + i, taper: hgt * 0.6 });
    if (i % 23 === 22) yield;
  }
  // grain: the whole night printed on paper
  g.globalAlpha = 0.06; g.fillStyle = grainPattern(g, '#c9d2ff', { lo: 0, hi: 0.8 });
  for (const [a, b] of bands(0, H)) { g.fillRect(0, a, W, b - a); yield; }
  g.globalAlpha = 0.22; g.fillStyle = grainPattern(g, '#000000', { lo: 0, hi: 0.7 });
  for (const [a, b] of bands(0, H)) { g.fillRect(0, a, W, b - a); yield; }
  g.globalAlpha = 1;
  const vg = g.createRadialGradient(W / 2, H * 0.5, H * 0.35, W / 2, H * 0.5, W * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,6,0.5)');
  g.fillStyle = vg;
  for (const [a, b] of bands(0, H)) { g.fillRect(0, a, W, b - a); yield; }
}

let sprite = null;
function glowSprite() {
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = 96;
  const g = sprite.getContext('2d'), c = 48;
  const gr = g.createRadialGradient(c, c, 0, c, c, c);
  gr.addColorStop(0, 'rgba(255,255,226,1)');
  gr.addColorStop(0.07, 'rgba(236,252,160,0.95)');
  gr.addColorStop(0.2, 'rgba(190,232,92,0.38)');
  gr.addColorStop(0.5, 'rgba(140,200,70,0.08)');
  gr.addColorStop(1, 'rgba(120,180,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
  return sprite;
}

let haloSprite = null;
function halo() {
  if (haloSprite) return haloSprite;
  haloSprite = document.createElement('canvas');
  haloSprite.width = haloSprite.height = 64;
  const g = haloSprite.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(170,220,110,0.5)'); gr.addColorStop(0.5, 'rgba(120,180,90,0.14)'); gr.addColorStop(1, 'rgba(100,160,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return haloSprite;
}


// ── The renderer ──────────────────────────────────────────────────────────

const DARK = '#03050e';
const STEP = 1 / 60;
const inCalm = (x, y, calm, pad = 24) => calm.some(r => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);

export function createRenderer(host, { invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  const sw = swarm(), { scene, xs, ys, free, nbrs, n } = sw;
  const px = new Float32Array(n), py = new Float32Array(n), vx = new Float32Array(n), vy = new Float32Array(n);
  let phase = null, omega = null, seed = null, simT = 0, rShown = 0, epoch = -1, lastTime = null, jolts = 0;

  // reflections must not land on the bund: a coarse precomputed mask
  const bundHit = (() => {
    const cell = 6, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), mask = new Uint8Array(cols * rows);
    for (let cy = Math.floor(WATER_Y / cell); cy < rows; cy++) for (let cx = 0; cx < Math.ceil(620 / cell); cx++) mask[cy * cols + cx] = pointIn(scene.bund, cx * cell + 3, cy * cell + 3) ? 1 : 0;
    return (x, y) => { const cx = Math.floor(x / cell), cy = Math.floor(y / cell); return cx >= 0 && cy >= 0 && cx < cols && cy < rows && mask[cy * cols + cx] === 1; };
  })();

  function start(s) {
    seed = s; ({ phase, omega } = scatter(s, n)); simT = 0; lastTime = null;
    px.fill(0); py.fill(0); vx.fill(0); vy.fill(0);
    rShown = localOrder(phase, nbrs);
  }

  // The night is painted in slices over the first frames (no single long
  // hitch), and fades up from dark once it is complete. A resize repaints it
  // in one go, so an already-visible scene never blinks out.
  let sceneLayer = null, sizeKey = '', builder = null, built = false, readyAt = null;
  let resolveReady = null;
  const ready = new Promise(r => { resolveReady = r; });
  function build(sliced) {
    sceneLayer = st.layer();
    builder = paintScene(sceneLayer.getContext('2d'), scene);
    built = false;
    if (!sliced) { while (!builder.next().done); built = true; }
  }
  const tap = document.createElement('canvas'); tap.width = tap.height = 1;
  const tapG = tap.getContext('2d');
  const flush = c => tapG.drawImage(c, 0, 0, 1, 1);
  function advanceBuild(budget) {
    const t0 = performance.now();
    while (!built && performance.now() - t0 < budget) {
      const s = builder.next();
      if (s.done) built = true;
      // Canvas records draw calls and rasterises them only when read, so
      // without this the whole paint would land on the first blit anyway.
      if (s.value) flush(s.value);
      flush(sceneLayer);
    }
    return built;
  }
  let halos = null;
  const haloLayer = () => {
    const w = Math.max(1, Math.round(st.canvas.width / 4)), h = Math.max(1, Math.round(st.canvas.height / 4));
    if (!halos || halos.width !== w || halos.height !== h) { halos = document.createElement('canvas'); halos.width = w; halos.height = h; }
    return halos;
  };

  /** The hand scrambles nearby phases and pushes the fireflies aside (the plate's pointer). */
  function scatterAt(x, y, dt, strength = 1) {
    const jolt = rng(`jolt:${seed}:${jolts++}`);
    for (let i = 0; i < n; i++) {
      const dx = xs[i] + px[i] - x, dy = ys[i] + py[i] - y, d = Math.hypot(dx, dy);
      if (d < 130) {
        const f = (1 - d / 130) * strength;
        phase[i] = (phase[i] + (jolt() - 0.5) * 5 * f * f + TAU) % TAU;
        vx[i] += (dx / (d || 1)) * 260 * f * dt; vy[i] += (dy / (d || 1)) * 260 * f * dt;
      }
    }
  }

  let lastPtr = null;
  function render(data, frame) {
    const look = data.look, calm = frame.calm || [], still = frame.still || look.pace === 0, t = frame.time;
    if (seed !== data.seed || frame.epoch !== epoch) { epoch = frame.epoch; start(data.seed); }
    const key = `${st.canvas.width}x${st.canvas.height}`;
    if (key !== sizeKey) { build(sizeKey === ''); sizeKey = key; }
    const g = st.begin();
    if (!built) {
      advanceBuild(8);
      g.fillStyle = DARK; g.fillRect(0, 0, W, H);
      invalidate();
      if (!built) return;
    }
    if (readyAt === null) readyAt = t;

    // the swarm: held by progress, a still wave, or stepped in fixed sixtieths so a seed replays
    let ph;
    if (data.held) { ph = heldPhases(data.seed, data.progress, still ? 0 : t, sw); rShown = localOrder(ph, nbrs); }
    else if (still) { ph = wavePhases(xs, ys); rShown = localOrder(ph, nbrs); }
    else {
      const dt = lastTime === null ? 0 : Math.max(0, Math.min(0.1, t - lastTime)) * look.pace;
      lastTime = t;
      simT += dt;
      const steps = Math.min(12, Math.round(dt / STEP));
      for (let s = 0; s < steps; s++) kuramoto(phase, omega, nbrs, K, STEP);
      const p = frame.pointer, moved = p.inside && lastPtr && (p.x !== lastPtr[0] || p.y !== lastPtr[1]);
      if (look.hand && moved && !p.keyboard && !inCalm(p.x, p.y, calm, 0)) scatterAt(p.x, p.y, dt || STEP);
      lastPtr = p.inside ? [p.x, p.y] : null;
      for (let i = 0; i < n; i++) {
        px[i] += vx[i] * dt; py[i] += vy[i] * dt;
        const damp = Math.exp(-dt * 2.2), spring = dt * 1.4;
        vx[i] = vx[i] * damp - px[i] * spring; vy[i] = vy[i] * damp - py[i] * spring;
      }
      rShown += (localOrder(phase, nbrs) - rShown) * clamp(dt * 1.5);
      ph = phase;
    }
    const tt = still ? 0 : t, q = frame.quality ?? 1;

    st.blit(sceneLayer);
    // glows and their reflections; the wide soft halos go into a
    // quarter-resolution layer (they are all gradient, no detail to lose)
    const spr = glowSprite(), hal = halo();
    const hl = haloLayer(), hg = hl.getContext('2d'), hs = hl.width / W;
    hg.setTransform(1, 0, 0, 1, 0, 0); hg.clearRect(0, 0, hl.width, hl.height);
    hg.setTransform(hs, 0, 0, hl.height / H, 0, 0); hg.globalCompositeOperation = 'lighter';
    let hx0 = Infinity, hy0 = Infinity, hx1 = -Infinity, hy1 = -Infinity;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const drift = free[i] ? 38 : 3.5, speed = free[i] ? 0.07 : 0.3;
      // under the page's words a firefly rests where it lives and glows low and steady, so the text sits on a quiet night
      // (a glow is up to 27 units across its middle; a wanderer drifts up to 38)
      const hush = calm.length && inCalm(xs[i], ys[i], calm, free[i] ? 100 : 60);
      const x = hush ? xs[i] : xs[i] + px[i] + drift * N(i * 0.37, tt * speed, 1.1);
      const y = hush ? ys[i] : ys[i] + py[i] + drift * 0.7 * N(i * 0.37, tt * speed, 7.4);
      const b = hush ? 0.12 : flash(ph[i]);
      const size = 24 + 30 * b;
      if (q >= 0.5 && b > 0.3 && (i & 1) && !(calm.length && inCalm(x, y, calm, 90))) {
        hg.globalAlpha = b * 0.22; hg.drawImage(hal, x - 70, y - 70, 140, 140);
        if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; if (y < hy0) hy0 = y; if (y > hy1) hy1 = y;
      }
      g.globalAlpha = clamp(b);
      g.drawImage(spr, x - size / 2, y - size / 2, size, size);
      const ry = WATER_Y * 2 - y;
      if (q >= 0.75 && ry > WATER_Y + 2 && ry < H && b > 0.08 && !bundHit(x, ry) && !(calm.length && inCalm(x, ry, calm))) {
        const wob = 2.5 * Math.sin(tt * 1.7 + ry * 0.08);
        g.globalAlpha = b * 0.42 * (1 - (ry - WATER_Y) / (H - WATER_Y));
        g.drawImage(spr, x + wob - size * 0.9, ry - size * 0.22, size * 1.8, size * 0.44);
      }
    }
    // composite only the part of the halo layer that has halos in it
    if (hx1 >= hx0) {
      const hsy = hl.height / H;
      const sx = clamp(Math.floor((hx0 - 72) * hs), 0, hl.width), sy = clamp(Math.floor((hy0 - 72) * hsy), 0, hl.height);
      const ex = clamp(Math.ceil((hx1 + 72) * hs), 0, hl.width), ey = clamp(Math.ceil((hy1 + 72) * hsy), 0, hl.height);
      if (ex > sx && ey > sy) { g.globalAlpha = 1; g.drawImage(hl, sx, sy, ex - sx, ey - sy, sx / hs, sy / hsy, (ex - sx) / hs, (ey - sy) / hsy); }
    }
    g.restore();

    // the keyboard hand in playful: a faint ring where it is
    const p = frame.pointer;
    if (look.hand && p.keyboard && p.inside) {
      g.save(); g.strokeStyle = 'rgba(214,240,140,0.8)'; g.lineWidth = 1.6; g.beginPath(); g.arc(p.x, p.y, 16, 0, TAU); g.stroke(); g.restore();
    }

    // quiet readout, unless the page's words sit there
    if (!calm.some(r => r.x < W - 20 && r.x + r.w > W - 260 && r.y < H - 10 && r.y + r.h > H - 70)) {
      g.save();
      g.font = `20px ${HAND}`;
      g.textAlign = 'right'; g.textBaseline = 'alphabetic';
      g.fillStyle = 'rgba(206,214,245,0.62)';
      // with progress set, the readout is the work's own number; otherwise how in step the bank is
      const shown = data.held ? data.progress : rShown;
      g.fillText(data.held ? `${Math.round(shown * 100)}% done` : `in step · ${Math.round(shown * 100)}%`, W - 36, H - 30);
      const bw = 96, bx = W - 36 - bw, by = H - 22;
      g.strokeStyle = 'rgba(206,214,245,0.22)'; g.lineWidth = 1.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bw, by); g.stroke();
      g.strokeStyle = 'rgba(214,240,140,0.7)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bw * shown, by + 0.5); g.stroke();
      g.restore();
    }
    host.dataset.order = rShown.toFixed(3);

    // the night fades up once it is painted (not in a still, which is finished at once)
    const up = still ? 1 : (t - readyAt) / 0.7;
    if (up < 1) { g.globalAlpha = 1 - ease.inOutSine(clamp(up)); g.fillStyle = DARK; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    if (resolveReady) { resolveReady(); resolveReady = null; }
  }

  return {
    render,
    ready,
    setRegister() { lastTime = null; },
    /** Enter or Space in playful: the hand sweeps through the swarm where it is, as the pointer does. */
    activate(p) { if (p && phase) { for (let k = 0; k < 6; k++) scatterAt(p.x, p.y, STEP); invalidate(); } },
    destroy() { st.destroy(); },
  };
}
