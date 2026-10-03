// Tinto: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the square, the round little people and every vignette are
// the plate's own drawing code, brought across line for line. What the port
// adds: the registers (quiet still, warm and playful at their own pace), the
// lines as real text beside the drawing, the calm zone, dusk for the dark
// theme, the library's own Kalam instead of a request to Google Fonts, and a
// redraw only when something the eye can see has changed.

import {
  stage, rng, clamp, lerp, TAU, paper, ink, hatch, wash, ellipse, catmull, smoothstep, roughen,
} from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import {
  W, H, SQUARE, TREE, depth, VIGNETTES, IDS, byId, poderAt, walkerAt, kidsAt,
  pickLine, placeCard, nextId, inCalm, BOARD, COW_WORLD, slateOf,
} from './model.js';
import { createWords, ENAMEL_INK } from './words.js';

const INK = '#1d2742';
const SKIN = ['#8d5a36', '#a86f45', '#6f4428', '#b98258', '#7a4b2e'];
const HAND = '"Kalam", "Segoe Print", cursive';

// ── A person, from a few numbers (the plate's own) ─────────────────────────

/**
 * Draw a round little person standing (or sitting) with feet at (x, y).
 * o: { s, skin, shirt, legs, hair, pose: 'stand'|'walk'|'sit'|'ride', t, seed,
 *      arms: [[dx, dy], [dx, dy]] hand offsets from the shoulders, skirt, hat, flip }
 */
function person(g, x, y, o) {
  const s = o.s ?? depth(y), b = o.b ?? 0, seed = (o.seed ?? 0) * 13 + b;
  const f = o.flip ? -1 : 1, h = 70 * s, lw = 3.4 * s;
  const hip = [x, y - h * 0.4], sh = [x, y - h * 0.76], head = [x + f * 1 * s, y - h * 0.9];
  const L = { width: lw, jitter: 0.25, seed, taper: 2, pressure: 0.2 };
  const legs = o.legs ?? '#2d3550';
  if (o.pose === 'sit') {
    ink(g, [[hip[0] - 3 * s, hip[1]], [hip[0] + f * 16 * s, hip[1] + 1], [hip[0] + f * 16 * s, y]], { ...L, color: legs, seed: seed + 1 });
    ink(g, [[hip[0] + 3 * s, hip[1]], [hip[0] + f * 19 * s, hip[1] + 2], [hip[0] + f * 21 * s, y]], { ...L, color: legs, seed: seed + 2 });
  } else if (o.pose === 'ride') {
    ink(g, [hip, [hip[0] + f * 12 * s, hip[1] + 8 * s], [hip[0] + f * 8 * s + Math.sin(o.t * 7) * 4 * s, y - 6 * s]], { ...L, color: legs, seed: seed + 1 });
  } else {
    const sw = o.pose === 'walk' ? Math.sin((o.t ?? 0) * 7 + (o.seed ?? 0)) * 0.4 : 0.1;
    for (const k of [-1, 1]) ink(g, [[hip[0] + k * 3 * s, hip[1]], [hip[0] + k * 3 * s + Math.sin(sw * k) * h * 0.4, y]], { ...L, color: legs, seed: seed + 2 + k });
  }
  if (o.skirt) {
    const sk = [[hip[0] - 9 * s, hip[1] - 6 * s], [hip[0] + 9 * s, hip[1] - 6 * s], [hip[0] + 13 * s, y - h * 0.1], [hip[0] - 13 * s, y - h * 0.1]];
    wash(g, sk, { color: o.skirt, alpha: 1 });
    ink(g, sk, { width: 1.1, color: INK, jitter: 0.4, seed: seed + 5, closed: true });
  }
  // body: a bean
  const body = roughen(ellipse(x, (hip[1] + sh[1]) / 2, 9.5 * s, h * 0.21, { n: 22 }), { amp: 0.8, seed, step: 3 });
  wash(g, body, { color: o.shirt ?? '#c0563b', alpha: 1 });
  ink(g, body, { width: 1.2, color: INK, jitter: 0.4, seed: seed + 6, closed: true });
  // arms
  const arms = o.arms ?? [[-6, 20], [6, 20]];
  arms.forEach(([dx, dy], i) => {
    const from = [sh[0] + (i ? 7 : -7) * s, sh[1] + 3 * s], to = [from[0] + f * dx * s, from[1] + dy * s];
    ink(g, [from, [(from[0] + to[0]) / 2 + (i ? 2 : -2) * s, (from[1] + to[1]) / 2 + 2 * s], to], { ...L, width: lw * 0.85, color: o.shirt ?? '#c0563b', seed: seed + 7 + i });
    wash(g, ellipse(to[0], to[1], 2.2 * s, 2.2 * s, { n: 8 }), { color: o.skin, alpha: 1 });
  });
  // head and hair
  const hd = ellipse(head[0], head[1], 7.2 * s, 7.6 * s, { n: 20 });
  wash(g, hd, { color: o.skin ?? SKIN[0], alpha: 1 });
  ink(g, hd, { width: 1.1, color: INK, jitter: 0.3, seed: seed + 9, closed: true });
  if (o.hair !== false) wash(g, ellipse(head[0] - f * 1.2 * s, head[1] - 3.2 * s, 7 * s, 4.6 * s, { start: Math.PI * 0.95, end: Math.PI * 2.05, n: 12 }), { color: o.hair ?? '#1f1a18', alpha: 1 });
  if (o.bun) wash(g, ellipse(head[0] - f * 7 * s, head[1] - 2 * s, 3.4 * s, 3.4 * s, { n: 10 }), { color: o.hair ?? '#1f1a18', alpha: 1 });
  if (o.hat) {
    wash(g, ellipse(head[0], head[1] - 5 * s, 11 * s, 3 * s, { n: 16 }), { color: o.hat, alpha: 1 });
    wash(g, ellipse(head[0], head[1] - 7 * s, 6 * s, 4.5 * s, { start: Math.PI, end: TAU, n: 10 }), { color: o.hat, alpha: 1 });
  }
  // an eye: one dot, looking where they face
  g.fillStyle = INK; g.beginPath(); g.arc(head[0] + f * 3 * s, head[1] - 0.5 * s, 0.9 * s, 0, TAU); g.fill();
  return { head, sh, hip };
}

