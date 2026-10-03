// Food order: a small food business's menu, and the way to order from it on WhatsApp.
//
// <sg-menu> shows what is on offer and takes quantities; <sg-wa-order> turns them into
// a message the seller can read and a link that opens WhatsApp with it already written.
// Neither needs wiring: they find each other by id (`for="menu"`) and by the menu's
// sg-change event. Importing this file defines both elements and nothing else.
//
// In your project, change four things on the page: the menu's dishes, the composer's
// `number`, `business` and `min-notice`, and the fallback link's number (build it with
// waLink() from wa-order.core.js so it cannot drift from `number`).

import '../../components/menu/menu.js';
import '../../components/wa-order/wa-order.js';

// Ready once the menu and the composer have their skins, so a screenshot is not of a half-built page.
const parts = () => [...document.querySelectorAll('sg-menu, sg-wa-order')];
Promise.all(parts().map(el => customElements.whenDefined(el.localName).then(() => (el.skin ? 0 : new Promise(r => el.addEventListener('sg-skin', r, { once: true }))))))
  .then(() => document.fonts.ready)
  .then(() => setTimeout(() => { window.__ready = true; }, 150));
