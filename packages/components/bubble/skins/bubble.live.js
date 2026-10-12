// The bubble's live surface (decision 0029 and its rung 3 ruling): the one file that reaches the type tier's
// lazy door. body.js loads it by import() only at warm or playful with motion on and a plain-text paragraph,
// so quiet, reduced motion and no JavaScript never request the type tier or Pretext.
import { layZones } from '../../../type/operators.js';
import { sizeBubble } from '../bubble.core.js';

/** The smallest bubble that holds `text` (bubble.core.js sizeBubble), laid by Pretext through the door. */
export const laidBubble = (state, text, { family, weight, register }) =>
  sizeBubble((zones, texts) => layZones(zones, texts, { family, weight, scale: 1, register }), state, text);
