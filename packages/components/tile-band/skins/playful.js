// Playful: the warm glaze, and a tile turns a quarter when the pointer passes over it or a finger taps it,
// swings a little past and settles. A half second of frames for the turn, none otherwise.
import { mountBand } from './band.js';

export const mount = (host, ctx) => mountBand(host, ctx, { look: 'glaze', turns: true });
