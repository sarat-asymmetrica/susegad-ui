// Vahi: the canvas renderer. Owns every side effect.
//
// quiet    a hairline plan: the closed book beside the neat stack, no wash
// warm     ink and wash on handmade paper: a teak table, the pile, the open
//          book; one paper at a time lifts, drifts over the book while its
//          line is written, and settles on the stack; the book closes, the
//          string is wound, and the scene rests
// playful  the same at a brisker pace; the pointer nudges loose papers, and a
//          click (or Enter or Space) throws the pile again to be sorted afresh
//
// Everything that does not move is painted once: the table into a cached
// layer, and every paper, both halves of the book, its cover and the pen into
// small sprites at device resolution. A frame is one blit and a dozen sprites.

import { stage, rng, N, clamp, lerp, TAU, smoothstep, hexToRgb, ink, hatch, wash, roughen, grainPattern, toPath, paper, makeNoise } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, BOOK, STACK, PEN_REST, TUMBLER, CALC, COUNT, entryLine, actionBox, fitAround, scatterOffset } from './model.js';

const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };

/** Cursive-looking scribble: words of loops and humps, `len` long, `h` tall. Returns a list of words (point lists). */
export function scribble(x, y, len, h, seed, slant = 0.25) {
  const r = rng(`scr:${seed}`), out = [];
  let cx = x;
  while (cx < x + len) {
    const word = Math.min(x + len - cx, r.range(16, 46));
    if (word < 7) break;
    const seg = [], f = r.range(0.85, 1.15), ph = r() * TAU;
    for (let u = 0; u <= word; u += 1.5) {
      const hump = Math.abs(Math.sin((u / h) * 2.1 * f + ph)) * h * (0.5 + 0.5 * N(u * 0.09, seed, 1.7));
      const yy = y - hump + Math.sin(u * 0.8 + ph) * h * 0.07;
      seg.push([cx + u + (y - yy) * slant, yy]);
    }
    out.push(seg);
    cx += word + r.range(5, 10);
  }
  return out;
}

/** Draw scribble words up to fraction u of their total length. */
function drawScribble(g, words, u, opts) {
  const total = words.reduce((s, w) => s + w.length, 0);
  let left = Math.round(total * clamp(u));
  for (const w of words) {
    if (left <= 1) break;
    const part = w.slice(0, Math.min(w.length, left));
    left -= w.length;
    if (part.length > 1) ink(g, part, opts);
  }
}

