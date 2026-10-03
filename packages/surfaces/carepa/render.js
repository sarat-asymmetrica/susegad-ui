// Carepa: the renderer. Owns the canvas and every side effect (the pointer as
// the sun, the paint order, the quality step-down). Draws what model.js
// describes; every choice about what the window shows lives there or in the
// ported drawing functions below (kept close to the plate on purpose: A6).
//
// A surface has no slotted reading zone of its own (unlike a scene). It fills
// its host element edge to edge, scaled to cover (like CSS background-size:
// cover) so it works behind a full-bleed dialog or a side drawer at any
// aspect ratio, never just its own 1200x820 box.

import {
  rng, N, clamp, lerp, TAU, boil, ink, hatch, wash, paper, createGovernor,
} from '../../engine/index.js';
import { W, H, WIN, ARCH, paneShape, model } from './model.js';

const INK = '#2a2118';
const OUT_SCALE = 0.06;

// Rasika OS1: the plate has a dusk palette, and dark theme should use it,
// the same lesson Paus already learned (a window painted at dusk, a lamp
// lit inside) — a bright daytime room read as a flash of light in dark mode.
const DUSK = {
  sky: [['#1a2436', 0], ['#26314a', 0.7], ['#2c3a4a', 1]],
  shade: 'rgba(5,8,18,0.6)',
};

const pathOf = pts => { const p = new Path2D(); pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); return p; };

/** Darkens an already-painted layer in place (source-atop keeps its own alpha shape). */
function dusk(g, shade) {
  if (!shade) return;
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = shade;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.restore();
}

// ── The world outside, drawn tiny (the free blur: paint small, stretch up) ─

function outside(g, t, sun, dark) {
  const w = 120, h = 82;
  g.setTransform(OUT_SCALE / 0.1, 0, 0, OUT_SCALE / 0.1, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, h);
  if (dark) DUSK.sky.forEach(([c, o]) => sky.addColorStop(o, c));
  else { sky.addColorStop(0, '#8fc0e0'); sky.addColorStop(0.7, '#e8e2c6'); sky.addColorStop(1, '#d8c89a'); }
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  // by day the sun; after dark, a lamp's warmer, dimmer glow (never bright daylight in a night window)
  const sg = g.createRadialGradient(sun.x * 0.1, sun.y * 0.1, 0, sun.x * 0.1, sun.y * 0.1, dark ? 26 : 34);
  if (dark) { sg.addColorStop(0, 'rgba(255,206,140,0.55)'); sg.addColorStop(0.5, 'rgba(255,190,120,0.22)'); sg.addColorStop(1, 'rgba(255,190,120,0)'); }
  else { sg.addColorStop(0, 'rgba(255,250,228,1)'); sg.addColorStop(0.4, 'rgba(255,238,190,0.55)'); sg.addColorStop(1, 'rgba(255,230,180,0)'); }
  g.fillStyle = sg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#d99a3e'; g.fillRect(62, 44, 40, 40);
  g.fillStyle = '#3d6fa8'; g.fillRect(74, 56, 8, 16);
  g.fillStyle = '#a8432b'; g.beginPath(); g.moveTo(58, 45); g.lineTo(82, 36); g.lineTo(106, 45); g.fill();
  const sway = 1.4 * N(t * 0.3, 7);
  g.strokeStyle = '#5b4a36'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(44, 84); g.quadraticCurveTo(46, 60, 50 + sway * 0.5, 36); g.stroke();
  g.fillStyle = '#3f6b3a';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i / 6 - 0.5) * 3.4 + sway * 0.05;
    g.beginPath(); g.ellipse(50 + sway * 0.5 + Math.cos(a) * 7, 36 + Math.sin(a) * 5 + 2, 8, 2.2, a, 0, TAU); g.fill();
  }
  g.fillStyle = '#b8a07a'; g.fillRect(0, 70, w, h - 70);
  const period = 11, k = Math.floor(t / period), u = (t % period) / period;
  const dir = rng(`poder${k}`)() < 0.5 ? 1 : -1;
  const x = dir > 0 ? lerp(-20, w + 20, u) : lerp(w + 20, -20, u), y = 62;
  g.fillStyle = 'rgba(40,34,30,0.85)';
  g.beginPath(); g.arc(x - 4, y + 10, 4, 0, TAU); g.arc(x + 5, y + 10, 4, 0, TAU); g.fill();
  g.fillRect(x - 2, y - 4, 4, 11);
  g.beginPath(); g.arc(x, y - 7, 2.6, 0, TAU); g.fill();
  g.fillStyle = 'rgba(190,140,70,0.95)'; g.fillRect(x + 3 * dir - 3, y + 1, 7, 5);
  g.fillStyle = 'rgba(200,60,50,0.8)'; g.fillRect(x - 3, y - 3, 6, 5);
}

