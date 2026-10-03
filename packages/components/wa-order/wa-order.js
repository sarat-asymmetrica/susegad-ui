// <sg-wa-order>: turns a menu selection into a pre-written WhatsApp message.
//
//   <sg-menu id="menu" orderable continue="#order">…</sg-menu>
//
//   <sg-wa-order id="order" for="menu" number="+91 98765 43210" business="Sample Pasta Studio"
//                min-notice="24" areas="Porvorim, Panjim, Margao">
//     <a class="sg-wa-send" href="https://wa.me/919876543210?text=Hello%2C%20I%20would%20like%20to%20order.">Order on WhatsApp</a>
//   </sg-wa-order>
//
// Without JavaScript the link is all there is: a plain wa.me link with a short
// message, which opens WhatsApp. With it, the element listens for the menu's
// sg-change, asks for the day, the time of day, delivery or pickup, the area, a
// name and any notes, shows the exact message it will hand to WhatsApp ("This is
// what we'll send"), and keeps the link's href equal to it. It never says an order
// is placed: the person sends the message themselves, and the shop confirms.
//
// Attributes: for (the menu's id; or nest an <sg-menu> inside), number, business,
// min-notice (hours), areas (suggestions), slots (comma list), fulfilment
// ("delivery pickup", the ways the shop offers), currency, register.
// Event: sg-wa-open { text, href, lines, total }, when the link is pressed with a complete order.

import '../field/field.js';
import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, prepareOrder, earliestDate, normalizeNumber, estimate } from './wa-order.core.js';

let uid = 0;
const list = v => String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter(Boolean));
  return el;
};

