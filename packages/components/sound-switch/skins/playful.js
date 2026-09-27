// Playful: the same speaker, but while it is on and on screen the arcs
// breathe, from seeded noise so two switches on a page never pulse in step.
// In quiet motion, under reduced motion, off, or off screen they hold still.

import { waveAnimation } from '../sound-switch.core.js';
import { art, svgEl } from './warm.js';
import { SPEAKER } from '../sound-switch.core.js';

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const svg = art(host, '0 0 28 24');
  const arcs = svgEl(doc, 'g', { class: 'sg-sound-switch-arcs' });
  for (const [i, d] of SPEAKER.arcs.entries()) arcs.append(svgEl(doc, 'path', { class: `sg-sound-switch-arc sg-sound-switch-arc-${i}`, d }));
  svg.append(
    svgEl(doc, 'path', { class: 'sg-sound-switch-body', d: SPEAKER.body }),
    arcs,
    svgEl(doc, 'path', { class: 'sg-sound-switch-slash', d: SPEAKER.slash }),
  );
  let anim = null, key = '';
  const seed = host.getAttribute('seed') || host.id || 'sound-switch';

  return {
    update(s) {
      svg.toggleAttribute('data-on', s.on);
      const want = waveAnimation(s.motion, s.on, seed);
      const k = want ? `${seed}|${s.motion}` : '';
      if (k !== key) { anim?.cancel(); anim = want ? arcs.animate(want.frames, want.timing) : null; key = k; }
      if (anim) s.visible ? anim.play() : anim.pause();
    },
    destroy() { anim?.cancel(); svg.remove(); },
  };
}
