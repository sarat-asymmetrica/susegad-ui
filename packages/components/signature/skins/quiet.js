// Quiet: a plain signing line and the ink as it lands, flat and dry at once.
// Nothing moves that the pen did not move.

import { painter } from './paint.js';

export const mount = (host, ctx) => painter(host, ctx, { grain: 0, dry: false, line: 'plain', flourish: false });
