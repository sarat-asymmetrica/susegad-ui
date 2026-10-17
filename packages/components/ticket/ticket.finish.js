// The finishing moment of a registration: the smallest honest version, kept apart so that a shared
// success moment (payment and confirmation, later) can take its place without touching the ticket.
//
// What happens, once, when a ticket is first made: the card settles into place (a short spring in playful,
// a plain fade in warm, nothing in quiet or under reduced motion); a soft confirming sound if the sound
// switch is on (never on load, only after this press); one sentence is said aloud, the closing line and
// the id a character at a time; and focus moves to the ticket's heading, so a keyboard or a screen reader
// is where the news is. A ticket that is only being shown again (a second visit, offline) does none of it.

import { announce } from '../../core/announce.js';
import { cue } from '../../sound/index.js';

/**
 * @param {HTMLElement} card the ticket's card
 * @param {{ say: string, motion?: string, register?: string, focus?: HTMLElement|null, from?: Element }} o
 *   say: the sentence for a screen reader; motion: 'still' | 'state' | 'ambient' | 'full' (the component's own)
 * @returns {Promise<void>} resolves when the settle has finished
 */
export async function finish(card, { say, motion = 'state', register = 'warm', focus = null, from } = {}) {
  announce(say, { from });
  cue('confirm', { register });
  focus?.focus?.({ preventScroll: false });
  if (motion === 'still' || motion === 'state' || !card?.animate) return;
  const frames = register === 'playful'
    ? [{ scale: 1.03, opacity: 0.3 }, { scale: 0.99, opacity: 1, offset: 0.55 }, { scale: 1, opacity: 1 }]
    : [{ opacity: 0.2 }, { opacity: 1 }];
  await card.animate(frames, { duration: register === 'playful' ? 360 : 240, easing: register === 'playful' ? 'cubic-bezier(0.34, 1.4, 0.64, 1)' : 'ease-out' }).finished.catch(() => {});
}
