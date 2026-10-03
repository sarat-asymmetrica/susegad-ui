// Abri: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the workshop table and tray, the size's sheen, the colour
// polygons with their veins, the ripples, the stylus, and the sheet laid from
// the left, lifted and turned over to show its print (deckle, paper grain,
// air bubbles) are the plate's own drawing code. What the port adds: the
// registers (quiet is the lifted print as a still, warm an easier sitting,
// playful a hand in the size), the build and the still in time slices behind
// a ready promise, the calm zone (the size under the page's words is held,
// drops do not land there, and the ripples and stylus keep off it), lamplight
// for the dark theme, and the governor's level for drawing on twos.

import { stage, ink, hatch, makeNoise, rng, lerp, smoothstep, phase, ease, TAU, paper, roughen, toPath } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import {
  W, H, BATH, SHEET, FW, FH, SIZE, plan, cloudRows, makeBath, stepBath, stylusAt, times, sheetSeed, stillAt, held,
} from './model.js';

function tray(g) {
  // the workshop table
  g.fillStyle = '#4a3627'; g.fillRect(0, 0, W, H);
  hatch(g, [[0, 0], [W, 0], [W, H], [0, H]], { angle: 0.02, spacing: 3, seg: [40, 160], gap: 0.1, width: 0.7, color: '#2a1d13', alpha: 0.35, wobble: 0.8, seed: 3 });
  // the tray's wooden rim, with its shadow on the table
  g.save(); g.shadowColor = 'rgba(20,10,4,0.45)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
  g.fillStyle = '#6a4a30'; g.fillRect(BATH.x0 - 34, BATH.y0 - 34, BATH.x1 - BATH.x0 + 68, BATH.y1 - BATH.y0 + 68); g.restore();
  const rim = [[BATH.x0 - 34, BATH.y0 - 34], [BATH.x1 + 34, BATH.y0 - 34], [BATH.x1 + 34, BATH.y1 + 34], [BATH.x0 - 34, BATH.y1 + 34]];
  hatch(g, rim, { angle: 0, spacing: 2.6, seg: [30, 120], gap: 0.12, width: 0.6, color: '#2d1d11', alpha: 0.35, seed: 7 });
  hatch(g, rim, { angle: 0, spacing: 7, seg: [16, 60], gap: 0.7, width: 0.55, color: '#b08660', alpha: 0.25, seed: 8 });
  ink(g, rim, { closed: true, width: 1.3, color: '#1e120a', alpha: 0.7, jitter: 0.5, seed: 9 });
  const inner = [[BATH.x0, BATH.y0], [BATH.x1, BATH.y0], [BATH.x1, BATH.y1], [BATH.x0, BATH.y1]];
  ink(g, inner, { closed: true, width: 1.6, color: '#1e120a', alpha: 0.8, jitter: 0.4, seed: 10 });
  const mitre = (a, b) => ink(g, [a, b], { width: 0.9, color: '#1e120a', alpha: 0.5, jitter: 0.3, seed: a[0] + b[1], taper: 4 });
  mitre(rim[0], inner[0]); mitre(rim[1], inner[1]); mitre(rim[2], inner[2]); mitre(rim[3], inner[3]);
}

/** The tray walls shade the edge of the size. */
function bathShade(g) {
  const edge = (x0, y0, x1, y1, a) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, `rgba(40,25,12,${a})`); gr.addColorStop(1, 'rgba(40,25,12,0)');
    g.fillStyle = gr;
  };
  edge(0, BATH.y0, 0, BATH.y0 + 26, 0.32); g.fillRect(BATH.x0, BATH.y0, BATH.x1 - BATH.x0, 26);
  edge(BATH.x0, 0, BATH.x0 + 22, 0, 0.26); g.fillRect(BATH.x0, BATH.y0, 22, BATH.y1 - BATH.y0);
  edge(BATH.x1, 0, BATH.x1 - 12, 0, 0.12); g.fillRect(BATH.x1 - 12, BATH.y0, 12, BATH.y1 - BATH.y0);
  edge(0, BATH.y1, 0, BATH.y1 - 10, 0.1); g.fillRect(BATH.x0, BATH.y1 - 10, BATH.x1 - BATH.x0, 10);
}

