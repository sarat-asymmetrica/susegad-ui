// Playful: a chip filled with the tone (badge.css) and a tiny kolam flower on
// its corner, like a sticker. When busy, the flower turns; it stops off screen
// and under reduced motion.

import { MOTIF, busyMotion } from '../badge.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-badge-motif');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of MOTIF.petals) {
    const p = doc.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  const c = doc.createElementNS(NS, 'circle');
  c.setAttribute('cx', MOTIF.centre[0]); c.setAttribute('cy', MOTIF.centre[1]); c.setAttribute('r', '1.3');
  c.setAttribute('class', 'sg-badge-motif-eye');
  svg.append(c);
  host.append(svg);
  let anim = null;

  return {
    update(s) {
      const m = s.busy && busyMotion(ctx.motion);
      if (m && !anim) anim = svg.animate(m.frames, m.timing);
      if (!m && anim) { anim.cancel(); anim = null; }
      if (anim) s.visible ? anim.play() : anim.pause();
    },
    destroy() { anim?.cancel(); svg.remove(); },
  };
}
