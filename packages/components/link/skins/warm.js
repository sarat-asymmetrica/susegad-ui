// Warm: an ink underline drawn on hover and focus. The path is fixed per
// seed (link.core.js's inkUnderline); a stroke-dasharray trick, set here and
// transitioned in link.css, makes it look drawn in as the pointer arrives
// and drawn back out as it leaves, so nothing moves until then.

import { inkUnderline } from '../link.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host) {
  const doc = host.ownerDocument;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-link-ink');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'none');
  const path = doc.createElementNS(NS, 'path');
  svg.append(path);
  host.append(svg);

  let drawnFor = '';
  const draw = seed => {
    const w = Math.max(1, host.getBoundingClientRect().width);
    svg.setAttribute('viewBox', `0 0 ${w} 6`);
    path.setAttribute('d', inkUnderline(w, seed));
    const len = path.getTotalLength();
    // Setting stroke-dashoffset for the first time would otherwise transition
    // from its unset default (0, fully drawn) to `len` (undrawn): a false
    // "draw out" nobody asked for. Set both with the transition off, force
    // layout, then hand the transition back for the real hover/focus draw.
    path.style.transition = 'none';
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    path.getBoundingClientRect();
    path.style.transition = '';
    drawnFor = seed;
  };

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw(drawnFor)) : null;
  ro?.observe(host);

  return {
    update(s) { if (s.seed !== drawnFor) draw(s.seed); },
    destroy() { ro?.disconnect(); svg.remove(); },
  };
}
