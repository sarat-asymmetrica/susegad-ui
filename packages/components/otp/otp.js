// <sg-otp>: a one-time code. The native path is one input, which submits with
// the form, takes SMS autofill and works without JavaScript:
//
//   <sg-otp>
//     <label for="code">Enter the 6-digit code we sent to 98220 12345</label>
//     <input id="code" name="code" autocomplete="one-time-code" inputmode="numeric"
//            pattern="[0-9]{6}" maxlength="6" required>
//   </sg-otp>
//
// With JavaScript the same input stays the only control. It is laid
// transparently over a row of boxes, which are aria-hidden decoration: each
// shows its digit, the current box shows the caret, and the register decides
// how a digit lands. Because the input never changes, screen readers, paste,
// password managers and the phone's "from Messages" suggestion all behave
// exactly as they do for a plain input.
//
// Attributes: length (else maxlength or the pattern's count, else 6), seed,
// register, webotp (on Android Chrome, ask for the code from the SMS).
// Properties: value, complete. Event: sg-otp { value, complete } on every change.

import { SgElement, defineComponent } from '../../core/component.js';
import { digitsOf, lengthOf, insert, remove, activeBoxes, groupEnds } from './otp.core.js';

export class SgOtp extends SgElement {
  static native = 'input';
  static observedAttributes = ['register', 'length', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #boxes = null; #off = []; #focused = false; #ac = null;

  get length() {
    const i = this.native;
    return lengthOf({ length: this.getAttribute('length'), maxlength: i?.maxLength, pattern: i?.getAttribute('pattern') });
  }
  get value() { return this.native?.value ?? ''; }
  set value(v) { if (this.native) { this.native.value = digitsOf(v, this.length); this.#changed(); } }
  get complete() { return this.value.length === this.length; }

  connected() {
    const input = this.native;
    if (!input) { console.warn('sg-otp: put one <input autocomplete="one-time-code" inputmode="numeric"> inside.'); return; }
    // the native attributes that make SMS autofill and the number pad work
    if (!input.getAttribute('autocomplete')) input.setAttribute('autocomplete', 'one-time-code');
    if (!input.getAttribute('inputmode')) input.setAttribute('inputmode', 'numeric');
    if (!(input.maxLength > 0)) input.maxLength = this.length;
    input.spellcheck = false;
    input.setAttribute('autocorrect', 'off');

    const doc = this.ownerDocument, boxes = doc.createElement('div');
    boxes.className = 'sg-otp-boxes';
    boxes.setAttribute('aria-hidden', 'true');
    input.before(boxes);
    this.#boxes = boxes;
    this.#build();

    const on = (t, type, fn) => { t.addEventListener(type, fn); this.#off.push(() => t.removeEventListener(type, fn)); };
    on(input, 'beforeinput', this.#beforeInput);
    on(input, 'input', this.#input);
    on(input, 'focus', () => { this.#focused = true; this.update(); });
    on(input, 'blur', () => { this.#focused = false; this.update(); });
    on(input, 'pointerup', this.#pointer);
    on(input, 'keyup', () => this.update());
    on(doc, 'selectionchange', () => { if (this.#focused) this.update(); });
    if (input.form) on(input.form, 'reset', () => setTimeout(() => this.#changed()));
    this.#webotp();
    this.dataset.enhanced = '';
    this.#changed(false);
  }

  disconnected() {
    this.#off.splice(0).forEach(f => f());
    this.#ac?.abort();
    this.#boxes?.remove();
    this.#boxes = null;
    delete this.dataset.enhanced;
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (name === 'length' && old !== now && this.#boxes) { this.native.maxLength = this.length; this.#build(); this.#changed(false); }
  }

  #build() {
    const n = this.length, ends = groupEnds(n), doc = this.ownerDocument;
    this.style.setProperty('--sg-otp-length', n);
    this.#boxes.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const b = doc.createElement('span');
      b.className = 'sg-otp-box';
      if (ends.includes(i)) b.dataset.groupEnd = '';
      b.append(Object.assign(doc.createElement('span'), { className: 'sg-otp-digit' }));
      return b;
    }));
  }

  /** Apply an edit to the input the way the boxes suggest, and tell everyone as a normal input would. */
  #apply(r, inputType) {
    const input = this.native;
    if (r.changed) input.value = r.value;
    input.setSelectionRange(r.caret, r.caret);
    if (r.changed) input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
    else this.update();
  }

  #beforeInput = e => {
    const input = this.native, t = e.inputType, n = this.length;
    const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
    if (t.startsWith('insert') && t !== 'insertCompositionText' && t !== 'insertLineBreak') {
      const text = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
      e.preventDefault();
      this.#apply(insert(input.value, start, end, text, n), t);
    } else if (t.startsWith('delete') && !t.includes('Drag') && !t.includes('Cut')) {
      e.preventDefault();
      this.#apply(remove(input.value, start, end, t.includes('Forward'), /Word|Line|Soft|Hard/.test(t)), t);
    }
  };

  /** Whatever got in another way (autofill, composition, a script): keep the digits only. */
  #input = () => {
    const input = this.native, clean = digitsOf(input.value, this.length);
    if (clean !== input.value) {
      const caret = Math.min(clean.length, input.selectionStart ?? clean.length);
      input.value = clean;
      input.setSelectionRange(caret, caret);
    }
    this.#changed();
  };

  /** A tap on a box puts the caret there; on a filled box it selects that digit, so typing replaces it. */
  #pointer = e => {
    const input = this.native, boxes = [...this.#boxes.children];
    let i = boxes.findIndex(b => e.clientX < b.getBoundingClientRect().right);
    if (i < 0) i = boxes.length - 1;
    const v = input.value.length;
    if (i < v) input.setSelectionRange(i, i + 1); else input.setSelectionRange(v, v);
    this.update();
  };

  #webotp() {
    if (!this.hasAttribute('webotp') || !('OTPCredential' in globalThis)) return;
    this.#ac = new AbortController();
    this.native.form?.addEventListener('submit', () => this.#ac?.abort(), { once: true });
    navigator.credentials.get({ otp: { transport: ['sms'] }, signal: this.#ac.signal })
      .then(c => { if (c?.code && this.native) { this.native.value = digitsOf(c.code, this.length); this.native.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' })); } })
      .catch(() => {}); // cancelled, no SMS, or not allowed: the person types it
  }

  #changed(emit = true) {
    this.update();
    if (emit) this.emit('sg-otp', { value: this.value, complete: this.complete });
  }

  state() {
    const i = this.native, v = i?.value ?? '';
    const start = i?.selectionStart ?? v.length, end = i?.selectionEnd ?? start;
    return {
      value: v,
      length: this.length,
      active: activeBoxes(start, end, this.length, this.#focused),
      focused: this.#focused,
      complete: v.length === this.length,
      seed: this.getAttribute('seed') || i?.name || 'otp',
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-otp', SgOtp);
