// Playful: stamped tabs. site-nav.css draws each link as a small double-ruled
// tab; this skin sets each one down at its own slight angle, as if stamped by
// hand. The current page is inked solid. Still.
import { tabTilt } from '../site-nav.core.js';

export function mount(host) {
  let n = -1;
  return {
    update(s) {
      if (s.links === n) return;
      n = s.links;
      host.links.forEach((a, i) => a.style.setProperty('--sg-nav-tilt', `${tabTilt(a.textContent.trim(), i)}deg`));
    },
    destroy() { host.links.forEach(a => a.style.removeProperty('--sg-nav-tilt')); },
  };
}
