// Playful: the links set down like stamped chips (site-footer.css draws the
// chip); this skin sets each one at its own small seeded angle, and the short
// hover hop is the CSS's, gated on reduced motion. Still at rest.
import { stampTilt } from '../site-footer.core.js';

export function mount(host) {
  let n = -1;
  return {
    update(s) {
      host.dataset.motion = s.motion;
      if (s.links === n) return;
      n = s.links;
      const links = host.native?.querySelectorAll('.sg-site-footer-links a[href]') ?? [];
      links.forEach((a, i) => a.style.setProperty('--sg-footer-tilt', `${stampTilt(s.seed, i)}deg`));
    },
    destroy() {
      host.removeAttribute('data-motion');
      host.native?.querySelectorAll('.sg-site-footer-links a[href]').forEach(a => a.style.removeProperty('--sg-footer-tilt'));
    },
  };
}
