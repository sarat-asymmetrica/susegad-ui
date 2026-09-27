// The demo page's wiring: mounts the prototype answer, which sends nothing,
// on the enquiry form in index.html. Your own page imports recipe.js and
// mounts its own send instead (see README.md).

import { mountEnquiry, mountGroupHint } from './recipe.js';

const el = document.querySelector('sg-form.enquiry__form');
if (el) {
  mountEnquiry(el);
  mountGroupHint(document.getElementById('f-group'), document.getElementById('f-group-note'));
  customElements.whenDefined('sg-form').then(() => { window.__ready = true; });
}
