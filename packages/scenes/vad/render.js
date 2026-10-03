// Vad: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the limbs as ink ribbons, thick ones outlined and hatched on
// the shaded side with bark fissures, the leaf masses in wash and hatching,
// the aerial roots that hang, reach and thicken into pillars, the ground and
// its shadow, the stone platform and the bicycle are the plate's own code, and
// so is the way finished leaf masses are baked into a layer and the finished
// tree is cycled through three boil variants. What the port adds: the
// registers, progress, a redraw only on the twelve-a-second beat, the finished
// tree shown under the page's words (grown and still), and dusk for dark
// pages. With words="world" the page's words sit in the sky instead, each
// line ending where the canopy's shoulder begins (the type tier's surface).

import { stage, rng, N, ink, hatch, wash, blob, catmull, paper, boil, clamp, lerp, phase, ease, TAU } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, GROUND, KATTA_TOP, PIPE, TRUNK_W, birthTimeOf, scheduleOf, clumpGrow, SKY, layMoment, skyShape, skySizes } from './model.js';
import { createSurface } from '../../type/surface.js';

const INK = '#2e2319', LEAF = '#26301e', WASH = '#9eab7c', BARK = '#ebe1cd';

/** A ribbon with a width per point, wobbled by noise. Returns [left, right, centre]. */
function ribbonSides(pts, widths, seed, jitter) {
  const n = pts.length, L = [], Rr = [], C = [];
  let d = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    if (i) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const off = N(d * 0.03, seed * 0.713, 0.5) * jitter * 1.5;
    const w = (widths[i] / 2) * (1 + 0.14 * N(d * 0.06, seed * 0.31 + 5, 1.5));
    const x = pts[i][0] - ty * off, y = pts[i][1] + tx * off;
    L.push([x - ty * w, y + tx * w]); Rr.push([x + ty * w, y - tx * w]); C.push([x, y]);
  }
  return [L, Rr, C];
}

function poly(g, a, b) {
  g.beginPath();
  a.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  for (let i = b.length - 1; i >= 0; i--) g.lineTo(b[i][0], b[i][1]);
  g.closePath();
}

/** Thin limbs as solid ink; thick ones as contours with hatching on the shaded side. */
function limb(g, pts, widths, seed, tipTaper = false) {
  if (pts.length < 2) return;
  if (tipTaper) {
    // twigs thin to a point over their last few steps, like a pen lifting off
    const n = pts.length;
    widths = widths.map((w, i) => w * (0.25 + 0.75 * Math.min(1, (n - 1 - i) / 6)));
  }
  const [L, Rr, C] = ribbonSides(pts, widths, seed, 0.9);
  if (Math.max(...widths) <= 3) { g.fillStyle = INK; poly(g, L, Rr); g.fill(); return; }
  g.fillStyle = BARK; poly(g, L, Rr); g.fill();
  const shade = new Path2D();
  C.forEach((p, i) => (i ? shade.lineTo(p[0], p[1]) : shade.moveTo(p[0], p[1])));
  for (let i = Rr.length - 1; i >= 0; i--) shade.lineTo(Rr[i][0], Rr[i][1]);
  shade.closePath();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of [...L, ...Rr]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  hatch(g, shade, { angle: -1.15, spacing: 2.5, width: 0.7, color: INK, alpha: 0.78, seed, seg: [5, 16], gap: 0.25, bounds: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } });
  if (Math.max(...widths) > 9) {
    // bark fissures
    for (const k of [-0.62, -0.35, -0.08, 0.2, 0.45]) {
      const line = C.map((p, i) => [lerp(p[0], L[i][0], -k), lerp(p[1], L[i][1], -k)]);
      ink(g, line, { width: 0.7, color: INK, alpha: 0.4, jitter: 1.6, seed: seed + k * 100, taper: 20, freq: 0.08 });
    }
  }
  ink(g, L, { width: 1.2, color: INK, jitter: 0.5, seed: seed + 1, taper: 4 });
  ink(g, Rr, { width: 1.6, color: INK, jitter: 0.5, seed: seed + 2, taper: 4 });
}

