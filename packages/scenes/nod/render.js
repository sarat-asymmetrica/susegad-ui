// Nod: the canvas renderer. Owns every side effect.
//
// quiet    a hairline still: the glass, and the phone with a message, a
//          drafted reply and an empty tick
// warm     steam rises from the glass; one exchange plays through: a message,
//          the helper typing, the draft, a finger's nod, sent; then only the
//          steam moves
// playful  the draft waits for you: a click, Enter or Space is the nod; then
//          the next message comes, and the next draft waits
//
// The café, the glass's tea and the phone's body are painted once. A frame
// is one blit, the glass's boiling outline, the steam, the screen and, when
// it is needed, a finger.

import { stage, rng, clamp, lerp, TAU, smoothstep, hexToRgb, ink, hatch, wash, ellipse, toPath, paper, N, boil } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, GLASS, PHONE, SCREEN, BACK, TABLE, BEATS, thread, fingerAt, streamline } from './model.js';

const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };
const half = y => lerp(GLASS.rt, GLASS.rb, (y - GLASS.top) / (GLASS.bottom - GLASS.top));

/** Scribble lines standing in for words: humps along a baseline. */
function scribbleLine(x, y, len, h, seed) {
  const r = rng(`s:${seed}`), words = [];
  let cx = x;
  while (cx < x + len - 6) {
    const wl = Math.min(x + len - cx, r.range(12, 34)), seg = [], ph = r() * TAU;
    for (let u = 0; u <= wl; u += 1.4) seg.push([cx + u, y - Math.abs(Math.sin(u * 0.55 + ph)) * h * (0.5 + 0.5 * N(u * 0.1, seed, 2))]);
    words.push(seg);
    cx += wl + r.range(4, 8);
  }
  return words;
}

