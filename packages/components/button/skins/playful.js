// Playful: a stamped chip that presses in on :active (button.css handles
// that with a plain CSS transform) and, on release, an ink ring blooms from
// the point of contact and fades. Ported from the stamp's landing().spread.
// The ring plays once per press; under reduced motion (ctx.motion "still")
// or quiet-like "state" motion it does not play, and the press transform
// alone is the feedback.

import { inkSpread } from '../button.core.js';

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const ink = doc.createElement('span');
  ink.className = 'sg-button-ink';
  ink.setAttribute('aria-hidden', 'true');
  host.prepend(ink);

  const onPointerDown = e => {
    const spread = inkSpread(ctx.motion);
    if (!spread) return;
    const r = host.getBoundingClientRect();
    ink.style.left = `${((e.clientX ?? r.left + r.width / 2) - r.left - r.width / 2)}px`;
    ink.animate(spread.frames, spread.timing);
  };
  host.addEventListener('pointerdown', onPointerDown);

  return {
    update() {},
    destroy() { host.removeEventListener('pointerdown', onPointerDown); ink.remove(); },
  };
}
