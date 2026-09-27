// <sg-radio-group>: one choice from a few. A real <fieldset> with a <legend>
// and native radios does the work: the arrow keys move and choose, one name
// allows one choice, `required` and the form submission are the browser's.
// This element adds the register's drawing to every radio in it.
//
//   <sg-radio-group>
//     <fieldset>
//       <legend>Guests</legend>
//       <label><input type="radio" name="guests" value="2" checked> 2 guests</label>
//       <label><input type="radio" name="guests" value="4"> 4 guests</label>
//     </fieldset>
//   </sg-radio-group>
//
// Attributes: orientation (column | row), seed (the hand-drawn rings), register.
// Property: value (the chosen radio's value, or '').

import { SgElement, defineComponent } from '../../core/component.js';

export class SgRadioGroup extends SgElement {
  static native = 'fieldset';
  static observedAttributes = ['register', 'orientation', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #off = null;
  #changes = 0;

  connected() {
    if (!this.native) { console.warn('sg-radio-group: wrap the radios in a <fieldset> with a <legend>.'); return; }
    const onChange = e => { if (e.target.type === 'radio') { this.#changes++; this.update(); } };
    this.native.addEventListener('change', onChange);
    // A server may swap the options (htmx): redraw for the new set.
    const mo = new MutationObserver(() => this.update());
    mo.observe(this.native, { childList: true, subtree: true });
    this.#off = () => { this.native.removeEventListener('change', onChange); mo.disconnect(); };
  }
  disconnected() { this.#off?.(); }

  get radios() { return this.native ? [...this.native.querySelectorAll('input[type="radio"]')] : []; }
  get value() { return this.radios.find(r => r.checked)?.value ?? ''; }
  set value(v) {
    const r = this.radios.find(x => x.value === String(v));
    if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  state() {
    const seed = this.getAttribute('seed') || this.native?.querySelector('legend')?.textContent.trim() || '';
    return {
      radios: this.radios.map((r, i) => ({ input: r, checked: r.checked, disabled: r.disabled, seed: `${seed}:${r.value || i}` })),
      changes: this.#changes,
      motion: this.motion,
    };
  }
}

defineComponent('sg-radio-group', SgRadioGroup);