function ground(g, cx, hw) {
  const r = rng('ground');
  const shadow = [];
  for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; shadow.push([cx + Math.cos(a) * hw * 0.95, GROUND + 12 + Math.sin(a) * 24]); }
  hatch(g, shadow, { angle: 0.02, spacing: 3.2, width: 0.8, color: INK, alpha: 0.55, seed: 11, seg: [10, 40], gap: 0.4,
    density: x => clamp(1 - Math.abs(x - cx) / (hw * 0.98)) * 0.95 });
  let x = 30;
  while (x < W - 30) {
    const len = r.range(60, 220), pts = [];
    for (let s = 0; s <= 10; s++) pts.push([x + (len * s) / 10, GROUND + 3 + 1.5 * N((x + (len * s) / 10) * 0.01, 3)]);
    ink(g, pts, { width: 1.2, color: INK, jitter: 0.6, seed: x, taper: 18 });
    x += len + r.range(8, 40);
  }
  for (let i = 0; i < 80; i++) {
    const gx = r.range(40, W - 40), h = r.range(3, 9);
    ink(g, [[gx, GROUND + 4], [gx + r.range(-2, 2), GROUND + 4 - h]], { width: 0.8, color: INK, jitter: 0.2, seed: i + 40, taper: 3 });
  }
}

function katta(g, cx) {
  // a round stone platform: top ellipse, a short laterite wall
  const rx = 88, ry = 13, top = KATTA_TOP, bot = GROUND + 1;
  const face = new Path2D();
  face.ellipse(cx, bot - 2, rx, ry, 0, 0, Math.PI); face.lineTo(cx - rx, top); face.ellipse(cx, top, rx, ry, 0, Math.PI, 0, true); face.closePath();
  g.fillStyle = BARK; g.fill(face);
  hatch(g, face, { angle: -1.3, spacing: 3, width: 0.6, color: INK, alpha: 0.5, seed: 5, seg: [4, 12], bounds: { x: cx - rx, y: top - ry, w: rx * 2, h: bot - top + ry * 2 },
    density: x => clamp((x - cx + rx * 0.2) / rx) });
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * ((k + (row ? 0.5 : 0)) / 9 + 0.03);
      if (a > Math.PI) continue;
      const x = cx - Math.cos(a) * rx, y0 = top + Math.sin(a) * ry + row * 11;
      ink(g, [[x, y0], [x, Math.min(y0 + 11, bot - 2 + Math.sin(a) * ry)]], { width: 0.8, color: INK, alpha: 0.8, jitter: 0.2, seed: row * 20 + k, taper: 2 });
    }
  }
  const joint = [], topPts = [], frontPts = [];
  for (let s = 0; s <= 24; s++) { const a = (Math.PI * s) / 24; joint.push([cx - Math.cos(a) * rx, top + Math.sin(a) * ry + 11]); frontPts.push([cx + Math.cos(a) * rx, bot - 2 + Math.sin(a) * ry]); }
  for (let s = 0; s <= 48; s++) { const a = (TAU * s) / 48; topPts.push([cx + Math.cos(a) * rx, top + Math.sin(a) * ry]); }
  ink(g, joint, { width: 0.8, color: INK, alpha: 0.7, jitter: 0.4, seed: 70, taper: 10 });
  ink(g, topPts, { width: 1.3, color: INK, jitter: 0.5, seed: 81, closed: true });
  ink(g, frontPts, { width: 1.4, color: INK, jitter: 0.5, seed: 82, taper: 6 });
  ink(g, [[cx - rx, top], [cx - rx, bot - 2]], { width: 1.2, color: INK, jitter: 0.3, seed: 83, taper: 2 });
  ink(g, [[cx + rx, top], [cx + rx, bot - 2]], { width: 1.2, color: INK, jitter: 0.3, seed: 84, taper: 2 });
}

