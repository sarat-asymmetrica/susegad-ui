// Playful: colour and delight. The CSS does the colouring (a tinted zebra, a
// hand-lettered sort arrow); this skin reuses warm's hand-drawn header rule so
// the table keeps its drawn edge, and the sorted column gets a drawn underline
// along its foot, moved to whichever column is sorted. Still under reduced motion.
import { mount as warm } from './warm.js';

export const mount = (host, ctx) => {
  const skin = warm(host, ctx);
  return {
    update(s) { skin.update(s); host.dataset.sortedCol = s?.column ?? ''; },
    destroy() { skin.destroy(); delete host.dataset.sortedCol; },
  };
};
