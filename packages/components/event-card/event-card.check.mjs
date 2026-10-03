// Browser checks for <sg-event-card>: axe, the four states of the clock (set by faking
// the time), the seats line only when a number is given, the booking link going when the
// event is over, the keyboard reaching it, the playful tear, no JavaScript, and phone width.
// Each probe also runs on a broken copy to show it can fail.
//
//   node packages/components/event-card/event-card.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';

const { server, browser, engine, check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/event-card/demo.html';
const IST = s => new Date(`${s}+05:30`);

// ── axe, errors and the plain page ──────────────────────────────────────
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await open(`${DEMO}?register=${register}&theme=dark`, { reduced: register === 'playful' });
  await settle(page);
  const v = await axe(page);
  check(`axe, dark, ${register} on its own${register === 'playful' ? ' with reduced motion' : ''}: 0 violations`, !v.length, v.join('; '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

// ── a page we can hold the clock on ────────────────────────────────────
const CARD = ({ id = 'a', start = '2026-10-04T11:00', end = '2026-10-04T13:00', extra = '', title = 'Handmade pasta' } = {}) => `
  <sg-event-card kind="workshop" start="${start}" ${end ? `end="${end}"` : ''} ${extra}>
    <article aria-labelledby="t-${id}">
      <p class="sg-event-kind">Workshop</p>
      <h3 id="t-${id}">${title}</h3>
      <p class="sg-event-when"><time datetime="${start}:00+05:30">written date</time></p>
      <p class="sg-event-where"><span class="sg-event-venue">A kitchen</span>, <span class="sg-event-area">Aldona</span> <a href="https://maps.example/k">Map</a></p>
      <footer class="sg-event-stub">
        <p class="sg-event-price"><span class="sg-event-amount">₹2,000</span> per person</p>
        <p class="sg-event-cta"><a class="book" href="https://wa.me/919800000000?text=Hello">Save my seat</a></p>
        <p data-when="sold-out" hidden><a class="alt" href="https://wa.me/919800000000?text=Next">Ask about the next date</a></p>
      </footer>
    </article>
  </sg-event-card>`;
const PAGE = (body, { register = 'warm', js = true } = {}) => `<!doctype html><html lang="en" data-register="${register}"><head><meta charset="utf-8"><title>t</title>
  <link rel="stylesheet" href="/packages/tokens/fonts.css"><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/event-card/event-card.css">
  </head><body><main>${body}</main>${js ? '<script type="module">import "/packages/components/event-card/event-card.js";</script>' : ''}</body></html>`;

let n = 0;
/** A page with the clock installed at `time` (a Date) before anything loads. */
async function clockPage(time, html, { width = 1280, reduced = false, errors = [] } = {}) {
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' }));
  const path = `/__check/clock-${++n}.html`;
  await ctx.route(`**${path}`, r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.install({ time });
  await page.goto(`${server.url}${path}`);
  await page.waitForSelector('sg-event-card[data-phase]');
  await page.waitForFunction(() => document.querySelector('sg-event-card').dataset.skin);
  return { ctx, page, errors };
}

/** What a reader gets from one card: its phase word, status text, whether the booking link can be used, seats. */
const read = page => page.evaluate(() => [...document.querySelectorAll('sg-event-card')].map(c => {
  const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const q = s => c.querySelector(s);
  return {
    phase: c.dataset.phase ?? null, status: q('.sg-event-status')?.textContent ?? '', statusShown: vis(q('.sg-event-status')),
    book: vis(q('a.book')), alt: vis(q('a.alt')), seats: vis(q('.sg-event-seats')) ? q('.sg-event-seats').textContent : '',
    when: q('.sg-event-when time')?.textContent ?? '', datetime: q('.sg-event-when time')?.getAttribute('datetime') ?? '',
  };
}));

// ── the clock: four states ─────────────────────────────────────────────
{
  const expect = [
    ['2026-10-02T10:00', { phase: 'upcoming', status: 'In 2 days', book: true }],
    ['2026-10-03T23:59:59', { phase: 'upcoming', status: 'Tomorrow', book: true }],
    ['2026-10-04T00:00:00', { phase: 'today', status: 'Today at 11 am', book: true }],
    ['2026-10-04T11:00:00', { phase: 'now', status: 'On now, until 1 pm', book: true }],
    ['2026-10-04T12:59:59', { phase: 'now', book: true }],
    ['2026-10-04T13:00:00', { phase: 'past', status: 'This one has happened. Booking is closed.', book: false }],
    ['2026-10-09T09:00', { phase: 'past', book: false }],
  ];
  const got = [];
  for (const [t, want] of expect) {
    const { ctx, page } = await clockPage(IST(t), PAGE(CARD()));
    const [c] = await read(page);
    const ok = Object.entries(want).every(([k, v]) => c[k] === v) && c.when === 'Sun 4 Oct, 11 am to 1 pm' && c.datetime === '2026-10-04T11:00:00+05:30';
    got.push(`${t.slice(5)} ${c.phase}${ok ? '' : ' WRONG ' + JSON.stringify(c)}`);
    check(`clock ${t}: ${want.phase}${want.status ? `, "${want.status}"` : ''}, booking link ${want.book ? 'shown' : 'gone'}`, ok, ok ? '' : JSON.stringify(c));
    await ctx.close();
  }
}
{
  // the venue's midnight, not UTC's: 19:00 UTC on the 3rd is 00:30 on the 4th in Goa
  const { ctx, page } = await clockPage(new Date('2026-10-03T19:00:00Z'), PAGE(CARD()));
  const [c] = await read(page);
  check('the clock is the venue\'s: 19:00 UTC on 3 Oct is already "today" for an event on 4 Oct in Goa', c.phase === 'today' && c.status === 'Today at 11 am', JSON.stringify(c));
  await ctx.close();
}
{
  // the card moves on by itself: start a second before 11:00 and let the clock run
  const { ctx, page } = await clockPage(IST('2026-10-04T10:59:59'), PAGE(CARD()));
  const before = (await read(page))[0].phase;
  const events = await page.evaluate(() => { window.__ev = []; document.querySelector('sg-event-card').addEventListener('sg-event-state', e => window.__ev.push(e.detail.phase)); });
  await page.clock.runFor(1500);
  const after = (await read(page))[0];
  check('the clock passing the start moves the card to "on now" by itself, and tells the page', before === 'today' && after.phase === 'now' && (await page.evaluate(() => window.__ev)).join() === 'now', `${before} -> ${after.phase}`);
  await page.clock.runFor(2 * 3600 * 1000);
  const over = (await read(page))[0];
  check('and at the end it is over, and the booking link has gone', over.phase === 'past' && !over.book, JSON.stringify(over));
  await ctx.close();
}
{
  // the timer is paused off screen and the card catches up when it is seen again
  const { ctx, page } = await clockPage(IST('2026-10-04T10:59:59'), PAGE(`<div style="height:3000px"></div>${CARD()}`));
  await page.waitForTimeout(100);
  await page.clock.runFor(3 * 3600 * 1000);
  const away = (await read(page))[0].phase;
  await page.evaluate(() => document.querySelector('sg-event-card').scrollIntoView());
  await page.waitForFunction(() => document.querySelector('sg-event-card').dataset.phase === 'past', null, { timeout: 3000 }).catch(() => {});
  const back = (await read(page))[0].phase;
  check('off screen the card keeps no timer; scrolled into view it catches up with the clock', away === 'today' && back === 'past', `${away} then ${back}`);
  await ctx.close();
}

// ── the control: the same probe on markup the element never touched ────
{
  const { ctx, page } = await openHtml('event-control', PAGE(CARD({ start: '2020-01-04T11:00', end: '2020-01-04T13:00' }), { js: false }));
  const [c] = await read(page);
  check('control: a long-finished event written as plain markup (no element) still shows its booking link and no phase, so the probes above can fail', c.book === true && c.phase === null && c.status === '', JSON.stringify(c));
  await ctx.close();
}

// ── seats: only when given ─────────────────────────────────────────────
{
  const cases = [
    ['no seats-left', '', { seats: '', soldOut: false, book: true }],
    ['seats-left=""', 'seats-left=""', { seats: '', soldOut: false, book: true }],
    ['seats-left="lots"', 'seats-left="lots"', { seats: '', soldOut: false, book: true }],
    ['seats-left="1"', 'seats-left="1"', { seats: '1 seat left', soldOut: false, book: true }],
    ['seats-left="4"', 'seats-left="4"', { seats: '4 seats left', soldOut: false, book: true }],
    ['seats-left="0"', 'seats-left="0"', { seats: 'Sold out', soldOut: true, book: false, alt: true }],
  ];
  for (const [name, attr, want] of cases) {
    const { ctx, page } = await clockPage(IST('2026-10-02T10:00'), PAGE(CARD({ extra: attr })));
    const [c] = await read(page);
    const sold = await page.evaluate(() => document.querySelector('sg-event-card').hasAttribute('data-sold-out'));
    const ok = c.seats === want.seats && sold === want.soldOut && c.book === want.book && (want.alt === undefined || c.alt === want.alt);
    check(`${name}: seats line "${want.seats || 'none'}"${want.soldOut ? ', sold out, booking replaced by the alternative' : ''}`, ok, JSON.stringify({ ...c, sold }));
    await ctx.close();
  }
  const { ctx, page } = await clockPage(IST('2026-10-09T10:00'), PAGE(CARD({ extra: 'seats-left="3"' })));
  const [c] = await read(page);
  check('a finished event shows no seats line, even if seats-left is set', c.seats === '' && c.phase === 'past', JSON.stringify(c));
  await ctx.close();
}

// ── the keyboard ───────────────────────────────────────────────────────
async function tabTo(page, sel, max = 12) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(s => document.activeElement?.matches(s), sel)) return i + 1;
  }
  return 0;
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await clockPage(IST('2026-10-02T10:00'), PAGE(CARD(), { register }));
  const presses = await tabTo(page, 'a.book');
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
  check(`${register}: Tab reaches "Save my seat" (${presses} presses) and it shows a focus ring`, presses > 0 && ring, `presses ${presses}, ring ${ring}`);
  await ctx.close();
}
{
  const { ctx, page } = await clockPage(IST('2026-10-09T10:00'), PAGE(CARD()));
  const presses = await tabTo(page, 'a.book', 6);
  check('a finished event: Tab never lands on a booking link', presses === 0);
  await ctx.close();
}
{
  const { ctx, page } = await clockPage(IST('2026-10-02T10:00'), PAGE(CARD({ extra: 'seats-left="0"' })));
  const presses = await tabTo(page, 'a.alt', 6);
  const book = await tabTo(page, 'a.book', 3);
  check('a sold-out event: Tab reaches the alternative link, not the booking one', presses > 0 && book === 0, `alt ${presses}, book ${book}`);
  await ctx.close();
}

// ── the playful tear ───────────────────────────────────────────────────
{
  const html = PAGE(CARD(), { register: 'playful' });
  const { ctx, page } = await clockPage(IST('2026-10-02T10:00'), html);
  const stub = () => page.evaluate(() => { const s = getComputedStyle(document.querySelector('.sg-event-stub')); return { t: s.transform, tear: document.querySelector('sg-event-card').dataset.tear }; });
  const rest = await stub();
  await page.hover('.sg-event-price');
  await settle(page);
  await page.waitForTimeout(80);
  const torn = await stub();
  const loops = await page.evaluate(() => document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations === Infinity).length);
  await page.mouse.move(2, 2);
  await settle(page);
  await page.waitForTimeout(80);
  const back = await stub();
  check('playful: at rest the stub is flat; on hover it lifts at the free corner and stays there; off the card it settles back', rest.t === 'none' && torn.t.startsWith('matrix(') && torn.t !== 'none' && back.t === 'none', `${rest.t} | ${torn.t} | ${back.t}`);
  check('playful: nothing loops (no infinite animation)', loops === 0, `${loops}`);
  await tabTo(page, 'a.book');
  await settle(page); await page.waitForTimeout(80);
  const focused = await stub();
  check('playful: keyboard focus on the card tears it as well as hover', focused.t.startsWith('matrix('), focused.t);
  await ctx.close();

  const r = await clockPage(IST('2026-10-02T10:00'), html, { reduced: true });
  await r.page.hover('.sg-event-price');
  await settle(r.page); await r.page.waitForTimeout(80);
  const still = await r.page.evaluate(() => getComputedStyle(document.querySelector('.sg-event-stub')).transform);
  check('playful with reduced motion: the stub stays flat on hover', still === 'none', still);
  await r.ctx.close();

  // the tear is a check that can fail: the same probe on the warm skin (which has no tear) must read flat
  const w = await clockPage(IST('2026-10-02T10:00'), PAGE(CARD(), { register: 'warm' }));
  await w.page.hover('.sg-event-price');
  await settle(w.page); await w.page.waitForTimeout(80);
  const warmHover = await w.page.evaluate(() => getComputedStyle(document.querySelector('.sg-event-stub')).transform);
  check('control: the warm ticket does not tear on hover, so the playful probe above can tell them apart', warmHover === 'none', warmHover);
  await w.ctx.close();
}

