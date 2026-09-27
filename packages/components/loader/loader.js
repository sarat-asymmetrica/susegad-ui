// <sg-loader>: says in words what is loading, with a small decorative drawing.
// No native element fits, so the words are read from a polite status line
// (role="status") inside the element, filled just after the loader arrives so
// it is announced once. The drawing and the visible copy of the words are aria-hidden.
//
//   <sg-loader label="Loading your bookings"></sg-loader>
//   <sg-loader>Loading your bookings</sg-loader>
//
// A loader never claims how far along the work is. For that, use <sg-progress>.

import { SgElement, defineComponent } from '../../core/component.js';

/** Words used when the page gives none. */
export const STRINGS = {
  loading: { quiet: 'Loading', warm: 'Getting things ready', playful: 'On its way' },
};

/** Pure: what the loader says. The page's words win; otherwise the register's default. */
export function loaderText({ label = '', text = '', register = 'warm' } = {}) {
  const own = (label || text || '').trim();
  return own || STRINGS.loading[register] || STRINGS.loading.warm;
}

export class SgLoader extends SgElement {
  static observedAttributes = ['register', 'label'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };
  #text = null; #live = null; #own = ''; #timer = 0;

  connected() {
    // The page's own words, once: on a reconnect they are already wrapped.
    this.#text = this.querySelector(':scope > .sg-loader__text');
    this.#own = this.#text ? this.#text.dataset.own ?? '' : this.textContent.trim();
    if (!this.#text) {
      this.#text = Object.assign(document.createElement('span'), { className: 'sg-loader__text' });
      this.#text.dataset.own = this.#own;
      this.replaceChildren(this.#text);
    }
    // A live region that arrives already holding its words is often not read out.
    // So the words people see are hidden from assistive technology, and a separate
    // status line starts empty and is filled a moment after the loader arrives:
    // that change is what a screen reader announces, once.
    this.#text.setAttribute('aria-hidden', 'true');
    this.#live = this.querySelector(':scope > .sg-loader__live') ?? Object.assign(document.createElement('span'), { className: 'sg-loader__live' });
    this.#live.setAttribute('role', 'status');
    this.#live.textContent = '';
    this.append(this.#live);
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => { this.#live.textContent = this.state().text; }, 120);
    this.state();
  }

  disconnected() { clearTimeout(this.#timer); }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (name === 'label' && this.#text) this.state();
  }

  state() {
    const text = loaderText({ label: this.getAttribute('label') || '', text: this.#own, register: this.register });
    if (this.#text && this.#text.textContent !== text) this.#text.textContent = text;
    // After the first announcement, a change of words is read out as it happens.
    if (this.#live?.textContent && this.#live.textContent !== text) this.#live.textContent = text;
    return { text, register: this.register };
  }
}

defineComponent('sg-loader', SgLoader);
