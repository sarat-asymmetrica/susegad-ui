// Chai: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the paper, the cutting-chai glass with its flutes and glints,
// the steam, the clay diya with its layered flame and the curl of smoke when
// it goes out, the tulsi creeper with its leaves, tendrils and flower spike,
// and the hand-lettered labels are the plate's own code. What the port adds:
// the registers, lit as real state, the keyboard hand in playful, steam that
// stops short of the page's words, dusk for dark pages, the library's own
// Kalam, and a redraw on a steady beat.

import { stage, rng, N, clamp, lerp, phase, ease, TAU, paper, boil, ink, hatch, wash, ellipse, measure, catmull, smoothstep } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import {
  W, H, INK, GROUND, GLASS, DIYA, SPOUT, FLAME, VINE, VINE_GEO, streamline, wispWindow, leafShape, place, STEAM, wispsAt, VINE_DUR, vineGrowth,
} from './model.js';

const HAND = '"Kalam", "Segoe Print", cursive';
const nearCalm = (x, y, calm, pad = 24) => calm.some(r => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);

/** Everything that does not move: paper, fills, hatching, shadows. */
function paintStill(g) {
  paper(g, W, H, { base: '#f2ede2', seed: 4, vignette: 0.07, fibers: 60 });
  const { cx, top, bottom, rt, rb, level } = GLASS;
  const half = y => lerp(rt, rb, (y - top) / (bottom - top));

  // cast shadows on the table, hatched
  hatch(g, ellipse(cx + 30, GROUND + 3, 70, 8), { angle: -0.35, spacing: 3.2, color: INK, alpha: 0.35, seed: 3, width: 0.7 });
  hatch(g, ellipse(DIYA.cx + 26, GROUND + 3, 98, 9), { angle: -0.35, spacing: 3.2, color: INK, alpha: 0.35, seed: 4, width: 0.7 });

  // chai through the glass
  const body = [[cx - half(level) + 2.5, level], [cx + half(level) - 2.5, level], [cx + rb - 2.5, bottom - 5], ...ellipse(cx, bottom - 5, rb - 2.5, 4.5, { start: 0, end: Math.PI, n: 16 }).slice(1, -1), [cx - rb + 2.5, bottom - 5]];
  wash(g, body, { color: '#c28550', alpha: 0.85 });
  hatch(g, body, { angle: 1.45, spacing: 2.6, color: '#6d3f1c', alpha: 0.3, seed: 7, width: 0.7, seg: [4, 11], gap: 0.6, density: (x) => smoothstep(cx + 4, cx + 44, x) });
  hatch(g, body, { angle: 0.05, spacing: 3.4, color: '#6d3f1c', alpha: 0.18, seed: 8, width: 0.6, seg: [5, 14], density: (x, y) => smoothstep(GLASS.level + 40, bottom, y) });
  wash(g, ellipse(cx, level, half(level) - 2.5, 4.2), { color: '#e6c697', alpha: 0.95 });
  // glass tint above the tea
  wash(g, [[cx - rt, top], [cx + rt, top], [cx + half(level), level], [cx - half(level), level]], { color: '#c9d6d8', alpha: 0.18 });

  // diya body
  const { cx: dx, rim, rx, ry } = DIYA;
  const bowl = [...ellipse(dx, rim, rx, ry + 8, { start: Math.PI, end: 0.3, n: 40 }), ...catmull([[dx + rx - 2, rim + 12], [dx + rx + 10, rim - 4], SPOUT], 6).slice(1), [dx + rx - 4, rim - 13], [dx + rx - 24, rim - 9]];
  wash(g, bowl, { color: '#b5623d', alpha: 0.85 });
  hatch(g, bowl, { angle: 0.55, spacing: 3.2, color: '#5a2412', alpha: 0.45, seed: 9, width: 0.8, density: (x, y) => smoothstep(rim + 2, rim + 30, y) * 0.9 + smoothstep(dx + 10, dx + 60, x) * 0.3 });
  wash(g, ellipse(dx, rim, rx - 3, 9), { color: '#5c2716', alpha: 0.9 });
  wash(g, ellipse(dx - 8, rim + 1, rx - 20, 4.5), { color: '#8a5a2a', alpha: 0.5 });
}

