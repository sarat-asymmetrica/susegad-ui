// Browser checks for <sg-date-range>: the no-JavaScript path, the keyboard
// grid, turnover days, and the kernels' reasons reaching the form's own
// validation. Run by hand or from `npm run check`:
//
//   node packages/components/date-range/date-range.check.mjs

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const DEMO = `${server.url}/packages/components/date-range/demo.html`;

async function open({ js = true, reduced = false, register = 'warm' } = {}) {
  const ctx = await browser.newContext({ javaScriptEnabled: js, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${DEMO}?register=${register}`);
  if (js) await p.waitForFunction(() => window.__ready === true);
  return { ctx, p, errors };
}

// ── without JavaScript: two date inputs in a form, native validation ────
{
  const { ctx, p } = await open({ js: false, register: 'quiet' });
  const form = '#stay';
  check('no JS: the calendar is not there, the two inputs are', await p.evaluate(() => !document.querySelector('.sg-dr') && document.querySelectorAll('#stay input[type=date]').length === 2));
  check('no JS: an empty stay does not submit', await p.evaluate(f => !document.querySelector(f).checkValidity(), form));
  await p.fill('#stay input[name=arrival]', '2026-10-01');
  await p.fill('#stay input[name=departure]', '2026-10-05');
  check('no JS: a date before the window is refused by the input itself', await p.evaluate(() => document.querySelector('#stay input[name=arrival]').validity.rangeUnderflow));
  await p.fill('#stay input[name=arrival]', '2026-11-16');
  await p.fill('#stay input[name=departure]', '2026-11-20');
  await p.click('#stay button[type=submit]');
  await p.waitForLoadState();
  const url = new URL(p.url());
  check('no JS: a good stay submits with the form', url.searchParams.get('arrival') === '2026-11-16' && url.searchParams.get('departure') === '2026-11-20', url.search);
  await ctx.close();
}

// ── with JavaScript: keyboard, picking, turnover, validation ────────────
{
  const { ctx, p, errors } = await open({ register: 'warm' });
  const dr = p.locator('#stay sg-date-range');
  const stop = () => p.evaluate(() => document.querySelector('#stay .sg-dr-day[tabindex="0"]')?.dataset.iso);
  const focused = () => p.evaluate(() => document.activeElement?.dataset?.iso);
  const values = () => p.evaluate(() => [...document.querySelectorAll('#stay input[type=date]')].map(i => i.value));

  check('one tab stop in the grid, on the first day you can arrive', await stop() === '2026-10-22', await stop());
  await p.focus('#stay .sg-dr-day[tabindex="0"]');
  await p.keyboard.press('ArrowRight');
  check('ArrowRight moves a day', await focused() === '2026-10-23');
  await p.keyboard.press('ArrowDown');
  check('ArrowDown moves a week', await focused() === '2026-10-30');
  await p.keyboard.press('Home');
  check('Home goes to Monday', await focused() === '2026-10-26');
  await p.keyboard.press('End');
  check('End goes to Sunday', await focused() === '2026-11-01');
  await p.keyboard.press('PageDown');
  check('PageDown moves a month and brings it into view', await focused() === '2026-12-01' && await p.evaluate(() => !!document.querySelector('#stay [data-iso="2026-12-01"]')));
  await p.keyboard.press('PageUp');
  await p.keyboard.press('PageUp');
  check('PageUp goes back, and the first month holds', await focused() === '2026-10-01', await focused());

  // pick with the keyboard: 10 Nov, then 13 Nov (others arrive that day; you may leave that morning)
  await p.evaluate(() => document.querySelector('#stay [data-iso="2026-11-10"]').focus());
  await p.keyboard.press('Enter');
  check('Enter picks the arrival and writes the input', JSON.stringify(await values()) === JSON.stringify(['2026-11-10', '']), JSON.stringify(await values()));
  const hint = await p.textContent('#stay .sg-dr-hint');
  check('the hint says what to do next', hint === 'Arriving 10 Nov. Now pick your departure.', hint);
  check('a day past a taken night cannot be the departure', await p.getAttribute('#stay [data-iso="2026-11-14"]', 'aria-disabled') === 'true');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  await p.keyboard.press(' ');
  check('Space picks the departure on the turnover morning', JSON.stringify(await values()) === JSON.stringify(['2026-11-10', '2026-11-13']), JSON.stringify(await values()));
  const sel = await p.evaluate(() => [...document.querySelectorAll('#stay td[aria-selected=true] [data-iso]')].map(b => b.dataset.iso));
  check('both ends are selected in the grid', JSON.stringify(sel) === JSON.stringify(['2026-11-10', '2026-11-13']), JSON.stringify(sel));
  check('the stay is valid', await p.evaluate(() => document.querySelector('#stay').checkValidity()));

  // type a stay that crosses a taken night: the form's own validation says why
  await p.fill('#stay input[name=arrival]', '2026-11-11');
  await p.fill('#stay input[name=departure]', '2026-11-18');
  await p.locator('#stay input[name=departure]').dispatchEvent('change');
  const why = await p.evaluate(() => ({ msg: document.querySelector('#stay input[name=departure]').validationMessage, list: document.querySelector('#stay .sg-dr-reasons').textContent, ok: document.querySelector('#stay').checkValidity() }));
  check('a typed stay across a taken night is refused, with the reason', !why.ok && why.msg === 'The night of 13 November is already taken.' && why.list === why.msg, JSON.stringify(why));
  await p.fill('#stay input[name=arrival]', '2026-12-22');
  await p.fill('#stay input[name=departure]', '2026-12-25');
  await p.locator('#stay input[name=departure]').dispatchEvent('change');
  check("the rate card rules too, in guests' words: the Christmas minimum", await p.evaluate(() => document.querySelector('#stay input[name=departure]').validationMessage) === 'Stays over Christmas week are at least 4 nights.');
  check('the calendar follows typed dates', await p.evaluate(() => !!document.querySelector('#stay [data-iso="2026-12-22"].is-arr')));
  const label = await p.getAttribute('#stay [data-iso="2026-12-24"]', 'aria-label');
  check('a free day is named in full, with its price in Indian grouping', label === 'Thu 24 Dec 2026, free night, ₹40,000, Christmas week', label);
  const turn = await p.getAttribute('#stay [data-iso="2026-12-26"]', 'aria-label');
  check('a taken day that others arrive on says you can leave that morning', turn === 'Sat 26 Dec 2026, taken, you can leave on this day', turn);
  check('the season table is text, and says the card is per night', await p.evaluate(() => document.querySelector('#stay .sg-dr-seasons tbody tr[data-kind=peak]').textContent.includes('₹40,000 to ₹48,000')));
  check('no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── a new rate card redraws; open-from opens the calendar before the bookings do ──
{
  const { ctx, p, errors } = await open({ register: 'warm' });
  await p.evaluate(() => {
    const f = document.createElement('form');
    f.id = 'enq';
    f.innerHTML = `<sg-date-range prices today="2026-09-24"><fieldset><legend>Your dates</legend>
      <label>Arrival <input type="date" name="arrival"></label><label>Departure <input type="date" name="departure"></label></fieldset></sg-date-range>`;
    document.querySelector('main').append(f);
  });
  await p.waitForFunction(() => document.querySelector('#enq .sg-dr-day'));
  const $ = sel => `#enq ${sel}`;
  const day = iso => p.getAttribute($(`[data-iso="${iso}"]`), 'aria-label');
  const disabled = iso => p.getAttribute($(`[data-iso="${iso}"]`), 'aria-disabled');
  const limits = () => p.evaluate(() => [...document.querySelectorAll('#enq input[type=date]')].map(i => `${i.min}..${i.max}`));

  const first = () => p.evaluate(() => document.querySelector('#enq .sg-dr-day')?.dataset.iso);
  check('without open-from, the calendar starts in the month the rate card opens', await first() === '2026-10-01' && /before the house opens on/.test(await day('2026-10-14')), `${await first()} ${await day('2026-10-14')}`);
  check('without open-from, the arrival input opens on the rate card date', (await limits())[0] === '2026-10-15..2027-06-30', JSON.stringify(await limits()));

  await p.evaluate(() => document.querySelector('#enq sg-date-range').setAttribute('open-from', '2026-09-24'));
  check('open-from: the calendar starts this month', await first() === '2026-09-01', await first());
  check('open-from: every night after the notice period can be picked', await disabled('2026-09-26') === 'false' && await disabled('2026-09-25') === 'true', `${await disabled('2026-09-25')} ${await disabled('2026-09-26')}`);
  check('open-from: the inputs\' limits move with it', (await limits())[0] === '2026-09-26..2027-06-30' && (await limits())[1] === '2026-09-27..2027-07-01', JSON.stringify(await limits()));
  const w = await p.evaluate(() => { const el = document.querySelector('#enq sg-date-range'); return { picks: el.window.openFrom, ribbon: el.rates.window.openFrom }; });
  check('open-from: the ribbon keeps the rate card\'s opening date', w.picks === '2026-09-24' && w.ribbon === '2026-10-15', JSON.stringify(w));
  await p.click($('[data-iso="2026-09-28"]'));
  await p.click($('[data-iso="2026-10-02"]'));
  const ok = await p.evaluate(() => ({ valid: document.querySelector('#enq').checkValidity(), msg: document.querySelector('#enq input[name=departure]').validationMessage }));
  check('open-from: a stay before the rate card opens is valid', ok.valid, JSON.stringify(ok));
  await p.locator('#enq').screenshot({ path: '.shots/fix-w2/date-range-open-from.png' }).catch(() => {});
  await p.evaluate(() => document.querySelector('#enq sg-date-range').removeAttribute('open-from'));
  const back = await p.evaluate(() => ({ valid: document.querySelector('#enq').checkValidity(), msg: document.querySelector('#enq input[name=departure]').validationMessage }));
  check('removing open-from closes those nights again, and says why', !back.valid && /opens for stays on 15 October 2026/.test(back.msg), JSON.stringify(back));
  check('removing open-from moves the limits back', (await limits())[0] === '2026-10-15..2027-06-30', JSON.stringify(await limits()));

  // a new rate card: prices, season table and window redraw with no nudge
  await p.evaluate(() => {
    const el = document.querySelector('#enq sg-date-range'), r = el.rates;
    el.rates = { ...r, bands: r.bands.map(b => b.id === 'shoulder' ? { ...b, weekday: 30000 } : b), window: { ...r.window, openUntil: '2027-03-31' } };
  });
  check('setting rates redraws the prices', /₹30,000/.test(await day('2026-10-20')), await day('2026-10-20'));
  check('setting rates rebuilds the season table', await p.evaluate(() => document.querySelector('#enq .sg-dr-seasons tr[data-kind=shoulder]').textContent.includes('₹30,000 to ₹26,000')));
  check('setting rates moves the limits the element set', (await limits())[0] === '2026-10-15..2027-03-31', JSON.stringify(await limits()));
  check('a page\'s own limits are never moved', await p.evaluate(() => document.querySelector('#stay input[name=arrival]').min) === '2026-10-22');
  check('no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── reduced motion: the ink is there at once ─────────────────────────────
{
  const { ctx, p } = await open({ reduced: true, register: 'warm' });
  await p.click('#stay [data-iso="2026-11-16"]');
  await p.click('#stay [data-iso="2026-11-20"]');
  const inked = await p.evaluate(() => {
    const c = document.querySelector('#stay .sg-dr-ink'), g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  check('reduced motion: the loops and underline are drawn in full straight away', inked > 500, `${inked} inked pixels`);
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks pass`);
process.exit(failed ? 1 : 0);
