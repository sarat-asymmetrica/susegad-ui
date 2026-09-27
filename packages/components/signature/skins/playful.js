// Playful: the warm ink, and once the pen has rested a moment, a flourish:
// a swash underlines the signature and ends in a small loop. The flourish is
// decoration only; it is never part of the signature that is submitted.

import { painter } from './paint.js';

export const mount = (host, ctx) => painter(host, ctx, { grain: 0.55, dry: true, line: 'pencil', flourish: true });