const shadow = (g, x, y, w) => { g.fillStyle = 'rgba(60,40,20,0.16)'; g.beginPath(); g.ellipse(x, y + 1, w, w * 0.22, 0, 0, TAU); g.fill(); };
const say = (g, text, x, y, size, alpha = 0.8, align = 'left') => {
  g.save(); g.font = `400 ${size}px ${HAND}`; g.fillStyle = INK; g.globalAlpha = alpha; g.textAlign = align; g.fillText(text, x, y); g.restore();
};

// ── The square, painted once per size and theme ────────────────────────────

function square(g, c, dark) {
  // the square is drawn on cream paper in both themes; dusk is a tint laid over it (see render),
  // so the washes' grain never lets a dark page show through as speckle
  paper(g, W, H, { base: dark ? '#efe7d6' : c.paper, seed: 61, vignette: 0.07, fibers: 70 });
  // sky: morning, or dusk on a dark page
  const sky = g.createLinearGradient(0, 0, 0, 240);
  if (dark) { sky.addColorStop(0, '#26305a'); sky.addColorStop(0.7, '#7a5a78'); sky.addColorStop(1, '#d59a74'); }
  else { sky.addColorStop(0, '#a9cde3'); sky.addColorStop(1, '#eee7cf'); }
  g.fillStyle = sky; g.globalAlpha = dark ? 0.95 : 0.8; g.fillRect(0, 0, W, 260); g.globalAlpha = 1;
  const o = (seed, w = 1.4) => ({ width: w, color: INK, alpha: 0.85, jitter: 0.6, seed, closed: true });
  const bld = (pts, color, seed) => { wash(g, pts, { color, alpha: 0.95 }); ink(g, pts, o(seed)); };
  // the market arcade
  bld([[20, SQUARE.top], [20, 196], [380, 196], [380, SQUARE.top]], '#e0b04e', 1);
  bld([[8, 200], [194, 150], [392, 200]], '#a8432b', 2);
  hatch(g, [[8, 200], [194, 150], [392, 200]], { angle: 1.5, spacing: 4, color: '#3a120a', alpha: 0.35, seed: 3, width: 0.7, seg: [4, 9], gap: 0.2 });
  for (let k = 0; k < 5; k++) {
    const ax = 50 + k * 66, arch = [[ax, SQUARE.top], [ax, 262], ...ellipse(ax + 24, 262, 24, 26, { start: Math.PI, end: TAU, n: 12 }).slice(1, -1), [ax + 48, 262], [ax + 48, SQUARE.top]];
    wash(g, arch, { color: '#5a3a24', alpha: 0.85 });
    ink(g, arch, o(10 + k, 1.1));
  }
  say(g, 'MERCADO', 200, 222, 17, 0.8, 'center');
  // the chapel, set back
  bld([[470, 330], [470, 176], [600, 176], [600, 330]], '#f4efe3', 20);
  bld([[462, 180], [535, 132], [608, 180]], '#f4efe3', 21);
  ink(g, [[535, 132], [535, 104]], { width: 3, color: INK, jitter: 0.2, seed: 22, taper: 0 });
  ink(g, [[524, 114], [546, 114]], { width: 3, color: INK, jitter: 0.2, seed: 23, taper: 0 });
  bld([[518, 330], [518, 262], ...ellipse(535, 262, 17, 17, { start: Math.PI, end: TAU, n: 10 }).slice(1, -1), [552, 262], [552, 330]], '#3d6fa8', 24);
  wash(g, ellipse(535, 210, 14, 14), { color: '#3d6fa8', alpha: 0.9 });
  // the bakery and the taverna
  bld([[640, SQUARE.top], [640, 214], [860, 214], [860, SQUARE.top]], '#7fa9cf', 30);
  bld([[626, 218], [750, 170], [874, 218]], '#a8432b', 31);
  bld([[664, 238], [836, 238], [836, 266], [664, 266]], '#f4efe3', 32);
  say(g, 'PADARIA', 750, 259, 18, 0.85, 'center');
  bld([[700, SQUARE.top], [700, 286], [800, 286], [800, SQUARE.top]], '#4a3020', 33);
  bld([[880, SQUARE.top], [880, 226], [1180, 226], [1180, SQUARE.top]], '#5f9a6b', 40);
  bld([[868, 230], [1030, 186], [1192, 230]], '#a8432b', 41);
  bld([[924, 244], [1136, 244], [1136, 272], [924, 272]], '#f4efe3', 42);
  say(g, 'TAVERNA', 1030, 265, 18, 0.85, 'center');
  bld([[990, SQUARE.top], [990, 296], [1070, 296], [1070, SQUARE.top]], '#3a2616', 43);
  // the taverna's clock: two minutes to opening
  const cc = [1030, 210];
  bld(ellipse(cc[0], cc[1], 14, 14, { n: 24 }), '#f4efe3', 44);
  ink(g, [cc, [cc[0], cc[1] - 10]], { width: 1.4, color: INK, jitter: 0.1, seed: 45, taper: 0 });
  ink(g, [cc, [cc[0] - 7, cc[1] - 3]], { width: 2, color: INK, jitter: 0.1, seed: 46, taper: 0 });
  // the square
  const ground = [[0, SQUARE.top], [W, SQUARE.top], [W, H], [0, H]];
  wash(g, ground, { color: '#d9bf92', alpha: 0.9 });
  hatch(g, ground, { angle: 0.05, spacing: 7, color: '#7a5a30', alpha: 0.16, seed: 47, width: 0.7, seg: [6, 20], gap: 1 });
  ink(g, [[0, SQUARE.top], [W, SQUARE.top]], { width: 1.4, color: INK, alpha: 0.7, jitter: 0.6, seed: 48, taper: 0 });
  // the tree's platform, then the tree
  const plat = ellipse(TREE.x, TREE.y + 6, 118, 30, { n: 40 });
  const platSide = [...ellipse(TREE.x, TREE.y + 6, 118, 30, { start: 0, end: Math.PI, n: 20 }), [TREE.x - 118, TREE.y + 30], ...ellipse(TREE.x, TREE.y + 30, 118, 30, { start: Math.PI, end: 0, n: 20 }), [TREE.x + 118, TREE.y + 6]];
  wash(g, platSide, { color: '#a8563a', alpha: 1 });
  hatch(g, platSide, { angle: 1.4, spacing: 4, color: '#3a120a', alpha: 0.35, seed: 49, width: 0.7 });
  bld(plat, '#c9744e', 50);
  ink(g, platSide, o(51));
  ink(g, catmull([[TREE.x - 14, TREE.y + 4], [TREE.x - 10, TREE.y - 70], [TREE.x - 18, TREE.y - 150]], 8), { width: 22, color: '#5a4030', jitter: 0.8, seed: 52, taper: 0 });
  ink(g, catmull([[TREE.x - 12, TREE.y - 100], [TREE.x + 40, TREE.y - 150], [TREE.x + 80, TREE.y - 170]], 8), { width: 10, color: '#5a4030', jitter: 0.6, seed: 53, taper: 20 });
  const crown = roughen(ellipse(TREE.x - 10, TREE.y - 205, 190, 92, { n: 70 }), { amp: 12, freq: 0.06, seed: 54, step: 5 });
  wash(g, crown, { color: '#4f7a3e', alpha: 1, grainy: false });
  hatch(g, crown, { angle: 0.7, spacing: 4, color: '#1f3a1a', alpha: 0.4, seed: 55, width: 0.8, density: (x, y) => smoothstep(TREE.y - 260, TREE.y - 120, y) });
  const lr = rng('leaves');
  for (let i = 0; i < 90; i++) {
    const a = lr() * TAU, rr = Math.sqrt(lr()), lx = TREE.x - 10 + Math.cos(a) * 180 * rr, ly = TREE.y - 205 + Math.sin(a) * 86 * rr;
    wash(g, ellipse(lx, ly, 6, 3.5, { rot: lr() * 3, n: 8 }), { color: lr.pick(['#6d9a4f', '#3c6230', '#86ad5c']), alpha: 0.9 });
  }
  ink(g, crown, o(56));
  // the bus stop shelter and its wire
  bld([[900, 520], [900, 420], [910, 420], [910, 520]], '#6a6f78', 57);
  bld([[870, 420], [1000, 410], [1000, 424], [870, 432]], '#a8432b', 58);
  ink(g, [[0, 120], [300, 146], [620, 150], [900, 140], [1200, 118]], { width: 1, color: INK, alpha: 0.6, jitter: 0.4, seed: 59, taper: 0 });
}

