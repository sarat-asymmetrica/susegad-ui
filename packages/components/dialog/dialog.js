// <sg-dialog>: wraps and enhances a native <dialog>, per decision 0005.
//
//   <a href="/ask-the-house" data-sg-dialog="ask">Ask the house</a>   <!-- the no-JS path: a real link to a real page -->
//   <sg-dialog id="ask">
//     <dialog>
//       <h2>Ask the house</h2>
//       <p>…</p>
//       <form method="dialog"><button value="cancel">Cancel</button> <button value="ok">Send</button></form>
//     </dialog>
//   </sg-dialog>
//
// showModal() traps focus and blocks the rest of the page natively; Escape
// fires 'cancel' then 'close'; the platform restores focus to the opener.
// This file only: finds the openers, upgrades their click, structures the
// dialog into a scrim layer (for the warm/playful skin's Carepa backdrop)
// and a card, and forwards state to the skin.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, isDismiss } from './dialog.core.js';

export { STRINGS, isDismiss };

const SKINS = {
  quiet: () => import('./skins/quiet.js'),
  warm: () => import('./skins/warm.js'),
  playful: () => import('./skins/playful.js'),
};

let uid = 0;

export class SgDialog extends SgElement {
  static native = 'dialog';
  static skins = SKINS;
  static observedAttributes = ['register'];

  #openers = [];
  #returnFocus = null;
  #card = null;
  #scrim = null;
  #onOpenerClick = e => { e.preventDefault(); this.show(); };
  #onClose = () => { this.#restoreFocus(); this.update(); this.emit('sg-dialog-close', { returnValue: this.native.returnValue }); };
  #onCancel = () => { this.emit('sg-dialog-cancel', {}); };
  // Light-dismiss: any click that doesn't land inside the card closes it.
  // Not just `e.target === this.native` (the ::backdrop case in quiet's
  // own-sized box): in warm/playful the dialog is full-bleed and a click
  // can land on the scrim's canvas, whose target is the <canvas>, never the
  // <dialog> itself. Found by dialog.check.mjs clicking the scrim.
  #onClick = e => { if (this.#card && !this.#card.contains(e.target)) this.close('dismiss'); };

  connected() {
    const dlg = this.native;
    if (!dlg) return;
    if (!dlg.id) dlg.id = `sg-dialog-native-${++uid}`;
    this.#build();
    if (this.id) {
      this.#openers = [...document.querySelectorAll(`[data-sg-dialog="${CSS.escape(this.id)}"]`)];
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

  /** Wraps the dialog's original light-DOM content in a card, and adds an
   *  empty scrim layer before it for a skin to mount Carepa into. Idempotent. */
  #build() {
    const dlg = this.native;
    if (this.#card) return;
    const scrim = document.createElement('div');
    scrim.className = 'sg-dialog-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    const card = document.createElement('div');
    card.className = 'sg-dialog-card';
    card.part = 'card';
    card.append(...dlg.childNodes);
    dlg.append(scrim, card);
    this.#scrim = scrim;
    this.#card = card;
  }

  /** True while the dialog is open. */
  get open() { return !!this.native?.open; }

  /** Opens the dialog modally. Remembers the element that had focus, so it comes back on close. */
  show() {
    const dlg = this.native;
    if (!dlg || dlg.open) return;
    this.#returnFocus = document.activeElement;
    dlg.showModal();
    this.update();
    this.emit('sg-dialog-open', {});
  }

  /** Closes the dialog. `value` becomes the native dialog's returnValue. */
  close(value) { this.native?.close(value); }

  #restoreFocus() {
    const el = this.#returnFocus;
    this.#returnFocus = null;
    // most browsers already restored focus themselves on close(); this covers the rest, and is a harmless no-op otherwise
    if (el && document.contains(el) && typeof el.focus === 'function' && document.activeElement !== el) el.focus();
    else if (!document.contains(document.activeElement) || document.activeElement === document.body) this.#openers[0]?.focus();
  }

  state() { return { open: this.open, card: this.#card, scrim: this.#scrim }; }
}

defineComponent('sg-dialog', SgDialog);
