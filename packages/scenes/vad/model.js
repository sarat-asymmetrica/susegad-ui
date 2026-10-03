// Vad: a tree that grows its own pillars. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/vad.js (read only;
// never edited). growBanyan(seed) is the plate's own space-colonisation
// algorithm, unchanged: an umbrella of attractor points, branch tips that
// grow toward the ones nearest them, the pipe model for thickness, leaf
// masses and aerial roots. It returns nodes with birth steps; nothing is
// drawn. The port adds the schedule (when each thing is born, when the tree
// is done), the registers, progress, and model().

import { rng, makeNoise, clamp, ease, phase } from '../../engine/index.js';

export const W = 1200, H = 800;

export const GROUND = 692, KATTA_TOP = 670, PIPE = 2.2, TRUNK_W = 44;

export function growBanyan(seed) {
  const r = rng(`vad:${seed}`), nz = makeNoise(seed * 7 + 3);
  const cx = 600 + r.range(-40, 40);
  const hw = r.range(470, 520), topY = r.range(150, 185), under = r.range(425, 450);

  // attractors: an umbrella of points, clumpy so the canopy has lobes
  const attr = [];
  for (let guard = 0; attr.length < 1500 && guard < 80000; guard++) {
    const u = r.range(-1, 1), x = cx + u * hw;
    const yTop = topY + (under - 40 - topY) * Math.pow(Math.abs(u), 1.5) + 24 * nz(u * 3.1, 0.5);
    const yBot = under + 8 - 78 * u * u + 12 * nz(u * 4.3, 2.5);
    const y = r.range(topY - 20, under + 20);
    if (y < yTop || y > yBot) continue;
    if (nz.fbm(x * 0.0065, y * 0.0065, 4.2, 3) < -0.12 && r() < 0.8) continue;
    attr.push([x, y]);
  }

  const nodes = [];
  const Di = 66, Dk = 10, D = 7, cell = Di, grid = new Map();
  const gkey = (x, y) => Math.floor(x / cell) * 10007 + Math.floor(y / cell);
  const add = (x, y, parent, birth) => {
    const i = nodes.length;
    nodes.push({ x, y, parent, birth, children: [] });
    if (parent >= 0) nodes[parent].children.push(i);
    const k = gkey(x, y);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
    return i;
  };
  const nearest = (x, y, maxD) => {
    let best = -1, bd = maxD * maxD;
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const i of grid.get((gx + dx) * 10007 + gy + dy) || []) {
        const d = (nodes[i].x - x) ** 2 + (nodes[i].y - y) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    }
    return best;
  };

  // a short, stout trunk that splits into leaders
  let it = 0, tip = add(cx, KATTA_TOP + 4, -1, 0);
  const splitY = under + 36;
  while (nodes[tip].y > splitY) { const t = nodes[tip]; tip = add(t.x + 1.6 * nz(t.y * 0.02, 9.1), t.y - D, tip, ++it); }
  const leaders = r.int(2, 3);
  for (let k = 0; k < leaders; k++) {
    const ang = -Math.PI / 2 + (k - (leaders - 1) / 2) * r.range(0.6, 0.85) + r.range(-0.1, 0.1);
    let j = tip;
    for (let s = 0; s < 6; s++) { const n = nodes[j]; j = add(n.x + Math.cos(ang) * D, n.y + Math.sin(ang) * D, j, it + 1 + s); }
  }
  it += 6;

  // space colonization
  let alive = attr.slice();
  for (let stall = 0; alive.length && it < 420 && stall < 6; it++) {
    const pull = new Map();
    for (const [ax, ay] of alive) {
      const ni = nearest(ax, ay, Di);
      if (ni < 0) continue;
      const n = nodes[ni], dx = ax - n.x, dy = ay - n.y, d = Math.hypot(dx, dy) || 1;
      const p = pull.get(ni) || [0, 0];
      p[0] += dx / d; p[1] += dy / d;
      pull.set(ni, p);
    }
    if (!pull.size) { stall++; continue; }
    const born = it + 1;
    for (const [ni, [sx, sy]] of pull) {
      let dx = sx + r.range(-0.15, 0.15), dy = sy * 0.85 + 0.1 + r.range(-0.15, 0.15);
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const n = nodes[ni], x = n.x + dx * D, y = n.y + dy * D;
      if (n.children.some(c => Math.hypot(nodes[c].x - x, nodes[c].y - y) < 2.5)) continue;
      add(x, y, ni, born);
    }
    alive = alive.filter(([ax, ay]) => nearest(ax, ay, Dk) < 0);
  }
  const maxBirth = it;

  // pipe model on the final tree (children always have larger indices)
  const R = new Float32Array(nodes.length);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const ch = nodes[i].children;
    R[i] = ch.length ? Math.pow(ch.reduce((s, c) => s + Math.pow(R[c], PIPE), 0), 1 / PIPE) : 1;
  }

  // chains: follow the thickest child; every other child starts a new chain
  const chains = [];
  const walk = (start, from) => {
    const chain = from >= 0 ? [from, start] : [start];
    let i = start;
    while (nodes[i].children.length) {
      const ch = [...nodes[i].children].sort((a, b) => R[b] - R[a]);
      for (const c of ch.slice(1)) walk(c, i);
      i = ch[0];
      chain.push(i);
    }
    chains.push(chain);
  };
  walk(0, -1);

  // leaf masses: one per grid cell, on every thin branch (not only tips),
  // so no twig is left bare
  const clumps = [], taken = new Set();
  nodes.forEach((n, i) => {
    if (R[i] > 2.4 || n.y > under + 24) return;
    const k = `${Math.floor(n.x / 24)},${Math.floor(n.y / 20)}`;
    if (taken.has(k)) return;
    taken.add(k);
    clumps.push({ node: i, x: n.x, y: n.y - 5, rad: r.range(19, 32), seed: r.int(1, 99999), light: clamp((n.y - topY) / (under - topY)) });
  });

  // aerial roots: from limbs on the underside, away from the trunk.
  // Most hang in bunches; a few reach the ground; a few of those become pillars.
  const roots = [], used = [], pillarsAt = [];
  const cands = nodes.map((_, i) => i).filter(i => {
    const n = nodes[i];
    return n.children.length && R[i] > 1.6 && R[i] < R[0] * 0.55 && n.y > under - 110 && n.y < under + 20 && Math.abs(n.x - cx) > 105;
  });
  for (const i of cands.sort(() => r() - 0.5)) {
    const n = nodes[i], dx = Math.abs(n.x - cx);
    if (used.some(x => Math.abs(x - n.x) < 17)) continue;
    let kind = 'hang';
    if (dx > 150 && dx < hw * 0.8 && pillarsAt.length < 5 && !pillarsAt.some(x => Math.abs(x - n.x) < 90)) { kind = 'pillar'; pillarsAt.push(n.x); }
    else if (roots.filter(q => q.kind === 'reach').length < 3 && r() < 0.25) kind = 'reach';
    used.push(n.x);
    roots.push({
      node: i, x: n.x, y: n.y, kind,
      strands: kind === 'hang' ? r.int(3, 6) : r.int(2, 3),
      frac: kind === 'hang' ? r.range(0.15, 0.55) : 1,
      speed: r.range(38, 62), delay: r.range(1, 5), ground: GROUND + r.range(-3, 5),
      thick: r.range(11, 18), seed: r.int(1, 99999),
    });
    if (roots.length >= 34) break;
  }

  return { nodes, R, chains, clumps, roots, maxBirth, cx, hw, under };
}


