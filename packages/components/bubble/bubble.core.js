// Bubble: the pure core. Runs in Node.
//
// A speech, thought or shout bubble is a figure with a paragraph in it; what is
// computed here is the drawing around the words and where the words may go:
//
//   bubbleModel(state)  the outline (path data), the tail or trail, and the text zone
//   textZones(state)    the zone as the type tier reads it (packages/type/layout.zones.js)
//   sizeBubble(lay, …)  the smallest bubble whose zone holds the words at a legible size
//   hugShapes(…)        the same zone as two CSS shape-outside polygons, for the still
//
// Everything is in CSS px of the bubble's own box (w by h, origin top left); the
// tail or trail leaves the box by up to `tailLen`. Same seed and size, same
// drawing. The words are never in here: they stay the page's paragraph.

import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';
import { catmull } from '../../engine/src/geom.js';
import { shapeOf, boundsOf } from '../../type/layout.core.js';

import { clearanceZone } from './bubble.zones.core.js';
import { KINDS, TAILS, STRINGS, tailOf, kindOf, captionFor } from './bubble.words.js';
export { KINDS, TAILS, STRINGS, tailOf, kindOf, captionFor };

/** The least distance, in px, the words' zone keeps from the drawn outline. */
export const CLEARANCE = 1.5;

