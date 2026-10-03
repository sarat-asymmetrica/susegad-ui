// Drawer, playful skin: the same Carepa scrim as warm, brighter, and its
// slide timed to land on the Teental cycle's first beat (the brief: "its
// entrance is timed with karigar-motion's talaDelay() from
// packages/tokens/tokens.js" — landed at commit 1e58e89, see
// docs/briefs/progress/karigar-motion.md).

import { mount as mountCarepa } from '../../../surfaces/carepa/index.js';
import { talaDelay } from '../../../tokens/tokens.js';

export function mount(el, ctx) {
  let carepa = null;

  function sync(state) {
    if (state.open && !carepa && state.scrim) {
      // one beat in, not the very first (sam): a small anticipatory pause before the panel moves
      el.style.setProperty('--sg-drawer-delay', `${talaDelay(1)}ms`);
      carepa = mountCarepa(state.scrim, {
        seed: el.id || 1,
        register: 'playful',
        reducedMotion: ctx.motion === 'still',
      });
    } else if (!state.open && carepa) {
      carepa.destroy();
      carepa = null;
    }
  }

  return {
    update(state) { sync(state); },
    destroy() { carepa?.destroy(); carepa = null; },
  };
}
