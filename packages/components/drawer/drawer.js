// <sg-drawer>: wraps and enhances a native <dialog>, sliding from an edge.
// Same modal contract as Dialog (showModal, Escape, focus return); the only
// difference is layout (a panel at an edge, not a centred card) and, in
// playful, an entrance timed to the Teental stagger's first beat.
//
//   <a href="/rooms" data-sg-drawer="rooms">The rooms</a>
//   <sg-drawer id="rooms" edge="end">
//     <dialog>
//       <h2>The rooms</h2>
//       …
//     </dialog>
//   </sg-drawer>

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, isDismiss, normalizeEdge } from './drawer.core.js';

export { STRINGS, isDismiss, normalizeEdge };

const SKINS = {
  quiet: () => import('./skins/quiet.js'),
  warm: () => import('./skins/warm.js'),
  playful: () => import('./skins/playful.js'),
};

let uid = 0;

export class SgDrawer extends SgElement {
  static native = 'dialog';
  static skins = SKINS;
  static observedAttributes = ['register', 'edge'];

  #openers = [];
  #returnFocus = null;
  #card = null;
  #scrim = null;
  #onOpenerClick = e => { e.preventDefault(); this.show(); };
  #onClose = () => { this.#restoreFocus(); this.update(); this.emit('sg-drawer-close', { returnValue: this.native.returnValue }); };
  #onCancel = () => { this.emit('sg-drawer-cancel', {}); };
  // Same light-dismiss fix as Dialog: a click outside the card closes it,
  // not only e.target === native (which misses the scrim's canvas in warm/playful).
  #onClick = e => { if (this.#card && !this.#card.contains(e.target)) this.close('dismiss'); };

  get edge() { return normalizeEdge(this.getAttribute('edge')); }

  connected() {
    const dlg = this.native;
    if (!dlg) return;
    if (!dlg.id) dlg.id = `sg-drawer-native-${++uid}`;
    this.#build();
    this.dataset.edge = this.edge;
    if (this.id) {
      this.#openers = [...document.querySelectorAll(`[data-sg-drawer="${CSS.escape(this.id)}"]`)];
      this.#openers.forEach(o => o.addEventListener('click', this.#onOpenerClick));
    }
    dlg.addEventListener('close', this.#onClose);
    dlg.addEventListener('cancel', this.#onCancel);
    dlg.addEventListener('click', this.#onClick);
  }

  disconnected() {
    const dlg = this.native;
    this.#openers.forEach(o => o.removeEventListener('click', this.#onOpenerClick));
    this.#openers = [];
    dlg?.removeEventListener('close', this.#onClose);
    dlg?.removeEventListener('cancel', this.#onCancel);
    dlg?.removeEventListener('click', this.#onClick);
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback?.(name, old, now);
    if (name === 'edge' && this.isConnected) this.dataset.edge = this.edge;
  }

  #build() {
    const dlg = this.native;
    if (this.#card) return;
    const scrim = document.createElement('div');
    scrim.className = 'sg-drawer-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    const card = document.createElement('div');
    card.className = 'sg-drawer-card';
    card.part = 'panel';
    // Rasika S4: the deckled edge is a ::before on .sg-drawer-card, drawn
    // 1px outside its own border box on purpose (so the torn paper reads as
    // spilling past the edge, not stopping flush at it). That only shows if
    // the card itself doesn't clip its own overflow, so scrolling moves to
    // an inner wrapper instead; the card stays overflow: visible.
    const content = document.createElement('div');
    content.className = 'sg-drawer-content';
    content.append(...dlg.childNodes);
    card.append(content);
    dlg.append(scrim, card);
    this.#scrim = scrim;
    this.#card = card;
  }

  get open() { return !!this.native?.open; }

  show() {
    const dlg = this.native;
    if (!dlg || dlg.open) return;
    this.#returnFocus = document.activeElement;
    dlg.showModal();
    this.update();
    this.emit('sg-drawer-open', {});
  }

  close(value) { this.native?.close(value); }

  #restoreFocus() {
    const el = this.#returnFocus;
    this.#returnFocus = null;
    if (el && document.contains(el) && typeof el.focus === 'function' && document.activeElement !== el) el.focus();
    else if (!document.contains(document.activeElement) || document.activeElement === document.body) this.#openers[0]?.focus();
  }

  state() { return { open: this.open, card: this.#card, scrim: this.#scrim, edge: this.edge }; }
}

defineComponent('sg-drawer', SgDrawer);
