// <sg-check>: a checkbox. The native <input type="checkbox"> inside it does
// the work (submitting, validation, Space, what a screen reader says); this
// element adds the register's drawing and two things HTML cannot say itself.
//
//   <sg-check>
//     <label><input type="checkbox" name="rules" required> I have read the house rules</label>
//   </sg-check>
//
//   <sg-check controls="x-breakfast x-airport">          a "select all" box: checked,
//     <label><input type="checkbox"> All extras</label>    mixed or clear from its children
//   </sg-check>
//
// Attributes: indeterminate (shows "some"; HTML has no attribute for it),
// controls (ids of the child checkboxes), seed (the hand-drawn marks), register.

import { SgElement, defineComponent } from '../../core/component.js';
import { triState } from './check.core.js';

export class SgCheck extends SgElement {
  static native = 'input[type="checkbox"]';
  static observedAttributes = ['register', 'indeterminate', 'controls', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #off = [];
  #kidsOff = [];

  connected() {
    const input = this.native;
    if (!input) { console.warn('sg-check: put an <input type="checkbox"> inside it.'); return; }
    input.indeterminate = this.hasAttribute('indeterminate');
    const onChange = () => {
      // A click always clears "some"; keep the attribute in step with it.
      if (!input.indeterminate) this.removeAttribute('indeterminate');
      if (this.#children().length) this.#setChildren(input.checked);
      this.update();
    };
    input.addEventListener('change', onChange);
    this.#off.push(() => input.removeEventListener('change', onChange));
    this.#watchChildren();
  }
  disconnected() { [...this.#off.splice(0), ...this.#kidsOff.splice(0)].forEach(f => f()); }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (!this.native) return;
    if (name === 'indeterminate') this.native.indeterminate = now !== null;
    if (name === 'controls' && this.isConnected) this.#watchChildren();
  }

  /** The child checkboxes a "select all" box controls. */
  #children() {
    const ids = (this.getAttribute('controls') || '').split(/\s+/).filter(Boolean);
    return ids.map(id => this.ownerDocument.getElementById(id)).filter(el => el?.type === 'checkbox');
  }

  #watchChildren() {
    this.#kidsOff.splice(0).forEach(f => f());
    const kids = this.#children();
    if (!kids.length) return;
    this.native.setAttribute('aria-controls', kids.map(k => k.id).join(' '));
    const sync = () => {
      const s = triState(kids.map(k => k.checked));
      this.native.checked = s === 'checked';
      this.toggleAttribute('indeterminate', s === 'mixed');
      this.update();
    };
    for (const k of kids) {
      k.addEventListener('change', sync);
      this.#kidsOff.push(() => k.removeEventListener('change', sync));
    }
    sync();
  }

  #setChildren(on) {
    for (const k of this.#children()) {
      if (k.checked === on || k.disabled) continue;
      k.checked = on;
      // Let forms, other components and the children's own drawings hear it.
      k.dispatchEvent(new Event('input', { bubbles: true }));
      k.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  get checked() { return !!this.native?.checked; }
  set checked(v) { if (this.native) { this.native.checked = !!v; this.native.dispatchEvent(new Event('change', { bubbles: true })); } }

  state() {
    const i = this.native;
    return {
      checked: !!i?.checked,
      indeterminate: !!i?.indeterminate,
      disabled: !!i?.disabled,
      seed: this.getAttribute('seed') || this.textContent.trim(),
      motion: this.motion,
    };
  }
}

defineComponent('sg-check', SgCheck);
