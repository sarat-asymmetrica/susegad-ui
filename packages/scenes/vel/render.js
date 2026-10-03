// Vel: the SVG renderer. Ported from the sketchbook plate (read only, never
// edited): the wall layer (sky, far trees, palms, laterite blocks with pores,
// pits, flecks, monsoon stains, the lime-washed cap, the ground with fallen
// bracts) and the living layer (one nested group per stem, stems drawn on by a
// sliding dash, leaves and bract clusters that pop open with an overshoot, a
// shadow twin on the wall, the cap redrawn over the roots, a breeze in the
// hanging tips and bracts that let go) are the plate's own code.
//
// What the port changes: every Web Animation is created paused and driven
// from the scene's clock (its currentTime is set each frame while it is
// active, and it is finished and cancelled once its time has passed). So the
// element's pause, the off-screen pause, the still, replay and reseed all
// reach every animation, and a paused vine is truly still. Growth that falls
// under the page's words is shown already grown, the breeze and the bracts
// keep away from them, the sky follows the theme (dusk on a dark page), and
// the hand (pointer or arrow keys) stirs branches and drops bracts in playful.

import { rng } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import {
  W, H, CAP_TOP, CAP_H, FACE_TOP, GROUND, OUT_BACK, PAL, lens, place, polyD, f1, fallFrames,
} from './model.js';

