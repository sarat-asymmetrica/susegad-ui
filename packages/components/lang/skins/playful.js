// Playful: stamped tabs. lang.css draws each language as a small double-ruled
// tab; this skin sets each at its own slight angle, as if stamped by hand, and
// inks the current one. Still.
import { tabTilt } from '../lang.core.js';

export function mount(host) {
  let key = '';
  return {
    update(s) {
      if (s.tags.join() === key) return;
      key = s.tags.join();
      host.links.forEach((a, i) => a.style.setProperty('--sg-lang-tilt', `${tabTilt(a.getAttribute('hreflang'), i)}deg`));
    },
    destroy() { host.links.forEach(a => a.style.removeProperty('--sg-lang-tilt')); },
  };
}
