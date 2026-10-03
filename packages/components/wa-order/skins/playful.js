// Playful: when the Send link is pressed with a complete order, the line that
// says "Your order is written" stamps in: one short drop and settle. One shot,
// never a loop; under reduced motion (or any other register) nothing moves.
import { stampIn } from '../wa-order.core.js';

export function mount(host, ctx) {
  let seen = null, anim = null;
  return {
    update(s) {
      if (seen === null) { seen = s.sent; return; } // the first draw is not news
      if (s.sent === seen) return;
      seen = s.sent;
      const m = stampIn(ctx.motion);
      const el = host.querySelector('.sg-wa-written');
      if (!m || !el) return;
      anim?.cancel();
      anim = el.animate(m.keyframes, m.options);
      anim.onfinish = () => { anim = null; };
    },
    destroy() { anim?.cancel(); },
  };
}
