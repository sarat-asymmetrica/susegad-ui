// Warm: a hand-inked bubble, the words laid into its real shape. The work is
// shared with playful in body.js.
import { mountBody } from './body.js';

export const mount = (host, ctx) => mountBody(host, ctx, { register: 'warm', wobble: () => 0.6, edge: () => 'clean', shadow: false, tilt: 0 });