function deckle(seed) {
  const { x0, y0, x1, y1 } = SHEET;
  return roughen([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { amp: 2.4, freq: 0.22, seed: (typeof seed === 'number' ? seed : seed.length) * 0.37 + 4, step: 2 });
}

const PAPER = pg => paper(pg, W, H, { base: '#fbf7ee', seed: 11, vignette: 0, mottle: 0.035, grain: 0.12, fibers: 140 });

// ── The renderer ──────────────────────────────────────────────────────────

export function createRenderer(host, { invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const SW = 96, SH = Math.round((96 * (BATH.y1 - BATH.y0)) / (BATH.x1 - BATH.x0));
  const sheen = mk(SW, SH), sg = sheen.getContext('2d'), simg = sg.createImageData(SW, SH), snz = makeNoise('abri-sheen');

  let colors = null, sheetKey = null, sheetK = 0, baseSeed = null, epoch = -1;
  let pl = null, B = null, cloud = null, deck = null, deckPath = null, seed = null;
  let builder = null, built = false, start = null, stillDone = false;
  let layAt = Infinity, print = null, printFor = null, sheenRow = 0, lastKey = '', odd = false;
  let lastP = null, drops = 0;
  let resolveReady = null;
  const ready = new Promise(r => { resolveReady = r; });
  st.onresize = () => { lastKey = ''; print = null; invalidate(); };

  function palette() {
    return (colors ??= readColors(host, { dark: 'light-dark(#000000, #ffffff)' }));
  }

  function* prepare(s) {
    seed = s;
    pl = plan(s);
    cloud = { cx: new Float32Array(FW * FH), cy: new Float32Array(FW * FH) };
    for (let j = 0; j < FH; j += 8) { cloudRows(s, cloud.cx, cloud.cy, j, j + 8); yield; }
    B = makeBath(pl, cloud);
    deck = deckle(s); deckPath = toPath(deck, true);
    print = null; printFor = null; layAt = pl.lay; start = null; stillDone = false; lastP = null; drops = 0;
  }
  function build(budget) {
    const t0 = performance.now();
    while (!built && performance.now() - t0 < budget) if (builder.next().done) built = true;
    return built;
  }

  /** Run the tray forward to local time u in fixed steps, within a time budget; true once there. */
  function simulate(u, budget, dt = 1 / 60) {
    const t0 = performance.now(), stop = Math.min(u, times(layAt).lift);
    while (B.t + dt <= stop && performance.now() - t0 < budget) stepBath(B, dt);
    return B.t + dt > stop;
  }

  function fillPolys(g, alphaVeins = 0.3) {
    for (const q of B.polys) {
      const P = q.pts;
      g.beginPath(); g.moveTo(P[0], P[1]);
      for (let i = 2; i < P.length; i += 2) g.lineTo(P[i], P[i + 1]);
      g.closePath();
      g.fillStyle = q.col; g.fill();
      if (alphaVeins) { g.globalAlpha = alphaVeins; g.strokeStyle = '#3a3026'; g.stroke(); g.globalAlpha = 1; }
    }
  }

  // the light on the size: domain-warped noise, a few rows refreshed each frame
  function updateSheen(t, rows) {
    const d = simg.data, s = 0.05, z = t * 0.05;
    for (let n = 0; n < rows; n++) {
      const j = sheenRow; sheenRow = (sheenRow + 1) % SH;
      for (let i = 0; i < SW; i++) {
        const wx = snz.fbm(i * s, j * s * 1.4, z, 2), wy = snz(i * s + 3.1, j * s * 1.4, z + 5);
        const v = snz.fbm(i * s * 0.8 + 1.6 * wx, j * s + 1.6 * wy, z * 0.6 + 9, 3);
        const k = (j * SW + i) * 4;
        d[k] = 255; d[k + 1] = 252; d[k + 2] = 240; d[k + 3] = smoothstep(0.12, 0.45, v) * 70;
      }
    }
    sg.putImageData(simg, 0, 0);
    sg.save(); sg.scale(SW / (BATH.x1 - BATH.x0), SH / (BATH.y1 - BATH.y0)); sg.translate(-BATH.x0, -BATH.y0);
    bathShade(sg); sg.restore();
  }

  function capture() {
    const L = st.layer(), g = L.getContext('2d');
    g.save(); g.clip(deckPath);
    g.fillStyle = '#ece3cc'; g.fillRect(SHEET.x0 - 10, SHEET.y0 - 10, SHEET.x1 - SHEET.x0 + 20, SHEET.y1 - SHEET.y0 + 20);
    fillPolys(g, 0.22);
    // paper takes the colour a little paler, and its grain shows through
    g.fillStyle = 'rgba(246,240,226,0.12)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'multiply';
    st.blit(st.cached('paper', PAPER), g);
    g.globalCompositeOperation = 'source-over';
    const r = rng(`bubbles:${seed}`);
    for (let i = 0; i < r.int(5, 12); i++) {
      const x = r.range(SHEET.x0 + 20, SHEET.x1 - 20), y = r.range(SHEET.y0 + 20, SHEET.y1 - 20), rad = r.range(1.2, 4.5);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(248,243,230,0.95)'); gr.addColorStop(0.7, 'rgba(248,243,230,0.8)'); gr.addColorStop(1, 'rgba(248,243,230,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
    g.restore();
    ink(g, deck, { closed: true, width: 0.8, color: '#8a7a60', alpha: 0.45, jitter: 0.3, seed: 3 });
    return L;
  }

  function sheetBack(g) {
    g.save(); g.clip(deckPath);
    st.blit(st.cached('paper', PAPER), g);
    g.restore();
    ink(g, deck, { closed: true, width: 0.8, color: '#8a7a60', alpha: 0.45, jitter: 0.3, seed: 3 });
  }

  function stylus(g, x, y, t) {
    g.save();
    g.strokeStyle = 'rgba(40,25,12,0.18)'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + 10, y + 8); g.lineTo(x + 130, y - 110); g.stroke();
    ink(g, [[x, y], [x + 120, y - 150]], { width: 3.2, color: '#5b3e24', jitter: 0.3, seed: 4, taper: 6 });
    ink(g, [[x, y], [x + 22, y - 27]], { width: 1.6, color: '#2a2622', jitter: 0.2, seed: 5, taper: 2 });
    g.strokeStyle = 'rgba(255,250,236,0.5)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, 5 + Math.sin(t * 9) * 0.6, 3.6, 0, 0, TAU); g.stroke();
    g.restore();
  }

  /** The tray with bare size, while a sheet is being prepared. */
  function bare(g) {
    st.blit(st.cached('tray', tray));
    g.fillStyle = SIZE; g.fillRect(BATH.x0, BATH.y0, BATH.x1 - BATH.x0, BATH.y1 - BATH.y0);
  }

  /** A hand in the size (playful): the pointer, or the keyboard hand, drags the colours with it. */
  function hand(p, u) {
    const inBath = p.inside && p.x > BATH.x0 && p.x < BATH.x1 && p.y > BATH.y0 && p.y < BATH.y1;
    if (!inBath || u >= layAt || held(B.hold, p.x, p.y)) { lastP = null; return; }
    if (lastP && (p.x !== lastP.x || p.y !== lastP.y)) {
      // a key press is one quick stroke of the hand (a tenth of a second); a pointer moves as fast as it moves
      const dts = p.keyboard ? 0.1 : Math.max(0.008, (performance.now() - lastP.time) / 1000);
      const vx = Math.max(-900, Math.min(900, (p.x - lastP.x) / dts)), vy = Math.max(-900, Math.min(900, (p.y - lastP.y) / dts));
      B.inject.push({ x: p.x, y: p.y, vx, vy });
      if (u > pl.combEnd) layAt = Math.max(layAt, u + 3);
    }
    lastP = { x: p.x, y: p.y, time: performance.now() };
  }

  function render(data, frame) {
    const look = data.look, still = frame.still || look.pace === 0, t = frame.time, calm = frame.calm || [];
    const dark = palette().dark !== '#000000';
    // a new seed or a replay starts the sitting again from its first sheet
    if (data.seed !== baseSeed || frame.epoch !== epoch) {
      baseSeed = data.seed; epoch = frame.epoch; sheetK = 0; built = false; builder = prepare(sheetSeed(baseSeed, 0));
    }
    const g = st.begin();
    if (!built && !build(8)) { bare(g); invalidate(); return; }
    B.hold = calm;
    // drops that would land under the page's words do not land at all
    for (const d of B.drops) if (!d.poly && !d.done) d.skip = held(calm, d.x, d.y);
    if (start === null) start = t;
    const tm = times(layAt);
    let u = still ? stillAt(pl) : (t - start) * look.pace;
    if (!still && u > tm.end) {
      // the next sheet of the sitting
      sheetK++; built = false; builder = prepare(sheetSeed(baseSeed, sheetK)); lastKey = '';
      bare(g); invalidate(); return;
    }
    if (still) {
      if (!stillDone) {
        stillDone = simulate(u, 10, 1 / 30);
        if (!stillDone) { bare(g); invalidate(); return; }
        lastKey = '';
      }
    } else {
      if (look.hand) hand(frame.pointer, u);
      simulate(u, 5);
    }
    // draw: on twos when the governor says frames are slow; ten times a second while the print just rests
    const q = frame.quality ?? 1;
    odd = !odd;
    const resting = !still && u > tm.face + 1.2 && u < tm.out;
    const calmKey = calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
    const fk = still ? `s|${seed}|${calmKey}|${dark}` : resting ? `r${Math.floor(t * 10)}|${calmKey}|${dark}` : null;
    if (fk && fk === lastKey) return;
    if (!fk && q < 0.75 && odd && u < tm.lift) return;
    lastKey = fk ?? '';

    const trayL = st.cached('tray', tray), px = st.px;
    const strip = (x0, y0, x1, y1) => {
      const a = Math.round(x0 * px), b = Math.round(y0 * px), c = Math.round(x1 * px), d = Math.round(y1 * px);
      g.drawImage(trayL, a, b, c - a, d - b, a / px, b / px, (c - a) / px, (d - b) / px);
    };
    strip(0, 0, W, BATH.y0); strip(0, BATH.y1, W, H); strip(0, BATH.y0, BATH.x0, BATH.y1); strip(BATH.x1, BATH.y0, W, BATH.y1);
    g.save();
    g.beginPath(); g.rect(BATH.x0, BATH.y0, BATH.x1 - BATH.x0, BATH.y1 - BATH.y0); g.clip();
    g.fillStyle = SIZE; g.fillRect(BATH.x0, BATH.y0, BATH.x1 - BATH.x0, BATH.y1 - BATH.y0);
    const taken = u >= tm.lift; // the paper has lifted the colour off
    if (!taken) fillPolys(g, q < 0.5 ? 0 : 0.28);
    else {
      // what the paper leaves behind: a faint ghost that fades
      g.globalAlpha = 0.16 * (1 - phase(u, tm.lift, tm.lift + 3)); if (g.globalAlpha > 0.01) fillPolys(g, 0); g.globalAlpha = 1;
    }
    if (!still) updateSheen(t, 6); else if (sheenRow === 0) updateSheen(0, SH);
    g.imageSmoothingEnabled = true;
    g.drawImage(sheen, BATH.x0, BATH.y0, BATH.x1 - BATH.x0, BATH.y1 - BATH.y0);
    // ripples where drops have just landed (none under the words)
    g.lineWidth = 1;
    if (!still) for (const d of B.drops) {
      const a = u - d.t;
      if (a < 0 || a > 0.9 || d.skip) continue;
      g.strokeStyle = `rgba(255,252,242,${0.5 * (1 - a / 0.9)})`;
      g.beginPath(); g.arc(d.x, d.y, d.r * 0.4 + a * 70, 0, TAU); g.stroke();
    }
    g.restore();
    const sp = stylusAt(pl, u);
    if (sp && !still && !held(calm, sp[0], sp[1])) stylus(g, sp[0], sp[1], t);
    // the keyboard hand, so a sighted keyboard user sees where it is
    const p = frame.pointer;
    if (look.hand && p.keyboard && p.inside) { g.save(); g.strokeStyle = 'rgba(255,250,236,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 12, 0, TAU); g.stroke(); g.restore(); }

    // the sheet: laid from the left, lifted, turned over
    if (u >= tm.lay) {
      if (!print || printFor !== seed) { if (u >= tm.lift) { print = capture(); printFor = seed; } }
      if (u < tm.lift) {
        const cx = lerp(SHEET.x0 - 30, SHEET.x1 + 30, ease.inOutSine(phase(u, tm.lay, tm.rest)));
        g.save();
        g.beginPath(); g.rect(0, 0, cx, H); g.clip();
        g.globalAlpha = 0.84; sheetBack(g); g.globalAlpha = 1;
        g.restore();
        if (cx < SHEET.x1 + 20) {
          const sh = g.createLinearGradient(cx - 40, 0, cx + 30, 0);
          sh.addColorStop(0, 'rgba(255,252,244,0)'); sh.addColorStop(0.55, 'rgba(255,252,244,0.5)'); sh.addColorStop(0.62, 'rgba(60,40,20,0.22)'); sh.addColorStop(1, 'rgba(60,40,20,0)');
          g.fillStyle = sh; g.fillRect(cx - 40, SHEET.y0 - 6, 70, SHEET.y1 - SHEET.y0 + 12);
        }
      } else {
        const f = ease.inOutCubic(phase(u, tm.lift, tm.face)), sx = Math.cos(Math.PI * f);
        const lift = Math.sin(Math.PI * f), settle = ease.outCubic(phase(u, tm.face, tm.face + 1.2));
        const leave = ease.inOutCubic(phase(u, tm.out, tm.end));
        const mx = (SHEET.x0 + SHEET.x1) / 2, my = (SHEET.y0 + SHEET.y1) / 2;
        g.save();
        g.globalAlpha = 1 - leave;
        g.translate(mx, my - leave * 60 - lift * 14);
        g.rotate(-0.012 * settle);
        // shadow grows while the sheet is in the air
        g.save(); g.scale(Math.max(0.02, Math.abs(sx)), 1);
        g.fillStyle = `rgba(30,18,8,${0.18 + 0.12 * lift})`;
        g.fillRect(-(SHEET.x1 - SHEET.x0) / 2 + 6 + lift * 16, -(SHEET.y1 - SHEET.y0) / 2 + 8 + lift * 22, SHEET.x1 - SHEET.x0, SHEET.y1 - SHEET.y0);
        g.restore();
        g.scale(Math.abs(sx) < 0.02 ? 0.02 * Math.sign(sx || 1) : sx, 1 + 0.02 * lift);
        g.translate(-mx, -my);
        if (sx > 0) sheetBack(g); else st.blit(print);
        g.restore();
      }
    }
    // the studio after dark: a lamp over the tray, the table falling away into shadow; never an inverted picture
    if (dark) {
      g.save();
      g.globalCompositeOperation = 'multiply';
      const lamp = g.createRadialGradient(W * 0.5, H * 0.42, 60, W * 0.5, H * 0.5, W * 0.75);
      lamp.addColorStop(0, 'rgba(255,226,180,1)'); lamp.addColorStop(0.55, 'rgba(176,150,128,1)'); lamp.addColorStop(1, 'rgba(58,52,70,1)');
      g.fillStyle = lamp; g.fillRect(0, 0, W, H);
      g.restore();
    }
    host.dataset.u = u.toFixed(2);
    host.dataset.colours = String(B.polys.length);
    host.dataset.stage = u < pl.dropsEnd ? 'drops' : u < pl.combEnd ? 'comb' : u < tm.lay ? 'drift' : u < tm.lift ? 'lay' : 'print';
    if (resolveReady && (!still || stillDone)) { resolveReady(); resolveReady = null; }
  }

  return {
    render,
    ready,
    setRegister() { lastKey = ''; stillDone = false; },
    restyle() { colors = null; lastKey = ''; },
    /** Enter, Space or a tap in playful: a drop of the palette's next colour lands where the hand is. */
    activate(p) {
      if (!p || !B || !built) return;
      const u = B.t;
      if (u >= layAt || held(B.hold || [], p.x, p.y)) return;
      if (!(p.x > BATH.x0 + 20 && p.x < BATH.x1 - 20 && p.y > BATH.y0 + 20 && p.y < BATH.y1 - 20)) return;
      const col = pl.cols[drops++ % pl.cols.length];
      B.drops.push({ t: u, x: p.x, y: p.y, r: 46, col, spread: 1.1, poly: null, r2: 0, done: false });
      if (u > pl.combEnd) layAt = Math.max(layAt, u + 3);
      invalidate();
    },
    destroy() { st.destroy(); },
  };
}
