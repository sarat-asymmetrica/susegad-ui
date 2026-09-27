// <sg-field-note>: the note beside a form field that says what is wrong and how to fix it.
//
//   <input id="email" type="email" required>
//   <sg-field-note for="email" validate></sg-field-note>
//
// `validate` follows the browser's constraint validation and words the message
// (data-value-missing="…" and friends override it; setCustomValidity() text is
// shown as it is). Without it, the note shows the text it holds, as a server
// would render it. While it shows an error, the field has aria-invalid="true"
// and the note's id in aria-describedby. tone="hint" is never an error.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, pickMessage, nextShown, tokenList, valueRuns } from './field-note.core.js';

export { STRINGS };

// the field note is small and decorative; one mark says "error" to sighted readers, text says it to everyone
const MARK = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.4"/><path d="M8 4.6v4.2M8 11.2v.1"/></svg>';

let uid = 0;

/**
 * A field's name as its label shows it, from a copy of the label without any
 * notes, hidden text or pictures inside it, so a note that sits in the label
 * can never feed its own words back into the name. aria-labelledby wins when set.
 */
function labelText(f) {
  const by = f.getAttribute('aria-labelledby');
  const from = by ? by.split(/\s+/).map(id => document.getElementById(id)).filter(Boolean) : [f.labels?.[0]].filter(Boolean);
  const text = from.map(el => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll('sg-field-note, [aria-hidden="true"], .sg-vh, input, select, textarea, button').forEach(n => n.remove());
    return copy.textContent;
  }).join(' ');
  return text.replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim() || f.getAttribute('aria-label') || '';
}

// A note must not appear in the middle of a click: pressing Send blurs the
// field, the note would push Send down, and the click would miss it. While a
// pointer is down, blur steps wait until the click has finished.
let pressing = false;
const afterPress = new Set();
if (globalThis.document) {
  addEventListener('pointerdown', () => { pressing = true; }, true);
  const release = () => setTimeout(() => { pressing = false; afterPress.forEach(f => f()); afterPress.clear(); });
  addEventListener('pointerup', release, true);
  addEventListener('pointercancel', release, true);
}