// ── the ticket: where the tear falls ───────────────────────────────────
{
  const wide = await clockPage(IST('2026-10-02T10:00'), PAGE(CARD({ title: 'Handmade pasta, from the dough up' })), { width: 1280 });
  const w = await wide.page.evaluate(() => { const c = document.querySelector('sg-event-card'), s = c.querySelector('.sg-event-stub'), a = c.querySelector('article'); return { tear: c.dataset.tear, holes: c.querySelectorAll('.sg-event-perf circle').length, stubRight: s.offsetLeft + s.offsetWidth - a.clientWidth, stubH: s.offsetHeight - a.clientHeight, tearAt: s.offsetLeft }; });
  check('warm at 1280: the stub is a column on the right, flush to the edge, with a perforated tear line', w.tear === 'x' && w.holes > 20 && Math.abs(w.stubRight) <= 1 && Math.abs(w.stubH) <= 1, JSON.stringify(w));
  await wide.ctx.close();
  const narrow = await clockPage(IST('2026-10-02T10:00'), PAGE(CARD()), { width: 390 });
  const p = await narrow.page.evaluate(() => { const c = document.querySelector('sg-event-card'), s = c.querySelector('.sg-event-stub'), a = c.querySelector('article'); return { tear: c.dataset.tear, holes: c.querySelectorAll('.sg-event-perf circle').length, stubBottom: s.offsetTop + s.offsetHeight - a.clientHeight, stubW: s.offsetWidth - a.clientWidth, scrollW: document.documentElement.scrollWidth }; });
  check('warm at 390: the stub is a strip along the foot with a horizontal tear line, and the page does not scroll sideways', p.tear === 'y' && p.holes > 10 && Math.abs(p.stubBottom) <= 1 && Math.abs(p.stubW) <= 1 && p.scrollW <= 390, JSON.stringify(p));
  await narrow.ctx.close();
}