// ── Still layers (painted once and cached, per A4) ──────────────────────────

function room(g, dark) {
  paper(g, W, H, { base: '#ece5d6', seed: 8, vignette: 0.16, fibers: 50 });
  wash(g, [[0, 0], [W, 0], [W, H], [0, H]], { color: '#bfae8e', alpha: 0.8 });
  const vg = g.createRadialGradient(ARCH.cx, 470, 160, ARCH.cx, 470, 760);
  vg.addColorStop(0, 'rgba(40,28,16,0)'); vg.addColorStop(1, 'rgba(40,28,16,0.42)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  hatch(g, [[0, 0], [W, 0], [W, H], [0, H]], {
    angle: 0.25, spacing: 7, color: '#4a3a26', alpha: 0.07, seed: 3, width: 0.6, seg: [4, 10], gap: 1.2,
  });
  const R = 34;
  const arch = [];
  for (let i = 0; i <= 40; i++) { const a = Math.PI + (i / 40) * Math.PI; arch.push([ARCH.cx + Math.cos(a) * (ARCH.r + R), ARCH.cy + Math.sin(a) * (ARCH.r + R)]); }
  const outer = [[WIN.x - R, WIN.y + WIN.h + R * 0.6], [WIN.x - R, WIN.y], ...arch.slice(1, -1), [WIN.x + WIN.w + R, WIN.y], [WIN.x + WIN.w + R, WIN.y + WIN.h + R * 0.6]];
  wash(g, outer, { color: '#e2d5bb', alpha: 1 });
  hatch(g, outer, { angle: 0.9, spacing: 3, color: '#4a3622', alpha: 0.45, seed: 5, width: 0.6 });
  const sill = [[WIN.x - R - 26, WIN.y + WIN.h + R * 0.6], [WIN.x + WIN.w + R + 120, WIN.y + WIN.h + R * 0.6], [WIN.x + WIN.w + R + 114, WIN.y + WIN.h + R * 0.6 + 22], [WIN.x - R - 20, WIN.y + WIN.h + R * 0.6 + 22]];
  wash(g, sill, { color: '#c9b690', alpha: 0.95 });
  hatch(g, [sill[3], sill[2], [sill[2][0], sill[2][1] + 30], [sill[3][0], sill[3][1] + 30]], { angle: 0.1, spacing: 2.6, color: '#3a2c1c', alpha: 0.35, seed: 9, width: 0.6 });
  dusk(g, dark ? DUSK.shade : null);
}

/** Each pane's own shell: milky, with growth lines around one corner, painted once. */
function shells(g, panes, dark) {
  panes.forEach(p => {
    const shape = paneShape(p), path = pathOf(shape), r = rng(p.seed);
    g.save(); g.clip(path);
    g.fillStyle = `rgba(246,238,224,${0.56 + p.tone * 0.06})`; g.fill(path);
    const bx = shape.map(q => q[0]), by = shape.map(q => q[1]);
    const x0 = Math.min(...bx), x1 = Math.max(...bx), y0 = Math.min(...by), y1 = Math.max(...by);
    const ox = p.corner & 1 ? x1 + 6 : x0 - 6, oy = p.corner & 2 ? y1 + 6 : y0 - 6;
    for (let k = 0; k < 11; k++) {
      const rr = 10 + k * r.range(5, 8), ring = [];
      for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU; ring.push([ox + Math.cos(a) * rr, oy + Math.sin(a) * rr * r.range(0.8, 1.1)]); }
      ink(g, ring, { width: 0.6, color: '#8a7358', alpha: 0.3, jitter: 0.6, seed: p.seed + k, closed: true });
    }
    g.restore();
  });
  dusk(g, dark ? DUSK.shade : null);
}

// ── Live drawing (per frame) ─────────────────────────────────────────────

