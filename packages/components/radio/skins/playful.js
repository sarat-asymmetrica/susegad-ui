// Playful: every radio is an inked circle; the chosen one blooms into a kolam
// flower that fills the circle, four round petal loops drawn round the pulli,
// turning into place as it opens.

import { handRing, KOLAM, arrival } from '../radio.core.js';
import { arts, svgEl } from './warm.js';

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  let changes = null;
  const set = arts(host, (svg, r) => {
    const ring = svgEl(doc, 'path', { class: 'sg-radio-ring', d: handRing(`${r.seed}:ring`, { r: 7.6, wobble: 0.3, overlap: 0.05 }).d });
    const kolam = svgEl(doc, 'g', { class: 'sg-radio-kolam' });
    for (const d of KOLAM.petals) kolam.append(svgEl(doc, 'path', { d }));
    kolam.append(svgEl(doc, 'circle', { cx: KOLAM.dot.cx, cy: KOLAM.dot.cy, r: KOLAM.dot.r }));
    svg.append(ring, kolam);
    return { kolam, ring, was: r.checked };
  });

  return {
    update(s) {
      const moved = changes !== null && s.changes !== changes;
      changes = s.changes;
      set.each(s.radios, (a, r) => {
        a.kolam.style.display = r.checked ? '' : 'none';
        a.ring.style.display = r.checked ? 'none' : ''; // the flower takes the circle's place
        const tm = moved && r.checked && !a.was && arrival(ctx.motion, 'bloom');
        if (tm) {
          a.anim?.cancel();
          a.anim = a.kolam.animate(tm.frames, tm.timing);
          a.anim.finished.then(x => x.cancel(), () => {});
        }
        a.was = r.checked;
      });
    },
    destroy() { set.destroy(); },
  };
}