export function createRenderer(host, { register, scene, invalidate }) {
  const st = stage(host, { W, H });
  let reg = register, colors = null, lastKey = '', epoch = -1, nods = [], pending = false;
  st.onresize = () => { lastKey = ''; invalidate(); };

  function palette() {
    return (colors ??= readColors(host, {
      paper: 'var(--sg-paper, light-dark(#f1ede4, #151a2b))',
      ink: 'var(--sg-ink, light-dark(#1d2742, #ebe5d6))',
      pencil: 'var(--sg-pencil, light-dark(#8e93a6, #6e6a5e))',
      indigo: 'var(--sg-indigo, #2b3a6b)',
      laterite: 'var(--sg-laterite, #b3563a)',
      mango: 'var(--sg-mango, #e4b24c)',
      paddy: 'var(--sg-paddy, #5b8b3b)',
      sea: 'var(--sg-sea, #6f98a8)',
      wall: 'var(--sg-nod-wall, #cfe0d6)',
      tea: 'var(--sg-nod-tea, #c28550)',
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }
  const isDark = () => palette().dark !== '#000000';
  const hair = () => (1.1 * W) / (st.canvas.clientWidth || W);
  const INK = () => (isDark() ? '#e6e2d6' : '#1d2742');
  const tone = (hex, k = 0.45) => (isDark() ? mixHex(hex, palette().paper, k) : hex);

  // ── the café, painted once ─────────────────────────────────────────────
  function cafe(g, mode) {
    const c = palette(), dark = isDark(), hw = hair();
    if (mode === 'hair') {
      g.fillStyle = c.paper; g.fillRect(0, 0, W, H);
      g.strokeStyle = c.pencil; g.lineWidth = hw * 0.8;
      g.beginPath(); g.moveTo(0, BACK); g.lineTo(W, BACK); g.moveTo(0, TABLE + 26); g.lineTo(W, TABLE + 26); g.stroke();
      g.beginPath(); g.moveTo(0, 400); g.lineTo(W, 400); g.stroke(); // the dado on the wall
      glassStill(g, mode); stand(g, mode); phoneBody(g, mode);
      return;
    }
    paper(g, W, H, { base: c.paper, seed: 13, mottle: 0.04, vignette: dark ? 0.04 : 0.07, fibers: 40, speck: dark ? '#000000' : '#3a2f22' });
    // a lime-washed café wall, a darker dado below, both washed loosely
    const wall = [[0, 0], [W, 0], [W, BACK], [0, BACK]];
    wash(g, wall, { color: tone(c.wall, 0.78), alpha: 0.8, grainy: !dark });
    const dado = [[0, 400], [W, 400], [W, BACK], [0, BACK]];
    wash(g, dado, { color: tone(mixHex(c.wall, '#2f5a55', 0.45), 0.7), alpha: 0.75, grainy: !dark });
    ink(g, [[0, 400], [W, 401]], { width: 1.2, color: INK(), alpha: 0.5, jitter: 0.8, seed: 3, taper: 0 });
    hatch(g, wall, { angle: 1.35, spacing: 7, seg: [30, 90], width: 0.6, color: INK(), alpha: 0.08, seed: 5, wobble: 1.2 });
    // sunlight from a window out of frame: a slanted patch on the wall, crossed by the shadow of a bar
    const sun = [[70, 90], [300, 40], [360, 300], [130, 350]];
    g.save(); g.filter = 'blur(16px)';
    g.fillStyle = dark ? 'rgba(255,190,110,0.08)' : 'rgba(255,246,220,0.5)'; g.fill(toPath(sun));
    g.strokeStyle = dark ? 'rgba(0,0,0,0.12)' : 'rgba(47,90,85,0.14)'; g.lineWidth = 12; g.beginPath(); g.moveTo(185, 65); g.lineTo(245, 325); g.stroke();
    g.restore();
    // a window's light falling across the wall from the left
    const lg = g.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, dark ? 'rgba(255,190,110,0.10)' : 'rgba(255,248,230,0.35)'); lg.addColorStop(0.6, 'rgba(255,248,230,0)');
    g.fillStyle = lg; g.fillRect(0, 0, W, TABLE);
    // the marble table top: a band seen a little from above, white with grey veins, a darker front edge
    const top = [[0, BACK], [W, BACK], [W, TABLE], [0, TABLE]];
    g.fillStyle = tone('#f2efe8', 0.55); g.fill(toPath(top));
    const r = rng('veins');
    for (let i = 0; i < 16; i++) {
      const y0 = BACK + r.range(6, TABLE - BACK - 6), pts = [];
      for (let x = r.range(-40, 300); x < W; x += 20) pts.push([x, y0 + N(x * 0.01, i, 3) * 9]);
      ink(g, pts, { width: r.range(0.4, 1.1), color: tone('#8b8a88', 0.4), alpha: 0.4, jitter: 0.8, seed: i, taper: 30 });
    }
    const edge = [[0, TABLE], [W, TABLE], [W, TABLE + 26], [0, TABLE + 26]];
    g.fillStyle = tone('#d8d3c8', 0.5); g.fill(toPath(edge));
    hatch(g, edge, { angle: -0.2, spacing: 2.6, width: 0.6, color: INK(), alpha: 0.28, seed: 7 });
    ink(g, [[0, BACK], [W, BACK]], { width: 1, color: INK(), alpha: 0.55, jitter: 0.6, seed: 8, taper: 0 });
    ink(g, [[0, TABLE], [W, TABLE + 1]], { width: 1.3, color: INK(), alpha: 0.75, jitter: 0.6, seed: 9, taper: 0 });
    ink(g, [[0, TABLE + 26], [W, TABLE + 26]], { width: 1.3, color: INK(), alpha: 0.75, jitter: 0.6, seed: 10, taper: 0 });
    // under the table: the floor in shadow
    g.fillStyle = dark ? 'rgba(0,0,0,0.35)' : 'rgba(60,40,20,0.12)'; g.fillRect(0, TABLE + 26, W, H - TABLE - 26);
    hatch(g, [[0, TABLE + 26], [W, TABLE + 26], [W, H], [0, H]], { angle: -0.6, spacing: 5, seg: [10, 30], width: 0.6, color: INK(), alpha: 0.18, seed: 11 });
    if (dark) { // an evening lamp above the table
      g.save(); g.globalCompositeOperation = 'lighter';
      const lamp = g.createRadialGradient(W * 0.45, -40, 20, W * 0.45, 200, W * 0.7);
      lamp.addColorStop(0, 'rgba(255,190,110,0.22)'); lamp.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lamp; g.fillRect(0, 0, W, H); g.restore();
    }
    glassStill(g, mode); stand(g, mode); phoneBody(g, mode);
  }

  /** The glass's tea, tint and shadow: what does not boil. From the sketchbook plate, scaled up. */
  function glassStill(g, mode) {
    const c = palette(), { cx, top, bottom, rb, level } = GLASS;
    if (mode === 'hair') return;
    hatch(g, ellipse(cx + 40, bottom + 3, 96, 10), { angle: -0.35, spacing: 3.2, color: INK(), alpha: 0.35, seed: 3, width: 0.7 });
    const body = [[cx - half(level) + 3, level], [cx + half(level) - 3, level], [cx + rb - 3, bottom - 6], ...ellipse(cx, bottom - 6, rb - 3, 6, { start: 0, end: Math.PI, n: 16 }).slice(1, -1), [cx - rb + 3, bottom - 6]];
    wash(g, body, { color: tone(c.tea, 0.3), alpha: 0.88 });
    hatch(g, body, { angle: 1.45, spacing: 2.8, color: '#6d3f1c', alpha: 0.3, seed: 7, width: 0.8, seg: [5, 14], gap: 0.6, density: x => smoothstep(cx + 6, cx + 60, x) });
    hatch(g, body, { angle: 0.05, spacing: 3.6, color: '#6d3f1c', alpha: 0.18, seed: 8, width: 0.7, seg: [6, 16], density: (x, y) => smoothstep(level + 50, bottom, y) });
    wash(g, ellipse(cx, level, half(level) - 3, 6), { color: tone('#e6c697', 0.3), alpha: 0.95 });
    wash(g, [[cx - GLASS.rt, top], [cx + GLASS.rt, top], [cx + half(level), level], [cx - half(level), level]], { color: '#c9d6d8', alpha: 0.18 });
  }
  /** The glass's outline and ribs, redrawn with a fresh wobble on twos. */
  function glassInk(g, b, mode) {
    const c = palette(), { cx, top, bottom, rt, rb } = GLASS;
    if (mode === 'hair') {
      g.fillStyle = c.paper; g.beginPath(); g.moveTo(cx - rt, top); g.lineTo(cx + rt, top); g.lineTo(cx + rb, bottom); g.lineTo(cx - rb, bottom); g.fill();
      g.strokeStyle = c.ink; g.lineWidth = hair();
      g.beginPath(); g.moveTo(cx - rt, top); g.lineTo(cx - rb, bottom - 5); g.moveTo(cx + rt, top); g.lineTo(cx + rb, bottom - 5); g.stroke();
      g.beginPath(); g.ellipse(cx, top, rt, 8, 0, 0, TAU); g.stroke();
      g.beginPath(); g.ellipse(cx, bottom - 5, rb, 6, 0, 0, Math.PI); g.stroke();
      g.strokeStyle = c.pencil; g.beginPath(); g.ellipse(cx, GLASS.level, half(GLASS.level), 6, 0, 0, TAU); g.stroke();
      for (let k = 1; k <= 7; k++) { const th = Math.PI * (k / 8); g.beginPath(); g.moveTo(cx - Math.cos(th) * (half(bottom - 8) - 2), bottom - 8); g.lineTo(cx - Math.cos(th) * (half(top + 80) - 2), top + 80); g.stroke(); }
      return;
    }
    const o = { width: 2, color: INK(), jitter: 0.6, seed: b };
    ink(g, [[cx - rt, top], [cx - rb, bottom - 5]], { ...o, seed: b + 1 });
    ink(g, [[cx + rt, top], [cx + rb, bottom - 5]], { ...o, seed: b + 2 });
    ink(g, ellipse(cx, bottom - 5, rb, 6, { start: 0, end: Math.PI, n: 24 }), { ...o, seed: b + 3 });
    ink(g, ellipse(cx, top, rt, 8, { n: 48 }), { ...o, width: 1.6, closed: true, seed: b + 4 });
    // the ribs of a cutting-chai glass, following the curve of the cylinder
    for (let k = 1; k <= 7; k++) {
      const th = Math.PI * (k / 8), pts = [];
      for (let y = bottom - 8; y >= top + 78; y -= 7) pts.push([cx - Math.cos(th) * (half(y) - 2), y + Math.sin(th) * 4]);
      ink(g, pts, { width: 0.9, color: INK(), alpha: 0.26, jitter: 0.4, seed: b + 10 + k, taper: 26 });
    }
    ink(g, [[cx - rt + 14, top + 20], [cx - rb + 11, bottom - 24]], { width: 3.4, color: '#fbf8f1', alpha: 0.7, jitter: 0.3, seed: 40, taper: 22 });
    ink(g, [[cx - rt + 22, top + 26], [cx - rt + 21, top + 58]], { width: 1.8, color: '#fbf8f1', alpha: 0.6, jitter: 0.2, seed: 41, taper: 8 });
  }
  function steam(g, wisps, t, calm) {
    for (const w of wisps) {
      const pts = streamline(w.x, GLASS.level - 6, t, w.i * 0.37, 110, 2.4, 0.6);
      const step = 2.4, head = Math.min(pts.length - 1, Math.floor((w.age * 42) / step));
      const tail = Math.max(0, head - Math.floor((80 * (0.7 + 0.5 * (w.age / w.life))) / step));
      const win = pts.slice(tail, head + 1);
      if (win.length < 3) continue;
      // steam thins out where words sit over the drawing
      const [mx, my] = win[win.length >> 1], quiet = calm.some(r => mx > r.x - 30 && mx < r.x + r.w + 30 && my > r.y - 30 && my < r.y + r.h + 30);
      ink(g, win, { width: 2, color: isDark() ? '#cfd3e0' : '#56607c', alpha: w.alpha * (quiet ? 0.15 : 1), jitter: 0.3, seed: w.i, taper: 20 });
    }
  }

  function stand(g, mode) {
    const c = palette(), x0 = PHONE.x + 20, x1 = PHONE.x + PHONE.w - 20, base = PHONE.y + PHONE.h + 14;
    const block = [[x0 - 16, base], [x1 + 16, base], [x1 + 8, base - 44], [x0 - 8, base - 44]];
    if (mode === 'hair') { g.fillStyle = c.paper; g.fill(toPath(block)); g.strokeStyle = c.ink; g.lineWidth = hair(); g.stroke(toPath(block)); return; }
    g.fillStyle = 'rgba(40,20,6,0.2)'; g.fillRect(x0 - 10, base - 2, x1 - x0 + 44, 12);
    wash(g, block, { color: tone('#9c6a3c', 0.35), alpha: 0.95 });
    hatch(g, block, { angle: 0.1, spacing: 3, seg: [20, 60], width: 0.7, color: '#3a200e', alpha: 0.35, seed: 12 });
    ink(g, block, { width: 1.2, color: INK(), alpha: 0.8, closed: true, jitter: 0.4, seed: 13 });
  }
  function phoneBody(g, mode) {
    const c = palette(), { x, y, w, h, r } = PHONE;
    if (mode === 'hair') {
      g.fillStyle = c.paper; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill();
      g.strokeStyle = c.ink; g.lineWidth = hair(); g.beginPath(); g.roundRect(x, y, w, h, r); g.stroke();
      g.beginPath(); g.roundRect(SCREEN.x, PHONE.y + 12, SCREEN.w, h - 24, r - 10); g.stroke();
      return;
    }
    g.fillStyle = 'rgba(30,20,10,0.25)'; g.beginPath(); g.roundRect(x + 8, y + 10, w, h, r); g.fill();
    g.fillStyle = '#23262c'; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill();
    g.fillStyle = '#383c44'; g.beginPath(); g.roundRect(x + 3, y + 3, w - 6, h - 6, r - 3); g.fill();
    g.fillStyle = isDark() ? '#15181f' : '#f5f2ea'; g.beginPath(); g.roundRect(SCREEN.x, PHONE.y + 12, SCREEN.w, h - 24, r - 10); g.fill();
    ink(g, [[x + 4, y + r], [x + 4, y + h - r]], { width: 1.4, color: '#8a90a0', alpha: 0.5, jitter: 0.2, seed: 1, taper: 10 });
  }

  // ── the screen ─────────────────────────────────────────────────────────
  function bubbleSize(b) { return { w: SCREEN.w * 0.74, h: 16 + b.lines * 14 }; }
  function layout(th, talk) {
    // bottom-up from above the input bar; newest at the bottom
    const items = [];
    for (const b of talk.history) items.push({ kind: b.who === 'them' ? 'ask' : 'reply', b, age: 99 });
    for (const q of th.bubbles) { const ex = talk.exchanges[q.ex % talk.exchanges.length]; items.push({ kind: q.kind, b: q.kind === 'ask' ? ex.ask : ex.reply, age: q.age }); }
    if (th.typing) items.push({ kind: 'typing', age: 0 });
    if (th.draft) { const ex = talk.exchanges[th.draft.ex % talk.exchanges.length]; items.push({ kind: 'draft', b: ex.reply, age: th.draft.age, ticked: th.draft.ticked }); }
    let y = SCREEN.y + SCREEN.h - 50;
    const out = [];
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const h = it.kind === 'typing' ? 28 : bubbleSize(it.b).h + (it.kind === 'draft' ? 26 : 0);
      const slide = it.age < 0.35 ? (1 - smoothstep(0, 0.35, it.age)) * 18 : 0;
      y -= h;
      out.unshift({ ...it, y: y + slide, h, alpha: smoothstep(0, 0.3, it.age) });
      y -= 10;
    }
    return out;
  }
  const tickAt = it => ({ x: SCREEN.x + SCREEN.w - 30, y: it.y + it.h - 15 });

  function screen(g, th, talk, mode, tq) {
    const c = palette(), dark = isDark(), hairline = mode === 'hair', hw = hair();
    g.save();
    g.beginPath(); g.roundRect(SCREEN.x, PHONE.y + 12, SCREEN.w, PHONE.h - 24, PHONE.r - 10); g.clip();
    // header: a round picture and a name, as scribble
    if (!hairline) { g.fillStyle = dark ? '#222733' : '#e9e4d8'; g.fillRect(SCREEN.x, PHONE.y + 12, SCREEN.w, 50); }
    else { g.strokeStyle = c.pencil; g.lineWidth = hw; g.beginPath(); g.moveTo(SCREEN.x, PHONE.y + 62); g.lineTo(SCREEN.x + SCREEN.w, PHONE.y + 62); g.stroke(); }
    g.fillStyle = hairline ? 'transparent' : tone(c.laterite, 0.3);
    g.beginPath(); g.arc(SCREEN.x + 28, PHONE.y + 38, 13, 0, TAU); hairline ? (g.strokeStyle = c.ink, g.stroke()) : g.fill();
    for (const wd of scribbleLine(SCREEN.x + 50, PHONE.y + 42, 80, 7, 5)) {
      if (hairline) { g.strokeStyle = c.pencil; g.beginPath(); wd.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.stroke(); }
      else ink(g, wd, { width: 1.3, color: dark ? '#d8d4c8' : '#2d3140', alpha: 0.85, jitter: 0.3, seed: 2, taper: 3 });
    }
    // the bubbles
    const items = layout(th, talk);
    for (const it of items) {
      if (it.y + it.h < PHONE.y + 62) continue;
      g.globalAlpha = it.alpha;
      if (it.kind === 'typing') { typing(g, it, mode, tq); g.globalAlpha = 1; continue; }
      const { w, h } = bubbleSize(it.b), mine = it.kind !== 'ask', x = mine ? SCREEN.x + SCREEN.w - w - 10 : SCREEN.x + 10;
      const bh = it.kind === 'draft' ? h + 26 : h;
      if (it.kind === 'draft') {
        // a draft waits in a dashed card: written, not sent
        g.fillStyle = hairline ? c.paper : dark ? '#3a3322' : '#fbf1d3';
        g.beginPath(); g.roundRect(x, it.y, w, bh, 12); g.fill();
        g.setLineDash([6, 4]); g.lineWidth = hairline ? hw : 1.6; g.strokeStyle = hairline ? c.ink : tone('#b8871f', 0.2);
        g.beginPath(); g.roundRect(x, it.y, w, bh, 12); g.stroke(); g.setLineDash([]);
        const t = tickAt(it);
        g.lineWidth = hairline ? hw : 1.8; g.strokeStyle = hairline ? c.ink : tone(c.paddy, 0.2);
        if (it.ticked > 0 && !hairline) { g.fillStyle = tone(c.paddy, 0.2); g.globalAlpha = it.alpha * it.ticked; g.beginPath(); g.arc(t.x, t.y, 10, 0, TAU); g.fill(); g.globalAlpha = it.alpha; }
        g.beginPath(); g.arc(t.x, t.y, 10, 0, TAU); g.stroke();
        if (it.ticked > 0) { g.strokeStyle = '#ffffff'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(t.x - 4.5, t.y); g.lineTo(t.x - 1, t.y + 3.6); g.lineTo(t.x + 5, t.y - 3.6); g.stroke(); }
        // a small pen nib: this one is a draft
        g.fillStyle = hairline ? c.pencil : tone('#b8871f', 0.2);
        g.beginPath(); g.moveTo(x + 14, it.y + bh - 9); g.lineTo(x + 20, it.y + bh - 21); g.lineTo(x + 26, it.y + bh - 9); g.lineTo(x + 20, it.y + bh - 6); g.closePath(); hairline ? g.stroke() : g.fill();
      } else {
        const fill = mine ? (dark ? '#2b4452' : '#d5e6ea') : (dark ? '#262a33' : '#ffffff');
        if (hairline) { g.strokeStyle = c.ink; g.lineWidth = hw; g.beginPath(); g.roundRect(x, it.y, w, h, 12); g.stroke(); }
        else { g.fillStyle = fill; g.beginPath(); g.roundRect(x, it.y, w, h, 12); g.fill(); g.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(40,40,60,0.12)'; g.lineWidth = 1; g.stroke(); }
      }
      for (let l = 0; l < it.b.lines; l++) {
        const len = (w - 28) * it.b.widths[l % 3];
        for (const wd of scribbleLine(x + 14, it.y + 22 + l * 14, len, 6, it.b.seed + l)) {
          if (hairline) { g.strokeStyle = c.pencil; g.lineWidth = hw * 0.8; g.beginPath(); wd.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.stroke(); }
          else ink(g, wd, { width: 1.15, color: dark ? '#dcd8cc' : '#2d3140', alpha: 0.8, jitter: 0.25, seed: l, taper: 3 });
        }
      }
      g.globalAlpha = 1;
    }
    // the input bar
    const iy = SCREEN.y + SCREEN.h - 40;
    if (hairline) { g.strokeStyle = c.pencil; g.lineWidth = hw; g.beginPath(); g.roundRect(SCREEN.x + 10, iy, SCREEN.w - 20, 30, 15); g.stroke(); }
    else { g.fillStyle = dark ? '#222733' : '#ebe6da'; g.beginPath(); g.roundRect(SCREEN.x + 10, iy, SCREEN.w - 20, 30, 15); g.fill(); }
    g.restore();
    return items;
  }
  function typing(g, it, mode, tq) {
    const x = SCREEN.x + SCREEN.w - 74, y = it.y, dark = isDark();
    if (mode === 'hair') return;
    g.fillStyle = dark ? '#2b4452' : '#d5e6ea'; g.beginPath(); g.roundRect(x, y, 62, 28, 14); g.fill();
    for (let i = 0; i < 3; i++) {
      const up = Math.max(0, Math.sin(tq * 7 - i * 0.9)) * 3;
      g.fillStyle = dark ? '#9fb4c0' : '#5a6b78'; g.beginPath(); g.arc(x + 17 + i * 14, y + 14 - up, 3.6, 0, TAU); g.fill();
    }
  }

  // ── the finger that nods ─────────────────────────────────────────────────
  function finger(g, u, at) {
    if (u <= 0.001 || !at) return;
    const e = smoothstep(0, 1, u), dx = lerp(300, 0, e), dy = lerp(420, 0, e);
    const tx = at.x + 13 + dx, ty = at.y + 13 + dy, ang = Math.atan2(1.15, 0.75), len = 420, wid = 30;
    g.save(); g.translate(tx, ty); g.rotate(ang - Math.PI / 2);
    const shape = [[-wid / 2, 26], [-wid / 2 + 1, 10], [-wid / 2 + 5, 1], [0, -2], [wid / 2 - 5, 1], [wid / 2 - 1, 10], [wid / 2 + 2, 90], [wid / 2 + 30, 170], [wid / 2 + 44, len], [-wid / 2 - 40, len], [-wid / 2 - 6, 170], [-wid / 2 - 2, 90]];
    const skin = isDark() ? '#8a5a3e' : '#b97d57';
    g.fillStyle = 'rgba(30,15,5,0.18)'; g.save(); g.translate(10, 12); g.fill(toPath(shape)); g.restore();
    wash(g, shape, { color: skin, alpha: 1 });
    hatch(g, shape, { angle: 1.2, spacing: 2.6, seg: [6, 16], width: 0.7, color: '#4a2a18', alpha: 0.3, seed: 4, density: x => smoothstep(0, wid, x) });
    ink(g, shape, { width: 1.4, color: '#3a2014', alpha: 0.85, closed: true, jitter: 0.5, seed: 5 });
    const nail = [[-9, 20], [-8, 7], [0, 3], [8, 7], [9, 20], [0, 22]];
    wash(g, nail, { color: '#e8c4ae', alpha: 0.95 }); ink(g, nail, { width: 0.8, color: '#6b3d26', alpha: 0.7, closed: true, jitter: 0.2, seed: 6 });
    for (const y of [58, 118]) ink(g, [[-wid / 2 + 3, y], [0, y + 4], [wid / 2 + (y > 100 ? 8 : 0) - 3, y]], { width: 0.9, color: '#5a3320', alpha: 0.6, jitter: 0.4, seed: y, taper: 6 });
    g.restore();
  }

  // ── a frame ────────────────────────────────────────────────────────────
  return {
    render(d, frame) {
      const mode = reg === 'quiet' ? 'hair' : 'ink', still = frame.still || reg === 'quiet';
      if (frame.epoch !== epoch) { epoch = frame.epoch; nods = []; }
      let t = d.time, th = d, fing = d.finger;
      if (reg === 'playful') {
        if (pending && !still) { nods.push(t); pending = false; }
        th = thread(t, nods);
        fing = fingerAt(t, th.lastNod, false);
      }
      const fps = reg === 'playful' ? 12 : 8, tick = still ? 0 : boil(t, fps);
      const kb = frame.pointer.keyboard && frame.pointer.inside && reg === 'playful' ? `${frame.pointer.x | 0},${frame.pointer.y | 0}` : '';
      const key = `${mode}|${isDark()}|${tick}|${th.bubbles.length}|${th.draft?.ticked ?? -1}|${th.typing}|${fing.toFixed(3)}|${frame.calm.length}|${st.canvas.width}|${kb}`;
      if (key === lastKey) return;
      lastKey = key;
      const tq = still ? t : tick / fps; // steam and bubbles move on the boil, like paper animation
      const g = st.begin();
      st.blit(st.cached(`cafe|${mode}|${isDark()}`, gg => cafe(gg, mode)));
      if (mode === 'ink' && d.look.steam) steam(g, d.wisps, tq, frame.calm);
      glassInk(g, still ? 0 : tick, mode);
      const items = screen(g, th, d.talk, mode, tq);
      const draftItem = items.find(it => it.kind === 'draft');
      const lastTick = draftItem ? tickAt(draftItem) : { x: SCREEN.x + SCREEN.w - 30, y: SCREEN.y + SCREEN.h - 70 };
      if (mode === 'ink') finger(g, fing, lastTick);
      if (kb) {
        const p = frame.pointer;
        g.save(); g.lineWidth = 3; g.strokeStyle = 'rgba(20,24,40,0.55)'; g.beginPath(); g.arc(p.x, p.y, 16, 0, TAU); g.stroke();
        g.lineWidth = 1.6; g.strokeStyle = '#fbf8ef'; g.stroke(); g.restore();
      }
    },
    setRegister(r) { reg = r; lastKey = ''; invalidate(); },
    restyle() { colors = null; st.memo.clear(); lastKey = ''; invalidate(); },
    /** Click, Enter or Space in playful: the nod. It sends the waiting draft; at any other moment it does nothing. */
    activate() { if (reg === 'playful') { pending = true; invalidate(); } },
    destroy() { st.destroy(); },
  };
}
