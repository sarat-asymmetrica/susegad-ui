// Kairi: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the paper and pencil guides, the madder edges with their
// dots, the washes, the dot rows, the flowers, the inked lines and the pencil
// machine are the plate's own drawing code. Finished paisleys are painted
// once into a layer and never drawn twice. The port adds the registers, the
// border as real progress, the machine hushed under the page's words, a
// lamplit cloth for dark pages, the library's own Kalam, the governor, and
// the pointer or keyboard hand slowing the machine in playful.

import { stage, ink, hatch, wash, paper, rng, clamp, smoothstep, phase, ease, TAU, toPath, grainPattern, ellipse } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, BAND, SLOTS, PIGMENTS, chain, curve, stageAt, nextSlotClock } from './model.js';

const INK = '#2a211c', PENCIL = '#5d564d', CLOTH = '#f1e9d6';
const HAND = '"Kalam", "Segoe Print", "Bradley Hand", cursive';

function handText(g, text, x, y, size, alpha, color = PENCIL) {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  g.font = `300 ${size}px ${HAND}`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  g.fillText(text, x, y);
  g.restore();
}

/** Paper and the designer's pencil guides. */
function drawSheet(g, base) {
  paper(g, W, H, { base, seed: 12, vignette: 0.1, fibers: 90, mottle: 0.035 });
  const r = rng('guides:1'), span = W / SLOTS;
  const line = (pts, s, a = 0.22) => ink(g, pts, { width: 0.7, color: PENCIL, alpha: a, jitter: 0.5, seed: s, taper: 30, grain: true });
  line([[-10, BAND.y0 - 26], [W + 10, BAND.y0 - 26 + r.range(-1, 1)]], 1);
  line([[-10, BAND.y1 + 26], [W + 10, BAND.y1 + 26 + r.range(-1, 1)]], 2);
  line([[-10, (BAND.y0 + BAND.y1) / 2], [W + 10, (BAND.y0 + BAND.y1) / 2]], 3, 0.1);
  for (let i = 0; i < SLOTS; i++) line([[span * (i + 0.5), BAND.y0 - 50], [span * (i + 0.5), BAND.y1 + 50]], 10 + i, 0.1);
}

