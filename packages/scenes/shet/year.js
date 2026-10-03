// Shet: the turning year. Shet is a scape (decision 0020): its first sight is
// the ripe field (render.js), and this file, loaded with a dynamic import()
// once the year starts to turn, carries everything the still does not need:
// the dry ground's cracked plates and last year's stubble, the flood and its
// reflection, the wind written on open water, the rain and the drops that
// darken the mud, the drying, the dusty bunds, and the egrets in flight. The
// drawing code is the plate's own, moved here unchanged; the masks and the
// reflection were closures in the renderer and take its stage instead.

import { ink, hatch, makeNoise, N, rng, clamp, lerp, TAU, smoothstep, hexToRgb, roughen } from '../../engine/index.js';
import { W, H, HY, F, CX, Z_FAR, Y_FAR, proj, unproj, T, gustAt } from './model.js';
import { css, mixc, BUND, HM, fillPoly, addPoly, projPoly, projSeg, noiseWash, haze, grain, paintBunds, SUN_X, GOLDK, LATE } from './render.js';
import { rainOf } from './year-model.js';

const DRY = { gap: '#4f3a28', deep: '#2e1f14', plate: '#c7ab82', rim: '#e5d3ae', ink: '#3b2a1c', stub: '#b8a27a', stubDark: '#6d5a3c' };

/** Chaikin corner cutting on a closed polygon: mud plates curl, so their corners round. */
function chaikin(pts, it = 2, q = 0.25) {
  for (let k = 0; k < it; k++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; out.push([lerp(a[0], b[0], q), lerp(a[1], b[1], q)], [lerp(a[0], b[0], 1 - q), lerp(a[1], b[1], 1 - q)]); }
    pts = out;
  }
  return pts;
}

