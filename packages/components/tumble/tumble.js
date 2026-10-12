// <sg-tumble>: a headline that arrives. It wraps a real heading and leaves it alone: the text stays one string in
// the page, read once, selectable and translatable. The moving letters are an aria-hidden copy laid over it, in the
// places the browser put them, and they exist only while the arrival plays.
//
//   <sg-tumble><h2>Life is short, eat good pasta</h2></sg-tumble>          plays once, the first time it is seen
//   <sg-tumble manual><h1>Saffron Spoon</h1></sg-tumble>                    waits for el.play()
//   <sg-tumble manual hold><h1>Saffron Spoon</h1></sg-tumble>               hidden until played (and let go after 8 s)
//
// Attributes: manual (no auto-play), hold (with JavaScript running, hide the heading until it plays; a page
// that never calls play() gets its heading back after 8 seconds), seed (the spin of the letters), register.
// Methods: play() returns a promise that resolves when the heading has settled. Events: sg-tumble-start and
// sg-tumble-done. The heading is never hidden without JavaScript, before it runs, or if anything throws.
//
// Quiet and reduced motion: nothing moves, play() resolves at once. Warm: lines slide in from alternate sides.
// Playful: letters drop from above with a little spin, bounce once and settle.

import { SgElement, defineComponent } from '../../core/component.js';
import { HOLD_MS } from './tumble.core.js';

export class SgTumble extends SgElement {
  static native = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
  static observedAttributes = ['register', 'manual', 'hold', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #holdTimer = 0;

  connected() {
    if (!this.native) console.warn('sg-tumble: wrap a real heading (<h1> to <h6>); there is nothing to animate.');
    // hold: keep the heading out of sight until it plays, but only when it is going to play
    if (this.hasAttribute('hold') && this.native && this.motion !== 'still' && this.register !== 'quiet') {
      this.dataset.state = 'held';
      this.#holdTimer = setTimeout(() => this.release(), HOLD_MS);
    }
  }

  disconnected() { clearTimeout(this.#holdTimer); }

  /** Let a held heading go without playing. */
  release() {
    clearTimeout(this.#holdTimer);
    if (this.dataset.state === 'held') delete this.dataset.state;
  }

  /** Play the arrival. Resolves when the heading has settled (at once when nothing moves). */
  play() {
    clearTimeout(this.#holdTimer);
    if (this.skin) return this.skin.play();
    // the skin loads on its own: play as soon as it is here, or let go if it never comes
    return new Promise(resolve => {
      const go = () => { this.removeEventListener('sg-skin', go); resolve(this.skin ? this.skin.play() : (this.release(), undefined)); };
      this.addEventListener('sg-skin', go);
      setTimeout(() => { if (!this.skin) { this.removeEventListener('sg-skin', go); this.release(); resolve(); } }, 4000);
    });
  }

  state() {
    return {
      manual: this.hasAttribute('manual'),
      seed: this.getAttribute('seed') || this.native?.textContent.trim() || 'tumble',
      motion: this.motion,
    };
  }
}

defineComponent('sg-tumble', SgTumble);