function bicycle(g, x, y) {
  // leaning a little, the way bicycles rest against a katta
  g.save();
  g.translate(x, y); g.rotate(-0.1);
  const wr = 14, rear = [0, -wr], front = [46, -wr], bb = [20, -wr + 3], seat = [15, -wr - 24], head = [40, -wr - 23];
  for (const [hx, hy] of [rear, front]) {
    ink(g, Array.from({ length: 41 }, (_, i) => [hx + Math.cos((i / 40) * TAU) * wr, hy + Math.sin((i / 40) * TAU) * wr]), { width: 1.2, color: INK, jitter: 0.35, seed: hx + 3, closed: true });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI; ink(g, [[hx - Math.cos(a) * wr, hy - Math.sin(a) * wr], [hx + Math.cos(a) * wr, hy + Math.sin(a) * wr]], { width: 0.35, color: INK, alpha: 0.7, jitter: 0, seed: k, taper: 0 }); }
  }
  for (const [a, b] of [[rear, seat], [rear, bb], [bb, seat], [seat, head], [bb, head], [head, front]]) ink(g, [a, b], { width: 1.5, color: INK, jitter: 0.3, seed: a[0] + b[0], taper: 1 });
  ink(g, [[seat[0] - 1, seat[1]], [seat[0] - 2, seat[1] - 5]], { width: 1.3, color: INK, jitter: 0.1, seed: 5, taper: 0 });
  ink(g, [[seat[0] - 8, seat[1] - 6], [seat[0] + 4, seat[1] - 6]], { width: 2.6, color: INK, jitter: 0.1, seed: 6, taper: 2 });
  ink(g, [[head[0], head[1]], [head[0] - 2, head[1] - 8], [head[0] - 9, head[1] - 10]], { width: 1.4, color: INK, jitter: 0.2, seed: 7, taper: 1 });
  ink(g, [[head[0] - 2, head[1] - 8], [head[0] + 5, head[1] - 10]], { width: 1.2, color: INK, jitter: 0.2, seed: 8, taper: 1 });
  ink(g, [[rear[0] - 2, rear[1] - wr - 2], [seat[0] - 3, rear[1] - wr - 2]], { width: 1.2, color: INK, jitter: 0.2, seed: 9, taper: 1 });
  ink(g, [[rear[0], rear[1]], [rear[0] - 2, rear[1] - wr - 2]], { width: 0.9, color: INK, jitter: 0.2, seed: 10, taper: 1 });
  g.restore();
}

function clumpShape(c, grow) {
  return blob(c.x, c.y, c.rad * grow, { seed: c.seed % 997, wobble: 0.2, squash: 0.78 });
}
function clumpInk(g, c, grow, under, bo) {
  const rad = c.rad * grow, shape = clumpShape(c, grow);
  // knock back the limbs behind the leaves, then colour, then ink
  wash(g, blob(c.x, c.y, rad * 1.05, { seed: c.seed % 997, wobble: 0.18, squash: 0.78 }), { color: '#f2ecdf', alpha: 0.5, grainy: false });
  wash(g, blob(c.x, c.y, rad * 1.12, { seed: c.seed % 997, wobble: 0.18, squash: 0.78 }), { color: WASH, alpha: 0.26 + 0.16 * c.light });
  // light from the upper left: sparse strokes on top of the canopy, dense beneath
  const shadeAt = (x, y) => clamp(0.08 + 0.42 * ((y - c.y) / rad * 0.5 + 0.5) + 0.2 * ((x - c.x) / rad) + 0.55 * c.light);
  hatch(g, shape, { angle: -0.8, spacing: 3.4, width: 0.75, color: LEAF, alpha: 0.72, seed: c.seed + bo, seg: [2.5, 7], gap: 0.9, wobble: 0.6, density: shadeAt });
  hatch(g, shape, { angle: 0.7, spacing: 4, width: 0.6, color: LEAF, alpha: 0.55, seed: c.seed + 3 + bo, seg: [2.5, 6], gap: 1, wobble: 0.6, density: (x, y) => Math.max(0, shadeAt(x, y) - 0.5) * 1.8 });
}


// ── The renderer ──────────────────────────────────────────────────────────

