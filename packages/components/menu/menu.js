// <sg-menu>: a menu and price list a small food business can run on a phone.
//
//   <sg-menu orderable glyphs>
//     <section class="sg-menu-section">
//       <h3 class="sg-menu-section-title">Fresh pasta</h3>
//       <ul class="sg-menu-items">
//         <li class="sg-menu-item" data-id="fettuccine" data-availability="available">
//           <span class="sg-menu-name">Fresh fettuccine</span>
//           <span class="sg-menu-price"><data value="450">₹450</data> <span class="sg-menu-unit">10 pieces</span></span>
//           <span class="sg-menu-line">Plain, rolled thin</span>
//           <div class="sg-menu-meta"><ul class="sg-menu-tags"><li class="sg-menu-tag" data-tag="egg-less">Egg-less</li></ul></div>
//         </li>
//       </ul>
//     </section>
//   </sg-menu>
//
// That is the whole page without JavaScript: a plain list that reads fine. With
// it, `orderable` gives every available dish a quantity stepper (native
// buttons, one polite live line for the total) and `sg-change` says what is in
// the order. Or set `menu.items = [...sections]` and the element writes the
// same list itself (the markup menuHTML() makes, so a server can write it too).
//
// Attributes: orderable, glyphs, currency (default ₹), max-qty (default 99),
// continue (a #hash: a link to it shows once something is added), seed, register.
// Event: sg-change { lines: [{ id, name, unit, qty, unitPrice, tags }], total, count }.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, MAX_QTY, normalizeMenu, menuHTML, summarize, totalLine, announce, clampQty } from './menu.core.js';

const $ = (root, sel) => root.querySelector(sel);
const textOf = el => el?.textContent.replace(/\s+/g, ' ').trim() ?? '';
const mk = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text ?? '' });

/** The server's list → raw dishes, each with the <li> it came from. */
function readMarkup(host) {
  const read = li => {
    const priceEl = $(li, '.sg-menu-price'), unitEl = $(li, '.sg-menu-unit');
    const unit = textOf(unitEl) || li.dataset.unit || '';
    const price = li.dataset.price ?? $(li, '.sg-menu-price data')?.getAttribute('value') ?? textOf(priceEl).replace(unit, '').trim();
    const tagEls = [...li.querySelectorAll('.sg-menu-tag')];
    return {
      el: li,
      id: li.dataset.id,
      name: textOf($(li, '.sg-menu-name')) || li.dataset.name,
      line: textOf($(li, '.sg-menu-line')) || li.dataset.line,
      price, unit,
      tags: tagEls.length ? tagEls.map(textOf) : li.dataset.tags,
      availability: li.dataset.availability || textOf($(li, '.sg-menu-status')),
    };
  };
  const sections = [...host.querySelectorAll('.sg-menu-section')];
  const groups = sections.length ? sections : [host];
  return groups.map(sec => ({
    title: textOf($(sec, '.sg-menu-section-title')),
    note: textOf($(sec, '.sg-menu-section-note')),
    items: [...sec.querySelectorAll('.sg-menu-item')].map(read).filter(d => String(d.name ?? '').trim()),
  }));
}