function drawGlass(g, t) {
  const b = boil(t, 6), { cx, top, bottom, rt, rb } = GLASS;
  const half = y => lerp(rt, rb, (y - top) / (bottom - top));
  const o = { width: 1.7, color: INK, jitter: 0.55, seed: b };
  ink(g, [[cx - rt, top], [cx - rb, bottom - 4]], { ...o, seed: b + 1 });
  ink(g, [[cx + rt, top], [cx + rb, bottom - 4]], { ...o, seed: b + 2 });
  ink(g, ellipse(cx, bottom - 4, rb, 5, { start: 0, end: Math.PI, n: 24 }), { ...o, seed: b + 3 });
  ink(g, ellipse(cx, top, rt, 6.5, { n: 48 }), { ...o, width: 1.4, closed: true, seed: b + 4 });
  // ribs: the flutes of a cutting-chai glass, following the curve of the cylinder
  for (let k = 1; k <= 7; k++) {
    const th = Math.PI * (k / 8), y0 = bottom - 6, y1 = top + 58;
    const pts = [];
    for (let y = y0; y >= y1; y -= 6) pts.push([cx - Math.cos(th) * (half(y) - 1.5), y + Math.sin(th) * 3]);
    ink(g, pts, { width: 0.75, color: INK, alpha: 0.26, jitter: 0.4, seed: b + 10 + k, taper: 22 });
  }
  // glints
  ink(g, [[cx - rt + 11, top + 16], [cx - rb + 9, bottom - 20]], { width: 3, color: '#fbf8f1', alpha: 0.75, jitter: 0.3, seed: 40, taper: 20 });
  ink(g, [[cx - rt + 18, top + 22], [cx - rt + 17, top + 48]], { width: 1.6, color: '#fbf8f1', alpha: 0.6, jitter: 0.2, seed: 41, taper: 8 });
  ink(g, [[cx - 170, GROUND], [cx + 150, GROUND + 1]], { width: 1.1, color: INK, alpha: 0.55, jitter: 0.8, seed: b + 60, taper: 40 });
}

function drawSteam(g, t, calm = []) {
  const { life } = STEAM, { cx, level } = GLASS;
  for (const { i, age, alpha } of wispsAt(t)) {
    const r = rng(`wisp:${i}`);
    const pts = streamline(cx + r.range(-28, 28), level - 4, t, i * 0.37, 100, 2.2, 0.6);
    let win = wispWindow(pts, age, life);
    // a wisp stops where the page's words begin
    if (calm.length) { const k = win.findIndex(([x, y]) => nearCalm(x, y, calm)); if (k >= 0) win = win.slice(0, k); }
    if (win.length < 3) continue;
    ink(g, win, { width: 1.8, color: '#56607c', alpha, jitter: 0.3, seed: i, taper: 18 });
  }
}

function flamePath(bx, by, tx, ty, w) {
  const p = new Path2D(), lean = tx - bx, h = by - ty;
  p.moveTo(tx, ty);
  p.bezierCurveTo(bx + w * 0.9 + lean * 0.35, by - h * 0.5, bx + w, by - w * 0.1, bx, by + w * 0.5);
  p.bezierCurveTo(bx - w, by - w * 0.1, bx - w * 0.9 + lean * 0.35, by - h * 0.5, tx, ty);
  p.closePath();
  return p;
}

