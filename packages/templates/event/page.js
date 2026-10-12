// The event page's script. The page reads with none of this: every session, speaker and
// direction is in the HTML. This adds what only a script can: the components, "now on
// stage" in the agenda, the map links, and a Play button when the picture is held still.

import './susegad/core/lazy.js';
import './susegad/components/lang/lang.js';
import './susegad/components/person-card/person-card.js';
import './susegad/components/site-footer/site-footer.js';
import { mountAgenda } from './susegad/recipes/agenda/recipe.js';
import { mountVenue } from './susegad/recipes/venue/recipe.js';

mountVenue(document.getElementById('venue'));
mountAgenda(document.getElementById('agenda'));

// The picture stays a poster in the quiet register, under reduced motion, with Save-Data and on
// small devices. Anyone may still ask to see it move; the page only offers, and never starts it.
const lazy = document.querySelector('sg-lazy');
const play = document.querySelector('.hero-play');
await customElements.whenDefined('sg-lazy');
const offer = () => { play.hidden = !lazy.holding || lazy.state === 'live' || lazy.state === 'loading'; };
lazy.addEventListener('sg-lazy', offer);
offer();
play.addEventListener('click', () => { play.hidden = true; lazy.start(); });
