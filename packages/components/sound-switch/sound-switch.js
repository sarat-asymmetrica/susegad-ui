// <sg-sound-switch>: the one control that turns Susegad's sound switch on or
// off, site-wide, over a native <input type="checkbox" role="switch">.
//
//   <sg-sound-switch>
//     <label><input type="checkbox" role="switch"> Sound</label>
//     <small class="sg-sound-switch-note">Turning sound on needs JavaScript.</small>
//   </sg-sound-switch>
//
// Toggling it is the user's own gesture: the change handler calls
// setSoundOn(), which is switch.js's cue to resume the audio context, so a
// tap that turns sound on can play its own confirmation immediately.
// Without JavaScript the checkbox still exists and still reads as a switch,
// but nothing it does has an effect (there is no sound without JavaScript);
// the note beside it says so, and this element hides that note once it runs.

import { SgElement, defineComponent } from '../../core/component.js';
import { soundOn, setSoundOn, onSoundChange, play } from '../../sound/index.js';

export class SgSoundSwitch extends SgElement {
  static native = 'input[type="checkbox"]';
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #off = null;

  connected() {
    const input = this.native;
    if (!input) { console.warn('sg-sound-switch: put an <input type="checkbox" role="switch"> inside it.'); return; }
    if (input.getAttribute('role') !== 'switch') input.setAttribute('role', 'switch');
    input.checked = soundOn();
    this.dataset.ready = ''; // css: the "needs JavaScript" note hides once this element is live
    const onChange = () => {
      setSoundOn(input.checked); // itself the user gesture: switch.js resumes the audio context here
      if (input.checked) play('confirm', { register: this.register }); // the switch's own first sound
      this.update();
    };
    input.addEventListener('change', onChange);
    // another switch on the page, or the page's own code, changed it: follow, never loop back
    const unsub = onSoundChange(on => { if (input.checked !== on) { input.checked = on; this.update(); } });
    this.#off = () => { input.removeEventListener('change', onChange); unsub(); };
  }
  disconnected() { this.#off?.(); this.#off = null; }

  /** The switch's current state. Read only: change it through the checkbox, so it stays one user gesture. */
  get on() { return !!this.native?.checked; }

  state() {
    return { on: this.on, motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-sound-switch', SgSoundSwitch);
