// The event page's script. The page reads with none of this: every session, speaker and
// direction is in the HTML. This adds what only a script can: the components, "now on
// stage" in the agenda, the map links, and a Play button when the picture is held still.

import './susegad/core/lazy.js';
import './susegad/components/banner/banner.js';
import './susegad/components/consent/consent.js';
import './susegad/components/ticket/ticket.js';
import { registerOffline } from './susegad/recipes/offline/offline.js';
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

// The registration form. A valid submit never leaves the page: the form says what was entered by sending
// `sg-register` ({ name, email }, bubbling). The answer here makes the ticket on this device, keeps it in
// localStorage, shows it and ends with the finishing moment; nothing goes to a server. To register people for real,
// send { name, email } to your own server in this listener, then make the ticket from what it answers.
const form = document.querySelector('.sg-register-form');
// the Register button is disabled in the HTML (a form with no script would otherwise send the details to the host); script is what makes it work
form?.querySelector('button[type="submit"]')?.removeAttribute('disabled');
const ticket = document.querySelector('sg-ticket');
form?.addEventListener('submit', e => {
  e.preventDefault();
  const data = new FormData(form);
  form.dispatchEvent(new CustomEvent('sg-register', { bubbles: true, detail: { name: String(data.get('name') ?? ''), email: String(data.get('email') ?? '') } }));
});
form?.addEventListener('sg-register', e => {
  form.querySelector('.sg-register-status').textContent = form.dataset.sample;
  ticket?.issue(e.detail.name);
});

// Offline: after the first visit the pages open again with no connection (docs/decisions/0028-offline-cache.md).
// The worker, sw.js, is written by pages.mjs; the scope is the folder this script is in.
registerOffline({ url: new URL('sw.js', import.meta.url).href, scope: new URL('./', import.meta.url).pathname });