export class SgMenu extends SgElement {
  static observedAttributes = ['register', 'seed', 'orderable', 'currency', 'max-qty'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #menu = { sections: [], items: [] };
  #lis = new Map();      // dish id → its <li>
  #ui = new Map();       // dish id → { count, minus, plus }
  #qtys = new Map();
  #bar = null; #total = null; #head = null; #clear = null; #next = null;
  #last = null; #nonce = 0; #ready = false; #off = [];

  get currency() { return this.getAttribute('currency') || '₹'; }
  get maxQty() { return clampQty(this.getAttribute('max-qty') || MAX_QTY, MAX_QTY) || MAX_QTY; }
  get orderable() { return this.hasAttribute('orderable'); }

  /** The menu as clean data: [{ id, title, note, items: [{ id, name, line, price, unit, tags, availability, orderable }] }]. */
  get items() { return this.#menu.sections; }
  /** Hand it sections (or a flat list of dishes) and it writes the list itself. */
  set items(v) {
    this.#teardown();
    this.innerHTML = menuHTML(normalizeMenu(v), { currency: this.currency });
    if (this.#ready) this.#build();
  }

  /** What is in the order now: { lines, total, count }. */
  get order() { return summarize(this.#menu, this.#qtys, this.maxQty); }

  /** Set how many of a dish (a whole number, 0 to the limit). Says so, like a press does. */
  setQty(id, qty) { return this.#set(id, clampQty(qty, this.maxQty)); }
  /** Empty the order. */
  clear() {
    if (!this.order.count) return;
    this.#qtys.clear();
    for (const id of this.#ui.keys()) this.#paintQty(id);
    this.#last = { id: null, dir: -1, n: ++this.#nonce };
    this.#paint(STRINGS.cleared);
    this.#emit();
  }

  connected() {
    this.#ready = true;
    this.#build();
  }
  disconnected() {
    this.#ready = false;
    this.#teardown();
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (!this.#ready || old === now) return;
    if (name === 'orderable') { this.#teardown(); this.#build(); }
    if (name === 'currency' || name === 'max-qty') { this.#paint(); this.#emit(); }
  }

  #build() {
    const raw = readMarkup(this);
    const lis = raw.flatMap(s => s.items.map(d => d.el));
    this.#menu = normalizeMenu(raw);
    this.#lis.clear();
    this.#menu.items.forEach((it, i) => { lis[i].dataset.id = it.id; this.#lis.set(it.id, lis[i]); });
    for (const id of [...this.#qtys.keys()]) if (!this.#lis.has(id)) this.#qtys.delete(id);
    if (!this.orderable) return;

    for (const it of this.#menu.items) {
      const li = this.#lis.get(it.id);
      if (!it.orderable) {
        if (it.availability !== 'available' && !$(li, '.sg-menu-status')) {
          const meta = $(li, '.sg-menu-meta') ?? li.appendChild(mk('div', 'sg-menu-meta'));
          meta.append(mk('span', 'sg-menu-status', it.availability === 'ask' ? STRINGS.ask : STRINGS.soldOut));
        }
        continue;
      }
      const group = mk('div', 'sg-menu-qty');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', STRINGS.group(it.name));
      const minus = mk('button', 'sg-menu-minus'), plus = mk('button', 'sg-menu-plus'), count = mk('span', 'sg-menu-count', '0');
      minus.type = plus.type = 'button';
      minus.dataset.dir = '-1'; plus.dataset.dir = '1';
      minus.setAttribute('aria-label', STRINGS.remove(it.name));
      plus.setAttribute('aria-label', STRINGS.add(it.name));
      minus.append(mk('span', '', '−')); plus.append(mk('span', '', '+'));
      minus.firstChild.setAttribute('aria-hidden', 'true'); plus.firstChild.setAttribute('aria-hidden', 'true');
      group.append(minus, count, plus);
      li.append(group);
      this.#ui.set(it.id, { count, minus, plus });
      this.#paintQty(it.id);
    }

    this.#head = mk('span', 'sg-menu-sr');
    this.#total = mk('p', 'sg-menu-total');
    this.#total.setAttribute('role', 'status');
    this.#total.setAttribute('aria-live', 'polite');
    this.#total.setAttribute('aria-atomic', 'true');
    this.#total.append(this.#head, mk('span', 'sg-menu-total-text'));
    this.#clear = mk('button', 'sg-menu-clear', STRINGS.clear);
    this.#clear.type = 'button';
    this.#bar = mk('div', 'sg-menu-bar');
    this.#bar.append(this.#total, this.#clear);
    const to = this.getAttribute('continue');
    if (to) {
      this.#next = mk('a', 'sg-menu-continue', this.getAttribute('continue-label') || STRINGS.continueLabel);
      this.#next.href = to;
      this.#bar.append(this.#next);
    }
    this.append(this.#bar);
    this.#paint();

    const onClick = e => {
      const b = e.target.closest?.('.sg-menu-minus, .sg-menu-plus');
      if (b && this.contains(b)) { const id = b.closest('.sg-menu-item')?.dataset.id; if (id) this.#set(id, (this.#qtys.get(id) ?? 0) + Number(b.dataset.dir)); }
      else if (e.target.closest?.('.sg-menu-clear') === this.#clear) this.clear();
    };
    this.addEventListener('click', onClick);
    this.#off.push(() => this.removeEventListener('click', onClick));
    this.update();
  }

  #teardown() {
    this.#off.splice(0).forEach(f => f());
    this.#bar?.remove();
    this.querySelectorAll('.sg-menu-qty').forEach(n => n.remove());
    this.#ui.clear();
    this.#bar = this.#total = this.#head = this.#clear = this.#next = null;
  }

  #set(id, qty) {
    const it = this.#menu.items.find(d => d.id === id);
    if (!it?.orderable || !this.#ui.has(id)) return false;
    const was = this.#qtys.get(id) ?? 0, now = clampQty(qty, this.maxQty);
    if (now === was) { if (qty > was) this.#paint(announce({ name: it.name, now, was, max: this.maxQty })); return false; }
    if (now) this.#qtys.set(id, now); else this.#qtys.delete(id);
    this.#paintQty(id);
    this.#last = { id, dir: now > was ? 1 : -1, n: ++this.#nonce };
    this.#paint(announce({ name: it.name, now, was, max: this.maxQty }));
    this.#emit();
    return true;
  }

  #paintQty(id) {
    const ui = this.#ui.get(id);
    if (!ui) return;
    const q = this.#qtys.get(id) ?? 0, max = this.maxQty;
    ui.count.textContent = String(q);
    ui.count.toggleAttribute('data-zero', q === 0);
    ui.minus.setAttribute('aria-disabled', String(q === 0));
    ui.plus.setAttribute('aria-disabled', String(q >= max));
    this.#lis.get(id)?.toggleAttribute('data-picked', q > 0);
  }

  /** The total line (and what was just said), in the live region and in view. */
  #paint(said = '') {
    if (!this.#total) return;
    const s = this.order;
    this.#head.textContent = said ? `${said} ` : '';
    this.#total.lastChild.textContent = totalLine(s, this.currency);
    this.#clear.setAttribute('aria-disabled', String(!s.count));
    if (this.#next) this.#next.hidden = !s.count;
    this.#bar.toggleAttribute('data-empty', !s.count);
  }

  #emit() { this.emit('sg-change', this.order); this.update(); }

  state() {
    const first = this.#menu.items[0]?.name ?? '';
    return { seed: this.getAttribute('seed') || first || 'menu', last: this.#last, motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-menu', SgMenu);