export function createRenderer(host, { register, scene, invalidate }) {
  const st = stage(host, { W, H });
  let reg = register, colors = null, fit = { s: 1, tx: 0, ty: 0 }, fitKey = '', lastKey = '', fitFrom = null, fitTo = null, fitAt = 0;
  let sprites = new Map(), spriteKey = '';
  let epoch = -1, trans = null, lastPoses = null, lastClose = 1;
  const nudge = Array.from({ length: COUNT }, () => ({ x: 0, y: 0 }));
  let prevPointer = null;
  st.onresize = () => { sprites = new Map(); lastKey = ''; invalidate(); };

  function palette() {
    return (colors ??= readColors(host, {
      paper: 'var(--sg-paper, light-dark(#f1ede4, #151a2b))',
      ink: 'var(--sg-ink, light-dark(#1d2742, #ebe5d6))',
      soft: 'var(--sg-ink-soft, light-dark(#48526e, #bdb7a8))',
      pencil: 'var(--sg-pencil, light-dark(#8e93a6, #6e6a5e))',
      indigo: 'var(--sg-indigo, #2b3a6b)',
      laterite: 'var(--sg-laterite, #b3563a)',
      mango: 'var(--sg-mango, #e4b24c)',
      sea: 'var(--sg-sea, #6f98a8)',
      teak: 'var(--sg-vahi-teak, #a0703f)',
      cloth: 'var(--sg-vahi-cloth, #a3302c)',
      sheet: 'var(--sg-vahi-sheet, #fbf8ef)',
      sepia: 'var(--sg-vahi-sepia, #4a2d17)',
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }
  const isDark = () => palette().dark !== '#000000';
  const hair = () => (1.1 * W) / (st.canvas.clientWidth || W) / (fitTo ?? fit).s;

  // ── sprites: small canvases at device resolution, drawn under any transform ──
  /** A sprite covering the logical box (x, y, w, h), painted once by paint(g) in logical units. */
  function sprite(key, x, y, w, h, paint) {
    if (sprites.has(key)) return sprites.get(key);
    const k = st.px * (fitTo ?? fit).s;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * k)); cv.height = Math.max(1, Math.ceil(h * k));
    const g = cv.getContext('2d');
    g.setTransform(k, 0, 0, k, -x * k, -y * k);
    paint(g);
    const out = { cv, x, y, w: cv.width / k, h: cv.height / k };
    sprites.set(key, out);
    return out;
  }
  const put = (g, s) => g.drawImage(s.cv, s.x, s.y, s.w, s.h);
  /** Dusk on a sprite: the lamp-lit room at night, laid over what was painted. */
  function nightOver(g, x, y, w, h, a = 0.34) {
    if (!isDark()) return;
    g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(16,14,40,${a})`; g.fillRect(x, y, w, h); g.restore();
  }

  // ── the table: a teak wash on paper, painted once per size and theme ────
  function table(g) {
    const c = palette(), dark = isDark();
    paper(g, W, H, { base: c.paper, seed: 5, vignette: dark ? 0.04 : 0.08, fibers: 50, speck: dark ? '#000000' : '#3a2f22' });
    const teak = dark ? mixHex(c.teak, c.paper, 0.45) : c.teak, sepia = dark ? mixHex(c.sepia, '#000000', 0.3) : c.sepia;
    const top = roughen([[34, 30], [W - 30, 36], [W - 36, H - 30], [30, H - 36]], { amp: 2.5, freq: 0.02, seed: 4, step: 6 });
    const path = toPath(top);
    g.fillStyle = teak; g.globalAlpha = 0.86; g.fill(path); g.globalAlpha = 1;
    g.save(); g.clip(path);
    // a watercolour wash: cloudy from a tiny noise image, pooling darker toward the edges
    const nz = makeNoise(21), mw = 90, mh = 60, m = document.createElement('canvas'); m.width = mw; m.height = mh;
    const mg = m.getContext('2d'), img = mg.createImageData(mw, mh), [dr, dg, db] = hexToRgb(mixHex(teak, '#3a1c08', 0.6)), [lr, lg2, lb] = hexToRgb(mixHex(teak, '#fff0d8', 0.5));
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const v = nz.fbm(x * 0.05, y * 0.11, 0.3, 4), i = (y * mw + x) * 4, edge = Math.max(Math.abs(x / mw - 0.5), Math.abs(y / mh - 0.5)) * 2;
      const dark = v < 0 || edge > 0.92;
      img.data[i] = dark ? dr : lr; img.data[i + 1] = dark ? dg : lg2; img.data[i + 2] = dark ? db : lb;
      img.data[i + 3] = Math.min(255, (Math.abs(v) * 0.5 + smoothstep(0.86, 1, edge) * 0.35) * 255);
    }
    mg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(m, 0, 0, W, H);
    g.fillStyle = grainPattern(g, '#2a1606', { lo: 0, hi: 0.45 }); g.globalAlpha = 0.12; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    const r = rng('grain');
    // grain: a few long runs per plank, drifting with noise like a pen following the figure
    const seams = [30, 186, 342, 498, 654, H - 30];
    g.strokeStyle = sepia; g.lineCap = 'round';
    for (let pl = 0; pl < seams.length - 1; pl++) {
      const y0 = seams[pl], y1 = seams[pl + 1], fig = r.range(0, 100);
      for (let k = 0; k < 11; k++) {
        const base = y0 + ((k + r.range(0.2, 0.8)) / 11) * (y1 - y0);
        g.globalAlpha = r.range(0.12, 0.34); g.lineWidth = r.range(0.5, 1.2);
        g.beginPath();
        let x = 30 + r.range(-60, 200);
        while (x < W - 30) {
          const len = r.range(90, 320), yy = t => base + nz((t + fig * 40) * 0.0017, base * 0.011, pl) * 26 + Math.sin(t * 0.005 + k) * 3;
          if (r() < 0.7) { g.moveTo(x, yy(x)); for (let t = x + 12; t <= x + len; t += 12) g.lineTo(t, yy(t)); }
          x += len + r.range(20, 140);
        }
        g.stroke();
      }
      if (r() < 0.55) { // a knot, the grain eddying round it
        const kx = r.range(200, W - 200), ky = r.range(y0 + 40, y1 - 40);
        for (let j = 1; j < 5; j++) ink(g, [...Array(25)].map((_, i) => [kx + Math.cos((i / 24) * TAU) * j * 7, ky + Math.sin((i / 24) * TAU) * j * 2.6]), { width: 0.8, color: sepia, alpha: 0.3, jitter: 0.4, seed: j, taper: 0 });
      }
    }
    g.globalAlpha = 1;
    for (const y of seams.slice(1, -1)) ink(g, [[30, y], [W * 0.5, y + r.range(-1, 1)], [W - 30, y + r.range(-1, 1)]], { width: 1.5, color: sepia, alpha: 0.55, jitter: 0.6, seed: y, taper: 0 });
    // window light from the top left
    const lg = g.createRadialGradient(W * 0.2, -H * 0.2, 60, W * 0.4, H * 0.35, W * 1.05);
    lg.addColorStop(0, 'rgba(255,240,215,0.22)'); lg.addColorStop(0.55, 'rgba(255,240,215,0)'); lg.addColorStop(1, 'rgba(40,20,6,0.22)');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    g.restore();
    ink(g, top, { width: 1.6, color: sepia, alpha: 0.8, closed: true, jitter: 0.8, seed: 9 });
    if (dark) { // a lamp at the top right warms the table
      g.save(); g.globalCompositeOperation = 'lighter';
      const lamp = g.createRadialGradient(W * 0.84, H * 0.06, 20, W * 0.7, H * 0.32, W * 0.75);
      lamp.addColorStop(0, 'rgba(255,190,110,0.26)'); lamp.addColorStop(0.5, 'rgba(255,170,90,0.08)'); lamp.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = lamp; g.fillRect(0, 0, W, H); g.restore();
    }
  }
  function quietGround(g) {
    const c = palette(), hw = (1.1 * W) / (st.canvas.clientWidth || W);
    g.fillStyle = c.paper; g.fillRect(0, 0, W, H);
    g.strokeStyle = c.pencil; g.lineWidth = hw * 0.8; g.globalAlpha = 0.7;
    g.strokeRect(34, 30, W - 68, H - 60);
    for (const y of [186, 342, 498, 654]) { g.beginPath(); g.moveTo(34, y); g.lineTo(W - 34, y); g.stroke(); }
    g.globalAlpha = 1;
  }

  // ── papers ───────────────────────────────────────────────────────────────
  function outline(p) {
    const w = p.w, h = p.h, r = rng(`edge:${p.content}`);
    if (p.kind === 'receipt') { // torn across both ends
      const t = [], b = [];
      for (let x = -w / 2; x <= w / 2 + 0.1; x += w / 9) { t.push([x, -h / 2 + r.range(-2.5, 2.5)]); b.push([x, h / 2 + r.range(-3, 3)]); }
      return [...t, ...b.reverse()];
    }
    if (p.kind === 'chit') { // torn from a notebook along the left
      const pts = [[w / 2, -h / 2], [w / 2, h / 2]];
      for (let y = h / 2; y >= -h / 2 - 0.1; y -= h / 12) pts.push([-w / 2 + r.range(-3, 3), y]);
      return pts;
    }
    if (p.kind === 'billbook') { // torn off along the perforation
      const pts = [];
      for (let x = -w / 2; x <= w / 2 + 0.1; x += w / 28) pts.push([x, -h / 2 + (Math.round(x / (w / 28)) % 2 ? 0.8 : -0.8) + r.range(-0.4, 0.4)]);
      pts.push([w / 2, h / 2], [-w / 2, h / 2]);
      return pts;
    }
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  }

  function paintPaper(g, p, mode) {
    const c = palette(), hw = hair(), r = rng(`paper:${p.content}`), w = p.w, h = p.h, x0 = -w / 2, y0 = -h / 2;
    const shape = outline(p), path = toPath(shape), hairline = mode === 'hair';
    const penInk = c.indigo, printInk = hairline ? c.pencil : '#4f4a5e';
    if (!hairline) {
      const base = { receipt: '#f3f4ee', invoice: c.sheet, billbook: p.tint > 0.5 ? '#f2dedb' : '#f1e6bf', chit: '#f4edd8' }[p.kind];
      g.fillStyle = base; g.fill(path);
      g.save(); g.clip(path);
      g.fillStyle = grainPattern(g, '#6b5a3e', { lo: 0, hi: 0.35 }); g.globalAlpha = 0.22; g.fillRect(x0 - 4, y0 - 4, w + 8, h + 8); g.globalAlpha = 1;
      const cg = g.createLinearGradient(x0, y0 + h, x0 + w * 0.4, y0 + h * 0.6);
      cg.addColorStop(0, 'rgba(80,60,30,0.12)'); cg.addColorStop(1, 'rgba(80,60,30,0)');
      g.fillStyle = cg; g.fillRect(x0, y0, w, h);
      g.restore();
    } else { g.fillStyle = c.paper; g.fill(path); }
    g.save(); g.clip(path);
    const line = (x1, y1, x2, y2, color, width = 0.9, alpha = 0.8) => {
      g.strokeStyle = color; g.globalAlpha = hairline ? Math.min(1, alpha + 0.2) : alpha; g.lineWidth = hairline ? hw * 0.75 : width;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.globalAlpha = 1;
    };
    const dashes = (x, y, len, color, width = 1.6, alpha = 0.75) => {
      let xx = x; const rr = rng(`d:${p.content}:${Math.round(x * 7 + y * 13)}`);
      while (xx < x + len - 2) { const l = Math.min(x + len - xx, rr.range(3, 9)); line(xx, y, xx + l, y, color, width, alpha); xx += l + rr.range(1.5, 3); }
    };
    const hand = (x, y, len, hgt, seed, color, alpha, width = 1.15, slant = 0.25) => {
      if (hairline) { dashes(x, y, len, c.pencil, 1, 0.8); return; }
      for (const wd of scribble(x, y, len, hgt, seed, slant)) ink(g, wd, { width, color, alpha, jitter: 0.35, seed, taper: 4 });
    };
    if (p.kind === 'receipt') {
      const fade = hairline ? 1 : 0.5 + 0.5 * p.ink;
      dashes(-w * 0.24, y0 + 16, w * 0.48, printInk, 2.2, 0.8 * fade);
      dashes(-w * 0.16, y0 + 24, w * 0.32, printInk, 1.2, 0.6 * fade);
      for (let x = x0 + 6; x < -x0 - 6; x += 5) line(x, y0 + 32, x + 2.5, y0 + 32, printInk, 0.8, 0.5 * fade);
      let y = y0 + 42;
      for (let i = 0, rows = r.int(6, 9); i < rows; i++, y += 9.5) { dashes(x0 + 7, y, r.range(w * 0.3, w * 0.55), printInk, 1.3, 0.7 * fade); dashes(-x0 - 21, y, 14, printInk, 1.3, 0.7 * fade); }
      for (let x = x0 + 6; x < -x0 - 6; x += 5) line(x, y + 1, x + 2.5, y + 1, printInk, 0.8, 0.5 * fade);
      dashes(x0 + 7, y + 11, w * 0.3, printInk, 2.1, 0.85 * fade); dashes(-x0 - 27, y + 11, 20, printInk, 2.1, 0.85 * fade);
      let bx = -w * 0.3; const by = h / 2 - 26;
      while (bx < w * 0.3) { const bw = r.pick([0.8, 1.2, 2]); line(bx, by, bx, by + 12, printInk, bw, 0.7 * fade); bx += bw + r.pick([1.2, 1.8, 2.6]); }
      if (!hairline && p.ink > 0.4) hand(x0 + 10, y + 30, 34, 6, p.content, c.indigo, 0.7); // a note in pen on the back of the sum
    } else if (p.kind === 'invoice') {
      const acc = [c.sea, c.mango, c.laterite][Math.floor(p.tint * 3) % 3];
      if (!hairline) { g.fillStyle = acc; g.globalAlpha = 0.85; g.beginPath(); g.arc(x0 + 20, y0 + 20, 8, 0, TAU); g.fill(); g.globalAlpha = 1; }
      else { g.strokeStyle = c.pencil; g.lineWidth = hw * 0.8; g.beginPath(); g.arc(x0 + 20, y0 + 20, 8, 0, TAU); g.stroke(); }
      dashes(x0 + 34, y0 + 16, w * 0.35, printInk, 2, 0.8); dashes(x0 + 34, y0 + 24, w * 0.25, printInk, 1, 0.55);
      dashes(-x0 - 12 - w * 0.22, y0 + 18, w * 0.22, printInk, 2.6, 0.8);
      for (let i = 0; i < 3; i++) dashes(x0 + 12, y0 + 44 + i * 7, r.range(w * 0.25, w * 0.4), printInk, 1, 0.5);
      const ty = y0 + 72, th = h * 0.5, cols = [x0 + 12, x0 + 12 + w * 0.5, x0 + 12 + w * 0.66, -x0 - 12];
      if (!hairline) { g.fillStyle = acc; g.globalAlpha = 0.28; g.fillRect(cols[0], ty, cols[3] - cols[0], 9); g.globalAlpha = 1; }
      for (let i = 0; i <= 6; i++) line(cols[0], ty + 9 + i * (th - 9) / 6, cols[3], ty + 9 + i * (th - 9) / 6, printInk, 0.6, 0.35);
      for (const cx of cols) line(cx, ty, cx, ty + th, printInk, 0.6, 0.35);
      for (let i = 0; i < 5; i++) {
        const yy = ty + 9 + (i + 0.62) * (th - 9) / 6;
        dashes(cols[0] + 3, yy, r.range(18, cols[1] - cols[0] - 10), printInk, 1, 0.6);
        dashes(cols[3] - 16, yy, 12, printInk, 1, 0.6);
      }
      g.strokeStyle = printInk; g.lineWidth = hairline ? hw * 0.75 : 1; g.globalAlpha = 0.6; g.strokeRect(cols[2], ty + th + 4, cols[3] - cols[2], 12); g.globalAlpha = 1;
      hand(cols[1] - 30, h / 2 - 14, 44, 7, p.content % 97, penInk, 0.85, 1.2, 0.4);
      line(x0, y0 + h / 3, -x0, y0 + h / 3, hairline ? c.pencil : '#b6ab93', 0.8, 0.45); // folded in three for the post
      line(x0, y0 + (2 * h) / 3, -x0, y0 + (2 * h) / 3, hairline ? c.pencil : '#b6ab93', 0.8, 0.45);
    } else if (p.kind === 'billbook') {
      const rule = hairline ? c.pencil : (p.tint > 0.5 ? '#c0504a' : '#3f64a8'), carbon = '#34438a';
      for (let y = y0 + 6; y < -y0; y += 4) line(x0 + 26, y, x0 + 26, y + 1.4, rule, 1.2, 0.55); // the stub's perforation
      if (!hairline) { g.fillStyle = rule; g.globalAlpha = 0.16; g.fillRect(x0 + 30, y0 + 6, w - 36, 16); g.globalAlpha = 1; }
      for (let i = 0; i < 5; i++) line(x0 + 30, y0 + 34 + i * 14, -x0 - 6, y0 + 34 + i * 14, rule, 0.6, 0.5);
      line(-x0 - 40, y0 + 26, -x0 - 40, -y0 - 8, rule, 0.6, 0.5);
      for (let i = 0; i < 4; i++) hand(x0 + 34, y0 + 32 + i * 14, r.range(50, 90), 6, p.content + i, carbon, 0.55, 1.2);
      hand(-x0 - 36, y0 + 88, 28, 7, p.content + 9, carbon, 0.62, 1.3);
      hand(x0 + 5, y0 + 40, 15, 5, p.content + 11, carbon, 0.5, 1);
    } else { // chit
      const rule = hairline ? c.pencil : '#8fb0d0', lead = '#55585f';
      for (let y = y0 + 12; y < -y0; y += 10) line(x0, y, -x0, y, rule, 0.6, 0.5);
      line(x0 + 14, y0, x0 + 14, -y0, hairline ? c.pencil : '#d27a7a', 0.7, 0.5);
      for (let i = 0; i < 4; i++) hand(x0 + 18, y0 + 20 + i * 12, r.range(30, w - 34), 7, p.content + i * 3, lead, 0.78, 1.1, 0.35);
      if (!hairline) ink(g, [[x0 + 20, y0 + 70], [-x0 - 12, y0 + 68]], { width: 1, color: lead, alpha: 0.7, jitter: 0.8, seed: 5, taper: 6 });
      line(x0 + w * 0.2, y0, x0 + w * 0.6, -y0, hairline ? c.pencil : '#b8ac92', 0.7, 0.3); // a crease
    }
    g.restore();
    if (hairline) { g.strokeStyle = c.ink; g.lineWidth = hw; g.stroke(path); }
    else ink(g, roughen(shape, { amp: 0.5, freq: 0.08, seed: p.content % 13, step: 4 }), { width: 0.9, color: '#4d4231', alpha: 0.6, closed: true, jitter: 0.25, seed: p.i });
  }

  function paperSprite(p, mode) {
    const pad = 4;
    return sprite(`p${p.i}|${mode}`, -p.w / 2 - pad, -p.h / 2 - pad, p.w + pad * 2, p.h + pad * 2, g => {
      paintPaper(g, p, mode);
      if (mode === 'ink') nightOver(g, -p.w / 2 - pad, -p.h / 2 - pad, p.w + pad * 2, p.h + pad * 2);
    });
  }
  /** A paper's shadow is hatched, the way the rest of the drawing is shaded. */
  function shadowSprite(p) {
    const pad = 4;
    return sprite(`s${p.i}`, -p.w / 2 - pad, -p.h / 2 - pad, p.w + pad * 2, p.h + pad * 2, g => {
      const shape = outline(p);
      g.fillStyle = 'rgba(40,20,6,0.16)'; g.fill(toPath(shape));
      hatch(g, shape, { angle: -0.85, spacing: 2.6, seg: [6, 18], width: 0.8, color: '#2a1606', alpha: 0.55, seed: p.i + 3, wobble: 0.5 });
    });
  }

  function drawPaper(g, p, pose, mode, quality) {
    const sc = 1 + pose.lift * 0.035;
    if (mode === 'ink') {
      const off = 1.5 + pose.lift * 16;
      g.save(); g.translate(pose.x + off * 0.75, pose.y + off); g.rotate(pose.a); g.scale(sc, sc);
      g.globalAlpha = (0.85 - pose.lift * 0.35) * (quality < 0.5 ? 0.8 : 1);
      put(g, shadowSprite(p));
      g.restore();
    }
    g.save(); g.translate(pose.x, pose.y); g.rotate(pose.a); g.scale(sc, sc);
    put(g, paperSprite(p, mode));
    g.restore();
  }

  // ── the book ───────────────────────────────────────────────────────────
  const spine = BOOK.x, top = BOOK.y - BOOK.ph / 2, pw = BOOK.pw, ph = BOOK.ph, cl = BOOK.cloth;

  function cloth(g, x, y, w, h, mode, seed) {
    const c = palette();
    if (mode === 'hair') { g.fillStyle = c.paper; g.fillRect(x, y, w, h); g.strokeStyle = c.ink; g.lineWidth = hair(); g.strokeRect(x, y, w, h); return; }
    const rect = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    g.fillStyle = c.cloth; g.fillRect(x, y, w, h);
    hatch(g, rect, { angle: 0.02, spacing: 1.8, seg: [4, 12], width: 0.5, color: mixHex(c.cloth, '#1a0404', 0.5), alpha: 0.35, seed, wobble: 0.3 });
    hatch(g, rect, { angle: Math.PI / 2 + 0.02, spacing: 2.2, seg: [4, 12], width: 0.4, color: mixHex(c.cloth, '#ffd8c8', 0.5), alpha: 0.16, seed: seed + 1, wobble: 0.3 });
    ink(g, rect, { width: 1.1, color: mixHex(c.cloth, '#1a0404', 0.65), alpha: 0.8, closed: true, jitter: 0.4, seed });
  }

  function page(g, x, side, mode) {
    const c = palette(), hairline = mode === 'hair', hw = hair(), w = pw, h = ph, y = top;
    if (!hairline) {
      g.fillStyle = c.sheet; g.fillRect(x, y, w, h);
      const gx = side > 0 ? x : x + w, gut = g.createLinearGradient(gx, 0, gx + side * 36, 0);
      gut.addColorStop(0, 'rgba(70,50,20,0.3)'); gut.addColorStop(1, 'rgba(70,50,20,0)');
      g.fillStyle = gut; g.fillRect(x, y, w, h);
      g.fillStyle = grainPattern(g, '#6b5a3e', { lo: 0, hi: 0.3 }); g.globalAlpha = 0.2; g.fillRect(x, y, w, h); g.globalAlpha = 1;
    } else { g.fillStyle = c.paper; g.fillRect(x, y, w, h); g.strokeStyle = c.ink; g.lineWidth = hw; g.strokeRect(x, y, w, h); }
    const blue = hairline ? c.pencil : '#9db4cf', red = hairline ? c.pencil : '#c96a5c';
    g.lineWidth = hairline ? hw * 0.7 : 0.7;
    g.strokeStyle = blue; g.globalAlpha = 0.8; g.beginPath();
    for (let yy = top + 56; yy < top + h - 10; yy += 25) { g.moveTo(x + 6, yy); g.lineTo(x + w - 6, yy); }
    g.stroke();
    g.strokeStyle = red; g.beginPath();
    const cols = side > 0 ? [x + 26, x + w - 58, x + w - 22] : [x + 22, x + w - 62, x + w - 26];
    for (const cx of cols) { g.moveTo(cx, top + 30); g.lineTo(cx, top + h - 8); }
    g.moveTo(x + 6, top + 44); g.lineTo(x + w - 6, top + 44);
    g.stroke(); g.globalAlpha = 1;
    if (hairline) return;
    if (side < 0) { // last month, in faded ink
      for (let n = 0; n < 8; n++) {
        const yy = top + 52 + n * 25, o = { width: 0.95, color: c.indigo, alpha: 0.34, jitter: 0.4, taper: 3 };
        for (const wd of scribble(x + 4, yy, 14, 6, 400 + n)) ink(g, wd, { ...o, seed: n });
        for (const wd of scribble(x + 28, yy, 60 + ((n * 37) % 60), 6, 500 + n)) ink(g, wd, { ...o, seed: n + 1 });
        for (const wd of scribble(x + w - 56, yy, 26, 6, 600 + n)) ink(g, wd, { ...o, seed: n + 2 });
      }
    }
    g.strokeStyle = 'rgba(120,100,70,0.5)'; g.lineWidth = 0.6;
    for (let i = 1; i <= 3; i++) { const ex = side > 0 ? x + w + i * 1.6 : x - i * 1.6; g.beginPath(); g.moveTo(ex, y + i); g.lineTo(ex, y + h - i); g.stroke(); }
  }

  const halfSprite = (side, mode) => sprite(`half${side}|${mode}`, side > 0 ? spine : spine - pw - cl - 2, top - cl - 2, pw + cl + 4, ph + cl * 2 + 4, g => {
    cloth(g, side > 0 ? spine : spine - pw - cl, top - cl, pw + cl, ph + cl * 2, mode, side > 0 ? 6 : 5);
    page(g, side > 0 ? spine : spine - pw, side, mode);
    if (mode === 'ink') nightOver(g, spine - pw - cl - 2, top - cl - 2, pw * 2 + cl * 2 + 4, ph + cl * 2 + 4, 0.3);
  });
  const coverSprite = mode => sprite(`cover|${mode}`, spine - 3, top - cl - 3, pw + cl + 6, ph + cl * 2 + 6, g => {
    cloth(g, spine - 2, top - cl - 2, pw + cl + 4, ph + cl * 2 + 4, mode, 7);
    label(g, mode);
    if (mode === 'ink') nightOver(g, spine - 3, top - cl - 3, pw + cl + 6, ph + cl * 2 + 6, 0.3);
  });
  function entryWords(e, desk) {
    const L = entryLine(e.rank), P = desk.papers[e.i];
    return [
      ...scribble(L.x0 - 22, L.y, 18 * P.entry.date, 6.5, 1000 + e.i),
      ...scribble(L.x0 + 6, L.y, 104 * P.entry.words, 6.5, 2000 + e.i),
      ...scribble(L.x1 - 34, L.y, 30 * P.entry.amount, 6.5, 3000 + e.i),
    ];
  }
  function entryInk(g, e, mode, desk) {
    const c = palette(), words = entryWords(e, desk);
    if (mode === 'hair') {
      g.strokeStyle = c.pencil; g.lineWidth = hair() * 0.9; g.lineCap = 'round';
      const total = words.reduce((s, w) => s + w.length, 0); let left = Math.round(total * e.written);
      g.beginPath();
      for (const w of words) { const part = w.slice(0, Math.max(0, Math.min(w.length, left))); left -= w.length; part.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); }
      g.stroke(); return;
    }
    drawScribble(g, words, e.written, { width: 1.3, color: isDark() ? mixHex(c.indigo, '#0c0a20', 0.3) : c.indigo, alpha: 0.92, jitter: 0.35, seed: e.i, taper: 4 });
  }
  /** Finished entries as one sprite, repainted only when another line is complete. */
  function entriesSprite(d, mode) {
    const done = d.entries.filter(e => e.written >= 1).sort((a, b) => a.rank - b.rank);
    return sprite(`entries${done.map(e => e.i).join('.')}|${mode}`, spine, top, pw, ph, g => { for (const e of done) entryInk(g, e, mode, d.desk); });
  }

  function label(g, mode) {
    const c = palette(), x = spine + pw / 2 - 44, y = top + 56, w = 88, h = 56;
    if (mode === 'hair') { g.strokeStyle = c.ink; g.lineWidth = hair(); g.strokeRect(x, y, w, h); g.strokeStyle = c.pencil; g.strokeRect(x + 5, y + 5, w - 10, h - 10); return; }
    g.fillStyle = '#efe4c8'; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(90,40,20,0.6)'; g.lineWidth = 0.8; g.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
    ink(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { width: 0.9, color: '#6b3b24', alpha: 0.6, closed: true, jitter: 0.3, seed: 12 });
  }

  function string(g, wind, mode) {
    const c = palette(), x0 = spine - 2, x1 = spine + pw + cl + 2, yA = BOOK.y + 40, yB = BOOK.y + 50, kx = spine + pw * 0.5;
    const legs = [[[x0, yA], [x1, yA - 2]], [[x1, yB - 2], [x0, yB]], [[kx, yA + 1], [kx - 14, yA + 38], [kx - 24, yA + 72]]];
    legs.forEach((leg, i) => {
      const u = clamp(wind * legs.length - i);
      if (u <= 0) return;
      const pts = [leg[0]];
      for (let j = 1; j < leg.length; j++) pts.push(j < leg.length - 1 ? leg[j] : [lerp(leg[j - 1][0], leg[j][0], u), lerp(leg[j - 1][1], leg[j][1], u)]);
      if (mode === 'hair') { g.strokeStyle = c.ink; g.lineWidth = hair(); g.beginPath(); pts.forEach((q, n) => (n ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); return; }
      ink(g, pts.map(([x, y]) => [x + 1, y + 1.6]), { width: 2.6, color: '#3a1a10', alpha: 0.35, jitter: 0.4, seed: 30 + i, taper: 2 });
      ink(g, pts, { width: 2.1, color: isDark() ? '#bdb29c' : '#efe6d2', alpha: 0.95, jitter: 0.4, seed: 20 + i, taper: 2 });
    });
    if (wind >= 1 && mode !== 'hair') { g.fillStyle = isDark() ? '#bdb29c' : '#efe6d2'; g.beginPath(); g.arc(kx, yA + 1, 3.2, 0, TAU); g.fill(); }
  }

  function bookShadow(g, x, w, a = 0.26) { g.fillStyle = `rgba(28,14,4,${a})`; g.fillRect(x + 5, top - cl + 8, w, ph + cl * 2); }

  function drawBook(g, d, close, wind, mode) {
    const writing = d.entries.find(e => e.written > 0 && e.written < 1);
    if (close <= 0) {
      if (mode === 'ink') bookShadow(g, spine - pw - cl, pw * 2 + cl * 2);
      put(g, halfSprite(-1, mode)); put(g, halfSprite(1, mode));
      put(g, entriesSprite(d, mode));
      if (writing) entryInk(g, writing, mode, d.desk);
      if (mode === 'ink') { g.fillStyle = 'rgba(60,30,10,0.35)'; g.fillRect(spine - 1.2, top, 2.4, ph); }
      return;
    }
    // closing: the left board swings over the spine and comes down on the pages
    if (mode === 'ink') bookShadow(g, spine - cl, pw + cl * 2);
    const sx = Math.cos(Math.PI * close);
    if (close < 1) { put(g, halfSprite(1, mode)); put(g, entriesSprite(d, mode)); }
    if (sx > 0) {
      g.save(); g.translate(spine, 0); g.scale(sx, 1); g.translate(-spine, 0);
      put(g, halfSprite(-1, mode));
      if (mode === 'ink') { g.fillStyle = `rgba(40,20,5,${0.4 * (1 - sx)})`; g.fillRect(spine - pw, top, pw, ph); }
      g.restore();
    } else {
      const k = -sx;
      g.save(); g.translate(spine, 0); g.scale(k, 1); g.translate(-spine, 0);
      if (mode === 'ink' && close < 1) { g.fillStyle = `rgba(28,14,4,${0.22 * k})`; g.fillRect(spine + 6, top - cl + 8, pw + cl, ph + cl * 2); }
      put(g, coverSprite(mode));
      if (mode === 'ink' && close < 1) { g.fillStyle = `rgba(40,20,5,${0.35 * (1 - k)})`; g.fillRect(spine, top - cl, pw + cl, ph + cl * 2); }
      g.restore();
      if (close >= 1) string(g, wind, mode);
    }
  }

  // ── the clip on the stack, and the pen ──────────────────────────────────
  function clip(g, u, mode) {
    if (u <= 0) return;
    const c = palette(), x = STACK.x - 94 + 34, y = STACK.y - 108 - 6 - (1 - u) * 26;
    if (mode === 'hair') { g.strokeStyle = c.ink; g.lineWidth = hair(); g.strokeRect(x, y, 44, 18); g.beginPath(); g.moveTo(x + 8, y); g.lineTo(x + 4, y - 16); g.lineTo(x + 40, y - 16); g.lineTo(x + 36, y); g.stroke(); return; }
    g.save(); g.globalAlpha = u;
    g.fillStyle = 'rgba(20,10,4,0.3)'; g.fillRect(x + 3, y + 5, 44, 18);
    const gr = g.createLinearGradient(x, y, x, y + 18); gr.addColorStop(0, '#3d4452'); gr.addColorStop(0.5, '#1f242e'); gr.addColorStop(1, '#2d333f');
    g.fillStyle = gr; g.fillRect(x, y, 44, 18);
    ink(g, [[x + 8, y + 2], [x + 4, y - 16], [x + 40, y - 16], [x + 36, y + 2]], { width: 1.7, color: '#c7ccd6', jitter: 0.2, seed: 4, taper: 0 });
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 2, y + 3); g.lineTo(x + 42, y + 3); g.stroke();
    g.restore();
  }
  const LEN = 150, RAD = 4.6;
  const penSprite = mode => sprite(`pen|${mode}`, -2, -RAD - 2, LEN + 4, RAD * 2 + 4, g => {
    const c = palette();
    if (mode === 'hair') {
      g.strokeStyle = c.ink; g.lineWidth = hair();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(14, -RAD); g.lineTo(LEN, -RAD); g.lineTo(LEN, RAD); g.lineTo(14, RAD); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(LEN - 52, -RAD); g.lineTo(LEN - 52, RAD); g.stroke(); return;
    }
    const body = g.createLinearGradient(0, -RAD, 0, RAD); body.addColorStop(0, '#fbfaf6'); body.addColorStop(0.55, '#e4e1d8'); body.addColorStop(1, '#bdb8ab');
    g.fillStyle = body; g.fillRect(14, -RAD, LEN - 64, RAD * 2);
    g.fillStyle = '#9a927f'; g.beginPath(); g.moveTo(0, 0); g.lineTo(14, -RAD * 0.8); g.lineTo(14, RAD * 0.8); g.fill();
    g.fillStyle = c.indigo; g.beginPath(); g.moveTo(0, 0); g.lineTo(3, -0.9); g.lineTo(3, 0.9); g.fill();
    const cap = g.createLinearGradient(0, -RAD, 0, RAD); cap.addColorStop(0, '#4a5a9a'); cap.addColorStop(0.5, c.indigo); cap.addColorStop(1, '#141a36');
    g.fillStyle = cap; g.beginPath(); g.roundRect(LEN - 52, -RAD - 0.6, 52, RAD * 2 + 1.2, [1, 3, 3, 1]); g.fill();
    g.fillStyle = '#1b2244'; g.fillRect(LEN - 44, -1.3, 40, 2.6);
    ink(g, [[14, -RAD], [LEN - 52, -RAD]], { width: 0.7, color: '#6b6352', alpha: 0.6, jitter: 0.2, seed: 1, taper: 0 });
    ink(g, [[14, RAD], [LEN - 52, RAD]], { width: 0.8, color: '#6b6352', alpha: 0.7, jitter: 0.2, seed: 2, taper: 0 });
    nightOver(g, -2, -RAD - 2, LEN + 4, RAD * 2 + 4, 0.3);
  });
  function pen(g, P, mode) {
    const lift = P.writing ? 1 : 0;
    if (mode === 'ink') { // the shadow falls further from a pen held above the page
      g.save(); g.translate(P.x + 3 + lift * 7, P.y + 4 + lift * 10); g.rotate(P.a);
      g.fillStyle = 'rgba(28,14,4,0.24)'; g.beginPath(); g.moveTo(lift * 8, 0); g.lineTo(16, -RAD); g.lineTo(LEN, -RAD); g.lineTo(LEN, RAD); g.lineTo(16, RAD); g.fill();
      g.restore();
    }
    g.save(); g.translate(P.x, P.y); g.rotate(P.a); put(g, penSprite(mode)); g.restore();
  }


  // ── the table's own things: a steel tumbler of pens, an old calculator ──
  const tumblerSprite = mode => sprite(`tumbler|${mode}`, TUMBLER.x - TUMBLER.r - 16, TUMBLER.y - TUMBLER.r - 16, TUMBLER.r * 2 + 40, TUMBLER.r * 2 + 40, g => {
    const c = palette(), { x, y, r } = TUMBLER, rr = rng('tumbler');
    if (mode === 'hair') {
      g.strokeStyle = c.ink; g.lineWidth = hair(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y, r - 5, 0, TAU); g.stroke();
      g.strokeStyle = c.pencil; for (let i = 0; i < 5; i++) { const a = rr() * TAU, d = rr.range(6, r - 16); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 5, 0, TAU); g.stroke(); }
      return;
    }
    g.fillStyle = 'rgba(28,14,4,0.25)'; g.beginPath(); g.arc(x + 7, y + 9, r + 1, 0, TAU); g.fill();
    const steel = g.createLinearGradient(x - r, y - r, x + r, y + r);
    steel.addColorStop(0, '#f1f3f4'); steel.addColorStop(0.35, '#9aa1a8'); steel.addColorStop(0.6, '#dfe3e6'); steel.addColorStop(1, '#6d747c');
    g.fillStyle = steel; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = '#3b3f45'; g.beginPath(); g.arc(x, y, r - 5, 0, TAU); g.fill();
    // pens and a pencil standing in it, seen from above: their ends in the mouth of the tumbler
    const tops = [['#2b3a6b', 5.5], ['#b3563a', 5], ['#e4b24c', 4.2], ['#1f242e', 5.5], ['#f1ede4', 5]];
    tops.forEach(([col, rad], i) => {
      const a = (i / tops.length) * TAU + rr.range(-0.3, 0.3), d = rr.range(10, r - 14), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(px + 2, py + 2.5, rad, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(px, py, rad, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(px - rad * 0.3, py - rad * 0.3, rad * 0.35, 0, TAU); g.fill();
    });
    ink(g, [...Array(49)].map((_, i) => [x + Math.cos((i / 48) * TAU) * r, y + Math.sin((i / 48) * TAU) * r]), { width: 1.2, color: '#2c3036', alpha: 0.75, jitter: 0.4, seed: 3, closed: true });
    nightOver(g, x - r - 16, y - r - 16, r * 2 + 40, r * 2 + 40, 0.3);
  });
  const calcSprite = mode => sprite(`calc|${mode}`, -CALC.w / 2 - 12, -CALC.h / 2 - 12, CALC.w + 30, CALC.h + 30, g => {
    const c = palette(), w = CALC.w, h = CALC.h, x0 = -w / 2, y0 = -h / 2;
    if (mode === 'hair') {
      g.strokeStyle = c.ink; g.lineWidth = hair(); g.beginPath(); g.roundRect(x0, y0, w, h, 10); g.stroke();
      g.strokeRect(x0 + 14, y0 + 16, w - 28, 34);
      g.strokeStyle = c.pencil;
      for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) g.strokeRect(x0 + 14 + i * 32, y0 + 66 + j * 25, 24, 17);
      return;
    }
    // drawn the way the rest of the table is: a wash, hatched shade, a wobbly inked edge
    const rr = (x, y, ww, hh, r, n = 5) => { const pts = []; for (const [cx, cy, a0] of [[x + ww - r, y + r, -Math.PI / 2], [x + ww - r, y + hh - r, 0], [x + r, y + hh - r, Math.PI / 2], [x + r, y + r, Math.PI]]) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return pts; };
    const outline = rr(x0, y0, w, h, 12);
    hatch(g, outline.map(([x, y]) => [x + 8, y + 10]), { angle: -0.85, spacing: 2.6, seg: [6, 18], width: 0.8, color: '#2a1606', alpha: 0.5, seed: 70, wobble: 0.5 });
    wash(g, outline, { color: '#4f535a', alpha: 0.97, grainy: false });
    hatch(g, outline, { angle: 1.2, spacing: 2.4, seg: [8, 22], width: 0.7, color: '#16181c', alpha: 0.35, seed: 71, density: x => smoothstep(x0 + w * 0.45, x0 + w, x) });
    ink(g, outline, { width: 1.3, color: '#16181c', alpha: 0.85, closed: true, jitter: 0.6, seed: 72 });
    const disp = rr(x0 + 14, y0 + 16, w - 28, 34, 4, 2);
    wash(g, disp, { color: '#a3b092', alpha: 0.95, grainy: false });
    hatch(g, disp, { angle: 0.1, spacing: 2, seg: [10, 30], width: 0.6, color: '#3c4a30', alpha: 0.3, seed: 73, density: (x, y) => 1 - (y - y0 - 16) / 34 });
    ink(g, disp, { width: 1, color: '#16181c', alpha: 0.8, closed: true, jitter: 0.3, seed: 74 });
    for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) {
      const bx = x0 + 14 + i * 32, by = y0 + 66 + j * 25, key = rr(bx, by, 24, 17, 4, 2);
      const col = i === 3 && j > 2 ? '#c96a2e' : j === 0 ? '#8a8e95' : '#e4dfd2';
      wash(g, key.map(([x, y]) => [x + 1, y + 2]), { color: '#16181c', alpha: 0.4, grainy: false });
      wash(g, key, { color: col, alpha: 0.97, grainy: false });
      ink(g, key, { width: 0.7, color: '#16181c', alpha: 0.6, closed: true, jitter: 0.3, seed: i * 7 + j });
      // worn keys: a little shine, a little grime
      ink(g, [[bx + 5, by + 4], [bx + 13, by + 4]], { width: 1.1, color: '#ffffff', alpha: 0.4, jitter: 0.2, seed: i + j * 5, taper: 3 });
    }
    nightOver(g, x0 - 12, y0 - 12, w + 30, h + 30, 0.3);
  });
  function furniture(g, mode) {
    put(g, tumblerSprite(mode));
    g.save(); g.translate(CALC.x, CALC.y); g.rotate(CALC.a); put(g, calcSprite(mode)); g.restore();
  }

  // ── a frame ────────────────────────────────────────────────────────────
  function posesFor(d, frame) {
    const out = d.papers.map(p => ({ x: p.x + nudge[p.i].x, y: p.y + nudge[p.i].y, a: p.a, lift: p.lift, k: p.k }));
    if (trans?.from) {
      const u = clamp((frame.time - trans.t0) / 0.9), e = 1 - Math.pow(1 - u, 3);
      d.papers.forEach((p, idx) => {
        const f = trans.from[p.i];
        if (!f) return;
        const off = scatterOffset(out[idx], trans.at, u);
        out[idx] = { x: lerp(f.x, out[idx].x, e) + off.x, y: lerp(f.y, out[idx].y, e) + off.y, a: lerp(f.a, out[idx].a, e) + Math.sin(u * Math.PI) * 0.5 * (p.i % 2 ? 1 : -1), lift: Math.sin(u * Math.PI), k: out[idx].k };
      });
    }
    return out;
  }

  /** Playful: loose papers in the pointer's way are shoved along with it. Returns whether any moved. */
  function pushPapers(d, frame) {
    const p = frame.pointer;
    if (reg !== 'playful' || frame.still || !p.inside) { prevPointer = null; return false; }
    const lx = (p.x - fit.tx) / fit.s, ly = (p.y - fit.ty) / fit.s;
    const dx = prevPointer ? lx - prevPointer[0] : 0, dy = prevPointer ? ly - prevPointer[1] : 0;
    prevPointer = [lx, ly];
    if (Math.hypot(dx, dy) < 0.5) return false;
    let any = false;
    for (const q of d.papers) {
      if (q.k > 0) continue;
      const n = nudge[q.i], P = d.desk.papers[q.i], dist = Math.hypot(q.x + n.x - lx, q.y + n.y - ly), reach = Math.hypot(P.w, P.h) * 0.45;
      if (dist < reach) { const f = (1 - dist / reach) * 0.6; n.x = clamp(n.x + dx * f, -120, 120); n.y = clamp(n.y + dy * f, -120, 120); any = true; }
    }
    return any;
  }
  /** Once a nudged paper lifts, its nudge fades so it lands squarely on the stack. */
  function relax(d) {
    let any = false;
    for (const q of d.papers) { const n = nudge[q.i]; if (q.k > 0 && (Math.abs(n.x) > 0.05 || Math.abs(n.y) > 0.05)) { n.x *= 0.9; n.y *= 0.9; any = true; } }
    return any;
  }

  return {
    render(d, frame) {
      const fk = frame.calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
      if (fk !== fitKey) {
        // the words moved (a font arrived, the page reflowed): glide the table's action to its new place rather than jump
        const next = fitAround(frame.calm, actionBox(d.seed));
        fitFrom = fitKey && !frame.still && reg !== 'quiet' ? { ...fit } : null; fitTo = next; fitAt = frame.time;
        fitKey = fk; sprites = new Map(); lastKey = '';
        if (!fitFrom) fit = next;
      }
      let gliding = false;
      if (fitFrom) {
        const u = clamp((frame.time - fitAt) / 0.6), e = u * u * (3 - 2 * u);
        fit = { s: lerp(fitFrom.s, fitTo.s, e), tx: lerp(fitFrom.tx, fitTo.tx, e), ty: lerp(fitFrom.ty, fitTo.ty, e) };
        gliding = u < 1;
        if (!gliding) { fit = fitTo; fitFrom = null; }
      }
      const mode = reg === 'quiet' ? 'hair' : 'ink', sk = `${d.seed}|${mode}|${isDark()}|${st.canvas.width}`;
      if (spriteKey !== sk) { spriteKey = sk; sprites = new Map(); lastKey = ''; }
      if (frame.epoch !== epoch) {
        if (epoch >= 0 && lastPoses && trans && !trans.from) trans = { ...trans, from: lastPoses, close: lastClose, t0: frame.time };
        epoch = frame.epoch;
      }
      if (trans && (!trans.from || frame.time - trans.t0 > 0.9)) trans = null;
      const pushed = pushPapers(d, frame), relaxed = relax(d);
      const kb = frame.pointer.keyboard && frame.pointer.inside && reg === 'playful' ? `${frame.pointer.x | 0},${frame.pointer.y | 0}` : '';
      const key = `${d.done.toFixed(4)}|${d.close.toFixed(4)}|${d.wind.toFixed(4)}|${fitKey}|${mode}|${frame.still}|${kb}`;
      if (!trans && !pushed && !relaxed && !gliding && key === lastKey) return; // nothing changed: keep the last frame
      lastKey = key;

      const g = st.begin();
      if (mode === 'hair') quietGround(g);
      else st.blit(st.cached(`table|${isDark()}`, gg => table(gg)));

      g.save(); g.transform(fit.s, 0, 0, fit.s, fit.tx, fit.ty);
      const poses = posesFor(d, frame), idx = new Map(d.papers.map((p, n) => [p.i, n]));
      const P = i => d.desk.papers[i], pose = i => poses[idx.get(i)];
      const close = trans ? lerp(trans.close, d.close, clamp((frame.time - trans.t0) / 0.9)) : d.close;
      furniture(g, mode);
      // the stack under everything, in the order the papers arrived
      if (!trans) for (const p of [...d.papers].filter(p => p.k >= 1).sort((a, b) => a.rank - b.rank)) drawPaper(g, P(p.i), pose(p.i), mode, frame.quality);
      if (!trans) clip(g, smoothstep(0.35, 1, d.close), mode);
      drawBook(g, d, close, trans ? 0 : d.wind, mode);
      // the pile, the first to go on top, then the paper in flight
      for (const i of d.desk.drawOrder) if (trans || d.papers[idx.get(i)].k === 0) drawPaper(g, P(i), pose(i), mode, frame.quality);
      if (!trans) for (const p of d.papers) if (p.k > 0 && p.k < 1) drawPaper(g, P(p.i), pose(p.i), mode, frame.quality);
      pen(g, trans ? { ...PEN_REST, writing: false } : d.pen, mode);
      g.restore();

      const p = frame.pointer;
      if (kb) { // where the keyboard hand is
        g.save(); g.lineWidth = 3; g.strokeStyle = 'rgba(20,8,4,0.55)'; g.beginPath(); g.arc(p.x, p.y, 16, 0, TAU); g.stroke();
        g.lineWidth = 1.6; g.strokeStyle = '#fbf8ef'; g.stroke(); g.restore();
      }
      lastPoses = {};
      d.papers.forEach((q, n) => { lastPoses[q.i] = poses[n]; });
      lastClose = close;
    },
    setRegister(r) { reg = r; lastKey = ''; invalidate(); },
    restyle() { colors = null; sprites = new Map(); st.memo.clear(); lastKey = ''; invalidate(); },
    /** Click, Enter or Space in playful: throw the pile again, away from the hand, and sort it afresh. */
    activate(p) {
      if (reg !== 'playful') return;
      trans = { at: p ? { x: (p.x - fit.tx) / fit.s, y: (p.y - fit.ty) / fit.s } : { x: BOOK.x, y: BOOK.y } };
      for (const n of nudge) { n.x = n.y = 0; }
      scene?.reseed();
    },
    destroy() { st.destroy(); sprites = new Map(); },
  };
}
