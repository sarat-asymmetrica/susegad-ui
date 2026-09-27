// Warm: a box sketched in pencil, four strokes whose corners cross, and a
// heavy pencil tick, drawn over the native checkbox. When someone checks it,
// the tick is drawn in over about a quarter of a second, the way a hand
// would; clearing it lifts the tick at once. "Some" is a short pencil dash.

import { pencilTick, pencilDash, sketchBox, arrival } from '../check.core.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (doc, name, attrs) => {
  const n = doc.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/** Build the aria-hidden drawing and put it straight after the input. */
export function art(host, cls = '') {
  const doc = host.ownerDocument;
  const svg = el(doc, 'svg', { class: `sg-check-art ${cls}`.trim(), viewBox: '0 0 20 20', 'aria-hidden': 'true', focusable: 'false' });
  host.native.after(svg);
  return svg;
}

export function mount(host, ctx) {
  const svg = art(host);
  const doc = host.ownerDocument;
  const box = el(doc, 'path', { class: 'sg-check-box' });
  const tick = el(doc, 'path', { class: 'sg-check-mark' });
  const dash = el(doc, 'path', { class: 'sg-check-mark' });
  svg.append(box, tick, dash);
  let seed = null, was = null, anim = null;

  return {
    update(s) {
      if (s.seed !== seed) {
        seed = s.seed;
        const wobble = 0.55;
        box.setAttribute('d', sketchBox(seed, { wobble: 0.4 }).d);
        const t = pencilTick(seed, wobble);
        tick.setAttribute('d', t.d);
        tick.style.strokeDasharray = t.length;
        dash.setAttribute('d', pencilDash(seed, wobble).d);
      }
      tick.style.display = s.checked && !s.indeterminate ? '' : 'none';
      dash.style.display = s.indeterminate ? '' : 'none';
      // Draw the tick in only when it has just been checked, never on first paint.
      const a = was === false && s.checked && !s.indeterminate && arrival(ctx.motion, 'draw');
      if (a) {
        anim?.cancel();
        const len = tick.style.strokeDasharray;
        anim = tick.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], a.timing);
        anim.finished.then(x => x.cancel(), () => {});
      }
      was = s.checked;
    },
    destroy() { anim?.cancel(); svg.remove(); },
  };
}
