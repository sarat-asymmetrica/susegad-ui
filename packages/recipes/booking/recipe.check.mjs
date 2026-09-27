// Browser checks for the booking recipe: the wave's gate (quiet, reduced
// motion, no JavaScript: every step shows and the form validates and submits),
// then the walk with JavaScript: a refused stay, the phone code, the signed
// hold and its Held stamp.
//
//   node packages/recipes/booking/recipe.check.mjs

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const PAGE = `${server.url}/packages/recipes/booking/index.html`;

async function open({ js = true, register = 'warm', reduced = false } = {}) {
  const ctx = await browser.newContext({ javaScriptEnabled: js, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${PAGE}?register=${register}`);
  if (js) await p.waitForFunction(() => window.__ready === true);
  return { ctx, p, errors };
}

// ── the gate: quiet, reduced motion, JavaScript off ─────────────────────
{
  const { ctx, p } = await open({ js: false, register: 'quiet', reduced: true });
  const shown = await p.$$eval('sg-stepper > fieldset > legend', ls => ls.map(l => l.textContent));
  check('no JS: every step shows, in order', JSON.stringify(shown) === JSON.stringify(['Dates', 'Guests and room', 'Your details', 'Confirm and hold']), JSON.stringify(shown));
  check('no JS: no control that needs scripts (no "Send a code", no code field)', await p.evaluate(() => !document.querySelector('.booking__send') && document.querySelector('.booking__verify').hidden));
  check('no JS: it says what needs JavaScript', (await p.$$eval('noscript', n => n.map(x => x.textContent).join(' '))).includes('we confirm your number when we write back'));
  check('no JS: the card promises no price it cannot show (P3)', (await p.textContent('.booking-quote__body')).trim() === 'The house will send the price when they write back.', await p.textContent('.booking-quote__body'));
  check('no JS: the minimum stays are stated under the dates (P3)', await p.isVisible('text=Stays are at least 3 nights, and 4 over Christmas week.'));
  check('no JS: the prototype statement is on the page', (await p.textContent('.booking__prototype')).includes('holds nothing and charges nothing'));
  const before = p.url();
  await p.click('.booking__hold');
  await p.waitForTimeout(300);
  check('no JS: an empty form does not submit', p.url() === before && !(await p.evaluate(() => document.querySelector('form').checkValidity())));
  await p.fill('input[name=arrival]', '2026-11-16');
  await p.fill('input[name=departure]', '2026-11-20');
  await p.selectOption('select[name=guests]', '4');
  await p.fill('#from', 'Belagavi');
  await p.check('input[name=room][value=balcao]');
  await p.fill('#name', 'Anjali Kamat');
  await p.fill('#phone', '98220 12345');
  await p.check('input[name=rules]');
  await p.check('input[name=breakfast]');
  await p.fill('#sig', 'Anjali Kamat');
  const [req] = await Promise.all([p.waitForRequest(r => r.method() === 'POST'), p.waitForURL(/held\.html/), p.click('.booking__hold')]);
  const q = new URLSearchParams(req.postData() ?? '');
  const got = ['arrival', 'departure', 'guests', 'from', 'room', 'name', 'phone', 'rules', 'breakfast', 'signature'].map(k => `${k}=${q.get(k)}`).join(' ');
  check('no JS: a complete form posts every answer natively',
    q.get('arrival') === '2026-11-16' && q.get('departure') === '2026-11-20' && q.get('guests') === '4' && q.get('from') === 'Belagavi' && q.get('room') === 'balcao'
    && q.get('name') === 'Anjali Kamat' && q.get('phone') === '98220 12345' && q.get('rules') === 'yes' && q.get('breakfast') === 'yes' && q.get('signature') === 'Anjali Kamat', got);
  check('no JS: nothing personal in the address bar', !/Anjali|98220/.test(decodeURIComponent(p.url())), p.url());
  const landed = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, text: document.body.textContent }));
  check('no JS: the page it lands on says nothing was kept', landed.h1 === 'Nothing held: this is a prototype' && landed.text.includes('keeps nothing'), landed.h1);
  await ctx.close();
}

// ── the departure note (review W2 B1): refuse, clear, refuse again ────────
{
  const { ctx, p, errors } = await open({ register: 'warm' });
  const dep = 'input[name=departure]';
  const look = () => p.evaluate(sel => {
    const f = document.querySelector(sel), n = document.querySelector(`sg-field-note[for="${f.id}"]`);
    return { text: n?.textContent ?? '', inLabel: !!n?.closest('label'), width: Math.round(f.getBoundingClientRect().width) };
  }, dep);
  const name = async () => (await p.locator(dep).ariaSnapshot()).match(/"([^"]*)"/)?.[1] ?? '';
  const refuse = async () => {
    await p.fill('input[name=arrival]', '2026-12-22');
    await p.fill(dep, '2026-12-24');
    await p.locator(dep).dispatchEvent('change');
    await p.click('.sg-stepper-next');
    await p.waitForTimeout(200);
  };
  const start = await look();
  await refuse();
  const first = await look();
  check('B1: the departure note sits after its label, not in it', !first.inLabel);
  check('B1: refused, the note says the reason once', first.text === 'Error: Stays over Christmas week are at least 4 nights.', first.text);
  check('B1: refused, the departure\'s name is just "Departure"', await name() === 'Departure', await name());
  await p.fill(dep, '');
  await p.locator(dep).dispatchEvent('change');
  await p.click('.sg-stepper-next');
  await p.waitForTimeout(200);
  const cleared = await look();
  check('B1: cleared, "Enter your departure." once', cleared.text === 'Error: Enter your departure.', cleared.text);
  await refuse();
  const again = await look();
  check('B1: refused again, the reason once', again.text === 'Error: Stays over Christmas week are at least 4 nights.', again.text);
  check('B1: the name stays "Departure"', await name() === 'Departure', await name());
  check('B1: the date input keeps its width', new Set([start, first, cleared, again].map(s => s.width)).size === 1, [start, first, cleared, again].map(s => s.width).join(', '));
  await p.screenshot({ path: '.shots/fix-w2/b1-departure-refused-again.png' });
  // R1: after a refusal, picking a new arrival empties the departure; that is the next step, not an error
  await p.click('sg-date-range [data-iso="2026-11-16"]');
  await p.waitForTimeout(200);
  const restart = await p.evaluate(sel => {
    const f = document.querySelector(sel), n = document.querySelector(`sg-field-note[for="${f.id}"]`);
    return { shown: n.shown, text: n.textContent, invalid: f.getAttribute('aria-invalid'), hint: document.querySelector('.sg-dr-hint').textContent };
  }, dep);
  check('R1: a new arrival clears the departure with no error; the hint asks for it', !restart.shown && restart.text === '' && restart.invalid === null && restart.hint.startsWith('Arriving 16 Nov'), JSON.stringify(restart));
  await p.click('.sg-stepper-next');
  await p.waitForTimeout(200);
  check('R1: going on without a departure still says so', (await look()).text === 'Error: Enter your departure.', (await look()).text);
  check('B1: no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── with JavaScript: the walk ───────────────────────────────────────────
for (const register of ['warm', 'quiet']) {
  const { ctx, p, errors } = await open({ register });
  const step = () => p.evaluate(() => document.querySelector('sg-stepper').index);
  const next = () => p.click('.sg-stepper-next');
  const msg = sel => p.evaluate(s => document.querySelector(s).validationMessage, sel);

  // step 1: a stay the card refuses cannot go on; a good one prices
  await p.fill('input[name=arrival]', '2026-12-22');
  await p.fill('input[name=departure]', '2026-12-25');
  await p.locator('input[name=departure]').dispatchEvent('change');
  await next();
  check(`${register}: a refused stay keeps you on the dates, in guests' words`, (await step()) === 0 && (await msg('input[name=departure]')) === 'Stays over Christmas week are at least 4 nights.', await msg('input[name=departure]'));
  const spoken = await p.evaluate(() => ({ said: document.querySelector('.booking-quote__said').textContent, list: document.querySelector('.sg-dr-reasons').textContent }));
  const refusedCard = await p.evaluate(() => ({ first: document.querySelector('.booking-quote__body').firstElementChild?.className, total: !!document.querySelector('.booking-quote__row.is-total'), deposit: !!document.querySelector('.booking-quote__row.is-deposit'), nights: document.querySelectorAll('.booking-quote__row').length }));
  check(`${register}: a refused stay shows why first, the nights, and no total or deposit (P2)`, refusedCard.first === 'booking-quote__refused' && !refusedCard.total && !refusedCard.deposit && refusedCard.nights >= 1, JSON.stringify(refusedCard));
  check(`${register}: a refusal is read out by one region, the calendar's (S2)`, spoken.said === '' && spoken.list === 'Stays over Christmas week are at least 4 nights.', JSON.stringify(spoken));
  await p.click('sg-date-range [data-iso="2026-11-16"]');
  await p.click('sg-date-range [data-iso="2026-11-20"]');
  const rows = await p.$$eval('.booking-quote__row', rs => rs.map(r => r.querySelector('dd').textContent));
  check(`${register}: the quote prices the stay, GST on its own line`, JSON.stringify(rows) === JSON.stringify(['₹80,000', '₹80,000', '₹14,400', '₹94,400', '₹15,000']), JSON.stringify(rows));
  await next();
  check(`${register}: a good stay moves on to guests and room`, (await step()) === 1);

  // step 2: a single room is not on the rate card, so the card shows no figure for it
  await p.check('input[name=room][value=sotao]');
  const roomCard = await p.textContent('.booking-quote__body');
  check(`${register}: a single room gets no figure the card does not have`, roomCard.includes('The house will confirm the price for the Sotão') && !(await p.$('.booking-quote__row')), roomCard);
  await p.check('input[name=room][value=whole]');
  check(`${register}: the whole house brings the figures back`, (await p.$$('.booking-quote__row')).length === 5);
  await p.selectOption('select[name=guests]', '5');
  check(`${register}: guests update the quote`, (await p.textContent('.booking-quote__stay')).replace(/\u00a0/g, ' ').endsWith('5 guests'));
  await next();
  check(`${register}: on to your details`, (await step()) === 2);

  // step 3: the phone must be confirmed with the code the page shows
  // (S2) and typing here must not rewrite any polite region: count every write
  await p.evaluate(() => {
    window.__writes = {};
    for (const sel of ['.booking-quote__said', '.sg-dr-hint', '.sg-dr-reasons']) {
      const el = document.querySelector(sel);
      window.__writes[sel] = 0;
      new MutationObserver(m => { window.__writes[sel] += m.length; }).observe(el, { childList: true, characterData: true, subtree: true });
    }
  });
  await p.locator('#name').pressSequentially('Anjali Kamat', { delay: 10 });
  await p.locator('#phone').pressSequentially('98220 12345', { delay: 10 });
  await p.waitForTimeout(100);
  const writes = await p.evaluate(() => window.__writes);
  check(`${register}: typing a name and a number rewrites no live region (S2)`, Object.values(writes).every(n => n === 0), JSON.stringify(writes));
  const phoneNote = () => p.evaluate(() => { const n = document.querySelector(`sg-field-note[for="${document.getElementById('phone').id}"]`); return n?.shown ? n.textContent : ''; });
  await p.keyboard.press('Tab'); // on to "Send a code", the very next control
  await p.waitForTimeout(150);
  check(`${register}: leaving the number for "Send a code" shows no error yet (S3)`, (await phoneNote()) === '', await phoneNote());
  await next();
  check(`${register}: a number without a code cannot go on`, (await step()) === 2 && (await msg('#phone')) === 'Send a code to confirm this number.', await msg('#phone'));
  check(`${register}: trying to go on without a code shows it under the number`, (await phoneNote()) === 'Error: Send a code to confirm this number.', await phoneNote());
  await p.click('.booking__send');
  await p.waitForTimeout(100);
  check(`${register}: sending the code clears the number's note at once (S3)`, (await phoneNote()) === '', await phoneNote());
  const note = await p.textContent('.booking__code');
  const code = (note.match(/is (\d{3}) (\d{3})\./) || []).slice(1).join('');
  check(`${register}: the page shows the code it would have sent, and says nothing left the page`, code.length === 6 && note.startsWith('Prototype: nothing leaves this page.'), note);
  check(`${register}: the code field's label says where the code went`, (await p.textContent('.booking__verify label')) === 'Enter the 6-digit code we sent to 98220 12345');
  await p.fill('#code', code === '000000' ? '111111' : '000000');
  await next();
  check(`${register}: a wrong code keeps you here`, (await step()) === 2 && (await msg('#code')) === 'That code does not match the one we sent. Check it and try again.', await msg('#code'));
  await p.fill('#code', code);
  await next();
  check(`${register}: the right code moves on to the hold`, (await step()) === 3);

  // step 4: house rules, a reminder, a signature; then the hold
  await p.click('.booking__hold');
  await p.waitForTimeout(300);
  check(`${register}: the hold needs the house rules and a signature`, !(await p.evaluate(() => document.querySelector('sg-stamp:not([pending])'))) && (await step()) === 3);
  const summary = await p.evaluate(() => document.querySelector('.sg-form-words')?.textContent ?? '');
  check(`${register}: the summary names the rules shortly, with one full stop (P4)`, summary.includes('House rules') && !summary.includes('..') && !summary.includes('no parties'), summary);
  await p.check('input[name=rules]');
  await p.check('input[name=breakfast]');
  await p.fill('#sig', 'Anjali Kamat');
  await p.click('.booking__hold');
  await p.waitForFunction(() => document.querySelector('sg-form').dataset.state === 'sent', null, { timeout: 5000 });
  if (register === 'warm') await p.waitForFunction(() => document.querySelector('sg-stamp:not([pending])'), null, { timeout: 5000 }).catch(() => {});
  const held = await p.evaluate(() => ({ text: document.querySelector('sg-form').textContent, stamp: document.querySelector('sg-stamp')?.textContent ?? '' }));
  check(`${register}: the hold is answered with the stay and the prototype words`, held.text.includes('16 Nov to 20 Nov, 4 nights, 5 guests, the whole house. Prototype: nothing is held and nothing is charged.'));
  if (register === 'warm') check('warm: the stamp is a picture with no live region; the words beside it speak (P5)', await p.evaluate(() => { const s = document.querySelector('sg-stamp'); return s.getAttribute('role') === 'none' && !s.querySelector('[role=status], [aria-live]'); }));
  if (register === 'warm') check('warm: the hold lands the Held stamp, with Prototype under it (S1)', held.stamp.includes('Held') && held.stamp.includes('Prototype'), held.stamp);
  check(`${register}: no console errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks pass`);
process.exit(failed ? 1 : 0);
