import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RATES } from '../../kernels/booking/rates.js';
import { bandsModel, stayModel, tableHTML, modelFor, STRINGS as P } from './price-table.core.js';
import { readSteps, sayStep, stepAt, timelineHTML } from './timeline.core.js';

// ── price tables ────────────────────────────────────────────────────────

test('the rate card: a row per season, both stretches of the shoulder, provisional in words', () => {
  const m = bandsModel();
  assert.deepEqual(m.rows.map(r => r.label), ['Launch & monsoon', 'Shoulder', 'Christmas week', 'Late season']);
  const shoulder = m.rows[1];
  assert.equal(shoulder.when, '1 October to 19 December, 6 January to 31 January');
  assert.equal(shoulder.weekdayText, '₹20,000');
  assert.equal(shoulder.weekendText, '₹26,000');
  assert.equal(shoulder.minText, '3 nights');
  assert.equal(m.rows[2].when, '20 December to 5 January', 'Christmas wraps the year');
  assert.equal(m.rows[2].minText, '4 nights');
  assert.ok(m.rows.every(r => r.provisional));
  const html = tableHTML(m);
  assert.equal((html.match(/>provisional</g) || []).length, 4, '"provisional" as a word on every season, not only a style');
  assert.match(html, /<caption>The rate card: whole house, a night, before GST<\/caption>/);
  assert.match(html, /Prices are before GST; GST is added on its own line\./);
});

test('November: four weeknights, before GST, GST on its own line, the total, the deposit', () => {
  const m = stayModel('2026-11-16', '2026-11-20', 2); // Mon to Thu nights, shoulder, 20,000 each
  assert.equal(m.ok, true);
  assert.equal(m.caption, 'Mon 16 Nov 2026 to Fri 20 Nov 2026: 4 nights, 2 guests');
  assert.deepEqual(m.rows.map(r => [r.label, r.rateText]), [
    ['Mon 16 Nov 2026', '₹20,000'], ['Tue 17 Nov 2026', '₹20,000'], ['Wed 18 Nov 2026', '₹20,000'], ['Thu 19 Nov 2026', '₹20,000'],
  ]);
  assert.deepEqual([m.beforeGst.text, m.gst.label, m.gst.text, m.total.label, m.total.text], ['₹80,000', 'GST at 18%', '₹14,400', 'Total with GST', '₹94,400']);
  assert.equal(m.deposit.text, '₹15,000');
  assert.equal(m.deposit.provisional, true, 'the deposit is a placeholder, and says so');
});

test("Christmas: the proposal's own numbers, 40k, 48k, 48k, 40k = ₹1,76,000 before GST", () => {
  const m = stayModel('2026-12-24', '2026-12-28', 2);
  assert.deepEqual(m.rows.map(r => r.rate), [40000, 48000, 48000, 40000]);
  assert.deepEqual(m.rows.map(r => r.season), ['Christmas week', 'Christmas week', 'Christmas week', 'Christmas week']);
  assert.equal(m.beforeGst.text, '₹1,76,000');
  assert.equal(m.gst.text, '₹31,680');
  assert.equal(m.total.text, '₹2,07,680');
  const html = tableHTML(m);
  assert.match(html, /<th scope="row" colspan="2">Before GST<\/th><td class="num">₹1,76,000<\/td>/);
  assert.match(html, /Refundable deposit <span class="price-table__provisional">provisional<\/span>/);
  assert.match(html, /Figures marked provisional may change/);
  assert.equal((html.match(/>provisional</g) || []).length, 2, 'once for the season (not on every night), once for the deposit');
});

test('long stays group their nights; refused stays say why; inclusive GST says so', () => {
  const long = stayModel('2026-10-15', '2026-10-26', 2); // 11 nights: grouped
  assert.deepEqual(long.rows.map(r => r.label), ['7 weeknights at ₹20,000', '4 Friday and Saturday nights at ₹26,000']);
  assert.equal(long.rows.reduce((s, r) => s + r.rate, 0), long.beforeGst.value);
  const refused = stayModel('2026-12-22', '2026-12-25', 2);
  assert.equal(refused.ok, false);
  assert.match(tableHTML(refused), /could not be booked as written:<\/p><ul><li>The Christmas band has a 4-night minimum\.<\/li>/);
  const inc = stayModel('2026-11-16', '2026-11-20', 2, { ...RATES, gst: { ...RATES.gst, inclusive: true } });
  assert.equal(inc.total.label, 'Total, GST included');
  assert.equal(inc.gst.label, 'of which GST at 18%');
  assert.equal(inc.total.text, '₹80,000');
  assert.match(tableHTML(inc), /Prices include GST; its share is shown on its own line\./);
});

