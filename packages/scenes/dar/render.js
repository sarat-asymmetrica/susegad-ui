// Dar: the canvas renderer. Owns every side effect.
//
// quiet    a hairline elevation: the door, the bolt home, the key on its hook
// warm     ink and wash: the key swings in, catches on the hook, sways to rest,
//          and the bolt slides home; then the scene rests (no frames)
// playful  the same; then a click, Enter or Space swings the key, and a click
//          by the bolt (or Enter with the keyboard hand there) slides it
//
// The house front is painted once. A frame is one blit, the bolt's shaft and
// the key.

import { stage, rng, clamp, lerp, TAU, smoothstep, hexToRgb, ink, hatch, wash, toPath, paper, roughen, blob, N } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, EAVE, PLINTH, GROUND, DOOR, WINDOW, HOOK, KEY, BOLT, swingAngle, boltAt, ARRIVE } from './model.js';

const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export function createRenderer(host, { register, scene, invalidate }) {
  const st = stage(host, { W, H });
  let reg = register, colors = null, lastKey = '', epoch = -1, pushes = [], toggles = [], pending = null;
  st.onresize = () => { lastKey = ''; invalidate(); };

  function palette() {
    return (colors ??= readColors(host, {
      paper: 'var(--sg-paper, light-dark(#f1ede4, #151a2b))',
      ink: 'var(--sg-ink, light-dark(#1d2742, #ebe5d6))',
      pencil: 'var(--sg-pencil, light-dark(#8e93a6, #6e6a5e))',
      laterite: 'var(--sg-laterite, #b3563a)',
      kokum: 'var(--sg-kokum, #7c1d45)',
      paddy: 'var(--sg-paddy, #5b8b3b)',
      mango: 'var(--sg-mango, #e4b24c)',
      lime: 'var(--sg-dar-lime, #efe6d2)',
      door: 'var(--sg-dar-door, #2f5d4a)',
      shutter: 'var(--sg-dar-shutter, #3f6aa0)',
      brass: 'var(--sg-dar-brass, #c9a13b)',
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }
  const isDark = () => palette().dark !== '#000000';
  const hair = () => (1.1 * W) / (st.canvas.clientWidth || W);
  const INK = () => (isDark() ? '#141828' : '#1d2742'); // on a lit wall the ink stays dark, day or night
  const night = (hex, k = 0.5) => (isDark() ? mixHex(hex, '#10132a', k) : hex);

  // ── the house front, painted once ────────────────────────────────────────
  function laterite(g, shape, seed, tone = 1) {
    const c = palette(), r = rng(`lat:${seed}`);
    wash(g, shape, { color: night(mixHex(c.laterite, '#6b2412', 0.1 * tone)), alpha: 0.95 });
    g.save(); g.clip(toPath(shape));
    const bw = 86, bh = 40, joints = new Path2D();
    for (let y = 0, row = 0; y < H; y += bh, row++) {
      for (let x = (row % 2) * bw / 2 - bw; x < W; x += bw) {
        // each block its own rust: some darker, some yellower
        g.fillStyle = r() < 0.5 ? 'rgba(90,20,6,0.16)' : 'rgba(210,140,60,0.12)'; g.globalAlpha = r.range(0.4, 1);
        g.fillRect(x + 2, y + 2, bw - 4, bh - 4); g.globalAlpha = 1;
        joints.moveTo(x, y + r.range(-1, 1)); joints.lineTo(x + bw, y + r.range(-1, 1));
        joints.moveTo(x, y); joints.lineTo(x + r.range(-1.5, 1.5), y + bh);
      }
    }
    g.lineWidth = 2.2; g.strokeStyle = night('#c9a88a', 0.6); g.globalAlpha = 0.45; g.stroke(joints); g.globalAlpha = 1;
    // pores: laterite is full of little pits
    g.fillStyle = night('#4a160a', 0.4); g.globalAlpha = 0.5;
    for (let i = 0; i < 2600; i++) { const x = r() * W, y = r() * H; g.beginPath(); g.ellipse(x, y, r.range(0.8, 3.2), r.range(0.6, 2), r() * 3, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    hatch(g, shape, { angle: 0.7, spacing: 3.4, seg: [4, 12], width: 0.6, color: '#3a0e04', alpha: 0.22, seed });
    g.restore();
  }

  function front(g, mode) {
    const c = palette(), dark = isDark(), hw = hair(), hairline = mode === 'hair';
    const WX = weatherOf();
    if (hairline) { g.fillStyle = c.paper; g.fillRect(0, 0, W, H); }
    else paper(g, W, H, { base: c.paper, seed: 17, mottle: 0.04, vignette: 0.05, fibers: 30, speck: dark ? '#000000' : '#3a2f22' });
    const L = (pts, closed = true, a = 1) => { g.strokeStyle = c.ink; g.globalAlpha = a; g.lineWidth = hw; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); if (closed) g.closePath(); g.stroke(); g.globalAlpha = 1; };
    const P = (pts, closed = true) => { g.strokeStyle = c.pencil; g.lineWidth = hw * 0.8; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); if (closed) g.closePath(); g.stroke(); };

    // the wall: lime plaster, weathered, with laterite showing through where it has fallen
    const wall = rect(0, EAVE, W, PLINTH);
    if (hairline) { L([[0, EAVE], [W, EAVE]], false); L([[0, PLINTH], [W, PLINTH]], false); L([[0, GROUND], [W, GROUND]], false); }
    else {
      wash(g, wall, { color: night(c.lime, 0.62), alpha: 0.97, grainy: false });
      mottle(g, wall, 0.05);
      // rain has run down from the eave in streaks
      const r = rng('stains');
      for (let i = 0; i < 26; i++) {
        const x = r.range(0, W), len = r.range(60, 260) * WX.stain;
        const gr = g.createLinearGradient(0, EAVE, 0, EAVE + len);
        gr.addColorStop(0, `rgba(90,80,50,${r.range(0.08, 0.2)})`); gr.addColorStop(1, 'rgba(90,80,50,0)');
        g.fillStyle = gr; g.fillRect(x, EAVE, r.range(6, 26), len);
      }
      const damp = g.createLinearGradient(0, PLINTH - 120, 0, PLINTH);
      damp.addColorStop(0, 'rgba(80,90,60,0)'); damp.addColorStop(1, 'rgba(80,90,60,0.22)');
      g.fillStyle = damp; g.fillRect(0, PLINTH - 120, W, 120);
      for (const p of WX.patches) {
        // plaster fallen away: a ragged lime edge, the laterite behind it in the wall's own plane
        const shape = roughen(roughen(blob(p.x, p.y, p.r, { seed: p.seed % 97, wobble: 0.38, freq: 2.2, squash: p.squash, rot: p.rot, n: 56 }), { amp: 6, freq: 0.05, seed: p.seed % 13, step: 5 }), { amp: 1.6, freq: 0.5, seed: p.seed % 7, step: 2 });
        laterite(g, shape, p.seed);
        g.save(); g.clip(toPath(shape));
        // the plaster's thickness shades the top and left of the hole
        g.translate(4, 5); g.lineWidth = 7; g.strokeStyle = 'rgba(40,14,4,0.35)'; g.stroke(toPath(shape));
        g.restore();
        // the broken edge of the lime coat: a pale lip, then a few broken ink strokes, not an outline
        ink(g, shape, { width: 2.2, color: night('#f4ecda', 0.62), alpha: 0.85, closed: true, jitter: 0.8, seed: p.seed % 29 });
        const pr = rng(`lip:${p.seed}`), n = shape.length;
        for (let k = 0; k < 7; k++) { const i0 = pr.int(0, n - 1), len = pr.int(4, 10), seg = []; for (let j = 0; j < len; j++) seg.push(shape[(i0 + j) % n]); ink(g, seg, { width: 0.8, color: INK(), alpha: 0.5, jitter: 0.5, seed: k + p.seed % 17, taper: 3 }); }
        // loose flakes around the edge where more plaster is ready to go
        g.strokeStyle = INK(); g.globalAlpha = 0.35; g.lineWidth = 0.7;
        for (let k = 0; k < 6; k++) { const [x, y] = shape[pr.int(0, n - 1)], dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1, o = pr.range(6, 14); g.beginPath(); g.moveTo(x + (dx / d) * o, y + (dy / d) * o); g.lineTo(x + (dx / d) * o + pr.range(-7, 7), y + (dy / d) * o + pr.range(-4, 4)); g.stroke(); }
        g.globalAlpha = 1;
      }
      hatch(g, wall, { angle: 1.4, spacing: 9, seg: [20, 70], width: 0.5, color: '#6b5a3e', alpha: 0.09, seed: 3, wobble: 1.4 });
    }
    // the plinth: bare laterite, and the path in front
    const plinth = rect(0, PLINTH, W, GROUND);
    if (!hairline) { laterite(g, plinth, 7, 2); ink(g, [[0, PLINTH], [W, PLINTH]], { width: 1.4, color: INK(), alpha: 0.8, jitter: 0.6, seed: 2, taper: 0 }); }
    const path = rect(0, GROUND, W, H);
    if (!hairline) {
      wash(g, path, { color: night(mixHex(c.laterite, '#d9b48a', 0.45), 0.55), alpha: 0.9 });
      hatch(g, path, { angle: 0.05, spacing: 3, seg: [8, 30], width: 0.6, color: INK(), alpha: 0.25, seed: 5 });
      ink(g, [[0, GROUND], [W, GROUND]], { width: 1.3, color: INK(), alpha: 0.8, jitter: 0.6, seed: 4, taper: 0 });
    }
    // a stone step before the door
    const step = rect(DOOR.x0 - 46, PLINTH + 10, DOOR.x1 + 46, GROUND + 6);
    if (hairline) L(step);
    else { wash(g, step, { color: night('#9d9585', 0.5), alpha: 0.97, grainy: false }); hatch(g, step, { angle: -0.3, spacing: 2.4, width: 0.6, color: INK(), alpha: 0.35, seed: 6 }); ink(g, step, { width: 1.2, color: INK(), alpha: 0.85, closed: true, jitter: 0.4, seed: 7 }); }

    // the eave: a fascia board and a row of Mangalore tiles above it, a shadow below
    if (!hairline) {
      const sh = g.createLinearGradient(0, EAVE, 0, EAVE + 70);
      sh.addColorStop(0, 'rgba(40,24,10,0.32)'); sh.addColorStop(1, 'rgba(40,24,10,0)');
      g.fillStyle = sh; g.fillRect(0, EAVE, W, 70);
      const roof = rect(0, 0, W, EAVE - 16);
      wash(g, roof, { color: night(c.laterite, 0.45), alpha: 0.95, grainy: false });
      g.save(); g.clip(toPath(roof));
      for (let y = EAVE - 16, row = 0; y > -30; y -= 26, row++) {
        for (let x = (row % 2) * 22 - 22; x < W + 44; x += 44) {
          const scallop = [[x, y], [x + 4, y - 8], [x + 22, y - 12], [x + 40, y - 8], [x + 44, y]];
          ink(g, scallop, { width: 1, color: '#4a1a0c', alpha: 0.7, jitter: 0.4, seed: x + row * 7, taper: 2 });
        }
        hatch(g, rect(0, y - 26, W, y), { angle: 1.1, spacing: 3.2, seg: [3, 8], width: 0.6, color: '#3a0e04', alpha: 0.25, seed: row, density: (xx, yy) => smoothstep(y - 26, y, yy) });
      }
      g.restore();
      const fascia = rect(0, EAVE - 16, W, EAVE);
      wash(g, fascia, { color: night('#5a3a22', 0.4), alpha: 0.97, grainy: false });
      ink(g, [[0, EAVE - 16], [W, EAVE - 16]], { width: 1.2, color: INK(), alpha: 0.85, jitter: 0.5, seed: 8, taper: 0 });
      ink(g, [[0, EAVE], [W, EAVE]], { width: 1.4, color: INK(), alpha: 0.9, jitter: 0.5, seed: 9, taper: 0 });
    } else { L([[0, EAVE - 16], [W, EAVE - 16]], false); for (let x = 0; x < W; x += 44) P([[x, EAVE - 16], [x + 22, EAVE - 28], [x + 44, EAVE - 16]], false); }

    // the window: oyster-shell panes in a wooden grid, blue shutters folded back on the wall
    const { x0: wx0, x1: wx1, top: wt, bottom: wb, shutter: sw } = WINDOW;
    for (const [sx0, sx1] of [[wx0 - 10 - sw, wx0 - 10], [wx1 + 10, wx1 + 10 + sw]]) {
      const sh = rect(sx0, wt + 4, sx1, wb - 4);
      if (hairline) { L(sh); P(rect(sx0 + 10, wt + 18, sx1 - 10, (wt + wb) / 2 - 6)); P(rect(sx0 + 10, (wt + wb) / 2 + 6, sx1 - 10, wb - 18)); continue; }
      g.fillStyle = 'rgba(30,20,10,0.22)'; g.fill(toPath(rect(sx0 + 5, wt + 10, sx1 + 5, wb + 2)));
      wash(g, sh, { color: night(c.shutter, 0.45), alpha: 0.97, grainy: false });
      for (const pr of [rect(sx0 + 10, wt + 18, sx1 - 10, (wt + wb) / 2 - 6), rect(sx0 + 10, (wt + wb) / 2 + 6, sx1 - 10, wb - 18)]) {
        hatch(g, pr, { angle: -0.8, spacing: 2.6, width: 0.6, color: INK(), alpha: 0.3, seed: pr[0][1] | 0 });
        ink(g, pr, { width: 0.9, color: INK(), alpha: 0.7, closed: true, jitter: 0.3, seed: pr[0][0] | 0 });
      }
      ink(g, sh, { width: 1.2, color: INK(), alpha: 0.9, closed: true, jitter: 0.4, seed: sx0 | 0 });
    }
    const surround = rect(wx0 - 14, wt - 16, wx1 + 14, wb + 18);
    if (hairline) L(surround); else { wash(g, surround, { color: night('#f6f1e4', 0.6), alpha: 1, grainy: false }); ink(g, surround, { width: 1.2, color: INK(), alpha: 0.8, closed: true, jitter: 0.4, seed: 11 }); }
    const cols = 5, rows = 8, pw = (wx1 - wx0) / cols, ph = (wb - wt) / rows;
    if (!hairline) {
      wash(g, rect(wx0, wt, wx1, wb), { color: night('#5a3a22', 0.4), alpha: 0.97 });
      const pr = rng('panes');
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = wx0 + i * pw + 3, y = wt + j * ph + 3, w = pw - 6, h = ph - 6;
        if (dark) {
          const glow = g.createRadialGradient(x + w / 2, y + h / 2, 1, x + w / 2, y + h / 2, w);
          glow.addColorStop(0, `rgba(255,214,140,${0.85 + pr() * 0.1})`); glow.addColorStop(1, 'rgba(240,170,90,0.75)');
          g.fillStyle = glow;
        } else { const v = pr.int(-5, 5); g.fillStyle = `rgba(${232 + v},${230 + v},${220 + v + pr.int(-2, 3)},0.96)`; }
        g.fillRect(x, y, w, h);
        // the shell's own grain, a faint pearly sheen
        g.strokeStyle = dark ? 'rgba(160,90,30,0.25)' : 'rgba(150,160,170,0.35)'; g.lineWidth = 0.6; g.beginPath();
        for (let k = 0; k < 4; k++) { const yy = y + h * (0.2 + k * 0.2) + pr.range(-2, 2); g.moveTo(x + 2, yy); g.quadraticCurveTo(x + w / 2, yy + pr.range(-3, 3), x + w - 2, yy + pr.range(-2, 2)); }
        g.stroke();
      }
      ink(g, rect(wx0, wt, wx1, wb), { width: 1.2, color: INK(), alpha: 0.9, closed: true, jitter: 0.3, seed: 12 });
    } else {
      L(rect(wx0, wt, wx1, wb));
      for (let i = 1; i < cols; i++) P([[wx0 + i * pw, wt], [wx0 + i * pw, wb]], false);
      for (let j = 1; j < rows; j++) P([[wx0, wt + j * ph], [wx1, wt + j * ph]], false);
    }
    if (dark && !hairline) { // lamplight inside, falling out on the wall below the window
      g.save(); g.globalCompositeOperation = 'lighter';
      const lg = g.createRadialGradient((wx0 + wx1) / 2, (wt + wb) / 2, 40, (wx0 + wx1) / 2, wb + 40, 300);
      lg.addColorStop(0, 'rgba(255,190,110,0.22)'); lg.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lg; g.fillRect(wx0 - 320, wt - 200, wx1 - wx0 + 640, 700); g.restore();
    }

    // the door: a lime-white surround, and two painted leaves with raised panels
    const { x0, x1, top, bottom, frame: fr, lintel } = DOOR, mid = (x0 + x1) / 2;
    const outer = [[x0 - fr, bottom], [x0 - fr, top - lintel], [mid - 40, top - lintel - 10], [mid, top - lintel - 22], [mid + 40, top - lintel - 10], [x1 + fr, top - lintel], [x1 + fr, bottom]];
    if (hairline) { L(outer); L(rect(x0, top, x1, bottom)); }
    else {
      g.fillStyle = 'rgba(30,20,10,0.18)'; g.fill(toPath(outer.map(([x, y]) => [x + 6, y + 6])));
      wash(g, outer, { color: night('#f6f1e4', 0.6), alpha: 1, grainy: false });
      ink(g, outer, { width: 1.3, color: INK(), alpha: 0.85, closed: true, jitter: 0.4, seed: 13 });
      // mouldings: a fillet line inside the surround and a cornice under the pediment
      ink(g, [[x0 - fr + 7, bottom], [x0 - fr + 7, top - lintel + 12], [x1 + fr - 7, top - lintel + 12], [x1 + fr - 7, bottom]], { width: 0.9, color: INK(), alpha: 0.45, jitter: 0.3, seed: 14, taper: 0 });
      ink(g, [[x0 - fr - 6, top - lintel], [x1 + fr + 6, top - lintel]], { width: 2.2, color: INK(), alpha: 0.7, jitter: 0.3, seed: 15, taper: 0 });
      hatch(g, rect(x0 - fr - 6, top - lintel, x1 + fr + 6, top - lintel + 8), { angle: 0.2, spacing: 2, width: 0.6, color: INK(), alpha: 0.4, seed: 16 });
    }
    for (const [lx0, lx1, s] of [[x0, mid, 0], [mid, x1, 1]]) {
      const leaf = rect(lx0, top, lx1, bottom);
      if (hairline) {
        L(leaf);
        for (const [py0, py1] of [[top + 22, top + 110], [top + 130, bottom - 150], [bottom - 130, bottom - 24]]) L(rect(lx0 + 18, py0, lx1 - 18, py1), true, 0.7);
        continue;
      }
      wash(g, leaf, { color: night(c.door, 0.4), alpha: 1, grainy: false });
      mottle(g, leaf, 0.08);
      for (const [py0, py1] of [[top + 22, top + 110], [top + 130, bottom - 150], [bottom - 130, bottom - 24]]) {
        const pnl = rect(lx0 + 18, py0, lx1 - 18, py1);
        // raised panel: light on the top and left bevels, shade on the bottom and right
        ink(g, [[lx0 + 18, py1], [lx0 + 18, py0], [lx1 - 18, py0]], { width: 2.4, color: '#ffffff', alpha: 0.22, jitter: 0.3, seed: py0 + s, taper: 0 });
        ink(g, [[lx1 - 18, py0], [lx1 - 18, py1], [lx0 + 18, py1]], { width: 2.4, color: '#000000', alpha: 0.35, jitter: 0.3, seed: py1 + s, taper: 0 });
        ink(g, pnl, { width: 0.9, color: INK(), alpha: 0.7, closed: true, jitter: 0.3, seed: py0 * 3 + s });
      }
      // worn paint: the wood shows through where hands and feet touch
      const wr = rng(`wear:${s}`);
      g.fillStyle = night('#8a6a44', 0.4); g.globalAlpha = 0.55;
      for (let i = 0; i < 40; i++) { const x = wr.range(lx0 + 4, lx1 - 4), y = wr.pick([wr.range(bottom - 60, bottom - 4), wr.range(430, 520)]); g.fillRect(x, y, wr.range(2, 9), wr.range(0.8, 2)); }
      g.globalAlpha = 1;
      hatch(g, leaf, { angle: Math.PI / 2 + 0.02, spacing: 4, seg: [30, 120], width: 0.6, color: INK(), alpha: 0.14, seed: 20 + s });
      ink(g, leaf, { width: 1.3, color: INK(), alpha: 0.9, closed: true, jitter: 0.4, seed: 17 + s });
    }
    // the bolt's fixed parts: the plate on the right leaf and the keeper on the left
    const b = BOLT;
    const plate = rect(b.x - 4, b.y - 12, b.x + 40, b.y + 12), keeper = rect(b.x - b.travel - 16, b.y - 9, b.x - b.travel + 2, b.y + 9);
    if (hairline) { L(plate); L(keeper); }
    else for (const pl of [plate, keeper]) { brassFill(g, pl, pl[0][1], pl[2][1]); ink(g, pl, { width: 1, color: '#5a3e10', alpha: 0.85, closed: true, jitter: 0.2, seed: pl[0][0] | 0 }); }
    if (!hairline) { g.fillStyle = '#5a3e10'; for (const [sx, sy] of [[b.x + 2, b.y - 7], [b.x + 34, b.y - 7], [b.x + 2, b.y + 7], [b.x + 34, b.y + 7]]) { g.beginPath(); g.arc(sx, sy, 1.6, 0, TAU); g.fill(); } }

    // the hook, brass, screwed into the surround
    if (hairline) { L([[HOOK.x - 6, HOOK.y - 16], [HOOK.x - 6, HOOK.y + 4], [HOOK.x, HOOK.y + 8], [HOOK.x + 6, HOOK.y + 2]], false); }
    else {
      const rose = [[HOOK.x - 11, HOOK.y - 26], [HOOK.x - 1, HOOK.y - 26], [HOOK.x - 1, HOOK.y - 10], [HOOK.x - 11, HOOK.y - 10]];
      brassFill(g, rose, HOOK.y - 26, HOOK.y - 10);
      ink(g, [[HOOK.x - 6, HOOK.y - 16], [HOOK.x - 6, HOOK.y + 3], [HOOK.x, HOOK.y + 8], [HOOK.x + 6, HOOK.y + 2]], { width: 3.2, color: night(c.brass, 0.3), jitter: 0.1, seed: 30, taper: 1 });
      ink(g, [[HOOK.x - 6, HOOK.y - 16], [HOOK.x - 6, HOOK.y + 3], [HOOK.x, HOOK.y + 8], [HOOK.x + 6, HOOK.y + 2]], { width: 0.8, color: '#5a3e10', alpha: 0.7, jitter: 0.1, seed: 31, taper: 1 });
    }

    // bougainvillea over the top left of the door, from the corner of the wall
    if (!hairline) bougainvillea(g, WX);
  }

  /** A soft cloudiness for large flat washes, so they read as paint and plaster, not a flat fill. */
  function mottle(g, shape, a) {
    g.save(); g.clip(toPath(shape));
    const m = document.createElement('canvas'); m.width = 60; m.height = 40;
    const mg = m.getContext('2d'), img = mg.createImageData(60, 40), r = rng('mottle');
    for (let i = 0; i < 2400; i++) { const v = N((i % 60) * 0.18, Math.floor(i / 60) * 0.18, 7.7) + (r() - 0.5) * 0.2; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v > 0 ? 255 : 30; img.data[i * 4 + 3] = Math.min(255, Math.abs(v) * a * 255 * 3); }
    mg.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(m, 0, 0, W, H); g.restore();
  }

  function brassFill(g, shape, y0, y1) {
    const c = palette(), gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, night(mixHex(c.brass, '#fff4c8', 0.45), 0.3)); gr.addColorStop(0.45, night(c.brass, 0.3)); gr.addColorStop(1, night(mixHex(c.brass, '#5a3e10', 0.45), 0.3));
    g.fillStyle = gr; g.fill(toPath(shape));
  }

  function bougainvillea(g, WX) {
    const c = palette(), start = [DOOR.x0 - DOOR.frame - 150, EAVE + 4];
    const stems = [
      [start, [DOOR.x0 - 120, EAVE + 70], [DOOR.x0 - 40, DOOR.top - DOOR.lintel - 46], [DOOR.x0 + 50, DOOR.top - DOOR.lintel - 30], [DOOR.x0 + 110, DOOR.top - DOOR.lintel - 40]],
      [start, [DOOR.x0 - 170, EAVE + 110], [DOOR.x0 - 110, EAVE + 170], [DOOR.x0 - 76, DOOR.top + 40]],
      [[DOOR.x0 - 120, EAVE + 70], [DOOR.x0 - 90, EAVE + 36], [DOOR.x0 - 20, EAVE + 30], [DOOR.x0 + 40, EAVE + 44]],
      [[DOOR.x0 - 60, DOOR.top - DOOR.lintel - 40], [DOOR.x0 - 70, DOOR.top - 10], [DOOR.x0 - 52, DOOR.top + 30]],
    ];
    for (const [i, s] of stems.entries()) ink(g, s, { width: 2.2 - i * 0.4, color: night('#4a3a22', 0.3), alpha: 0.9, jitter: 0.8, seed: 40 + i, taper: 10 });
    // leaves along the stems, then the bracts in clusters
    const r = rng('bvl');
    for (const s of stems) for (let k = 0; k < s.length - 1; k++) for (let u = 0.05; u < 1; u += 0.16) {
      const x = lerp(s[k][0], s[k + 1][0], u), y = lerp(s[k][1], s[k + 1][1], u), a = r() * TAU;
      const lf = [[x, y], [x + Math.cos(a) * 11 - Math.sin(a) * 6, y + Math.sin(a) * 11 + Math.cos(a) * 6], [x + Math.cos(a) * 21, y + Math.sin(a) * 21], [x + Math.cos(a) * 11 + Math.sin(a) * 6, y + Math.sin(a) * 11 - Math.cos(a) * 6]];
      wash(g, lf, { color: night(c.paddy, 0.4), alpha: 0.9 });
    }
    for (const f of WX.flowers) {
      const s = stems[Math.floor(f.a * 7) % stems.length], k = Math.min(s.length - 2, Math.floor(f.d * (s.length - 1))), u = (f.d * (s.length - 1)) % 1;
      const x = lerp(s[k][0], s[k + 1][0], u) + Math.cos(f.a * 5) * 14, y = lerp(s[k][1], s[k + 1][1], u) + Math.sin(f.a * 5) * 11;
      const col = night(mixHex('#c2186b', c.kokum, f.tone * 0.5), 0.35);
      for (let p = 0; p < 3; p++) {
        const a = f.a + p * (TAU / 3), sz = 9 * f.s;
        const petal = [[x, y], [x + Math.cos(a - 0.5) * sz, y + Math.sin(a - 0.5) * sz], [x + Math.cos(a) * sz * 1.3, y + Math.sin(a) * sz * 1.3], [x + Math.cos(a + 0.5) * sz, y + Math.sin(a + 0.5) * sz]];
        wash(g, petal, { color: col, alpha: 0.92 });
        ink(g, petal, { width: 0.5, color: '#5a0d2e', alpha: 0.5, closed: true, jitter: 0.2, seed: p });
      }
    }
  }
  let lastData = null;
  const weatherOf = () => lastData.weather;

  // ── the moving parts ─────────────────────────────────────────────────────
  function bolt(g, v, mode) {
    const b = BOLT, c = palette(), x = b.x - v * b.travel, hairline = mode === 'hair';
    const shaft = rect(x - 10, b.y - 4.5, x + 36, b.y + 4.5);
    // the handle: up when drawn back, turned down when home
    const hx = x + 22, down = smoothstep(0.7, 1, v), hy = b.y + lerp(-20, 20, down);
    if (hairline) { g.strokeStyle = c.ink; g.lineWidth = hair(); g.stroke(toPath(shaft)); g.beginPath(); g.moveTo(hx, b.y); g.lineTo(hx, hy); g.stroke(); g.beginPath(); g.arc(hx, hy, 3.5, 0, TAU); g.stroke(); return; }
    brassFill(g, shaft, b.y - 4.5, b.y + 4.5);
    ink(g, shaft, { width: 0.9, color: '#5a3e10', alpha: 0.85, closed: true, jitter: 0.1, seed: 50 });
    ink(g, [[hx, b.y], [hx, hy]], { width: 3.4, color: night(c.brass, 0.3), jitter: 0.1, seed: 51, taper: 0 });
    g.fillStyle = night(c.brass, 0.3); g.beginPath(); g.arc(hx, hy, 4.4, 0, TAU); g.fill();
    g.strokeStyle = '#5a3e10'; g.lineWidth = 0.9; g.stroke();
    // the keeper is drawn over the shaft, so the bolt slides in under it
    const keeper = rect(b.x - b.travel - 16, b.y - 9, b.x - b.travel + 2, b.y + 9);
    brassFill(g, keeper, b.y - 9, b.y + 9); ink(g, keeper, { width: 1, color: '#5a3e10', alpha: 0.85, closed: true, jitter: 0.2, seed: 52 });
  }

  /** The key, its ring and its wooden tag, hanging from a pivot at (0, 0). */
  function keyShape(g, mode) {
    const c = palette(), hairline = mode === 'hair', R = KEY.ring;
    if (hairline) {
      g.strokeStyle = c.ink; g.lineWidth = hair();
      g.beginPath(); g.arc(0, R, R, 0, TAU); g.stroke();
      g.beginPath(); g.arc(4, 2 * R + 10, 10, 0, TAU); g.stroke();
      g.strokeRect(1, 2 * R + 20, 6, KEY.len - 30);
      g.strokeRect(7, 2 * R + KEY.len - 30, 12, 10);
      g.beginPath(); g.roundRect(-26, 2 * R - 2, 20, KEY.tag, 8); g.stroke();
      return;
    }
    // the wooden tag first, hanging a little behind
    g.save(); g.translate(-9, 2 * R - 4); g.rotate(0.12);
    const tag = [[-10, 6], [-10, KEY.tag - 8], [0, KEY.tag], [10, KEY.tag - 8], [10, 6], [0, 0]];
    wash(g, tag, { color: night('#9c6a3c', 0.3), alpha: 0.98 });
    hatch(g, tag, { angle: Math.PI / 2 + 0.05, spacing: 2.4, seg: [10, 30], width: 0.6, color: '#3a200e', alpha: 0.4, seed: 60 });
    ink(g, tag, { width: 1, color: INK(), alpha: 0.85, closed: true, jitter: 0.2, seed: 61 });
    g.fillStyle = INK(); g.beginPath(); g.arc(0, 8, 2.2, 0, TAU); g.fill();
    g.restore();
    // the ring
    g.strokeStyle = night('#8a8f98', 0.3); g.lineWidth = 2.6; g.beginPath(); g.arc(0, R, R, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.arc(0, R, R, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
    // the key: a pierced bow, a long shank, the bit
    const kx = 4, bowY = 2 * R + 10, brass = night(c.brass, 0.3);
    g.fillStyle = brass; g.beginPath(); g.arc(kx, bowY, 10.5, 0, TAU); g.fill();
    g.fillStyle = mixHex(brass, '#5a3e10', 0.4); g.beginPath(); g.arc(kx, bowY, 4.2, 0, TAU); g.fill();
    const shank = rect(kx - 3, bowY + 9, kx + 3, 2 * R + KEY.len);
    brassFill(g, shank, 0, 1);
    g.fillStyle = brass; g.fill(toPath(shank));
    const bit = [[kx + 3, 2 * R + KEY.len - 22], [kx + 16, 2 * R + KEY.len - 22], [kx + 16, 2 * R + KEY.len - 16], [kx + 11, 2 * R + KEY.len - 16], [kx + 11, 2 * R + KEY.len - 10], [kx + 16, 2 * R + KEY.len - 10], [kx + 16, 2 * R + KEY.len - 3], [kx + 3, 2 * R + KEY.len - 3]];
    g.fill(toPath(bit));
    ink(g, [...bit, [kx + 3, bowY + 9]], { width: 0.9, color: '#5a3e10', alpha: 0.85, closed: false, jitter: 0.1, seed: 62, taper: 0 });
    ink(g, [[kx - 3, bowY + 9], [kx - 3, 2 * R + KEY.len]], { width: 0.9, color: '#5a3e10', alpha: 0.85, jitter: 0.1, seed: 63, taper: 0 });
    g.strokeStyle = '#5a3e10'; g.lineWidth = 0.9; g.beginPath(); g.arc(kx, bowY, 10.5, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,248,210,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.arc(kx, bowY, 8, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
  }
  function key(g, k, angle, mode) {
    if (!k.visible) return;
    if (mode === 'ink') { // its shadow on the wall, down and to the right
      g.save(); g.translate(k.x + 7, k.y + 8); g.rotate(angle); g.scale(KEY.scale, KEY.scale); g.globalAlpha = 0.22; g.filter = 'blur(2px)';
      g.fillStyle = '#2a1a08'; g.beginPath(); g.roundRect(-18, 10, 34, KEY.len + 12, 10); g.fill();
      g.restore();
    }
    g.save(); g.translate(k.x, k.y); g.rotate(angle); g.scale(KEY.scale, KEY.scale); keyShape(g, mode); g.restore();
  }

  // ── a frame ────────────────────────────────────────────────────────────
  return {
    render(d, frame) {
      lastData = d;
      const mode = reg === 'quiet' ? 'hair' : 'ink', still = frame.still || reg === 'quiet', t = frame.time;
      if (frame.epoch !== epoch) { epoch = frame.epoch; pushes = []; toggles = []; }
      let angle = d.key.angle, bv = d.bolt;
      if (reg === 'playful' && !still) {
        if (pending) {
          const p = pending; pending = null;
          if (Math.hypot(p.x - (BOLT.x + 10), p.y - BOLT.y) < 70) toggles.push(t);
          else if (d.key.onHook) pushes.push({ t, dir: p.x < HOOK.x ? 1 : -1 });
        }
        if (d.key.onHook) angle = swingAngle(t, pushes, ARRIVE.end) * (t < 8.2 || pushes.length ? 1 : 0);
        bv = boltAt(t, toggles);
      }
      const kb = frame.pointer.keyboard && frame.pointer.inside && reg === 'playful' ? `${frame.pointer.x | 0},${frame.pointer.y | 0}` : '';
      const key2 = `${mode}|${isDark()}|${d.key.visible}|${d.key.x.toFixed(1)},${d.key.y.toFixed(1)}|${angle.toFixed(3)}|${bv.toFixed(3)}|${st.canvas.width}|${kb}`;
      if (key2 === lastKey) return;
      lastKey = key2;
      const g = st.begin();
      st.blit(st.cached(`front|${mode}|${isDark()}|${d.seed}`, gg => front(gg, mode)));
      bolt(g, bv, mode);
      key(g, d.key, angle, mode);
      if (kb) {
        const p = frame.pointer;
        g.save(); g.lineWidth = 3; g.strokeStyle = 'rgba(20,24,40,0.55)'; g.beginPath(); g.arc(p.x, p.y, 16, 0, TAU); g.stroke();
        g.lineWidth = 1.6; g.strokeStyle = '#fbf8ef'; g.stroke(); g.restore();
      }
    },
    setRegister(r) { reg = r; lastKey = ''; invalidate(); },
    restyle() { colors = null; st.memo.clear(); lastKey = ''; invalidate(); },
    /** Click, Enter or Space in playful: by the bolt, slide it; anywhere else, swing the key. */
    activate(p) { if (reg === 'playful') { pending = p ? { x: p.x, y: p.y } : { x: HOOK.x + 100, y: HOOK.y }; invalidate(); } },
    destroy() { st.destroy(); },
  };
}
