// Warm: a hand-painted glaze, once. White tiles, cobalt brushwork with a bleed under each stroke, pooled
// edges, a sheen, a bevel and a crackle. Still.
import { mountBand } from './band.js';

export const mount = (host, ctx) => mountBand(host, ctx, { look: 'glaze', turns: false });
