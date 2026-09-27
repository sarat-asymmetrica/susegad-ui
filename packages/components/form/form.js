// <sg-form>: a native form, validated by the browser, whose submit says what is happening.
//
//   <sg-form>
//     <form action="/enquire" method="post"> … fields … <button>Send</button> </form>
//   </sg-form>
//
// Without JavaScript the <form> validates and submits on its own. With it:
//   - every field gets a field note (unless it has one, or notes="off"), and the
//     browser's bubbles give way to them; a submit with problems focuses the
//     first and says how many there are;
//   - a valid submit fires `sg-submit`. A listener that calls
//     detail.respondWith(promise) takes over sending; with `fetch`, the form
//     posts itself; otherwise the browser submits as usual;
//   - while the work is pending the form says "Sending", then "Sent" or why
//     it could not send, in one polite voice. Skins draw it (Loader, Stamp).

import { SgElement, defineComponent } from '../../core/component.js';
import { play } from '../../sound/index.js';
import { STRINGS, next, words, fieldName, SENDING_AFTER_MS } from './form.core.js';
import '../field-note/field-note.js';

export { STRINGS };

let uid = 0;
const FIELDS = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea';

export class SgForm extends SgElement {
  static native = 'form';
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  status = 'idle';
  #words = ''; #detail = {}; #off = []; #voice = null; #art = null; #submitter = null;

  get form() { return this.native; }

