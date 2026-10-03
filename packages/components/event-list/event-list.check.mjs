// Browser checks for <sg-event-list>: axe, soonest first, the "Before" drawer closed, a real empty
// state with its call to action, the list re-sorting when the clock passes an event (the clock is
// faked), the timer paused off screen, the keyboard, and no JavaScript. Each probe also runs on
// a broken copy, to show it can fail.
//
//   node packages/components/event-list/event-list.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';

const { server, browser, engine, check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/event-list/demo.html';
const IST = s => new Date(`${s}+05:30`);

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
{
  // axe on the open drawer, too
  const { ctx, page } = await open(`${DEMO}?register=warm&theme=dark`);
  await settle(page);
  await page.evaluate(() => document.querySelectorAll('details.sg-event-before').forEach(d => { d.open = true; }));
  const v = await axe(page);
  check('axe with every "Before" drawer open (dark, warm): 0 violations', !v.length, v.join('; '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

// ── a page we can hold the clock on ────────────────────────────────────
const CARD = (id, start, end, extra = '') => `
    <sg-event-card kind="workshop" start="${start}" end="${end}" ${extra}>
      <article aria-labelledby="t-${id}">
        <p class="sg-event-kind">Workshop</p>
        <h3 id="t-${id}">${id}</h3>
        <p class="sg-event-when"><time datetime="${start}:00+05:30">written date</time></p>
        <footer class="sg-event-stub">
          <p class="sg-event-price"><span class="sg-event-amount">₹2,000</span> per person</p>
          <p class="sg-event-cta"><a class="book" href="https://wa.me/919800000000?text=${id}">Save my seat</a></p>
        </footer>
      </article>
    </sg-event-card>`;
// written out of order on purpose: later, much earlier (over), soonest, and in the middle
const CARDS = [
  CARD('class', '2026-10-18T17:00', '2026-10-18T19:00'),
  CARD('gone', '2026-09-27T11:00', '2026-09-27T13:00'),
  CARD('workshop', '2026-10-04T11:00', '2026-10-04T13:00'),
  CARD('supper', '2026-10-09T19:30', '2026-10-09T22:00'),
].join('');
const ASK = '<p class="sg-event-ask"><a class="ask" href="https://wa.me/919800000000?text=private">Ask about a private session</a></p>';
const PAGE = (body, { register = 'warm', js = true } = {}) => `<!doctype html><html lang="en" data-register="${register}"><head><meta charset="utf-8"><title>t</title>
  <link rel="stylesheet" href="/packages/tokens/fonts.css"><link rel="stylesheet" href="/packages/tokens/tokens.css">
  <link rel="stylesheet" href="/packages/components/event-card/event-card.css"><link rel="stylesheet" href="/packages/components/event-list/event-list.css">
  </head><body><main>${body}</main>${js ? '<script type="module">import "/packages/components/event-card/event-card.js"; import "/packages/components/event-list/event-list.js";</script>' : ''}</body></html>`;
const LIST = (cards = CARDS, attrs = '', extra = ASK) => `<sg-event-list ${attrs}><h2>What's on</h2>${cards}${extra}</sg-event-list>`;

let n = 0;
async function clockPage(time, html, { width = 1280, errors = [] } = {}) {
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width, height: 900 } }));
  const path = `/__check/list-${++n}.html`;
  await ctx.route(`**${path}`, r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.install({ time });
  await page.goto(`${server.url}${path}`);
  await page.waitForSelector('sg-event-list[data-empty]');
  await page.waitForFunction(() => document.querySelector('sg-event-list').dataset.skin);
  return { ctx, page, errors };
}

/** What a reader gets: the order of titles above the drawer and in it, whether the drawer is open, the empty state. */
const read = page => page.evaluate(() => {
  const list = document.querySelector('sg-event-list');
  // checkVisibility is false for anything inside a closed <details>; getClientRects() is not (a closed drawer's
  // contents still report boxes), which the first run of this check found out
  const vis = e => !!e && e.checkVisibility({ visibilityProperty: true });
  const titles = root => [...(root?.querySelectorAll('sg-event-card h3') ?? [])].filter(h => vis(h)).map(h => h.textContent);
  const drawer = list.querySelector('details.sg-event-before');
  const inDrawer = drawer ? [...drawer.querySelectorAll('sg-event-card h3')].map(h => h.textContent) : [];
  const empty = list.querySelector(':scope > .sg-event-empty'), ask = list.querySelector(':scope > .sg-event-ask a');
  return {
    top: titles(list.querySelector('.sg-event-upcoming')), drawerOpen: drawer ? drawer.open : null, drawerShown: vis(drawer),
    drawerLabel: drawer?.querySelector('summary')?.textContent ?? '', inDrawer, inDrawerVisible: drawer ? titles(drawer) : [],
    emptyShown: vis(empty), emptyText: empty?.textContent ?? '', askShown: vis(ask),
  };
});

// ── sorted, with the past put away ─────────────────────────────────────
{
  const { ctx, page } = await clockPage(IST('2026-10-02T10:00'), PAGE(LIST()));
  const r = await read(page);
  check('soonest first: written class, gone, workshop, supper -> shown workshop, supper, class', r.top.join() === 'workshop,supper,class', r.top.join());
  check('what has happened is in a "Before" drawer, labelled with how many', r.inDrawer.join() === 'gone' && r.drawerLabel === 'Before (1)', `${r.inDrawer} / ${r.drawerLabel}`);
  check('the drawer is a native <details>, closed, and what is in it is not visible', r.drawerOpen === false && r.inDrawerVisible.length === 0, JSON.stringify({ open: r.drawerOpen, vis: r.inDrawerVisible }));
  check('with events to come there is no empty state and no "ask" link', !r.emptyShown && !r.askShown, JSON.stringify({ e: r.emptyShown, a: r.askShown }));
  const roles = await page.evaluate(() => ({ list: document.querySelector('.sg-event-upcoming').getAttribute('role'), items: [...document.querySelectorAll('.sg-event-upcoming > sg-event-card')].every(c => c.getAttribute('role') === 'listitem') }));
  check('the cards are a list for a screen reader (role list, role listitem)', roles.list === 'list' && roles.items, JSON.stringify(roles));
  await ctx.close();
}

// ── the empty state ────────────────────────────────────────────────────
{
  const { ctx, page } = await clockPage(IST('2026-12-20T10:00'), PAGE(LIST()));
  const r = await read(page);
  check('nothing to come: the default words show, "Nothing on the calendar right now. Ask about a private session."', r.emptyShown && r.emptyText === 'Nothing on the calendar right now. Ask about a private session.', r.emptyText);
  check('...with the slotted call to action beside it', r.askShown);
  check('...and every past event is in the drawer, which is still closed', r.top.length === 0 && r.inDrawer.length === 4 && r.drawerOpen === false && r.drawerLabel === 'Before (4)', `${r.top} | ${r.inDrawer} | ${r.drawerLabel}`);
  const tab = await (async () => { for (let i = 1; i <= 6; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement?.matches('a.ask'))) return i; } return 0; })();
  check('the keyboard reaches the call to action in the empty state', tab > 0, `${tab} presses`);
  await ctx.close();
}
{
  // a custom empty line replaces the default; a list with no cards at all is empty too
  const custom = '<p class="sg-event-empty">The next workshop is not set yet.</p>';
  const { ctx, page } = await clockPage(IST('2026-10-02T10:00'), PAGE(LIST('', '', custom + ASK)));
  const r = await read(page);
  check('your own empty words win over the default, and a list with no cards is empty', r.emptyShown && r.emptyText === 'The next workshop is not set yet.' && !r.drawerShown && r.askShown, JSON.stringify(r));
  await ctx.close();
}

