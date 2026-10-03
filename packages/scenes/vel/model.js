// Vel: over the compound wall. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/vel.js (read only;
// never edited). The grammar, the turtle with gravity, the growth schedule,
// the falling bracts and the laterite wall are the plate's own pure code,
// brought across line for line: derive(r) rewrites the L-system, buildVine
// (seed) grows stems, leaves, thorns and bract clusters with a delay for each,
// buildWall(seed) lays the blocks, pits, stains and ground. All run in Node.
// render.js writes them as SVG and drives every animation from the scene's
// own clock, so pause, the still and the calm zone reach every one of them.

import { rng, makeNoise, clamp, lerp, smoothstep, mix, resample, catmull, TAU } from '../../engine/index.js';

const W = 1200, H = 800;
const CAP_TOP = 300, CAP_H = 28, FACE_TOP = CAP_TOP + CAP_H, GROUND = 716;
const OUT_BACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const SVGNS = 'http://www.w3.org/2000/svg';

const PAL = {
  woody: '#5a4533', young: '#76703f', leafEdge: '#2f4224',
  leaves: ['#4d6a33', '#587640', '#42602f', '#62803f'],
  magenta: ['#b52a73', '#c23a80', '#a6226a', '#cc4c8c', '#b93178'],
  pale: ['#e6a2c1', '#dc8cb4', '#eab6cc'],
  flower: '#fbf5e8', thorn: '#3d2e22',
};

// ── Pure core: the grammar ────────────────────────────────────────────────

const ITER = 7;

/**
 * Stochastic, parametric L-system. Symbols: F (grow, with a length), + / -
 * (turn by an angle), ~ (a small drift), [ ] (branch), A (apex), B (flowering
 * tip), T (bare tip). Segment length shrinks with the generation that made it.
 */
export function derive(r, iter = ITER, L0 = 42) {
  let s = [{ s: 'A' }];
  for (let k = 0; k < iter; k++) {
    const out = [];
    const L = () => ({ s: 'F', len: L0 * Math.pow(0.93, k) * r.range(0.75, 1.2) });
    const turn = sign => ({ s: sign > 0 ? '+' : '-', a: sign * r.range(0.36, 0.72) });
    const drift = () => ({ s: '~', a: r.gauss() * 0.1 });
    for (const t of s) {
      if (t.s !== 'A') { out.push(t); continue; }
      const stop = k >= 3 ? 0.035 * k : 0;
      const u = r();
      if (u < stop) { out.push(L(), { s: r.chance(0.7) ? 'B' : 'T' }); continue; }
      const v = r();
      if (v < 0.26) out.push(L(), { s: '[' }, turn(1), { s: 'A' }, { s: ']' }, L(), drift(), { s: 'A' });
      else if (v < 0.52) out.push(L(), { s: '[' }, turn(-1), { s: 'A' }, { s: ']' }, L(), drift(), { s: 'A' });
      else if (v < 0.6) out.push(L(), { s: '[' }, turn(1), { s: 'A' }, { s: ']' }, L(), { s: '[' }, turn(-1), { s: 'A' }, { s: ']' }, drift(), { s: 'A' });
      else out.push(L(), drift(), L(), drift(), { s: 'A' });
    }
    s = out;
  }
  return s.map(t => (t.s === 'A' ? { s: 'B' } : t));
}

// ── Pure core: the turtle ─────────────────────────────────────────────────

/** Ovate leaf or papery bract along +x from its base, in local coords. */
function lens(len, wid, point = 0.7, n = 12, heart = 0) {
  const side = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const w = (wid / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, point)), 0.85) * (1 + heart * Math.max(0, 0.35 - u));
    side.push([u * len, w]);
  }
  return [...side.map(([x, w]) => [x, w]), ...side.slice(1, -1).reverse().map(([x, w]) => [x, -w])];
}
const place = (pts, x, y, ang, sy = 1) => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return pts.map(([u, v]) => [x + u * c - v * sy * s, y + u * s + v * sy * c]);
};
const f1 = v => Math.round(v * 10) / 10;
const polyD = (pts, closed = true) => pts.map((p, i) => (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1])).join('') + (closed ? 'Z' : '');

