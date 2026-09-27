// Playful: the same carved block, tilted further, inked a little heavier, with
// a block-print diamond on each side.
// When it is stamped it comes down, presses past flat and settles, and the
// ink spreads into the paper around it. Reduced motion shows the settled stamp.

import { inked } from './warm.js';

export const mount = (host, ctx) => inked(host, ctx, { register: 'playful', amount: 1.25, spread: true, motif: true });