const SVGNS = 'http://www.w3.org/2000/svg';
let mounts = 0;
const make = (tag, attrs = {}, parent = null) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const stop = (grad, offset, color, opacity = 1) => make('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, grad);

// ── The wall layer, drawn once per seed and theme (the plate's own) ─────────

function drawBack(svg, wall, id, c) {
  const defs = make('defs', {}, svg);
  const sky = make('linearGradient', { id: `${id}sky`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  if (c.dark) { stop(sky, 0, '#1f2644'); stop(sky, 0.7, '#4b3f5e'); stop(sky, 1, '#8a5f62'); }
  else { stop(sky, 0, c.paper); stop(sky, 1, '#f4e1c6'); }
  const sun = make('radialGradient', { id: `${id}sun`, cx: 0.82, cy: 0.12, r: 0.55 }, defs);
  stop(sun, 0, c.dark ? '#e9e4f2' : '#fff4df', c.dark ? 0.3 : 0.95); stop(sun, 1, '#fff4df', 0);
  const stain = make('linearGradient', { id: `${id}stain`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  stop(stain, 0, '#2d2a22', 1); stop(stain, 1, '#2d2a22', 0);
  const under = make('linearGradient', { id: `${id}under`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  stop(under, 0, '#3a160c', 0.42); stop(under, 1, '#3a160c', 0);
  const sp = make('linearGradient', { id: `${id}splash`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  stop(sp, 0, '#2f2a1a', 0); stop(sp, 0.45, '#2f2a1a', 0.2); stop(sp, 1, '#2b2616', 0.42);
  const foot = make('linearGradient', { id: `${id}foot`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  stop(foot, 0, '#4a2414', 0.34); stop(foot, 1, '#4a2414', 0);
  capGradient(defs, id);
  // grain: one turbulence filter, on a static layer only, so it renders once
  const grain = make('filter', { id: `${id}grain`, x: 0, y: 0, width: 1, height: 1 }, defs);
  make('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.8, numOctaves: 2, seed: 4, result: 't' }, grain);
  make('feColorMatrix', { in: 't', values: '0 0 0 0 0.24  0 0 0 0 0.14  0 0 0 0 0.08  0 0 0 -1.6 1.05' }, grain);
  const pores = make('filter', { id: `${id}pores`, x: 0, y: 0, width: 1, height: 1 }, defs);
  make('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.045 0.07', numOctaves: 3, seed: 11, result: 't' }, pores);
  make('feColorMatrix', { in: 't', values: '0 0 0 0 0.25  0 0 0 0 0.08  0 0 0 0 0.04  0 0 0 -2.4 1.25' }, pores);

  make('rect', { width: W, height: H, fill: `url(#${id}sky)` }, svg);
  make('rect', { width: W, height: CAP_TOP + 10, fill: `url(#${id}sun)` }, svg);

  make('path', { d: wall.far, fill: c.dark ? '#3c3d5a' : '#dfdbc3', opacity: 0.85 }, svg);
  for (const p of wall.palms) {
    make('path', { d: p.trunk, fill: 'none', stroke: c.dark ? '#34354e' : '#bdb99e', 'stroke-width': 4.5, 'stroke-linecap': 'round' }, svg);
    make('path', { d: p.fronds, fill: 'none', stroke: c.dark ? '#303249' : '#b3b698', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.9 }, svg);
  }
  make('path', { d: wall.near, fill: c.dark ? '#2b2c44' : '#cdcdae', opacity: 0.85 }, svg);

  // the wall face
  make('rect', { x: 0, y: FACE_TOP - 2, width: W, height: GROUND - FACE_TOP + 4, fill: '#7f4630' }, svg);
  const bl = make('g', {}, svg);
  for (const b of wall.blocks) make('path', { d: b.d, fill: b.color }, bl);
  make('rect', { x: 0, y: FACE_TOP, width: W, height: GROUND - FACE_TOP, fill: '#000', filter: `url(#${id}pores)`, opacity: 0.55 }, svg);
  make('path', { d: wall.pits, fill: '#5a2317', opacity: 0.55 }, svg);
  make('path', { d: wall.flecks, fill: '#dc9a6a', opacity: 0.55 }, svg);
  make('path', { d: wall.ledges, fill: 'none', stroke: '#4b1d12', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.35 }, svg);
  make('path', { d: wall.lights, fill: 'none', stroke: '#e3a680', 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.4 }, svg);
  make('path', { d: wall.splash, fill: `url(#${id}splash)` }, svg);
  for (const s of wall.stains) make('path', { d: s.d, fill: `url(#${id}stain)`, opacity: s.a }, svg);
  make('rect', { x: 0, y: FACE_TOP, width: W, height: 22, fill: `url(#${id}under)` }, svg);

  // ground
  make('path', { d: wall.ground, fill: '#c29777' }, svg);
  make('rect', { x: 0, y: GROUND, width: W, height: 26, fill: `url(#${id}foot)` }, svg);
  make('path', { d: wall.hatch, fill: 'none', stroke: '#8a5a3e', 'stroke-width': 0.9, 'stroke-linecap': 'round', opacity: 0.45 }, svg);
  make('path', { d: wall.pebbles, fill: '#9c6a4d', opacity: 0.6 }, svg);
  make('path', { d: wall.grass, fill: 'none', stroke: '#7d7a45', 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.8 }, svg);
  const fl = make('g', { opacity: 0.9 }, svg);
  for (const f of wall.fallen) make('path', { d: f.d, fill: f.color }, fl);

  drawCap(svg, wall, id);
  make('rect', { width: W, height: H, fill: '#000', filter: `url(#${id}grain)`, opacity: 0.1, style: 'mix-blend-mode:multiply' }, svg);
}


function capGradient(defs, id) {
  const cg = make('linearGradient', { id: `${id}cap`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  stop(cg, 0, '#f7f2e7'); stop(cg, 0.22, '#ece4d2'); stop(cg, 1, '#d8cdb6');
}

function drawCap(parent, wall, id, withDetail = true) {
  make('path', { d: wall.cap, fill: `url(#${id}cap)` }, parent);
  if (!withDetail) return;
  make('path', { d: wall.grime, fill: '#6f6a58', opacity: 0.16 }, parent);
  for (const c of wall.chips) make('path', { d: c, fill: '#b8704f', opacity: 0.75 }, parent);
  make('path', { d: wall.cap, fill: 'none', stroke: '#8d8069', 'stroke-width': 0.8, opacity: 0.45 }, parent);
}

function petalAt(parent, x, y, color, r) {
  const wrapG = make('g', { transform: `translate(${f1(x)} ${f1(y)})` }, parent);
  const g = make('g', {}, wrapG);
  const len = r.range(11, 14);
  make('path', { d: polyD(place(lens(len, len * 0.8, 0.62, 10, 0.6), -len / 2, 0, 0)), fill: color, 'fill-opacity': 0.92, stroke: '#7c1648', 'stroke-width': 0.4, 'stroke-opacity': 0.35 }, g);
  g.style.transformBox = 'fill-box';
  g.style.transformOrigin = 'center';
  return g;
}

const inCalm = (x, y, calm, pad = 30) => calm.some(r => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);

// ── The renderer ──────────────────────────────────────────────────────────

export function createRenderer(host, { scene: sceneEl = null, invalidate = () => {} } = {}) {
  const uid = `sgvel${++mounts}_`;
  if (!host.style.aspectRatio) host.style.aspectRatio = `${W} / ${H}`;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:100%;height:100%;line-height:0;touch-action:manipulation';
  host.appendChild(wrap);
  const back = make('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' });
  back.style.cssText = 'display:block;width:100%;height:100%';
  // the living layer gets its own compositor layer, so its repaints never re-run the wall's filters
  const front = make('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' });
  front.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;will-change:transform';
  const dusk = make('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' });
  dusk.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:multiply';
  wrap.append(back, front, dusk);

  let colors = null, built = '', lastT = 0, S = null, reg = 'warm';
  let grow = [], loops = [], moves = [], groups = new Map(), twins = new WeakMap(), dropped = [], stirQ = [], hand = null, shadowG = null, lastHand = '';
  const r = rng(`veldrop:${uid}`);

  function palette() {
    return (colors ??= (() => {
      const c = readColors(host, { paper: 'var(--sg-paper, light-dark(#efe6d6, #151a2b))', dark: 'light-dark(#000000, #ffffff)' });
      return { paper: c.paper, dark: c.dark !== '#000000' };
    })());
  }

  /** A paused animation the clock will drive: currentTime is set from scene time while it runs. */
  const paused = (node, frames, opts) => { const a = node.animate(frames, opts); a.pause(); a.currentTime = 0; return a; };

  function build(scene, animated, look, c) {
    front.getAnimations({ subtree: true }).forEach(a => a.cancel());
    back.replaceChildren(); front.replaceChildren();
    grow = []; loops = []; moves = []; groups = new Map(); twins = new WeakMap(); dropped = []; stirQ = [];
    const { vine, wall, falls } = scene;
    drawBack(back, wall, uid, c);

    const defs = make('defs', {}, front);
    capGradient(defs, uid);
    const clip = make('clipPath', { id: `${uid}roots` }, defs);
    for (const x of vine.roots) make('rect', { x: x - 26, y: CAP_TOP - 6, width: 52, height: CAP_H + 8 }, clip);
    const wallClip = make('clipPath', { id: `${uid}wall` }, defs);
    make('rect', { x: 0, y: CAP_TOP + 2, width: W, height: GROUND - CAP_TOP - 2 }, wallClip);
    // the vine's shadow on the wall: a twin tree, dark and offset away from the sun
    shadowG = make('g', { 'clip-path': `url(#${uid}wall)`, opacity: 0.2, style: 'pointer-events:none' }, front);
    const shadowRoot = make('g', { transform: 'translate(-7 10)' }, shadowG);
    const SH = '#2a1208', onWall = y => y > CAP_TOP - 12;
    const root = make('g', {}, front);
    const shadows = new Map();
    const ms = s => Math.round(s * 1000);
    const pop = (node, frames, dur, t, x, y) => {
      const a = paused(node, frames, { duration: dur, delay: ms(t), fill: 'backwards', easing: OUT_BACK });
      grow.push({ a, start: ms(t), end: ms(t) + dur, x, y });
    };
    const drawOn = (p, ch, x, y) => {
      p.style.strokeDasharray = '1 2';
      const a = paused(p, [{ strokeDashoffset: '1.01' }, { strokeDashoffset: '0' }], { duration: ms(ch.dur), delay: ms(ch.t), fill: 'backwards', easing: 'linear' });
      grow.push({ a, start: ms(ch.t), end: ms(ch.t) + ms(ch.dur), x, y, done: () => { p.style.strokeDasharray = ''; } });
    };
    // one group per stem, nested in its parent: the DOM is the L-system's tree
    for (const s of vine.stems) {
      const parentG = s.parent ? groups.get(s.parent.id) : root;
      const g = make('g', { class: 'br', 'data-depth': s.depth, 'data-stem': s.id }, parentG);
      g.style.transformBox = 'view-box';
      g.style.transformOrigin = `${f1(s.pts[0][0])}px ${f1(s.pts[0][1])}px`;
      groups.set(s.id, g);
      const sg = make('g', {}, s.parent ? shadows.get(s.parent.id) : shadowRoot);
      sg.style.transformBox = 'view-box';
      sg.style.transformOrigin = g.style.transformOrigin;
      shadows.set(s.id, sg);
      twins.set(g, sg);
      for (const ch of s.chunks) {
        const [x0, y0] = s.pts[0];
        const p = make('path', { d: ch.d, fill: 'none', stroke: ch.color, 'stroke-width': f1(ch.w), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1 }, g);
        const mid = ch.d.slice(1).split('L')[0].split(' ').map(Number);
        const cx = Number.isFinite(mid[0]) ? mid[0] : x0, cy = Number.isFinite(mid[1]) ? mid[1] : y0;
        if (animated) drawOn(p, ch, cx, cy);
        if (onWall(ch.ymax)) {
          const sp = make('path', { d: ch.d, fill: 'none', stroke: SH, 'stroke-width': f1(ch.w + 0.6), 'stroke-linecap': 'round', pathLength: 1 }, sg);
          if (animated) drawOn(sp, ch, cx, cy);
        }
        if (ch.thorns.length) {
          const th = make('path', { d: ch.thorns.join(''), fill: PAL.thorn, opacity: 0.85 }, g);
          if (animated) { const a = paused(th, [{ opacity: 0 }, { opacity: 0.85 }], { duration: 400, delay: ms(ch.t + ch.dur), fill: 'backwards' }); grow.push({ a, start: ms(ch.t + ch.dur), end: ms(ch.t + ch.dur) + 400, x: cx, y: cy }); }
        }
      }
      for (const l of s.leaves) {
        const lg = make('g', {}, g);
        make('path', { d: l.d, fill: l.color, stroke: PAL.leafEdge, 'stroke-width': 0.6, 'stroke-opacity': 0.55 }, lg);
        make('path', { d: l.vein, fill: 'none', stroke: '#a7b77a', 'stroke-width': 0.6, opacity: 0.45 }, lg);
        lg.style.transformBox = 'fill-box';
        lg.style.transformOrigin = l.origin;
        if (animated) pop(lg, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], 520, l.t, l.x, l.y);
        if (onWall(l.y)) {
          const sl = make('path', { d: l.d, fill: SH }, sg);
          sl.style.transformBox = 'fill-box';
          sl.style.transformOrigin = l.origin;
          if (animated) pop(sl, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], 520, l.t, l.x, l.y);
        }
      }
      for (const cl of s.clusters) {
        const cg = make('g', { class: 'bloom' }, g);
        for (const p of cl.petals) make('path', { d: p.d, fill: p.color, 'fill-opacity': 0.9, stroke: '#7c1648', 'stroke-width': 0.4, 'stroke-opacity': 0.35 }, cg);
        make('path', { d: cl.veins, fill: 'none', stroke: cl.pale ? '#f7dbe7' : '#e67fb0', 'stroke-width': 0.5, opacity: 0.6 }, cg);
        make('path', { d: cl.star, fill: PAL.flower }, cg);
        cg.style.transformBox = 'fill-box';
        cg.style.transformOrigin = 'center';
        if (animated) pop(cg, [{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1) rotate(0deg)' }], 720, cl.t, cl.x, cl.y);
        if (onWall(cl.y)) {
          const sc = make('path', { d: cl.petals.map(p => p.d).join(''), fill: SH }, sg);
          sc.style.transformBox = 'fill-box';
          sc.style.transformOrigin = 'center';
          if (animated) pop(sc, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], 720, cl.t, cl.x, cl.y);
        }
      }
    }
    // the canes go behind the wall: redraw the cap over their roots
    const occ = make('g', { 'clip-path': `url(#${uid}roots)` }, front);
    drawCap(occ, wall, uid, false);

    if (animated && look.breeze > 0) {
      // a breeze in a few hanging tips, once the vine is grown
      const tips = [...groups.entries()].filter(([i]) => vine.stems[i].depth >= 3 && vine.stems[i].pts[0][1] > CAP_TOP - 40 && vine.stems[i].chunks.length);
      const rb = rng(`velbreeze:${scene.seed}`);
      for (let i = 0; i < Math.min(7, tips.length); i++) {
        const [id, g] = tips.splice(Math.floor(rb() * tips.length), 1)[0];
        const deg = rb.range(1.2, 2.4) * look.breeze;
        const opts = { duration: rb.range(4200, 6800), delay: ms(vine.growEnd + rb.range(0, 3)), iterations: Infinity, easing: 'ease-in-out' };
        const [x, y] = vine.stems[id].pts[0];
        for (const node of [g, twins.get(g)]) loops.push({ a: paused(node, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${deg}deg)` }, { transform: `rotate(${-deg * 0.6}deg)` }, { transform: 'rotate(0deg)' }], opts), x, y });
      }
      // bracts that let go, now and then, for as long as the scene runs
      const fallG = make('g', {}, front);
      for (const f of falls.slice(0, look.falls)) {
        const g = petalAt(fallG, f.x, f.y, f.color, rb);
        const fallTime = 4.2 + (f.land - f.y) / 160;
        loops.push({ a: paused(g, fallFrames(f, fallTime / f.period, Math.min(0.93, (fallTime + 9) / f.period)), { duration: ms(f.period), delay: ms(f.delay), iterations: Infinity, fill: 'backwards', easing: 'linear' }), x: f.x, y: f.y, fall: f });
      }
    }
    // dusk on a dark page: one cool wash over wall, vine and earth together, under a sky already painted for evening
    dusk.replaceChildren();
    if (c.dark) {
      const g = make('linearGradient', { id: `${uid}dusk`, x1: 0, y1: 0, x2: 0, y2: 1 }, make('defs', {}, dusk));
      stop(g, 0, '#ffffff'); stop(g, (CAP_TOP - 170) / H, '#ffffff'); stop(g, (CAP_TOP + 10) / H, '#7a80b0'); stop(g, 1, '#7a80b0');
      make('rect', { width: W, height: H, fill: `url(#${uid}dusk)` }, dusk);
    }
    hand = make('circle', { r: 11, fill: 'none', stroke: '#fbf5e8', 'stroke-width': 2, opacity: 0, style: 'pointer-events:none' }, front);
    grow.sort((a, b) => a.start - b.start);
  }

  // a stir asked for by the pointer: the plate's pointerover, on the branch under it
  const onOver = e => {
    if (reg !== 'playful') return;
    const g = e.target.closest?.('g.br');
    if (g) { stirQ.push(g); invalidate(); }
  };
  front.addEventListener('pointerover', onOver);

  function stir(g, T) {
    if (!g || g.dataset.sw) return;
    g.dataset.sw = '1';
    const depth = Number(g.dataset.depth), deg = [0.5, 1.2, 2.2, 3, 3.4][Math.min(4, depth)] * (r() < 0.5 ? -1 : 1);
    const k = [0, 1, -0.62, 0.38, -0.22, 0.12, -0.05, 0];
    const frames = k.map(v => ({ transform: `rotate(${f1(v * deg * 10) / 10}deg)` }));
    for (const node of [g, twins.get(g)]) if (node) moves.push({ a: paused(node, frames, { duration: 2400, easing: 'ease-in-out', composite: 'add' }), t0: T, dur: 2400, end: () => delete g.dataset.sw });
  }

  function drop(x, y, T) {
    let best = null, bd = 130;
    for (const cl of S.vine.clusters) { const d = Math.hypot(cl.x - x, cl.y - y); if (d < bd) { bd = d; best = cl; } }
    if (best) { x = best.x; y = best.y; }
    if (y > GROUND - 4) return;
    const f = { x, y, land: r.range(GROUND + 14, H - 10), sway: r.range(12, 26) * r.sign(), drift: r.range(-30, 30), spin: r.range(120, 300) * r.sign() };
    const g = petalAt(front, x, y, best?.pale ? r.pick(PAL.pale) : r.pick(PAL.magenta), r);
    const dur = Math.round(2600 + (f.land - y) * 7);
    moves.push({ a: paused(g, fallFrames(f, 1), { duration: dur, fill: 'forwards', easing: 'linear' }), t0: T, dur, keep: true });
    dropped.push(g.parentNode);
    if (dropped.length > 24) dropped.shift().remove();
    front.append(hand);
  }

  /** The stem nearest a point, for the keyboard hand. */
  function nearestStem(x, y) {
    let best = null, bd = 60;
    for (const s of S.vine.stems) for (let i = 0; i < s.pts.length; i += 3) { const d = Math.hypot(s.pts[i][0] - x, s.pts[i][1] - y); if (d < bd) { bd = d; best = s; } }
    return best && groups.get(best.id);
  }

  function render(data, frame) {
    const c = palette(), calm = frame.calm || [], still = !!frame.still;
    reg = data.register;
    const T = Math.round((still ? 1e6 : data.time) * 1000);
    const key = `${data.seed}|${still}|${data.register}|${c.paper}|${c.dark}|${frame.epoch}`;
    if (key !== built || T < lastT - 50) {
      built = key; S = data.S;
      build(S, !still, data.look, c);
    }
    lastT = T;
    if (shadowG) shadowG.style.display = (frame.quality ?? 1) < 0.5 ? 'none' : '';
    // growth: active animations follow the clock; finished ones (or ones under the page's words) are let go
    for (const g of grow) {
      if (g.over) continue;
      if (T >= g.end || inCalm(g.x, g.y, calm)) { g.a.cancel(); g.done?.(); g.over = true; }
      else if (T >= g.start) g.a.currentTime = T;
    }
    if (grow.length && grow.every(g => g.over)) grow = [];
    // the breeze and the falling bracts: the clock drives them; under the words they rest
    for (const l of loops) {
      const quiet = inCalm(l.x, l.y, calm) || (l.fall && calm.some(r => l.fall.x > r.x - 40 && l.fall.x < r.x + r.w + 40 && r.y + r.h > l.fall.y));
      l.a.currentTime = quiet ? 0 : T;
    }
    // stirs and drops started by the hand
    if (!still) {
      for (const g of stirQ.splice(0)) stir(g, T);
      const p = frame.pointer;
      if (reg === 'playful' && p?.keyboard && p.inside) {
        const hk = `${Math.round(p.x)},${Math.round(p.y)}`;
        hand.setAttribute('cx', f1(p.x)); hand.setAttribute('cy', f1(p.y)); hand.setAttribute('opacity', '0.85');
        if (hk !== lastHand) { lastHand = hk; stir(nearestStem(p.x, p.y), T); }
      } else if (hand) hand.setAttribute('opacity', '0');
    }
    moves = moves.filter(m => {
      const at = T - m.t0;
      if (at >= m.dur) { if (m.keep) { m.a.currentTime = m.dur; m.a.commitStyles(); } m.a.cancel(); m.end?.(); return false; }
      m.a.currentTime = Math.max(0, at);
      return true;
    });
    host.dataset.growing = String(grow.length);
  }

  return {
    render,
    setRegister() { built = ''; },
    restyle() { colors = null; built = ''; },
    /** Enter, Space or a tap in playful: a bract lets go near the hand. */
    activate(p) { if (p && S) { drop(p.x, p.y, lastT); invalidate(); } },
    destroy() {
      front.removeEventListener('pointerover', onOver);
      front.getAnimations({ subtree: true }).forEach(a => a.cancel());
      wrap.remove();
    },
  };
}
