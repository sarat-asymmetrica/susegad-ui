// <sg-stepper>: a long form walked one step at a time.
//
//   <form action="/book" method="post">
//     <sg-stepper>
//       <fieldset><legend>Your dates</legend>…</fieldset>
//       <fieldset><legend>Who is coming</legend>…</fieldset>
//       <fieldset><legend>Your details</legend>…</fieldset>
//       <button type="submit">Send the request</button>
//     </sg-stepper>
//   </form>
//
// Without JavaScript every step shows, in order, and the one button submits.
// With it, one step shows at a time with Back and Next. Hidden steps keep
// every value, Next checks only the step you are on, focus moves to the new
// step's legend, and a line says "Step 2 of 3". If the browser finds a problem
// on submit, the stepper takes you to the step it is in.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, clampStep } from './stepper.core.js';

export { STRINGS } from './stepper.core.js';

let uid = 0;
const mk = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text ?? '' });
const firstInvalid = step => [...step.elements].find(c => c.willValidate && !c.validity.valid);

export class SgStepper extends SgElement {
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  steps = []; index = 0;
  #submit = null; #home = null; #nav = null; #back = null; #next = null; #progress = null; #off = []; #jumping = false;

  connected() {
    this.steps = [...this.querySelectorAll(':scope > fieldset')];
    if (this.steps.length < 2) return; // one step needs no stepper
    this.#submit = this.querySelector(':scope > :is(button:not([type]), button[type=submit], input[type=submit])');
    this.#progress = mk('p', 'sg-stepper-progress');
    this.#progress.id = `sg-stepper-${++uid}`;
    this.#back = mk('button', 'sg-stepper-back', STRINGS.back);
    this.#next = mk('button', 'sg-stepper-next');
    this.#back.type = this.#next.type = 'button';
    this.#nav = mk('div', 'sg-stepper-nav');
    this.#nav.append(this.#back, this.#next);
    if (this.#submit) { this.#home = document.createComment('sg-stepper submit'); this.#submit.replaceWith(this.#home); this.#nav.append(this.#submit); }
    this.prepend(this.#progress);
    this.append(this.#nav);
    this.setAttribute('data-stepped', '');

    const on = (el, type, fn, opt) => { el.addEventListener(type, fn, opt); this.#off.push(() => el.removeEventListener(type, fn, opt)); };
    on(this.#back, 'click', () => this.go(this.index - 1));
    on(this.#next, 'click', () => this.next());
    // Enter in a one-line field moves on, rather than submitting a half-filled form
    on(this, 'keydown', e => {
      if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing || this.index === this.steps.length - 1) return;
      const t = e.target;
      if (t.matches?.('input:not([type=submit], [type=button], [type=reset], [type=checkbox], [type=radio], [type=file])')) { e.preventDefault(); this.next(); }
    });
    // before the browser checks on submit: if the first problem is in a hidden step, go there
    // (the browser cannot point at a field it cannot show)
    if (this.#submit) on(this.#submit, 'click', e => {
      if (this.#submit.form?.noValidate || this.#submit.formNoValidate) return;
      const at = this.steps.findIndex(s => firstInvalid(s));
      if (at < 0 || at === this.index) return;
      e.preventDefault();
      this.go(at, { focus: false });
      const bad = firstInvalid(this.steps[at]);
      bad.reportValidity(); bad.focus();
    });
    // the same for a submit from script (requestSubmit): the browser's invalid event, caught on the way down
    on(this, 'invalid', e => {
      if (this.#jumping) return;
      const at = this.steps.findIndex(s => s.contains(e.target));
      if (at < 0 || at === this.index) return;
      this.#jumping = true;
      this.go(at, { focus: false });
      requestAnimationFrame(() => { this.#jumping = false; e.target.reportValidity(); e.target.focus(); });
    }, true);
    this.go(0, { focus: false });
  }

  disconnected() {
    this.#off.splice(0).forEach(f => f());
    if (!this.#nav) return;
    if (this.#submit && this.#home) { this.#home.replaceWith(this.#submit); this.#submit.hidden = false; }
    this.#nav.remove(); this.#progress.remove();
    for (const s of this.steps) s.hidden = false;
    this.removeAttribute('data-stepped');
  }

  /** Check the step you are on; move on only if it is complete. */
  next() {
    const bad = firstInvalid(this.steps[this.index]);
    if (bad) { bad.reportValidity(); bad.focus(); return false; }
    this.go(this.index + 1);
    return true;
  }

  /** Show step i (0-based). Values in other steps are kept; nothing is ever cleared. */
  go(i, { focus = true } = {}) {
    const n = this.steps.length, from = this.index;
    this.index = clampStep(i, n);
    this.steps.forEach((s, k) => { s.hidden = k !== this.index; });
    const step = this.steps[this.index], legend = step.querySelector(':scope > legend');
    const last = this.index === n - 1, title = t => t?.querySelector(':scope > legend')?.textContent.trim();
    this.#progress.textContent = STRINGS.progress(this.index + 1, n);
    this.#back.hidden = this.index === 0;
    this.#next.hidden = last;
    this.#next.textContent = STRINGS.next(title(this.steps[this.index + 1]));
    if (this.#submit) this.#submit.hidden = !last;
    if (legend) {
      legend.tabIndex = -1;
      legend.setAttribute('aria-describedby', this.#progress.id);
      if (focus) legend.focus();
    }
    if (from !== this.index) this.emit('sg-step', { index: this.index, from });
    this.update();
  }

  state() {
    return { index: this.index, count: this.steps.length, titles: this.steps.map(s => s.querySelector(':scope > legend')?.textContent.trim() ?? ''), seed: this.getAttribute('seed') || 1 };
  }
}

defineComponent('sg-stepper', SgStepper);