/** A cluster of three bracts around a tiny flower: the bougainvillea "bloom". */
function bractCluster(r, x, y, size, pale) {
  const rot = r() * TAU, squash = r.range(0.55, 1), petals = [], veins = [];
  const cols = pale ? PAL.pale : PAL.magenta;
  for (let i = 0; i < 3; i++) {
    const a = rot + (i * TAU) / 3 + r.gauss() * 0.18;
    const len = size * r.range(0.85, 1.12), wid = len * r.range(0.72, 0.9);
    const pts = place(lens(len, wid, 0.62, 12, 0.6), x, y, a, squash);
    petals.push({ d: polyD(pts), color: r.pick(cols) });
    const v = place([[1.5, 0], [len * 0.45, 0.4], [len * 0.8, 0]], x, y, a, squash);
    veins.push('M' + v.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L'));
  }
  // five-pointed white star, the true flower, sitting in the middle
  const star = [];
  const fr = size * 0.2, fa = r() * TAU;
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? fr * 0.45 : fr, a = fa + (i * TAU) / 10;
    star.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * squash]);
  }
  return { x, y, petals, veins: veins.join(''), star: polyD(star), pale };
}

/** Grow a few candidate vines from the seed and keep the one that spills best. */
export function buildVine(seed) {
  let best = null;
  for (let k = 0; k < 6; k++) {
    const v = growVine(seed, k), b = v.bounds;
    v.score = Math.max(0, 470 - b.y1) + 2 * Math.max(0, 24 - b.y0) + Math.max(0, 30 - b.x0) + Math.max(0, b.x1 - (W - 30));
    if (!best || v.score < best.score) best = v;
    if (best.score === 0) break;
  }
  return best;
}

