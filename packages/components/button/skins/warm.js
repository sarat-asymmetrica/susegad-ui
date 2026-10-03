// Warm: a hand-drawn outline behind the label, in ink. Its wobble is fixed
// per seed (button.core.js's boilOutline); the "boil" itself is a CSS
// animation that only runs while the button is hovered or focused, so
// nothing moves until the person's attention is on it.

import { boilOutline } from '../button.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host) {
  const doc = host.ownerDocument;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-button-boil');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'none');
  const path = doc.createElementNS(NS, 'path');
  svg.append(path);
  host.prepend(svg);

  let drawnFor = '';
  const draw = seed => {
    const r = host.getBoundingClientRect();
    const w = Math.max(1, r.width + 6), h = Math.max(1, r.height + 6);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    path.setAttribute('d', boilOutline(w, h, seed));
    drawnFor = seed;
  };

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw(drawnFor)) : null;
  ro?.observe(host);

  return {
    update(s) { if (s.seed !== drawnFor) draw(s.seed); },
    destroy() { ro?.disconnect(); svg.remove(); },
  };
}
