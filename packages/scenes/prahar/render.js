// Prahar: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the ridges, the river, the paddy, the palms, the chapel, the
// shrine and the house are the plate's own drawing code. So is its perf fix:
// every land layer is painted once as a black mask, then tinted into two
// group canvases that are repainted only when a layer's colour has moved more
// than 2 of 255, so most frames are one blit per group (about 18 ms a frame
// in the sketchbook, down from 45). The port adds the registers, the hour as
// real state, the ruler under the keys, the calm zone, the token paper and
// ink for the ruler strip, the library's own Kalam, and a frame skip.

import { stage, rng, N, lerp, TAU, ink, hatch, wash, ellipse, catmull, smoothstep, hexToRgb, roughen, paper } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, HORIZON, RIVER_BOT, LAND_BOT, RULER, WATCHES, rulerX, hourAtX, fmt, wrapHour, skyAt, watchAt, UNITS_PER_HOUR } from './model.js';

const HAND = '"Kalam", "Segoe Print", cursive';
const css = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;
const hexMix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return A.map((v, i) => Math.round(lerp(v, B[i], t))); };
const rgbMix = (A, B, t) => A.map((v, i) => Math.round(lerp(v, B[i], t)));

// ── Layers, painted once as masks (the plate's own) ────────────────────────

const ridge = (y0, amp, seed, f = 0.004) => {
  const pts = [[0, HORIZON + 4]];
  for (let x = 0; x <= W; x += 8) pts.push([x, y0 - amp * (0.5 + 0.5 * N.fbm(x * f, seed, 0.3, 4)) - amp * 0.35 * Math.sin(x * 0.0021 + seed)]);
  pts.push([W, HORIZON + 4]);
  return pts;
};

function palm(g, x, y, h, lean, seed, frond = 1) {
  const topX = x + lean * h, topY = y - h;
  ink(g, catmull([[x, y], [x + lean * h * 0.3 + 4, y - h * 0.45], [topX, topY]], 8), { width: 5 * frond, color: '#000', jitter: 0.5, seed, taper: 30, pressure: 0.2 });
  const r = rng(`p${seed}`);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i / 8 - 0.5) * 3.7 + r.range(-0.1, 0.1), len = r.range(46, 68) * frond;
    const pts = [];
    for (let s = 0; s <= 8; s++) { const u = s / 8; pts.push([topX + Math.cos(a) * len * u, topY + Math.sin(a) * len * u + u * u * 30 * frond]); }
    ink(g, pts, { width: 3.4 * frond, color: '#000', jitter: 0.4, seed: seed * 3 + i, taper: 20 });
    for (let s = 2; s < 8; s++) for (const side of [-1, 1]) ink(g, [pts[s], [pts[s][0] + side * 4 * frond, pts[s][1] + 9 * frond]], { width: 1.3, color: '#000', jitter: 0.2, seed: seed * 7 + i * 9 + s, taper: 3 });
  }
}

export const WINDOWS = [[918, 590, 24, 30], [884, 574, 12, 22], [964, 574, 12, 22], [404, 612, 22, 22], [456, 612, 22, 22], [536, 612, 22, 22], [496, 610, 18, 36]];

