// <sg-tooltip>: a trigger and its accessible description, always linked by
// aria-describedby, so the text reaches assistive technology whether or not
// it is ever shown on screen. Without JavaScript, CSS alone reveals it on
// :hover and :focus-visible. With JavaScript, the panel becomes a
// popover="hint" (or "manual", where "hint" is not understood) so it draws
// in the top layer, free of any clipping ancestor, shown with a short delay
// on hover and instantly on focus, and dismissed by Escape. The panel stays open while the pointer is on it.
//
//   <sg-tooltip>
//     <button aria-describedby="cancel-note">Free cancellation</button>
//     <span id="cancel-note" role="tooltip">No charge up to 48 hours before arrival.</span>
//   </sg-tooltip>
//
// The tooltip's words must never be the only place a meaning lives: put
// anything a person must know to act (a price, a deadline) in real text
// nearby too. The panel is placed by CSS anchor positioning (tooltip.css);
// the measured JS placement runs only in a browser without it. Attributes: register.

import { SgElement, defineComponent } from '../../core/component.js';
import { placement, hintSupported } from './tooltip.core.js';

let uid = 0, anchorUid = 0;
const anchors = typeof CSS !== 'undefined' && !!CSS.supports?.('anchor-name: --a');
const SHOW_DELAY = 320, HIDE_DELAY = 300;

export class SgTooltip extends SgElement {
  static native = '[role="tooltip"]';
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  // 1.4.13 dismissible: while it is open, Escape closes it wherever focus is (hover alone gives the trigger no focus)
  #onEscape = e => { if (e.key === 'Escape' && this.#open) { this.#hide(); } };
  // a press anywhere else closes it (touch has no hover to leave, and WebKit never focuses a tapped button)
  #onOutside = e => { if (this.#open && !this.#trigger?.contains(e.target) && !this.native.contains(e.target)) this.#hide(); };
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
    // the trigger, the panel and the bridge between them are all inside this element: leaving the element is leaving the tooltip
    on(this, 'pointerleave', e => { if (e.pointerType !== 'touch') this.#queueHide(); });
    on(this, 'pointerenter', e => { if (e.pointerType !== 'touch' && this.#open) { clearTimeout(this.#hideT); clearTimeout(this.#showT); } });
    // touch: a tap on the trigger toggles it, in every engine (WebKit never focuses a tapped button, so focus alone never fires); the
    // trigger's own click is left alone. Chromium and Firefox focus as well: #show() ignores the second call, so it opens once.
    on(this.#trigger, 'pointerup', e => { if (e.pointerType === 'touch') { clearTimeout(this.#showT); clearTimeout(this.#hideT); if (this.#open) this.#hide(); else this.#show(); } });
    on(this.#trigger, 'focus', () => this.#queueShow(0));
    on(this.#trigger, 'blur', () => this.#queueHide(0));
    on(this.#trigger, 'keydown', e => { if (e.key === 'Escape' && this.#open) { e.stopPropagation(); this.#hide(); } });
    if (anchors) {
      const name = `--sg-tooltip-${++anchorUid}`;
      this.#trigger.style.setProperty('anchor-name', name);
      panel.style.setProperty('position-anchor', name);
      this.#off.push(() => { this.#trigger.style.removeProperty('anchor-name'); panel.style.removeProperty('position-anchor'); });
    } else {
      const onReflow = () => this.#place();
      on(window, 'resize', onReflow);
      on(window, 'scroll', onReflow, { capture: true, passive: true });
    }
  }

  disconnected() {
    clearTimeout(this.#showT); clearTimeout(this.#hideT);
    this.ownerDocument.removeEventListener('keydown', this.#onEscape);
    this.ownerDocument.removeEventListener('pointerdown', this.#onOutside, true);
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
    this.ownerDocument.addEventListener('keydown', this.#onEscape);
    this.ownerDocument.addEventListener('pointerdown', this.#onOutside, true);
    this.toggleAttribute('data-open', true);
    this.#place();
    this.update();
    // anchored: the browser chose a side; read it once, for the leader line's direction
    if (anchors) requestAnimationFrame(() => this.#readSide());
  }
  #hide() {
    if (!this.#open) return;
    try { this.native.hidePopover(); } catch { /* already closed */ }
    this.#open = false;
    this.ownerDocument.removeEventListener('keydown', this.#onEscape);
    this.ownerDocument.removeEventListener('pointerdown', this.#onOutside, true);
    this.toggleAttribute('data-open', false);
    this.update();
  }

  /** Which side of the trigger the browser put the panel on, read once as it opens. */
  #readSide() {
    if (!this.#open || !this.#trigger) return;
    const t = this.#trigger.getBoundingClientRect(), p = this.native.getBoundingClientRect();
    this.toggleAttribute('data-above', p.top + p.height / 2 < t.top + t.height / 2);
  }

  /** The fallback, for a browser without anchor positioning. */
  #place() {
    if (anchors || !this.#open || !this.#trigger) return;
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
