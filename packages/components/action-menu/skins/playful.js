// Playful: a stamped list. action-menu.css draws the bolder frame and the dashed
// hover/focus outline; this skin adds the theatre a "stamped" list needs
// to actually read as stamped (Rasika's S2, Wave 5): as the list opens,
// each item lands with a small ink impression behind it, timed to its own
// teental beat (action-menu.js's own `--sg-item-delay`, read back here rather
// than recomputed, so the stamp and the entrance are always in step).
//
// The impression is a purely decorative, aria-hidden layer behind the
// item's own text (action-menu.css's z-index: -1 within the item's own stacking
// context). It never gates or delays input: action-menu.js already moves real
// focus to the first or last item synchronously when the menu opens,
// before this animation has even started, let alone finished. Under
// reduced motion, stampLanding() returns null and nothing plays; the list
// still opens, still focuses, just without the impression.

import { stampLanding } from '../action-menu.core.js';

function ensureStamp(item) {
  let stamp = item.querySelector('.sg-action-menu-item-stamp');
  if (!stamp) {
    stamp = item.ownerDocument.createElement('span');
    stamp.className = 'sg-action-menu-item-stamp';
    stamp.setAttribute('aria-hidden', 'true');
    item.prepend(stamp);
  }
  return stamp;
}

export function mount(host, ctx) {
  let wasOpen = false;
  const anims = [];

  function land() {
    anims.splice(0).forEach(a => a.cancel());
    const landing = stampLanding(ctx.motion);
    if (!landing) return; // reduced motion, or quiet-equivalent state motion
    for (const item of ctx.native.querySelectorAll('[role="menuitem"]')) {
      const stamp = ensureStamp(item);
      const delay = parseFloat(item.style.getPropertyValue('--sg-item-delay')) || 0;
      anims.push(stamp.animate(landing.frames, { ...landing.timing, delay }));
    }
  }

  return {
    update(s) {
      if (s.open && !wasOpen) land();
      wasOpen = s.open;
    },
    destroy() { anims.splice(0).forEach(a => a.cancel()); },
  };
}
