// <sg-badge>: a word or two of status. The text is the meaning; a shape per
// tone backs it up; colour comes last.
//
//   <sg-badge tone="success">Paid</sg-badge>
//   <sg-badge tone="info" busy>Saving</sg-badge>
//
// Attributes: tone (neutral | accent | success | warning | danger | info),
// busy (the thing is still happening; the words should say so), seed (the
// hand-inked outline; defaults to the text), register.

import { SgElement, defineComponent } from '../../core/component.js';
import { toneOf, scriptOf } from './badge.core.js';

export class SgBadge extends SgElement {
  static observedAttributes = ['register', 'tone', 'busy', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #mo = null;

  connected() {
    this.#tag();
    // A server may swap the words (htmx): keep the script tag and the skin in step.
    this.#mo = new MutationObserver(() => { this.#tag(); this.update(); });
    this.#mo.observe(this, { childList: true, characterData: true, subtree: true });
  }
  disconnected() { this.#mo?.disconnect(); }

  #tag() {
    const s = scriptOf(this.textContent);
    if (this.dataset.sgScript !== s) this.dataset.sgScript = s;
  }

  state() {
    return {
      tone: toneOf(this.getAttribute('tone')),
      busy: this.hasAttribute('busy'),
      seed: this.getAttribute('seed') || this.textContent.trim(),
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-badge', SgBadge);
