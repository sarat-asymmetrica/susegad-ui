// Dialog, warm skin: the Carepa scrim behind a floating card (dialog.css
// makes the native <dialog> full-bleed and centres .sg-dialog-card over
// .sg-dialog-scrim). Mounted only while the dialog is open, so nothing runs
// behind a closed dialog.

import { mount as mountCarepa } from '../../../surfaces/carepa/index.js';

export function mount(el, ctx) {
  let carepa = null;

  function sync(state) {
    if (state.open && !carepa && state.scrim) {
      carepa = mountCarepa(state.scrim, {
        seed: el.id || 1,
        register: ctx.register,
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