function* paintDry(g, geo, seed) {
  const r = rng(`shet-dry:${seed}`), top = Y_FAR - 2;
  const gr = g.createLinearGradient(0, top, 0, H);
  gr.addColorStop(0, '#7b654c'); gr.addColorStop(1, DRY.gap);
  g.fillStyle = gr; g.fillRect(0, top, W, H - top);
  // plates: a lit rim toward the sun, then the face
  let n = 0;
  for (const c of geo.cells) {
    if (!c.plate) continue;
    const s = 1 / Math.sqrt(c.cz);
    const pts = c.cz < 3.6 ? roughen(chaikin(projPoly(c.plate), 1, 0.14), { amp: 0.9 * s, freq: 0.09, seed: c.seed, step: 2.2 * s + 0.6 }) : projPoly(c.plate);
    c.shape = pts;
    if (c.cz < 4.5) { g.fillStyle = DRY.rim; g.save(); g.translate(-0.9 * s, -1.1 * s); fillPoly(g, pts); g.restore(); }
    const far = smoothstep(2.5, Z_FAR, c.cz);
    g.fillStyle = css(mixc(mixc(DRY.plate, c.tone > 0 ? '#d6c09a' : '#b39570', Math.abs(c.tone) * 0.45), '#cdbfa4', far * 0.5));
    fillPoly(g, pts);
    if (++n % 90 === 0) yield;
  }
  // pencil tooth over the plates, darker where a plate curls
  const field = new Path2D(); field.rect(0, top, W, H - top);
  hatch(g, field, { bounds: { x: 0, y: top, w: W, h: H - top }, angle: -0.12, spacing: 3.2, seg: [5, 16], gap: 0.6, width: 0.6, color: '#5d4630', alpha: 0.16, seed: seed + 1 });
  yield;
  // plate outlines, the fine (young) cracks, then the old deep ones
  g.lineJoin = 'round';
  for (const c of geo.cells) {
    if (!c.shape || c.cz > 5.5) continue;
    g.strokeStyle = css(hexToRgb(DRY.ink), 0.35 * (1 - smoothstep(2, 5.5, c.cz)));
    g.lineWidth = 0.7 / Math.sqrt(c.cz);
    g.beginPath(); addPoly(g, c.shape); g.stroke();
  }
  yield;
  for (const [a, b] of geo.sEdges) {
    const z = (a[1] + b[1]) / 2;
    ink(g, projSeg(a, b, 4), { width: 1.5 / Math.pow(z, 0.9), color: DRY.deep, alpha: 0.55, jitter: 0.35 / z, freq: 0.08, taper: 3, seed: a[0] * 97 });
    if (++n % 160 === 0) yield;
  }
  for (const [a, b] of geo.pEdges) {
    const z = (a[1] + b[1]) / 2;
    ink(g, projSeg(a, b, 8), { width: 3.2 / Math.pow(z, 0.85), color: DRY.deep, alpha: 0.9, jitter: 0.6 / z, freq: 0.05, taper: 2, pressure: 0.5, seed: a[0] * 131 });
    if (++n % 80 === 0) yield;
  }
  // the walls of the old cracks, hatched in shade on the side facing us
  const walls = new Path2D();
  for (const [a, b] of geo.pEdges) {
    const z = (a[1] + b[1]) / 2;
    if (z > 3.2) continue;
    const pts = projSeg(a, b, 10), wr = rng(a[0] * 977 + b[1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], sl = Math.hypot(x1 - x0, y1 - y0);
      for (let d = 0; d < sl; d += 2.4 / Math.sqrt(z)) {
        const u = d / sl, x = lerp(x0, x1, u), y = lerp(y0, y1, u), len = wr.range(1.5, 3.5) / z;
        walls.moveTo(x, y + 0.5); walls.lineTo(x + len * 0.35, y + len);
      }
    }
  }
  g.strokeStyle = 'rgba(40,26,16,0.5)'; g.lineWidth = 0.6; g.stroke(walls);
  for (const h of geo.hairs) {
    const z = h[0][1];
    ink(g, h.map(p => proj(p[0], p[1])), { width: 0.9 / z, color: DRY.deep, alpha: 0.6, jitter: 0.3, taper: 10, seed: h[0][0] * 71 });
  }
  yield;
  // last year's stubble, standing in its rows: pale cut stems, a shadow each
  const light = new Path2D(), dark = new Path2D(), cutTops = new Path2D();
  for (const c of geo.clumps) {
    const cr = rng(c.gx * 1e4 + c.gz), h = 0.034 * c.sc * c.hk, k = c.sc / F;
    const stems = c.band === 0 ? cr.int(5, 8) : c.band === 1 ? 4 : 2;
    for (let i = 0; i < stems; i++) {
      const x = c.x + cr.range(-3.2, 3.2) * k * 1.6, lean = cr.range(-0.35, 0.35), hh = h * cr.range(0.55, 1);
      const tx = x + lean * hh, ty = c.y - hh;
      dark.moveTo(x + 0.6 * k, c.y + 0.3); dark.lineTo(x + hh * 0.9, c.y + 0.4 * k);
      light.moveTo(x, c.y); light.lineTo(tx, ty);
      if (c.band === 0) { cutTops.moveTo(tx - 0.8 * k, ty); cutTops.lineTo(tx + 0.8 * k, ty - 0.3 * k); }
    }
  }
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(50,34,20,0.32)'; g.lineWidth = 1.1; g.stroke(dark);
  g.strokeStyle = '#8c7650'; g.lineWidth = 1.3; g.stroke(light);
  g.strokeStyle = '#eadbb0'; g.lineWidth = 0.75; g.stroke(light);
  g.strokeStyle = 'rgba(70,50,30,0.55)'; g.lineWidth = 0.6; g.stroke(cutTops);
  yield;
  haze(g, '#e7dcc4', 0.55);
  grain(g, top);
}