/**
 * Rasika OP2, part two: the governor's resolution step-down alone still left
 * the active (pointer-tracking) case at 1.68x Paus. A pane's outline never
 * changes — only its gradient does, as the sun moves — so rebuilding all 59
 * `paneShape()` arrays and `Path2D`s from scratch every single frame was the
 * real remaining cost, not the pixels. `paths` are built once per seed
 * (paintCached(), alongside the room and shell layers) and reused here; only
 * the gradient, which is genuinely live, is made fresh each frame.
 *
 * `sun` used to be baked into a clone of every pane, every frame
 * (`data.panes.map(p => ({ ...p, sunX, sunY }))`), just so this loop could
 * read it back off each one. Passed straight through instead — one
 * allocation removed from the hot path, not fifty-nine.
 */
function glass(g, GLASS, panes, paths, brighten, tiny, sun) {
  g.save();
  g.clip(GLASS);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.globalAlpha = 0.85;
  g.drawImage(tiny, 0, 0, tiny.width, tiny.height, 0, 0, W, H);
  g.restore();
  g.save();
  for (let i = 0; i < panes.length; i++) {
    const p = panes[i], { hue, near } = p;
    const ang = Math.atan2(p.cy - sun.y, p.cx - sun.x), d = 28;
    const gr = g.createLinearGradient(p.cx - Math.cos(ang) * d, p.cy - Math.sin(ang) * d, p.cx + Math.cos(ang) * d, p.cy + Math.sin(ang) * d);
    const a = Math.min(1, (0.1 + near * 0.26) * brighten);
    gr.addColorStop(0, `hsla(${hue},75%,78%,0)`);
    gr.addColorStop(0.35, `hsla(${hue},75%,76%,${a})`);
    gr.addColorStop(0.65, `hsla(${(hue + 70) % 360},70%,78%,${a * 0.8})`);
    gr.addColorStop(1, `hsla(${(hue + 140) % 360},70%,80%,0)`);
    g.fillStyle = gr; g.fill(paths[i]);
  }
  g.restore();
}

function frame(g, PANES, b, dark) {
  const teak = '#4a2e1a';
  const pw = WIN.w / 7, ph = WIN.h / 7;
  g.save();
  g.fillStyle = teak;
  for (let i = 1; i < 7; i++) g.fillRect(WIN.x + i * pw - 2.5, WIN.y, 5, WIN.h);
  for (let j = 1; j < 7; j++) g.fillRect(WIN.x, WIN.y + j * ph - 2.5, WIN.w, 5);
  g.strokeStyle = teak; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.arc(ARCH.cx, ARCH.cy, ARCH.r * 0.46, Math.PI, TAU); g.stroke();
  for (let k = 1; k < 7; k++) { const a = Math.PI + (k / 7) * Math.PI; g.moveTo(ARCH.cx + Math.cos(a) * ARCH.r * 0.46, ARCH.cy + Math.sin(a) * ARCH.r * 0.46); g.lineTo(ARCH.cx + Math.cos(a) * ARCH.r, ARCH.cy + Math.sin(a) * ARCH.r); }
  for (let k = 1; k < 3; k++) { const a = Math.PI + (k / 3) * Math.PI; g.moveTo(ARCH.cx, ARCH.cy); g.lineTo(ARCH.cx + Math.cos(a) * ARCH.r * 0.46, ARCH.cy + Math.sin(a) * ARCH.r * 0.46); }
  g.stroke();
  g.fillRect(WIN.x - 4, WIN.y - 5, WIN.w + 8, 10);
  g.lineWidth = 16; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(WIN.x - 4, WIN.y + WIN.h + 4); g.lineTo(WIN.x - 4, WIN.y); g.arc(ARCH.cx, ARCH.cy, ARCH.r + 4, Math.PI, TAU); g.lineTo(WIN.x + WIN.w + 4, WIN.y + WIN.h + 4); g.closePath(); g.stroke();
  g.restore();
  const o = { width: 1.3, color: INK, alpha: 0.75, jitter: 0.5 };
  const arch = [];
  for (let i = 0; i <= 40; i++) { const a = Math.PI + (i / 40) * Math.PI; arch.push([ARCH.cx + Math.cos(a) * (ARCH.r + 12), ARCH.cy + Math.sin(a) * (ARCH.r + 12)]); }
  ink(g, [[WIN.x - 12, WIN.y + WIN.h + 12], [WIN.x - 12, WIN.y], ...arch.slice(1, -1), [WIN.x + WIN.w + 12, WIN.y], [WIN.x + WIN.w + 12, WIN.y + WIN.h + 12]], { ...o, seed: b + 1 });
  ink(g, [[WIN.x - 12, WIN.y + WIN.h + 12], [WIN.x + WIN.w + 12, WIN.y + WIN.h + 12]], { ...o, seed: b + 2 });
  dusk(g, dark ? DUSK.shade : null);
}