const LAYERS = {
  far(g) { wash(g, ridge(330, 120, 2, 0.006), { color: '#000000', alpha: 1, grainy: false }); },
  near(g) {
    const p = ridge(384, 84, 7, 0.009);
    wash(g, p, { color: '#000000', alpha: 1, grainy: false });
    hatch(g, p, { angle: 0.9, spacing: 4, color: '#000', alpha: 0.35, seed: 3, width: 0.7 });
  },
  bank(g) {
    // the far bank: a low line of palms and mangrove
    const bank = [[0, HORIZON + 6], ...Array.from({ length: 61 }, (_, i) => [i * 20, HORIZON - 10 - 8 * N(i * 0.3, 4.4) * 2]), [W, HORIZON + 6]];
    wash(g, bank, { color: '#000', alpha: 1, grainy: false });
    const r = rng('bank');
    for (let i = 0; i < 26; i++) palm(g, r.range(0, W), HORIZON - 4, r.range(34, 58), r.range(-0.2, 0.2), 100 + i, 0.5);
  },
  fields(g) {
    const land = [[0, RIVER_BOT], [W, RIVER_BOT - 6], [W, LAND_BOT], [0, LAND_BOT]];
    wash(g, land, { color: '#000', alpha: 1, grainy: false });
    // paddy rows in perspective, and bunds between the plots, carved out of the mask
    g.globalCompositeOperation = 'destination-out';
    const pr = rng('plots');
    for (let k = 0; k < 6; k++) {
      const y = lerp(RIVER_BOT + 10, LAND_BOT - 10, Math.pow((k + 0.5) / 6, 1.4));
      const pts = [];
      for (let x = -10; x <= W + 10; x += 40) pts.push([x, y + 5 * N(x * 0.004, k * 3.1) * (1 + k * 0.4)]);
      ink(g, pts, { width: 1.2 + k * 0.5, color: '#fff', alpha: 0.28, jitter: 0.8, seed: 30 + k, taper: 0 });
      for (let j = 0; j < 4 + k; j++) {
        const x = pr.range(0, W), y2 = lerp(RIVER_BOT + 10, LAND_BOT - 10, Math.pow(Math.min(1, (k + 1.5) / 6), 1.4));
        ink(g, [[x, y], [x + (x - 600) * 0.12, y2]], { width: 0.9 + k * 0.3, color: '#fff', alpha: 0.2, jitter: 0.6, seed: 60 + k * 10 + j, taper: 6 });
      }
    }
    hatch(g, land, { angle: -1.45, spacing: 4.5, color: '#fff', alpha: 0.16, seed: 8, width: 0.7, seg: [3, 8], gap: 0.9 });
    g.globalCompositeOperation = 'source-over';
  },
  dark(g) {
    // palms, roofs and trees in the foreground
    palm(g, 90, LAND_BOT, 300, 0.14, 1, 1.25);
    palm(g, 180, LAND_BOT, 230, -0.08, 2, 1.1);
    palm(g, 1090, LAND_BOT, 280, -0.12, 3, 1.2);
    palm(g, 760, LAND_BOT - 30, 190, 0.06, 4, 0.95);
    // chapel roof and belfry cross, house roof
    wash(g, roughen([[866, 548], [930, 506], [994, 548]], { amp: 0.8, seed: 2 }), { color: '#000', alpha: 1, grainy: false });
    ink(g, [[930, 470], [930, 504]], { width: 3, color: '#000', jitter: 0.2, seed: 5, taper: 0 });
    ink(g, [[920, 480], [940, 480]], { width: 3, color: '#000', jitter: 0.2, seed: 6, taper: 0 });
    wash(g, roughen([[372, 600], [404, 566], [556, 566], [590, 600]], { amp: 0.8, seed: 3 }), { color: '#000', alpha: 1, grainy: false });
    g.globalCompositeOperation = 'destination-out';
    hatch(g, [[372, 600], [404, 566], [556, 566], [590, 600]], { angle: 1.5, spacing: 3.6, color: '#fff', alpha: 0.3, seed: 9, width: 0.6, seg: [3, 7], gap: 0.3 });
    g.globalCompositeOperation = 'source-over';
    // the shrine's little dome and the tulsi planter
    wash(g, [[286, 628], ...ellipse(300, 628, 14, 18, { start: Math.PI, end: TAU, n: 12 }).slice(1, -1), [314, 628]], { color: '#000', alpha: 1, grainy: false });
    ink(g, [[300, 606], [300, 596]], { width: 2, color: '#000', jitter: 0.2, seed: 7, taper: 0 });
    const tulsi = rng('tulsi');
    for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + tulsi.range(-1.1, 1.1); ink(g, [[238, 626], [238 + Math.cos(a) * tulsi.range(10, 20), 626 + Math.sin(a) * tulsi.range(10, 20)]], { width: 1.4, color: '#000', jitter: 0.3, seed: 200 + i, taper: 4 }); }
    // a mango tree behind the house
    wash(g, roughen(ellipse(640, 548, 70, 48, { n: 40 }), { amp: 7, freq: 0.08, seed: 4 }), { color: '#000', alpha: 1, grainy: false });
    ink(g, [[640, 596], [636, 640]], { width: 6, color: '#000', jitter: 0.4, seed: 8, taper: 0 });
  },
  light(g) {
    // whitewash: the chapel front, the house walls, the shrine and the planter
    wash(g, [[872, 548], [988, 548], [988, 640], [872, 640]], { color: '#000', alpha: 1, grainy: false });
    wash(g, [[380, 600], [582, 600], [582, 646], [380, 646]], { color: '#000', alpha: 1, grainy: false });
    wash(g, [[288, 628], [312, 628], [312, 652], [288, 652]], { color: '#000', alpha: 1, grainy: false });
    wash(g, [[226, 626], [250, 626], [248, 652], [228, 652]], { color: '#000', alpha: 1, grainy: false });
  },
  outline(g) {
    const o = { width: 1.2, color: '#000', jitter: 0.4, taper: 0 };
    ink(g, [[872, 640], [872, 548], [930, 506], [988, 548], [988, 640]], { ...o, seed: 1 });
    ink(g, [[380, 646], [380, 600], [582, 600], [582, 646]], { ...o, seed: 2 });
    for (const [x, y, w, h] of WINDOWS) ink(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { ...o, width: 1, seed: x, closed: true });
    ink(g, [[0, LAND_BOT], [W, LAND_BOT]], { ...o, seed: 9 });
  },
};

