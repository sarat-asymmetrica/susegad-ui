// Playful: bright bubbles (chat-thread.css), and each message bounces a little
// as it comes into view, once. Messages are never hidden before they arrive:
// with no JavaScript, reduced motion or quiet motion there is simply no bounce.

import { arrival } from '../chat-thread.core.js';

export function mount(host, ctx) {
  const seen = new WeakSet();
  const anims = new Set();
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    let order = 0;
    for (const e of entries) {
      if (!e.isIntersecting || seen.has(e.target)) continue;
      seen.add(e.target);
      io.unobserve(e.target);
      const a = arrival(ctx.motion, order++, e.target.dataset.from);
      if (!a) continue;
      const anim = e.target.animate(a.frames, a.timing);
      anims.add(anim);
      anim.finished.then(x => { x.cancel(); anims.delete(x); }, () => anims.delete(anim));
    }
  }, { threshold: 0.2 }) : null;

  return {
    update() { for (const li of host.messages) if (!seen.has(li)) io?.observe(li); },
    destroy() { io?.disconnect(); for (const a of anims) a.cancel(); anims.clear(); },
  };
}
