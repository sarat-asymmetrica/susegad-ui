// Warm: a marker line that draws itself once as it scrolls into view, then boils a little, like a hand-drawn film.
import { mountDoodle } from './draw.js';

export const mount = (host, ctx) => mountDoodle(host, ctx, { look: 'warm' });
