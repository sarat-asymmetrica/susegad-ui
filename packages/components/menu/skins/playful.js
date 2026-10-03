// Playful: when a dish is added its count settles, one shot: it lifts and
// lands with a slight overshoot. Taking one out is a quieter settle the other
// way. Nothing loops, and under reduced motion (or any other register) nothing
// moves at all: the core hands back null and this does no work.
import { settleMotion } from '../menu.core.js';

export function mount(host, ctx) {
  let seen = null, anim = null;
  return {
    update(s) {
      const n = s.last?.n ?? 0;
      if (seen === null) { seen = n; return; } // the first draw: not news
      if (n === seen) return;
      seen = n;
      const m = settleMotion(ctx.motion, s.last.dir);
      if (!m || !s.last.id) return;
      const el = host.querySelector(`.sg-menu-item[data-id="${CSS.escape(s.last.id)}"] .sg-menu-count`);
      if (!el) return;
      anim?.cancel();
      anim = el.animate(m.keyframes, m.options);
      anim.onfinish = () => { anim = null; };
    },
    destroy() { anim?.cancel(); },
  };
}
