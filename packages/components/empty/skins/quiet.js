// Quiet: a small hairline drawing beside the words. It never moves.

import { illustration } from '../empty.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(el) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-empty-art');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const lines = document.createElementNS(NS, 'path'), marks = document.createElementNS(NS, 'path');
  lines.setAttribute('class', 'sg-empty-lines');
  marks.setAttribute('class', 'sg-empty-marks');
  svg.append(lines, marks);
  el.prepend(svg);
  let name = null;
  return {
    update(s) {
      if (s.scene === name) return;
      name = s.scene;
      const art = illustration(name);
      svg.setAttribute('viewBox', art.viewBox);
      lines.setAttribute('d', art.lines);
      marks.setAttribute('d', art.marks);
    },
    // drawn with CSS custom properties (and the scene repaints itself), so a theme change needs nothing
    restyle() {},
    destroy() { svg.remove(); },
  };
}
