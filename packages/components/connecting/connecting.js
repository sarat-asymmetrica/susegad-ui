// <sg-connecting>: a connection's state in words, with fireflies that fall into
// step only once it is connected.
//
//   <sg-connecting state="connecting" label="Live updates">
//     <span role="status">Connecting</span>
//   </sg-connecting>
//
// The status span is the native part: it carries the words, is read out when
// they change, and works without JavaScript. Skins add an aria-hidden picture.
//
// A still that should not speak (a gallery of states, say) sets role="none" on
// the element: the words are still shown, but in a plain span, not a live region.

import { SgElement, defineComponent } from '../../core/component.js';
import { normState, textFor } from './connecting.core.js';

export class SgConnecting extends SgElement {
  static native = '[role=status], .sg-connecting-words';
  static observedAttributes = ['state', 'label', 'register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  /** The connection state: 'connecting', 'connected' or 'offline'. */
  get connection() { return normState(this.getAttribute('state')); }
  set connection(v) { this.setAttribute('state', normState(v)); }

  connected() {
    if (!this.native) {
      this.native = document.createElement('span');
      this.append(this.native);
    }
    this.native.classList.add('sg-connecting-words');
    // role="none" set by the page keeps the words silent; otherwise they are a polite live region
    if (this.getAttribute('role') === 'none') this.native.removeAttribute('role');
    else this.native.setAttribute('role', 'status');
    this.#words();
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (this.native) this.#words();
  }

  #been = false; // it has been connected, so a later connecting is reconnecting
  #said = false; // the first words are written

  // The words follow the state at once; the fireflies follow the words. The first state
  // is not news: it is written with aria-live="off", and later changes are read out.
  #words() {
    const state = this.connection;
    if (state === 'connected') this.#been = true;
    const text = textFor(state, this.register, this.getAttribute('label') || '', this.#been);
    if (this.native.textContent === text) { this.#said = true; return; }
    if (!this.#said) this.native.setAttribute('aria-live', 'off');
    else if (this.native.getAttribute('aria-live') === 'off') this.native.removeAttribute('aria-live');
    this.native.textContent = text;
    this.#said = true;
  }

  state() {
    this.#words();
    return { state: this.connection, register: this.register, motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-connecting', SgConnecting);
