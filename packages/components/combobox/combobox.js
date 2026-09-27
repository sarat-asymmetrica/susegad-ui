// <sg-combobox>: an input with suggestions. Without JavaScript it is the
// browser's own <input list> and <datalist>. With JavaScript it becomes the
// ARIA APG editable combobox with list autocomplete: the input keeps focus,
// a listbox popover shows the matches, the arrow keys move through them
// (aria-activedescendant), Enter chooses, Escape closes. The person may always
// type something that is not in the list; the value is theirs.
//
//   <sg-combobox>
//     <label for="city">City</label>
//     <input id="city" name="city" list="cities" autocomplete="off">
//     <datalist id="cities">
//       <option value="Mumbai" data-aliases="Bombay, मुंबई"></option>
//     </datalist>
//   </sg-combobox>

import { SgElement, defineComponent } from '../../core/component.js';
import { filterOptions, markRange, optionsFrom, STRINGS } from './combobox.core.js';

let uid = 0;
const anchors = typeof CSS !== 'undefined' && CSS.supports?.('anchor-name: --a');

export class SgCombobox extends SgElement {
  static native = 'input';
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };
  #list = null; #status = null; #options = []; #shown = []; #active = -1; #open = false;
  #listId = ''; #datalist = null; #off = []; #spoken = ''; #speakTimer = 0; #changed = 0;

  get open() { return this.#open; }
  /** The suggestions on show, as plain data (for skins and tests). */
  get suggestions() { return this.#shown.map(r => r.option.value); }
  /** Open or close the suggestions (the caret does this on a click). */
  toggle() { if (this.#open) this.#close(); else { this.native.focus(); this.#filter(false); } }

  connected() {
    const input = this.native;
    if (!input) return;
    const id = ++uid;
    this.#datalist = input.list ?? document.getElementById(input.getAttribute('list'));
    this.#options = optionsFrom(this.#datalist);
    this.#listId = `sg-combobox-${id}`;

    // The enhanced path takes over from the browser's own suggestions.
    input.dataset.list = input.getAttribute('list') ?? '';
    input.removeAttribute('list');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', this.#listId);
    input.setAttribute('autocomplete', 'off');

    const list = this.#list = document.createElement('ul');
    list.id = this.#listId;
    list.className = 'sg-combobox__list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('popover', 'manual');
    const label = input.labels?.[0];
    if (label) { label.id ||= `${this.#listId}-label`; list.setAttribute('aria-labelledby', label.id); }
    const status = this.#status = document.createElement('span');
    status.className = 'sg-combobox__status';
    status.setAttribute('role', 'status');
    input.after(list, status);
    if (anchors) { input.style.setProperty('anchor-name', `--${this.#listId}`); list.style.setProperty('position-anchor', `--${this.#listId}`); }

    const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); this.#off.push(() => el.removeEventListener(type, fn, opts)); };
    on(input, 'input', e => { if (!e.isTrusted && e.detail === 'sg-choose') return; this.#filter(true); });
    on(input, 'keydown', e => this.#key(e));
    on(input, 'click', () => { if (!this.#open) this.#filter(false); });
    on(this, 'focusout', e => { if (!this.contains(e.relatedTarget)) this.#close(); });
    on(list, 'pointerdown', e => e.preventDefault()); // keep focus in the input
    on(list, 'click', e => { const li = e.target.closest('[role="option"]'); if (li) this.#choose(+li.dataset.index); });
    on(window, 'resize', () => this.#place());
    on(window, 'scroll', () => this.#place(), { capture: true, passive: true });
  }

  disconnected() {
    this.#off.splice(0).forEach(f => f());
    const input = this.native;
    if (input) {
      if (input.dataset.list) input.setAttribute('list', input.dataset.list);
      for (const a of ['role', 'aria-autocomplete', 'aria-expanded', 'aria-controls', 'aria-activedescendant']) input.removeAttribute(a);
      input.style.removeProperty('anchor-name');
    }
    this.#list?.remove(); this.#status?.remove();
    clearTimeout(this.#speakTimer);
  }

  state() { return { open: this.#open, count: this.#shown.length, active: this.#active, changed: this.#changed }; }

  // ── the list ────────────────────────────────────────────────────────────
  #filter(typed) {
    const q = this.native.value;
    this.#shown = filterOptions(q, this.#options);
    this.#active = -1;
    this.#render(q);
    if (this.#shown.length && (q || !typed)) this.#show(); else this.#close();
    if (typed) this.#speak(q ? STRINGS.count(this.#shown.length) : '');
  }

  #render(q) {
    const frag = document.createDocumentFragment();
    this.#shown.forEach((r, i) => {
      const li = document.createElement('li');
      li.id = `${this.#listId}-${i}`;
      li.dataset.index = String(i);
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      if (r.option.lang) li.lang = r.option.lang;
      const main = document.createElement('span');
      main.className = 'sg-combobox__value';
      const m = r.via ? null : markRange(r.option.value, q);
      if (m) main.append(r.option.value.slice(0, m[0]), Object.assign(document.createElement('mark'), { textContent: r.option.value.slice(m[0], m[1]) }), r.option.value.slice(m[1]));
      else main.textContent = r.option.value;
      li.append(main);
      const hint = r.via ? STRINGS.also(r.via) : r.option.label;
      if (hint) li.append(' ', Object.assign(document.createElement('span'), { className: 'sg-combobox__hint', textContent: hint }));
      frag.append(li);
    });
    this.#list.replaceChildren(frag);
  }

  #show() {
    if (!this.#open) {
      this.#open = true;
      try { this.#list.showPopover(); } catch { /* already shown */ }
      this.native.setAttribute('aria-expanded', 'true');
      this.toggleAttribute('data-open', true);
      this.update();
    }
    this.#place();
  }

  #close() {
    if (!this.#open) return;
    this.#open = false;
    this.#active = -1;
    try { this.#list.hidePopover(); } catch { /* already hidden */ }
    this.native.setAttribute('aria-expanded', 'false');
    this.native.removeAttribute('aria-activedescendant');
    this.toggleAttribute('data-open', false);
    this.update();
  }

  /** Browsers without anchor positioning: place the popover under the input by hand. */
  #place() {
    if (anchors || !this.#open) return;
    const r = this.native.getBoundingClientRect(), s = this.#list.style;
    s.position = 'fixed'; s.left = `${r.left}px`; s.top = `${r.bottom + 4}px`; s.width = `${r.width}px`;
  }

  #move(i) {
    const items = this.#list.children;
    items[this.#active]?.setAttribute('aria-selected', 'false');
    this.#active = i;
    const li = items[i];
    if (li) {
      li.setAttribute('aria-selected', 'true');
      this.native.setAttribute('aria-activedescendant', li.id);
      li.scrollIntoView({ block: 'nearest' });
    } else this.native.removeAttribute('aria-activedescendant');
    this.update();
  }

  #choose(i) {
    const r = this.#shown[i];
    if (!r) return;
    const input = this.native;
    input.value = r.option.value;
    this.#changed++;
    this.#close();
    // Tell the form, validation and anything listening, as typing would.
    input.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: 'sg-choose' }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    this.emit('sg-choose', { value: r.option.value });
  }

  #key(e) {
    const n = this.#shown.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.#open) { this.#filter(false); if (!e.altKey && this.#shown.length) this.#move(0); }
        else if (n) this.#move((this.#active + 1) % n);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.#open) { this.#filter(false); if (this.#shown.length) this.#move(this.#shown.length - 1); }
        else if (n) this.#move(this.#active <= 0 ? n - 1 : this.#active - 1);
        break;
      case 'Enter':
        if (this.#open && this.#active >= 0) { e.preventDefault(); this.#choose(this.#active); }
        break;
      case 'Escape':
        if (this.#open) { e.preventDefault(); this.#close(); }
        else if (this.native.value) { e.preventDefault(); this.native.value = ''; this.native.dispatchEvent(new Event('input', { bubbles: true })); }
        break;
      case 'Tab':
        this.#close();
        break;
      case 'ArrowLeft': case 'ArrowRight': case 'Home': case 'End':
        if (this.#active >= 0) this.#move(-1); // back to editing the text
        break;
    }
  }

  /** Say the number of suggestions after typing settles, and only when it changes. */
  #speak(text) {
    clearTimeout(this.#speakTimer);
    this.#speakTimer = setTimeout(() => {
      if (text === this.#spoken) return;
      this.#spoken = text;
      this.#status.textContent = text;
    }, 450);
  }
}

defineComponent('sg-combobox', SgCombobox);
