// <sg-popover>: a trigger and a native popover, unchanged. The `popovertarget`
// attribute opens and closes it, focuses and light-dismisses it, and answers
// Escape, all without JavaScript; this element only places the panel near
// its trigger and lets the register skin the card.
//
//   <sg-popover>
//     <button popovertarget="rates">Today's rate</button>
//     <div id="rates" popover>
//       <p>₹8,200 a night, this week.</p>
//     </div>
//   </sg-popover>
//
// Without an id on the panel or a popovertarget on the trigger, the element
// wires them itself, so a builder may leave both off and just nest a
// [popover] element after a button. Placement is CSS anchor positioning
// (popover.css); the measured JS placement below runs only in a browser
// that does not have it. Either way the open panel is slid back inside the visual viewport (#fit). Attributes: register.

import { SgElement, defineComponent } from '../../core/component.js';
import { placement, visibleBox, fitShift } from './popover.core.js';

let uid = 0, anchorUid = 0;
const anchors = typeof CSS !== 'undefined' && !!CSS.supports?.('anchor-name: --a');

export class SgPopover extends SgElement {
  static native = '[popover]';
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #trigger = null; #off = [];

  connected() {
    const panel = this.native;
    if (!panel) { console.warn('sg-popover: put an element with the popover attribute inside it.'); return; }
    this.#trigger = this.querySelector('[popovertarget]') || this.querySelector('button, a');
    panel.id ||= `sg-popover-${++uid}`;
    if (this.#trigger && !this.#trigger.hasAttribute('popovertarget')) this.#trigger.setAttribute('popovertarget', panel.id);

    // beforetoggle runs inside showPopover(), before the panel's first painted frame: fit then, not a task later on 'toggle'
    const onBefore = e => { if (e.newState === 'open') requestAnimationFrame(() => { this.#place(); this.#fit(); }); };
    panel.addEventListener('beforetoggle', onBefore);
    this.#off.push(() => panel.removeEventListener('beforetoggle', onBefore));
    const onToggle = e => { this.toggleAttribute('data-open', e.newState === 'open'); this.update(); this.#place(); this.#fit(); };
    panel.addEventListener('toggle', onToggle);
    this.#off.push(() => panel.removeEventListener('toggle', onToggle));
    // the visible box changes under an open panel (pinch zoom, the URL bar, rotation): fit it again
    const onView = () => { this.#place(); this.#fit(); };
    const vv = window.visualViewport;
    window.addEventListener('resize', onView);
    vv?.addEventListener('resize', onView);
    vv?.addEventListener('scroll', onView);
    this.#off.push(() => { window.removeEventListener('resize', onView); vv?.removeEventListener('resize', onView); vv?.removeEventListener('scroll', onView); });
    if (anchors && this.#trigger) {
      // the trigger is the anchor and the panel names it: the browser places, flips and follows it
      const name = `--sg-popover-${++anchorUid}`;
      this.#trigger.style.setProperty('anchor-name', name);
      panel.style.setProperty('position-anchor', name);
      this.#off.push(() => { this.#trigger.style.removeProperty('anchor-name'); panel.style.removeProperty('position-anchor'); });
    } else {
      const onReflow = () => { this.#place(); this.#fit(); };
      window.addEventListener('scroll', onReflow, { capture: true, passive: true });
      this.#off.push(() => window.removeEventListener('scroll', onReflow, { capture: true }));
    }
  }
  disconnected() { this.#off.splice(0).forEach(f => f()); }

  /** True while the panel is open. */
  get open() { return !!this.native?.matches(':popover-open'); }
  showPopover() { this.native?.showPopover(); }
  hidePopover() { this.native?.hidePopover(); }
  togglePopover() { this.native?.togglePopover(); }

  /** The fallback, for a browser without anchor positioning: place the
   * panel under its trigger, measured, because a bare `position: fixed`
   * with no offsets falls back to the panel's static flow position. */
  #place() {
    if (anchors || !this.open || !this.native || !this.#trigger) return;
    const t = this.#trigger.getBoundingClientRect();
    const panel = { width: this.native.offsetWidth, height: this.native.offsetHeight };
    const viewport = visibleBox(window);
    const { left, above } = placement(t, panel, viewport);
    const s = this.native.style;
    s.margin = '0';
    s.left = `${left}px`; s.bottom = 'auto';
    // from the top edge, never from the bottom: the bottom is measured against innerHeight, which a phone widens
    s.top = `${above ? t.top - 6 - this.native.offsetHeight : t.bottom + 6}px`;
  }

  /** Both paths, last: slide the placed panel back inside what a person can see. The anchored path is placed against
   * the layout viewport, which mobile Chromium widens to fit overflow, so on a phone it can sit past the screen.
   * The slide is a custom property (popover.css turns it into a translateX), measured from the unslid box. */
  #fit() {
    const panel = this.native;
    if (!panel) return;
    panel.style.removeProperty('--sg-fit-x');
    if (!this.open) return;
    // the playful postmark pokes 12px past the corner: leave it room
    const dx = fitShift(panel.getBoundingClientRect(), visibleBox(window), this.dataset.skin === 'playful' ? 16 : 8);
    if (dx) panel.style.setProperty('--sg-fit-x', `${Math.round(dx * 100) / 100}px`);
  }

  state() { return { open: this.open, motion: this.motion, visible: this.visible }; }
}

defineComponent('sg-popover', SgPopover);
