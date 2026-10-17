// <sg-consent>: the plain notice a form shows before it keeps someone's details.
//
//   <sg-consent site="Mandovi Conclave"
//               fields="your name and your email address"
//               purpose="confirm your place and send you the ticket"
//               period="30 days after the event"
//               contact="hello@conclave.example.in"
//               complain="If you are not happy with how we handled this, you can complain to …"></sg-consent>
//
// What is collected, why, for how long, whom to ask, how to withdraw, where to complain, and a box that
// is never ticked for the visitor. The words are in consent.strings.js (English and Konkani) and the
// markup is written by consent.core.js, the same markup a build script writes ahead of time, so a page
// can carry the notice as plain HTML and read with no script at all. When the element is empty it
// writes the notice itself; when the notice is already there it only enhances it.
//
// A value the site has not given shows as a visible [placeholder], and the element says so once in the
// console, so a sample is never published by mistake. It is not legal advice: see consent.docs.md.

import { SgElement, defineComponent } from '../../core/component.js';
import { langOf } from '../../core/strings.js';
import '../check/check.js';
import '../field-note/field-note.js';
import { consentInner, levelOf, nextId, unfilled, VALUES } from './consent.core.js';

let said = false;

export class SgConsent extends SgElement {
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };
  static observedAttributes = ['register', ...VALUES, 'complain', 'level'];

  #seed = 0; #off = [];

  /** The box a person ticks. */
  get box() { return this.querySelector('input[type="checkbox"][name="consent"]'); }
  get checked() { return !!this.box?.checked; }
  /** The placeholders still in the notice, as written. Empty when the site has filled everything in. */
  get incomplete() { return unfilled(this.textContent); }

  connected() {
    if (!this.id) this.id = nextId();
    this.#seed = [...this.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 13);
    // an empty element writes the notice; one that already holds it (a page written ahead of time) is left as it is
    if (!this.box) this.#write();
    this.#wire();
    this.#flag();
  }
  disconnected() { this.#off.splice(0).forEach(f => f()); }

  #write() {
    const values = Object.fromEntries([...VALUES, 'complain'].map(k => [k, this.getAttribute(k)]));
    this.dataset.written = '';
    this.innerHTML = consentInner({ lang: langOf(this), values, id: this.id, level: levelOf(this.getAttribute('level')) });
  }

  #wire() {
    this.#off.splice(0).forEach(f => f());
    // the notice is a group named by its heading, so a screen reader says what the box belongs to
    if (!this.hasAttribute('role')) this.setAttribute('role', 'group');
    const h = this.querySelector('.sg-consent-heading');
    if (h) { if (!h.id) h.id = `${this.id}-h`; if (!this.hasAttribute('aria-labelledby')) this.setAttribute('aria-labelledby', h.id); }
    const box = this.box;
    if (!box) return;
    const on = () => this.emit('sg-consent', { checked: box.checked, id: this.id });
    box.addEventListener('change', on);
    this.#off.push(() => box.removeEventListener('change', on));
  }

  /** A notice with a [placeholder] left in it is a sample: mark it, and say so once in the console. */
  #flag() {
    const left = this.incomplete;
    this.toggleAttribute('data-incomplete', left.length > 0);
    if (left.length && !said) {
      said = true;
      console.warn(`sg-consent: this notice still has ${left.length} placeholder${left.length === 1 ? '' : 's'} (${left.slice(0, 3).join(' ')}). Fill them in, and get a legal read of the notice, before the site goes live.`);
    }
    this.update();
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (old === now || !this.isConnected || !this.hasAttribute('data-written')) return;
    if (VALUES.includes(name) || name === 'complain' || name === 'level') { this.#write(); this.#wire(); this.#flag(); }
  }

  state() { return { incomplete: this.incomplete.length > 0, checked: this.checked, seed: this.#seed }; }
}

defineComponent('sg-consent', SgConsent);