export class SgWaOrder extends SgElement {
  static native = 'a.sg-wa-send, a[href^="https://wa.me/"]';
  static observedAttributes = ['register', 'for', 'number', 'business', 'min-notice', 'areas', 'slots', 'fulfilment', 'currency'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #id = `sg-wa-${++uid}`;
  #built = false; #off = [];
  #lines = []; #total = 0;
  #panel = null; #link = null; #home = null; #preview = null; #reason = null; #written = null; #menuLink = null;
  #f = {}; #said = {};
  #result = null; #sentText = ''; #nonce = 0; #tried = false;

  get currency() { return this.getAttribute('currency') || '₹'; }
  get minNotice() { return Math.max(0, Number(this.getAttribute('min-notice')) || 0); }

  /** The menu this composer reads: the one named by `for`, else one nested inside. */
  get menu() {
    const id = this.getAttribute('for');
    return (id ? this.ownerDocument.getElementById(id) : this.querySelector('sg-menu')) ?? null;
  }

  /** What would be sent right now: { ok, text, href, problems, reason }. */
  get order() { return this.#result ?? this.#prepare(); }

  connected() {
    const doc = this.ownerDocument;
    this.#link = this.native ?? null;
    if (!this.#link) { this.#link = h('a', { class: 'sg-wa-send', text: STRINGS.fallback }); this.append(this.#link); }
    this.#link.classList.add('sg-wa-send');
    const num = normalizeNumber(this.getAttribute('number'));
    if (!num.ok) { console.warn('sg-wa-order: the `number` attribute is not a number WhatsApp can open; the plain link is all that is shown.'); return; }

    const onChange = e => {
      const m = e.target?.closest?.('sg-menu');
      if (!m || m !== this.menu) return;
      this.#take(e.detail);
    };
    doc.addEventListener('sg-change', onChange);
    this.#off.push(() => doc.removeEventListener('sg-change', onChange));
    this.#build();
    // a menu that was already ordered from, or upgrades after this: read it once it can answer
    const m = this.menu;
    if (m) {
      const read = () => { const o = m.order; if (o) this.#take(o); };
      if (m.order) read(); else customElements.whenDefined('sg-menu').then(() => queueMicrotask(read));
    }
    this.#refresh();
  }

  disconnected() {
    this.#off.splice(0).forEach(f => f());
    if (!this.#built) return;
    this.#home?.replaceWith(this.#link);
    this.#link.removeAttribute('aria-disabled'); this.#link.removeAttribute('role'); this.#link.removeAttribute('tabindex');
    this.#panel.remove();
    this.#built = false; this.#f = {}; this.#said = {};
    this.removeAttribute('data-composer');
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (!this.#built || old === now) return;
    if (['areas', 'slots', 'fulfilment', 'business', 'number', 'for', 'min-notice', 'currency'].includes(name)) { this.#syncOptions(); this.#refresh(); }
  }

  #take(detail) {
    this.#lines = detail?.lines ?? [];
    this.#total = detail?.total ?? estimate(this.#lines);
    this.#refresh();
  }

  // ── building the form ──

  #build() {
    const id = this.#id, f = this.#f;
    const field = (name, label, control, hint) => {
      const cid = `${id}-${name}`;
      control.id = cid; control.name = name;
      const hintEl = hint ? h('p', { class: 'sg-wa-hint', id: `${cid}-hint`, text: hint }) : null;
      if (hintEl) control.setAttribute('aria-describedby', hintEl.id);
      f[name] = control;
      return h('sg-field', {}, h('label', { for: cid, text: label }), hintEl, control);
    };
    const plain = (name, label, control, hint) => {
      const cid = `${id}-${name}`;
      control.id = cid; control.name = name;
      f[name] = control;
      const hintEl = hint ? h('p', { class: 'sg-wa-hint', id: `${cid}-hint`, text: hint }) : null;
      if (hintEl) control.setAttribute('aria-describedby', hintEl.id);
      return h('div', { class: 'sg-wa-plain' }, h('label', { for: cid, text: label }), hintEl, control);
    };

    const date = h('input', { type: 'date', required: true });
    const slot = h('select');
    const choices = h('div', { class: 'sg-wa-choices' });
    const way = h('fieldset', { class: 'sg-wa-how' }, h('legend', { text: STRINGS.how }), choices);
    for (const [v, label] of [['delivery', STRINGS.delivery], ['pickup', STRINGS.pickup]]) {
      const r = h('input', { type: 'radio', name: `${id}-how`, value: v });
      f[v] = r;
      choices.append(h('label', { class: 'sg-wa-choice' }, r, h('span', { text: label })));
    }
    const area = h('input', { type: 'text', autocomplete: 'address-level2', list: `${id}-areas`, required: true });
    const areaField = field('area', STRINGS.area, area, STRINGS.areaHint);
    const datalist = h('datalist', { id: `${id}-areas` });
    f.datalist = datalist; f.areaField = areaField; f.way = way;
    const name = h('input', { type: 'text', autocomplete: 'name', required: true });
    const dietary = h('input', { type: 'text' });
    const notes = h('textarea', { rows: '3' });

    this.#preview = h('pre', { class: 'sg-wa-text' });
    this.#reason = h('p', { class: 'sg-wa-reason', id: `${id}-reason` });
    this.#written = h('p', { class: 'sg-wa-written', role: 'status' });
    this.#menuLink = h('a', { class: 'sg-wa-menu-link', text: STRINGS.menuLink, hidden: true });
    const previewHead = h('h3', { class: 'sg-wa-title', id: `${id}-title`, text: STRINGS.previewTitle });
    const actions = h('div', { class: 'sg-wa-actions' });

    this.#panel = h('div', { class: 'sg-wa-panel' },
      h('fieldset', { class: 'sg-wa-fields' },
        h('legend', { text: STRINGS.legend }),
        h('div', { class: 'sg-wa-row' },
          plain('date', STRINGS.date, date),
          plain('slot', STRINGS.slot, slot)),
        way, areaField, datalist,
        field('name', STRINGS.name, name),
        field('dietary', `${STRINGS.dietary} (${STRINGS.dietaryHint.toLowerCase()})`, dietary),
        field('notes', `${STRINGS.notes} (${STRINGS.notesHint.toLowerCase()})`, notes)),
      h('section', { class: 'sg-wa-preview', 'aria-labelledby': previewHead.id },
        previewHead,
        h('p', { class: 'sg-wa-hint', text: STRINGS.previewHint }),
        this.#preview),
      actions);
    this.#home = this.ownerDocument.createComment('sg-wa-order link');
    this.#link.replaceWith(this.#home);
    actions.append(this.#link, this.#reason, this.#menuLink, this.#written);
    this.#link.setAttribute('aria-describedby', this.#reason.id);
    this.#link.target = '_blank';
    this.#link.rel = 'noopener noreferrer';
    this.append(this.#panel);
    this.setAttribute('data-composer', '');
    this.#built = true;
    this.#syncOptions();
    f.delivery.checked = true;

    const on = (el, type, fn) => { el.addEventListener(type, fn); this.#off.push(() => el.removeEventListener(type, fn)); };
    on(this.#panel, 'input', () => this.#refresh());
    on(this.#panel, 'change', () => this.#refresh());
    on(this.#link, 'click', e => this.#press(e));
    on(this.#link, 'keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && this.#link.getAttribute('aria-disabled') === 'true') { e.preventDefault(); this.#press(e); } });
  }

  /** Slots, areas, the ways to get it: the attributes, written into the fields. */
  #syncOptions() {
    const f = this.#f;
    const slots = list(this.getAttribute('slots'));
    const kept = f.slot.value;
    f.slot.replaceChildren(h('option', { value: '', text: STRINGS.anyTime }), ...(slots.length ? slots : STRINGS.slotsDefault).map(s => h('option', { value: s, text: s })));
    f.slot.value = [...f.slot.options].some(o => o.value === kept) ? kept : '';
    f.datalist.replaceChildren(...list(this.getAttribute('areas')).map(a => h('option', { value: a })));
    const ways = list((this.getAttribute('fulfilment') ?? '').replace(/\s+/g, ','));
    const offered = ways.length ? ways.filter(w => w === 'delivery' || w === 'pickup') : ['delivery', 'pickup'];
    for (const w of ['delivery', 'pickup']) f[w].closest('label').hidden = !offered.includes(w);
    f.way.hidden = offered.length < 2;
    if (!offered.includes(this.#how())) f[offered[0] ?? 'delivery'].checked = true;
  }

  #how() { return this.#f.pickup?.checked ? 'pickup' : 'delivery'; }

  // ── composing ──

  #current() {
    const f = this.#f;
    return {
      business: this.getAttribute('business') ?? '',
      lines: this.#lines,
      date: f.date.value, slot: f.slot.value,
      fulfilment: this.#how(), area: f.area.value,
      name: f.name.value, notes: f.notes.value, dietary: f.dietary.value,
      currency: this.currency,
    };
  }

  #prepare() {
    return prepareOrder(this.#current(), { number: this.getAttribute('number'), now: new Date(), minNoticeHours: this.minNotice });
  }

  #refresh() {
    if (!this.#built) return;
    const f = this.#f, pickup = this.#how() === 'pickup';
    // set only what changed: touching `min` while someone is typing a date wipes the day or month they had half typed
    const earliest = earliestDate(new Date(), this.minNotice);
    if (f.date.min !== earliest) f.date.min = earliest;
    if (f.areaField.hidden !== pickup) f.areaField.hidden = pickup;
    if (f.area.required === pickup) f.area.required = !pickup;
    const r = this.#result = this.#prepare();
    // what is still missing, said by the field itself (the browser's own bubble, in our words)
    const by = {};
    for (const p of r.problems) by[p.field] ??= p.message;
    for (const k of ['date', 'area', 'name']) if ((this.#said[k] ?? '') !== (by[k] ?? '')) f[k].setCustomValidity(this.#said[k] = by[k] ?? '');
    this.#preview.textContent = r.text || STRINGS.previewEmpty;
    this.#preview.toggleAttribute('data-empty', !r.text);
    const link = this.#link;
    if (r.ok) {
      link.href = r.href;
      link.removeAttribute('aria-disabled'); link.removeAttribute('role'); link.removeAttribute('tabindex');
      link.textContent = STRINGS.send;
    } else {
      link.removeAttribute('href');
      link.setAttribute('role', 'link'); link.setAttribute('tabindex', '0'); link.setAttribute('aria-disabled', 'true');
      link.textContent = STRINGS.sendWaiting;
    }
    this.#reason.textContent = r.ok ? '' : r.reason;
    this.#menuLink.hidden = !!r.text || !this.getAttribute('for');
    if (!this.#menuLink.hidden) this.#menuLink.href = `#${this.getAttribute('for')}`;
    if (this.#sentText && this.#sentText !== r.text) { this.#sentText = ''; this.#written.textContent = ''; }
    this.toggleAttribute('data-ready', r.ok);
    this.toggleAttribute('data-tried', this.#tried);
    this.update();
  }

  #press(e) {
    const r = this.#result ?? this.#prepare();
    if (!r.ok) {
      e.preventDefault();
      this.#tried = true;
      this.toggleAttribute('data-tried', true);
      const f = this.#f;
      if (!r.text) { (this.menu?.querySelector('.sg-menu-plus') ?? this.menu)?.focus?.(); return; } // nothing chosen: back to the menu
      const first = r.problems.map(p => f[p.field]).find(Boolean);
      if (first) { first.focus(); first.reportValidity?.(); }
      return;
    }
    this.#sentText = r.text;
    this.#written.textContent = STRINGS.written;
    this.#nonce++;
    this.emit('sg-wa-open', { text: r.text, href: r.href, lines: this.#lines, total: this.#total });
    this.update();
  }

  state() {
    return { seed: this.getAttribute('business') || this.#id, sent: this.#nonce, ready: !!this.#result?.ok, motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-wa-order', SgWaOrder);
