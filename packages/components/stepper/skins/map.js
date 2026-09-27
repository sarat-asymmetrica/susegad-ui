// Shared by the warm and playful skins: the route map drawn in SVG, and the
// walk along it. A leg inks in when you move past it and fades back to pencil
// if you step back; nothing else moves. WAAPI throughout, so getAnimations()
// can pause it.

import { map, footprints, toD } from '../stepper.core.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;
const el = (name, attrs, parent) => {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent?.append(n);
  return n;
};

/**
 * Mount a map above the steps. opts: { feet: bool, ink: css colour }.
 * Returns the skin object SgElement expects.
 */
export function mountMap(host, ctx, { feet = false, ink = 'var(--sg-ink)' } = {}) {
  const svg = el('svg', { class: 'sg-stepper-map', 'aria-hidden': 'true', focusable: 'false' });
  host.querySelector(':scope > .sg-stepper-progress')?.after(svg) ?? host.prepend(svg);
  let key = '', legs = [], dots = [], walked = -1, width = 0;
  const ro = new ResizeObserver(() => { const w = Math.round(svg.getBoundingClientRect().width); if (w && Math.abs(w - width) > 40) { width = w; key = ''; last && update(last); } });
  ro.observe(host);
  let last = null;

  function build(s) {
    const m = map(s.count, s.seed, { width: Math.max(320, Math.min(640, width || 640)) });
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${m.W} ${m.H}`);
    // the hills fade out at the edges, like a sketch map, instead of stopping at a line
    const id = `sgmap${++uid}`, defs = el('defs', {}, svg), fade = el('linearGradient', { id: `${id}g` }, defs);
    [[0, 0], [0.08, 1], [0.92, 1], [1, 0]].forEach(([o, a]) => el('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a }, fade));
    el('rect', { width: m.W, height: m.H, fill: `url(#${id}g)` }, el('mask', { id }, defs));
    const hills = el('g', { class: 'sg-stepper-hills', mask: `url(#${id})` }, svg);
    for (const c of m.contours) el('path', { d: toD(c.pts, c.closed), 'data-level': c.level }, hills);
    const guide = el('g', { class: 'sg-stepper-guide' }, svg), inked = el('g', { class: 'sg-stepper-road', stroke: ink }, svg);
    const steps = feet ? el('g', { class: 'sg-stepper-feet', fill: ink }, svg) : null;
    legs = m.legs.map(l => {
      const d = toD(l.pts);
      el('path', { d }, guide);
      const p = el('path', { d, 'stroke-dasharray': `${l.length} ${l.length}`, 'stroke-dashoffset': l.length }, inked);
      const prints = steps ? footprints(l.pts).map(f => el('ellipse', { cx: f.x, cy: f.y, rx: 2.1, ry: 1.2, transform: `rotate(${f.angle.toFixed(1)} ${f.x.toFixed(1)} ${f.y.toFixed(1)})`, opacity: 0 }, steps)) : [];
      return { p, length: l.length, prints };
    });
    const stops = el('g', { class: 'sg-stepper-stations' }, svg);
    dots = m.stations.map((st, k) => {
      const g = el('g', { transform: `translate(${st.x} ${st.y})` }, stops);
      el('circle', { r: 11 }, g);
      el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g).textContent = k + 1;
      return g;
    });
    walked = -1;
  }

  function update(s) {
    last = s;
    const k = `${s.count}:${s.seed}:${width}`;
    if (k !== key) { key = k; build(s); }
    const still = ctx.motion === 'still' || walked < 0;
    legs.forEach((leg, i) => {
      const done = i < s.index, was = i < walked;
      const to = done ? 0 : leg.length;
      if (still || done === was) {
        leg.p.getAnimations().forEach(a => a.cancel());
        leg.p.setAttribute('stroke-dashoffset', to);
        leg.prints.forEach(f => f.setAttribute('opacity', done ? 0.8 : 0));
        return;
      }
      // this leg changed: walk it (forward) or let the ink lift (back)
      const from = done ? leg.length : 0, dur = done ? 520 : 260;
      leg.p.setAttribute('stroke-dashoffset', to);
      leg.p.animate([{ strokeDashoffset: from }, { strokeDashoffset: to }], { duration: dur, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)' });
      leg.prints.forEach((f, j) => {
        f.setAttribute('opacity', done ? 0.8 : 0);
        f.animate([{ opacity: done ? 0 : 0.8 }, { opacity: done ? 0.8 : 0 }], { duration: 120, delay: done ? (j / leg.prints.length) * dur : 0, fill: 'backwards' });
      });
    });
    dots.forEach((g, i) => g.setAttribute('class', i < s.index ? 'done' : i === s.index ? 'here' : 'ahead'));
    walked = s.index;
  }

  return {
    update,
    restyle() {},
    destroy() { ro.disconnect(); svg.remove(); },
  };
}