function growVine(seed, attempt) {
  const r = rng(`vel:${seed}:${attempt}`);
  const wob = makeNoise(`velw:${seed}`);
  const stems = [], leaves = [], clusters = [];
  const G = 0.0056;                            // gravity: radians per unit, per unit of sideways-ness
  const roots = [
    { x: 520 + r.range(-20, 20), a: -Math.PI / 2 - r.range(0.45, 0.7) },
    { x: 560 + r.range(-12, 12), a: -Math.PI / 2 + r.range(-0.15, 0.2) },
    { x: 598 + r.range(-15, 15), a: -Math.PI / 2 + r.range(0.5, 0.75) },
  ];
  const newStem = (parent, parentDist, depth, x, y) => {
    const s = { id: stems.length, parent, parentDist, depth, pts: [[x, y]], len: 0, thorns: [], leaves: [], clusters: [], children: [], nextLeaf: r.range(4, 12), nextThorn: r.range(10, 24), side: r.sign(), dead: false };
    stems.push(s);
    if (parent) parent.children.push(s);
    return s;
  };

  for (const root of roots) {
    // a grammar this loose can make a twig or a thicket; draw a few and keep
    // the one closest to a healthy cane (the seed still decides everything)
    let tokens = null, best = Infinity;
    for (let tries = 0; tries < 10; tries++) {
      const cand = derive(r), tips = cand.filter(t => t.s === 'B' || t.s === 'T').length;
      if (Math.abs(tips - 24) < best) { best = Math.abs(tips - 24); tokens = cand; }
      if (best <= 3) break;
    }
    let st = { x: root.x, y: CAP_TOP + 6, a: root.a, stem: newStem(null, 0, 0, root.x, CAP_TOP + 6) };
    const stack = [];
    for (const t of tokens) {
      if (t.s === 'F') {
        const s = st.stem;
        if (s.dead) continue;
        const steps = Math.max(1, Math.ceil(t.len / 5)), dl = t.len / steps;
        for (let i = 0; i < steps; i++) {
          const e = G * (s.depth ? 0.6 + 0.5 * s.depth : 0.4) * (1 + s.len / 140) * (st.y < 150 ? 1 + (150 - st.y) / 22 : 1);  // long canes are heavy
          st.a += e * Math.cos(st.a) * dl + wob(s.len * 0.02, s.id * 1.3) * 0.02 * dl;
          st.x += Math.cos(st.a) * dl; st.y += Math.sin(st.a) * dl;
          s.len += dl; s.pts.push([st.x, st.y]);
          if (st.y > GROUND - 30 || st.x < -20 || st.x > W + 20) { s.dead = true; break; }
          // leaves alternate along the stem; old wood near the root is bare
          if ((s.nextLeaf -= dl) <= 0) {
            s.nextLeaf = r.range(7, 12);
            s.side = -s.side;
            if (r() < [0.2, 0.62, 0.88, 0.94, 0.94, 0.94, 0.94][Math.min(6, s.depth)]) {
              let la = st.a + s.side * r.range(0.6, 1.1);
              la += 0.3 * Math.cos(la);                     // leaves hang a little
              const len = r.range(12, 18) * (s.depth > 3 ? 0.85 : 1);
              const leaf = { x: st.x, y: st.y, ang: la, len, wid: len * r.range(0.5, 0.62), color: r.pick(PAL.leaves), dist: s.len, stem: s.id };
              leaves.push(leaf); s.leaves.push(leaf);
              // flowers come in the leaf axils toward the ends of young stems
              if (s.depth >= 2 && r() < 0.26 + 0.3 * smoothstep(40, 160, s.len)) {
                const ca = st.a + s.side * r.range(0.3, 0.8), off = r.range(8, 13);
                const c = bractCluster(r, st.x + Math.cos(ca) * off, st.y + Math.sin(ca) * off, r.range(11, 14.5), r.chance(0.12));
                c.dist = s.len; c.stem = s.id; clusters.push(c); s.clusters.push(c);
              }
            }
          }
          if (s.depth <= 2 && (s.nextThorn -= dl) <= 0) {
            s.nextThorn = r.range(16, 30);
            s.thorns.push({ dist: s.len, x: st.x, y: st.y, a: st.a, side: r.sign(), size: r.range(3.5, 5.5) });
          }
        }
      } else if (t.s === '+' || t.s === '-' || t.s === '~') st.a += t.a;
      else if (t.s === '[') {
        stack.push(st);
        st = { ...st, stem: newStem(st.stem, st.stem.len, st.stem.depth + 1, st.x, st.y) };
        if (st.stem.parent.dead) st.stem.dead = true;
      } else if (t.s === ']') st = stack.pop();
      else if (t.s === 'B' || t.s === 'T') {
        const s = st.stem;
        if (s.len < 2) continue;
        if (t.s === 'B') {
          const n = r.int(2, 4);
          for (let i = 0; i < n; i++) {
            const ca = st.a + r.gauss() * 0.9, off = i ? r.range(7, 15) : 3;
            const c = bractCluster(r, st.x + Math.cos(ca) * off, st.y + Math.sin(ca) * off, r.range(12, 15.5), r.chance(0.12));
            c.dist = s.len + i * 2; c.stem = s.id; clusters.push(c); s.clusters.push(c);
          }
        } else {
          const leaf = { x: st.x, y: st.y, ang: st.a, len: r.range(10, 14), wid: 6, color: r.pick(PAL.leaves), dist: s.len, stem: s.id };
          leaves.push(leaf); s.leaves.push(leaf);
        }
      }
    }
  }

  // how much vine hangs beyond each point: drives the stem's taper (pipe model)
  for (let i = stems.length - 1; i >= 0; i--) {
    const s = stems[i];
    s.reach = s.len;
    for (const c of s.children) s.reach = Math.max(s.reach, c.parentDist + c.reach);
  }
  const maxReach = Math.max(...stems.filter(s => !s.parent).map(s => s.reach));
  const remAt = (s, d) => {
    let m = s.len - d;
    for (const c of s.children) if (c.parentDist >= d) m = Math.max(m, c.parentDist - d + c.reach);
    return m;
  };
  const widthAt = (s, d) => 0.9 + 7.2 * Math.pow(clamp(remAt(s, d) / maxReach), 1.05);

  // growth schedule: one speed, so every delay is a distance from the root
  for (const s of stems) s.pathTo = s.parent ? s.parent.pathTo + s.parentDist : 0;
  const longest = Math.max(...stems.map(s => s.pathTo + s.len));
  const speed = longest / 9.5;                           // the farthest tip arrives at ~10 s
  const T0 = 0.4;
  const at = (s, d) => T0 + (s.pathTo + d) / speed;

  // stems → tapered, hand-wobbled chunks
  for (const s of stems) {
    s.chunks = [];
    if (s.pts.length < 2 || s.len < 1.5) continue;
    const P = resample(catmull(s.pts, 4), 3.5);
    const pts = P.map((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const o = wob(i * 3.5 * 0.045, s.id * 2.7 + 50) * 1.4 * smoothstep(0, 10, i * 3.5);
      return [p[0] - ty * o, p[1] + tx * o];
    });
    const per = s.depth === 0 ? 7 : 10;                  // points per chunk
    for (let i = 0; i < pts.length - 1; i += per) {
      const part = pts.slice(i, Math.min(pts.length, i + per + 1));
      if (part.length < 2) break;
      const d0 = i * 3.5, d1 = Math.min(s.len, (i + part.length - 1) * 3.5);
      const w = widthAt(s, (d0 + d1) / 2);
      s.chunks.push({ d: polyD(part, false), w, ymax: Math.max(...part.map(p => p[1])), color: mix(PAL.woody, PAL.young, smoothstep(3.6, 1.2, w)), t: at(s, d0), dur: Math.max(0.05, (d1 - d0) / speed), thorns: [] });
    }
    for (const th of s.thorns) {
      const ch = s.chunks[Math.min(s.chunks.length - 1, Math.floor(th.dist / (per * 3.5)))];
      const w = widthAt(s, th.dist) / 2, n = [-Math.sin(th.a) * th.side, Math.cos(th.a) * th.side], f = [Math.cos(th.a), Math.sin(th.a)];
      const bx = th.x + n[0] * w * 0.8, by = th.y + n[1] * w * 0.8;
      const tri = [[bx - f[0] * 2.2, by - f[1] * 2.2], [bx + n[0] * th.size + f[0] * th.size * 0.55, by + n[1] * th.size + f[1] * th.size * 0.55], [bx + f[0] * 1.6, by + f[1] * 1.6]];
      ch?.thorns.push(polyD(tri));
    }
  }
  for (const l of leaves) {
    const s = stems[l.stem];
    const shape = place(lens(l.len, l.wid, 0.58), l.x + Math.cos(l.ang) * 1.5, l.y + Math.sin(l.ang) * 1.5, l.ang);
    l.d = polyD(shape);
    const xs = shape.map(p => p[0]), ys = shape.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    l.origin = `${f1(((l.x - x0) / Math.max(1, x1 - x0)) * 100)}% ${f1(((l.y - y0) / Math.max(1, y1 - y0)) * 100)}%`;
    l.vein = polyD(place([[2, 0], [l.len * 0.8, 0]], l.x, l.y, l.ang), false);
    l.t = at(s, l.dist);
  }
  for (const c of clusters) c.t = at(stems[c.stem], c.dist) + 0.55 + r.range(0, 0.4);

  const growEnd = Math.max(...clusters.map(c => c.t + 0.8), ...leaves.map(l => l.t + 0.6));
  const all = stems.flatMap(s => s.pts);
  const bounds = { x0: Math.min(...all.map(p => p[0])), x1: Math.max(...all.map(p => p[0])), y0: Math.min(...all.map(p => p[1])), y1: Math.max(...all.map(p => p[1])) };
  return { stems, leaves, clusters, growEnd, bounds, roots: roots.map(rt => rt.x) };
}

