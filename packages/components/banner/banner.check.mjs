// Browser checks for <sg-banner>. Not a unit test (npm test runs the pure core); run it by hand:
//
//   node packages/components/banner/banner.check.mjs        (SG_ENGINE=webkit | firefox for the others)
//
// Checks: the markup a screen reader needs (a named region, a named cross); a dismissal is remembered and
// survives a reload; with storage blocked the banner still renders, dismisses for the page and returns on
// the next visit, with no errors; the announcement is said once and never for a banner that arrives
// dismissed or out of date; `until` is read in IST (a visitor in New York and one in Auckland see the
// same banner go); an empty <time> is written in words, in the page's language; Konkani follows the
// page's lang; focus lands somewhere real when the banner it was in goes; each register draws its own
// decoration and keeps it out of the words; the cross is a thumb's size; no sideways scroll at 390 px;
// axe on the demo, on an open state and with no JavaScript, in both themes; reduced motion draws no
// animation. The press, focus and reduced-motion contract is tools/touch.check.mjs.

import { contextOptions } from '../../../tools/lib/engine.mjs';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';
import { harness, settle } from '../../../tools/lib/component-check.mjs';

const { server, browser, engine, check, open, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/banner/demo.html';
const PAGE = (body, head = '') => `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/banner/banner.css">${head}</head>
<body style="margin:0;background:var(--sg-surface)">${body}<p><a id="after" href="#after">after</a></p>
<script type="module">import '/packages/components/banner/banner.js'; await customElements.whenDefined('sg-banner'); window.__ready = true;</script></body></html>`;

let n = 0;
/** A page built from a string, in a context of our own (a zone, a blocked store, a fake clock). */
async function own(html, { width = 1000, height = 700, init = '', reduced = false, timezoneId } = {}) {
  const errors = [], path = `/__check/banner-${++n}.html`;
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', timezoneId, ...(width < 500 ? { hasTouch: true, isMobile: true } : {}) }));
  if (init) await ctx.addInitScript(init);
  await ctx.route(`**${path}`, r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, errors, goto: () => page.goto(`${server.url}${path}`).then(() => page.waitForFunction(() => window.__ready === true)) };
}
const BANNER = '<sg-banner id="monsoon">Closed for the monsoon, back <time datetime="2027-10-01"></time>.</sg-banner>';
const read = page => page.evaluate(() => [...document.querySelectorAll('sg-banner')].map(b => ({
  id: b.id, hidden: b.hidden, phase: b.dataset.phase, role: b.getAttribute('role'), label: b.getAttribute('aria-label'),
  button: b.querySelector('.sg-banner-dismiss')?.getAttribute('aria-label') ?? null, text: b.text, display: getComputedStyle(b).display, skin: b.dataset.skin ?? '',
})));

// ── the markup ──
{
  const { ctx, page, errors } = await open(DEMO);
  await settle(page);
  const all = await read(page);
  const shop = all.find(b => b.id === 'shop'), latn = all.find(b => b.id === 'shop-latn'), deva = all.find(b => b.id === 'event-deva'), quiet = all.find(b => b.id === 'demo-quiet');
  check('every banner is a named region with a named cross', all.length === 9 && all.every(b => b.role === 'region' && b.label && b.button && !b.hidden), JSON.stringify(all.map(b => [b.id, b.role, b.label, b.button])));
  check('English: "Announcement" and "Dismiss this announcement"', quiet.label === 'Announcement' && quiet.button === 'Dismiss this announcement', `${quiet.label} | ${quiet.button}`);
  check('Konkani follows the page’s lang, in either script', deva.label === 'सूचना' && deva.button === 'ही सूचना बंद करचीं' && latn.label === 'Suchona' && latn.button === 'Hi suchona bond korchi', `${deva.label} ${deva.button} | ${latn.label} ${latn.button}`);
  check('an empty <time> is written in words (IST, no weekday)', quiet.text === 'Doors open at 9:30 am on 21 November. Please bring your ticket, on your phone or on paper.', quiet.text);
  check('back="" adds the line in the page’s order: English', shop.text === 'Closed for the monsoon. Back 1 October', shop.text);
  check('back="" adds the line in the page’s order: Romi puts the date first', latn.text === 'Pausallea khatir bond. 1 Otubr porot', latn.text);
  const decoHidden = await page.evaluate(() => [...document.querySelectorAll('sg-banner')].every(b => b.querySelector('.sg-banner-deco')?.getAttribute('aria-hidden') === 'true'));
  check('the decoration is hidden from assistive technology', decoHidden);
  const dates = await page.evaluate(() => [...document.querySelectorAll('sg-banner time')].map(t => `${t.getAttribute('datetime')}=${t.textContent}`));
  check('each <time> keeps its datetime beside its words', dates.includes('2026-11-21=21 November') && dates.includes('2027-10-01=1 October'), dates.join(' '));
  check('no console or page errors on the demo', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── a dismissal is remembered, and survives a reload ──
{
  const { ctx, page, errors } = await open(DEMO);
  const key = await page.evaluate(() => 'sg-banner:feast');
  await page.click('#g-feast .sg-banner-dismiss');
  await page.waitForFunction(() => document.getElementById('feast').hidden);
  const stored = await page.evaluate(k => localStorage.getItem(k), key);
  check('dismissing hides the banner and writes the key', stored !== null, `stored ${stored}`);
  const others = await page.evaluate(() => [...document.querySelectorAll('sg-banner')].filter(b => b.id !== 'feast').every(b => !b.hidden));
  check('the others stay', others);
  check('a banner that is hidden takes no room', await page.evaluate(() => getComputedStyle(document.getElementById('feast')).display === 'none'));
  const said = await page.evaluate(() => new Promise(r => { addEventListener('sg-banner-dismiss', e => r(e.detail), { once: true }); document.getElementById('tiatr').dismiss('api'); }));
  check('dismiss() from script says whether the browser kept it', said.remembered === true && said.id === 'tiatr', JSON.stringify(said));
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  const after = await read(page);
  check('after a reload the dismissed banners stay away and the rest return', after.find(b => b.id === 'feast').hidden && after.find(b => b.id === 'tiatr').hidden && !after.find(b => b.id === 'event').hidden, JSON.stringify(after.map(b => [b.id, b.hidden])));
  await page.click('#again');
  const back = await read(page);
  check('"show them all again" brings them back', back.every(b => !b.hidden) && (await page.evaluate(() => localStorage.length)) === 0);
  check('no console or page errors', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── with no storage at all ──
{
  const blocked = `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); }, configurable: true });`;
  const { ctx, page, errors, goto } = await own(PAGE(BANNER), { init: blocked });
  await goto();
  const r = await read(page);
  check('storage blocked: it renders, named, with its cross', r.length === 1 && !r[0].hidden && r[0].button && r[0].text === 'Closed for the monsoon, back 1 October.', JSON.stringify(r));
  await page.click('.sg-banner-dismiss');
  await page.waitForFunction(() => document.getElementById('monsoon').hidden);
  const ev = await page.evaluate(() => document.getElementById('monsoon').phase);
  check('storage blocked: it still dismisses for the life of the page', ev === 'dismissed');
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  check('storage blocked: it is back on the next visit (nothing was kept)', (await read(page))[0].hidden === false);
  check('storage blocked: no errors', !errors.length, errors.join(' | '));
  await ctx.close();
}
{
  const full = `Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };`;
  const { ctx, page, errors, goto } = await own(PAGE(BANNER), { init: full });
  await goto();
  const kept = await page.evaluate(() => document.getElementById('monsoon').dismiss('api'));
  check('storage full: it dismisses and says it was not kept, with no errors', kept === false && errors.length === 0, `${kept} ${errors.join(' | ')}`);
  await ctx.close();
}

// ── said once ──
{
  const stub = `window.__said = []; Document.prototype.ariaNotify = Element.prototype.ariaNotify = function (t) { window.__said.push(t); };`;
  const { ctx, page, goto } = await own(PAGE(BANNER), { init: stub });
  await goto();
  await page.waitForTimeout(500);
  const said = await page.evaluate(() => window.__said);
  check('ariaNotify: said once, with the label and the words', said.length === 1 && said[0] === 'Announcement: Closed for the monsoon, back 1 October.', JSON.stringify(said));
  await page.evaluate(() => document.getElementById('monsoon').dismiss('api'));
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  await page.waitForTimeout(500);
  const again = await page.evaluate(() => window.__said);
  check('a banner that arrives already dismissed says nothing', again.length === 0, JSON.stringify(again));
  await ctx.close();
}
{
  const region = `delete Document.prototype.ariaNotify; delete Element.prototype.ariaNotify;`;
  const { ctx, page, goto } = await own(PAGE(BANNER), { init: region });
  await goto();
  await page.waitForFunction(() => document.querySelector('[data-sg-announcer] ')?.textContent);
  const live = await page.evaluate(() => [...document.querySelectorAll('[data-sg-announcer]')].map(e => `${e.getAttribute('role')}:${e.textContent}`));
  check('no ariaNotify: one polite live region says it once', live.length === 1 && live[0] === 'status:Announcement: Closed for the monsoon, back 1 October.', JSON.stringify(live));
  await ctx.close();
}

// ── until is read in IST, whatever zone the visitor is in ──
for (const [tz, label] of [['America/New_York', 'New York'], ['Pacific/Auckland', 'Auckland'], ['Asia/Kolkata', 'Panjim']]) {
  const stub = `window.__said = []; Document.prototype.ariaNotify = Element.prototype.ariaNotify = function (t) { window.__said.push(t); };`;
  const { ctx, page, goto } = await own(PAGE(''), { timezoneId: tz, init: stub });
  await goto();
  const make = (iso, until, name) => page.evaluate(async ([iso, until, name]) => {
    // the clock is the page's own Date.now, faked to the instant asked for
    const real = Date.now; Date.now = () => Date.parse(iso);
    const b = document.createElement('sg-banner');
    b.setAttribute('until', until); b.textContent = name;
    document.body.append(b);
    await new Promise(r => setTimeout(r, 100));
    Date.now = real;
    return { hidden: b.hidden, phase: b.phase };
  }, [iso, until, name]);
  // announcements come out after a short quiet spell, and a burst is read once, so wait out each one
  const said = async () => { await page.waitForTimeout(500); return page.evaluate(() => window.__said.slice()); };
  // 2026-10-01 is the last day: 11:59 pm in Panjim is 18:29 UTC; midnight is 18:30 UTC
  const on = await make('2026-10-01T18:29:00Z', '2026-10-01', 'On the last day');
  const s1 = await said();
  const off = await make('2026-10-01T18:30:00Z', '2026-10-01', 'Past the last day');
  const s2 = await said();
  check(`${label}: still showing at 11:59 pm in Panjim on the last day, and said`, on.hidden === false && on.phase === 'shown' && s1.join() === 'Announcement: On the last day', JSON.stringify([on, s1]));
  check(`${label}: gone at midnight in Panjim, and silent`, off.hidden === true && off.phase === 'expired' && s2.length === 1, JSON.stringify([off, s2]));
  const timed = await make('2026-10-01T12:29:00Z', '2026-10-01T18:00', 'Before six');
  const timedOff = await make('2026-10-01T12:30:00Z', '2026-10-01T18:00', 'At six');
  check(`${label}: a time in until is that moment in IST (6 pm is 12:30 UTC)`, timed.hidden === false && timedOff.hidden === true, JSON.stringify([timed, timedOff]));
  await ctx.close();
}

// ── focus lands somewhere real when the banner it is in goes ──
{
  const { ctx, page, goto } = await own(PAGE(BANNER));
  await goto();
  await page.keyboard.press('Tab');
  const onCross = await page.evaluate(() => document.activeElement.className);
  check('Tab reaches the cross first', onCross === 'sg-banner-dismiss', onCross);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('monsoon').hidden);
  const at = await page.evaluate(() => document.activeElement.id);
  check('Enter on the cross dismisses it and focus moves on to the next thing on the page', at === 'after', at);
  await ctx.close();
}
{
  const { ctx, page, goto } = await own(PAGE(BANNER));
  await goto();
  await page.focus('.sg-banner-dismiss');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('monsoon').hidden);
  check('Space works too', await page.evaluate(() => document.activeElement.id) === 'after');
  await ctx.close();
}

// ── said once per visit: a second page of the same visit stays quiet; a new tab starts a new visit ──
{
  const stub = `window.__said = []; Document.prototype.ariaNotify = Element.prototype.ariaNotify = function (t) { window.__said.push(t); };`;
  const { ctx, page, goto } = await own(PAGE(BANNER), { init: stub });
  await goto();
  await page.waitForTimeout(500);
  const first = await page.evaluate(() => window.__said.length);
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  await page.waitForTimeout(500);
  const second = await page.evaluate(() => ({ said: window.__said.length, shown: !document.getElementById('monsoon').hidden }));
  check('a second page of the same visit does not say it again, though the banner still shows', first === 1 && second.said === 0 && second.shown, JSON.stringify([first, second]));
  const tab = await ctx.newPage();
  await tab.goto(page.url());
  await tab.waitForFunction(() => window.__ready);
  await tab.waitForTimeout(500);
  check('a new tab is a new visit: it says it once', await tab.evaluate(() => window.__said.length) === 1);
  await tab.waitForTimeout(2300); // announce() does not repeat the same sentence within two seconds
  await tab.evaluate(() => document.getElementById('monsoon').reset());
  await tab.waitForTimeout(600);
  check('reset() starts the announcement afresh', await tab.evaluate(() => window.__said.length) === 2);
  await ctx.close();
}
{
  // with session storage blocked there is no memory: it is said on every page load, and nothing breaks
  const stub = `window.__said = []; Document.prototype.ariaNotify = Element.prototype.ariaNotify = function (t) { window.__said.push(t); };Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('blocked', 'SecurityError'); }, configurable: true });`;
  const { ctx, page, errors, goto } = await own(PAGE(BANNER), { init: stub });
  await goto();
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  await page.waitForTimeout(500);
  check('session storage blocked: said on each load, and no errors', (await page.evaluate(() => window.__said.length)) === 1 && !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── focus has somewhere to land when nothing follows the banner: the main content ──
{
  const html = PAGE(BANNER).replace('<p><a id="after" href="#after">after</a></p>', '<main id="m"><h1>Page</h1><p>Words, and nothing to focus.</p></main>');
  const { ctx, page, goto } = await own(html);
  await goto();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('monsoon').hidden);
  const at = await page.evaluate(() => ({ tag: document.activeElement.localName, id: document.activeElement.id, tabindex: document.activeElement.getAttribute('tabindex') }));
  check('with nothing to focus after it, a dismissal by keyboard lands focus on <main> (tabindex -1), not on nothing', at.tag === 'main' && at.tabindex === '-1', JSON.stringify(at));
  // and the probe can fail: with no <main> either, focus is honestly nowhere (the body), and the check says so
  const bare = PAGE(BANNER).replace('<p><a id="after" href="#after">after</a></p>', '<p>Words.</p>');
  const q = await own(bare);
  await q.goto();
  await q.page.keyboard.press('Tab');
  await q.page.keyboard.press('Enter');
  await q.page.waitForFunction(() => document.getElementById('monsoon').hidden);
  check('with no <main> either, focus is on the body (nowhere), which is what the probe above would catch', await q.page.evaluate(() => document.activeElement === document.body));
  await q.ctx.close();
  await ctx.close();
}

// ── forced colours: the drawing is gone, and so is the room that was kept for it ──
for (const register of ['warm', 'playful']) {
  const { ctx, page } = await open(`${DEMO}?register=${register}`);
  const normal = await page.evaluate(id => { const cs = getComputedStyle(document.getElementById(id)); return [cs.paddingTop, cs.paddingBottom]; }, `demo-${register}`);
  let forced = null;
  try {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.waitForTimeout(100);
    forced = await page.evaluate(id => { const el = document.getElementById(id), cs = getComputedStyle(el); return { pad: [cs.paddingTop, cs.paddingBottom], deco: getComputedStyle(el.querySelector('.sg-banner-deco')).display }; }, `demo-${register}`);
  } catch { /* this engine cannot emulate forced colours */ }
  if (forced) check(`${register}, forced colours: the drawing is dropped and the strip keeps no room for it (bottom padding ${forced.pad[1]}, top ${forced.pad[0]}; it was ${normal[1]})`, forced.deco === 'none' && forced.pad[0] === forced.pad[1] && normal[1] !== normal[0], JSON.stringify([normal, forced]));
  else console.log(`skip  ${register}, forced colours: this engine does not emulate them`);
  await ctx.close();
}

// ── the three registers: what is drawn, and that it stays out of the words ──
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await open(`${DEMO}?register=${register}`, { width: 390, height: 800, touch: true });
  await settle(page);
  const id = `demo-${register}`;
  const m = await page.evaluate(id => {
    const b = document.getElementById(id), body = b.querySelector('.sg-banner-body'), btn = b.querySelector('.sg-banner-dismiss'), deco = b.querySelector('.sg-banner-deco');
    const r = e => { const x = e.getBoundingClientRect(); return { top: +x.top.toFixed(1), bottom: +x.bottom.toFixed(1), left: +x.left.toFixed(1), right: +x.right.toFixed(1), w: +x.width.toFixed(1), h: +x.height.toFixed(1) }; };
    const art = deco.querySelector('svg');
    const flags = deco.querySelectorAll('.flag').length;
    const paths = deco.querySelectorAll('path').length;
    const cs = getComputedStyle(b);
    return { skin: b.dataset.skin, host: r(b), body: r(body), btn: r(btn), art: art ? r(art) : null, flags, paths, bg: cs.backgroundColor, font: getComputedStyle(body).fontFamily.split(',')[0] };
  }, id);
  check(`${register}: its skin is mounted`, m.skin === register, m.skin);
  const follows = await page.evaluate(() => document.getElementById('shop').dataset.skin);
  check(`${register}: the sample banners follow the page’s register (the touch probe presses the first one)`, follows === register, follows);
  check(`${register}: the cross is a thumb’s size (${m.btn.w} by ${m.btn.h} px)`, m.btn.w >= 44 && m.btn.h >= 44);
  check(`${register}: the cross is inside the banner, at its right edge (${m.btn.right} of ${m.host.right})`, m.btn.right <= m.host.right && m.host.right - m.btn.right <= 16);
  check(`${register}: the words end before the cross begins (${m.body.right} < ${m.btn.left})`, m.body.right <= m.btn.left);
  if (register === 'quiet') check('quiet: no drawing, only a hairline', m.art === null);
  if (register === 'warm') check(`warm: a pencil rule is drawn below the words (words end ${m.body.bottom}, rule starts ${m.art?.top})`, m.paths === 2 && m.art && m.art.top >= m.body.bottom - 1 && m.art.bottom <= m.host.bottom + 1);
  if (register === 'playful') check(`playful: bunting hangs below the words, inside the strip (words end ${m.body.bottom}, flags start ${m.art?.top}, strip ends ${m.host.bottom})`, m.flags >= 8 && m.art && m.art.top >= m.body.bottom - 1 && m.art.bottom <= m.host.bottom + 1, `${m.flags} flags`);
  const over = await sidewaysScroll(page, 390);
  check(`${register}: no sideways scroll at 390 px (${over.overflow} px)`, over.overflow === 0);
  await ctx.close();
}

// ── reduced motion: nothing is animating ──
{
  const { ctx, page } = await open(`${DEMO}?register=playful`, { reduced: true });
  const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
  check('reduced motion: no animation runs on arrival (the bunting is simply hung)', running === 0, `${running} running`);
  await page.click('#g-tiatr .sg-banner-dismiss');
  const t0 = Date.now();
  await page.waitForFunction(() => document.getElementById('tiatr').hidden, null, { timeout: 2000 });
  check('reduced motion: dismissal does not wait for an exit', Date.now() - t0 < 400, `${Date.now() - t0} ms`);
  await ctx.close();
}

// ── the bunting arrives with motion, and leaves with a fold (a settled frame, not the moment) ──
{
  const { ctx, page } = await open(`${DEMO}?register=playful`);
  // a banner made now: count what its skin starts the moment it is mounted (sg-skin is sent just after the first update)
  const during = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.dataset.register = 'playful';
    host.innerHTML = '<sg-banner id="fresh">A banner made now.</sg-banner>';
    document.body.append(host);
    const b = host.firstElementChild;
    await new Promise(r => b.addEventListener('sg-skin', r, { once: true }));
    const n = b.getAnimations({ subtree: true }).length;
    host.remove();
    return n;
  });
  check('playful: arriving flags are animating (the swing)', during >= 8, `${during} animations`);
  await settle(page);
  const before = await page.evaluate(() => document.getElementById('demo-playful').getBoundingClientRect().height);
  await page.evaluate(() => { window.__h = []; const b = document.getElementById('demo-playful'); const tick = () => { window.__h.push(b.getBoundingClientRect().height); if (!b.hidden) requestAnimationFrame(tick); }; b.dismiss('api'); tick(); });
  await page.waitForFunction(() => document.getElementById('demo-playful').hidden);
  const hs = await page.evaluate(() => window.__h);
  check(`playful: the strip folds away over several frames (${before.toFixed(0)} px down to ${Math.min(...hs).toFixed(0)} px in ${hs.length} frames)`, hs.length >= 3 && Math.min(...hs) < before * 0.5);
  await ctx.close();
}

// ── axe: the demo in both themes, with a cross focused, and with no JavaScript ──
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  for (const register of ['quiet', 'warm', 'playful']) {
    await page.evaluate(r => document.documentElement.setAttribute('data-register', r), register);
    await page.waitForTimeout(150);
    await settle(page);
    const v = await axe(page);
    check(`axe, ${theme}, ${register}: 0 violations`, !v.length, v.join('; '));
  }
  await page.focus('#g-shop .sg-banner-dismiss');
  const f = await axe(page);
  check(`axe, ${theme}, with a cross focused: 0 violations`, !f.length, f.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
check('axe without JavaScript, 390 px: 0 violations', !(await axeNoJs(DEMO, { width: 390 })).length);

await done();
