// Quiet: the ruled rectangle from stamp.css, square and plain. The only motion
// is the fade state requires when the stamp lands (under 200ms), and none
// under reduced motion.

import { landing } from '../stamp.core.js';

export function mount(host, ctx) {
  let seen = 0, anim = null;
  return {
    update(s) {
      if (s.landings === seen) return;
      seen = s.landings;
      const l = !s.pending && landing(ctx.motion);
      if (!l) return;
      anim?.cancel();
      anim = host.animate(l.frames, l.timing);
      anim.finished.then(a => a.cancel(), () => {});
    },
    destroy() { anim?.cancel(); },
  };
}
