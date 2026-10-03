// Warm: the message is a slip of ruled paper, and its title is underlined by
// hand, in pencil, with the same ink line the field component draws under its
// words. wa-order.css does the paper; this draws the one rule, once per size.
// Nothing moves.
import { inkPath } from '../../field/field.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host) {
  const doc = host.ownerDocument;
  let svg = null, seed = '', key = '', raf = 0;

  function draw() {
    raf = 0;
    const title = host.querySelector('.sg-wa-title');
    if (!title) return;
    const w = Math.round(title.getBoundingClientRect().width);
    const k = `${seed}|${w}`;
    if (!w || k === key) return;
    key = k;
    if (!svg) {
      svg = doc.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'sg-wa-rule');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      title.after(svg);
    }
    svg.setAttribute('viewBox', `0 0 ${w} 4`);
    svg.replaceChildren();
    const p = doc.createElementNS(NS, 'path');
    p.setAttribute('d', inkPath(w, { seed: `${seed}:rule`, weight: 1.4, drift: 0.9, land: 30, lift: 60 }));
    p.setAttribute('transform', 'translate(0 2)');
    svg.append(p);
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const ro = new ResizeObserver(schedule);
  ro.observe(host);
  return {
    update(s) { if (s.seed !== seed) { seed = s.seed; key = ''; } schedule(); },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); svg?.remove(); },
  };
}
