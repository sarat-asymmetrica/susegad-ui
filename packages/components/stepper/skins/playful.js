// Playful: the same map, in the accent colour, with footprints along the road
// you have walked. They are pressed in one after another as you move on.

import { mountMap } from './map.js';

export const mount = (host, ctx) => mountMap(host, ctx, { feet: true, ink: 'var(--sg-accent)' });
