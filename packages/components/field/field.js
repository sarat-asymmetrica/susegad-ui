// <sg-field>: a label and a text input or textarea, written on a ruled line.
//
//   <sg-field>
//     <label for="name">Your name</label>
//     <input id="name" name="name" required autocomplete="name">
//     <sg-field-note for="name" validate></sg-field-note>
//   </sg-field>
//
// The label and the native control do all the work: typing, autofill,
// validation, submitting with the form, and all of it without JavaScript
// (field.css draws the ruled line). The element links a label that lacks
// `for`, marks data-filled, counts characters near a maxlength, and hands the
// skin what it needs to ink the line under the words.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, countState } from './field.core.js';

export { STRINGS };

let uid = 0;

export class SgField extends SgElement {
  static native = 'input, textarea';
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  typedAt = 0;
  #off = []; #count = null; #spoken = null; #lastSaid = null;

  get control() { return this.native; }
  get multiline() { return this.native?.localName === 'textarea'; }

  connected() {
    const c = this.native;
    if (!c) return;
    const label = this.querySelector('label');
    if (label && !label.htmlFor && !label.contains(c)) {
      if (!c.id) c.id = `sg-field-${++uid}`;
      label.htmlFor = c.id;
    }
    this.dataset.kind = this.multiline ? 'area' : 'line';
    const on = (t, type, fn) => { t.addEventListener(type, fn); this.#off.push(() => t.removeEventListener(type, fn)); };
    on(c, 'input', () => { this.typedAt = performance.now(); this.#sync(); });
    on(c, 'change', () => this.#sync());
    on(c, 'focus', () => this.update());
    on(c, 'blur', () => this.update());
    on(c, 'scroll', () => this.update());
    if (c.form) on(c.form, 'reset', () => setTimeout(() => this.#sync()));
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => this.update());
      ro.observe(c);
      this.#off.push(() => ro.disconnect());
    }
    if (c.maxLength > 0) this.#buildCount(c);
    this.#sync();
  }

  disconnected() { this.#off.splice(0).forEach(f => f()); }

  /** A visible count in the last fifth of a maxlength, and a quiet voice at 20, 10 and 0 left. */
  #buildCount(c) {
    if (this.#count) return;
    const count = document.createElement('span');
    count.className = 'sg-field-count';
    count.id = `${c.id || `sg-field-${++uid}`}-count`;
    count.setAttribute('aria-hidden', 'true');
    const spoken = document.createElement('span');
    spoken.className = 'sg-field-sr';
    spoken.setAttribute('aria-live', 'polite');
    this.append(count, spoken);
    this.#count = count; this.#spoken = spoken;
  }

  #sync() {
    const c = this.native;
    if (!c) return;
    this.toggleAttribute('data-filled', c.value.length > 0);
    if (this.#count) {
      const s = countState(c.value.length, c.maxLength);
      this.#count.textContent = s.show ? s.text : '';
      this.#count.toggleAttribute('data-over', s.over);
      // spoken only at a few steps, so a screen reader is not read a number at every key
      const say = s.show && [20, 10, 0].includes(s.left) ? s.text : null;
      if (say && say !== this.#lastSaid) this.#spoken.textContent = say;
      this.#lastSaid = say ?? this.#lastSaid;
    }
    this.update();
  }

  state() {
    const c = this.native;
    return {
      value: c?.value ?? '',
      filled: !!c?.value,
      focused: !!c && document.activeElement === c,
      multiline: this.multiline,
      typedAt: this.typedAt,
      seed: c?.name || c?.id || 'field',
      visible: this.visible,
    };
  }
}

defineComponent('sg-field', SgField);