function drawDiya(g, t, s) {
  const b = boil(t, 6), { cx: dx, rim, rx, ry } = DIYA;
  const o = { width: 1.7, color: INK, jitter: 0.55 };
  ink(g, [...ellipse(dx, rim, rx, ry + 8, { start: Math.PI, end: 0.3, n: 40 }), ...catmull([[dx + rx - 2, rim + 12], [dx + rx + 10, rim - 4], SPOUT], 6).slice(1)], { ...o, seed: b + 20 });
  ink(g, catmull([SPOUT, [dx + rx - 4, rim - 13], [dx + rx - 26, rim - 9]], 6), { ...o, width: 1.4, seed: b + 21, taper: 8 });
  ink(g, ellipse(dx, rim, rx, 10, { start: Math.PI * 0.98, end: Math.PI * 2.02, n: 40 }), { ...o, width: 1.3, seed: b + 22 });
  ink(g, ellipse(dx, rim, rx, 10, { start: 0, end: Math.PI, n: 40 }), { ...o, width: 1.3, seed: b + 23, alpha: 0.8 });
  // wick
  ink(g, [[dx + rx - 6, rim - 8], [FLAME.x - 3, FLAME.y + 6], [FLAME.x, FLAME.y + 1]], { width: 2.6, color: '#2a1a12', jitter: 0.2, seed: 31, taper: 3 });
  ink(g, [[dx - 200, GROUND], [dx + 200, GROUND + 1]], { width: 1.1, color: INK, alpha: 0.55, jitter: 0.8, seed: b + 61, taper: 40 });

  const L = s.lit;
  if (L > 0.01) {
    const fl = 1 + 0.13 * N(t * 3.1, 1.1) + 0.05 * N(t * 11, 2.2);
    const h = 56 * L * fl, w = 10 * Math.min(1, 0.4 + L * 0.6) * (1 + 0.06 * N(t * 5, 3.3));
    const bx = FLAME.x, by = FLAME.y - 2;
    const tx = bx + s.lean + 3 * N(t * 2.4, 4.4) + 1.3 * N(t * 9, 5.5), ty = by - h;
    // light on the paper
    const glow = g.createRadialGradient(bx, by - h * 0.4, 4, bx, by - h * 0.4, 150);
    glow.addColorStop(0, `rgba(255,196,110,${0.28 * L})`); glow.addColorStop(0.5, `rgba(255,190,100,${0.09 * L})`); glow.addColorStop(1, 'rgba(255,190,100,0)');
    g.fillStyle = glow; g.fillRect(bx - 160, by - 200, 320, 300);
    g.save();
    g.fillStyle = 'rgba(236,139,48,0.9)'; g.fill(flamePath(bx, by, tx, ty, w));
    g.fillStyle = 'rgba(248,202,96,0.95)'; g.fill(flamePath(bx, by + 1, lerp(bx, tx, 0.8), by - h * 0.72, w * 0.72));
    g.fillStyle = 'rgba(255,246,222,0.95)'; g.fill(flamePath(bx, by + 2, lerp(bx, tx, 0.55), by - h * 0.42, w * 0.42));
    g.fillStyle = 'rgba(80,110,190,0.45)'; g.beginPath(); g.ellipse(bx, by + 2.5, w * 0.55, 2.4, 0, 0, TAU); g.fill();
    g.restore();
    // a fine ink contour keeps the flame in the same hand as everything else
    const c = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, a = u * TAU, side = Math.sin(a);
      c.push([lerp(bx, tx, Math.pow((1 - Math.cos(a)) / 2, 1.6)) + side * w * Math.sin(Math.PI * Math.pow((1 - Math.cos(a)) / 2, 0.55)) * 0.95, lerp(by + w * 0.45, ty, (1 - Math.cos(a)) / 2)]);
    }
    ink(g, c, { width: 0.8, color: '#7a3a12', alpha: 0.5 * L, jitter: 0.25, seed: b + 70, closed: true });
  }
  // smoke after snuffing
  if (s.smokeAt != null) {
    const age = t - s.smokeAt, life = 3.6;
    if (age >= 0 && age < life) {
      const pts = streamline(FLAME.x, FLAME.y - 4, t, 9.1 + s.smokeAt, 90, 2.2, 0.8);
      const win = wispWindow(pts, age, life, 34, 90);
      if (win.length > 2) ink(g, win, { width: 1.5, color: '#646a7e', alpha: 0.75 * (1 - age / life), jitter: 0.3, seed: 90, taper: 20 });
    }
  }
}

