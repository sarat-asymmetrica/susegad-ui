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
// [popover] element after a button. Attributes: register.

import { SgElement, defineComponent } from '../../core/component.js';
import { placement } from './popover.core.js';

let uid = 0;

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

    const onToggle = e => { this.toggleAttribute('data-open', e.newState === 'open'); this.update(); this.#place(); };
    panel.addEventListener('toggle', onToggle);
    const onReflow = () => this.#place();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, { capture: true, passive: true });
    this.#off.push(
      () => panel.removeEventListener('toggle', onToggle),
      () => window.removeEventListener('resize', onReflow),
      () => window.removeEventListener('scroll', onReflow, { capture: true }),
    );
  }
  disconnected() { this.#off.splice(0).forEach(f => f()); }

  /** True while the panel is open. */
  get open() { return !!this.native?.matches(':popover-open'); }
  showPopover() { this.native?.showPopover(); }
  hidePopover() { this.native?.hidePopover(); }
  togglePopover() { this.native?.togglePopover(); }

  /** Place the panel under its trigger, always measured: a bare
   * `position: fixed` with no offsets falls back to the panel's static
   * flow position, not its trigger, so this never relies on CSS alone. */
  #place() {
    if (!this.open || !this.native || !this.#trigger) return;
    const t = this.#trigger.getBoundingClientRect();
    const panel = { width: this.native.offsetWidth, height: this.native.offsetHeight };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const { left, above } = placement(t, panel, viewport);
    const s = this.native.style;
    s.left = `${left}px`;
    if (above) { s.top = 'auto'; s.bottom = `${viewport.height - t.top + 6}px`; }
    else { s.bottom = 'auto'; s.top = `${t.bottom + 6}px`; }
  }

  state() { return { open: this.open, motion: this.motion, visible: this.visible }; }
}

defineComponent('sg-popover', SgPopover);
