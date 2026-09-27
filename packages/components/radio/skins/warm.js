// Warm: every radio gets a pencil circle whose ends cross; the chosen one gets
// an ink dot and is circled in ink the way a pen circles an answer on a paper
// form: a leaning oval a quarter bigger than the radio, carried past its start
// so the overlap shows. When the choice moves, the new ring is drawn in.

import { handRing, inkDot, arrival } from '../radio.core.js';

export const NS = 'http://www.w3.org/2000/svg';
export const svgEl = (doc, name, attrs = {}) => {
  const n = doc.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/** One aria-hidden drawing per radio, placed straight after it; reused across updates. */
export function arts(host, build) {
  const made = new Map();
  return {
    each(radios, fn) {
      for (const r of radios) {
        let a = made.get(r.input);
        if (!a || !a.svg.isConnected) {
          const svg = svgEl(host.ownerDocument, 'svg', { class: 'sg-radio-art', viewBox: '0 0 20 20', 'aria-hidden': 'true', focusable: 'false' });
          a = { svg, ...build(svg, r) };
          r.input.after(svg);
          made.set(r.input, a);
        }
        fn(a, r);
      }
    },
    destroy() { for (const a of made.values()) { a.anim?.cancel(); a.svg.remove(); } made.clear(); },
  };
}

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  let changes = null;
  const set = arts(host, (svg, r) => {
    const pencil = svgEl(doc, 'path', { class: 'sg-radio-pencil', d: handRing(`${r.seed}:pencil`, { r: 7.4, wobble: 0.35, overlap: 0.12, spread: 0.6 }).d });
    // the pen circles the answer: a leaning oval a quarter bigger than the radio, carried well past its start
    const ring = handRing(`${r.seed}:ink`, { r: 10.4, wobble: 0.5, overlap: 0.3, spread: 1.5, squash: 0.8, tilt: -14 });
    const ink = svgEl(doc, 'path', { class: 'sg-radio-ink', d: ring.d });
    ink.style.strokeDasharray = ring.length;
    const dot = svgEl(doc, 'path', { class: 'sg-radio-dot', d: inkDot(r.seed) });
    svg.append(pencil, ink, dot);
    return { ink, dot, length: ring.length, was: r.checked };
  });

  return {
    update(s) {
      const moved = changes !== null && s.changes !== changes;
      changes = s.changes;
      set.each(s.radios, (a, r) => {
        a.ink.style.display = a.dot.style.display = r.checked ? '' : 'none';
        const tm = moved && r.checked && !a.was && arrival(ctx.motion, 'ring');
        if (tm) {
          a.anim?.cancel();
          a.anim = a.ink.animate([{ strokeDashoffset: a.length }, { strokeDashoffset: 0 }], tm.timing);
          a.anim.finished.then(x => x.cancel(), () => {});
        }
        a.was = r.checked;
      });
    },
    destroy() { set.destroy(); },
  };
}
