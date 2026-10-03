// Dialog, playful skin: the same Carepa scrim as warm, brighter and catching
// more of the shells (surfaces/carepa's own register step), plus a small
// press on the card when it lands, cancelled at once under reduced motion.

import { mount as mountCarepa } from '../../../surfaces/carepa/index.js';

export function mount(el, ctx) {
  let carepa = null;
  let pressed = false;

  function sync(state) {
    if (state.open && !carepa && state.scrim) {
      carepa = mountCarepa(state.scrim, {
        seed: el.id || 1,
        register: 'playful',
        reducedMotion: ctx.motion === 'still',
      });
    } else if (!state.open && carepa) {
      carepa.destroy();
      carepa = null;
      pressed = false;
    }
    if (state.open && !pressed && state.card && ctx.motion !== 'still') {
      pressed = true;
      state.card.animate(
        [{ transform: 'scale(0.97)', opacity: 0.7 }, { transform: 'scale(1.01)', opacity: 1 }, { transform: 'scale(1)' }],
        { duration: 260, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)' },
      );
    }
  }

  return {
    update(state) { sync(state); },
    destroy() { carepa?.destroy(); carepa = null; },
  };
}