/** The border's edges: two inked rules with a row of madder triangles between. */
function drawEdges(g, seed) {
  const r = rng(`edges:${seed}`), sn = typeof seed === 'number' ? seed : seed.length;
  for (const [y, dir] of [[BAND.y0 - 26, 1], [BAND.y1 + 26, -1]]) {
    const y2 = y + dir * 16;
    ink(g, [[-10, y], [W + 10, y]], { width: 1.8, color: INK, alpha: 0.85, jitter: 0.6, seed: sn + y, taper: 0 });
    ink(g, [[-10, y2], [W + 10, y2]], { width: 1.2, color: INK, alpha: 0.8, jitter: 0.6, seed: sn + y2, taper: 0 });
    const tri = new Path2D();
    for (let x = 4; x < W; x += 14) {
      const j = r.range(-0.8, 0.8);
      tri.moveTo(x + j, y + dir * 2.5); tri.lineTo(x + 10 + j, y + dir * 2.5); tri.lineTo(x + 5 + j, y2 - dir * 2.5); tri.closePath();
    }
    wash(g, tri, { color: PIGMENTS.madder, alpha: 0.85 });
    // a line of tiny dots beyond each edge
    g.fillStyle = PIGMENTS.indigo; g.globalAlpha = 0.7;
    for (let x = 9; x < W; x += 14) { g.beginPath(); g.arc(x + r.range(-0.6, 0.6), y - dir * 7, 1.5, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  }
}

function flower(g, x, y, rad, color, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    g.fillStyle = color; g.beginPath(); g.ellipse(x + Math.cos(a) * rad * 0.62, y + Math.sin(a) * rad * 0.62, rad * 0.42, rad * 0.24, a, 0, TAU); g.fill();
  }
  g.fillStyle = INK; g.beginPath(); g.arc(x, y, rad * 0.2, 0, TAU); g.fill();
  g.restore();
}

/** The painted part of a paisley: washes and shading. */
function paintWashes(g, s, cloth) {
  const out = toPath(s.full), inner = toPath(s.efull);
  wash(g, out, { color: s.colorA, alpha: 0.78 });
  // a soft darker pool along the edge, as brushed pigment dries
  g.save(); g.clip(out); g.globalAlpha = 0.18; g.strokeStyle = s.colorA; g.lineWidth = 9; g.stroke(out); g.restore();
  g.save(); g.fillStyle = cloth; g.fill(inner); g.restore();
  wash(g, inner, { color: s.colorB, alpha: 0.72 });
  hatch(g, s.efull, { angle: -0.6, spacing: 4, seg: [6, 14], width: 0.7, color: INK, alpha: 0.26, seed: s.seed, density: (x, y) => clamp((y - s.belly[1] + 20) / 60) });
}

/** Dots, flower and the two inked lines. f: 0..1 through the fill stage. */
function paintDetails(g, s, f = 1) {
  const nd = Math.floor(s.mid.length * ease.inOutSine(phase(f, 0.3, 0.85)));
  g.save();
  g.fillStyle = '#f6eedc';
  g.beginPath(); for (let i = 0; i < nd; i++) { const [x, y] = s.mid[i]; g.moveTo(x + 2.6, y); g.arc(x, y, 2.6, 0, TAU); } g.fill();
  g.fillStyle = INK; g.globalAlpha = 0.55;
  g.beginPath(); for (let i = 0; i < nd; i++) { const [x, y] = s.mid[i]; g.moveTo(x + 0.9, y); g.arc(x, y, 0.9, 0, TAU); } g.fill();
  // and a halo of fine ink dots just outside, the way a printer finishes a boteh
  const nh = Math.floor(s.halo.length * ease.inOutSine(phase(f, 0.45, 1)));
  g.fillStyle = INK; g.globalAlpha = 0.75;
  g.beginPath(); for (let i = 0; i < nh; i++) { const [x, y] = s.halo[i]; g.moveTo(x + 1.15, y); g.arc(x, y, 1.15, 0, TAU); } g.fill();
  g.restore();
  const fl = ease.outBack(phase(f, 0.6, 1));
  if (fl > 0) flower(g, s.belly[0], s.belly[1], 13 * fl, s.colorA === PIGMENTS.indigo ? PIGMENTS.madder : PIGMENTS.indigo, clamp(fl));
  ink(g, s.efull, { width: 1.5, color: INK, alpha: 0.85, jitter: 0.4, seed: s.seed + 2, closed: true });
  ink(g, s.full, { width: 2.3, color: INK, alpha: 0.95, jitter: 0.5, seed: s.seed + 1, closed: true });
}

function paintButi(g, b, a = 1) {
  flower(g, b.x, b.y, 9, b.color, a);
  g.save(); g.globalAlpha = a; g.fillStyle = INK;
  for (const [dx, dy] of [[-20, 0], [20, 0], [0, -18], [0, 18]]) { g.beginPath(); g.arc(b.x + dx, b.y + dy, 1.6, 0, TAU); g.fill(); }
  g.restore();
}

/** The machine in pencil: circles, arms and the pen. `most` caps the circles drawn (the governor). */
function drawMachine(g, joints, terms, strength, alpha = 1, most = Infinity) {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  g.lineCap = 'round';
  const circles = new Path2D(), arms = new Path2D();
  for (let i = 1; i < joints.length; i++) {
    const [x, y] = joints[i - 1], r = terms[i].amp;
    if (r > 0.5 && i <= most) { circles.moveTo(x + r, y); circles.arc(x, y, r, 0, TAU); }
    arms.moveTo(x, y); arms.lineTo(joints[i][0], joints[i][1]);
  }
  g.strokeStyle = grainPattern(g, PENCIL, { lo: 0.3, hi: 1 });
  g.lineWidth = 0.8; g.globalAlpha = alpha * (0.38 + 0.4 * strength); g.stroke(circles);
  g.lineWidth = 0.9; g.globalAlpha = alpha * (0.55 + 0.35 * strength); g.stroke(arms);
  g.globalAlpha = alpha;
  g.fillStyle = PENCIL;
  const [x0, y0] = joints[0];
  g.beginPath(); g.arc(x0, y0, 2.2, 0, TAU); g.fill();
  const [px, py] = joints[joints.length - 1];
  g.fillStyle = INK; g.beginPath(); g.arc(px, py, 2.4, 0, TAU); g.fill();
  g.restore();
}

/** Copy just one rectangle of a full-size layer. */
function blitRect(g, st, layer, x, y, w, h) {
  const px = st.px, x0 = Math.max(0, Math.floor(x * px)), y0 = Math.max(0, Math.floor(y * px));
  const x1 = Math.min(layer.width, Math.ceil((x + w) * px)), y1 = Math.min(layer.height, Math.ceil((y + h) * px));
  if (x1 > x0 && y1 > y0) g.drawImage(layer, x0, y0, x1 - x0, y1 - y0, x0 / px, y0 / px, (x1 - x0) / px, (y1 - y0) / px);
}

/** Where a paisley's machine can reach: its outline's box and a margin for the circles. */
const reach = s => (s.reach ??= (() => {
  const xs = s.full.map(p => p[0]), ys = s.full.map(p => p[1]), x = Math.min(...xs) - 30, y = Math.min(...ys) - 30;
  return { x, y, w: Math.max(...xs) + 30 - x, h: Math.max(...ys) + 30 - y };
})());
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ── The renderer ──────────────────────────────────────────────────────────

export function createRenderer(host, { scene: sceneEl = null, invalidate = () => {}, advance = () => {} } = {}) {
  const st = stage(host, { W, H });
  let colors = null, work = null, workKey = '', committed = 0, hover = 0, lastClock = null;
  st.onresize = () => { workKey = ''; invalidate(); };

  function palette() {
    return (colors ??= readColors(host, {
      paper: `var(--sg-paper, light-dark(${CLOTH}, #151a2b))`,
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }

  // Canvas text never asks for a web font: load Kalam ourselves, then redraw the note.
  if (document.fonts?.load) document.fonts.load(`300 24px ${HAND}`, '61 circles').then(() => invalidate(), () => {});

  function render(data, frame) {
    const c = palette(), dark = c.dark !== '#000000', cloth = dark ? CLOTH : c.paper, calm = frame.calm || [];
    const b = data.border, S = data.S, seed = data.seed, p = frame.pointer;
    // the finished paisleys live in one layer, per border, size and cloth
    const key = `${seed}|${st.canvas.width}x${st.canvas.height}|${cloth}`;
    if (key !== workKey || data.done < committed) { work = st.layer(); committed = 0; workKey = key; }
    const wg = work.getContext('2d');
    while (committed < data.done) {
      paintWashes(wg, b.slots[committed], cloth); paintDetails(wg, b.slots[committed], 1);
      if (committed > 0) paintButi(wg, b.buti[committed - 1]);
      committed++;
    }

    const active = S.slot >= 0 && S.slot < SLOTS ? b.slots[S.slot] : null;
    // playful: near the pointer or the keyboard hand the machine's clock runs at about a third of the speed
    if (data.look.slow && !data.held && !frame.still) {
      const near = p.inside && active ? 1 - smoothstep(180, 320, Math.hypot(p.x - active.cx, p.y - active.cy)) : 0;
      hover += (near - hover) * Math.min(1, (frame.dt || 0) * 4);
      if (hover > 0.01 && frame.dt) advance(-frame.dt * 0.68 * hover);
    } else hover = 0;
    lastClock = data.clock;
    // the machine hushes under the page's words
    const hushed = active && calm.some(r => overlaps(r, reach(active)));
    const quality = frame.quality ?? 1, most = quality < 0.75 ? Math.round(12 + 36 * quality) : Infinity, samples = quality < 0.75 ? 120 : 240;

    const g = st.begin();
    const sheet = st.cached(`sheet|${cloth}`, sg => drawSheet(sg, cloth));
    const edges = st.cached(`edges:${seed}`, eg => drawEdges(eg, seed));
    const fadeA = S.stage === 'fade' ? 1 - ease.inOutSine(S.u) : 1;
    if (S.stage === 'intro' || S.stage === 'fade') {
      st.blit(sheet);
      g.save();
      g.globalAlpha = fadeA;
      if (S.stage === 'intro') { g.beginPath(); g.rect(0, 0, W * ease.inOutSine(S.u), H); g.clip(); }
      st.blit(edges);
      g.restore();
    } else {
      st.blit(st.cached(`base:${seed}|${cloth}`, bg => { st.blit(sheet, bg); st.blit(edges, bg); }));
    }
    if (committed) { g.save(); g.globalAlpha = fadeA; st.blit(work); g.restore(); }

    let note = null, noteA = 1, noteX = 0;
    const machineA = hushed ? 0.15 : 1;
    if (S.stage === 'hold') {
      // the finished border, with the last machine resting faintly on its paisley
      const s = b.slots[SLOTS - 1];
      drawMachine(g, chain(s.terms, s.K, 0.37), s.terms, 0.3, 0.8 * machineA, most);
      note = `${s.K} circles`; noteX = s.cx; noteA = 1;
    } else if (active) {
      const s = active, strength = hover;
      noteX = s.cx;
      if (S.stage === 'build') {
        // circles join one at a time; the pencil sketch they make sharpens
        const k = Math.max(2, Math.round(1 + ease.inOutSine(clamp(S.u / 0.85)) * (s.K - 1)));
        g.save(); g.strokeStyle = grainPattern(g, PENCIL, { lo: 0.3, hi: 1 }); g.globalAlpha = 0.5 * machineA; g.lineWidth = 1;
        g.stroke(toPath(curve(s.terms, k, samples))); g.restore();
        drawMachine(g, chain(s.terms, k, S.u * 0.08), s.terms, strength, ease.outCubic(clamp(S.u * 3)) * machineA, most);
        note = `${k} circle${k === 1 ? '' : 's'}`; noteA = ease.outCubic(clamp(S.u * 3));
      } else if (S.stage === 'trace') {
        const u = ease.inOutSine(S.u), m = s.full.length, upto = Math.floor(u * m);
        const ghostA = 0.5 * (1 - ease.outCubic(S.u)) * machineA;
        if (ghostA > 0.01) { g.save(); g.strokeStyle = grainPattern(g, PENCIL, { lo: 0.3, hi: 1 }); g.globalAlpha = ghostA; g.lineWidth = 1; g.stroke(toPath(curve(s.terms, s.K, samples))); g.restore(); }
        const joints = chain(s.terms, s.K, u);
        const trail = s.full.slice(0, upto + 1).concat([joints[joints.length - 1]]);
        if (trail.length > 2) ink(g, trail, { width: 2.3, color: INK, alpha: 0.95, jitter: 0.5, seed: s.seed + 1, taper: 6 });
        drawMachine(g, joints, s.terms, strength, machineA, most);
        note = `${s.K} circles`;
      } else if (S.stage === 'echo') {
        ink(g, s.full, { width: 2.3, color: INK, alpha: 0.95, jitter: 0.5, seed: s.seed + 1, closed: true });
        const u = ease.inOutSine(clamp(S.u / 0.9)), m = s.efull.length, upto = Math.floor(u * m);
        const joints = chain(s.eterms, s.KE, u);
        const trail = s.efull.slice(0, upto + 1).concat([joints[joints.length - 1]]);
        if (trail.length > 2) ink(g, trail, { width: 1.5, color: INK, alpha: 0.85, jitter: 0.4, seed: s.seed + 2, taper: 5 });
        drawMachine(g, joints, s.eterms, strength, (1 - ease.inCubic(phase(S.u, 0.9, 1))) * machineA, most);
        note = `${s.KE} circles for the echo`;
      } else if (S.stage === 'fill') {
        // the washes come from a sprite painted once and faded in; the details are live
        const sp = st.cached(`washes:${seed}:${s.i}|${cloth}`, wg2 => paintWashes(wg2, s, cloth));
        g.save(); g.globalAlpha = ease.outCubic(phase(S.u, 0, 0.5)); blitRect(g, st, sp, s.cx - 130, BAND.y0 - 10, 260, BAND.y1 - BAND.y0 + 20); g.restore();
        paintDetails(g, s, S.u);
        if (s.i > 0) paintButi(g, b.buti[s.i - 1], ease.outCubic(phase(S.u, 0.5, 1)));
        note = `${s.KE} circles for the echo`; noteA = 1 - ease.outCubic(clamp(S.u * 2.5));
      }
    }
    const noteBox = { x: noteX - 130, y: BAND.y1 + 60, w: 260, h: 40 };
    if (note && !calm.some(r => overlaps(r, noteBox))) handText(g, note, noteX, BAND.y1 + 78, 24, 0.85 * noteA);
    // the keyboard hand, so a sighted keyboard user sees where it is
    if (p.keyboard && p.inside && data.look.slow) ink(g, ellipse(p.x, p.y, 10, 10, { n: 18 }), { width: 1.3, color: PIGMENTS.madder, alpha: 0.9, jitter: 0.3, seed: 7, closed: true });
    if (dark) {
      // the same cloth by lamplight: a warm glow in the middle, the corners falling into shadow
      g.save(); g.globalCompositeOperation = 'multiply';
      const lamp = g.createRadialGradient(W * 0.5, H * 0.45, 80, W * 0.5, H * 0.5, W * 0.72);
      lamp.addColorStop(0, 'rgba(255,238,206,1)'); lamp.addColorStop(0.55, 'rgba(214,184,150,1)'); lamp.addColorStop(1, 'rgba(84,64,66,1)');
      g.fillStyle = lamp; g.fillRect(0, 0, W, H); g.restore();
    }
    host.dataset.done = `${committed}/${SLOTS}`;
    host.dataset.stage = S.stage;
  }

  return {
    render,
    setRegister() { hover = 0; },
    restyle() { colors = null; workKey = ''; },
    /** Enter, Space or a tap in playful: on to the next paisley; once the border is done, a new border. */
    activate() {
      if (lastClock == null) return;
      const next = nextSlotClock(lastClock);
      if (next == null) sceneEl?.reseed(); else advance(next - lastClock);
    },
    destroy() { st.destroy(); },
  };
}
