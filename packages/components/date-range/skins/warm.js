// Warm: your arrival and departure looped in pool-blue ink, the nights between
// underlined, and the season ribbon above the calendar.
import { drawnCalendar } from './drawing.js';

export const mount = drawnCalendar({ color: '--sg-pool', fallback: '#1F7488', width: 1.9, jitter: 0.55, grow: 0.07, ms: 520 });
