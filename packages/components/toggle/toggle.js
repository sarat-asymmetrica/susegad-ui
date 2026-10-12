// <sg-toggle>: an on/off switch. The native <input type="checkbox"
// role="switch"> inside it does the work: it submits with the form, takes
// Space, and a screen reader says "switch, on" or "off". This element adds
// the register's drawing.
//
//   <sg-toggle>
//     <label><input type="checkbox" role="switch" switch name="breakfast" value="yes"> Breakfast every morning</label>
//   </sg-toggle>
//
// Attributes: seed (the lamp's flicker), register. Property: checked.
// Use a switch for something that takes effect now or is a setting; use a
// checkbox for a choice that is sent with the form later. Both submit.

import { SgElement, defineComponent } from '../../core/component.js';
import { cue } from '../../sound/index.js';

export class SgToggle extends SgElement {
  static native = 'input[type="checkbox"]';
  static observedAttributes = ['register', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #off = null;

  connected() {
    const input = this.native;
    if (!input) { console.warn('sg-toggle: put an <input type="checkbox" role="switch"> inside it.'); return; }
    // Say "switch", not "checkbox". Written in the HTML it works without JavaScript too.
    if (input.getAttribute('role') !== 'switch') input.setAttribute('role', 'switch');
    // The native switch: iPhones give a system haptic on a real tap; other engines ignore the attribute.
    input.toggleAttribute('switch', true);
    // Sound and haptic on confirm only: turning it on says so, turning it off is quiet (behind the sound switch, never on load).
    const onChange = () => { if (input.checked) cue('confirm', { register: this.register }); this.update(); };
    input.addEventListener('change', onChange);
    this.#off = () => input.removeEventListener('change', onChange);
  }
  disconnected() { this.#off?.(); }

  get checked() { return !!this.native?.checked; }
  set checked(v) {
    if (!this.native || this.native.checked === !!v) return;
    this.native.checked = !!v;
    this.native.dispatchEvent(new Event('input', { bubbles: true }));
    this.native.dispatchEvent(new Event('change', { bubbles: true }));
  }

  state() {
    const i = this.native;
    return {
      on: !!i?.checked,
      disabled: !!i?.disabled,
      seed: this.getAttribute('seed') || this.textContent.trim(),
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-toggle', SgToggle);
