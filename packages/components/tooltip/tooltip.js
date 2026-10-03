// <sg-tooltip>: a trigger and its accessible description, always linked by
// aria-describedby, so the text reaches assistive technology whether or not
// it is ever shown on screen. Without JavaScript, CSS alone reveals it on
// :hover and :focus-visible. With JavaScript, the panel becomes a
// popover="hint" (or "manual", where "hint" is not understood) so it draws
// in the top layer, free of any clipping ancestor, shown with a short delay
// on hover and instantly on focus, and dismissed by Escape.
//
//   <sg-tooltip>
//     <button aria-describedby="cancel-note">Free cancellation</button>
//     <span id="cancel-note" role="tooltip">No charge up to 48 hours before arrival.</span>
//   </sg-tooltip>
//
// The tooltip's words must never be the only place a meaning lives: put
// anything a person must know to act (a price, a deadline) in real text
// nearby too. Attributes: register.

import { SgElement, defineComponent } from '../../core/component.js';
import { placement, hintSupported } from './tooltip.core.js';

let uid = 0;
const SHOW_DELAY = 320, HIDE_DELAY = 100;

export class SgTooltip extends SgElement {
  static native = '[role="tooltip"]';
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #trigger = null; #off = []; #showT = 0; #hideT = 0; #open = false;

  connected() {
    const panel = this.native;
    if (!panel) { console.warn('sg-tooltip: put a [role="tooltip"] element inside it.'); return; }
    // The trigger is the first focusable descendant outside the panel, not
    // necessarily a direct child: a builder may wrap it in <sg-button> for
    // its own theatre. Falls back to the first non-panel child so a plain,
    // already-focusable custom element still works.
    this.#trigger = [...this.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].find(el => !panel.contains(el))
      || [...this.children].find(c => c !== panel) || null;
    if (!this.#trigger) { console.warn('sg-tooltip: put a trigger element before the [role="tooltip"].'); return; }

    panel.id ||= `sg-tooltip-${++uid}`;
    const described = new Set((this.#trigger.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    described.add(panel.id);
    this.#trigger.setAttribute('aria-describedby', [...described].join(' '));

    // Progressive enhancement only: without this, the panel is plain flow
    // content, always in the a11y tree, revealed by tooltip.css's own
    // :hover / :focus-visible rule with no script.
    panel.setAttribute('popover', hintSupported(this.ownerDocument) ? 'hint' : 'manual');

    const on = (el, type, fn, opts) =>{ el.addEventListener(type, fn, opts); this.#off.push(() => el.removeEventListener(type, fn, opts)); };
    on(this.#trigger, 'pointerenter', e => { if (e.pointerType !== 'touch') this.#queueShow(SHOW_DELAY); });
    on(this.#trigger, 'pointerleave', e => { if (e.pointerType !== 'touch') this.#queueHide(); });
    on(this.#trigger, 'focus', () => this.#queueShow(0));
    on(this.#trigger, 'blur', () => this.#queueHide(0));
    on(this.#trigger, 'keydown', e => { if (e.key === 'Escape' && this.#open) { e.stopPropagation(); this.#hide(); } });
    const onReflow = () => this.#place();
    on(window, 'resize', onReflow);
    on(window, 'scroll', onReflow, { capture: true, passive: true });
  }

  disconnected() {
    clearTimeout(this.#showT); clearTimeout(this.#hideT);
    this.#off.splice(0).forEach(f => f());
  }

  get open() { return this.#open; }

  #queueShow(delay) {
    clearTimeout(this.#hideT);
    clearTimeout(this.#showT);
    this.#showT = setTimeout(() => this.#show(), delay);
  }
  #queueHide(delay = HIDE_DELAY) {
    clearTimeout(this.#showT);
    clearTimeout(this.#hideT);
    this.#hideT = setTimeout(() => this.#hide(), delay);
  }
  #show() {
    if (this.#open) return;
    try { this.native.showPopover(); } catch { /* already open, or no popover support */ }
    this.#open = true;
    this.toggleAttribute('data-open', true);
    this.#place();
    this.update();
  }
  #hide() {
    if (!this.#open) return;
    try { this.native.hidePopover(); } catch { /* already closed */ }
    this.#open = false;
    this.toggleAttribute('data-open', false);
    this.update();
  }

  #place() {
    if (!this.#open || !this.#trigger) return;
    const t = this.#trigger.getBoundingClientRect();
    const panel = { width: this.native.offsetWidth, height: this.native.offsetHeight };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const { left, above } = placement(t, panel, viewport);
    const s = this.native.style;
    s.position = 'fixed'; s.margin = '0'; s.left = `${left}px`;
    this.toggleAttribute('data-above', above);
    if (above) { s.top = 'auto'; s.bottom = `${viewport.height - t.top + 8}px`; }
    else { s.bottom = 'auto'; s.top = `${t.bottom + 8}px`; }
  }

  state() { return { open: this.#open, motion: this.motion, visible: this.visible }; }
}

defineComponent('sg-tooltip', SgTooltip);