test('directive attributes choose the view', () => {
  assert.equal(modelFor({ view: 'bands' }).view, 'bands');
  assert.equal(modelFor({ arrival: '2026-11-16', departure: '2026-11-20', guests: '4' }).caption, 'Mon 16 Nov 2026 to Fri 20 Nov 2026: 4 nights, 4 guests');
  assert.ok(!tableHTML(modelFor({ view: 'bands' })).includes(String.fromCharCode(0x2014)));
  for (const w of Object.values(P)) assert.ok(!String(typeof w === 'function' ? w('a', 'b', 2, 2) : w).includes(String.fromCharCode(0x2014)));
});

// ── timeline ────────────────────────────────────────────────────────────

const plan = [
  '1. **You choose an option.** Reply on WhatsApp, or sign below.',
  '2. **Registration and certificates.** You file the registration.',
  '3. **The shoot.** We write the brief together.',
].map((text, i) => ({ text, line: 10 + i }));

test("the timeline reads Kathakar's numbered steps, and dated lines too", () => {
  const { steps, problems } = readSteps(plan);
  assert.deepEqual(problems, []);
  assert.deepEqual(steps[0], { title: 'You choose an option.', text: 'Reply on WhatsApp, or sign below.', when: null });
  const dated = readSteps([{ text: '- 2026-11-01: Survey the house', line: 1 }, { text: '- Week 2: The shoot', line: 2 }]);
  assert.deepEqual(dated.steps.map(s => [s.when, s.title]), [['2026-11-01', 'Survey the house'], ['Week 2', 'The shoot']]);
  assert.equal(readSteps([{ text: 'just a sentence', line: 7 }, ...plan]).problems[0].line, 7);
  assert.match(readSteps(plan.slice(0, 1)).problems[0].message, /at least two steps/);
});

test('each step is said in words; the scrubber lands on steps evenly', () => {
  const { steps } = readSteps(plan);
  assert.equal(sayStep(steps, 0), 'Step 1 of 3: You choose an option. Reply on WhatsApp, or sign below.');
  assert.equal(sayStep(steps, 9), 'Step 3 of 3: The shoot. We write the brief together.', 'clamped');
  assert.deepEqual([0, 0.24, 0.26, 0.5, 0.74, 1].map(v => stepAt(v, 3)), [0, 0, 1, 1, 1, 2]);
  const html = timelineHTML(steps, { title: 'The plan' });
  assert.match(html, /^<sg-timeline label="The plan">/);
  assert.equal((html.match(/<li class="timeline__step"/g) || []).length, 3, 'every step is in the page, in order, without scripts');
  assert.match(html, /<strong class="timeline__title">The shoot\.<\/strong> <span class="timeline__text">We write the brief together\.<\/span>/);
});

test('a timeline takes one form: numbered undated steps, or dated lines, never both', () => {
  const at = (texts) => texts.map((text, i) => ({ text, line: i + 10 }));
  const numbered = readSteps(at(['1. **You choose.** Sign below.', '2. **We build.** On your domain.']));
  assert.deepEqual(numbered.problems, []);
  assert.deepEqual(numbered.steps.map(s => [s.when, s.title]), [[null, 'You choose.'], [null, 'We build.']]);
  assert.equal(sayStep(numbered.steps, 1), 'Step 2 of 2: We build. On your domain.', 'an undated step is said by its number');
  const dated = readSteps(at(['- 2026-11-02: Survey the roof', '- 2026-12: New tiles']));
  assert.deepEqual(dated.problems, []);
  assert.equal(dated.steps[0].when, '2026-11-02');
  const mixed = readSteps(at(['1. **You choose.** Sign below.', '- 2026-12: New tiles']));
  assert.equal(mixed.problems.length, 1);
  assert.equal(mixed.problems[0].line, 10);
  assert.match(mixed.problems[0].message, /mixes numbered steps .* and dated lines .* Use one form/);
});