/** The plate's drawTree, given the tree, its schedule and a moment of the growth. */
function drawTree(g, tree, roots, local, bo, layers) {
  const { nodes } = tree, n = nodes.length, R0 = tree.R[0];
  const birthTime = b => birthTimeOf(tree, b);
  // which nodes exist yet, and how thick is each (pipe model, live)
  const live = new Float32Array(n), shown = new Uint8Array(n);
  for (let i = 0; i < n; i++) shown[i] = birthTime(nodes[i].birth) <= local ? 1 : 0;
  for (let i = n - 1; i >= 0; i--) {
    if (!shown[i]) continue;
    let acc = 0, any = false;
    for (const c of nodes[i].children) if (shown[c]) { acc += Math.pow(live[c], PIPE); any = true; }
    live[i] = any ? Math.pow(acc, 1 / PIPE) : 1;
  }
  const widthOf = i => {
    const base = 0.9 + (TRUNK_W - 0.9) * Math.pow((live[i] - 1) / (R0 - 1), 1.05);
    const fromRoot = KATTA_TOP - nodes[i].y;
    return nodes[i].parent < 0 || (i < 40 && fromRoot < 80) ? base * (1 + 0.75 * Math.exp(-Math.max(0, fromRoot) / 20)) : base;
  };

  // finished leaf masses are baked into `layers` once, in birth order
  if (layers) {
    for (const c of tree.clumps) {
      if (layers.done.has(c) || clumpGrow(tree, c, local) < 1) continue;
      clumpInk(layers.ink.getContext('2d'), c, 1, tree.under, 0);
      layers.done.add(c);
    }
  }

  // aerial roots, behind the limbs
  for (const [k, rt] of roots.entries()) {
    const u = phase(local, rt.start, rt.land);
    if (u <= 0) continue;
    const full = (rt.ground - rt.y) * rt.frac;
    const thickU = rt.kind === 'pillar' ? ease.inOutSine(phase(local, rt.thickStart, rt.thickStart + 6)) : 0;
    for (let s = 0; s < rt.strands; s++) {
      const spread = rt.kind === 'hang' ? 2.4 : 3.2;
      const ox = (s - (rt.strands - 1) / 2) * spread * (1 - thickU);
      const len = full * u * (rt.kind === 'hang' ? lerp(0.55, 1, ((rt.seed * (s + 3)) % 100) / 100) : 1);
      const pts = [];
      for (let j = 0; j <= 14; j++) {
        const v = j / 14, y = rt.y + len * v;
        const sway = u < 1 || rt.kind === 'hang' ? 4 * v * v * Math.sin(local * 0.8 + k + s) : 0;
        pts.push([rt.x + ox + 3 * N(y * 0.012, rt.seed % 101, s) + sway, y]);
      }
      if (thickU > 0 && s === 0) {
        limb(g, pts, pts.map((_, j) => lerp(1.2, rt.thick * (0.8 + 0.5 * Math.pow(j / 14, 3)), thickU)), rt.seed + bo);
      } else if (thickU < 0.7) {
        ink(g, pts, { width: rt.kind === 'hang' ? 0.7 : 0.95, color: INK, alpha: 1 - thickU, jitter: 0.8, seed: rt.seed + s * 7 + bo, taper: rt.kind === 'hang' ? len * 0.6 : 10 });
      }
    }
    if (rt.kind !== 'hang' && u >= 1 && thickU < 0.5) {
      for (let f = 0; f < 3; f++) ink(g, [[rt.x, rt.ground - 6], [rt.x + (f - 1) * 4, rt.ground + 1]], { width: 0.6, color: INK, jitter: 0.3, seed: rt.seed + f, taper: 2 });
    }
  }

  // limbs
  for (const [ci, chain] of tree.chains.entries()) {
    let last = 0;
    while (last + 1 < chain.length && shown[chain[last + 1]]) last++;
    if (last < 1) continue;
    const idx = chain.slice(0, last + 1);
    const pts = idx.map(i => [nodes[i].x, nodes[i].y]);
    const widths = idx.map(widthOf);
    if (idx.length > 2 && chain[0] !== 0) widths[0] = widths[1];
    const smooth = catmull(pts, 3);
    const atTip = !nodes[idx[idx.length - 1]].children.some(c => shown[c]);
    limb(g, smooth, smooth.map((_, j) => widths[Math.min(widths.length - 1, Math.floor(j / 3))]), ci * 13 + bo, atTip);
  }

  // leaf ink over the limbs
  if (layers) g.drawImage(layers.ink, 0, 0, W, H);
  for (const c of tree.clumps) {
    if (layers && layers.done.has(c)) continue;
    const gr = clumpGrow(tree, c, local);
    if (gr > 0) clumpInk(g, c, gr, tree.under, bo);
  }
}

/** The dusk laid over a dark page: deep indigo overhead, the evening tint from the canopy down. */
const dusk = g => {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(38,42,84,0.93)'); gr.addColorStop(0.3, 'rgba(44,48,92,0.9)');
  gr.addColorStop(0.55, 'rgba(96,104,150,0.6)'); gr.addColorStop(1, 'rgba(96,104,150,0.55)');
  return gr;
};

