// <sg-progress>: enhances a native <progress>. The native element carries the
// value, the role and the accessible name; the skin is decoration.
//
//   <sg-progress label="Uploading photos"><progress value="0.4" max="1">40%</progress></sg-progress>
//
// Real progress: a determinate indicator moves only when its value changes. Without a
// value the native element is indeterminate, and the words say what is happening.

import { SgElement, defineComponent } from '../../core/component.js';

/** Every string people read, per register where the register changes the words. */
export const STRINGS = {
  working: { quiet: 'In progress', warm: 'Working on it', playful: 'On its way' },
  // playful says Done too: "Ready" read as "ready to start" beside a file name
  done: { quiet: 'Complete', warm: 'Done', playful: 'Done' },
  percent: n => `${n}%`,
};

/**
 * Pure: the state a skin draws. `value` and `max` as the native element holds
 * them; `determinate` is false when the element has no value attribute.
 */
export function progressState({ value = 0, max = 1, determinate = true, label = '', register = 'warm' } = {}) {
  const m = max > 0 ? max : 1;
  const fraction = determinate ? Math.min(1, Math.max(0, value / m)) : null;
  const percent = fraction === null ? null : Math.floor(fraction * 100 + 1e-9);
  const done = fraction === 1;
  const words = STRINGS[done ? 'done' : 'working'];
  return {
    label, determinate, fraction, percent, done, register,
    // what the visible value line says: the number, or in words when there is no number
    text: fraction === null ? words[register] ?? words.warm : done ? words[register] ?? words.warm : STRINGS.percent(percent),
  };
}

let uid = 0;

export class SgProgress extends SgElement {
  static native = 'progress';
  static observedAttributes = ['register', 'label'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };
  #mo = null; #labelEl = null; #valueEl = null; #last = null;

  connected() {
    const p = this.native;
    if (!p) return;
    // The visible label names the native <progress>; the value line is for sighted readers only,
    // since the native element already exposes its value.
    const head = document.createElement('span');
    head.className = 'sg-progress__head';
    this.#labelEl = Object.assign(document.createElement('span'), { className: 'sg-progress__label', id: `sg-progress-${++uid}` });
    this.#valueEl = Object.assign(document.createElement('span'), { className: 'sg-progress__value' });
    this.#valueEl.setAttribute('aria-hidden', 'true');
    head.append(this.#labelEl, this.#valueEl);
    this.prepend(head);
    p.classList.add('sg-progress__native');
    this.#mo = new MutationObserver(() => { this.state(); this.update(); });
    this.#mo.observe(p, { attributes: true, attributeFilter: ['value', 'max'] });
    this.state(); // the words work even if no skin ever loads
  }

  attributeChangedCallback(name, old, now) { super.attributeChangedCallback(name, old, now); if (name === 'label' && this.#labelEl) this.state(); }

  disconnected() {
    this.#mo?.disconnect();
    this.querySelector(':scope > .sg-progress__head')?.remove();
    this.native?.removeAttribute('aria-labelledby');
    this.native?.classList.remove('sg-progress__native');
  }

  /** The value, as a number, or null when indeterminate. Sets the native element. */
  get value() { return this.native?.hasAttribute('value') ? this.native.value : null; }
  set value(v) {
    if (!this.native) return;
    v === null || v === undefined ? this.native.removeAttribute('value') : (this.native.value = v);
  }

  state() {
    const p = this.native;
    const s = progressState({
      value: p?.value ?? 0, max: p?.max ?? 1, determinate: !!p?.hasAttribute('value'),
      label: this.getAttribute('label') || '', register: this.register,
    });
    if (this.#labelEl) {
      this.#labelEl.textContent = s.label;
      this.#labelEl.hidden = !s.label;
      this.#valueEl.textContent = s.text;
      // Name the native element by the visible label; without one, leave the page's own aria-label alone.
      s.label ? p.setAttribute('aria-labelledby', this.#labelEl.id) : p.removeAttribute('aria-labelledby');
    }
    if (s.done && this.#last && !this.#last.done) this.emit('sg-complete', { label: s.label });
    this.#last = s;
    return s;
  }
}

defineComponent('sg-progress', SgProgress);
