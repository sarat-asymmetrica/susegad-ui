// <sg-now-note>: a short "what I'm up to right now" note, with the date it was
// last updated and an availability state in words. It says how long ago that
// was, and, once the note is older than stale-after days, that it may be out
// of date.
//
//   <sg-now-note stale-after="45">
//     <section aria-labelledby="now">
//       <h2 id="now">Now</h2>
//       <p>Building an order page for a kids' clothing brand.</p>
//       <p class="sg-now-state"><sg-badge tone="success">Taking on one new project</sg-badge></p>
//       <p class="sg-now-updated">Updated <time datetime="2026-09-27">27 September 2026</time></p>
//     </section>
//   </sg-now-note>
//
// Attributes: stale-after (days, default 45), today (an ISO date to count
// from, for demos and tests; defaults to the reader's today), seed, register.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, ageInWords, isStale, todayIso } from './now-note.core.js';

export class SgNowNote extends SgElement {
  static native = 'section, article, aside, div';
  static observedAttributes = ['register', 'stale-after', 'today', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #age = null; #stale = null;

  connected() { this.#mark(); }
  attributeChangedCallback(name, old, now) { super.attributeChangedCallback(name, old, now); if (this.native && old !== now) this.#mark(); }

  get updated() { return this.native?.querySelector('.sg-now-updated time[datetime]')?.getAttribute('datetime') ?? null; }

  #mark() {
    const box = this.native, when = this.updated;
    if (!box) return;
    if (!when) { console.warn('sg-now-note: add <p class="sg-now-updated">Updated <time datetime="YYYY-MM-DD">…</time></p>; a now note needs its date.'); }
    const today = this.getAttribute('today') || todayIso();
    const age = when ? ageInWords(when, today) : '';
    const time = box.querySelector('.sg-now-updated time');
    if (age && time) {
      this.#age ??= this.ownerDocument.createElement('span');
      this.#age.className = 'sg-now-age';
      this.#age.textContent = `, ${age}`;
      time.after(this.#age);
    } else this.#age?.remove();
    const stale = isStale(when, today, +(this.getAttribute('stale-after') || 45));
    this.toggleAttribute('data-stale', stale);
    if (stale) {
      this.#stale ??= this.ownerDocument.createElement('p');
      this.#stale.className = 'sg-now-stale';
      this.#stale.textContent = STRINGS.stale;
      box.append(this.#stale);
    } else this.#stale?.remove();
    this.update();
  }

  state() {
    const title = this.native?.querySelector('h1, h2, h3, h4')?.textContent.trim() ?? '';
    return { seed: this.getAttribute('seed') || `${title}|${this.updated}`, stale: this.hasAttribute('data-stale'), motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-now-note', SgNowNote);