const memo = new Map();
/** growBanyan(), memoised per seed: the same seed is always the same tree. */
export function banyan(seed) {
  if (!memo.has(seed)) { if (memo.size > 6) memo.delete(memo.keys().next().value); memo.set(seed, growBanyan(seed)); }
  return memo.get(seed);
}

/** When a node is born, in seconds of the growth (the plate's replay: about twenty seconds). */
export const birthTimeOf = (tree, b) => 0.6 + 18 * Math.pow(b / tree.maxBirth, 0.9);

/** The plate's schedule: each root's start, landing and thickening, and when the whole tree is done. Pure. */
export function schedule(tree) {
  const bt = b => birthTimeOf(tree, b);
  const roots = tree.roots.map(rt => {
    const start = bt(tree.nodes[rt.node].birth) + rt.delay;
    const land = start + ((rt.ground - rt.y) * rt.frac) / rt.speed;
    return { ...rt, start, land, thickStart: land + 1 + (rt.seed % 300) / 100 };
  });
  const endTime = Math.max(
    ...tree.clumps.map(c => bt(tree.nodes[c.node].birth) + 1.7),
    ...roots.map(rt => (rt.kind === 'pillar' ? rt.thickStart + 6 : rt.land)),
  ) + 0.5;
  return { roots, endTime };
}
const smemo = new Map();
export const scheduleOf = seed => { if (!smemo.has(seed)) { if (smemo.size > 6) smemo.delete(smemo.keys().next().value); smemo.set(seed, schedule(banyan(seed))); } return smemo.get(seed); };

