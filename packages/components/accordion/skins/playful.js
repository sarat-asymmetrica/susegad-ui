// Playful: the marker is a drawn glyph that flips, with a spring on open. The
// flip and the spring are CSS; this skin gives every item's glyph its own small
// seeded tilt, so a list of them leans like hand-set type and never the same
// way twice. Reduced motion keeps every glyph square-on. Still at rest.
import { rng } from '../../../engine/src/rng.js';

export function mount(host, ctx) {
  const seed = 'accordion';
  host.dataset.motion = ctx.motion;
  const tilts = new Map();
  function lay(items) {
    host.dataset.motion = ctx.motion;
    for (const [i, d] of (host.details ?? []).entries()) {
      if (!tilts.has(i)) {
        const r = rng(`${seed}:${i}:${items?.seed ?? ''}`);
        tilts.set(i, `${((r.chance(0.5) ? 1 : -1) * r.range(2, 7)).toFixed(1)}deg`);
      }
      d.style.setProperty('--sg-acc-tilt', tilts.get(i));
    }
  }
  return {
    update(state) { lay(state); },
    destroy() {
      for (const d of host.details ?? []) d.style.removeProperty('--sg-acc-tilt');
      tilts.clear(); delete host.dataset.motion;
    },
  };
}
