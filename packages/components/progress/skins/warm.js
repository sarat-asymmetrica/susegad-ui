// Warm: a small kolam in hand-inked line that closes as the value reaches 1.
// The line is drawn exactly as far as the value, over a faint pencil guide of
// what is left. It moves only when the value moves. Without a value, the dots
// breathe slowly and no line is drawn: nothing pretends to be work.

import { geometry } from '../../../scenes/kolam/model.js';

const NS = 'http://www.w3.org/2000/svg';
const SEED = 7; // a thirteen-dot diamond, the same kolam as the scene's default

/** Pure: the kolam as SVG data in a 100 x 100 box. */
export function kolamArt(seed = SEED) {
  const geo = geometry(seed, null, 100, 100);
  const d = geo.loops.map(l => 'M' + l.pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z').join('');
  return { d, dots: geo.dots, rings: geo.rings, cell: geo.cell };
}

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
};

export function mount(host, ctx) {
  const art = kolamArt();
  const svg = el('svg', { class: 'sg-progress__art', viewBox: '-4 -4 108 108', 'aria-hidden': 'true', focusable: 'false' });
  const fid = `sg-kolam-hand-${Math.random().toString(36).slice(2, 8)}`;
  const filter = el('filter', { id: fid, x: '-5%', y: '-5%', width: '110%', height: '110%' }, el('defs', {}, svg));
  el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '1', seed: '3', result: 'n' }, filter);
  el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '1.4' }, filter);

  const guide = el('path', { d: art.d, fill: 'none', stroke: 'var(--sg-ink-soft, GrayText)', 'stroke-opacity': '0.45', 'stroke-width': '1.1', 'stroke-dasharray': '0.1 3', 'stroke-linecap': 'round' }, svg);
  const line = el('path', {
    d: art.d, fill: 'none', stroke: 'var(--sg-ink, CanvasText)', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    pathLength: '100', 'stroke-dasharray': '100 100', 'stroke-dashoffset': '100', filter: `url(#${fid})`,
  }, svg);
  const dots = art.dots.map(([x, y]) => el('circle', { cx: x.toFixed(2), cy: y.toFixed(2), r: (art.cell * 0.1).toFixed(2), fill: 'var(--sg-ink-soft, GrayText)' }, svg));
  host.prepend(svg);

  let shown = 0, anims = [];
  const stop = () => { anims.forEach(a => a.cancel()); anims = []; };
  const moving = () => ctx.motion !== 'still' && ctx.motion !== 'state';

  function breathe() {
    if (anims.length || !moving()) return;
    // one slow breath, rippling out from the centre: the only thing alive while the work has no number
    anims = dots.map((c, i) => c.animate([{ opacity: 0.35 }, { opacity: 1 }, { opacity: 0.35 }], {
      duration: 2800, delay: art.rings[i] * 350, iterations: Infinity, easing: 'ease-in-out',
    }));
  }

  return {
    update(s) {
      if (s.fraction === null) {
        line.style.strokeDashoffset = '100'; shown = 0;
        breathe();
        anims.forEach(a => (ctx.visible ? a.play() : a.pause()));
        return;
      }
      stop();
      const to = s.fraction * 100;
      if (to !== shown && moving() && ctx.visible) {
        // the hand draws on to the new value, and no further
        line.animate([{ strokeDashoffset: 100 - shown }, { strokeDashoffset: 100 - to }], { duration: 420, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)' });
      }
      line.style.strokeDashoffset = String(100 - to);
      shown = to;
      const done = s.done ? 'var(--sg-accent, CanvasText)' : 'var(--sg-ink-soft, GrayText)';
      dots.forEach(c => c.setAttribute('fill', done));
    },
    destroy() { stop(); svg.remove(); },
  };
}
