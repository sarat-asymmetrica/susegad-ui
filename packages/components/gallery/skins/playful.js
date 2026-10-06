// Playful: the same hand-drawn corners as warm, and the slots lean like
// photographs laid on a table, each its own seeded half-degree, set once and
// still. Under reduced motion the CSS never applies the lean.
import { mount as warm } from './warm.js';
import { tilt } from '../gallery.core.js';

export function mount(host, ctx) {
  const inner = warm(host, ctx);
  return {
    update(state) {
      inner.update(state);
      const seed = state.seed ?? 'gallery';
      let i = 0;
      for (const slot of host.slots) {
        slot.style.setProperty('--sg-gallery-tilt', `${tilt(`${seed}:${i++}`).toFixed(2)}deg`);
      }
    },
    destroy() {
      inner.destroy();
      for (const slot of host.slots) slot.style.removeProperty('--sg-gallery-tilt');
    },
  };
}
