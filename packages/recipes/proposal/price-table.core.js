// The proposal's price tables, pure: the whole rate card by season, or one
// stay's quote, worked out by the booking kernels and written as plain HTML.
// Runs in Node at build time, so a sealed document reads and prints with its
// figures whether or not its scripts run; <sg-price-table> only enhances it.

import { RATES } from '../../kernels/booking/rates.js';
import { quote, rupees } from '../../kernels/booking/pricing.js';
import { longDate, diffDays } from '../../kernels/booking/dates.js';

/** Every word the tables use. Kathakar edits these. */
export const STRINGS = {
  bandsCaption: 'The rate card: whole house, a night, before GST',
  bandsCols: ['Season', 'When', 'Sunday to Thursday', 'Friday and Saturday', 'Shortest stay'],
  stayCaption: (from, to, n, guests) => `${from} to ${to}: ${n} ${n === 1 ? 'night' : 'nights'}, ${guests} ${guests === 1 ? 'guest' : 'guests'}`,
  stayCols: ['Night', 'Season', 'Rate'],
  run: (n, label, weekend) => `${n} ${weekend ? (n === 1 ? 'Friday or Saturday night' : 'Friday and Saturday nights') : (n === 1 ? 'weeknight' : 'weeknights')}`,
  beforeGst: 'Before GST',
  gst: rate => `GST at ${Math.round(rate * 100)}%`,
  noGst: 'GST (none below ₹7,500 a night)',
  withGst: 'Total with GST',
  includesGst: 'Total, GST included',
  ofWhichGst: rate => `of which GST at ${Math.round(rate * 100)}%`,
  deposit: 'Refundable deposit',
  provisional: 'provisional',
  nights: n => `${n} ${n === 1 ? 'night' : 'nights'}`,
  noteBands: 'Every rate marked provisional is a first figure the house has not confirmed yet.',
  noteStay: 'Figures marked provisional may change when the house confirms its rate card.',
  exclusive: 'Prices are before GST; GST is added on its own line.',
  inclusive: 'Prices include GST; its share is shown on its own line.',
  refused: 'This stay could not be booked as written:',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const mmdd = s => { const [m, d] = s.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * The rate card as rows, one per season in the order it first appears; a
 * season that comes round twice (shoulder) lists both stretches.
 */
export function bandsModel(rates = RATES) {
  const rows = new Map();
  for (const b of rates.bands) {
    const r = rows.get(b.id) ?? { id: b.id, label: b.label, when: [], weekday: b.weekday, weekend: b.weekend, minNights: b.minNights, provisional: false, peak: b.tone === 'peak' };
    r.when.push(`${mmdd(b.from)} to ${mmdd(b.to)}`);
    r.provisional ||= !!b.provisional;
    rows.set(b.id, r);
  }
  const list = [...rows.values()];
  return {
    view: 'bands',
    rows: list.map(r => ({ ...r, when: r.when.join(', '), weekdayText: rupees(r.weekday), weekendText: rupees(r.weekend), minText: STRINGS.nights(r.minNights) })),
    provisional: list.some(r => r.provisional),
    gstMode: rates.gst.inclusive ? 'inclusive' : 'exclusive',
  };
}

/**
 * One stay: a row per night for up to a week, grouped by season and weekday
 * or weekend for longer stays; then before GST, GST, the total and the deposit.
 */
export function stayModel(arrival, departure, guests = 2, rates = RATES) {
  const q = quote(arrival, departure, rates);
  const n = Math.max(0, diffDays(arrival, departure));
  let rows;
  if (q.nights.length <= 7) {
    rows = q.nights.map(x => ({ label: longDate(x.date), season: x.label, rate: x.rate, rateText: rupees(x.rate), provisional: x.provisional, weekend: x.weekend }));
  } else {
    const g = new Map();
    for (const x of q.nights) {
      const k = `${x.band}|${x.weekend}|${x.rate}`;
      const r = g.get(k) ?? { season: x.label, weekend: x.weekend, rate: x.rate, count: 0, provisional: x.provisional };
      r.count++;
      g.set(k, r);
    }
    rows = [...g.values()].map(r => ({ label: `${STRINGS.run(r.count, r.season, r.weekend)} at ${rupees(r.rate)}`, season: r.season, rate: r.rate * r.count, rateText: rupees(r.rate * r.count), provisional: r.provisional, weekend: r.weekend }));
  }
  const inclusive = q.gstMode === 'inclusive';
  return {
    view: 'stay',
    ok: q.ok,
    reasons: q.reasons,
    caption: STRINGS.stayCaption(longDate(arrival), longDate(departure), n, guests),
    rows,
    beforeGst: { label: STRINGS.beforeGst, value: q.subtotal, text: rupees(q.subtotal) },
    gst: q.gst ? { label: inclusive ? STRINGS.ofWhichGst(q.gstRate) : STRINGS.gst(q.gstRate), value: q.gst, text: rupees(q.gst) } : { label: STRINGS.noGst, value: 0, text: rupees(0) },
    total: { label: inclusive ? STRINGS.includesGst : STRINGS.withGst, value: q.total, text: rupees(q.total) },
    deposit: { label: STRINGS.deposit, value: q.deposit, text: rupees(q.deposit), provisional: !!rates.deposit.provisional },
    provisional: q.provisional || !!rates.deposit.provisional,
    gstMode: q.gstMode,
  };
}

const mark = p => (p ? ` <span class="price-table__provisional">${STRINGS.provisional}</span>` : '');

/** A model as a plain HTML table: readable with no script, in print, and to a screen reader. */
export function tableHTML(m) {
  if (m.view === 'bands') {
    const [c1, c2, c3, c4, c5] = STRINGS.bandsCols;
    return `<table class="price-table" data-view="bands">
<caption>${esc(STRINGS.bandsCaption)}</caption>
<thead><tr><th scope="col">${c1}</th><th scope="col">${c2}</th><th scope="col" class="num">${c3}</th><th scope="col" class="num">${c4}</th><th scope="col">${c5}</th></tr></thead>
<tbody>
${m.rows.map(r => `<tr data-band="${esc(r.id)}"${r.peak ? ' data-peak' : ''}><th scope="row">${esc(r.label)}${mark(r.provisional)}</th><td data-label="${esc(c2)}">${esc(r.when)}</td><td class="num" data-label="${esc(c3)}">${esc(r.weekdayText)}</td><td class="num" data-label="${esc(c4)}">${esc(r.weekendText)}</td><td data-label="${esc(c5)}">${esc(r.minText)}</td></tr>`).join('\n')}
</tbody>
</table>
<p class="price-table__note">${esc(m.gstMode === 'inclusive' ? STRINGS.inclusive : STRINGS.exclusive)}${m.provisional ? ` ${esc(STRINGS.noteBands)}` : ''}</p>`;
  }
  const [c1, c2, c3] = STRINGS.stayCols;
  const foot = (row, cls, extra = '') => `<tr class="${cls}"><th scope="row" colspan="2">${esc(row.label)}${extra}</th><td class="num">${esc(row.text)}</td></tr>`;
  const refused = m.ok ? '' : `\n<div class="price-table__refused" role="note"><p>${esc(STRINGS.refused)}</p><ul>${m.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
  return `<table class="price-table" data-view="stay">
<caption>${esc(m.caption)}</caption>
<thead><tr><th scope="col">${c1}</th><th scope="col">${c2}</th><th scope="col" class="num">${c3}</th></tr></thead>
<tbody>
${m.rows.map((r, i) => `<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.season)}${mark(r.provisional && m.rows.findIndex(x => x.season === r.season) === i)}</td><td class="num">${esc(r.rateText)}</td></tr>`).join('\n')}
</tbody>
<tfoot>
${foot(m.beforeGst, 'is-before')}
${foot(m.gst, 'is-gst')}
${foot(m.total, 'is-total')}
${foot(m.deposit, 'is-deposit', mark(m.deposit.provisional))}
</tfoot>
</table>${refused}
<p class="price-table__note">${esc(m.gstMode === 'inclusive' ? STRINGS.inclusive : STRINGS.exclusive)}${m.provisional ? ` ${esc(STRINGS.noteStay)}` : ''}</p>`;
}

/** From directive attributes to the model: `view=bands`, or a stay from arrival and departure. */
export function modelFor(attrs, rates = RATES) {
  if (attrs.view === 'bands') return bandsModel(rates);
  return stayModel(attrs.arrival, attrs.departure, Number(attrs.guests ?? 2) || 2, rates);
}