// Lamps for dusk: the doorways glow and the chapel window catches the last light.
const DOORS = [[700, 286, 100, 70], [990, 296, 80, 60]];

// ── The people and their stories (the plate's own vignettes) ───────────────
// Each draws itself at time t with boil b and returns the point its line hangs from.

const DRAW = {
  poder(g, t, b) {
    const { x, y, flip } = poderAt(t), s = depth(y), f = flip ? -1 : 1;
    shadow(g, x, y, 36 * s);
    for (const k of [-1, 1]) ink(g, ellipse(x + k * 20 * s, y - 11 * s, 11 * s, 11 * s, { n: 20 }), { width: 1.5, color: INK, jitter: 0.3, seed: b + k, closed: true });
    ink(g, [[x - 20 * s, y - 11 * s], [x - 2 * s, y - 30 * s], [x + 20 * s, y - 11 * s], [x + 12 * s, y - 34 * s]], { width: 2, color: '#2a4a7a', jitter: 0.3, seed: b + 3, taper: 0 });
    // the basket on the carrier, full of pao
    const bx = x - f * 20 * s;
    wash(g, [[bx - 13 * s, y - 34 * s], [bx + 13 * s, y - 34 * s], [bx + 11 * s, y - 20 * s], [bx - 11 * s, y - 20 * s]], { color: '#b88a4a', alpha: 1 });
    for (let k = 0; k < 4; k++) wash(g, ellipse(bx - 8 * s + k * 5.5 * s, y - 36 * s, 4 * s, 3 * s, { n: 8 }), { color: '#d9a35a', alpha: 1 });
    const p = person(g, x + f * 2 * s, y - 14 * s, { s, skin: SKIN[2], shirt: '#e8e2d2', legs: '#3a4a6a', pose: 'ride', t, seed: 1, b, flip, arms: [[16, 6], [18, 4]], hair: '#2a2420' });
    // the horn, and its honk every few seconds
    if ((t % 4.5) < 0.6) say(g, 'pôm pôm', x + f * 30 * s, y - 70 * s, 18, 0.75);
    return [p.head[0], p.head[1]];
  },
  fish(g, t, b) {
    const x = 720, y = 470;
    shadow(g, x, y, 40);
    const basket = ellipse(x - 30, y - 6, 24, 9, { n: 20 });
    wash(g, [[x - 54, y - 6], [x - 6, y - 6], [x - 10, y + 4], [x - 50, y + 4]], { color: '#8a6a3a', alpha: 1 });
    wash(g, basket, { color: '#a8834a', alpha: 1 });
    for (let k = 0; k < 6; k++) wash(g, ellipse(x - 44 + k * 6, y - 8 - (k % 2) * 3, 7, 2.2, { rot: 0.4 * (k % 2 ? 1 : -1), n: 10 }), { color: '#b9c3cc', alpha: 1 });
    const p = person(g, x, y, { skin: SKIN[3], shirt: '#2f7a6a', skirt: '#2f7a6a', legs: '#2f7a6a', pose: 'sit', flip: true, seed: 2, b, arms: [[-20, 12], [-12, 18]], bun: true });
    // the cat, waiting, tail flicking
    const cx = x - 90, cy = y + 6, tail = Math.sin(t * 3) * 6;
    wash(g, ellipse(cx, cy - 9, 8, 10, { n: 14 }), { color: '#e0a052', alpha: 1 });
    wash(g, ellipse(cx + 4, cy - 22, 6, 6, { n: 12 }), { color: '#e0a052', alpha: 1 });
    ink(g, [[cx - 6, cy - 2], [cx - 16, cy - 6 + tail * 0.3], [cx - 20, cy - 16 + tail]], { width: 2.6, color: '#e0a052', jitter: 0.2, seed: b + 8, taper: 4 });
    for (const k of [0, 1]) ink(g, [[cx + 1 + k * 6, cy - 26], [cx + 2 + k * 6, cy - 31], [cx + 4 + k * 6, cy - 26]], { width: 1, color: INK, jitter: 0.1, seed: k, taper: 0 });
    return [p.head[0] - 40, p.head[1]];
  },
  cards(g, t, b) {
    const out = [];
    [[TREE.x - 64, TREE.y + 4, false, '#d9d2c0', 3], [TREE.x + 56, TREE.y + 4, true, '#8aa0c8', 4]].forEach(([x, y, flip, shirt, sd]) => {
      const p = person(g, x, y, { s: 0.95, skin: SKIN[sd % 5], shirt, legs: '#e8e2d2', pose: 'sit', flip, seed: sd, b, arms: [[18, 6], [12, 10]], hair: '#d8d4cc' });
      out.push(p.head);
    });
    // the cards on the platform, and one being slapped down
    const r = rng('deal');
    for (let k = 0; k < 6; k++) wash(g, [[TREE.x - 12 + k * 4, TREE.y - 16], [TREE.x - 4 + k * 4, TREE.y - 16], [TREE.x - 4 + k * 4, TREE.y - 4], [TREE.x - 12 + k * 4, TREE.y - 4]], { color: r.pick(['#f4efe3', '#f0e6d6']), alpha: 1 });
    if ((t % 3.2) < 0.3) ink(g, [[TREE.x + 30, TREE.y - 30], [TREE.x + 20, TREE.y - 22]], { width: 1, color: INK, alpha: 0.6, jitter: 0.1, seed: 1, taper: 0 });
    return [TREE.x, out[0][1]];
  },
  dog(g, t, b) {
    const x = 640, y = 700, br = 1 + Math.sin(t * 1.4) * 0.04;
    shadow(g, x, y, 40);
    const body = roughen(ellipse(x, y - 11, 34 * br, 12 * br, { n: 30 }), { amp: 1, seed: 9 });
    wash(g, body, { color: '#c89a5a', alpha: 1 });
    ink(g, body, { width: 1.3, color: INK, jitter: 0.4, seed: b + 9, closed: true });
    const head = ellipse(x + 30, y - 8, 11, 8, { n: 16 });
    wash(g, head, { color: '#c89a5a', alpha: 1 });
    ink(g, head, { width: 1.2, color: INK, jitter: 0.3, seed: b + 10, closed: true });
    ink(g, [[x + 26, y - 14], [x + 22, y - 6]], { width: 3, color: '#8a5a2a', jitter: 0.2, seed: 11, taper: 2 });
    ink(g, [[x + 32, y - 7], [x + 36, y - 7]], { width: 1, color: INK, jitter: 0.1, seed: 12, taper: 0 });
    if ((t % 5) < 3) { say(g, 'z', x + 44, y - 26 - (t % 5) * 4, 16, 0.6); say(g, 'z', x + 52, y - 38 - (t % 5) * 4, 16, 0.6); }
    return [x, y - 20];
  },
  pilot(g, t, b) {
    const x = 790, y = 560;
    shadow(g, x, y, 50);
    for (const k of [-1, 1]) ink(g, ellipse(x + k * 32, y - 13, 13, 13, { n: 20 }), { width: 2, color: INK, jitter: 0.3, seed: b + k, closed: true });
    const tank = [[x - 30, y - 22], [x + 20, y - 30], [x + 36, y - 22], [x - 20, y - 16]];
    wash(g, tank, { color: '#2a2a2a', alpha: 1 });
    wash(g, ellipse(x + 32, y - 22, 14, 5, { start: Math.PI, end: TAU, n: 12 }), { color: '#f2c230', alpha: 1 });
    wash(g, ellipse(x - 32, y - 22, 14, 5, { start: Math.PI, end: TAU, n: 12 }), { color: '#f2c230', alpha: 1 });
    const p = person(g, x - 6, y - 22, { skin: SKIN[4], shirt: '#e8e2d2', legs: '#3a3a4a', pose: 'sit', seed: 5, b, arms: [[16, 2], [22, 0]] });
    const turn = Math.sin(t * 0.5) > 0.92 ? 3 : 0;
    wash(g, [[p.sh[0] + 10, p.sh[1] - 8 + turn], [p.sh[0] + 36, p.sh[1] - 10], [p.sh[0] + 36, p.sh[1] + 14], [p.sh[0] + 10, p.sh[1] + 16]], { color: '#efe9da', alpha: 1 });
    for (let k = 0; k < 4; k++) ink(g, [[p.sh[0] + 14, p.sh[1] - 3 + k * 4], [p.sh[0] + 32, p.sh[1] - 4 + k * 4]], { width: 0.6, color: INK, alpha: 0.6, jitter: 0.1, seed: k, taper: 0 });
    return [p.head[0], p.head[1]];
  },
  kids(g, t, b) {
    const { ball: [bx, by], k1, k2, ground } = kidsAt(t);
    shadow(g, k1[0], k1[1], 18); shadow(g, k2[0], k2[1], 18); shadow(g, bx, ground + 10, 8);
    person(g, k1[0], k1[1], { s: 0.95, skin: SKIN[1], shirt: '#d9612e', legs: '#2a3a6a', pose: 'walk', t: t * 1.6, seed: 6, b, arms: [[-10, 14], [12, 12]] });
    const p = person(g, k2[0], k2[1], { s: 1, skin: SKIN[0], shirt: '#3d6fa8', legs: '#f4efe3', pose: 'walk', t: t * 1.6, seed: 7, b, flip: true, arms: [[-12, 10], [10, 14]] });
    const ball = ellipse(bx, by, 8, 8, { n: 14 });
    wash(g, ball, { color: '#f4efe3', alpha: 1 });
    ink(g, ball, { width: 1.1, color: INK, jitter: 0.2, seed: b + 20, closed: true });
    return [(k1[0] + p.head[0]) / 2, p.head[1] - 10];
  },
  coconut(g, t, b) {
    const x = 110, y = 560;
    shadow(g, x, y, 34);
    const r = rng('coco');
    for (let k = 0; k < 9; k++) {
      const cx = x + 40 + (k % 4) * 15 + (k > 3 ? 7 : 0), cy = y - (k > 3 ? 12 : 0) - (k > 7 ? 12 : 0);
      const c = ellipse(cx, cy - 7, 9, 8, { n: 12 });
      wash(g, c, { color: r.pick(['#6d9a3a', '#5b8a30', '#7aa844']), alpha: 1 });
      ink(g, c, { width: 0.9, color: INK, alpha: 0.7, jitter: 0.2, seed: k, closed: true });
    }
    const swing = Math.max(0, Math.sin(t * 4)) ** 3;
    const p = person(g, x, y, { skin: SKIN[2], shirt: '#f0e8d0', legs: '#6a4a2a', seed: 8, b, arms: [[-6, 20], [14 - swing * 6, -6 + swing * 24]], hat: false });
    // the knife
    const hand = [p.sh[0] + 7 + 14 - swing * 6, p.sh[1] + 3 - 6 + swing * 24];
    ink(g, [hand, [hand[0] + 12, hand[1] - 4 + swing * 6]], { width: 2.6, color: '#8a8f96', jitter: 0.1, seed: 9, taper: 2 });
    return [p.head[0], p.head[1]];
  },
  tourist(g, t, b) {
    const x = 330, y = 575, look = Math.sin(t * 0.8) > 0;
    shadow(g, x, y, 18);
    const p = person(g, x, y, { skin: '#e8b89a', shirt: '#f2d27a', legs: '#6a8a9a', seed: 10, b, flip: look, arms: [[10, 6], [14, 6]], hat: '#e8dcc0', hair: '#c9a76a' });
    const f = look ? -1 : 1;
    wash(g, [[p.sh[0] + f * 8, p.sh[1] - 2], [p.sh[0] + f * 30, p.sh[1] - 4], [p.sh[0] + f * 30, p.sh[1] + 14], [p.sh[0] + f * 8, p.sh[1] + 16]], { color: '#f4efe3', alpha: 1 });
    ink(g, [[p.sh[0] + f * 12, p.sh[1] + 4], [p.sh[0] + f * 20, p.sh[1] + 10], [p.sh[0] + f * 26, p.sh[1] + 2]], { width: 1, color: '#c0563b', jitter: 0.2, seed: 11, taper: 0 });
    return [p.head[0], p.head[1]];
  },
  bus(g, t, b) {
    const x = 1000, y = 720;
    const body = [[x - 30, y - 150], [x + 200, y - 150], [x + 200, y], [x - 30, y]];
    wash(g, body, { color: '#e8e2d2', alpha: 1 });
    wash(g, [[x - 30, y - 60], [x + 200, y - 60], [x + 200, y - 30], [x - 30, y - 30]], { color: '#2f6fb0', alpha: 1 });
    ink(g, body, { width: 1.6, color: INK, jitter: 0.5, seed: b + 1, closed: true });
    for (let k = 0; k < 4; k++) wash(g, [[x + 40 + k * 32, y - 136], [x + 64 + k * 32, y - 136], [x + 64 + k * 32, y - 96], [x + 40 + k * 32, y - 96]], { color: '#8fb0c8', alpha: 1 });
    wash(g, [[x - 20, y - 146], [x + 30, y - 146], [x + 30, y - 128], [x - 20, y - 128]], { color: '#1d2742', alpha: 1 });
    g.save(); g.font = `400 13px ${HAND}`; g.fillStyle = '#f2c230'; g.fillText('MAPUSA', x - 16, y - 133); g.restore();
    ink(g, ellipse(x + 130, y, 18, 18, { start: Math.PI, end: TAU, n: 14 }), { width: 3, color: INK, jitter: 0.2, seed: 5, taper: 0 });
    // the conductor, leaning out of the door, calling
    const lean = Math.sin(t * 1.5) * 3;
    const p = person(g, x + 8 + lean, y - 20, { s: 1.1, skin: SKIN[4], shirt: '#8a4ab0', legs: '#2a2a3a', seed: 12, b, flip: true, arms: [[-20, -14], [4, 20]] });
    if ((t % 3) < 1.6) say(g, 'Mapsa, Mapsa, Mapsa!', x + 90, y - 162, 20, 0.8, 'center');
    return [p.head[0], p.head[1]];
  },
  crows(g, t) {
    [[700, 147], [742, 146]].forEach(([x, y], i) => {
      const hop = (t + i * 1.7) % 6 < 0.35 ? -6 : 0;
      const c = ellipse(x, y - 8 + hop, 8, 6, { n: 12 });
      wash(g, c, { color: '#1c1c22', alpha: 1 });
      wash(g, ellipse(x + (i ? -7 : 7), y - 13 + hop, 4, 4, { n: 8 }), { color: '#1c1c22', alpha: 1 });
      ink(g, [[x + (i ? -10 : 10), y - 13 + hop], [x + (i ? -15 : 15), y - 12 + hop]], { width: 1.6, color: '#1c1c22', jitter: 0.1, seed: i, taper: 1 });
      ink(g, [[x + (i ? 6 : -6), y - 6 + hop], [x + (i ? 13 : -13), y - 2 + hop]], { width: 2, color: '#1c1c22', jitter: 0.1, seed: i + 2, taper: 1 });
    });
    return [721, 128];
  },
  taverna(g, t, b) {
    const p = person(g, 1030, 364, { s: 0.85, skin: SKIN[1], shirt: '#f4efe3', legs: '#3a3a4a', seed: 13, b, arms: [[-4, 16], [-2, 12]], hair: '#8a8580' });
    return [p.head[0], p.head[1]];
  },
  cow(g, t, b) {
    const [x, y] = cowAt;
    shadow(g, x, y, 46);
    const body = roughen(ellipse(x, y - 14, 42, 14, { n: 26 }), { amp: 1, seed: 14 });
    wash(g, body, { color: '#efe8da', alpha: 1 });
    ink(g, body, { width: 1.3, color: INK, jitter: 0.4, seed: b + 14, closed: true });
    const head = ellipse(x - 44, y - 18 + Math.sin(t * 0.7) * 1.5, 12, 9, { n: 14 });
    wash(g, head, { color: '#efe8da', alpha: 1 });
    ink(g, head, { width: 1.2, color: INK, jitter: 0.3, seed: b + 15, closed: true });
    ink(g, [[x - 50, y - 26], [x - 56, y - 36]], { width: 2, color: '#8a7a5a', jitter: 0.1, seed: 16, taper: 2 });
    ink(g, [[x - 40, y - 26], [x - 36, y - 36]], { width: 2, color: '#8a7a5a', jitter: 0.1, seed: 17, taper: 2 });
    wash(g, ellipse(x + 10, y - 18, 10, 6, { n: 12 }), { color: '#6a5a4a', alpha: 0.6 });
    return [x - 30, y - 30];
  },
  shoppers(g, t, b) {
    const y = 392, talk = Math.sin(t * 2.2);
    const a = person(g, 150, y, { s: 0.95, skin: SKIN[3], shirt: '#b8465a', skirt: '#b8465a', legs: '#b8465a', seed: 20, b, arms: [[10, 6 + talk * 6], [-4, 18]], bun: true });
    const c = person(g, 205, y, { s: 0.95, skin: SKIN[1], shirt: '#e0a53c', skirt: '#6a8a4a', legs: '#6a8a4a', seed: 21, b, flip: true, arms: [[10, 8 - talk * 6], [-6, 16]] });
    // her basket of kokum
    wash(g, ellipse(236, y - 6, 16, 6, { n: 14 }), { color: '#8a6a3a', alpha: 1 });
    for (let k = 0; k < 5; k++) wash(g, ellipse(226 + k * 5, y - 10, 3.2, 3, { n: 8 }), { color: '#7a1f3a', alpha: 1 });
    return [(a.head[0] + c.head[0]) / 2, a.head[1]];
  },
  walker(g, t, b) {
    const { x, y } = walkerAt(t);
    shadow(g, x, y, 16);
    const p = person(g, x, y, { skin: SKIN[0], shirt: '#f4efe3', skirt: '#3d6fa8', legs: '#3d6fa8', pose: 'walk', t, seed: 22, b, arms: [[8, -8], [-4, 18]], bun: true });
    ink(g, [[p.sh[0] + 14, p.sh[1] - 6], [p.sh[0] + 12, p.sh[1] - 50]], { width: 1.6, color: INK, jitter: 0.1, seed: 23, taper: 0 });
    const um = [...ellipse(p.sh[0] + 12, p.sh[1] - 46, 30, 16, { start: Math.PI, end: TAU, n: 16 }), [p.sh[0] + 42, p.sh[1] - 46]];
    wash(g, um, { color: '#1d2742', alpha: 1 });
    ink(g, um, { width: 1, color: INK, jitter: 0.3, seed: b + 24, closed: true });
    return [p.head[0], p.head[1] - 10];
  },
  bakery(g, t, b) {
    const x = 700, y = 372;
    const p = person(g, x, y, { s: 0.9, skin: SKIN[4], shirt: '#e8e2d2', legs: '#6a4a2a', seed: 25, b, arms: [[12, 10], [-6, 16]] });
    wash(g, [[p.sh[0] + 12, p.sh[1] + 10], [p.sh[0] + 26, p.sh[1] + 10], [p.sh[0] + 24, p.sh[1] + 28], [p.sh[0] + 14, p.sh[1] + 28]], { color: '#e0cfa0', alpha: 1 });
    const kid = person(g, x + 30, y + 6, { s: 0.62, skin: SKIN[4], shirt: '#d9612e', legs: '#2a3a6a', seed: 26, b, flip: true, arms: [[-4, -6], [6, 14]] });
    wash(g, ellipse(kid.head[0] - 6, kid.head[1] + 4, 4, 3, { n: 8 }), { color: '#d9a35a', alpha: 1 });
    return [p.head[0] + 12, p.head[1]];
  },
  cart(g, t, b) {
    const x = 830, y = 700;
    shadow(g, x, y, 60);
    const cart = [[x - 50, y - 50], [x + 50, y - 50], [x + 50, y - 22], [x - 50, y - 22]];
    wash(g, cart, { color: '#3f8a5a', alpha: 1 });
    ink(g, cart, { width: 1.4, color: INK, jitter: 0.4, seed: b + 30, closed: true });
    for (const k of [-1, 1]) ink(g, ellipse(x + k * 34, y - 12, 12, 12, { n: 18 }), { width: 1.8, color: INK, jitter: 0.3, seed: b + 31 + k, closed: true });
    // the press wheel turns
    const wx = x + 20, wy = y - 70, a = t * 2.4;
    ink(g, ellipse(wx, wy, 16, 16, { n: 20 }), { width: 2, color: '#6a6f78', jitter: 0.2, seed: 33, closed: true });
    ink(g, [[wx, wy], [wx + Math.cos(a) * 16, wy + Math.sin(a) * 16]], { width: 2, color: '#6a6f78', jitter: 0.1, seed: 34, taper: 0 });
    for (let k = 0; k < 4; k++) ink(g, [[x - 40 + k * 6, y - 50], [x - 44 + k * 6, y - 92]], { width: 2.4, color: '#8aa84a', jitter: 0.2, seed: 35 + k, taper: 3 });
    const p = person(g, x - 70, y, { skin: SKIN[2], shirt: '#e0a53c', legs: '#4a3a2a', seed: 27, b, arms: [[20, -2 + Math.sin(a) * 6], [16, 8]] });
    const c = person(g, x + 90, y + 4, { skin: SKIN[3], shirt: '#8aa0c8', legs: '#2a2a3a', seed: 28, b, flip: true, arms: [[-6, 18], [-12, 4]] });
    wash(g, [[c.sh[0] - 18, c.sh[1] + 2], [c.sh[0] - 12, c.sh[1] + 2], [c.sh[0] - 13, c.sh[1] + 12], [c.sh[0] - 17, c.sh[1] + 12]], { color: '#c9d88a', alpha: 1 });
    return [p.head[0] + 40, p.head[1]];
  },
  post(g, t, b) {
    const x = 520, y = 735;
    shadow(g, x, y, 18);
    const p = person(g, x, y, { skin: SKIN[0], shirt: '#b5823a', legs: '#b5823a', seed: 29, b, arms: [[14, -4 + Math.sin(t * 1.3) * 3], [-4, 18]], hat: '#b5823a' });
    wash(g, [[p.sh[0] + 18, p.sh[1] - 10], [p.sh[0] + 34, p.sh[1] - 10], [p.sh[0] + 34, p.sh[1]], [p.sh[0] + 18, p.sh[1]]], { color: '#8fb0d8', alpha: 1 });
    const bag = ellipse(p.hip[0] - 12, p.hip[1] - 4, 10, 12, { n: 14 });
    wash(g, bag, { color: '#6a4a2a', alpha: 1 });
    return [p.head[0], p.head[1]];
  },
};

