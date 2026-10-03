// <sg-quote>: a pull-quote or testimonial. The figure, blockquote and
// figcaption carry everything; the skins add a hairline, a pencil bracket or
// a hand-drawn quotation mark, all aria-hidden.
//
//   <sg-quote>
//     <figure>
//       <blockquote><p>The words.</p></blockquote>
//       <figcaption><span class="sg-quote-who">Maya Fernandes</span>
//         <span class="sg-quote-role">Founder, Aldona Organics</span>
//         <a class="sg-quote-source" href="#note">Hear her say it</a></figcaption>
//     </figure>
//   </sg-quote>
//
// Attributes: seed (the ornament's hand; defaults to the words), register.

import { SgElement, defineComponent } from '../../core/component.js';

export class SgQuote extends SgElement {
  static native = 'figure';
  static observedAttributes = ['register', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  connected() {
    if (!this.native) console.warn('sg-quote: wrap the quote in <figure><blockquote>…</blockquote><figcaption>…</figcaption></figure>.');
  }

  state() {
    const words = this.querySelector('blockquote')?.textContent.trim().slice(0, 60) ?? '';
    return { seed: this.getAttribute('seed') || words, motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-quote', SgQuote);