export function createRenderer(host, { invalidate = () => {}, scene = null } = {}) {
  const st = stage(host, { W, H });
  // words in the world: the page's words in the sky beside the canopy (lazy; nothing loads until they are placed)
  const surface = createSurface({ host, scene, W, H, invalidate, family: 'Kalam', color: `var(--sg-text, ${INK})` }); // ink on paper, light on dusk
  let colors = null, persist = null, persistKey = '', variants = [], variantsKey = '', lastKey = '';
  st.onresize = () => { lastKey = ''; invalidate(); };
  const palette = () => (colors ??= readColors(host, { dark: 'light-dark(#000000, #ffffff)' }));

  const baseOf = tree => st.cached(`base${tree.cx}|${tree.hw}`, gg => {
    paper(gg, W, H, { base: '#f2ecdf', seed: 4, mottle: 0.03, vignette: 0.12 });
    ground(gg, tree.cx, tree.hw);
    katta(gg, tree.cx);
    bicycle(gg, tree.cx + 124, GROUND + 3);
  });
  /** The finished tree, in up to three boil variants, painted once each (the plate's own trick). */
  function variant(data, k) {
    const key = `${st.canvas.width}|${data.seed}`;
    if (key !== variantsKey) { variantsKey = key; variants = []; }
    while (variants.length <= k) {
      const b = 100 + variants.length * 17;
      variants.push(st.layer(gg => { gg.drawImage(baseOf(data.tree), 0, 0, W, H); drawTree(gg, data.tree, scheduleOf(data.seed).roots, data.endTime + 1, b, null); }));
    }
    return variants[k];
  }

  function render(data, frame) {
    const dark = palette().dark !== '#000000', calm = frame.calm || [], look = data.look, t = frame.time;
    const still = frame.still || look.pace === 0;
    const local = still && !data.held ? data.endTime + 1 : data.local;
    const done = local >= data.endTime;
    // the words are laid against the canopy as it will be at the end of this quarter of the growth
    const lm = layMoment(local, data.endTime), on = data.words === 'world' && frame.register !== 'quiet';
    const words = surface.update(on, `${data.seed}|${lm.toFixed(2)}`, (type, blocks, scale, rootPx) => type.setBlocks(
      blocks.map(b => ({ ...b, ratio: b.tag === 'p' ? 1 : 1.4 })), skyShape(data.tree, lm, 560),
      { sizes: skySizes(scale, rootPx), family: 'Kalam', top: SKY.top, bottom: 420, scale, minWidth: 60, valign: 'top', align: 'left' }));
    // the ink boils a few times a second once the tree is grown; while it grows, the plate's twelve a second
    const beat = still || data.held ? 0 : done ? boil(t, look.boil) % 3 : Math.floor(t * 12);
    const calmKey = calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
    const key = `${data.seed}|${local.toFixed(done ? 0 : 3)}|${beat}|${calmKey}|${dark}|${st.canvas.width}|${frame.epoch}|${words ? words.lines.length + ':' + lm : ''}`;
    if (key === lastKey) return;
    lastKey = key;

    const g = st.begin();
    if (done) st.blit(variant(data, still || data.held ? 0 : beat));
    else {
      const pkey = `${st.canvas.width}:${data.seed}:${frame.epoch}`;
      if (pkey !== persistKey || !persist) { persistKey = pkey; persist = { ink: st.layer(), done: new Set() }; }
      st.blit(baseOf(data.tree));
      drawTree(g, data.tree, scheduleOf(data.seed).roots, local, boil(t, 6), persist);
    }
    // under the page's words the tree is shown grown and still, so the text never sits on moving ink
    if (calm.length && !(done && (still || data.held))) {
      const clip = new Path2D();
      for (const r of calm) clip.rect(r.x - 20, r.y - 20, r.w + 40, r.h + 40);
      g.save(); g.clip(clip); st.blit(variant(data, 0)); g.restore();
    }
    // dusk on a dark page: the same ink and paper under an evening light, never inverted. The sky deepens to
    // indigo overhead (where the page's words are written, in light ink) and eases to the evening tint by the canopy
    if (dark) { g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = dusk(g); g.fillRect(0, 0, W, H); g.restore(); }
    host.dataset.grown = (Math.min(local, data.endTime) / data.endTime).toFixed(3);
  }

  return {
    render,
    setRegister() { lastKey = ''; },
    restyle() { colors = null; lastKey = ''; },
    /** Enter, Space or a tap in playful: a new banyan grows from the platform. */
    activate() { host.getRootNode().host?.reseed?.(); },
    destroy() { surface.destroy(); st.destroy(); },
  };
}
