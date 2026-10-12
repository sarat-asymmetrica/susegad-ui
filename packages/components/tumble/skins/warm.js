// Warm: lines slide in, alternately from the left and the right, a little past and settled.
import { mountTumble } from './layer.js';

export const mount = (host, ctx) => mountTumble(host, ctx, { look: 'warm' });
