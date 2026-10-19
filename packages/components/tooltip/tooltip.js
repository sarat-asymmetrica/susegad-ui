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
// the measured JS placement runs only in a browser without it. Either way the open panel is slid back inside the visual viewport (#fit). Attributes: register.

import { SgElement, defineComponent } from '../../core/component.js';
import { placement, hintSupported, visibleBox, fitShift, parseGap } from './tooltip.core.js';

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
  #trigger = null; #off = []; #showT = 0; #hideT = 0; #open = false; #flipped = false;

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
      on(window, 'scroll', () => this.#reflow(), { capture: true, passive: true });
    }
    // the visible box changes under an open tooltip (pinch zoom, the URL bar, rotation): place and fit it again
    on(window, 'resize', () => this.#reflow());
    if (window.visualViewport) for (const type of ['resize', 'scroll']) on(window.visualViewport, type, () => this.#reflow());
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
    // trim the hover bridge first: data-open draws it, and a band past the screen edge widens the layout viewport
    // (mobile Chromium), which the placement below would then measure
    this.#trimBridge(visibleBox(window));
    this.toggleAttribute('data-open', true);
    this.#reflow();
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
    this.native.style.removeProperty('--sg-fit-x');
    this.style.removeProperty('--sg-bridge-l'); this.style.removeProperty('--sg-bridge-r');
    this.native.style.removeProperty('--sg-fit-max'); this.native.style.removeProperty('--sg-lead-x');
    if (this.#flipped) this.#unflip();
    this.update();
  }

  #reflow() {
    if (!this.#open) return;
    // the panel may be no wider than the visible box less a margin on each side (a 22em panel is wider than a 320 px phone)
    this.native.style.setProperty('--sg-fit-max', `${Math.max(0, visibleBox(window).width - 16)}px`);
    this.#place(); this.#fit();
  }

  /** The hover bridge reaches 1.5rem past the trigger each side; never past the edge of what is visible. */
  #trimBridge(box) {
    const t = this.#trigger.getBoundingClientRect();
    this.style.setProperty('--sg-bridge-l', `${Math.max(0, t.left - box.left)}px`);
    this.style.setProperty('--sg-bridge-r', `${Math.max(0, box.left + box.width - t.right)}px`);
  }

  /** Both paths, last: slide the placed panel back inside what a person can see. The anchored path is placed against
   * the layout viewport, which mobile Chromium widens to fit overflow, so on a phone it can sit past the screen.
   * The slide is a custom property (tooltip.css turns it into a translateX and keeps the leader line under the
   * trigger), measured from the unslid box. */
  #fit() {
    if (!this.#open) return;
    const panel = this.native;
    panel.style.removeProperty('--sg-fit-x');
    const box = visibleBox(window);
    // undo last time's hand-flip, so the browser's own choice is what gets measured
    if (this.#flipped) this.#unflip();
    let r = panel.getBoundingClientRect();
    // anchored: position-try-fallbacks: flip-block did not flip a panel that is cut by the top edge of the screen (warm, 56 px
    // tall, a trigger 60 px down: -4.2..52), so below it, by hand, when there is room
    // (measured without the entrance's rise: a warm panel opens 4px low and settles, and that 4px hid the cut at first)
    const rise = parseFloat(getComputedStyle(panel).translate.split(' ')[1]) || 0;
    if (anchors && r.top - rise < box.top - 0.5) {
      const t = this.#trigger.getBoundingClientRect(), gap = this.#gap();
      if (t.bottom + gap + r.height <= box.top + box.height) {
        const st = panel.style;
        // the anchor, not pixels: a pixel top would stay put when the page scrolls and leave the panel behind its trigger
        st.bottom = 'auto'; st.top = 'anchor(bottom)'; st.marginBlock = `${gap}px 0`;
        this.#flipped = true;
        this.toggleAttribute('data-above', false);
        r = panel.getBoundingClientRect();
      }
    }
    const dx = fitShift(r, box);
    if (dx) panel.style.setProperty('--sg-fit-x', `${Math.round(dx * 100) / 100}px`);
    this.#trimBridge(box);
    // the playful leader line sits under the middle of the trigger, wherever the panel ended up (the fallback
    // clamp and the slide both move the panel, never the line)
    const t = this.#trigger.getBoundingClientRect();
    const lead = Math.min(Math.max(t.left + t.width / 2 - (r.left + dx), 6), Math.max(6, r.width - 6));
    panel.style.setProperty('--sg-lead-x', `${Math.round(lead * 100) / 100}px`);
  }

  #unflip() {
    const st = this.native.style;
    st.removeProperty('margin-block'); st.removeProperty('bottom'); st.removeProperty('top');
    this.#flipped = false;
  }

  #gap() { return parseGap(getComputedStyle(this).getPropertyValue('--sg-tooltip-gap'), parseFloat(getComputedStyle(this.ownerDocument.documentElement).fontSize) || 16); }

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
    const viewport = visibleBox(window);
    const gap = this.#gap();
    const { left, above } = placement(t, panel, viewport, { gap });
    const s = this.native.style;
    s.position = 'fixed'; s.margin = '0'; s.left = `${left}px`; s.bottom = 'auto';
    this.toggleAttribute('data-above', above);
    // from the top edge, never from the bottom: the bottom is measured against innerHeight, which a phone widens
    s.top = `${above ? t.top - gap - this.native.offsetHeight : t.bottom + gap}px`;
  }

  state() { return { open: this.#open, motion: this.motion, visible: this.visible }; }
}

defineComponent('sg-tooltip', SgTooltip);