function drawVine(g, t, s) {
  const b = boil(t, 6), { stem, leaves, curls } = VINE_GEO;
  const dur = VINE_DUR, local = t - s.growAt;
  const grow = vineGrowth(local);
  const reach = grow * stem.length;
  // the rule the vine grows along
  ink(g, [[VINE.x0 - 6, VINE.y + 12], [VINE.x1 + 6, VINE.y + 12]], { width: 0.9, color: INK, alpha: 0.35, jitter: 0.5, seed: b + 80, taper: 30 });
  if (reach > 2) {
    const pts = [];
    for (let d = 0; d <= reach; d += 3) pts.push(stem.at(d).slice(0, 2));
    pts.push(stem.at(reach).slice(0, 2));
    ink(g, pts, { width: 1.6, color: INK, jitter: 0.45, seed: b + 81, taper: 10 });
  }
  const at = d => local - (d / stem.length) * dur;
  for (const c of curls) {
    const e = ease.outCubic(phase(at(c.d), 0.05, 0.9));
    if (e <= 0) continue;
    const [x, y, a] = stem.at(c.d), pts = [];
    for (let u = 0; u <= e; u += 0.04) {
      const th = u * Math.PI * 3.2, rr = c.r * (1 - u * 0.75);
      const lx = u * 8 + Math.sin(th) * rr, ly = c.side * (c.r - Math.cos(th) * rr);
      pts.push([x + lx * Math.cos(a) - ly * Math.sin(a), y + lx * Math.sin(a) + ly * Math.cos(a)]);
    }
    if (pts.length > 2) ink(g, pts, { width: 0.9, color: INK, alpha: 0.8, jitter: 0.25, seed: b + c.d, taper: 6 });
  }
  leaves.forEach((lf, i) => {
    const e = ease.outBack(phase(at(lf.d), 0.1, 0.75));
    if (e <= 0.001) return;
    const [x, y, a] = stem.at(lf.d);
    const sway = 0.06 * N(t * 0.5, i * 1.7);
    const ang = a - lf.side * lf.open * clamp(e, 0, 1.1) + sway;
    const shape = place(leafShape(lf.len, lf.wid), x, y, ang, Math.max(0.05, e));
    wash(g, shape, { color: '#5f7d3f', alpha: 0.6 });
    ink(g, shape, { width: 1.05, color: INK, jitter: 0.3, seed: b + i * 3, closed: true });
    const rib = place([[2, 0], [lf.len * 0.75, 0]], x, y, ang, Math.max(0.05, e));
    ink(g, rib, { width: 0.6, color: INK, alpha: 0.7, jitter: 0.15, seed: b + i * 3 + 1, taper: 4 });
  });
  // the manjari: tulsi's flower spike, rising from the end of the line
  const m = ease.outCubic(phase(local, dur * 0.9, dur + 1.3));
  if (m > 0) {
    const [ex, ey] = stem.at(stem.length);
    const spike = catmull([[ex, ey], [ex + 5, ey - 18], [ex + 4, ey - 38], [ex - 2, ey - 56]], 8);
    const sm = measure(spike), reachM = sm.length * m;
    const sp = [];
    for (let d = 0; d <= reachM; d += 2) sp.push(sm.at(d).slice(0, 2));
    if (sp.length > 1) ink(g, sp, { width: 1.1, color: INK, jitter: 0.25, seed: b + 90, taper: 6 });
    const r = rng('manjari');
    for (let k = 0; k < 7; k++) {
      const d = 14 + k * 6.2;
      if (d > reachM) break;
      const [px, py, pa] = sm.at(d), s2 = 1 - k * 0.09, grownK = clamp((reachM - d) / 10);
      for (const side of [-1, 1]) {
        const nx = -Math.sin(pa) * side, ny = Math.cos(pa) * side;
        for (let j = 0; j < 2; j++) {
          const off = (3.2 + j * 2.6) * s2 * grownK, rr = (1.9 - j * 0.4) * s2 * grownK;
          if (rr < 0.3) continue;
          const bx = px + nx * off + r.range(-0.6, 0.6), by = py + ny * off + r.range(-0.6, 0.6);
          g.fillStyle = j ? 'rgba(150,104,150,0.75)' : 'rgba(118,78,120,0.85)';
          g.beginPath(); g.arc(bx, by, rr, 0, TAU); g.fill();
        }
      }
    }
  }
}

function labels(g) {
  g.save();
  g.font = `300 21px ${HAND}`;
  g.fillStyle = INK; g.globalAlpha = 0.62; g.textAlign = 'center';
  g.fillText('a loader', GLASS.cx, 448);
  g.fillText('a toggle · tap the flame', DIYA.cx + 20, 448);
  g.fillText('a divider · hover to regrow', (VINE.x0 + VINE.x1) / 2, 448);
  g.restore();
}


// ── The renderer ──────────────────────────────────────────────────────────

const near = (p, x, y, rx, ry) => Math.abs(p.x - x) < rx && Math.abs(p.y - y) < ry;
const onDiya = p => near(p, DIYA.cx, 310, 130, 110);

