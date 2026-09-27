// Playful: the same in laterite ink, a bolder, looser hand, and a loop that
// overshoots a little as it closes.
import { drawnCalendar } from './drawing.js';

export const mount = drawnCalendar({ color: '--sg-laterite', fallback: '#A4452C', width: 2.6, jitter: 0.9, grow: 0.12, ms: 640, overshoot: true });
