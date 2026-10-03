// Playful: a postcard set down a little crooked. Where the pointer can hover
// and motion is full, its picture face flips over to the back (the details)
// on hover or when its link has focus; postcard.css does the turn with
// transform only. On a touch screen, under reduced motion or with no
// JavaScript, both faces lie flat, one above the other.
import { tilt, canFlip } from '../postcard.core.js';

export function mount(host, ctx) {
  const mq = host.ownerDocument.defaultView.matchMedia?.('(hover: hover) and (pointer: fine)');
  const apply = () => { host.toggleAttribute('data-flip', canFlip({ motion: ctx.motion, hover: !!mq?.matches })); };
  mq?.addEventListener?.('change', apply);
  let seed = null;
  return {
    update(s) {
      if (s.seed !== seed) { seed = s.seed; host.style.setProperty('--sg-postcard-tilt', `${tilt(seed)}deg`); }
      apply();
    },
    destroy() {
      mq?.removeEventListener?.('change', apply);
      host.removeAttribute('data-flip');
      host.style.removeProperty('--sg-postcard-tilt');
    },
  };
}
