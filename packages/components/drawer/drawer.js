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
/** True where <button commandfor command="show-modal"> already works; elsewhere (iOS before 26.2) a click handler stands in. */
const nativeCommands = typeof HTMLButtonElement !== 'undefined' && 'commandForElement' in HTMLButtonElement.prototype;

export class SgDrawer extends SgElement {
  static native = 'dialog';
  static skins = SKINS;
  static observedAttributes = ['register', 'edge'];

  #openers = [];
  #invokers = [];
  #announced = false;
  #watch = null;
  #returnFocus = null;
  #card = null;
  #scrim = null;
  #onOpenerClick = e => { e.preventDefault(); this.show(); };
  /** A <button commandfor="id" command="…"> in a browser without invoker commands: do what the browser would. */
  #onInvokerClick = e => {
    const cmd = e.currentTarget.getAttribute('command');
    if (cmd !== 'show-modal' && cmd !== 'close' && cmd !== 'request-close') return;
    e.preventDefault();
    this.#run(cmd, e.currentTarget);
  };
  /** A command aimed at the <sg-drawer> element itself, or at its <dialog> (to remember who asked). */
  #onCommand = e => {
    if (e.target === this) { e.preventDefault(); this.#run(e.command, e.source); }
    else if (e.command === 'show-modal' && e.source) this.#returnFocus = e.source;
  };
  #run(cmd, source) {
    if (cmd === 'show-modal') { if (!this.open) { this.#returnFocus = source ?? document.activeElement; this.native.showModal(); this.#afterOpen(); } }
    else if (cmd === 'close') this.close();
    else if (cmd === 'request-close') this.native.requestClose ? this.native.requestClose() : this.close();
  }
  #onClose = () => { this.#announced = false; this.#restoreFocus(); this.update(); this.emit('sg-drawer-close', { returnValue: this.native.returnValue }); };
  #onCancel = () => { this.emit('sg-drawer-cancel', {}); };
  // Same light-dismiss fix as Dialog: a click outside the card closes it,
  // not only e.target === native (which misses the scrim's canvas in warm/playful).
  // A press that began inside the card and was let go outside it (selecting text, or dragging off a
  // button to cancel it) is not a dismissal.
  #pressedInside = false;
  #onPointerDown = e => { this.#pressedInside = !!this.#card?.contains(e.target); };
  #onClick = e => { const inside = this.#pressedInside; this.#pressedInside = false; if (this.#card && !inside && !this.#card.contains(e.target)) this.close('dismiss'); };

  get edge() { return normalizeEdge(this.getAttribute('edge')); }

  connected() {
    const dlg = this.native;
    if (!dlg) return;
    const ownId = dlg.id;
    if (!dlg.id) dlg.id = `sg-drawer-native-${++uid}`;
    this.#build();
    this.dataset.edge = this.edge;
    const ids = [this.id, ownId].filter(Boolean);
    if (ids.length) {
      this.#openers = ids.flatMap(id => [...document.querySelectorAll(`[data-sg-drawer="${CSS.escape(id)}"]`)]);
      this.#openers.forEach(o => o.addEventListener('click', this.#onOpenerClick));
    }
    // <button commandfor command="show-modal"> opens it with no script at all; where the browser has no
    // invoker commands, the same buttons get a click handler, and either way an open from outside
    // (a command, or open set by hand) still wakes the skin through the observer below
    if (!nativeCommands) {
      this.#invokers = ids.flatMap(id => [...document.querySelectorAll(`[commandfor="${CSS.escape(id)}"]`)]);
      this.#invokers.forEach(b => b.addEventListener('click', this.#onInvokerClick));
    }
    this.addEventListener('command', this.#onCommand);
    dlg.addEventListener('command', this.#onCommand);
    this.#watch = new MutationObserver(() => { if (dlg.open) this.#afterOpen(); });
    this.#watch.observe(dlg, { attributes: true, attributeFilter: ['open'] });
    if (dlg.open) this.#afterOpen();
    dlg.addEventListener('close', this.#onClose);
    dlg.addEventListener('cancel', this.#onCancel);
    dlg.addEventListener('click', this.#onClick);
    dlg.addEventListener('pointerdown', this.#onPointerDown);
  }

  disconnected() {
    const dlg = this.native;
    this.#openers.forEach(o => o.removeEventListener('click', this.#onOpenerClick));
    this.#openers = [];
    this.#invokers.forEach(b => b.removeEventListener('click', this.#onInvokerClick));
    this.#invokers = [];
    this.removeEventListener('command', this.#onCommand);
    dlg?.removeEventListener('command', this.#onCommand);
    this.#watch?.disconnect();
    dlg?.removeEventListener('close', this.#onClose);
    dlg?.removeEventListener('cancel', this.#onCancel);
    dlg?.removeEventListener('click', this.#onClick);
    dlg?.removeEventListener('pointerdown', this.#onPointerDown);
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
    this.#name(card);
  }

  /** 4.1.2: a modal <dialog> has no accessible name of its own. When the author gave neither
   *  aria-label nor aria-labelledby, point aria-labelledby at the first heading inside. */
  #name(root) {
    const dlg = this.native;
    if (dlg.hasAttribute('aria-label') || dlg.hasAttribute('aria-labelledby')) return;
    const h = root.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
    if (!h) return;
    if (!h.id) h.id = `sg-drawer-title-${++uid}`;
    dlg.setAttribute('aria-labelledby', h.id);
  }

  get open() { return !!this.native?.open; }

  show() {
    const dlg = this.native;
    if (!dlg || dlg.open) return;
    this.#returnFocus = document.activeElement;
    dlg.showModal();
    this.#afterOpen();
  }

  /** Once per opening, whoever opened it (show(), a command, an opener's click): wake the skin and say so. */
  #afterOpen() {
    if (this.#announced) return;
    this.#announced = true;
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
