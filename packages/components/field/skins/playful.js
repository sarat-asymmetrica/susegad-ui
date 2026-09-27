// Field, playful skin: the warm drawing in the accent ink with a thicker nib
// (the rule, the focus ink, and a double margin down a textarea), plus a little
// wobble on twos: while someone is typing, the line's drift is re-rolled
// twelve times a second, like a hand-drawn line in animation. It settles the
// moment they stop, and never moves under reduced motion.

import { boilPhase } from '../field.core.js';
import { inkLayer } from './warm.js';

const LOOK = { weight: 2.8, drift: 1.1, pencil: 2.2, nib: 3, margins: 2, graphite: false };
const SETTLE_MS = 600;

export function mount(el, ctx) {
  const ink = inkLayer(el, ctx);
  let raf = 0;
  const frame = () => {
    raf = 0;
    const s = el.state();
    const typing = performance.now() - s.typedAt < SETTLE_MS;
    const moving = typing && ctx.motion === 'full' && ctx.visible;
    ink.draw(s, { ...LOOK, phase: moving ? boilPhase(performance.now()) : 0 });
    if (moving) raf = requestAnimationFrame(frame);
    else if (typing) setTimeout(() => ink.draw(el.state(), LOOK), SETTLE_MS);
  };
  return {
    update() { if (!raf) frame(); },
    restyle() { ink.draw(el.state(), LOOK); },
    destroy() { cancelAnimationFrame(raf); ink.destroy(); },
  };
}