function* paintWater(g, seed) {
  const top = Y_FAR - 2, nz = makeNoise(seed + 626);
  const gr = g.createLinearGradient(0, top, 0, H);
  gr.addColorStop(0, '#e2e6df'); gr.addColorStop(0.18, '#c3cecb'); gr.addColorStop(0.6, '#9fb0ae'); gr.addColorStop(1, '#7f9290');
  g.fillStyle = gr; g.fillRect(0, top, W, H - top);
  // the sky upside down: soft clouds, stretched flat by the angle
  noiseWash(g, 0, top, W, H - top, (x, y) => {
    const [gx, gz] = unproj(x, y), v = nz.fbm(gx * 0.5, gz * 0.25, 0.5, 4);
    return v > 0 ? [246, 248, 244, v * 0.55] : [70, 88, 92, -v * 0.3];
  }, 5);
  yield;
  const field = new Path2D(); field.rect(0, top, W, H - top);
  hatch(g, field, { bounds: { x: 0, y: top, w: W, h: H - top }, angle: 0, spacing: 3, seg: [8, 34], gap: 1.4, width: 0.6, color: '#f6f8f2', alpha: 0.35, wobble: 0.2, seed: seed + 7,
    density: (x, y) => 0.3 + 0.5 * smoothstep(-0.2, 0.4, nz(x * 0.006, y * 0.02, 4)) });
  hatch(g, field, { bounds: { x: 0, y: top, w: W, h: H - top }, angle: 0, spacing: 5, seg: [6, 22], gap: 1.6, width: 0.6, color: '#4f6264', alpha: 0.18, wobble: 0.2, seed: seed + 8 });
  yield;
  grain(g, top);
}

function paintStubble(g, geo) {
  const path = new Path2D();
  for (const c of geo.clumps) {
    if (c.band === 0) continue;
    const h = HM * 0.13 * c.sc * c.hk;
    for (let b = 0; b < c.blades.length; b += 2) { const [lean, , off] = c.blades[b]; path.moveTo(c.x + off, c.y); path.lineTo(c.x + off + lean * h * 0.5, c.y - h); }
  }
  g.strokeStyle = '#a88d55'; g.lineWidth = 0.8; g.stroke(path);
}

/** The year's own layers, painted in time slices into L once the still's are down (reading a pixel after each slice). */
export function* yearLayers(st, L, g0, s, scratch) {
  const layer = () => st.layer();
  const dry = layer(); for (const _ of paintDry(dry.getContext('2d'), g0, s)) { scratch.drawImage(dry, 0, 0, 1, 1); yield; }
  const water = layer(); for (const _ of paintWater(water.getContext('2d'), s)) { scratch.drawImage(water, 0, 0, 1, 1); yield; }
  const bundDry = layer(); for (const _ of paintBunds(bundDry.getContext('2d'), g0, BUND.dry, s)) { scratch.drawImage(bundDry, 0, 0, 1, 1); yield; }
  const stubble = layer(); paintStubble(stubble.getContext('2d'), g0); scratch.drawImage(stubble, 0, 0, 1, 1); yield;
  Object.assign(L, { dry, water, bundDry, stubble });
}