// The cow stands by the Taverna in the plate; when the chalkboard is up she waits mid-square.
const COW_PLATE = [1080, 480];
let cowAt = COW_PLATE;

// ── Words in the world: the chalkboard and the shops' plaques ──────────────

/** The board's arch outline, from (x, y) w by h with a `rise` tall top. */
const archPts = (x, y, w, h, rise) => [[x, y + h], [x, y + rise], ...ellipse(x + w / 2, y + rise, w / 2, rise, { start: Math.PI, end: TAU, n: 22 }).slice(1, -1), [x + w, y + rise], [x + w, y + h]];

/** The chalkboard, drawn with fixed seeds: it never boils, so the words on it never shimmer. */
function drawBoard(g) {
  const { x, y, w, h, rise, frame: f, feet } = BOARD, s = slateOf();
  shadow(g, x + w / 2, feet, w * 0.55);
  for (const [lx, sp] of [[x + 26, -8], [x + w - 26, 8]]) ink(g, [[lx, y + h - 8], [lx + sp, feet]], { width: 7, color: '#6b4428', jitter: 0.2, seed: 70 + sp, taper: 0 });
  const outer = archPts(x, y, w, h, rise);
  wash(g, outer, { color: '#8a5a34', alpha: 1, grainy: false });
  ink(g, outer, { width: 1.4, color: INK, alpha: 0.85, jitter: 0.4, seed: 71, closed: true });
  const slate = archPts(s.x, s.y, s.w, s.h, s.rise);
  wash(g, slate, { color: '#26352e', alpha: 1, grainy: false });
  // old chalk, wiped: faint and wide, never bright enough to fight the words
  const r = rng('slate');
  g.save(); g.globalAlpha = 0.07; g.strokeStyle = '#e8e6dc'; g.lineCap = 'round';
  for (let k = 0; k < 9; k++) { g.lineWidth = r.range(10, 22); g.beginPath(); const yy = s.y + s.rise + r.range(0, s.h - s.rise - 16); g.moveTo(s.x + r.range(10, 60), yy); g.lineTo(s.x + r.range(s.w - 70, s.w - 12), yy + r.range(-8, 8)); g.stroke(); }
  g.restore();
  ink(g, slate, { width: 1, color: '#1a2420', alpha: 0.9, jitter: 0.3, seed: 72, closed: true });
  // the ledge and a stick of chalk
  const ly = y + h - f + 1;
  wash(g, [[x + 14, ly], [x + w - 14, ly], [x + w - 16, ly + 7], [x + 16, ly + 7]], { color: '#6b4428', alpha: 1, grainy: false });
  wash(g, [[x + w - 60, ly - 3], [x + w - 44, ly - 3], [x + w - 44, ly + 1], [x + w - 60, ly + 1]], { color: '#f4f1e7', alpha: 1, grainy: false });
}

