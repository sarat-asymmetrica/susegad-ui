// Playful: a stamp per digit. Each box sits at its own small tilt, as if
// stamped by hand along a line, and each digit comes down, presses past flat
// and settles while its ink spreads into the paper. A pasted code lands left
// to right, one stamp after another. Reduced motion shows the stamped row.

import { ink } from './warm.js';

export const mount = (host, ctx) => ink(host, ctx, { register: 'playful', amount: 1.3, spread: true });
