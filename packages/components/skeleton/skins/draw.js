// Shared by the skeleton skins: the decorative layer, resize tracking, and the
// pencil drawing in SVG. Animation is WAAPI, so getAnimations() can pause it.

import { layout, outline, shading } from '../skeleton.core.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

/** The aria-hidden layer every skin draws into, plus a width watcher. */
export function deco(el, tag = 'div') {
  const node = tag === 'svg' ? document.createElementNS(NS, 'svg') : document.createElement('div');
  node.setAttribute('class', 'sg-skeleton-deco');
  node.setAttribute('aria-hidden', 'true');
  el.append(node);
  let width = el.clientWidth || 320, cb = null;
  const ro = new ResizeObserver(() => { const w = el.clientWidth; if (w && Math.abs(w - width) > 1) { width = w; cb?.(); } });
  ro.observe(el);
  return {
    node,
    get width() { return width; },
    onresize(f) { cb = f; },
    destroy() { ro.disconnect(); node.remove(); el.removeAttribute('data-arriving'); el.removeAttribute('data-inking'); },
  };
}

export const svgEl = (name, attrs, parent) => {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent?.append(n);
  return n;
};

/**
 * Draw the placeholder in pencil. Returns the ink paths (for the arrival) and
 * the wobble frames (for playful), so the skin decides how they move.
 * opts: { fills: (block, i) => colour, ink, frames, doodle }
 */
export function pencil(svg, s, width, { fills, ink = 'var(--sg-ink)', frames = 1, doodle = false } = {}) {
  svg.replaceChildren();
  const L = layout(s.shape, { lines: s.lines, width, seed: s.seed });
  const h = Math.ceil(L.height + 2);
  svg.setAttribute('viewBox', `-1 -1 ${width + 2} ${h}`);
  svg.setAttribute('width', width + 2); svg.setAttribute('height', h);
  svg.style.margin = '-1px';
  const fill = svgEl('g', {}, svg), shade = svgEl('g', { fill: 'none', stroke: 'var(--sg-ink-soft)', 'stroke-width': 0.6, opacity: 0.28, 'stroke-linecap': 'round' }, svg);
  const pic = doodle ? svgEl('g', { fill: 'none', stroke: 'var(--sg-ink-soft)', 'stroke-width': 1.2, opacity: 0.55, 'stroke-linecap': 'round' }, svg) : null;
  const groups = Array.from({ length: frames }, () => svgEl('g', { fill: 'none', stroke: 'var(--sg-ink-soft)', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg));
  const inkG = svgEl('g', { fill: 'none', stroke: ink, 'stroke-width': 1.4, 'stroke-linecap': 'round' }, svg), inks = [];
  L.blocks.forEach((b, i) => {
    const o = outline(b, { seed: s.seed });
    svgEl('path', { d: o.d, fill: fills(b, i), stroke: 'none' }, fill);
    if (b.kind === 'media') {
      const id = `sgk${uid++}`;
      svgEl('path', { d: o.d }, svgEl('clipPath', { id }, svg));
      svgEl('path', { d: shading(b, { seed: s.seed }), 'clip-path': `url(#${id})` }, shade);
      if (pic) sketchPicture(b, pic);
    }
    groups.forEach((g, f) => {
      const a = outline(b, { seed: s.seed, pass: f * 2 }), c = outline(b, { seed: s.seed, pass: f * 2 + 1 });
      svgEl('path', { d: a.d, 'stroke-width': 1.1, opacity: 0.62 }, g);
      svgEl('path', { d: c.d, 'stroke-width': 0.6, opacity: 0.38 }, g);
    });
    const p = svgEl('path', { d: o.d, 'stroke-dasharray': o.length.toFixed(1), 'stroke-dashoffset': o.length.toFixed(1), opacity: 0 }, inkG);
    inks.push({ p, length: o.length });
  });
  return { fill: pic ? [fill, pic, shade] : [fill, shade], frames: groups, inks, height: h };
}

/** The wireframe shorthand for "a picture goes here": a sun and two hills. */
function sketchPicture(b, g) {
  const cx = b.x + b.w * 0.72, cy = b.y + b.h * 0.3, r = Math.min(b.w, b.h) * 0.09;
  svgEl('circle', { cx, cy, r }, g);
  const base = b.y + b.h * 0.86;
  svgEl('path', { d: `M${b.x + b.w * 0.08},${base} Q${b.x + b.w * 0.3},${b.y + b.h * 0.38} ${b.x + b.w * 0.52},${base} Q${b.x + b.w * 0.68},${b.y + b.h * 0.5} ${b.x + b.w * 0.92},${base}` }, g);
}

/**
 * Content has arrived: trace each outline in ink over the placeholder, then
 * crossfade to the content. The content is in the accessibility tree from the
 * first moment; only its paint waits for the ink. Resolves when the layer is gone.
 */
export async function inkIn(el, d, drawn, { dur = 220, stagger = 20, easing = 'cubic-bezier(0.45, 0.05, 0.25, 1)', settle = 1 } = {}) {
  el.setAttribute('data-inking', '');
  d.node.classList.add('sg-inking');
  const all = [];
  drawn.inks.forEach(({ p, length }, i) => {
    p.setAttribute('opacity', 1);
    all.push(p.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: dur, delay: Math.min(i * stagger, 120), easing, fill: 'forwards' }));
  });
  for (const g of drawn.frames) all.push(g.animate({ opacity: 0 }, { duration: dur, fill: 'forwards' }));
  await Promise.all(all.map(a => a.finished.catch(() => {})));
  if (d.node.hasAttribute('hidden')) return;
  // the drawing lifts off the flow and the content fades in beneath it
  el.removeAttribute('data-inking');
  el.setAttribute('data-arriving', '');
  d.node.classList.add('sg-leaving');
  const out = d.node.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `scale(${settle})` }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
  await out.finished.catch(() => {});
  finish(el, d);
}

/** Done: no layer, content as it is. */
export function finish(el, d) {
  for (const a of d.node.getAnimations({ subtree: true })) a.cancel();
  d.node.setAttribute('hidden', ''); // an attribute, not the property: SVG elements have no hidden property
  d.node.classList.remove('sg-leaving', 'sg-inking');
  el.removeAttribute('data-arriving'); el.removeAttribute('data-inking');
}