function spill(g, sun, dark) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const sy = WIN.y + WIN.h + 24, sx = clamp(sun.x, WIN.x, WIN.x + WIN.w);
  const gr = g.createRadialGradient(sx, sy, 4, sx, sy, 260);
  // after dark, the same spill reads as a lamp's warm pool rather than sun on a sill: a touch brighter, so it still registers against the dusk-darkened room
  gr.addColorStop(0, dark ? 'rgba(255,206,140,0.4)' : 'rgba(255,226,170,0.28)'); gr.addColorStop(1, 'rgba(255,226,170,0)');
  g.translate(sx, sy); g.scale(1, 0.35); g.fillStyle = gr; g.translate(-sx, -sy); g.fillRect(sx - 270, sy - 270, 540, 540);
  g.restore();
  const dx = clamp((WIN.x + WIN.w / 2 - sun.x) * 0.08, -30, 30);
  g.save(); g.globalAlpha = 0.18; g.fillStyle = '#2d2418';
  g.beginPath(); g.moveTo(WIN.x, WIN.y + WIN.h + 18); g.lineTo(WIN.x + WIN.w, WIN.y + WIN.h + 18); g.lineTo(WIN.x + WIN.w + dx, WIN.y + WIN.h + 40); g.lineTo(WIN.x + dx, WIN.y + WIN.h + 40); g.fill();
  g.restore();
}

// ── The renderer, mounted to fill any host box edge to edge (cover-fit) ────

/**
 * @param {HTMLElement} host
 * @param {{ seed?: number|string, register?: string, reducedMotion?: boolean, onReady?: () => void }} opts
 */
