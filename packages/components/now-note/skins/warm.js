// Warm: a sticky note in the hand, stuck on at a small seeded lean with a
// strip of tape (now-note.css). The lean is set once; nothing moves.
import { lean } from '../now-note.core.js';

export function mount(host) {
  let seed = null;
  return {
    update(s) { if (s.seed !== seed) { seed = s.seed; host.style.setProperty('--sg-now-lean', `${lean(seed)}deg`); } },
    destroy() { host.style.removeProperty('--sg-now-lean'); },
  };
}
