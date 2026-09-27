// Warm: a walk through the steps on a drawn map. Faint pencil contours for the
// hills, the road found round them in pencil, and the part you have walked
// inked in. Moving on inks the next leg; stepping back lifts it.

import { mountMap } from './map.js';

export const mount = (host, ctx) => mountMap(host, ctx);
