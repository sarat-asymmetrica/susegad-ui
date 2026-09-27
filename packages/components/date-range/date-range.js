// <sg-date-range>: a stay's arrival and departure, over two native date inputs.
//
//   <sg-date-range prices today="2026-10-20">
//     <fieldset>
//       <legend>Your stay</legend>
//       <label>Arrival <input type="date" name="arrival" required min="2026-10-22" max="2027-06-30"></label>
//       <label>Departure <input type="date" name="departure" required min="2026-10-23" max="2027-07-01"></label>
//     </fieldset>
//   </sg-date-range>
//
// Without JavaScript the two inputs are the whole component and submit with
// the form. With it, a two-month calendar writes into them (and follows what is
// typed), knows turnover days and taken nights from the booking kernels, moves
// by keyboard as the APG date grid does, and sets the inputs' validity so the
// form's own validation stops a stay that cannot be booked.

import { SgElement, defineComponent } from '../../core/component.js';
import { play } from '../../sound/index.js';
import { RATES } from '../../kernels/booking/rates.js';
import { occupiedNights } from '../../kernels/booking/availability.js';
import { addDays, addMonths, isValidISO, monthGrid, monthName, todayISO, ym } from '../../kernels/booking/dates.js';
import {
  STRINGS, dayInfo, pick, selectable, shortPrice, labelFor, hintFor, moveFocus, viewFor, seasonRows, rangeReasons,
} from './date-range.core.js';

export { STRINGS };

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DOW_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
let uid = 0;

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter(k => k != null));
  return el;
}

