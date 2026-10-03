// Playful: the same ticket as warm. event-card.css does the tearing: the stub
// lifts at its free corner on hover or focus and settles there, with the spring
// ease, once and not again. Under reduced motion nothing moves.
import { mount as ticket } from './warm.js';

export const mount = (host, ctx) => ticket(host, ctx);