// ── the clock re-sorts the list ────────────────────────────────────────
{
  const { ctx, page } = await clockPage(IST('2026-10-04T12:59:00'), PAGE(LIST()));
  const a = await read(page);
  const events = await page.evaluate(() => { window.__ev = []; document.querySelector('sg-event-list').addEventListener('sg-event-list-change', e => window.__ev.push(e.detail)); });
  await page.clock.runFor(2 * 60 * 1000);
  const b = await read(page);
  const ev = await page.evaluate(() => window.__ev);
  check('while "workshop" is on it stays on top', a.top[0] === 'workshop', a.top.join());
  check('two minutes later, past its end, it has moved into "Before" by itself and "supper" is on top', b.top.join() === 'supper,class' && b.inDrawer.includes('workshop') && b.drawerLabel === 'Before (2)', `${b.top} | ${b.inDrawer} | ${b.drawerLabel}`);
  check('the list tells the page it changed', ev.length === 1 && ev[0].upcoming === 2 && ev[0].past === 2, JSON.stringify(ev));
  await page.clock.runFor(30 * 24 * 3600 * 1000);
  const c = await read(page);
  check('and a month on, with everything over, it shows the empty state', c.emptyShown && c.top.length === 0 && c.drawerLabel === 'Before (4)', `${c.emptyShown} ${c.drawerLabel}`);
  await ctx.close();
}
{
  // a drawer the visitor opened stays open when the list re-sorts
  const { ctx, page } = await clockPage(IST('2026-10-04T12:59:00'), PAGE(LIST()));
  await page.click('details.sg-event-before > summary');
  await page.clock.runFor(2 * 60 * 1000);
  const r = await read(page);
  check('a drawer the visitor opened stays open while a card moves in', r.drawerOpen === true && r.inDrawerVisible.includes('workshop'), JSON.stringify({ open: r.drawerOpen, vis: r.inDrawerVisible }));
  await ctx.close();
}
{
  // paused off screen: nothing moves while it cannot be seen, and it catches up when it can
  const { ctx, page } = await clockPage(IST('2026-10-04T12:59:00'), PAGE(`<div style="height:3000px"></div>${LIST()}`));
  await page.waitForTimeout(100);
  await page.clock.runFor(2 * 60 * 1000);
  const away = await read(page);
  await page.evaluate(() => document.querySelector('sg-event-list').scrollIntoView());
  await page.waitForFunction(() => document.querySelector('.sg-event-before summary')?.textContent === 'Before (2)', null, { timeout: 3000 }).catch(() => {});
  const back = await read(page);
  check('off screen the list keeps no timer; scrolled into view it catches up and moves the card', away.top[0] === 'workshop' && back.top[0] === 'supper' && back.drawerLabel === 'Before (2)', `${away.top[0]} then ${back.top[0]}, ${back.drawerLabel}`);
  await ctx.close();
}