/** Is a point on the slate (inside its arch)? */
function onSlate(px, py) {
  const s = slateOf(), cx = s.x + s.w / 2, spring = s.y + s.rise;
  if (px < s.x || px > s.x + s.w || py > s.y + s.h - 4) return false;
  return py >= spring || ((px - cx) / (s.w / 2)) ** 2 + ((spring - py) / s.rise) ** 2 <= 1;
}
/** Playful: chalk rain drizzles down the slate in the gaps round the words, and stops at every line box. */
function chalkRain(g, t, calm) {
  const s = slateOf(), r = rng('chalk-rain');
  g.save(); g.strokeStyle = '#e9e7de'; g.lineCap = 'round'; g.lineWidth = 1.6; g.globalAlpha = 0.75;
  g.beginPath();
  for (let i = 0; i < 72; i++) {
    const x = s.x + 8 + r() * (s.w - 16), sp = r.range(18, 30), len = r.range(6, 10);
    const y = s.y + 4 + ((r() * (s.h - 8) + t * sp) % (s.h - 8));
    const box = { x: x - 2, y: y - 1, w: 4, h: len + 2 };
    if (!onSlate(x, y) || !onSlate(x, y + len) || calm.some(c => box.x < c.x + c.w && box.x + box.w > c.x && box.y < c.y + c.h && box.y + box.h > c.y)) continue;
    g.moveTo(x, y); g.lineTo(x - len * 0.12, y + len);
  }
  g.stroke(); g.restore();
}
/** Each shop's plaque: cream enamel on two hooks, the same as its sign; the words on it are the button's own. */
function drawPlaques(g, boxes) {
  boxes.forEach((b, i) => {
    for (const hx of [b.x + 8, b.x + b.w - 8]) ink(g, [[hx, b.y - 7], [hx, b.y + 2]], { width: 1, color: INK, alpha: 0.7, jitter: 0.1, seed: 80 + i, taper: 0 });
    const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
    wash(g, pts, { color: '#f4efe3', alpha: 1, grainy: false });
    ink(g, pts, { width: 1.2, color: ENAMEL_INK, alpha: 0.9, jitter: 0.3, seed: 84 + i, closed: true });
  });
}
// Where each traveller is right now, for the calm zone (the others stand still).
const TRAVEL = {
  poder: t => { const p = poderAt(t); return [p.x, p.y - 40]; },
  walker: t => { const p = walkerAt(t); return [p.x, p.y - 40]; },
  kids: t => { const k = kidsAt(t); return [k.k2[0], k.k2[1] - 40]; },
};

