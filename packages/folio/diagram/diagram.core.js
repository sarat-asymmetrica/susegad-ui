// Diagram grammar v1: the pure core. Runs in Node and in the browser.
//
//   parse(src)      the line grammar → a model of nodes, edges, groups (diagram.grammar.js)
//   layout(model)   → boxes, edge curves, group frames, in SVG user units
//   describe(model) → the text alternative and the step descriptions
//
// Every diagram has a text alternative made from the same source, so what a
// screen reader hears and what the picture shows cannot drift apart.

import { parse, STRINGS } from './diagram.grammar.js';

export { parse, STRINGS };

// ── measuring text without a browser ─────────────────────────────────────

/** Rough advance width of `s` at `size` px in a humanist sans (Mukta): good to a few percent. */
export function textWidth(s, size = 14) {
  let w = 0;
  for (const ch of s) {
    if (/[ilIj.,:;'|!()[\]]/.test(ch)) w += 0.28;
    else if (/[mwMW@]/.test(ch)) w += 0.84;
    else if (/[A-Z0-9]/.test(ch)) w += 0.62;
    else if (/\s/.test(ch)) w += 0.26;
    else if (/[ऀ-෿]/.test(ch)) w += 0.6; // Devanagari … Malayalam: marks overlap, clusters widen
    else if (ch.codePointAt(0) > 0x2e80) w += 1;
    else w += 0.52;
  }
  return w * size;
}

/** Break a label into lines of at most `max` characters, at spaces. */
export function wrap(s, max = 20) {
  const out = [];
  let cur = '';
  for (const word of s.split(/\s+/).filter(Boolean)) {
    if (cur && (cur + ' ' + word).length > max) { out.push(cur); cur = word; } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

// ── layout ────────────────────────────────────────────────────────────────

export const METRICS = { font: 14, line: 18, padX: 16, padY: 11, minW: 84, maxW: 216, gapRank: 104, gapRankDown: 88, gapCross: 28, groupPad: 14, groupHead: 22, margin: 16, labelFont: 12.5, labelHand: 1.2 };

const cubicAt = (p, t) => {
  const u = 1 - t;
  return [0, 1].map(k => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]);
};

/**
 * Lay the model out in layers: each node's rank is its longest path from a
 * source (cycles are broken where they close), nodes within a rank are ordered
 * by their neighbours' positions with groups kept together, and edges are
 * cubic curves between facing sides. Edges that go back against the flow loop
 * round beyond the boxes. Works in (rank, cross) space and maps it to x, y.
 * @param {ReturnType<typeof parse>} model
 */
export function layout(model, { direction = model.direction } = {}) {
  const M = METRICS, down = direction === 'down';
  const nodes = model.nodes.map((n, i) => {
    const lines = wrap(n.label);
    const w = Math.min(M.maxW, Math.max(M.minW, Math.ceil(Math.max(...lines.map(l => textWidth(l, M.font)))) + M.padX * 2));
    const h = lines.length * M.line + M.padY * 2;
    return { ...n, i, lines, w, h, du: down ? h : w, dv: down ? w : h, rank: 0, order: i, u: 0, v: 0 };
  });
  const at = new Map(nodes.map(n => [n.id, n]));

  // ranks: longest path over the edges, ignoring the ones that close a cycle
  const out = new Map(nodes.map(n => [n.id, []]));
  const back = new Set(), state = new Map();
  model.edges.forEach((e, k) => out.get(e.from).push([e.to, k]));
  const visit = id => {
    state.set(id, 1);
    for (const [to, k] of out.get(id)) {
      if (state.get(to) === 1) back.add(k);
      else if (!state.has(to)) visit(to);
    }
    state.set(id, 2);
  };
  // start where the story starts: sources first, then in the order nodes first send an arrow
  const hasIn = new Set(model.edges.map(e => e.to));
  const firstOut = id => { const k = model.edges.findIndex(e => e.from === id); return k < 0 ? Infinity : k; };
  const roots = nodes.slice().sort((p, q) => hasIn.has(p.id) - hasIn.has(q.id) || firstOut(p.id) - firstOut(q.id) || p.i - q.i);
  roots.forEach(n => { if (!state.has(n.id)) visit(n.id); });
  const fwd = model.edges.filter((e, k) => !back.has(k));
  for (let pass = 0; pass < nodes.length; pass++) {
    let moved = false;
    for (const e of fwd) { const a = at.get(e.from), b = at.get(e.to); if (b.rank < a.rank + 1) { b.rank = a.rank + 1; moved = true; } }
    if (!moved) break;
  }
  const R = Math.max(0, ...nodes.map(n => n.rank)) + 1;
  const ranks = Array.from({ length: R }, (_, r) => nodes.filter(n => n.rank === r));

  // order within ranks: a few sweeps of barycentres, groups kept together
  const nb = new Map(nodes.map(n => [n.id, []]));
  for (const e of model.edges) { nb.get(e.from).push(e.to); nb.get(e.to).push(e.from); }
  const pos = () => { ranks.forEach(rk => rk.forEach((n, k) => { n.order = k; })); };
  pos();
  for (let s = 0; s < 6; s++) {
    for (const rk of ranks) {
      const bary = n => { const o = nb.get(n.id).map(id => at.get(id)).filter(m => m.rank !== n.rank); return o.length ? o.reduce((a, m) => a + m.order, 0) / o.length : n.order; };
      const b = new Map(rk.map(n => [n, bary(n)]));
      const gb = new Map();
      for (const n of rk) if (n.group) gb.set(n.group, [...(gb.get(n.group) || []), b.get(n)]);
      const key = n => (n.group ? gb.get(n.group).reduce((a, x) => a + x, 0) / gb.get(n.group).length : b.get(n));
      rk.sort((p, q) => key(p) - key(q) || (p.group || '').localeCompare(q.group || '') || b.get(p) - b.get(q) || p.i - q.i);
    }
    pos();
  }

  // edge labels need room between ranks
  const gapAfter = Array(R).fill(down ? M.gapRankDown : M.gapRank);
  for (const e of model.edges) {
    const a = at.get(e.from), b = at.get(e.to), r = Math.min(a.rank, b.rank);
    // a loop back carries its label along the loop, not between ranks
    if (e.label && a.rank < b.rank && !down) gapAfter[r] = Math.max(gapAfter[r], Math.min(textWidth(e.label, M.labelFont) * M.labelHand + 36, 240));
  }

  // place: rank axis u, cross axis v, each rank centred on the widest
  let u = 0;
  const thick = ranks.map(rk => Math.max(0, ...rk.map(n => n.du)));
  const spans = ranks.map(rk => rk.reduce((a, n, k) => a + n.dv + (k ? M.gapCross + (n.group !== rk[k - 1].group ? M.groupPad * 2 : 0) : 0), 0));
  const tall = Math.max(0, ...spans);
  ranks.forEach((rk, r) => {
    let v = (tall - spans[r]) / 2;
    rk.forEach((n, k) => {
      if (k) v += M.gapCross + (n.group !== rk[k - 1].group ? M.groupPad * 2 : 0);
      n.u = u + (thick[r] - n.du) / 2; n.v = v;
      v += n.dv;
    });
    u += thick[r] + gapAfter[r];
  });

  // a group's frame must not take in a box that is not in it: in each rank the
  // group spans, push outsiders (and everything beyond them) clear of the frame
  for (const g of model.groups) {
    const ms = g.members.map(id => at.get(id));
    const r0 = Math.min(...ms.map(n => n.rank)), r1 = Math.max(...ms.map(n => n.rank));
    const v0 = Math.min(...ms.map(n => n.v)) - M.groupPad - (down ? 0 : M.groupHead) - 10, v1 = Math.max(...ms.map(n => n.v + n.dv)) + M.groupPad + 10;
    for (let r = r0; r <= r1; r++) {
      const rk = ranks[r], first = rk.findIndex(n => n.group === g.name);
      rk.forEach((n, k) => {
        if (n.group === g.name || n.v + n.dv <= v0 || n.v >= v1) return;
        const before = first >= 0 ? k < first : n.v + n.dv / 2 < (v0 + v1) / 2;
        if (before) { const d = n.v + n.dv - v0; for (let j = 0; j <= k; j++) rk[j].v -= d; }
        else { const d = v1 - n.v; for (let j = k; j < rk.length; j++) rk[j].v += d; }
      });
    }
  }

  // edges, in (u, v): facing sides, or a loop beyond the boxes for back edges
  const ports = new Map();
  const port = (n, side, other) => { const key = `${n.id}:${side}`; if (!ports.has(key)) ports.set(key, []); ports.get(key).push(other); };
  const plan = model.edges.map(e => {
    const a = at.get(e.from), b = at.get(e.to);
    const kind = a.rank < b.rank ? 'fwd' : a.rank > b.rank ? 'back' : 'same';
    return { e, a, b, kind };
  });
  for (const p of plan) if (p.kind === 'fwd') { port(p.a, 'out', p.b); port(p.b, 'in', p.a); }
  const offset = (n, side, other) => {
    const list = (ports.get(`${n.id}:${side}`) || []).slice().sort((x, y) => x.v + x.dv / 2 - (y.v + y.dv / 2));
    const k = list.indexOf(other), c = list.length, step = Math.min(12, (n.dv - 12) / Math.max(1, c));
    return (k - (c - 1) / 2) * step;
  };
  // loops for back edges run beyond the boxes, on whichever side (before or after them on the
  // cross axis) the loop meets no other box; a loop never runs through a box that is not its end
  const vmax = Math.max(0, ...nodes.map(n => n.v + n.dv));
  const vmin = Math.min(0, ...nodes.map(n => n.v));
  let overs = 0;
  const loops = { low: 0, high: 0 };
  const through = (P, a, b) => {
    const s = Array.from({ length: 33 }, (_, i) => cubicAt(P, i / 32));
    return nodes.filter(n => n !== a && n !== b && s.some(([p, q]) => p > n.u + 1 && p < n.u + n.du - 1 && q > n.v + 1 && q < n.v + n.dv - 1)).length;
  };
  const loopBack = (a, b, side) => {
    const lift = side === 'low' ? vmin - 40 - 18 * loops.low : vmax + 40 + 18 * loops.high; // room for a label between a loop and the lines inside it
    const p0 = side === 'low' ? [a.u + a.du / 2 - 6, a.v] : [a.u + a.du / 2 + 6, a.v + a.dv];
    const p3 = side === 'low' ? [b.u + b.du / 2 + 6, b.v] : [b.u + b.du / 2 - 6, b.v + b.dv];
    return [p0, [p0[0], lift], [p3[0], lift], p3];
  };
  // a forward edge that would pass through a box in a rank between its ends goes over the top instead
  const blocked = (a, b) => {
    const lo = Math.min(a.v + a.dv / 2, b.v + b.dv / 2) - 8, hi = Math.max(a.v + a.dv / 2, b.v + b.dv / 2) + 8;
    return nodes.some(n => n.rank > a.rank && n.rank < b.rank && n.v < hi && n.v + n.dv > lo);
  };
  const edges = plan.map(({ e, a, b, kind }, k) => {
    let P;
    if (kind === 'fwd' && blocked(a, b)) {
      kind = 'over';
      const lift = vmin - 30 - 18 * overs++;
      const p0 = [a.u + a.du / 2 + 6, a.v], p3 = [b.u + b.du / 2 - 6, b.v];
      P = [p0, [p0[0], lift], [p3[0], lift], p3];
    } else if (kind === 'fwd') {
      const p0 = [a.u + a.du, a.v + a.dv / 2 + offset(a, 'out', b)], p3 = [b.u, b.v + b.dv / 2 + offset(b, 'in', a)];
      const d = (p3[0] - p0[0]) * 0.5;
      P = [p0, [p0[0] + d, p0[1]], [p3[0] - d, p3[1]], p3];
    } else if (kind === 'back') {
      // the usual side first (after the boxes running right, before them running down), then the other
      const sides = down ? ['low', 'high'] : ['high', 'low'];
      const tries = sides.map(side => ({ side, P: loopBack(a, b, side) })).map(t => ({ ...t, n: through(t.P, a, b) }));
      const pick = tries.find(t => t.n === 0) ?? tries.reduce((x, y) => (y.n < x.n ? y : x));
      loops[pick.side]++;
      P = pick.P;
    } else {
      const [t, s] = a.v < b.v ? [a, b] : [b, a], x = Math.max(t.u + t.du, s.u + s.du) + 34;
      const p0 = [a.u + a.du, a.v + a.dv / 2], p3 = [b.u + b.du, b.v + b.dv / 2];
      P = [p0, [x, p0[1]], [x, p3[1]], p3];
    }
    const samples = Array.from({ length: 33 }, (_, i) => cubicAt(P, i / 32));
    const mid = cubicAt(P, 0.5);
    return { ...e, index: k, route: kind, P, samples, mid };
  });

  // groups: a frame round their members, with room for the name
  const groups = model.groups.map(g => {
    const ms = g.members.map(id => at.get(id));
    // the name goes where arrows do not arrive: on top when the flow runs right, underneath when it runs down
    const u0 = Math.min(...ms.map(n => n.u)) - M.groupPad, u1 = Math.max(...ms.map(n => n.u + n.du)) + M.groupPad + (down ? M.groupHead : 0);
    const v0 = Math.min(...ms.map(n => n.v)) - M.groupPad - (down ? 0 : M.groupHead), v1 = Math.max(...ms.map(n => n.v + n.dv)) + M.groupPad;
    return { name: g.name, members: g.members, u: u0, v: v0, du: u1 - u0, dv: v1 - v0, nameAt: down ? 'end' : 'start' };
  });

  // map (u, v) to (x, y)
  const xy = ([p, q]) => (down ? [q, p] : [p, q]);
  const box = o => (down ? { x: o.v, y: o.u, w: o.dv, h: o.du } : { x: o.u, y: o.v, w: o.du, h: o.dv });
  const L = {
    direction,
    nodes: nodes.map(n => ({ id: n.id, label: n.label, group: n.group, lines: n.lines, rank: n.rank, ...box(n) })),
    groups: groups.map(g => ({ name: g.name, members: g.members, nameAt: g.nameAt, ...box(g) })),
    edges: edges.map(e => {
      const P = e.P.map(xy), s = e.samples.map(xy), m = xy(e.mid);
      const end = P[3], c = P[2][0] === end[0] && P[2][1] === end[1] ? P[1] : P[2];
      const angle = Math.atan2(end[1] - c[1], end[0] - c[0]);
      return {
        from: e.from, to: e.to, kind: e.kind, label: e.label, desc: e.desc, line: e.line, index: e.index, route: e.route,
        d: `M${f(P[0])}C${f(P[1])} ${f(P[2])} ${f(P[3])}`, P, samples: s, angle, labelBox: null,
      };
    }),
  };
  placeLabels(L);

  // fit everything, with a margin
  const xs = [], ys = [];
  const add = b => { xs.push(b.x, b.x + b.w); ys.push(b.y, b.y + b.h); };
  L.nodes.forEach(add); L.groups.forEach(add);
  for (const e of L.edges) { e.samples.forEach(([x, y]) => { xs.push(x); ys.push(y); }); if (e.labelBox) add(e.labelBox); if (e.badge) add({ x: e.badge.x - 10, y: e.badge.y - 10, w: 20, h: 20 }); }
  const x0 = Math.min(0, ...xs) - M.margin, y0 = Math.min(0, ...ys) - M.margin;
  const shift = ([x, y]) => [x - x0, y - y0];
  for (const b of [...L.nodes, ...L.groups]) { b.x -= x0; b.y -= y0; }
  for (const e of L.edges) {
    e.P = e.P.map(shift); e.samples = e.samples.map(shift);
    e.d = `M${f(e.P[0])}C${f(e.P[1])} ${f(e.P[2])} ${f(e.P[3])}`;
    if (e.labelBox) { e.labelBox.x -= x0; e.labelBox.y -= y0; }
    if (e.badge) { e.badge.x -= x0; e.badge.y -= y0; }
  }
  L.width = Math.ceil(Math.max(0, ...xs) - x0 + M.margin);
  L.height = Math.ceil(Math.max(0, ...ys) - y0 + M.margin);
  return L;
}
const r1 = v => Math.round(v * 10) / 10;
const f = ([x, y]) => `${r1(x)} ${r1(y)}`;

const hits = (a, b, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** Distance from a point to a path given as samples (a polyline). */
export function pathDistance([x, y], samples) {
  let best = Infinity;
  for (let i = 1; i < samples.length; i++) {
    const [ax, ay] = samples[i - 1], [bx, by] = samples[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}
/** Does the path run through the box (not only touch its edge)? */
function crossesBox(samples, b, inset = 1) {
  for (let i = 1; i < samples.length; i++) {
    for (let k = 0; k < 4; k++) {
      const x = samples[i - 1][0] + (samples[i][0] - samples[i - 1][0]) * k / 4, y = samples[i - 1][1] + (samples[i][1] - samples[i - 1][1]) * k / 4;
      if (x > b.x + inset && x < b.x + b.w - inset && y > b.y + inset && y < b.y + b.h - inset) return true;
    }
  }
  return false;
}

/**
 * Put each edge's label beside its own line: at a point of that line, off it
 * along its normal just far enough for the words to clear it. It tries the
 * middle first, then further along either way, on one side and then the other.
 * A place counts only if it is clear of every box, every label already placed
 * and every other line, and the label's centre is nearer its own line than any
 * other. Where no such place exists, the edge carries a small numbered badge
 * instead (its step number), and the words stay in the text alternative, which
 * is numbered the same way.
 */
function placeLabels(L) {
  L.badges = false;
  const placed = [], boxes = L.nodes.map(n => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
  const pts = [...boxes.flatMap(b => [[b.x, b.y], [b.x + b.w, b.y + b.h]]), ...L.edges.flatMap(e => e.samples)];
  const X0 = Math.min(...pts.map(p => p[0])), X1 = Math.max(...pts.map(p => p[0])), Y0 = Math.min(...pts.map(p => p[1])), Y1 = Math.max(...pts.map(p => p[1]));
  const outside = b => Math.max(0, X0 - b.x) + Math.max(0, b.x + b.w - X1) + Math.max(0, Y0 - b.y) + Math.max(0, b.y + b.h - Y1);
  const along = [16, 14, 18, 12, 20, 11, 21]; // the middle third of the line: a label names its line, not its ends
  for (const e of L.edges) {
    e.labelBox = null; e.badge = null;
    if (!e.label) continue;
    // room for the widest face a label is set in: the hand face at 14 px is about a fifth wider
    const w = textWidth(e.label, METRICS.labelFont) * METRICS.labelHand + 12, h = 18;
    let best = null, bestScore = Infinity;
    for (const i of along) {
      const [px, py] = e.samples[i], [ax, ay] = e.samples[i - 1], [bx, by] = e.samples[i + 1];
      const len = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / len, ny = (bx - ax) / len;
      for (const sgn of [-1, 1]) {
        // as close to the line as the words can sit without touching it, with a little air
        const far = Math.abs(nx) * w / 2 + Math.abs(ny) * h / 2 + 5;
        let d = h / 2 + 4, c, b;
        for (; ; d += 2) {
          c = [px + sgn * nx * d, py + sgn * ny * d]; b = { x: c[0] - w / 2, y: c[1] - h / 2, w, h };
          if (d >= far || !crossesBox(e.samples, b, -3)) break;
        }
        const own = pathDistance(c, e.samples);
        const clear = !boxes.some(x => hits(b, x, 2)) && !placed.some(x => hits(b, x, 3))
          && !L.edges.some(o => o !== e && crossesBox(o.samples, b, 0))
          && L.edges.every(o => o === e || pathDistance(c, o.samples) > own + 4)
          && outside(b) <= 48; // a label may widen the picture a little, never by its whole length
        if (!clear) continue;
        const score = outside(b) * 0.6 + Math.abs(i - 16) * 0.5 + (sgn > 0 ? 0.2 : 0);
        if (score < bestScore) { best = b; bestScore = score; }
      }
      if (best && bestScore < 1) break;
    }
    if (!best) { L.badges = true; break; }
    e.labelBox = best;
    placed.push(best);
  }
  // Where one label has nowhere clear to go, every connection carries its number instead, so the
  // picture is consistent and each number matches the numbered text beneath it.
  if (!L.badges) return;
  for (const e of L.edges) {
    const [mx, my] = e.samples[16];
    e.labelBox = null;
    e.badge = { x: mx, y: my, r: 9, n: e.index + 1 };
  }
}

/**
 * What a reader could misread: labels touching labels or boxes, and a label
 * whose centre is nearer another line than its own. For tests and checks.
 */
export function labelClashes(L) {
  const labels = L.edges.filter(e => e.labelBox);
  const out = [];
  labels.forEach((e, i) => {
    const a = e.labelBox, c = [a.x + a.w / 2, a.y + a.h / 2], own = pathDistance(c, e.samples);
    labels.slice(i + 1).forEach(o => { if (hits(a, o.labelBox)) out.push([e.label, o.label]); });
    L.nodes.forEach(n => { if (hits(a, n)) out.push([e.label, n.id]); });
    L.edges.forEach(o => { if (o !== e && pathDistance(c, o.samples) <= own) out.push([e.label, `nearer ${o.from} to ${o.to}`]); });
  });
  return out;
}
/** Every line that runs through a box other than its own two ends. */
export function pathClashes(L) {
  const out = [];
  for (const e of L.edges) for (const n of L.nodes) if (n.id !== e.from && n.id !== e.to && crossesBox(e.samples, n, 1)) out.push([`${e.from} to ${e.to}`, n.id]);
  return out;
}

// ── the text alternative ─────────────────────────────────────────────────

/**
 * The diagram in words, from the same model the picture is drawn from.
 * `steps` are one sentence per edge: its prose line if it has one, else the
 * connection spelled out.
 */
export function describe(model) {
  const label = new Map(model.nodes.map(n => [n.id, n.label]));
  const name = id => label.get(id) ?? id;
  const title = model.title || STRINGS.untitled;
  const connection = e => {
    const s = STRINGS[e.kind](name(e.from), name(e.to));
    return e.label ? `${s}: ${e.label}` : s;
  };
  const steps = model.edges.map(e => {
    const s = e.desc || connection(e);
    return /[.!?]$/.test(s) ? s : `${s}.`;
  });
  const parts = model.nodes.map(n => (n.group ? `${n.label} (${STRINGS.in(n.group)})` : n.label));
  const summary = `${title}: ${STRINGS.parts(model.nodes.length)}, ${STRINGS.links(model.edges.length)}.`;
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0] ?? '';
  const connections = model.edges.map(e => `${connection(e)}.`);
  const text = [summary, list && `${list}.`, ...connections].filter(Boolean).join('\n');
  return { title, summary, parts: list, connections, steps, text };
}
