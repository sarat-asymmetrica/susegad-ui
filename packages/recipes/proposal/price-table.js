// <sg-price-table>: a proposal's price table, alive. The table itself is
// written at build time from the booking kernels (price-table.core.js), so it
// reads and prints with no script. Here, a stay's table also lets the reader
// try other dates, priced on the page by the same kernels.
//
//   <sg-price-table from="kernels-booking" arrival="2026-11-16" departure="2026-11-20" guests="2">
//     <table class="price-table" data-view="stay">…</table>
//   </sg-price-table>

import { stayModel, tableHTML, modelFor } from './price-table.core.js';
import { addDays, isValidISO, longDate } from '../../kernels/booking/dates.js';
import { RATES } from '../../kernels/booking/rates.js';

export const STRINGS = {
  tryDates: 'Try other dates',
  // heard after "Try other dates", so each stay's control has its own name
  insteadOf: (a, d) => ` instead of ${a} to ${d}`,
  arrival: 'Arrival',
  departure: 'Departure',
  back: 'Back to the dates in the proposal',
  priced: (a, d) => `Priced for ${a} to ${d}.`,
};

let uid = 0;

export class SgPriceTable extends (globalThis.HTMLElement ?? class {}) {
  rates = RATES;
  #own = null;

  connectedCallback() {
    if (this.#own) return;
    // no table in the page (a hand-written directive, say): write it now
    if (!this.querySelector('table.price-table')) this.#render(modelFor(Object.fromEntries([...this.attributes].map(a => [a.name, a.value])), this.rates));
    if (this.getAttribute('view') === 'bands' || !this.hasAttribute('arrival')) return;
    this.#own = { arrival: this.getAttribute('arrival'), departure: this.getAttribute('departure') };
    this.#tryOther();
  }

  #render(model) {
    const box = document.createElement('div');
    box.innerHTML = tableHTML(model);
    // keep anything the page put in (the fallback line) out of the way
    this.querySelectorAll('.folio-fallback, table.price-table, .price-table__note, .price-table__refused').forEach(n => n.remove());
    this.prepend(...box.childNodes);
  }

  // A small form under a stay's table: two dates, priced as they change.
  #tryOther() {
    const id = `price-try-${++uid}`, guests = Number(this.getAttribute('guests') ?? 2) || 2;
    const d = document.createElement('details');
    d.className = 'price-table__try';
    d.innerHTML = `<summary>${STRINGS.tryDates}<span class="price-table__vh">${STRINGS.insteadOf(longDate(this.#own.arrival), longDate(this.#own.departure))}</span></summary>
<div class="price-table__try-fields">
<label for="${id}-a">${STRINGS.arrival}</label><input type="date" id="${id}-a" value="${this.#own.arrival}">
<label for="${id}-d">${STRINGS.departure}</label><input type="date" id="${id}-d" value="${this.#own.departure}">
<button type="button">${STRINGS.back}</button>
</div>
<p class="price-table__said" role="status"></p>`;
    this.append(d);
    const [a, dep] = d.querySelectorAll('input'), said = d.querySelector('[role=status]');
    const price = () => {
      if (!isValidISO(a.value) || !isValidISO(dep.value)) return;
      if (dep.value <= a.value) dep.value = addDays(a.value, 1);
      const m = stayModel(a.value, dep.value, guests, this.rates);
      this.#render(m);
      said.textContent = `${STRINGS.priced(a.value, dep.value)} ${m.total.label} ${m.total.text}.`;
    };
    a.addEventListener('change', price);
    dep.addEventListener('change', price);
    d.querySelector('button').addEventListener('click', () => { a.value = this.#own.arrival; dep.value = this.#own.departure; price(); });
  }
}

if (globalThis.customElements && !customElements.get('sg-price-table')) customElements.define('sg-price-table', SgPriceTable);