export function createRenderer(host, { invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  // the lamp and the creeper keep a little state: the flame's spring, the toggle, when the vine last began to grow
  const s = { lit: 1, target: 1, lean: 0, leanV: 0, smokeAt: null, growAt: 0.3, inVine: false };
  let colors = null, lastKey = '', lastT = null, epoch = -1, litParam = true;
  st.onresize = () => { lastKey = ''; invalidate(); };
  const palette = () => (colors ??= readColors(host, { dark: 'light-dark(#000000, #ffffff)' }));

  // Canvas text never asks for a web font: load Kalam ourselves, then repaint the labels.
  if (document.fonts?.load) document.fonts.load(`300 21px ${HAND}`).then(() => { lastKey = ''; invalidate(); }, () => {});

  function toggle(t) {
    if (s.target > 0) { s.target = 0; s.smokeAt = t + 0.15; }
    else { s.target = 1; s.smokeAt = null; }
  }

  function render(data, frame) {
    const look = data.look, calm = frame.calm || [], p = frame.pointer, dark = palette().dark !== '#000000';
    const still = frame.still || look.pace === 0, t = data.t;
    if (frame.epoch !== epoch) { epoch = frame.epoch; s.growAt = 0.3; s.smokeAt = null; }
    // the lit attribute is the lamp's real state; a tap in playful turns it for the moment, until the attribute changes
    if (data.lit !== litParam) { litParam = data.lit; s.target = data.lit ? 1 : 0; s.smokeAt = data.lit ? null : t + 0.15; }
    const dt = still || lastT === null ? 0 : Math.max(0, Math.min(0.1, t - lastT));
    lastT = still ? null : t;

    // flame: spring toward a lean set by the pointer (or the keyboard hand)
    let target = 0;
    if (p.inside && !still) {
      const dx = FLAME.x - p.x, dy = (FLAME.y - 20) - p.y, d = Math.hypot(dx, dy);
      target = (dx / (Math.abs(dx) + 30)) * 17 * smoothstep(280, 40, d);
    }
    if (dt > 0) {
      s.leanV += ((target - s.lean) * 38 - s.leanV * 6.5) * dt;
      s.lean += s.leanV * dt;
      if (s.target > s.lit) s.lit = Math.min(1, s.lit + dt / 0.6);
      else if (s.target < s.lit) s.lit = Math.max(0, s.lit - dt / 0.22);
      // hover regrow for the divider, in playful
      const inVine = look.hand && p.inside && p.x > 800;
      if (inVine && !s.inVine && t - s.growAt > 4.6) s.growAt = t;
      s.inVine = inVine;
    } else if (still) { s.lit = s.target; s.lean = 0; s.leanV = 0; }
    const shown = { ...s, lit: s.target > s.lit ? ease.outBack(s.lit) : s.lit };

    // a steady beat: 24 redraws a second while things move, none in a still
    const calmKey = calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
    const key = `${still ? 's' : Math.floor(t * 24)}|${s.target}|${calmKey}|${dark}|${st.canvas.width}|${p.keyboard && p.inside ? `${p.x | 0},${p.y | 0}` : ''}`;
    if (key === lastKey) return;
    lastKey = key;

    const g = st.begin();
    st.blit(st.cached('still', gg => paintStill(gg)));
    drawSteam(g, t, calm);
    drawGlass(g, t);
    drawDiya(g, t, shown);
    drawVine(g, t, s);
    labels(g);
    if (look.hand && p.keyboard && p.inside) {
      g.save(); g.strokeStyle = INK; g.globalAlpha = 0.7; g.lineWidth = 1.4; g.beginPath(); g.arc(p.x, p.y, 12, 0, TAU); g.stroke(); g.restore();
    }
    // dusk on a dark page: the same ink and paper under an evening light; the flame stays bright
    if (dark) {
      g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(96,104,150,0.55)'; g.fillRect(0, 0, W, H); g.restore();
      if (shown.lit > 0.01) {
        // the lamp's light is not dimmed by dusk: lay its glow back on top
        const gl = g.createRadialGradient(FLAME.x, FLAME.y - 20, 2, FLAME.x, FLAME.y - 20, 120);
        gl.addColorStop(0, `rgba(255,200,120,${0.45 * shown.lit})`); gl.addColorStop(1, 'rgba(255,200,120,0)');
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gl; g.fillRect(FLAME.x - 120, FLAME.y - 140, 240, 240); g.restore();
      }
    }
    host.dataset.lit = String(s.target);
    host.dataset.vine = (vineGrowth(t - s.growAt)).toFixed(3);
  }

  return {
    render,
    setRegister() { lastKey = ''; },
    restyle() { colors = null; lastKey = ''; },
    /** Enter or Space in playful: near the lamp it goes out or is lit again; anywhere else the creeper grows again. */
    activate(p) {
      if (!p) return;
      if (onDiya(p)) toggle(lastT ?? 0); else s.growAt = lastT ?? 0;
      lastKey = ''; invalidate();
    },
    destroy() { st.destroy(); },
  };
}
