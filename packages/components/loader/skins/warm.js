// Warm: a small kolam. A light travels round its one unbroken line, and each
// dot brightens as the line passes it, in the order the hand would reach them.
// With motion off, the kolam rests with every dot lit.

import { geometry } from '../../../scenes/kolam/model.js';

const NS = 'http://www.w3.org/2000/svg';
const LAP = 4800; // one lap of the loop, in ms

/** Pure: the kolam, and for each dot the fraction of the loop where the line passes closest. */
export function kolamLap(seed = 7) {
  const geo = geometry(seed, null, 100, 100), loop = geo.loops[0];
  const d = 'M' + loop.pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z';
  const phases = geo.dots.map(([x, y]) => {
    let best = Infinity, at = 0;
    loop.pts.forEach(([px, py], i) => { const q = (px - x) ** 2 + (py - y) ** 2; if (q < best) { best = q; at = loop.cum[i]; } });
    return at / loop.length;
  });
  return { d, dots: geo.dots, phases, cell: geo.cell };
}

const el = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
};

export function mount(host, ctx) {
  const k = kolamLap();
  const svg = el('svg', { class: 'sg-loader__art', viewBox: '-4 -4 108 108', 'aria-hidden': 'true', focusable: 'false' });
  el('path', { d: k.d, fill: 'none', stroke: 'var(--sg-ink-soft, GrayText)', 'stroke-opacity': '0.28', 'stroke-width': '2', 'stroke-linecap': 'round' }, svg);
  const light = el('path', { d: k.d, fill: 'none', stroke: 'var(--sg-ink, CanvasText)', 'stroke-width': '3.2', 'stroke-linecap': 'round', pathLength: '100', 'stroke-dasharray': '14 86', opacity: '0' }, svg);
  const dots = k.dots.map(([x, y]) => el('circle', { cx: x.toFixed(2), cy: y.toFixed(2), r: (k.cell * 0.2).toFixed(2), fill: 'var(--sg-accent, CanvasText)' }, svg));
  dots.forEach(c => { c.style.transformBox = 'fill-box'; c.style.transformOrigin = 'center'; });
  host.prepend(svg);

  let anims = [];
  function start() {
    if (anims.length || ctx.motion === 'still') return;
    light.setAttribute('opacity', '1');
    anims.push(light.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: LAP, iterations: Infinity }));
    dots.forEach((c, i) => {
      // The light's head passes this dot at about (phase - 0.08) of the lap: peak then, then fade back to rest.
      const peak = (((k.phases[i] - 0.08) % 1) + 1) % 1;
      anims.push(c.animate([{ opacity: 1, transform: 'scale(1.25)' }, { opacity: 0.4, transform: 'scale(1)', offset: 0.28 }, { opacity: 0.4 }], {
        duration: LAP, delay: peak * LAP - LAP, iterations: Infinity, easing: 'ease-out',
      }));
    });
  }
  return {
    update() { start(); anims.forEach(a => (ctx.visible ? a.play() : a.pause())); },
    destroy() { anims.forEach(a => a.cancel()); svg.remove(); },
  };
}
