// Playful: a bolder pen, an offset shadow, a small tilt, a torn edge on a shout,
// and a pop out of the tail's tip the first time it is on screen.
import { mountBody } from './body.js';

export const mount = (host, ctx) => mountBody(host, ctx, { register: 'playful', wobble: () => 1, edge: k => (k === 'shout' ? 'torn' : 'clean'), shadow: true, tilt: 1.2 });