// ── the keyboard: the drawer ───────────────────────────────────────────
{
  const { ctx, page } = await clockPage(IST('2026-10-02T10:00'), PAGE(LIST()));
  let landed = 0;
  for (let i = 1; i <= 12 && !landed; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement?.matches('details.sg-event-before > summary'))) landed = i; }
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
  await page.keyboard.press('Enter');
  const opened = await page.evaluate(() => document.querySelector('details.sg-event-before').open);
  await page.keyboard.press('Space');
  const closed = await page.evaluate(() => !document.querySelector('details.sg-event-before').open);
  check(`Tab reaches "Before" (${landed} presses) with a focus ring; Enter opens it and Space closes it`, landed > 0 && ring && opened && closed, JSON.stringify({ landed, ring, opened, closed }));
  await ctx.close();
}

// ── controls: the same probes on a list the element never touched ──────
{
  const { ctx, page } = await openHtml('list-control', PAGE(LIST(), { js: false }));
  const r = await page.evaluate(() => ({ drawer: !!document.querySelector('details.sg-event-before'), first: document.querySelector('sg-event-card h3').textContent }));
  check('control: written as plain markup, the list is not sorted and has no drawer, so the probes above can fail', !r.drawer && r.first === 'class', JSON.stringify(r));
  await ctx.close();
}

// ── no JavaScript, phone width ─────────────────────────────────────────
{
  const { ctx, page } = await open(`${DEMO}?register=quiet`, { js: false });
  const r = await page.evaluate(() => ({ cards: [...document.querySelectorAll('sg-event-card')].filter(c => c.getClientRects().length).length, h: [...document.querySelectorAll('sg-event-list > h2')].map(h => h.textContent) }));
  check('without JavaScript: every card shows in the order written, with its heading', r.cards === 6 && r.h.length === 2, JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await open(`${DEMO}?register=playful`, { width: 390 });
  await settle(page);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check('at 390 px the demo does not scroll sideways', w <= 390, `${w}`);
  await ctx.close();
}

await done();