/** Which bracts will let go, and when: a slow, repeating schedule. */
export function fallPlan(vine, seed) {
  const r = rng(`velfall:${seed}`);
  const pool = vine.clusters.filter(c => c.x > 60 && c.x < W - 60 && c.y < GROUND - 80);
  const out = [];
  for (let i = 0; i < 5 && pool.length; i++) {
    const c = pool.splice(Math.floor(r() * pool.length), 1)[0];
    out.push({
      x: c.x, y: c.y, land: r.range(GROUND + 16, H - 14), period: r.range(19, 29), delay: vine.growEnd + 1.5 + i * r.range(3.5, 6),
      sway: r.range(14, 30) * r.sign(), drift: r.range(-40, 40), spin: r.range(120, 320) * r.sign(), color: c.pale ? r.pick(PAL.pale) : r.pick(PAL.magenta),
    });
  }
  return out;
}

/** Keyframes for a papery bract tumbling from (x, y) down to the ground. */
export function fallFrames(f, fallFrac, restUntil = 1) {
  const D = f.land - f.y, frames = [];
  const tf = (tx, ty, rot, sy) => `translate(${f1(tx)}px, ${f1(ty)}px) rotate(${f1(rot)}deg) scaleY(${sy.toFixed(2)})`;
  frames.push({ offset: 0, opacity: 0, transform: tf(0, 0, 0, 1) });
  frames.push({ offset: 0.01, opacity: 1, transform: tf(0, 0, 0, 1) });
  const n = 14;
  let last;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const tx = f.sway * Math.sin(u * Math.PI * 3) * (1 - u * 0.4) + f.drift * u;
    const ty = D * Math.pow(u, 1.15);
    const rot = f.spin * u + 25 * Math.sin(u * Math.PI * 3 + 1);
    const sy = i === n ? 0.5 : 0.35 + 0.65 * Math.abs(Math.cos(u * Math.PI * 2.5));
    last = [tx, ty, rot, sy];
    frames.push({ offset: 0.01 + u * (fallFrac - 0.01), opacity: 1, transform: tf(...last) });
  }
  if (restUntil < 1) {
    frames.push({ offset: restUntil, opacity: 0.95, transform: tf(...last) });
    frames.push({ offset: Math.min(0.99, restUntil + 0.06), opacity: 0, transform: tf(...last) });
    frames.push({ offset: 1, opacity: 0, transform: tf(...last) });
  }
  return frames;
}

