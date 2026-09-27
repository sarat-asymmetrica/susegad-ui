// <sg-stamp>: a mark that something real has happened (held, received, paid,
// verified). The words are the builder's own text inside a role="status"
// element, so assistive tech reads them; the skin only adds decoration.
//
//   <sg-stamp tone="success" pending>
//     <p role="status"><strong>Held</strong> <span>12 to 15 October, for 20 minutes</span></p>
//   </sg-stamp>
//
//   stampEl.stamp()   removes `pending`: the stamp lands and is announced once
//   stampEl.lift()    sets `pending` again
//
// Attributes: tone (accent | success | warning | danger | info | neutral),
// seed (the ink texture and tilt; defaults to the text), pending, register.
// Event: sg-stamp { tone } when it lands.

import { SgElement, defineComponent } from '../../core/component.js';
import { play } from '../../sound/index.js';
import { toneOf, scriptOf } from './stamp.core.js';

let pageLoaded = typeof document !== 'undefined' && document.readyState === 'complete';
if (!pageLoaded && typeof addEventListener === 'function') addEventListener('load', () => { pageLoaded = true; }, { once: true });

export class SgStamp extends SgElement {
  static native = '[role="status"], .sg-stamp-words';
  static observedAttributes = ['register', 'tone', 'seed', 'pending'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #landings = 0;

  get stamped() { return !this.hasAttribute('pending'); }
  /** Land the stamp and announce it. */
  stamp() { this.removeAttribute('pending'); }
  /** Take the stamp away again (for example when a hold is released). */
  lift() { this.setAttribute('pending', ''); }

  connected() {
    if (!this.native) {
      // Without the status child there is nothing for assistive tech to read; make the host the region.
      console.warn('sg-stamp: wrap the words in <p role="status">. Using the element itself as the status region.');
      this.setAttribute('role', 'status');
      this.native = this;
    }
    // role="none" on the element: a picture of news said elsewhere, so its words are not a live region
    if (this.native !== this) {
      this.native.classList.add('sg-stamp-words');
      if (this.getAttribute('role') === 'none') this.native.removeAttribute('role');
      else this.native.setAttribute('role', 'status');
    }
    this.#tagScripts();
    // A stamp added after the page loaded (a server swap, a script) is news: announce it.
    if (this.stamped && pageLoaded) this.#land();
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (name === 'pending' && old !== null && now === null && this.isConnected && this.native) this.#land();
  }

  #land() {
    this.#landings++;
    this.#tagScripts();
    this.#announce();
    this.update();
    play('complete', { register: this.register });
    this.emit('sg-stamp', { tone: toneOf(this.getAttribute('tone')) });
  }

  /** Mark each line with its script, so tracking and capitals apply to Latin only. */
  #tagScripts() {
    const lines = this.native === this ? [this] : [...this.native.children];
    for (const el of lines) el.dataset.sgScript = scriptOf(el.textContent);
    this.dataset.sgScript = scriptOf(this.native.textContent);
  }

  /** Live regions announce changes, not presence: take the words out and put them back. */
  #announce() {
    const region = this.native;
    const kids = [...region.childNodes];
    region.replaceChildren();
    requestAnimationFrame(() => { region.replaceChildren(...kids); this.update(); });
  }

  state() {
    const text = this.native?.textContent.trim().replace(/\s+/g, ' ') ?? '';
    return {
      tone: toneOf(this.getAttribute('tone')),
      seed: this.getAttribute('seed') || text,
      pending: !this.stamped,
      landings: this.#landings,
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-stamp', SgStamp);
