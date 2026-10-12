// Dialog, playful skin: the same Carepa scrim as warm, brighter and catching
// more of the shells (surfaces/carepa's own register step). The card's small
// give as it lands is CSS (dialog.css, @starting-style on the spring).

import { mount as mountCarepa } from '../../../surfaces/carepa/index.js';

export function mount(el, ctx) {
  let carepa = null;

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
    }
  }

  return {
    update(state) { sync(state); },
    destroy() { carepa?.destroy(); carepa = null; },
  };
}