// ── Pure core: the wall and the ground ────────────────────────────────────

const ellipseD = (x, y, rx, ry) => `M${f1(x - rx)} ${f1(y)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0`;

export function buildWall(seed) {
  const r = rng(`velwall:${seed}`), nz = makeNoise(`velwn:${seed}`);
  const blocks = [], pits = [], flecks = [], ledges = [], lights = [];
  const courses = 6, ch = (GROUND - FACE_TOP) / courses, gap = 3.2;
  const tone = ['#a95f3f', '#9c5237', '#b26a47', '#a35a3c', '#98553a', '#ad6444', '#a0583d'];
  const rough = (x0, y0, x1, y1, seedk) => {
    const pts = [];
    const edge = (ax, ay, bx, by, n) => { for (let i = 0; i < n; i++) { const u = i / n; pts.push([lerp(ax, bx, u), lerp(ay, by, u)]); } };
    const nx = Math.max(3, Math.round((x1 - x0) / 7)), ny = Math.max(3, Math.round((y1 - y0) / 7));
    edge(x0, y0, x1, y0, nx); edge(x1, y0, x1, y1, ny); edge(x1, y1, x0, y1, nx); edge(x0, y1, x0, y0, ny);
    return pts.map(([x, y], i) => [x + nz(x * 0.05, y * 0.05, seedk) * 3, y + nz(y * 0.05 + 7, x * 0.05, seedk) * 2.6]);
  };
  for (let row = 0; row < courses; row++) {
    const y0 = FACE_TOP + row * ch + gap / 2, y1 = y0 + ch - gap;
    let x = -r.range(10, 70);
    while (x < W + 10) {
      const w = r.range(104, 150), x0 = x + gap / 2, x1 = x + w - gap / 2;
      blocks.push({ d: polyD(rough(x0, y0, x1, y1, blocks.length * 0.37)), color: r.pick(tone) });
      ledges.push(`M${f1(x0 + 2)} ${f1(y1 - 0.6)}L${f1(x1 - 2)} ${f1(y1 - 0.6)}`);
      lights.push(`M${f1(x0 + 3)} ${f1(y0 + 1.2)}L${f1(x1 - 4)} ${f1(y0 + 1.2)}`);
      // laterite is vesicular: pores cluster where the iron washed out
      const count = Math.round(w * ch / 75);
      for (let i = 0; i < count; i++) {
        const px = r.range(x0 + 3, x1 - 3), py = r.range(y0 + 3, y1 - 3);
        if (nz(px * 0.035, py * 0.035, 5) < r.range(-0.15, 0.35)) continue;
        const rx = Math.pow(r(), 2.2) * 3.2 + 0.6;
        pits.push(ellipseD(px, py, rx, rx * r.range(0.5, 0.9)));
      }
      for (let i = 0; i < count * 0.4; i++) flecks.push(ellipseD(r.range(x0 + 3, x1 - 3), r.range(y0 + 3, y1 - 3), r.range(0.6, 1.6), r.range(0.4, 1)));
      x += w;
    }
  }
  // monsoon stains: dark streaks that run down from under the cap
  const stains = [];
  for (let i = 0; i < 16; i++) {
    const x = r.range(-20, W + 20), w = r.range(8, 46), len = r.range(20, 150) * (r() < 0.25 ? 1.8 : 1);
    stains.push({ d: polyD(rough(x, FACE_TOP - 2, x + w, FACE_TOP + len, i + 40)), a: r.range(0.2, 0.42) });
  }
  // lime-wash cap, slightly irregular, with a few chips where laterite shows
  const top = [], bottom = [];
  for (let x = -12; x <= W + 12; x += 12) {
    top.push([x, CAP_TOP + nz(x * 0.01, 3) * 2.2]);
    bottom.push([x, FACE_TOP + 1.5 + nz(x * 0.012, 9) * 1.5]);
  }
  const cap = polyD([...top, ...bottom.reverse()]);
  const chips = [];
  for (let i = 0; i < 7; i++) {
    const cx = r.range(30, W - 30), cy = r.pick([CAP_TOP + 3, FACE_TOP - 3, r.range(CAP_TOP + 6, FACE_TOP - 6)]);
    chips.push(polyD(rough(cx, cy - r.range(1.5, 3.5), cx + r.range(6, 20), cy + r.range(1.5, 3.5), i + 90)));
  }
  const grime = [];
  for (let i = 0; i < 40; i++) grime.push(ellipseD(r.range(0, W), r.range(CAP_TOP + 5, FACE_TOP - 2), r.range(2, 9), r.range(0.6, 1.8)));

  // ground: dusty red earth, a few pebbles and dry grass
  // the splash line: monsoon rain bouncing off the ground darkens the foot of the wall
  const splash = [[-10, GROUND + 2]];
  for (let x = -10; x <= W + 10; x += 16) splash.push([x, GROUND - 46 - 22 * nz(x * 0.008, 31) - 8 * nz(x * 0.05, 32)]);
  splash.push([W + 10, GROUND + 2]);
  const ground = [[-10, GROUND]];
  for (let x = 0; x <= W + 10; x += 20) ground.push([x, GROUND + nz(x * 0.01, 20) * 1.5]);
  ground.push([W + 10, H + 10], [-10, H + 10]);
  const hatch = [];
  for (let i = 0; i < 70; i++) {
    const x = r.range(0, W), y = r.range(GROUND + 10, H - 4), l = r.range(6, 18);
    hatch.push(`M${f1(x)} ${f1(y)}q${f1(l / 2)} ${f1(r.range(-1.2, 1.2))} ${f1(l)} ${f1(r.range(-0.6, 0.6))}`);
  }
  const pebbles = [];
  for (let i = 0; i < 26; i++) pebbles.push(ellipseD(r.range(0, W), r.range(GROUND + 8, H - 6), r.range(1.2, 3.4), r.range(0.8, 2)));
  const grass = [];
  for (let i = 0; i < 9; i++) {
    const gx = r.range(20, W - 20);
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + r.range(-0.6, 0.6), l = r.range(8, 20);
      grass.push(`M${f1(gx + k * 1.4)} ${GROUND + 1}q${f1(Math.cos(a) * l * 0.4)} ${f1(Math.sin(a) * l * 0.6)} ${f1(Math.cos(a) * l)} ${f1(Math.sin(a) * l)}`);
    }
  }
  // bracts that fell on earlier days
  const fallen = [];
  for (let i = 0; i < 11; i++) {
    const x = r.range(180, 1020), y = r.range(GROUND + 14, H - 10), a = r() * TAU, len = r.range(13, 17);
    fallen.push({ d: polyD(place(lens(len, len * 0.8, 0.62, 10, 0.6), x, y, a, r.range(0.55, 0.8))), color: r.chance(0.3) ? r.pick(PAL.pale) : mix(r.pick(PAL.magenta), '#c9a08a', r.range(0.15, 0.45)) });
  }
  // beyond the wall: a hazy line of trees and two coconut palms, far off
  const far = [[-10, CAP_TOP + 10]], near = [[-10, CAP_TOP + 10]];
  for (let x = -10; x <= W + 10; x += 8) {
    // rounded crowns: the bumps of |noise| read as mango and cashew canopies
    far.push([x, CAP_TOP - 64 - 150 * nz.fbm(x * 0.0035, 41, 0, 3) - 26 * Math.abs(nz(x * 0.02, 42))]);
    near.push([x, CAP_TOP - 26 - 90 * Math.max(-0.2, nz.fbm(x * 0.005, 43, 0, 3)) - 18 * Math.abs(nz(x * 0.03, 44))]);
  }
  far.push([W + 10, CAP_TOP + 10]); near.push([W + 10, CAP_TOP + 10]);
  const palms = [];
  for (const [px, top, lean, sc] of [[1050 + r.range(-15, 15), r.range(62, 84), r.range(0.06, 0.14), 1], [1140 + r.range(-8, 8), r.range(128, 150), -r.range(0.1, 0.18), 0.8]]) {
    const trunk = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12; trunk.push([px + lean * (CAP_TOP - top) * u * u + nz(u * 2, px) * 4, lerp(CAP_TOP, top, u)]); }
    const [cx, cy] = trunk[12], strokes = [];
    for (let f = 0; f < 11; f++) {
      const a = -Math.PI / 2 + (f / 10 - 0.5) * 3.6 + r.range(-0.15, 0.15), len = r.range(46, 66) * sc, droop = 0.7 + 0.6 * Math.abs(Math.cos(a));
      const rach = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        rach.push([cx + Math.cos(a) * len * u, cy + Math.sin(a) * len * u + droop * len * u * u * 0.8]);
      }
      strokes.push(polyD(rach, false));
      for (let i = 2; i <= 10; i++) {
        // leaflets hang from the midrib, longest in the middle of the frond
        const [x, y] = rach[i], [x0, y0] = rach[i - 1], ta = Math.atan2(y - y0, x - x0), ll = (11 * Math.sin(Math.PI * (i / 11)) + 3) * sc;
        for (const sd of [-1, 1]) {
          const la = lerp(ta + sd * 0.9, Math.PI / 2, 0.55);
          strokes.push(`M${f1(x)} ${f1(y)}q${f1(Math.cos(la) * ll * 0.5)} ${f1(Math.sin(la) * ll * 0.3)} ${f1(Math.cos(la) * ll)} ${f1(Math.sin(la) * ll)}`);
        }
      }
    }
    palms.push({ trunk: polyD(trunk, false), fronds: strokes.join('') });
  }
  return { far: polyD(far), near: polyD(near), palms, blocks, pits: pits.join(''), flecks: flecks.join(''), ledges: ledges.join(''), lights: lights.join(''), splash: polyD(splash), stains, cap, chips, grime: grime.join(''), ground: polyD(ground), hatch: hatch.join(''), pebbles: pebbles.join(''), grass: grass.join(''), fallen };
}

