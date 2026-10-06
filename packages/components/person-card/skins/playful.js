// Playful: person-card.css colours the disc and tilts the card; this skin
// writes the seeded angle and hue as custom properties once. The card leans a
// little when the pointer or the focus arrives, with the spring ease, and
// settles back. Under reduced motion nothing moves.
import { hueOf, tiltOf } from '../person.core.js';

export function mount(host, ctx) {
  let seed = 'person';
  const set = s => {
    seed = s;
    host.style.setProperty('--sg-person-tilt', `${tiltOf(seed)}deg`);
    host.style.setProperty('--sg-person-hue', `${hueOf(seed)}`);
  };
  return {
    update(state) {
      host.dataset.motion = ctx.motion;
      if (state.seed !== seed) set(state.seed);
    },
    destroy() {
      host.style.removeProperty('--sg-person-tilt');
      host.style.removeProperty('--sg-person-hue');
    },
  };
}
