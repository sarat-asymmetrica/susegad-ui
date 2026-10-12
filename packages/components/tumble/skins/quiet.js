// Quiet: nothing moves. The heading is the heading; play() has nothing to do.
import { mountTumble } from './layer.js';

export const mount = (host, ctx) => mountTumble(host, ctx, { look: 'quiet' });