/** How far a leaf mass has grown at a moment of the growth, 0 to 1. */
export const clumpGrow = (tree, c, local) => ease.outCubic(phase(local, birthTimeOf(tree, tree.nodes[c.node].birth) + 0.2, birthTimeOf(tree, tree.nodes[c.node].birth) + 1.6));

/** How each register lives: the growth's pace and the boil once it is grown. quiet is the finished tree, still. */
export const LOOKS = {
  quiet: { pace: 0, boil: 0 },
  warm: { pace: 0.8, boil: 3 },
  playful: { pace: 1, boil: 4 },
};

// ── Words in the world (words="world"; docs/requests/2026-09-28-words-in-the-world.md) ──

/** The sky the words may use: upper left, from a fixed margin, never lower than the canopy's widest point. */
export const SKY = { x: 40, top: 34, gap: 26 };

/**
 * The moment the words are laid against: the end of the current quarter of
 * the growth. The paragraph re-flows four times while the tree grows, not every
 * frame, and each time against the canopy as it will be when that quarter
 * ends, so no leaf ever grows under a line. Grown (or still): the whole tree.
 */
export const layMoment = (local, endTime) => (local >= endTime ? endTime : Math.min(endTime, Math.ceil(Math.max(1e-6, local) / endTime * 4) / 4 * endTime));

/**
 * The canopy's left edge at a moment, as a function of a band of the page:
 * the leftmost reach of any leaf mass (its wash is 1.12 of its radius, squashed
 * to 0.78 high) or limb that has grown into that band, or Infinity if none has.
 * Pure: the words' shape is built from it.
 */
export function canopyLeft(tree, local) {
  const discs = [];
  for (const c of tree.clumps) {
    const g = clumpGrow(tree, c, local);
    if (g > 0) { const rx = c.rad * 1.12 * g; discs.push([c.x - rx, c.y - rx * 0.78, c.y + rx * 0.78]); }
  }
  for (const n of tree.nodes) if (birthTimeOf(tree, n.birth) <= local) discs.push([n.x - 4, n.y - 4, n.y + 4]);
  return (top, bottom) => {
    let left = Infinity;
    for (const [x, y0, y1] of discs) if (y1 >= top && y0 <= bottom && x < left) left = x;
    return left;
  };
}

/**
 * The words' shape for the type tier: each band runs from the sky's margin to
 * the canopy's edge (less a gap), capped at `measure` logical units wide.
 */
export function skyShape(tree, local, measure, minWidth = 60) {
  const edge = canopyLeft(tree, local);
  return (top, bottom) => {
    const right = Math.min(SKY.x + measure, edge(top, bottom) - SKY.gap), w = right - SKY.x;
    return w >= minWidth ? { x: SKY.x, w } : null;
  };
}

/** The smallest sizes the sky may set words at (CSS px, from the root font size, so text at 200% doubles them). */
export const minSizes = (rootPx = 16) => ({ body: 0.875 * rootPx, heading: 1.25 * rootPx });
/** Body sizes to try, largest first, CSS px: the drawing's own (18 units) down to the minimum; empty if none is legible. */
export function skySizes(scale, rootPx = 16) {
  const min = minSizes(rootPx), out = [];
  for (let s = Math.min(18 * scale, 20); s >= min.body - 1e-9; s -= 0.5) if (s * 1.4 >= min.heading - 1e-9) out.push(+s.toFixed(2));
  return out;
}

/**
 * The per-frame description: which moment of the growth to show. With
 * progress set, the growth stands exactly that far along and time never
 * moves it; the tree is done at 1.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const tree = banyan(seed), { endTime } = scheduleOf(seed);
  const held = params.progress != null;
  const local = held ? clamp(params.progress) * endTime : time * (look.pace || 1);
  const done = local >= endTime;
  const words = params.words === 'world' ? 'world' : 'panel';
  return { time, seed, register, look, tree, endTime, local: Math.min(local, endTime + 1), done, held, settled: done && (held || register === 'quiet'), words };
}
