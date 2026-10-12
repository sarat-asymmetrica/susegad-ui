// Playful: letters drop from above with a little spin, bounce once and settle, one after another.
import { mountTumble } from './layer.js';

export const mount = (host, ctx) => mountTumble(host, ctx, { look: 'playful' });
