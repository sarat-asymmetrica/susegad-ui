// <sg-link>: a native <a href>, unchanged, with the register's underline
// drawn beneath it. The native element takes the keyboard and navigation,
// with or without JavaScript.
//
//   <sg-link><a href="/rooms">See the rooms</a></sg-link>
//
// Attributes: seed (the drawn line's wobble; defaults to the label), register.

import { SgElement, defineComponent } from '../../core/component.js';

export class SgLink extends SgElement {
  static native = 'a';
  static observedAttributes = ['register', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  connected() {
    if (!this.native) console.warn('sg-link: put an <a href> inside it.');
  }

  state() {
    return {
      seed: this.getAttribute('seed') || this.native?.textContent.trim() || '',
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-link', SgLink);
