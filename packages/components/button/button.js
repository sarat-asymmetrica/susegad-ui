// <sg-button>: a native <button> or <a href>, unchanged, with the register's
// drawing laid over it. The native element takes the keyboard, the click,
// form submission and (for a link) navigation, with or without JavaScript.
//
//   <sg-button><button>Book now</button></sg-button>
//   <sg-button><a href="/rooms">See the rooms</a></sg-button>
//
// Attributes: seed (the warm outline's wobble and the playful ink; defaults
// to the label), register. A skin adds no attributes of its own: disabled,
// href and type are the native element's.

import { SgElement, defineComponent } from '../../core/component.js';

export class SgButton extends SgElement {
  static native = 'button, a';
  static observedAttributes = ['register', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  connected() {
    if (!this.native) console.warn('sg-button: put a <button> or an <a href> inside it.');
  }

  state() {
    return {
      seed: this.getAttribute('seed') || this.native?.textContent.trim() || '',
      disabled: !!this.native?.disabled,
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-button', SgButton);