const DIR = { 'bottom-left': [-0.42, 0.91], bottom: [0, 1], 'bottom-right': [0.42, 0.91], 'top-left': [-0.42, -0.91], top: [0, -1], 'top-right': [0.42, -0.91], left: [-0.93, 0.37], right: [0.93, 0.37] };
const ROOT = { 'bottom-left': 118, bottom: 90, 'bottom-right': 62, 'top-left': 242, top: 270, 'top-right': 298, left: 172, right: 8 }; // degrees on the body, screen angles
const rad = d => (d * Math.PI) / 180;
const f = v => +v.toFixed(1);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const at = (pts, close) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}${close ? 'Z' : ''}`;

/** How far a bump or a spike stands out of the body ellipse, for a box w by h. */
const depth = (kind, w, h) => (kind === 'thought' ? clamp(0.1 * Math.min(w, h), 6, 20) : kind === 'shout' ? 2 : 2.5);
/** The part of the spike ring that is body: valleys sit at this fraction of the outer ellipse. */
const VALLEY = 0.8;
/** No bubble is shrunk narrower than this, however short the words. */
const MIN_W = 120;

function superellipse(cx, cy, rx, ry, n, t) {
  const c = Math.cos(t), s = Math.sin(t), p = 2 / n;
  return [cx + rx * Math.sign(c) * Math.abs(c) ** p, cy + ry * Math.sign(s) * Math.abs(s) ** p];
}

/** Break each straight edge of a polygon into ragged steps (the vertices stay sharp): the torn edge. */
function tear(pts, amp, step, seed) {
  const n = makeNoise(`bubble-tear:${seed}`), out = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(len / step));
    out.push(a);
    for (let j = 1; j < k; j++) {
      const t = j / k, o = n(i * 3.7 + t * 5, 2.1) * amp;
      out.push([a[0] + (b[0] - a[0]) * t - ((b[1] - a[1]) / len) * o, a[1] + (b[1] - a[1]) * t + ((b[0] - a[0]) / len) * o]);
    }
  });
  return out;
}

/**
 * The bubble for a box.
 * @param {{ kind?: string, tail?: string, w: number, h: number, seed?: string|number, wobble?: number, tailLen?: number,
 *   edge?: 'clean'|'torn', plain?: boolean }} st
 *   `wobble` is the pen's wander in px (0 is a steady line); `plain` draws a rounded box instead of the kind's shape
 *   (the fallback when the words must flow as they are); `edge: 'torn'` raggeds a shout's edges.
 * @returns {{ kind, tail, w, h, outline: string, trail: {cx,cy,r}[], tip: {x,y}, zone: object, pad: number }}
 *   `zone` is a shape descriptor (layout.core.js shapeOf) for the words; `tip` is where the tail points.
 */
export function bubbleModel(st) {
  const kind = kindOf(st.kind), tail = tailOf(st.tail), { w, h } = st, seed = st.seed ?? 'bubble';
  const wobble = st.wobble ?? 0.6, L = st.tailLen ?? 28, plain = !!st.plain;
  const r = rng(`bubble:${seed}`), noise = makeNoise(`bubble-wander:${seed}`);
  const ins = plain ? 2.5 : depth(kind, w, h), cx = w / 2, cy = h / 2;
  const amp = wobble * 1.4, rx = w / 2 - ins, ry = h / 2 - ins;
  const dir = DIR[tail], root = rad(ROOT[tail] ?? 90), hasTail = tail !== 'none';
  const pad = clamp(Math.round(Math.min(w, h) * 0.06), 5, 10) + Math.ceil(amp);
  let outline, zone, trail = [], tip = { x: cx, y: cy };

  /** Three small clouds leaving the body at (x0, y0) toward the tail, each smaller than the last. */
  const trailFrom = (x0, y0) => {
    let along = 0;
    trail = [0.2, 0.14, 0.09].map(k => {
      const q = Math.max(2.5, L * k); along += q;
      const c = { cx: f(x0 + dir[0] * along), cy: f(y0 + dir[1] * along), r: f(q) };
      along += q + L * 0.05;
      return c;
    });
    tip = { x: trail[2].cx, y: trail[2].cy };
  };

  /**
   * The zone for a drawn outline: the corridor CLEARANCE px inside it, as the
   * type tier's shape descriptor (bubble.zones.core.js). A corridor too thin to
   * hold words falls back to a two-px box at the centre, which holds no line,
   * so the caller lays the words plainly instead of clipping them.
   */
  const zoneOf = (outer, clear = CLEARANCE) => {
    const shape = outer.points && outer.points.length > 32 ? { kind: 'polygon', points: outer.points.filter((_, i) => i % 2 === 0) } : outer;
    const z = clearanceZone(shape, clear);
    return z ? { ...z, pad } : { kind: 'rect', x: cx - 1, y: cy - 1, w: 2, h: 2, pad };
  };

  if (!plain && kind === 'thought') {
    // a cloud: bumps hung on an ellipse, each an arc a little over a chord; the words sit in the ellipse, less the anchors' wander
    const perim = Math.PI * (1.5 * (rx + ry) - Math.sqrt(rx * ry));
    const n = clamp(Math.round(perim / (Math.min(rx, ry) * 0.62)), 9, 16), phase = r.range(0, 6.283);
    const P = Array.from({ length: n }, (_, i) => {
      const t = phase + ((i + r.range(-0.14, 0.14)) * 2 * Math.PI) / n, k = 1 + r.range(-0.03, 0.03);
      return [cx + rx * k * Math.cos(t), cy + ry * k * Math.sin(t)];
    });
    let d = `M${f(P[0][0])} ${f(P[0][1])}`;
    P.forEach((a, i) => {
      const b = P[(i + 1) % n], chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const bulge = Math.min(ins - 1, 0.46 * chord) * r.range(0.8, 1), rr = (chord * chord / 4 + bulge * bulge) / (2 * bulge);
      d += `A${f(rr)} ${f(rr)} 0 0 1 ${f(b[0])} ${f(b[1])}`;
    });
    outline = `${d}Z`;
    // the words sit inside the anchors' ellipse, the innermost part of the cloud, so a corridor of its distance field clears the bumps
    zone = zoneOf({ kind: 'ellipse', cx, cy, rx: rx * 0.97, ry: ry * 0.97 });
    if (hasTail) trailFrom(cx + rx * Math.cos(root) + dir[0] * ins, cy + ry * Math.sin(root) + dir[1] * ins);
  } else if (!plain && kind === 'shout') {
    // a burst: spikes on the outer ellipse, valleys between them; the words sit in the ring of valleys
    const perim = Math.PI * (1.5 * (rx + ry) - Math.sqrt(rx * ry)), n = clamp(Math.round(perim / 52), 9, 18), phase = r.range(0, 6.283);
    const spike = Array.from({ length: n }, (_, i) => {
      const t = phase + ((i + r.range(-0.12, 0.12)) * 2 * Math.PI) / n, k = 1 + r.range(-0.08, 0);
      return [cx + rx * k * Math.cos(t), cy + ry * k * Math.sin(t), t];
    });
    const valley = spike.map(([, , t]) => {
      const t2 = t + (Math.PI / n) * r.range(0.85, 1.15), k = VALLEY + r.range(-0.03, 0.03);
      return [cx + rx * k * Math.cos(t2), cy + ry * k * Math.sin(t2)];
    });
    if (hasTail) { // the spike nearest the tail grows into it
      const want = ((root % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const near = spike.map(([, , t], i) => [Math.abs(Math.atan2(Math.sin(t - want), Math.cos(t - want))), i]).sort((a, b) => a[0] - b[0])[0][1];
      const s = spike[near];
      spike[near] = [s[0] + dir[0] * L * 0.96, s[1] + dir[1] * L * 0.96, s[2]];
      tip = { x: spike[near][0], y: spike[near][1] };
    }
    const ring = spike.flatMap((s, i) => [[s[0], s[1]], valley[i]]);
    const drawn = st.edge === 'torn' ? tear(ring, 2.4 + amp, 3.6, seed) : ring;
    outline = at(drawn, true);
    // the words sit inside the valley ring, which has no tail; a torn edge can dip inside a valley by the tear's own depth
    zone = zoneOf({ kind: 'polygon', points: valley }, CLEARANCE + (st.edge === 'torn' ? 2.4 + amp : 0));
  } else {
    // a speech balloon: a rounded body (a squarer superellipse when plain), wandering a little, with a curved tail
    const e = plain ? 9 : 2.5, K = 28, wedge = hasTail && kind !== 'thought';
    const delta = clamp((L * 1.45) / (rx + ry), 0.1, 0.34), t0 = wedge ? root + delta : 0, span = wedge ? 2 * Math.PI - 2 * delta : 2 * Math.PI;
    const body = Array.from({ length: K + (wedge ? 1 : 0) }, (_, i) => {
      const [x, y] = superellipse(cx, cy, rx, ry, e, t0 + (span * i) / K), o = noise(i * 0.55, 1.7) * amp, vx = x - cx, vy = y - cy, l = Math.hypot(vx, vy) || 1;
      return [x + (vx / l) * o, y + (vy / l) * o];
    });
    const pts = catmull(body, 4, !wedge);
    if (wedge) {
      const B1 = body[body.length - 1], B2 = body[0], T = [(B1[0] + B2[0]) / 2 + dir[0] * L * 1.05, (B1[1] + B2[1]) / 2 + dir[1] * L * 1.05];
      const side = [-dir[1], dir[0]], bend = (A, B, k, s) => [A[0] * (1 - k) + B[0] * k + side[0] * s, A[1] * (1 - k) + B[1] * k + side[1] * s];
      const c1 = bend(B1, T, 0.45, L * 0.2), c2 = bend(T, B2, 0.55, L * 0.08);
      const q = (A, C, B, t) => [(1 - t) ** 2 * A[0] + 2 * (1 - t) * t * C[0] + t * t * B[0], (1 - t) ** 2 * A[1] + 2 * (1 - t) * t * C[1] + t * t * B[1]];
      for (let k = 1; k <= 7; k++) pts.push(q(B1, c1, T, k / 7));
      for (let k = 1; k < 7; k++) pts.push(q(T, c2, B2, k / 7));
      tip = { x: T[0], y: T[1] };
    }
    outline = at(pts, true);
    // the words sit inside the body less the pen's wander, the innermost the drawn edge ever comes
    const brx = Math.max(1, rx - amp), bry = Math.max(1, ry - amp);
    zone = zoneOf({ kind: 'polygon', points: Array.from({ length: 48 }, (_, i) => superellipse(cx, cy, brx, bry, e, (2 * Math.PI * i) / 48)) });
    if (kind === 'thought' && hasTail) { const [x0, y0] = superellipse(cx, cy, rx, ry, e, root); trailFrom(x0 + dir[0] * 2, y0 + dir[1] * 2); }
  }
  return { kind, tail, w, h, outline, trail, tip: { x: f(tip.x), y: f(tip.y) }, zone, pad };
}

/**
 * The zone for the type tier (layout.zones.js): where the words go, in this bubble's box.
 * `minPx` and `maxPx` are the legible floor and the size the page's CSS asks for.
 */
export function textZones(st) {
  return zonesOf(bubbleModel(st), st);
}

/** The zone list for an already-built model, so a caller that has one does not build it twice. */
function zonesOf(m, st) {
  return [{ id: 'words', shape: m.zone, slot: 'words', registers: ['warm', 'playful'], minPx: st.minPx ?? 14, maxPx: st.maxPx ?? 22, leading: st.leading ?? 1.25, align: 'center', valign: 'middle' }];
}

/**
 * The smallest bubble that holds the words. `lay(zones, texts)` is layZones
 * bound to a layout (the live door in the browser, the fake oracle in Node).
 *
 * At the width it is given, the bubble starts as wide as it is tall by 1.7 and
 * grows taller (8 per cent at a time, to a height of 0.9 times its width) until
 * the words fit at their size, or at their best size if that never reaches the
 * one asked for. Then, if the words are at the size asked for, it shrinks, with
 * the same shape, for as long as they still are: a short line gets a small
 * bubble. Null when even the tallest does not hold them at the legible floor:
 * the words belong in a plain flow (the caller's fallback), never clipped.
 *
 * @returns {{ w: number, h: number, px: number, lines: object[], lineHeight: number, state: object, model: object } | null}
 */
export function sizeBubble(lay, st, text) {
  const run = (w, h) => {
    const state = { ...st, w: f(w), h: f(h) }, model = bubbleModel(state), got = lay(zonesOf(model, state), { words: text }).words;
    return got?.fits ? { w: state.w, h: state.h, px: got.px, lines: got.lines, lineHeight: got.lineHeight, state, model } : null;
  };
  const W = st.w, h0 = W / 1.7, hMax = Math.max(h0, W * 0.9);
  let best = null;
  for (let h = h0; h <= hMax * 1.0001; h *= 1.08) {
    const got = run(W, h);
    if (got && (!best || got.px > best.px)) best = got;
    if (best && best.px >= (st.maxPx ?? 22)) break;
  }
  if (!best) return null;
  if (best.px >= (st.maxPx ?? 22)) { // the words are at their size: shrink while that holds
    for (let k = 0; k < 12 && best.w * 0.9 >= MIN_W; k++) {
      const got = run(best.w * 0.9, best.h * 0.9);
      if (!got || got.px < best.px) break;
      best = got;
    }
  }
  return best;
}

/**
 * The still's text flow: the zone as two CSS float shapes, one hugging each
 * side, so that text set between them follows the zone with no script. Each is
 * a polygon in its float's own box (50 per cent of the width, the full height):
 * the left one is everything left of the room, the right one everything right.
 * Rows where the zone has no room, or less than `minWidth` (its poles: CSS would
 * put one short word on such a line, where layZones skips the band), close up on the middle, and
 * above and below the zone both floats are whole, so no text sits there.
 * @returns {{ left: string, right: string, top: number, bottom: number }} CSS polygon() strings, and where the zone stands in y
 */
export function hugShapes(zone, w, h, rows = 96, minWidth = 0) {
  const shape = shapeOf(zone), b = boundsOf(zone), half = w / 2, L = [], R = [], pad = zone.pad ?? 0;
  // the rows are regular, plus the two places where the room appears and vanishes (a band needs its pad above and below it inside the shape):
  // sampled coarsely, a flat-topped zone would open its top a few px early, and a line could sit there with no room.
  const ys = Array.from({ length: rows + 1 }, (_, i) => b.y + (b.h * i) / rows);
  for (const edge of [b.y + pad + 0.25, b.y + b.h - pad - 0.25]) ys.push(edge - 0.02, edge, edge + 0.02);
  for (const y0 of [...new Set(ys.map(y => +clamp(y, b.y + 0.1, b.y + b.h - 0.1).toFixed(2)))].sort((p, q) => p - q)) {
    const y = y0;
    let room = shape(y - 0.25, y + 0.25);
    if (!room || room.w < minWidth) room = { x: half, w: 0 };
    L.push(`${f(clamp(room.x, 0, half))}px ${y}px`);
    R.push(`${f(clamp(room.x + room.w - half, 0, half))}px ${y}px`);
  }
  const top = f(b.y), bottom = f(b.y + b.h);
  return {
    left: `polygon(0px 0px, ${half}px 0px, ${half}px ${top}px, ${L.join(', ')}, ${half}px ${bottom}px, ${half}px ${f(h)}px, 0px ${f(h)}px)`,
    right: `polygon(${half}px 0px, 0px 0px, 0px ${top}px, ${R.join(', ')}, 0px ${bottom}px, 0px ${f(h)}px, ${half}px ${f(h)}px)`,
    top: b.y, bottom: b.y + b.h,
  };
}

/**
 * Do the line boxes CSS laid (the still) stand inside the zone? Each box is { x0, x1, y0, y1 } in the bubble's box;
 * the zone's room for the band y0 to y1 must hold x0 to x1, within `tol` px (engines round lines differently).
 * The still asks this of the browser's own line breaks, so a bubble is accepted only where they nest, whichever engine laid them.
 */
export function linesHold(zone, boxes, tol = 0.75) {
  const shape = shapeOf(zone);
  return boxes.length > 0 && boxes.every(b => { const room = shape(b.y0, b.y1); return !!room && b.x0 >= room.x - tol && b.x1 <= room.x + room.w + tol; });
}

/**
 * How a bubble arrives the first time it is on screen. Playful pops (scale and a little turn, out of the tail's tip,
 * with a spring); warm settles (a rise and a fade). Opacity and transform only; null at still or state motion.
 * @param {'still'|'state'|'ambient'|'full'} motion
 * @param {'warm'|'playful'} register
 * @param {{x:number,y:number}} tip
 */
export function arrive(motion, register, tip) {
  if (motion === 'still' || motion === 'state') return null;
  const origin = `${f(tip.x)}px ${f(tip.y)}px`;
  if (register === 'playful' && motion === 'full') {
    return { origin, frames: [{ opacity: 0, transform: 'scale(0.55) rotate(-4deg)' }, { opacity: 1, transform: 'scale(1.06) rotate(1deg)', offset: 0.6 }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }], timing: { duration: 460, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'backwards' } };
  }
  return { origin, frames: [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], timing: { duration: 380, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'backwards' } };
}
