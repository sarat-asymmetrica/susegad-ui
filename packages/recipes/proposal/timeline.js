// <sg-timeline>: a plan you can walk through. The steps are an ordered list
// written at build time (timeline.core.js), readable in order with no script
// and in print. Here, a native range input steps through them: the current
// step is marked, scrolled into view within the list, and said in words.

import { readSteps, sayStep, stepAt, STRINGS } from './timeline.core.js';

export { STRINGS };
let uid = 0;

export class SgTimeline extends (globalThis.HTMLElement ?? class {}) {
  #range = null; #said = null; #items = [];

  connectedCallback() {
    if (this.#range) return;
    this.#items = [...this.querySelectorAll('ol > li')];
    const n = this.#items.length;
    if (n < 2) return;
    // the words for each step, from the list itself
    const steps = this.#items.map(li => ({
      when: li.querySelector('.timeline__when')?.textContent.trim() || null,
      title: li.querySelector('.timeline__title')?.textContent.trim() || li.textContent.trim(),
      text: li.querySelector('.timeline__text')?.textContent.trim() || '',
    }));
    const id = `timeline-${++uid}`;
    const box = document.createElement('div');
    box.className = 'timeline__scrub';
    box.innerHTML = `<label for="${id}">${this.getAttribute('label') ? `${STRINGS.scrub}: ${this.getAttribute('label')}` : STRINGS.scrub}</label>
<input type="range" id="${id}" min="0" max="${n - 1}" step="1" value="0">
<p class="timeline__said" role="status" aria-live="polite"></p>`;
    this.#range = box.querySelector('input');
    this.#said = box.querySelector('p');
    this.#said.textContent = sayStep(steps, 0); // in place before the box goes in, so it is shown, not announced
    this.querySelector('ol').before(box);
    const show = (announce) => {
      const i = stepAt(this.#range.value / (n - 1), n);
      this.#items.forEach((li, k) => {
        li.toggleAttribute('data-done', k < i);
        if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      this.#range.setAttribute('aria-valuetext', sayStep(steps, i));
      if (announce) this.#said.textContent = sayStep(steps, i);
      this.dataset.step = String(i + 1);
    };
    this.#range.addEventListener('input', () => show(true));
    // clicking a step moves the scrubber to it
    this.#items.forEach((li, k) => li.addEventListener('click', () => { this.#range.value = String(k); show(true); }));
    show(false);
  }
}

if (globalThis.customElements && !customElements.get('sg-timeline')) customElements.define('sg-timeline', SgTimeline);

export { readSteps };