/**
 * How each register lives by the wall. quiet is the grown vine as a still;
 * warm grows it and lets a few tips sway in a light breeze, with three bracts
 * letting go now and then; playful is the plate's full breeze and five
 * bracts, and the vine answers the hand.
 */
export const LOOKS = {
  quiet: { breeze: 0, falls: 0 },
  warm: { breeze: 0.7, falls: 3 },
  playful: { breeze: 1, falls: 5 },
};
/** Well past the last bloom of any seed: the grown vine, for the still. */
export const STILL_TIME = 30;
export { W, H, CAP_TOP, CAP_H, FACE_TOP, GROUND, OUT_BACK, PAL, lens, place, polyD, f1 };

const memo = new Map();
/** The vine, the wall and the falling bracts for a seed, built once. */
export function sceneOf(seed = 1) {
  if (!memo.has(seed)) {
    if (memo.size > 6) memo.delete(memo.keys().next().value);
    const vine = buildVine(seed);
    memo.set(seed, { seed, vine, wall: buildWall(seed), falls: fallPlan(vine, seed) });
  }
  return memo.get(seed);
}

/** The per-frame description: which vine, how far grown, how the register lives. Pure. */
export function model({ time = 0, seed = 1, register = 'warm' } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const S = sceneOf(seed);
  return { time, seed, register, look, S, grown: time >= S.vine.growEnd, settled: register === 'quiet' };
}