export function mount(host, { seed = 1, register = 'warm', reducedMotion = false, onReady } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const g = canvas.getContext('2d');

  // Rasika OS1: read the page's theme (the nearest [data-theme] ancestor, or
  // the system preference), so a dark page gets the plate's own dusk
  // palette instead of a daytime room. host is plain light DOM (0005: no
  // shadow DOM), so a direct closest() works, unlike a scene's shadow host.
  const darkMQ = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const readDark = () => {
    const v = host.closest?.('[data-theme]')?.getAttribute('data-theme');
    return v === 'dark' || (v !== 'light' && !!darkMQ?.matches);
  };
  let dark = readDark();

  const tiny = document.createElement('canvas');
  tiny.width = Math.round(W * OUT_SCALE); tiny.height = Math.round(H * OUT_SCALE);
  const tg = tiny.getContext('2d');

  const GLASS_ARCH = [];
  for (let i = 0; i <= 40; i++) { const a = Math.PI + (i / 40) * TAU / 2; GLASS_ARCH.push([ARCH.cx + Math.cos(a) * ARCH.r, ARCH.cy + Math.sin(a) * ARCH.r]); }
  const GLASS = (() => { const p = new Path2D(); p.rect(WIN.x, WIN.y, WIN.w, WIN.h); p.addPath(pathOf(GLASS_ARCH)); return p; })();

  let px = 1, cw = 0, ch = 0;
  const roomLayer = document.createElement('canvas');
  const shellLayer = document.createElement('canvas');
  const frameLayer = document.createElement('canvas');
  // Rasika OP2: the glass sheen (59 gradients, recomputed and filled every
  // frame the sun moves, which under a pointer is every frame) is the one
  // layer that genuinely cannot be cached like room/shells/frame — its
  // colours are a live function of the pointer. Painted into its own
  // offscreen layer, kept at native W×H (never resized: see paintGlass's
  // comment for why a smaller layer stretched up made things WORSE, not
  // better), and blitted with one 1:1 drawImage, same as every other layer here.
  const glassLayer = document.createElement('canvas');
  glassLayer.width = W; glassLayer.height = H;
  let cachedKey = null, frameTick = null, panePaths = null;
  const glassGov = createGovernor({ target: 1000 / 60, slow: 1.4, fast: 1.15, window: 30 });

  function fit() {
    const rect = host.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = Math.max(1, rect.width || host.clientWidth || 1);
    ch = Math.max(1, rect.height || host.clientHeight || 1);
    const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; canvas.height = ph; px = pw / cw;
      [roomLayer, shellLayer, frameLayer].forEach(c => { c.width = W; c.height = H; });
      frameTick = null; // the frame layer's size changed too: force a repaint below
    }
  }

  function paintCached(panes) {
    room(roomLayer.getContext('2d'), dark);
    shells(shellLayer.getContext('2d'), panes, dark);
    // each pane's outline is fixed by its seed; only its gradient moves with
    // the sun, so the Path2D itself is built once here, not every frame (see
    // glass()'s comment — this is what actually fixed the active/moving case)
    panePaths = panes.map(p => pathOf(paneShape(p)));
    cachedKey = `${seed}:${dark}`;
  }

  /** The woodwork's ink only actually changes on a boil tick (every 200ms);
   *  painting it fresh every animation frame was pure waste (measured against
   *  the Paus baseline in the same perf run: A7). Cache it, like room/shells. */
  function paintFrame(panes, tick) {
    const fg = frameLayer.getContext('2d');
    fg.clearRect(0, 0, W, H);
    frame(fg, panes, tick, dark);
    frameTick = tick;
  }

  /**
   * Rasika OP2, part three. The first version of this governor shrank the
   * glass layer under load and stretched it back up with one drawImage,
   * matching Paus's own fog technique. Profiled it (dbg-profile3.mjs, not
   * committed) against the active/pointer case once the governor was
   * actually engaging (see the fix above — it wasn't, at first, another
   * wrong instrument), by timing each stage of draw() with
   * performance.now(). The stretch blit itself — `drawImage` upsampling a
   * shrunk source back to full size — was the single largest cost by nearly
   * an order of magnitude over every other stage combined (about 3.1ms of
   * every active frame, against 0.15-0.4ms for the same-size blits of
   * room/shell/frame): resampling a magnified image is expensive in canvas
   * 2D, and it ate the entire saving the smaller source was meant to buy.
   * Paus's fog can shrink because a blur is the desired look at any
   * resolution; Carepa's sheen has real gradient edges a shrink-then-stretch
   * softens for no benefit here, at real cost.
   *
   * So the layer stays at native W×H always — every blit of it is a cheap
   * 1:1 copy — and the governor's lever is frequency instead: at its lowest
   * level, only repaint the gradients on every third active frame, holding
   * the last real frame between repaints (Paus's own `fogEvery` idea, just
   * applied to a repaint count rather than a resolution). The genuinely
   * costly ~3ms/frame drawImage cost never happens at all now.
   */
  let glassFrame = 0;
  function paintGlass(panes, sun, brighten) {
    glassFrame++;
    const every = glassGov.level >= 0.75 ? 1 : glassGov.level >= 0.5 ? 2 : 5;
    if (glassFrame % every !== 0) return; // hold the last painted frame
    const scaleDown = glassGov.level < 0.5 ? 0.25 : glassGov.level < 0.75 ? 0.5 : 1; // see the blit's own comment below
    const gw = Math.round(W * scaleDown), gh = Math.round(H * scaleDown);
    if (glassLayer.width !== gw || glassLayer.height !== gh) { glassLayer.width = gw; glassLayer.height = gh; }
    const gg = glassLayer.getContext('2d');
    gg.setTransform(scaleDown, 0, 0, scaleDown, 0, 0);
    gg.clearRect(0, 0, W, H);
    glass(gg, GLASS, panes, panePaths, brighten, tiny, sun);
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  ro?.observe(host);
  fit();

  let ptr = null, destroyed = false;
  function draw(t) {
    if (destroyed) return;
    if (!cw || !ch) fit();
    const data = model({ time: t, seed, register, params: ptr && ptr.inside ? { sun: { x: ptr.x, y: ptr.y } } : {} });
    const key = `${seed}:${dark}`;
    if (cachedKey !== key) { paintCached(data.panes); frameTick = null; }
    outside(tg, t, data.sun, dark);
    g.setTransform(px, 0, 0, px, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cw, ch);
    // cover-fit: scale the 1200x820 window to fill the host, centred, never letterboxed
    const scale = Math.max(cw / W, ch / H);
    g.save();
    g.translate((cw - W * scale) / 2, (ch - H * scale) / 2);
    g.scale(scale, scale);
    g.drawImage(roomLayer, 0, 0);
    paintGlass(data.panes, data.sun, data.brighten);
    // Rasika OP2, part three: profiled (dbg-profile3.mjs, not committed) a
    // first version that shrank this layer under load and stretched it back
    // up here with the default bilinear/bicubic smoothing. That resample was
    // the single largest cost in the whole frame by nearly an order of
    // magnitude, worse than the fill work it was meant to save. Turning
    // smoothing off for this one blit (nearest-neighbour) keeps the real win
    // — fewer pixels to rasterise in glass() itself — without paying for
    // interpolation; a slightly blocky sheen for a moment under real load
    // reads fine (it's already the quiet, mostly-still layer under a modal).
    const wasSmooth = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = glassLayer.width === W;
    g.drawImage(glassLayer, 0, 0, glassLayer.width, glassLayer.height, 0, 0, W, H);
    g.imageSmoothingEnabled = wasSmooth;
    g.drawImage(shellLayer, 0, 0);
    spill(g, data.sun, dark);
    const tick = boil(t, 5);
    if (frameTick !== tick) paintFrame(data.panes, tick);
    g.drawImage(frameLayer, 0, 0);
    g.restore();
  }

  // ── the loop: no run() from the engine, since a surface fills its host at
  // whatever aspect the host has, rather than locking one via CSS aspect-ratio
  //
  // Rasika OP2: "draw only when something changes." Without a pointer, the
  // window's only motion is the sun's slow ambient drift and the woodwork's
  // boil tick (every 200ms) — nothing a viewer can perceive between one
  // 16.7ms frame and the next. A modal backdrop is mostly this case: open,
  // nobody hovering it. So the idle path redraws only on a boil tick (about
  // 5 times a second, matching the one thing that's actually changed), and
  // the interactive path — the pointer genuinely inside, sun tracking it —
  // stays at full rAF rate for responsiveness, backed by the governor above.
  //
  // The governor samples the real inter-frame interval (rAF's own `now`
  // deltas — the same signal Paus's own governor watches: `own.sample(dt *
  // 1000)` from its loop's real dt, in render.js), not the synchronous
  // JS time inside draw(). A first version measured performance.now() around
  // draw()'s own body and never saw a slow frame, even while perf.mjs's own
  // rAF-delta measurement showed the page dropping most of its frames: the
  // real cost here is canvas rasterisation happening after draw() returns
  // its commands, invisible to a synchronous timer around the call. A7 again
  // — the instrument answered "was the JS slow", not "was the frame slow".
  let raf = 0, playing = false, t0 = performance.now() / 1000, tAcc = 0, lastTick = -1, lastNow = 0;
  function frame_(now) {
    raf = requestAnimationFrame(frame_);
    if (lastNow) glassGov.sample(now - lastNow);
    lastNow = now;
    const t = tAcc + (now / 1000 - t0);
    const active = !!(ptr && ptr.inside);
    const tick = boil(t, 5);
    if (active || tick !== lastTick) { lastTick = tick; draw(t); }
  }
  function play() { if (playing || destroyed) return; playing = true; t0 = performance.now() / 1000; lastNow = 0; raf = requestAnimationFrame(frame_); }
  function pause() { playing = false; cancelAnimationFrame(raf); }

  if (typeof PointerEvent !== 'undefined') {
    ptr = { x: ARCH.cx, y: ARCH.cy, inside: false };
    const at = e => {
      const r = canvas.getBoundingClientRect();
      const scale = Math.max(cw / W, ch / H);
      ptr.x = (e.clientX - r.left - (cw - W * scale) / 2) / scale;
      ptr.y = (e.clientY - r.top - (ch - H * scale) / 2) / scale;
      ptr.inside = true;
      if (!playing) draw(tAcc + (performance.now() / 1000 - t0));
    };
    host.addEventListener('pointermove', at);
    host.addEventListener('pointerleave', () => { ptr.inside = false; });
  }

  // reduced motion: one finished still, nothing moving (A2, charter's register table)
  const still = reducedMotion
    ? () => { tAcc = 4.2; ptr = ptr ? { ...ptr, inside: false } : null; draw(4.2); }
    : () => { pause(); draw(tAcc); };

  const onThemeChange = () => { const d = readDark(); if (d !== dark) { dark = d; if (!playing) draw(tAcc); } };
  darkMQ?.addEventListener?.('change', onThemeChange);

  if (reducedMotion) still(); else play();
  Promise.resolve().then(() => onReady?.());

  return {
    canvas,
    play, pause, still,
    setRegister(r) { register = r; if (!playing) draw(tAcc); },
    reseed(s) { seed = s; cachedKey = null; if (!playing) draw(tAcc); },
    get playing() { return playing; },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      darkMQ?.removeEventListener?.('change', onThemeChange);
      canvas.remove();
    },
  };
}