  connected() {
    const f = this.form;
    if (!f) return;
    f.noValidate = true; // the notes speak instead of the browser's bubbles; JavaScript only
    this.#buildStatus(f);
    if (this.getAttribute('notes') !== 'off') this.#addNotes(f);
    const on = (type, fn, opts) => { f.addEventListener(type, fn, opts); this.#off.push(() => f.removeEventListener(type, fn, opts)); };
    on('submit', e => this.#submit(e));
    on('reset', () => this.#set('reset'));
  }
  disconnected() { this.#off.splice(0).forEach(fn => fn()); }

  #buildStatus(f) {
    let box = f.querySelector('.sg-form-status');
    if (!box) {
      box = document.createElement('div');
      box.className = 'sg-form-status';
      const submit = [...f.querySelectorAll('button:not([type=button]):not([type=reset]), input[type=submit]')].at(-1);
      submit ? submit.after(box) : f.append(box);
    }
    // one voice for every state: the skin draws, this speaks
    this.#voice = document.createElement('p');
    this.#voice.className = 'sg-form-words';
    this.#voice.setAttribute('aria-live', 'polite');
    this.#art = document.createElement('div');
    this.#art.className = 'sg-form-art';
    this.#art.setAttribute('aria-hidden', 'true');
    box.replaceChildren(this.#voice, this.#art);
  }

  /** A validating field note for every field that has none, so every problem is said in words. */
  #addNotes(f) {
    for (const c of f.querySelectorAll(FIELDS)) {
      if (!c.willValidate) continue;
      if (!c.id) c.id = `sg-form-field-${++uid}`;
      if (f.querySelector(`sg-field-note[for="${c.id}"][validate]`)) continue;
      const note = document.createElement('sg-field-note');
      note.setAttribute('for', c.id);
      note.setAttribute('validate', '');
      // radios: after their group; a control wrapped in its label: after the label, never inside it,
      // so the note is not read as part of the field's name; everything else: after the control
      const anchor = c.type === 'radio' ? c.closest('fieldset') ?? c : c.closest('label') ?? c;
      anchor.after(note);
    }
  }

  #invalidFields() {
    return [...this.form.elements].filter(c => c.willValidate && !c.validity.valid);
  }

  #submit(e) {
    if (this.status === 'sending') { e.preventDefault(); return; }
    const bad = this.#invalidFields();
    if (bad.length) {
      e.preventDefault();
      // each note shows itself and the first problem takes focus (field-note.js); the summary stays silent
      bad.forEach(c => c.checkValidity()); // fires each field's own invalid event
      // data-summary-name gives a long label (a whole checkbox sentence) a short name here
      const labels = [...new Set(bad.map(c => fieldName(c.dataset.summaryName ?? c.labels?.[0]?.textContent ?? c.getAttribute('aria-label'))))];
      this.#set('invalid', { count: bad.length, labels }, { quietly: true });
      return;
    }
    this.#submitter = e.submitter ?? null;
    let taken = null;
    const detail = { formData: new FormData(this.form, this.#submitter ?? undefined), submitter: this.#submitter, respondWith: p => { taken = Promise.resolve(p); } };
    this.emit('sg-submit', detail);
    if (!taken && this.hasAttribute('fetch')) taken = this.#post(detail.formData);
    if (!taken) { this.#set('submit'); return; } // the browser submits and the page moves on
    e.preventDefault();
    this.#run(taken);
  }

  #post(data) {
    const f = this.form, get = (f.method || 'get').toLowerCase() === 'get';
    const url = new URL(f.action, location.href);
    if (get) url.search = new URLSearchParams(data).toString();
    return fetch(url, { method: get ? 'GET' : 'POST', body: get ? undefined : data, headers: { accept: 'application/json, text/plain' } })
      .then(async r => {
        if (!r.ok) throw new Error(`the server answered ${r.status}`);
        const type = r.headers.get('content-type') ?? '';
        // a JSON answer may carry { message, stamp, tone, reset }; plain text is the message; anything else says nothing
        return type.includes('json') ? r.json() : type.startsWith('text/plain') ? { message: (await r.text()).trim().slice(0, 200) || undefined } : {};
      });
  }

  async #run(work) {
    let settled = false;
    // say "sending" only if the work is still going after a moment: fast work never flashes a loader
    const t = setTimeout(() => { if (!settled) this.#set('submit'); }, SENDING_AFTER_MS);
    this.#busy(true);
    try {
      const v = (await work) ?? {};
      settled = true; clearTimeout(t);
      if (this.status !== 'sending') this.status = 'sending'; // settle from sending even when it never showed
      this.#set('ok', { message: v.message, stamp: v.stamp, detail: v.detail, tone: v.tone });
      if (v.reset) this.form.reset();
    } catch (err) {
      settled = true; clearTimeout(t);
      if (this.status !== 'sending') this.status = 'sending';
      const error = err?.message && !/^(Failed to fetch|NetworkError|Load failed)/i.test(err.message) ? err.message : 'check your connection';
      this.#set('fail', { error }, { quietly: true });
      import('../toast/toast.js').then(({ toast }) => toast(STRINGS.failedToastMessage(error), { tone: 'error', title: STRINGS.failedToast })).catch(() => {});
    } finally {
      this.#busy(false);
    }
  }

  #busy(on) {
    on ? this.form.setAttribute('aria-busy', 'true') : this.form.removeAttribute('aria-busy');
    const b = this.#submitter ?? this.form.querySelector('button:not([type=button]):not([type=reset]), input[type=submit]');
    if (b) on ? b.setAttribute('aria-disabled', 'true') : b.removeAttribute('aria-disabled');
  }

  #set(event, detail = {}, { quietly = false } = {}) {
    const was = this.status;
    this.status = next(this.status, event);
    if (this.status === was && event !== 'invalid') return;
    this.#detail = detail;
    this.#words = words(this.status, { register: this.register, ...detail });
    // a failure is also a toast (an alert), and a summary follows focus to the first problem: both stay silent here
    this.#voice.setAttribute('aria-live', quietly ? 'off' : 'polite');
    this.#voice.textContent = this.#words;
    this.dataset.state = this.status;
    this.dataset.tone = detail.tone ?? '';
    this.update();
    // a failed submit already speaks through the toast it raises (its own error sound); a
    // successful one has no toast of its own, so it plays the confirmation here
    if (this.status === 'ok') play('confirm', { register: this.register });
    this.emit('sg-form-state', { state: this.status, words: this.#words });
  }

  state() {
    return { state: this.status, words: this.#words, ...this.#detail, art: this.#art };
  }
}

defineComponent('sg-form', SgForm);
