// Playful: warm, a bolder line, and a wiggle when the pointer passes over a doodle or a finger taps it.
import { mountDoodle } from './draw.js';

export const mount = (host, ctx) => mountDoodle(host, ctx, { look: 'playful' });
