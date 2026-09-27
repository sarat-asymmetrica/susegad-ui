// Playful: a caret in accent ink with a thick, round nib, a stamped box
// (combobox.css), suggestions as stamped chips, and a choice lands on the input
// with a small press.
import { caret } from './caret.js';

export function mount(host, ctx) {
  const svg = caret(host, 'M2 2.2 8 7.8l6-5.6', '3.2');
  svg.style.color = 'var(--sg-accent-text, currentColor)';
  let seen = null;
  return {
    update(s) {
      if (seen !== null && s.changed !== seen && ctx.motion === 'full' && ctx.visible) {
        ctx.native?.animate([{ scale: 1 }, { scale: 0.97, offset: 0.35 }, { scale: 1.015, offset: 0.7 }, { scale: 1 }], { duration: 260, easing: 'ease-out' });
      }
      seen = s.changed;
    },
    destroy() { svg.remove(); },
  };
}
