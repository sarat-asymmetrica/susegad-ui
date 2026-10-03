// Playful: the underline as a kolam line, one continuous wave with a small
// knotted loop, always drawn (a link's affordance should not hide until
// hovered here; the wave itself is the delight).

import { kolamUnderline } from '../link.core.js';

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
    svg.setAttribute('viewBox', `0 0 ${w} 10`);
    path.setAttribute('d', kolamUnderline(w, seed));
    drawnFor = seed;
  };

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw(drawnFor)) : null;
  ro?.observe(host);

  return {
    update(s) { if (s.seed !== drawnFor) draw(s.seed); },
    destroy() { ro?.disconnect(); svg.remove(); },
  };
}