/** A flying egret's wings and body (the standing one is the still's, in render.js). */
export function drawFlying(g, pose, outline, EGRET_INK, EGRET_WHITE, EGRET_BILL) {
  // slow, deep wingbeats: long crescents from the shoulder
  const f = Math.sin(pose.flap), tipY = -11 * f, midY = -4.5 * f;
  const wing = (dx, shade) => {
    const w = new Path2D();
    w.moveTo(0.5 + dx, -0.8);
    w.bezierCurveTo(-1 + dx, -2 + midY, -6 + dx, -1 + tipY, -10 + dx, 1 + tipY);
    w.bezierCurveTo(-6 + dx, 0.5 + tipY * 0.6, -3 + dx, 1 + midY * 0.4, -2.5 + dx, 1);
    w.closePath();
    g.fillStyle = shade; g.fill(w); outline(w, 0.35);
  };
  wing(1.5, '#d9d9d2');
  g.strokeStyle = EGRET_INK; g.lineWidth = 0.4;
  g.beginPath(); g.moveTo(-3.5, 0.8); g.lineTo(-9, 1.8); g.moveTo(-3.5, 1); g.lineTo(-8.6, 2.4); g.stroke();
  const body = new Path2D(); body.ellipse(0, 0.3, 4.6, 1.9, -0.04, 0, TAU);
  g.fillStyle = EGRET_WHITE; g.fill(body); outline(body, 0.4);
  const head = new Path2D(); head.arc(4.8, -0.9, 1.35, 0, TAU);
  g.fill(head); outline(head, 0.35);
  g.strokeStyle = EGRET_BILL; g.lineWidth = 0.7; g.beginPath(); g.moveTo(5.9, -0.7); g.lineTo(8.6, -0.1); g.stroke();
  wing(-0.5, EGRET_WHITE);
}

export { makeEgrets } from './year-model.js';

// The whole year's light (render.js explains the columns; the still needs only LATE to the gold).
const DRYK = ['#ece4cc', '#fdf8ea', '#fff6e0', 0.12, 0, 0.4, 0.18, 0.6, 1, -20, 1];
const RAINK = ['#5c6b78', '#a2acb0', '#1c2935', 0.24, 1, 0, 0, 0.95, 0, -60, 0];
export const KEYS = [
  [0, ...DRYK], [7, ...DRYK], [13.5, ...RAINK], [25, ...RAINK],
  [35, '#8fa2ab', '#d2d9d5', '#1c2935', 0.08, 0.6, 0.3, 0.22, 0.5, 0.1, -40, 0],
  [46, '#a6b9c0', '#e5e9df', '#1c2935', 0, 0.35, 0.5, 0.4, 0.25, 0.3, -30, 0],
  LATE, [62, ...GOLDK], [69, ...GOLDK],
  [76, ...DRYK], [80, ...DRYK],
];

/** The egrets now: settled for a still, else stepped (they follow the harvest, and fly from the hand). */
export function birdsNow(egrets, still, on, dt, local, S, near) {
  if (still && on) egrets.settle();
  else if (dt > 0) {
    const cutting = local >= T.cut[0] && local < T.cut[1] + 2;
    egrets.step(dt, on, near, cutting && S.cut > 1.1 && S.cut < 2.3 ? S.cut - 0.15 : null);
  }
  return egrets.placed();
}