/** Day and night colours for each layer; far layers fade toward the horizon. */
const PAL = {
  far: ['#7f97b5', '#1d2440', 0.55],
  near: ['#5d7d8c', '#171d33', 0.3],
  bank: ['#3f5a3a', '#0f1422', 0.15],
  fields: ['#7a9a45', '#1a2328', 0],
  dark: ['#2f3d27', '#0b0f1a', 0],
  light: ['#f1ebdd', '#48506e', 0],
  outline: ['#1d2742', '#0a0d18', 0],
};

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ── The renderer ──────────────────────────────────────────────────────────

export function createRenderer(host, { scene: sceneEl = null, invalidate = () => {}, advance = () => {} } = {}) {
  const st = stage(host, { W, H });
  let colors = null, scratch = null, lastKey = '', drag = null, kb = null, stats = { frames: 0, tints: 0 };
  st.onresize = () => { lastKey = ''; invalidate(); };
  host.dataset.tints = '0/0';

  function palette() {
    return (colors ??= readColors(host, {
      paper: 'var(--sg-paper, light-dark(#efe8da, #151a2b))',
      ink: 'var(--sg-ink, light-dark(#1d2742, #ebe5d6))',
      soft: 'var(--sg-ink-soft, light-dark(#48526e, #bdb7a8))',
      brass: 'var(--sg-prahar-bead, #b98a3e)',
    }));
  }

  // Tinting is two full-canvas passes per layer, so the tinted land is kept in
  // two group canvases and repainted only when the light has visibly changed.
  const groups = { back: { keys: ['far', 'near'], canvas: null, sig: null, size: '' }, front: { keys: ['bank', 'fields', 'light', 'dark', 'outline'], canvas: null, sig: null, size: '' } };
  function tintInto(dst, key, color, alpha) {
    const mask = st.cached(key, gg => LAYERS[key](gg));
    if (!scratch || scratch.width !== mask.width || scratch.height !== mask.height) {
      scratch = document.createElement('canvas'); scratch.width = mask.width; scratch.height = mask.height;
    }
    const sg = scratch.getContext('2d');
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'copy'; sg.drawImage(mask, 0, 0);
    sg.globalCompositeOperation = 'source-in'; sg.fillStyle = css(color); sg.fillRect(0, 0, scratch.width, scratch.height);
    dst.globalAlpha = alpha; dst.drawImage(scratch, 0, 0); dst.globalAlpha = 1;
  }
  // A repaint is one tinted layer per frame into a spare canvas, swapped in
  // when the last layer lands: the light moves slowly enough that five frames
  // of lag never show, and no single frame pays for the whole group. A still
  // (or a new size) paints the whole group at once, so it is right first time.
  const blank = () => { const cv = document.createElement('canvas'); cv.width = st.canvas.width; cv.height = st.canvas.height; return cv; };
  const clear = cv => { const dg = cv.getContext('2d'); dg.setTransform(1, 0, 0, 1, 0, 0); dg.clearRect(0, 0, cv.width, cv.height); return dg; };
  const layerOf = (gr, dg, cols, i) => tintInto(dg, gr.keys[i], cols[i], gr.keys[i] === 'outline' ? 0.8 : 1);
  function group(g, name, tone, sync) {
    const gr = groups[name], cols = gr.keys.map(tone), sig = cols.flat();
    const size = st.canvas.width + 'x' + st.canvas.height;
    if (!gr.canvas || gr.size !== size) {
      gr.canvas = blank(); gr.spare = null; gr.job = null; gr.size = size;
      const dg = clear(gr.canvas); gr.keys.forEach((_, i) => layerOf(gr, dg, cols, i));
      gr.sig = sig; stats.tints++;
    } else if (!gr.job && sig.some((v, i) => Math.abs(v - gr.sig[i]) > 2)) {
      const cv = gr.spare ?? blank();
      gr.job = { cv, dg: clear(cv), cols, sig, i: 0 };
    }
    const job = gr.job;
    if (job) {
      do layerOf(gr, job.dg, job.cols, job.i++); while (sync && job.i < gr.keys.length);
      if (job.i >= gr.keys.length) { gr.spare = gr.canvas; gr.canvas = job.cv; gr.sig = job.sig; gr.job = null; stats.tints++; }
    }
    g.drawImage(gr.canvas, 0, 0, W, H);
  }
  const busy = () => !!(groups.back.job || groups.front.job);

  // Canvas text never asks for a web font: load Kalam (Latin and Devanagari) ourselves.
  if (document.fonts?.load) {
    Promise.all([document.fonts.load(`300 16px ${HAND}`, 'Yaman यमन'), document.fonts.load(`400 34px ${HAND}`, 'Yaman यमन')])
      .then(() => { lastKey = ''; invalidate(); }, () => {});
  }

  /** The hour on show: a drag or the keyboard hand beats the clock, until let go. */
  function hourOf(data, frame) {
    const p = frame.pointer, look = data.look;
    if (!look.scrub || data.held) { drag = kb = null; return data.hour; }
    if (p.keyboard && p.inside) {
      // the core's keyboard hand starts at the middle; each move of it nudges the day by its length in hours
      kb ??= { x: W / 2 };
      if (p.x !== kb.x) { advance(((p.x - kb.x) / UNITS_PER_HOUR / 24) * look.day); kb.x = p.x; }
      return data.hour;
    }
    kb = null;
    if (p.down && p.inside && (drag != null || p.y > LAND_BOT)) { drag = hourAtX(p.x); return drag; }
    if (drag != null) {
      // let go: the day carries on from the dragged hour
      advance(((wrapHour(drag - data.hour + 12) - 12) / 24) * look.day);
      const h = drag; drag = null; return h;
    }
    return data.hour;
  }

  function render(data, frame) {
    const c = palette(), look = data.look, calm = frame.calm || [], still = frame.still;
    const hour = hourOf(data, frame), sky = hour === data.hour ? data.sky : skyAt(hour), w = watchAt(hour);
    const t = still || data.held ? 0 : data.time; // a held hour holds everything: time stands still
    // ripples and stars are drawn a dozen times a second; the light changes slower than that
    const tick = still || data.held ? 0 : Math.floor(t * 12);
    const calmKey = calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
    // redrawn a dozen times a second while the day turns; at once for a drag, a key, a held hour or a still
    const moving = !still && !data.held && hour === data.hour;
    const key = `${moving ? tick : hour.toFixed(3)}|${calmKey}|${st.canvas.width}|${frame.epoch}|${c.paper}`;
    if (key === lastKey && !busy()) return;
    lastKey = key;
    stats.frames++;
    host.dataset.tints = `${stats.tints}/${stats.frames}`;
    host.dataset.hour = hour.toFixed(2); // for tools and dev pages: the hour on show

    const g = st.begin(), b = Math.floor(t * 5);
    const quality = frame.quality ?? 1;
    st.blit(st.cached('paper', gg => paper(gg, W, H, { base: '#efe8da', seed: 12, vignette: 0.05 })));
    // sky
    const gr = g.createLinearGradient(0, 0, 0, HORIZON);
    gr.addColorStop(0, css(sky.zenith)); gr.addColorStop(1, css(sky.horizon));
    g.fillStyle = gr; g.fillRect(0, 0, W, HORIZON + 6);
    // stars
    const night = 1 - smoothstep(0.08, 0.3, sky.light);
    if (night > 0.01) {
      const r = rng('prahar-stars'), n = Math.round(90 * Math.max(0.5, quality));
      for (let i = 0; i < n; i++) {
        const x = r() * W, y = r() * (HORIZON - 120), tw = look.twinkle ? 0.6 + 0.4 * N(t * 0.8 + i, 1.1) : 0.8;
        g.fillStyle = `rgba(255,246,222,${night * tw * r.range(0.3, 0.9)})`;
        g.beginPath(); g.arc(x, y, r.range(0.5, 1.5), 0, TAU); g.fill();
      }
    }
    // sun and moon on their arcs
    const body = (h0, h1, color, rad, glow) => {
      const span = wrapHour(h1 - h0), k = wrapHour(hour - h0);
      if (k > span) return;
      const f = k / span, x = lerp(80, W - 80, f), y = HORIZON + 20 - Math.sin(f * Math.PI) * 330;
      const gg = g.createRadialGradient(x, y, 0, x, y, rad * 7);
      gg.addColorStop(0, `rgba(${color},${glow})`); gg.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = gg; g.fillRect(x - rad * 7, y - rad * 7, rad * 14, rad * 14);
      g.fillStyle = `rgb(${color})`; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    };
    body(6.0, 18.5, sky.warm > 0.5 ? '255,196,130' : '255,244,214', 17, 0.5);
    body(18.8, 5.6, '236,236,222', 12, 0.25);
    // land layers, following the light
    const warmTint = [226, 150, 96];
    const tone = key => {
      const [day, nightC, haze] = PAL[key];
      let col = hexMix(nightC, day, sky.light);
      col = rgbMix(col, warmTint, sky.warm * (key === 'light' ? 0.28 : 0.16));
      return rgbMix(col, sky.horizon, haze);
    };
    group(g, 'back', tone, still || data.held);
    // the river mirrors the sky, darker, with ripples (held still under the page's words)
    const rv = g.createLinearGradient(0, HORIZON, 0, RIVER_BOT);
    rv.addColorStop(0, css(rgbMix(sky.horizon, [20, 26, 40], 0.18))); rv.addColorStop(1, css(rgbMix(sky.zenith, [20, 26, 40], 0.3)));
    g.fillStyle = rv; g.fillRect(0, HORIZON, W, RIVER_BOT - HORIZON + 8);
    for (let k = 0; k < 14; k++) {
      const y = HORIZON + 8 + k * 4.3, rip = look.ripples && !calm.some(r => y > r.y - 20 && y < r.y + r.h + 20);
      const x = ((k * 173 + (rip ? t : 0) * (6 + k)) % (W + 200)) - 100;
      ink(g, [[x, y], [x + 60 + k * 6, y]], { width: 0.9, color: '#ffffff', alpha: 0.16 + 0.2 * sky.light, jitter: 0.3, seed: (rip ? b : 0) + k, taper: 10 });
    }
    // the furrows show through the carved lines: a little lighter than the paddy, and dark at night
    g.fillStyle = css(rgbMix(tone('fields'), [236, 232, 200], 0.08 + 0.22 * sky.light));
    g.fillRect(0, RIVER_BOT - 8, W, LAND_BOT - RIVER_BOT + 8);
    group(g, 'front', tone, still || data.held);
    // windows glow after dusk
    const lamp = smoothstep(0.5, 0.15, sky.light);
    if (lamp > 0.01) {
      g.save(); g.globalCompositeOperation = 'lighter';
      WINDOWS.forEach(([x, y, ww, hh], i) => {
        const flick = look.twinkle && !calm.some(r => overlaps(r, { x, y, w: ww, h: hh })) ? N(t * 0.7, i) : 0;
        const on = lamp * (0.75 + 0.25 * flick);
        g.fillStyle = `rgba(255,190,100,${0.85 * on})`; g.fillRect(x, y, ww, hh);
        const gg = g.createRadialGradient(x + ww / 2, y + hh / 2, 2, x + ww / 2, y + hh / 2, 60);
        gg.addColorStop(0, `rgba(255,180,90,${0.25 * on})`); gg.addColorStop(1, 'rgba(255,180,90,0)');
        g.fillStyle = gg; g.fillRect(x - 60, y - 60, ww + 120, hh + 120);
      });
      g.restore();
    }
    // one sheet of paper grain over everything, so the paint sits in the same paper as the other plates
    g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; st.blit(st.cached('grain', gg => paper(gg, W, H, { base: '#ffffff', seed: 12, vignette: 0.1, mottle: 0.12, grain: 0.14 }))); g.restore();
    ruler(g, hour, sky, w, still ? 0 : b, c, calm, data.register);
  }

  function ruler(g, hour, sky, w, b, c, calm, register) {
    const { x0, x1, y } = RULER, quiet = register === 'quiet';
    g.save();
    g.fillStyle = c.paper; g.fillRect(0, LAND_BOT, W, H - LAND_BOT);
    ink(g, [[x0, y], [x1, y]], { width: quiet ? 0.9 : 1.3, color: c.ink, alpha: 0.8, jitter: quiet ? 0.1 : 0.5, seed: b + 1, taper: 0 });
    for (let hh = 0; hh <= 24; hh++) {
      const x = lerp(x0, x1, hh / 24), major = hh % 3 === 0;
      ink(g, [[x, y - (major ? 10 : 5)], [x, y]], { width: major ? 1.3 : 0.8, color: c.ink, alpha: 0.7, jitter: 0.2, seed: b + hh * 3, taper: 0 });
    }
    // on a narrow screen eight labels can't be read; keep the one for this watch, large enough to read (about 11 CSS px)
    const k = Math.max(1, (11 / 16) * (W / (st.canvas.clientWidth || W))), narrow = k > 1.4;
    g.font = `${narrow ? 400 : 300} ${16 * k}px ${HAND}`; g.textAlign = 'center';
    WATCHES.forEach((wt, i) => {
      const cur = wt === w;
      if (narrow && !cur) return;
      const xm = narrow ? Math.min(x1 - 150 * k, Math.max(x0 + 150 * k, lerp(x0, x1, (i * 3 + 1.5) / 24))) : lerp(x0, x1, (i * 3 + 1.5) / 24);
      if (calm.some(r => overlaps(r, { x: xm - 90, y: y - 20, w: 180, h: 80 }))) return; // under the page's words, or close to them
      g.fillStyle = cur ? c.ink : c.soft; g.globalAlpha = cur ? 1 : 0.9;
      g.fillText(`${wt.raga} · ${wt.deva}`, xm, y + 10 + 16 * k);
    });
    // the bead
    const bx = rulerX(hour);
    g.globalAlpha = 1;
    g.fillStyle = c.brass; g.beginPath(); g.arc(bx, y, 7, 0, TAU); g.fill();
    ink(g, ellipse(bx, y, 7, 7, { n: 16 }), { width: 1.1, color: c.ink, jitter: 0.2, seed: b + 99, closed: true });
    // the name of the hour, top left, over the sky, unless the page's words sit there
    if (!calm.some(r => overlaps(r, { x: 40, y: 30, w: 420, h: 84 }))) {
      const onDark = sky.light < 0.45;
      g.fillStyle = onDark ? '#f3ead6' : '#1d2742'; g.globalAlpha = 0.9; g.textAlign = 'left';
      const t = Math.min(k, 2.2); // the title grows with the ruler, to about 16 CSS px on a phone
      g.font = `400 ${34 * t}px ${HAND}`;
      g.fillText(`${w.raga}  ${w.deva}`, 56, 36 + 34 * t);
      g.font = `300 ${20 * t}px ${HAND}`; g.globalAlpha = 0.8;
      g.fillText(`${w.when}, ${fmt(hour)}`, 58, 44 + 56 * t);
    }
    g.restore();
  }

  return {
    render,
    setRegister() { lastKey = ''; drag = kb = null; },
    restyle() { colors = null; lastKey = ''; },
    destroy() { st.destroy(); },
  };
}