export class SgDateRange extends SgElement {
  static native = 'input[type=date]';
  static observedAttributes = ['register', 'today', 'prices', 'blocks', 'open-from'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  selection = { arr: null, dep: null };
  hover = null;
  view = null;
  #rates = RATES; #blocks = null; #ui = null; #days = new Map(); #focus = null; #off = []; #writing = false;
  #limits = new Map(); // the input limits this element set itself, so a new window can move them

  /** The rate card: prices, seasons, minimum stays and the booking window. Setting it redraws. */
  get rates() { return this.#rates; }
  set rates(v) { this.#rates = v ?? RATES; this.#reframe(); }

  /** Existing stays and holds: [{ arrival, departure, kind: 'booking' | 'hold' | 'owner' }]. */
  get blocks() {
    if (this.#blocks) return this.#blocks;
    try { return JSON.parse(this.getAttribute('blocks') || '[]'); } catch { return []; }
  }
  set blocks(v) { this.#blocks = Array.isArray(v) ? v : []; this.#refresh(true); }

  get inputs() { return [...this.querySelectorAll('input[type=date]')].slice(0, 2); }
  get today() { const t = this.getAttribute('today'); return t && isValidISO(t) ? t : todayISO(); }
  get prices() { return this.hasAttribute('prices'); }
  /** The calendar's parts, for skins that draw over it. */
  get calendar() { return this.#ui; }
  /**
   * The nights guests can pick: the rate card's window, opening from `open-from` when the page
   * sets it. The ribbon keeps the rate card's own opening date, because that is when bookings open.
   */
  get window() {
    const w = this.rates.window, from = this.getAttribute('open-from');
    return from && isValidISO(from) ? { ...w, openFrom: from } : w;
  }
  get availability() { return { occupied: occupiedNights(this.blocks), today: this.today, window: this.window }; }
  /** The months the calendar can show. */
  get span() {
    const w = this.window, first = ym(this.today) > ym(w.openFrom) ? ym(this.today) : ym(w.openFrom);
    return { first, last: ym(w.openUntil) };
  }

  connected() {
    // a page may set rates or blocks before the element is defined; take those values over
    for (const k of ['rates', 'blocks']) if (Object.hasOwn(this, k)) { const v = this[k]; delete this[k]; this[k] = v; }
    const [a, d] = this.inputs;
    if (!a || !d) return;
    this.#fillLimits(a, d);
    this.#ui = this.#build();
    const on = (t, type, fn) => { t.addEventListener(type, fn); this.#off.push(() => t.removeEventListener(type, fn)); };
    for (const inp of [a, d]) on(inp, 'change', () => { if (!this.#writing) this.#fromInputs(); });
    if (a.form) on(a.form, 'reset', () => setTimeout(() => this.#fromInputs()));
    this.#fromInputs();
  }
  disconnected() { this.#off.splice(0).forEach(f => f()); this.#ui?.root.remove(); this.#ui = null; }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (!this.#ui || name === 'register') return;
    if (name === 'open-from' || name === 'today' || name === 'prices') this.#reframe();
    else this.#refresh(true);
  }

  // The window, the months or the prices changed: move the limits this element set, rebuild
  // the season table, keep the view inside the months on offer, redraw and re-check.
  #reframe() {
    if (!this.#ui) return;
    const [a, d] = this.inputs;
    this.#fillLimits(a, d);
    this.#ui.root.querySelector(':scope > .sg-dr-seasons')?.remove();
    if (this.prices) this.#ui.root.append(this.#seasonTable());
    // with nothing picked, show the first month on offer; otherwise keep the stay in view
    const { first, last } = this.span, at = this.selection.arr ? ym(this.selection.arr) : first;
    this.view = viewFor(`${at}-01`, this.selection.arr ? this.view ?? at : at, first, last);
    this.#refresh(true);
    this.update();
  }

  state() {
    return { ...this.selection, hover: this.hover, view: this.view, rates: this.rates, motion: this.motion, visible: this.visible };
  }

  // Limits the page did not set: the window guests can pick from, less the notice needed.
  // Limits the page wrote itself are never touched.
  #fillLimits(a, d) {
    const w = this.window, lead = addDays(this.today, w.minLeadDays);
    const min = lead > w.openFrom ? lead : w.openFrom;
    const set = (input, attr, value) => {
      const own = this.#limits.get(input)?.[attr];
      if (input[attr] && input[attr] !== own) return; // the page's
      input[attr] = value;
      this.#limits.set(input, { ...this.#limits.get(input), [attr]: value });
    };
    set(a, 'min', min);
    set(a, 'max', w.openUntil);
    set(d, 'min', addDays(min, 1));
    set(d, 'max', addDays(w.openUntil, 1));
  }

  #build() {
    const id = `sg-dr-${++uid}`;
    const prev = h('button', { type: 'button', class: 'sg-dr-nav', 'aria-label': STRINGS.prev, text: '‹' });
    const next = h('button', { type: 'button', class: 'sg-dr-nav', 'aria-label': STRINGS.next, text: '›' });
    const hint = h('p', { class: 'sg-dr-hint', 'aria-live': 'polite' });
    // the month pages sit in their own box, so a skin's overlay in `months` survives a re-render
    const pages = h('div', { class: 'sg-dr-pages' });
    const months = h('div', { class: 'sg-dr-months' }, pages);
    const reasons = h('ul', { class: 'sg-dr-reasons', 'aria-live': 'polite' });
    const L = STRINGS.legend;
    const legend = h('ul', { class: 'sg-dr-legend' },
      ...[['free', L.free], ...(this.prices ? [['peak', L.peak]] : []), ['taken', L.taken], ['dep', L.dep]]
        .map(([k, t]) => h('li', {}, h('span', { class: `sg-dr-key is-${k}`, 'aria-hidden': 'true' }), t)));
    const root = h('div', { class: 'sg-dr', id }, h('div', { class: 'sg-dr-head' }, prev, hint, next), months, reasons, legend);
    if (this.prices) root.append(this.#seasonTable());
    this.append(root);
    prev.addEventListener('click', () => this.#show(addMonths(this.view, -1)));
    next.addEventListener('click', () => this.#show(addMonths(this.view, 1)));
    months.addEventListener('click', e => { const b = e.target.closest('[data-iso]'); if (b) this.#pick(b.dataset.iso); });
    months.addEventListener('keydown', e => this.#key(e));
    months.addEventListener('focusin', e => { const iso = e.target.dataset?.iso; if (iso) { this.#focus = iso; this.hover = iso; this.#paint(); } });
    months.addEventListener('pointerover', e => { const iso = e.target.closest?.('[data-iso]')?.dataset.iso; if (iso && iso !== this.hover) { this.hover = iso; this.#paint(); } });
    months.addEventListener('pointerleave', () => { this.hover = null; this.#paint(); });
    return { root, prev, next, hint, months, pages, reasons, legend };
  }

  #seasonTable() {
    const rows = seasonRows(this.today, this.rates), [c1, c2, c3, c4] = STRINGS.seasonCols;
    return h('details', { class: 'sg-dr-seasons' }, h('summary', { text: STRINGS.seasons }),
      h('table', {}, h('thead', {}, h('tr', {}, [c1, c2, c3, c4].map(t => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, rows.map(r => h('tr', { 'data-kind': r.kind },
          h('th', { scope: 'row', text: r.label }), h('td', { text: r.when }), h('td', { text: r.price }), h('td', { text: r.minimum }))))));
  }

  // Read the inputs (typed, reset or set by a page) into the selection.
  #fromInputs() {
    const [a, d] = this.inputs;
    const arr = isValidISO(a.value) ? a.value : null, dep = arr && isValidISO(d.value) && d.value > arr ? d.value : null;
    this.selection = { arr, dep };
    const before = this.view;
    this.#refresh(false, arr ?? this.view ?? this.span.first);
    if (this.view !== before || !this.#days.size) this.#render();
  }

  #pick(iso) {
    const next = pick(this.selection, iso, this.availability);
    if (!next) return;
    this.selection = next;
    this.#focus = iso;
    const [a, d] = this.inputs;
    const restart = !next.dep && !!d.value;
    this.#write(a, next.arr ?? '');
    this.#write(d, next.dep ?? '');
    // a new arrival empties the departure: that is the next step, not a mistake (a field note starts over)
    if (restart) d.dispatchEvent(new Event('sg-reset', { bubbles: true }));
    this.#refresh(false);
    play('tick', { register: this.register });
    this.emit('sg-pick', { ...next });
  }
  #write(input, value) {
    if (input.value === value) return;
    input.value = value;
    this.#writing = true; // our own change: tell the page, but do not read it back
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    this.#writing = false;
  }

  #key(e) {
    const from = e.target.dataset?.iso;
    if (!from) return;
    const to = moveFocus(from, e.key, e.shiftKey);
    if (!to) return;
    e.preventDefault();
    const { first, last } = this.span;
    const clamped = to < `${first}-01` ? `${first}-01` : to > `${last}-31` ? from : to;
    this.#focus = clamped;
    this.#show(viewFor(clamped, this.view, first, last), true);
  }

  #show(view, focus = false) {
    const { first, last } = this.span;
    const v = viewFor(`${view}-01`, view, first, last);
    if (v !== this.view) { this.view = v; this.#render(); }
    if (focus) this.#days.get(this.#focus)?.focus();
  }

  #refresh(render, around) {
    if (!this.#ui) return;
    if (around) this.view = viewFor(`${ym(around)}-01`, this.view ?? ym(around), this.span.first, this.span.last);
    if (render) this.#render(); else this.#paint();
    this.#validate();
  }

  #render() {
    const { pages, prev, next } = this.#ui, { first, last } = this.span;
    this.view ??= first;
    pages.replaceChildren();
    this.#days = new Map();
    for (const m of [this.view, addMonths(this.view, 1)]) {
      const nameId = `sg-dr-m-${++uid}`;
      const table = h('table', { role: 'grid', 'aria-labelledby': nameId, class: 'sg-dr-grid' },
        h('thead', {}, h('tr', {}, DOW.map((d, i) => h('th', { scope: 'col', abbr: DOW_FULL[i], text: d })))),
        h('tbody', {}, monthGrid(m).map(row => h('tr', {}, row.map(iso => {
          if (!iso) return h('td', {});
          const b = h('button', { type: 'button', class: 'sg-dr-day', 'data-iso': iso, tabindex: '-1' },
            h('span', { class: 'sg-dr-n', text: String(+iso.slice(8)) }), h('span', { class: 'sg-dr-p', 'aria-hidden': 'true' }));
          this.#days.set(iso, b);
          return h('td', {}, b);
        })))));
      pages.append(h('div', { class: 'sg-dr-month' }, h('p', { class: 'sg-dr-name', id: nameId, text: monthName(m) }), table));
    }
    prev.disabled = this.view <= first;
    next.disabled = addMonths(this.view, 1) >= last;
    this.#paint();
  }

  // Classes, names and the one tab stop; cheap, so it runs on every hover.
  #paint() {
    if (!this.#ui) return;
    const ctx = this.availability, win = this.window, s = this.selection, rates = this.prices ? this.rates : null;
    const preview = s.arr && !s.dep && this.hover && pick(s, this.hover, ctx)?.dep;
    for (const [iso, b] of this.#days) {
      const info = dayInfo(iso, ctx, rates);
      const cls = ['sg-dr-day', info.night === 'free' ? (info.peak ? 'is-peak' : 'is-free') : `is-${info.night}`];
      if (info.night !== 'free' && info.departureOk) cls.push('is-depart-only');
      if (iso === s.arr) cls.push('is-arr');
      if (iso === s.dep) cls.push('is-dep');
      if (s.arr && s.dep && iso > s.arr && iso < s.dep) cls.push('in-range');
      if (preview && iso > s.arr && iso <= preview) cls.push('in-preview');
      if (iso === this.today) cls.push('is-today');
      b.className = cls.join(' ');
      b.lastChild.textContent = info.night === 'free' ? shortPrice(info.rate) : '';
      b.setAttribute('aria-label', labelFor(iso, info, s, win));
      b.setAttribute('aria-disabled', String(!selectable(s, iso, ctx)));
      b.parentElement.setAttribute('aria-selected', String(iso === s.arr || iso === s.dep));
      b.tabIndex = -1;
    }
    const stop = [this.#focus, s.dep, s.arr].find(d => d && this.#days.has(d))
      ?? [...this.#days.keys()].find(d => dayInfo(d, ctx).arrivalOk) ?? this.#days.keys().next().value;
    if (stop) this.#days.get(stop).tabIndex = 0;
    const hint = hintFor(s); // a live region: written only when its words change
    if (this.#ui.hint.textContent !== hint) this.#ui.hint.textContent = hint;
    this.update();
  }

  // The form's own validation carries the kernels' reasons, so no-JS rules and JS rules agree.
  #validate() {
    const [a, d] = this.inputs, s = this.selection;
    const reasons = rangeReasons(s.arr, s.dep, this.availability, this.prices ? this.rates : null);
    const arrivalProblem = s.arr && !dayInfo(s.arr, this.availability).arrivalOk ? rangeReasons(s.arr, addDays(s.arr, 1), this.availability, null)[0] : '';
    a.setCustomValidity(arrivalProblem || '');
    d.setCustomValidity(reasons.join(' '));
    const list = this.#ui.reasons;
    const text = reasons.join('\n');
    if (list.dataset.text !== text) { list.dataset.text = text; list.replaceChildren(...reasons.map(r => h('li', { text: r }))); }
    this.emit('sg-range', { arrival: s.arr, departure: s.dep, ok: !!(s.arr && s.dep) && reasons.length === 0, reasons });
  }

  /** The day buttons on show, for skins that draw over them. */
  get dayButtons() { return this.#days; }
}

defineComponent('sg-date-range', SgDateRange);