/** The harvest: the near rows already cut, as stubble. */
export function stubs(g, near, S, dryness) {
  const path = new Path2D();
  for (const c of near) {
    if (c.gz >= S.cut) continue;
    const h = HM * 0.13 * c.sc * c.hk;
    for (let b = 0; b < c.blades.length; b += 2) { const [lean, , off] = c.blades[b]; path.moveTo(c.x + off, c.y); path.lineTo(c.x + off + lean * h * 0.5, c.y - h); }
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = css(hexToRgb('#a88d55'), 0.9 * (1 - dryness)); g.lineWidth = 1; g.stroke(path);
}

/** The hand's push on one near clump in playful: its lean [bx, m, glow], bent toward the way the hand moves. */
export function lean(c, p, bx, m, glow, pAct, pStr, pdx, pr2) {
  const dx = c.x - p.x, dy = c.y - p.y - 20, d2 = dx * dx + dy * dy;
  if (d2 >= pr2 * 4) return [bx, m, glow];
  const inf = Math.exp(-d2 / pr2) * pAct * pStr;
  return [lerp(bx, pdx || dx / (Math.sqrt(d2) || 1), Math.min(1, inf * 1.5)), m + inf * 1.1, glow + inf];
}

/** The pointer in playful: its speed on the screen, and the prevailing wind swinging round to follow it. Returns the wind's new direction. */
export function steer(pv, p, touch, dt, now, pointerLive, windDir) {
  if (touch && p.inside && dt > 0) {
    const ddt = Math.max(1e-3, (now - pv.lt) / 1000);
    if (pv.lt) { pv.x = lerp(pv.x, (p.x - pv.lx) / ddt, 0.25); pv.y = lerp(pv.y, (p.y - pv.ly) / ddt, 0.25); }
    pv.lx = p.x; pv.ly = p.y; pv.lt = now;
  } else { pv.x *= 0.9; pv.y *= 0.9; pv.lt = 0; }
  const pSpeed = Math.hypot(pv.x, pv.y);
  pv.act = clamp(pv.act + (pointerLive ? dt * 3 : -dt * 0.8));
  if (pv.act > 0.05 && pSpeed > 40) {
    // the prevailing wind swings round to follow
    const target = Math.atan2(-pv.y * 0.35, pv.x);
    let dA = target - windDir; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
    windDir += dA * Math.min(1, dt * 0.6);
  }
  return windDir;
}

/** An egret standing in the flood: its reflection, broken by the water. */
export function reflectBird(g, e, S, local, drawEgret, pose) {
  const b = e.b;
  g.save(); g.globalAlpha = 0.28 * smoothstep(0.3, 0.9, S.water);
  g.translate(e.x, e.y); g.scale(1, -0.8); g.translate(-e.x, -e.y);
  drawEgret(g, e.x + Math.sin(local * 3 + b.i) * 0.6, e.y, e.s, b.dir, pose);
  g.restore();
}

/** The near rice's reflections in the flood, drawn first so the rice stands on them. */
export function riceReflections(g, G, local, S, inWater, clumpH, darkG) {
  const refl = new Path2D();
  for (const c of G.near) {
    if (local < c.plant || c.gz < S.cut) continue;
    const [h] = clumpH(c, local);
    refl.moveTo(c.x, c.y + 1); refl.lineTo(c.x + N(c.gx * 3, local * 0.4) * h * 0.08, c.y + h * 0.45);
  }
  g.lineCap = 'round'; g.strokeStyle = css(hexToRgb(darkG), 0.2 * inWater); g.lineWidth = 2; g.stroke(refl);
}

/** The keyboard hand, so a sighted keyboard user sees where the wind will come from. */
export function hand(g, p) {
  g.save(); g.strokeStyle = '#fbf8ee'; g.lineWidth = 2; g.globalAlpha = 0.9;
  g.beginPath(); g.arc(p.x, p.y, 14, 0, TAU); g.moveTo(p.x - 6, p.y); g.lineTo(p.x + 6, p.y); g.moveTo(p.x, p.y - 6); g.lineTo(p.x, p.y + 6); g.stroke(); g.restore();
}

/** The tree line wavering in the heat when the ground is baking. */
export function shimmer(g, trees, K, t, px) {
  for (let y = 40; y < Y_FAR + 12; y += 3) {
    const near = smoothstep(Y_FAR - 70, Y_FAR, y);
    const off = K.shimmer * (0.3 + 1.1 * near) * Math.sin(y * 0.9 + t * 7 + N(y * 0.05, t * 0.8, 3) * 3);
    g.drawImage(trees, 0, y * px, W * px, 3 * px, off, y, W, 3);
  }
}

const inCalm = (x, y, calm, pad = 30) => calm.some(r => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);

/**
 * The year's machinery for one renderer: the drop and drying masks, the
 * flood's mask and reflection, and the drawing that uses them. `st` is the
 * renderer's stage and `mk` its canvas maker.
 */
export function createYear(st, mk) {
  const MS = 3, mw = Math.ceil(W / MS), mh = Math.ceil(H / MS);
  const mask = mk(mw, mh), mg = mask.getContext('2d'), maskImg = mg.createImageData(mw, mh);
  const wmask = mk(mw, mh), wmg = wmask.getContext('2d'), wImg = wmg.createImageData(mw, mh);
  let seed = null, stampIdx = 0, maskMode = '', dryV = null, waterV = null, lastWL = NaN, reflC = null;
  const tmps = {};

  function resetMask() { mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, mw, mh); stampIdx = 0; maskMode = ''; }
  function stampTo(G, local) {
    mg.setTransform(1 / MS, 0, 0, 1 / MS, 0, 0);
    mg.fillStyle = '#000';
    const drops = rainOf(G);
    while (stampIdx < drops.length && drops[stampIdx].t <= Math.min(local, T.spots[1])) {
      const d = drops[stampIdx++];
      mg.globalAlpha = 0.35; mg.beginPath(); mg.ellipse(d.x, d.y, d.rx * 1.7, d.ry * 1.7, 0, 0, TAU); mg.fill();
      mg.globalAlpha = 1; mg.beginPath(); mg.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, TAU); mg.fill();
    }
    mg.globalAlpha = 1;
  }
  function dryMask(p) {
    if (!dryV) dryV = rankField(seed + 313, 2.6, 9); // drying order
    const d = maskImg.data;
    for (let k = 0; k < dryV.length; k++) d[k * 4 + 3] = 255 * clamp((dryV[k] - p) / 0.07 + 0.5);
    mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.putImageData(maskImg, 0, 0);
  }
  /** Draw `layer` onto g only where `m` (a low-res alpha mask) is opaque. */
  function through(g, layer, m, key) {
    const top = Y_FAR - 2, fh = H - top, px = st.px;
    let c = tmps[key];
    if (!c || c.width !== st.canvas.width || c.height !== st.canvas.height) c = tmps[key] = mk(st.canvas.width, st.canvas.height);
    const tg = c.getContext('2d');
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, top * px, c.width, fh * px);
    tg.drawImage(layer, 0, top * px, c.width, fh * px, 0, top * px, c.width, fh * px);
    tg.globalCompositeOperation = 'destination-in';
    tg.imageSmoothingEnabled = true;
    tg.drawImage(m, 0, top / MS, mw, fh / MS, 0, top * px, c.width, fh * px);
    tg.globalCompositeOperation = 'source-over';
    g.drawImage(c, 0, top * px, c.width, fh * px, 0, top, W, fh);
  }
  /** A ground-plane noise at mask resolution, rank-normalised to 0.06..0.94 so
   *  a threshold sweeping through it uncovers area at an even rate. */
  function rankField(nzSeed, f1, f2) {
    const nz = makeNoise(nzSeed), raw = new Float32Array(mw * mh), idx = new Uint32Array(mw * mh);
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
      const [gx, gz] = unproj(i * MS, Math.max(Y_FAR, j * MS));
      raw[j * mw + i] = nz.fbm(gx * f1, gz * f1, 0.5, 4) + 0.15 * nz(gx * f2, gz * f2, 3);
      idx[j * mw + i] = j * mw + i;
    }
    idx.sort((a, b) => raw[a] - raw[b]);
    const out = new Float32Array(mw * mh);
    idx.forEach((k, i) => { out[k] = 0.06 + 0.88 * (i / idx.length); });
    return out;
  }
  function waterMask(L) {
    if (!waterV) waterV = rankField(seed + 515, 1.1, 5);
    const d = wImg.data;
    for (let k = 0; k < waterV.length; k++) d[k * 4 + 3] = 255 * clamp((L - waterV[k]) / 0.05 + 0.5);
    wmg.putImageData(wImg, 0, 0);
  }
  /** Flooded ground mirrors the sky, and the tree line, broken by ripples. */
  function paintReflection(layers, t, K, detail) {
    const px = st.px, top = Y_FAR - 2;
    if (!reflC || reflC.width !== st.canvas.width || reflC.height !== st.canvas.height) reflC = st.layer();
    const g = reflC.getContext('2d');
    const gr = g.createLinearGradient(0, top, 0, H);
    gr.addColorStop(0, css(mixc(K.bottom, [255, 255, 255], 0.15)));
    gr.addColorStop(0.35, css(mixc(K.bottom, K.top, 0.55)));
    gr.addColorStop(1, css(mixc(K.top, [48, 62, 70], 0.3)));
    g.fillStyle = gr; g.fillRect(0, top, W, H - top);
    // the sun's path on the water
    if (K.sun > 0.01) {
      const low = clamp((K.sunY + 60) / 156), col = mixc('#fffbf0', '#ffc36a', low);
      const sg = g.createRadialGradient(SUN_X, top + 60, 0, SUN_X, top + 60, 380);
      sg.addColorStop(0, css(col, 0.5 * K.sun)); sg.addColorStop(1, css(col, 0));
      g.save(); g.translate(SUN_X, top); g.scale(0.55, 1.5); g.translate(-SUN_X, -top); g.fillStyle = sg; g.fillRect(0, top, W, H); g.restore();
    }
    // the tree line upside down, mirrored about the far bund, in rippled strips (wider strips when frames are slow)
    const step = detail < 0.75 ? 4 : 2;
    for (let y = 0; y < 160; y += step) {
      const src = Y_FAR + 6 - y;
      if (src < 40) break;
      const off = Math.sin(y * 0.45 + t * 2.1) * (0.6 + y * 0.03) + N(y * 0.08, t * 0.5, 7) * 2;
      g.globalAlpha = 0.6 * (1 - y / 160);
      g.drawImage(layers.trees, 0, src * px, W * px, step * px, off, top + y, W, step);
    }
    g.globalAlpha = 1;
    return reflC;
  }

  let held = null, heldBucket = null, calmKeyWas = '';
  return {
    /**
     * Under the page's words the field holds still: it is shown there as it was
     * at the start of each six-second step of the year, so the words sit on a
     * picture that does not move while the season still turns round them.
     */
    hold(g, calm, local, calmKey) {
      const px = st.px, bucket = Math.floor(local / 6);
      if (!held || held.width !== st.canvas.width || held.height !== st.canvas.height || bucket !== heldBucket || calmKey !== calmKeyWas) {
        if (!held || held.width !== st.canvas.width || held.height !== st.canvas.height) held = st.layer();
        const hg = held.getContext('2d'); hg.setTransform(1, 0, 0, 1, 0, 0); hg.clearRect(0, 0, held.width, held.height); hg.drawImage(st.canvas, 0, 0);
        heldBucket = bucket; calmKeyWas = calmKey;
      }
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      const clip = new Path2D();
      for (const r of calm) clip.rect((r.x - 30) * px, (r.y - 30) * px, (r.w + 60) * px, (r.h + 60) * px);
      g.clip(clip); g.drawImage(held, 0, 0); g.restore();
    },
    /** The held picture is stale after a resize or a new field. */
    unhold() { held = null; },
    /** A new field: forget the masks built for the old one. */
    field(s) { seed = s; dryV = null; waterV = null; lastWL = NaN; resetMask(); },
    /** The year went back round (or was replayed): the rain starts again on dry mud. */
    restart() { resetMask(); },
    resize() { lastWL = NaN; },
    /** The ground in every mode but the plain wet one: dry, darkening drop by drop, or drying. */
    ground(g, layers, mode, local, S, part) {
      const top = Y_FAR - 2, fh = H - top;
      if (mode === 'spots') { if (maskMode !== 'spots') { resetMask(); maskMode = 'spots'; } stampTo(layers.geo, local); }
      if (mode === 'drying') { dryMask(S.dry); maskMode = 'drying'; }
      if (mode === 'dry') { part(layers.dry, 0, top, W, fh); return; }
      part(layers.dry, 0, top, W, fh);
      if (mode === 'spots' && S.wetAll > 0) { g.save(); g.globalAlpha = S.wetAll; part(layers.wet, 0, top, W, fh); g.restore(); }
      g.save(); if (mode === 'drying') g.globalAlpha = 0.8; through(g, layers.wet, mask, 'tmp'); g.restore();
    },
    /** Standing water: it finds the low ground first, then covers each plot, and the wind writes on it. */
    water(g, layers, t, local, K, S, still, detail, windDir, part) {
      const top = Y_FAR - 2, fh = H - top, wl = S.water;
      const R = paintReflection(layers, t, K, detail);
      if (wl >= 1.12) {
        part(R, 0, top, W, fh);
        g.save(); g.globalAlpha = 0.45; part(layers.water, 0, top, W, fh); g.restore();
      } else {
        if (!(Math.abs(wl - lastWL) <= 0.003) || still) { waterMask(wl); lastWL = wl; }
        through(g, R, wmask, 'tmp2');
        g.save(); g.globalAlpha = 0.45; through(g, layers.water, wmask, 'tmp2'); g.restore();
      }
      // the wind writes on open water in light, broken lines
      const wa = smoothstep(0.5, 1.1, wl) * (1 - S.green * 0.85);
      if (wa > 0.02) {
        const lines = [new Path2D(), new Path2D()];
        for (let zi = 0; zi < 40; zi++) {
          const gz = Math.pow(Z_FAR, zi / 40), y = HY + F / gz, step = (30 * Math.sqrt(gz) * gz) / F;
          for (let gx = -gz; gx < gz; gx += step) {
            const jx = gx + N(gx * 3, gz * 3, 1.2) * step, w = gustAt(jx, gz, local, windDir);
            if (w < 0.2) continue;
            const x = CX + (jx * F) / gz, len = (10 + 22 * w) / Math.sqrt(gz);
            const path = lines[w > 0.5 ? 1 : 0];
            path.moveTo(x - len / 2, y); path.lineTo(x + len / 2, y);
          }
        }
        g.lineCap = 'round';
        g.strokeStyle = `rgba(250,252,248,${0.3 * wa})`; g.lineWidth = 0.8; g.stroke(lines[0]);
        g.strokeStyle = `rgba(255,255,252,${0.55 * wa})`; g.lineWidth = 1.1; g.stroke(lines[1]);
      }
    },
    /** Rain: streaks falling, and each early drop's splash where it lands (none near the page's words). */
    rain(g, G, local, S, calm) {
      if (S.rain > 0.01) {
        const rr = rng('shet-rain'), count = Math.round(S.rain * 280), span = H + 60;
        g.strokeStyle = 'rgba(236,240,240,0.42)'; g.lineWidth = 0.9; g.lineCap = 'round';
        g.beginPath();
        for (let i = 0; i < count; i++) {
          const sp = rr.range(620, 860), x0 = rr.range(-120, W + 40), y0 = rr() * span, len = rr.range(14, 30);
          const y = ((y0 + local * sp) % span) - 40, x = x0 + y * 0.12, k = 0.5 + (0.5 * y) / H;
          if (calm.length && (inCalm(x, y, calm) || inCalm(x - len * 0.12 * k, y - len * k, calm))) continue;
          g.moveTo(x, y); g.lineTo(x - len * 0.12 * k, y - len * k);
        }
        g.stroke();
      }
      if (local > T.spots[0] && local < T.rainOut[1] + 1) {
        g.strokeStyle = 'rgba(240,240,234,0.7)'; g.lineWidth = 0.8;
        const drops = rainOf(G);
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i], age = local - d.t;
          if (age < 0) break;
          if (age > 0.6 || (calm.length && inCalm(d.x, d.y, calm))) continue;
          const f = age / 0.6;
          g.globalAlpha = (1 - f) * 0.8;
          g.beginPath(); g.ellipse(d.x, d.y, d.rx * (0.4 + 1.6 * f), d.ry * (0.4 + 1.6 * f), 0, 0, TAU); g.stroke();
        }
        g.globalAlpha = 1;
      }
    },
  };
}
