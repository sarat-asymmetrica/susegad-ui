// Quiet: a still hairline drawing. Nothing moves, nothing draws itself.
import { mountDoodle } from './draw.js';

export const mount = (host, ctx) => mountDoodle(host, ctx, { look: 'quiet' });