// ── The caption card ───────────────────────────────────────────────────────

function wrap(g, text, max) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) { const n = line ? `${line} ${w}` : w; if (g.measureText(n).width > max && line) { lines.push(line); line = w; } else line = n; }
  lines.push(line);
  return lines;
}

/** k scales the card up on a small screen, so its words never drop below about 12 CSS pixels. */
function card(g, anchor, text, b, c, calm, k = 1) {
  g.save();
  g.font = `400 ${19 * k}px ${HAND}`;
  const lines = wrap(g, text, 270 * Math.min(k, 1.6));
  const w = Math.max(...lines.map(l => g.measureText(l).width)) + 28 * k, h = lines.length * 24 * k + 18 * k;
  const { x, y } = placeCard(anchor, w, h, calm);
  const box = roughen([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { amp: 1.2, seed: b, step: 6 });
  wash(g, box, { color: c.card, alpha: 0.96, grainy: false });
  ink(g, box, { width: 1.3, color: c.cardInk, jitter: 0.4, seed: b, closed: true });
  const near = [clamp(anchor[0], x, x + w), clamp(anchor[1], y, y + h)];
  ink(g, [near, [lerp(near[0], anchor[0], 0.5) + 6, lerp(near[1], anchor[1], 0.5)], [anchor[0], anchor[1] - 6]], { width: 1, color: c.cardInk, alpha: 0.7, jitter: 0.4, seed: b + 3, taper: 6 });
  g.fillStyle = c.cardInk; g.textAlign = 'left';
  lines.forEach((l, i) => g.fillText(l, x + 14 * k, y + 29 * k + i * 24 * k));
  g.restore();
  return { x, y, w, h };
}

// ── The renderer ──────────────────────────────────────────────────────────

export function createRenderer(host, { register = 'warm', scene: sceneEl = null, invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  let colors = null, lastKey = '', anchors = {}, held = {}, chosen = null, chosenAt = null, chosenFrom = null, told = '', lastPick = null;
  st.onresize = () => { lastKey = ''; invalidate(); };

  // Every line as real text beside the drawing: a screen reader reads the whole square.
  const list = document.createElement('div');
  list.className = 'vh';
  list.setAttribute('part', 'lines');
  const intro = document.createElement('p');
  intro.textContent = `${VIGNETTES.length} people and animals in the square, each with a line:`;
  const ul = document.createElement('ul');
  for (const v of VIGNETTES) { const li = document.createElement('li'); li.textContent = `${v.who}. ${v.line}`; ul.append(li); }
  list.append(intro, ul);
  // one line at a time, said once, when the keyboard hand or Enter picks someone in playful
  const live = document.createElement('div');
  live.className = 'vh';
  live.setAttribute('aria-live', 'polite');
  host.after(list, live);
  // words in the world: the board and the plaques (placed before the list, so they are read first)
  const words = createWords({ host, scene: sceneEl, W, H, invalidate });

  function palette() {
    return (colors ??= readColors(host, {
      paper: 'var(--sg-paper, light-dark(#efe7d6, #151a2b))',
      card: 'var(--sg-surface-raised, light-dark(#fbf6ea, #20263a))',
      cardInk: 'var(--sg-text, light-dark(#1d2742, #ebe5d6))',
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }
  const isDark = () => palette().dark !== '#000000';

  // Canvas text never asks for a web font: load Kalam ourselves, then repaint the signs and the card.
  if (document.fonts?.load) {
    Promise.all([document.fonts.load(`400 19px ${HAND}`), document.fonts.load(`400 17px ${HAND}`)])
      .then(() => { st.memo.clear(); lastKey = ''; invalidate(); }, () => {});
  }

  function render(data, frame) {
    const c = palette(), dark = isDark(), look = data.look;
    const t = data.t, p = frame.pointer;
    // words in the world: calm follows each line box on the board, and cards keep off the board, plaques and an open detail
    const ws = words.update(frame.register ?? register, data.words), bd = ws.board;
    const calm = bd ? [...(frame.calm || []), ...bd.calm] : frame.calm || [];
    const avoid = [...calm, ...(bd ? [{ x: BOARD.x, y: BOARD.y, w: BOARD.w, h: BOARD.feet - BOARD.y }] : []), ...(ws.plaques || []), ...(ws.open ? [ws.open] : [])];
    const rain = bd && frame.register === 'playful' && !frame.still;
    cowAt = bd ? COW_WORLD : COW_PLATE;
    // a chosen line (Enter) holds until the hand moves or two rounds pass
    if (chosen && chosenAt === null) chosenAt = t;
    if (chosen && ((p.inside && chosenFrom && Math.hypot(p.x - chosenFrom[0], p.y - chosenFrom[1]) > 4) || t - chosenAt > look.round * 2)) chosen = null;
    const cards = data.lines && (look.cards || data.focus);
    const pick = cards ? pickLine({
      time: frame.still ? 0 : data.time, look: look.cards ? look : { ...look, cards: false }, anchors,
      pointer: chosen ? null : p, focus: data.focus, chosen, calm,
    }) : null;
    // the people are redrawn only when the eye could see a change
    const calmKey = calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
    const wordsKey = `${bd ? `${bd.lines.length},${bd.lines[0].y.toFixed(1)}` : ''}|${ws.plaques ? ws.plaques.map(b => b.w | 0).join(',') : ''}|${ws.open ? ws.open.x | 0 : ''}|${rain}`;
    const key = `${frame.still ? 's' : data.tick}|${data.boil}|${pick}|${calmKey}|${dark}|${frame.epoch}|${st.canvas.width}|${p.keyboard && p.inside ? `${p.x | 0},${p.y | 0}` : ''}|${wordsKey}`;
    if (key === lastKey) return;
    lastKey = key;

    const g = st.begin(), b = data.boil;
    st.blit(st.cached(`square|${dark}`, gg => square(gg, c, dark)));
    if (dark) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [x, y, w, h] of DOORS) { g.fillStyle = 'rgba(255,170,80,0.28)'; g.fillRect(x + 4, y + 4, w - 8, h - 8); }
      g.restore();
    }
    if (ws.plaques) drawPlaques(g, ws.plaques);
    const next = {};
    for (const v of VIGNETTES) {
      // the board stands nearer than the walker's path (she passes behind it) and further back than the bus
      if (v.id === 'fish' && bd) { drawBoard(g); if (rain) chalkRain(g, data.time, bd.calm); }
      const at = TRAVEL[v.id] ? TRAVEL[v.id](t) : anchors[v.id];
      const quiet = at && inCalm(at[0], at[1], calm);
      if (quiet && TRAVEL[v.id]) { delete held[v.id]; continue; } // gone behind the words for a moment
      if (quiet) held[v.id] ??= t; else delete held[v.id];
      next[v.id] = DRAW[v.id](g, held[v.id] ?? t, quiet ? 0 : b);
    }
    anchors = next;
    if (dark) {
      // dusk: the whole square cools and darkens a little; the card stays clear on top
      g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(100,108,168,0.55)'; g.fillRect(0, 0, W, H); g.restore();
    }
    if (pick && anchors[pick]) {
      const [ax, ay] = anchors[pick];
      if (look.cards) ink(g, ellipse(ax, ay + 12, 34, 34, { n: 30 }), { width: 1.2, color: '#c0563b', alpha: 0.7, jitter: 1.2, seed: b + 90, closed: true });
      card(g, anchors[pick], byId[pick].line, b, c, avoid, clamp((12 / 19) * (W / (st.canvas.clientWidth || W)), 1, 2.4));
    }
    // the keyboard hand, so a sighted keyboard user sees where it is
    if (p.keyboard && p.inside && look.cards) {
      ink(g, ellipse(p.x, p.y, 10, 10, { n: 18 }), { width: 1.4, color: '#c0563b', alpha: 0.9, jitter: 0.3, seed: 7, closed: true });
    }
    // say a line once when a keyboard user picks someone
    if (pick && pick !== lastPick && (chosen === pick || (p.keyboard && p.inside))) {
      const text = `${byId[pick].who}. ${byId[pick].line}`;
      if (text !== told) { told = text; live.textContent = text; }
    }
    lastPick = pick;
  }

  return {
    render,
    setRegister() { lastKey = ''; },
    restyle() { colors = null; st.memo.clear(); lastKey = ''; },
    /** Enter, Space or a tap in playful: the next person's line. */
    activate(p) {
      chosen = nextId(chosen ?? lastPick ?? IDS[IDS.length - 1]);
      chosenAt = null; chosenFrom = p ? [p.x, p.y] : null;
      lastKey = ''; invalidate();
    },
    destroy() { words.destroy(); list.remove(); live.remove(); st.destroy(); },
  };
}
