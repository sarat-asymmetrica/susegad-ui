// <sg-data-table>: a native <table> that sorts and scrolls, for the registers
// where the numbers are the point. The markup is a plain table that reads fine
// without JavaScript: a <caption>, th with data-sort on the columns you want
// sortable, td[data-money] where money goes. With it, the element:
//
//   - wraps the table in a scrollable region, so at phone width the table
//     scrolls sideways inside itself and the page never does;
//   - turns each sortable th into a real <button>, so the sort is the
//     platform's focus and Enter and Space;
//   - writes aria-sort on the sorted th (ascending, descending, then gone)
//     and reorders the rows with a stable sort;
//   - rewrites every td[data-money] with the Indian grouping from the pure
//     core, so what is rendered and what the code says can never disagree.
//
//   <sg-data-table>
//     <table>
//       <caption>Collections, April to September</caption>
//       <thead><tr>
//         <th scope="col" data-sort="month">Month</th>
//         <th scope="col" data-sort="collected">Collected</th>
//       </tr></thead>
//       <tbody>
//         <tr><td>April</td><td data-money="125000">₹1,25,000</td></tr>
//       </tbody>
//     </table>
//   </sg-data-table>
//
// Attributes: register. Events: sg-table-sort { id, dir } on every change.

import { SgElement, defineComponent } from '../../core/component.js';
import { ariaSort, cellValue, nextSort, sortRows } from './data-table.core.js';
import { rupees } from '../../core/intl.core.js';
import { arrive } from '../../core/arrive.js';

export class SgDataTable extends SgElement {
  static native = 'table';
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #sort = null; #sortable = []; #heads = new Map(); #order = []; #arrive = null;

  connected() {
    const table = this.native;
    if (!table) return console.warn('sg-data-table: put a <table> inside the element.');
    if (!table.caption?.textContent?.trim()) console.warn('sg-data-table: give the table a <caption>; it is its name, on the page and to a screen reader.');
    this.#order = [...(table.tBodies[0] ?? table).rows];
    this.#wrap(table);
    this.#money(table);
    this.#headers(table);
    this.#apply(false);
    this.#arrive = arrive(this, 'tbody tr');
  }

  disconnected() { this.#arrive?.stop(); this.#arrive = null; }

  /** The table scrolls inside the element; the page never scrolls sideways. */
  #wrap(table) {
    if (table.parentElement?.classList?.contains('sg-table-wrap')) return;
    const wrap = this.ownerDocument.createElement('div');
    wrap.className = 'sg-table-wrap';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', table.caption?.textContent?.trim() || 'Scrollable table');
    wrap.setAttribute('data-when', 'wide');
    table.before(wrap);
    wrap.append(table);
  }

  /** Every td[data-money] is rewritten from core-intl: 125000 becomes ₹1,25,000. */
  #money(table) {
    for (const td of table.querySelectorAll('td[data-money]')) {
      const v = rupees(td.getAttribute('data-money'));
      if (v && !td.children.length) td.textContent = v;
    }
  }

  /** The sortable headers: a button in each th[data-sort]. */
  #headers(table) {
    const heads = [...table.querySelectorAll('thead th[data-sort]')];
    for (const th of heads) {
      if (this.#heads.has(th)) continue;
      const name = th.textContent.trim();
      const btn = this.ownerDocument.createElement('button');
      btn.type = 'button';
      btn.className = 'sg-table-sort';
      btn.append(...th.childNodes);
      th.replaceChildren(btn);
      btn.addEventListener('click', () => this.sort(th));
      this.#heads.set(th, btn);
      this.#sortable.push({ th, name });
    }
  }

  /** Turn the state on the th elements and put the rows in order. */
  #apply(reorder = true) {
    const table = this.native;
    if (!table) return;
    for (const { th } of this.#sortable) {
      const dir = this.#sort?.id === th.getAttribute('data-sort') ? this.#sort.dir : null;
      const btn = this.#heads.get(th);
      if (ariaSort(dir)) th.setAttribute('aria-sort', ariaSort(dir));
      else th.removeAttribute('aria-sort');
      if (btn) btn.setAttribute('aria-label', `${sortLabelFor(btn)}${dir ? `, now ${dir === 'asc' ? 'smallest first' : 'largest first'}` : ''}`);
      th.toggleAttribute('data-sorted', !!dir);
      th.dataset.dir = dir ?? '';
    }
    if (reorder) {
      const tbody = table.tBodies[0] ?? table;
      if (this.#sort?.dir) {
        const th = this.#sortable.find(s => s.th.getAttribute('data-sort') === this.#sort.id)?.th;
        if (!th) return;
        const rows = [...tbody.rows], col = th.cellIndex;
        this.#arrive?.seen(rows);
        for (const r of sortRows(rows, this.#sort.dir, row => cellValue(row.cells[col]))) tbody.append(r);
      } else {
        // no sort: the written order, whatever a previous sort did
        this.#arrive?.seen(this.#order);
        for (const r of this.#order) if (r.parentNode === tbody) tbody.append(r);
      }
    }
  }

  /** Sort by a column: none → ascending → descending → none. */
  sort(th) {
    const id = typeof th === 'string' ? th : th.getAttribute('data-sort');
    if (!id || !this.#sortable.some(s => s.th.getAttribute('data-sort') === id)) return false;
    this.#sort = nextSort(this.#sort, id);
    this.#apply();
    this.emit('sg-table-sort', { ...this.#sort });
    return true;
  }

  state() {
    return { column: this.#sort?.id ?? null, dir: this.#sort?.dir ?? null, motion: this.motion, visible: this.visible };
  }
}

// The button's own words come from the text it was built from, so the label is
// the author's, not ours. Kept here so #apply can refresh only the state part.
function sortLabelFor(btn) { return btn.textContent.trim(); }

defineComponent('sg-data-table', SgDataTable);