// ── no JavaScript, and phone width on the demo ─────────────────────────
{
  const { ctx, page } = await open(`${DEMO}?register=quiet`, { js: false });
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-event-card')].map(c => {
    const vis = e => !!e && e.getClientRects().length > 0;
    return { kind: vis(c.querySelector('.sg-event-kind')), title: vis(c.querySelector('h3')), when: vis(c.querySelector('time')), where: vis(c.querySelector('.sg-event-venue')), price: vis(c.querySelector('.sg-event-price')), link: vis(c.querySelector('.sg-event-cta a')) };
  }));
  check('without JavaScript: kind, title, date, venue, price and booking link all show on every card', r.length === 6 && r.every(c => Object.values(c).every(Boolean)), JSON.stringify(r.find(c => !Object.values(c).every(Boolean)) ?? r[0]));
  await ctx.close();
}
{
  const { ctx, page } = await open(`${DEMO}?register=warm`, { width: 390 });
  await settle(page);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check('at 390 px the demo does not scroll sideways', w <= 390, `${w}`);
  await ctx.close();
}
{
  // the written date and the clock's date agree, so no one sees one thing without JavaScript and another with it
  const { ctx, page } = await open(`${DEMO}?register=quiet`);
  await settle(page);
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-event-card .sg-event-when time')].map(t => `${t.textContent}|${t.getAttribute('datetime')}`));
  const { ctx: c2, page: p2 } = await open(`${DEMO}?register=quiet`, { js: false });
  const plain = await p2.evaluate(() => [...document.querySelectorAll('sg-event-card .sg-event-when time')].map(t => `${t.textContent}|${t.getAttribute('datetime')}`));
  check('the date the element writes is the date the plain markup already says', r.length === 6 && JSON.stringify(r) === JSON.stringify(plain), `${r[0]} vs ${plain[0]}`);
  await ctx.close(); await c2.close();
}

await done();