export class SgFieldNote extends SgElement {
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };
  static observedAttributes = ['register', 'for', 'tone', 'validate'];

  field = null;
  #s = { dirty: false, shown: false }; #key = '';
  #text = null; #sr = null; #off = []; #weSetInvalid = false; #message = ''; #quietly = false; #seed = 0;

  get tone() { return this.getAttribute('tone') === 'hint' ? 'hint' : 'error'; }
  get validating() { return this.hasAttribute('validate'); }
  get shown() { return this.tone === 'hint' ? !!this.#message : this.#s.shown && !!this.#message; }
  get message() { return this.#message; }

  connected() {
    if (!this.id) this.id = `sg-field-note-${++uid}`;
    this.#seed = [...this.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    if (!this.#text) this.#build();
    this.#bind();
    // a note inside its field's label would become part of the field's name: step out, just after it
    const label = this.parentElement?.closest('label');
    if (label && this.field && label.contains(this.field)) label.after(this);
    this.#render(); // now that the field is known, wire what a server-rendered note already says
  }
  disconnected() { this.#unbind(); this.#describe(false); this.#key = ''; }

  #build() {
    const authored = this.textContent.replace(/\s+/g, ' ').trim();
    const mark = document.createElement('span');
    mark.className = 'sg-note-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = MARK;
    this.#sr = document.createElement('span');
    this.#sr.className = 'sg-note-sr';
    this.#text = document.createElement('span');
    this.#text.className = 'sg-note-text';
    const deco = document.createElement('span');
    deco.className = 'sg-note-deco';
    deco.setAttribute('aria-hidden', 'true');
    this.replaceChildren(deco, mark, this.#sr, this.#text);
    // the note itself is the live region, so it must exist (empty) before any message arrives
    this.setAttribute('aria-live', 'polite');
    if (authored) { this.#message = authored; this.#s = nextShown(this.#s, 'server', false); }
  }

  #findField() {
    const id = this.getAttribute('for');
    if (id) return this.getRootNode().getElementById?.(id) ?? document.getElementById(id);
    let n = this.previousElementSibling;
    while (n && !n.matches('input, select, textarea')) n = n.previousElementSibling;
    return n ?? this.parentElement?.querySelector('input, select, textarea') ?? null;
  }

  #bind() {
    this.#unbind();
    this.field = this.#findField();
    const f = this.field;
    if (!f) return;
    const on = (t, type, fn, opts) => { t.addEventListener(type, fn, opts); this.#off.push(() => t.removeEventListener(type, fn, opts)); };
    if (this.validating) {
      on(f, 'input', () => this.#step('input'));
      on(f, 'change', () => this.#step('change'));
      // a component that empties a field as part of a new choice (date-range starting a new stay)
      // sends sg-reset: the field starts over, and nothing is wrong until the person leaves it empty
      on(f, 'sg-reset', () => this.#step('reset'));
      on(f, 'blur', () => { const go = () => this.#step('blur'); pressing ? afterPress.add(go) : go(); });
      // a submit attempt: show every note, quietly (focus goes to the first problem, which reads its note)
      on(f, 'invalid', e => { e.preventDefault(); this.#step('submit'); this.#focusFirstInvalid(); });
      if (f.form) {
        on(f.form, 'reset', () => queueMicrotask(() => this.#step('reset')));
        // a form with novalidate still gets its notes, without the browser's bubbles
        on(f.form, 'submit', e => { if (f.form.noValidate && !f.checkValidity()) { e.preventDefault(); } });
      }
    }
  }
  #unbind() { this.#off.splice(0).forEach(f => f()); }

  #facts() {
    const f = this.field;
    const label = labelText(f);
    const kind = f.type === 'checkbox' ? 'check' : f.type === 'radio' || f.localName === 'select' ? 'choice' : 'text';
    return {
      messages: { ...this.dataset }, type: f.type, kind, label,
      minLength: f.minLength, maxLength: f.maxLength, min: f.getAttribute('min'), max: f.getAttribute('max'),
      step: f.getAttribute('step'), title: f.getAttribute('title'), length: String(f.value ?? '').length,
      validationMessage: f.validationMessage, lang: f.closest('[lang]')?.lang || document.documentElement.lang,
    };
  }

  #step(event) {
    const f = this.field;
    if (!f) return;
    const valid = f.validity.valid;
    this.#s = nextShown(this.#s, event, valid);
    this.#message = pickMessage(f.validity, this.#facts()).message;
    this.#quietly = event === 'submit';
    this.#render();
  }

  #focusFirstInvalid() {
    const form = this.field?.form;
    // as the browser does on submit: the first field with a problem takes focus (once, from its own note)
    queueMicrotask(() => {
      const first = form ? [...form.elements].find(el => el.willValidate && !el.validity.valid) : this.field;
      if (first === this.field && document.activeElement !== first) first.focus();
    });
  }

  #render() {
    const shown = this.shown;
    // nothing a person would read has changed: write nothing, so nothing is read again
    const key = `${shown}|${this.tone}|${this.#message}`;
    if (key === this.#key) { this.#quietly = false; return; }
    this.#key = key;
    // a submit shows many notes at once; the focused field reads its own, so the others stay silent
    this.setAttribute('aria-live', this.#quietly ? 'off' : 'polite');
    this.#quietly = false;
    this.#sr.textContent = shown ? STRINGS.prefix[this.tone] : '';
    // one write: the words, with any value to copy already in its own span (styled in warm and playful)
    this.#text.replaceChildren(...(shown ? valueRuns(this.#message) : []).map(([t, v]) => v ? Object.assign(document.createElement('span'), { className: 'sg-field-note__value', textContent: t }) : t));
    this.toggleAttribute('data-shown', shown);
    this.#describe(shown);
    this.update();
    this.emit('sg-field-note', { shown, message: shown ? this.#message : '', field: this.field });
  }

  #describe(shown) {
    const f = this.field;
    if (!f) return;
    const next = tokenList(f.getAttribute('aria-describedby'), this.id, shown);
    next ? f.setAttribute('aria-describedby', next) : f.removeAttribute('aria-describedby');
    const invalid = shown && this.tone === 'error';
    if (invalid) { if (f.getAttribute('aria-invalid') !== 'true') { f.setAttribute('aria-invalid', 'true'); this.#weSetInvalid = true; } }
    else if (this.#weSetInvalid) { f.removeAttribute('aria-invalid'); this.#weSetInvalid = false; }
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (old === now || !this.#text) return;
    this.#key = ''; // rewire, even when the words are the same
    if (name === 'for' || name === 'validate') { this.#describe(false); this.#bind(); this.#render(); }
    if (name === 'tone') this.#render();
  }

  /** Show a message from the page or a server (for example after a failed save). Empty text clears it. */
  setMessage(text) {
    this.#message = String(text ?? '').replace(/\s+/g, ' ').trim();
    this.#s = nextShown(this.#s, 'server', !this.#message);
    this.#render();
  }
  /** Check the field now, as a submit would. Returns whether it is valid. */
  check() { this.#step('submit'); return !!this.field?.validity.valid; }

  state() {
    return { shown: this.shown, message: this.shown ? this.#message : '', tone: this.tone, seed: this.#seed };
  }
}

defineComponent('sg-field-note', SgFieldNote);
