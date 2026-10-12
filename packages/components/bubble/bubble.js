// <sg-bubble>: a speech, thought or shout bubble. A native figure holds the
// words as the page's own paragraph and, if it likes, a figcaption naming the
// speaker; the skins draw the bubble around them and, in warm and playful, lay
// the words into its real shape, line by line, still real text.
//
//   <sg-bubble kind="thought" tail="bottom-left" speaker="Crow">
//     <figure><p>Perhaps the fish will still be there tomorrow.</p></figure>
//   </sg-bubble>
//
// Attributes: kind (speech | thought | shout), tail (bottom-left, bottom,
// bottom-right, top-left, top, top-right, left, right, none), speaker and label
// (the figcaption a screen reader gets when the figure has none), size (sm, md,
// lg), seed (the pen's hand; defaults to the words), register.

import { SgElement, defineComponent } from '../../core/component.js';
import { kindOf, tailOf, captionFor } from './bubble.words.js';

/** A skin that will not load must not leave the words waiting: every bubble still waiting shows them as the page wrote them (the error is passed on, so the core still warns). */
function giveUp(err) {
  for (const el of document.querySelectorAll('sg-bubble[data-wait]')) el.removeAttribute('data-wait');
  throw err;
}

export class SgBubble extends SgElement {
  static native = 'figure';
  static observedAttributes = ['register', 'kind', 'tail', 'seed', 'speaker', 'label'];
  static skins = {
    quiet: () => import('./skins/quiet.js').catch(giveUp),
    warm: () => import('./skins/warm.js').catch(giveUp),
    playful: () => import('./skins/playful.js').catch(giveUp),
  };

  connected() {
    if (!this.native) console.warn('sg-bubble: wrap the words in <figure><p>…</p></figure>.');
    this.#caption();
    // words wait unseen for the arrival only where there is one to protect (not in quiet, not under reduced motion)
    if (this.motion === 'ambient' || this.motion === 'full') this.setAttribute('data-wait', '');
  }

  attributeChangedCallback(name, old, now) {
    if (name === 'speaker' || name === 'label' || name === 'kind') this.#caption();
    super.attributeChangedCallback(name, old, now);
  }

  /** A speaker the page names but does not caption gets a figcaption only a screen reader sees: "Crow thinks". A caption the page wrote is never touched. */
  #caption() {
    const fig = this.native;
    if (!fig) return;
    const made = fig.querySelector(':scope > figcaption[data-made]'), own = fig.querySelector(':scope > figcaption:not([data-made])');
    const text = own ? '' : captionFor(this.getAttribute('kind'), this.getAttribute('speaker'), this.getAttribute('label'));
    if (!text) { made?.remove(); return; }
    const c = made ?? Object.assign(document.createElement('figcaption'), { className: 'sg-bubble-who' });
    c.dataset.made = '';
    c.textContent = text;
    // the verbs are English: say so, unless the page wrote the whole caption (`label`), which is in its own language
    if (this.getAttribute('label')) c.removeAttribute('lang'); else c.lang = 'en';
    if (!made) fig.append(c);
  }

  state() {
    const p = this.native?.querySelector('p')?.textContent ?? '';
    return { kind: kindOf(this.getAttribute('kind')), tail: this.hasAttribute('tail') ? tailOf(this.getAttribute('tail')) : 'bottom-left', seed: this.getAttribute('seed') || p.replace(/\s+/g, ' ').trim().slice(0, 60), motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-bubble', SgBubble);
