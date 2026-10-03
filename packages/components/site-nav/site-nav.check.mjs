// Browser checks for <sg-site-nav>: axe, every link reachable with no
// JavaScript at desktop and phone widths (the probe also runs on a nav whose
// links are hidden for good, to show it can fail), one aria-current per nav,
// Escape on the narrow menu, and target sizes.
//
//   node packages/components/site-nav/site-nav.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';

const { check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/site-nav/demo.html';

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
for (const phone of [false, true]) check(`axe without JavaScript${phone ? ' at 390 px' : ''}: 0 violations`, !(await axeNoJs(DEMO, phone ? { width: 390 } : {})).length);

// Every link is on screen, or one press of its nav's summary away.
async function reachable(page) {
  const navs = await page.locator('sg-site-nav').count();
  const out = [];
  for (let i = 0; i < navs; i++) {
    const nav = page.locator('sg-site-nav').nth(i);
    // checkVisibility, not the box: inside a closed <details> a link still has a box (content-visibility
    // skips its painting, not its layout), so a bounding-rect probe calls every hidden link visible.
    const seen = () => nav.evaluate(n => [...n.querySelectorAll('ul a')].map(a => a.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && a.getBoundingClientRect().width > 0));
    let s = await seen(), pressed = false;
    if (!s.every(Boolean)) {
      const summary = nav.locator('summary');
      if (await summary.isVisible()) { await summary.click(); pressed = true; s = await seen(); }
    }
    out.push({ links: s.length, shown: s.filter(Boolean).length, pressed });
  }
  return out;
}
for (const width of [1280, 390]) {
  const { ctx, page } = await open(DEMO, { js: false, width });
  const r = await reachable(page);
  const ok = r.length === 7 && r.every(n => n.links > 0 && n.shown === n.links);
  const narrowPresses = r.filter(n => n.pressed).length;
  check(`no JavaScript at ${width} px: every link on screen or one press away (${narrowPresses} of 7 navs needed the Menu press)`, ok && (width === 1280 ? narrowPresses === 3 : narrowPresses === 7), JSON.stringify(r));
  await ctx.close();
}
{
  // broken on purpose: the list is hidden for good, summary or not
  const { ctx, page } = await openHtml('hidden-links', `<!doctype html><html lang="en"><head><title>t</title>
    <link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/site-nav/site-nav.css">
    <style>sg-site-nav ul { display: none !important }</style></head><body>
    <sg-site-nav><nav aria-label="x"><a class="sg-site-nav-home" href="#">Home</a><details><summary>Menu</summary><ul><li><a href="#a">A</a></li><li><a href="#b">B</a></li></ul></details></nav></sg-site-nav></body></html>`, { js: false, width: 390 });
  const r = await reachable(page);
  check('control: links hidden for good fail the same probe, even after the press', r[0].shown < r[0].links, JSON.stringify(r[0]));
  await ctx.close();
}

// ── exactly one current page per nav, including the one marked from the address ──
{
  const { ctx, page } = await open(DEMO);
  await settle(page);
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-site-nav')].map(n => [...n.querySelectorAll('[aria-current]')].map(a => `${a.textContent.trim()}=${a.getAttribute('aria-current')}`).join('|')));
  check('each nav has exactly one aria-current; the unmarked one is marked from the address', r.length === 7 && r.every(x => x && !x.includes('|')) && r[6] === 'Site nav=page', r.join(', '));
  const warm = await page.evaluate(() => { const a = document.querySelector('[data-register="warm"] a[aria-current]'); const p = a.querySelector('.sg-site-nav-pencil'); const ra = a.getBoundingClientRect(), rp = p.getBoundingClientRect(); return { hidden: p.getAttribute('aria-hidden'), under: Math.round(rp.top - ra.top), within: rp.left >= ra.left - 1 && rp.right <= ra.right + 1, paths: p.querySelectorAll('path').length }; });
  check('warm: a two-pass pencil line sits under the current link, inside its width, aria-hidden', warm.hidden === 'true' && warm.paths === 2 && warm.within && warm.under > 20, JSON.stringify(warm));
  await ctx.close();
}

// ── narrow: Escape closes the open menu and gives focus back to the summary ──
{
  const { ctx, page } = await open(DEMO, { width: 390 });
  const nav = '[data-register="quiet"] .panel:not(.narrow) sg-site-nav';
  await page.click(`${nav} summary`);
  await page.keyboard.press('Tab');
  const inMenu = await page.evaluate(() => document.activeElement.textContent.trim());
  await page.keyboard.press('Escape');
  const r = await page.evaluate(n => ({ open: document.querySelector(`${n} details`).open, focus: document.activeElement.localName }), nav);
  check('narrow: Tab goes into the open menu; Escape closes it and focus returns to Menu', inMenu === 'Home' && !r.open && r.focus === 'summary', JSON.stringify({ inMenu, ...r }));
  const sizes = await page.evaluate(() => [...document.querySelectorAll('sg-site-nav summary')].map(s => Math.round(s.getBoundingClientRect().height)));
  check('Menu buttons are at least 24 px tall', sizes.every(h => h >= 24), sizes.join(','));
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check('at 390 px the page does not scroll sideways', w <= 390, `${w}`);
  await ctx.close();
}
{
  const { ctx, page } = await open(DEMO);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('sg-site-nav ul a')].filter(a => a.getBoundingClientRect().height).map(a => Math.round(a.getBoundingClientRect().height)));
  check('every visible link is at least 24 px tall', sizes.length > 0 && sizes.every(h => h >= 24), `min ${Math.min(...sizes)}`);
  await ctx.close();
}

await done();
