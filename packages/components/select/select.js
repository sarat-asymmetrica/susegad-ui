// <sg-select>: a native <select>, kept native. The browser's own control keeps
// its keyboard, its screen-reader role and its place in the form; this element
// only follows its value so a skin can answer a choice, and names the state for
// styling. Where the browser supports customizable select (appearance:
// base-select), select.css draws the button, the caret and the picker; elsewhere
// the browser's own select shows, styled as far as it allows.
//
//   <sg-select>
//     <label for="guests">Guests</label>
//     <select id="guests" name="guests"><option>1</option><option selected>2</option></select>
//   </sg-select>

import { SgElement, defineComponent } from '../../core/component.js';

/** Pure: what a skin needs to know about the select. */
export function selectState({ value = '', text = '', disabled = false, invalid = false, open = false, changed = 0 } = {}) {
  return { value, text, disabled, invalid, open, changed };
}

export class SgSelect extends SgElement {
  static native = 'select';
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };
  #changed = 0; #off = null;

  connected() {
    const s = this.native;
    if (!s) return;
    const on = () => { this.#changed++; this.update(); };
    const check = () => this.update();
    s.addEventListener('change', on);
    s.addEventListener('blur', check);
    s.addEventListener('invalid', check);
    // the picker opening and closing (customizable select reports it as :open)
    s.addEventListener('toggle', check);
    this.#off = () => { s.removeEventListener('change', on); s.removeEventListener('blur', check); s.removeEventListener('invalid', check); s.removeEventListener('toggle', check); };
  }

  disconnected() { this.#off?.(); }

  state() {
    const s = this.native;
    if (!s) return selectState();
    let open = false;
    try { open = s.matches(':open'); } catch { /* no :open in this browser */ }
    return selectState({
      value: s.value,
      text: s.selectedOptions[0]?.textContent.trim() ?? '',
      disabled: s.disabled,
      invalid: s.matches(':user-invalid'),
      open,
      changed: this.#changed,
    });
  }
}

defineComponent('sg-select', SgSelect);
