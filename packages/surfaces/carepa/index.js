// The carepa surface: the warm/playful register's backdrop for Dialog and
// Drawer. Not a <sg-scene> (a surface hosts no slotted reading zone of its
// own; Dialog and Drawer bring their own card and scrim). Import mount() and
// give it a host element sized by CSS (see carepa.css's .sg-carepa-css); the
// canvas fills that box edge to edge, cover-fit.
//
//   import { mount } from '…/surfaces/carepa/index.js';
//   const ctl = mount(el, { seed: 1, register: 'warm', reducedMotion });
//   ctl.still();     // the finished reduced-motion frame
//   ctl.destroy();

export { mount } from './render.js';
export { model, panes, paneShape, sheenHue, sheenNear, driftSun } from './model.js';
export { meta } from './meta.js';
