// Warm: hand-drawn photo corners on every consent-pending frame, drawn in an
// aria-hidden SVG from the gallery's seed, each frame a touch different, as a
// photo would be mounted with real corners. It redraws when the gallery changes
// size and at no other time. Still.
import { photoCorner } from '../gallery.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host, ctx) {
  const doc = host.ownerDocument;

  function draw() {
    const seed = host.getAttribute('seed') || 'gallery';
    for (const slot of host.pending) {
      const svg = slot.querySelector('.sg-gallery-frame');
      if (!svg) continue;
      const w = Math.max(slot.clientWidth, 40), h = Math.max(slot.clientHeight, 40);
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.replaceChildren(...['tl', 'tr', 'br', 'bl'].map(corner => {
        const p = doc.createElementNS(NS, 'path');
        p.setAttribute('d', photoCorner({ w, h, corner, seed: `${seed}:${slot.dataset.index ?? ''}` }));
        return p;
      }));
    }
  }

  const ro = new ResizeObserver(draw);
  ro.observe(host);
  return {
    update() {
      host.dataset.motion = ctx.motion;
      draw();
    },
    destroy() {
      ro.disconnect();
      for (const slot of host.pending) slot.querySelector('.sg-gallery-frame')?.replaceChildren();
      host.removeAttribute('data-motion');
    },
  };
}
