// Quiet: a cobalt hairline on the page, flat. The tiles are drawn as line art, once, and nothing moves.
import { mountBand } from './band.js';

export const mount = (host, ctx) => mountBand(host, ctx, { look: 'line', turns: false });
