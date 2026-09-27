// Quiet: flat sunk blocks. No shimmer, no outline; the content replaces them
// with a fade under 200ms, or at once under reduced motion.

import { layout } from '../skeleton.core.js';
import { deco, finish } from './draw.js';

export function mount(el, ctx) {
  const d = deco(el);
  let last = null;
  const draw = s => {
    const L = layout(s.shape, { lines: s.lines, width: d.width, seed: s.seed });
    d.node.style.height = `${L.height}px`;
    d.node.replaceChildren(...L.blocks.map(b => {
      const n = document.createElement('i');
      n.className = 'sg-skeleton-block';
      n.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;border-radius:${b.kind === 'circle' ? '50%' : `${Math.min(b.r, 4)}px`}`;
      return n;
    }));
  };
  d.onresize(() => last?.busy && draw(last));
  return {
    update(s) {
      const was = last;
      last = s;
      if (s.busy) { d.node.removeAttribute('hidden'); draw(s); return; }
      if (d.node.hasAttribute('hidden')) return;
      if (was?.busy && ctx.motion !== 'still') {
        el.setAttribute('data-arriving', '');
        d.node.classList.add('sg-leaving');
        d.node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }).finished.then(() => finish(el, d), () => {});
      } else finish(el, d);
    },
    // drawn with CSS custom properties (and the scene repaints itself), so a theme change needs nothing
    restyle() {},
    destroy() { d.destroy(); },
  };
}
