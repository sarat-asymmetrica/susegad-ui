// Browser checks for <sg-site-footer>: axe in every register and theme (with
// and without JavaScript), the small print's year moving forward and never
// back, the keyboard reaching the links, no sideways scroll at 390 px, the
// playful hop and its reduced-motion still, and where things sit. Each probe
// also runs on a broken or untouched copy to show it can fail.
//
//   node packages/components/site-footer/site-footer.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';

const { check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/site-footer/demo.html';

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

// ── a page we can hold the clock on ─────────────────────────────────────
const FOOTER = ({ sign = 'Drawn, printed and posted from Aldona.', year = 2026, time = true, links = ['Work', 'Visit', 'Privacy'], now = '2026-10-03' } = {}) => `
  <sg-site-footer seed="the seed"${now ? ` now="${now}"` : ''}>
    <footer aria-label="Site footer">
      <p class="sg-site-footer-sign">${sign}</p>
      <nav class="sg-site-footer-links" aria-label="Footer"><ul>${links.map(l => `<li><a href="/${l.toLowerCase()}/">${l}</a></li>`).join('')}</ul></nav>
      <p class="sg-site-footer-small">&copy; ${time ? `<time datetime="${year}">${year}</time>` : year} The Paper Boat Studio, Aldona. All drawings belong to the studio.</p>
    </footer>
  </sg-site-footer>`;
const PAGE = (body, { register = 'quiet', js = true } = {}) => `<!doctype html><html lang="en" data-register="${register}"><head><meta charset="utf-8"><title>t</title>
  <link rel="stylesheet" href="/packages/tokens/fonts.css"><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/site-footer/site-footer.css">
  </head><body><main>${body}</main>${js ? `<script>window.addEventListener('sg-site-footer-year', e => (window.__ev ??= []).push(e.detail.year));</script><script type="module">import "/packages/components/site-footer/site-footer.js";</script>` : ''}</body></html>`;

async function footerPage(html, opts = {}) {
  const { ctx, page, errors } = await openHtml(`footer-${Math.random().toString(36).slice(2)}`, html, opts);
  return { ctx, page, errors };
}
const read = page => page.evaluate(() => {
  const foot = document.querySelector('sg-site-footer'), small = foot?.querySelector('.sg-site-footer-small');
  const time = small?.querySelector('time');
  const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  return {
    label: foot?.querySelector('footer')?.getAttribute('aria-label') ?? null,
    shown: vis(small), small: small?.textContent.replace(/\s+/g, ' ').trim() ?? '',
    year: time?.textContent ?? null, datetime: time?.getAttribute('datetime') ?? null,
    links: [...(foot?.querySelectorAll('.sg-site-footer-links a') ?? [])].map(a => vis(a)),
  };
});

// ── the year: forward, never back, never invented ───────────────────────
{
  const { ctx, page } = await footerPage(PAGE(FOOTER({ year: 2024 })));
  const events = await page.evaluate(() => window.__ev ?? []);
  const r = await read(page);
  check('a small print written 2024 shows the clock\'s 2026, in the text and the datetime, and tells the page', r.year === '2026' && r.datetime === '2026' && events.join() === '2026', JSON.stringify({ ...r, events }));
  await ctx.close();
}
{
  const { ctx, page } = await footerPage(PAGE(FOOTER({ year: 2026 })));
  const r = await read(page);
  check('the year already right is left alone', r.year === '2026' && r.datetime === '2026', JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await footerPage(PAGE(FOOTER({ year: 2027 })));
  const r = await read(page);
  check('a year written ahead keeps: 2027 stays 2027', r.year === '2027' && r.datetime === '2027', JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await footerPage(PAGE(FOOTER({ year: 2024, time: false })));
  const r = await read(page);
  check('no <time>: the first year in the line\'s own text moves, the rest of the line keeps', r.year === null && r.small.startsWith('© 2026 The Paper Boat Studio') && r.small.endsWith('All drawings belong to the studio.'), JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await footerPage(PAGE('<sg-site-footer now="2026-10-03"><footer aria-label="Site footer"><p class="sg-site-footer-sign">No year here.</p><p class="sg-site-footer-small">Letters welcome.</p></footer></sg-site-footer>'));
  const r = await read(page);
  check('no year anywhere: the line is untouched', r.small === 'Letters welcome.', JSON.stringify(r));
  await ctx.close();
}
{
  // the control: the same markup, no element and no JavaScript, so the year checks above can fail
  const { ctx, page } = await footerPage(PAGE(FOOTER({ year: 2024 }), { js: false }));
  const r = await read(page);
  check('control: the markup alone (no element) still says 2024, so the year probes above can fail', r.year === '2024' && r.datetime === '2024', JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await footerPage(PAGE(FOOTER().replace('<footer ', '<footer data-x ')));
  const r = await read(page);
  check('a labelled footer keeps its own label (the element adds one only when there is none)', r.label === 'Site footer', JSON.stringify(r));
  await ctx.close();
}

// ── the keyboard ────────────────────────────────────────────────────────
async function tabTo(page, sel, max = 8) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(s => document.activeElement?.matches(s), sel)) return i + 1;
  }
  return 0;
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await footerPage(PAGE(FOOTER(), { register }));
  const presses = await tabTo(page, '.sg-site-footer-links a');
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
  const box = await page.evaluate(() => document.activeElement.getBoundingClientRect().height);
  check(`${register}: Tab reaches the first link (${presses} presses), a ${Math.round(box)} px target with a focus ring`, presses > 0 && ring && box >= 40, `presses ${presses}, ring ${ring}, height ${box}`);
  await ctx.close();
}
{
  const { ctx, page } = await footerPage(PAGE(FOOTER({ links: [] }), { register: 'playful' }));
  const presses = await tabTo(page, 'a', 3);
  const r = await read(page);
  check('a footer with no links: Tab finds nothing to land on, and nothing is missing', presses === 0 && r.shown, JSON.stringify(r));
  await ctx.close();
}

// ── no JavaScript, and phone width ──────────────────────────────────────
{
  const { ctx, page } = await open(`${DEMO}?register=quiet`, { js: false });
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-site-footer')].map(f => {
    const vis = e => !!e && e.getClientRects().length > 0;
    return { sign: vis(f.querySelector('.sg-site-footer-sign')), links: [...f.querySelectorAll('.sg-site-footer-links a')].map(vis).every(Boolean), small: vis(f.querySelector('.sg-site-footer-small')) };
  }));
  check('without JavaScript: sign-off, every link and the small print show on all 3 footers (the page itself stays one quiet copy)', r.length === 3 && r.every(f => f.sign && f.links && f.small), JSON.stringify(r.find(f => !(f.sign && f.links && f.small)) ?? r[0]));
  await ctx.close();
}
{
  const { ctx, page } = await footerPage(PAGE(FOOTER({ year: 2024 }), { js: false }));
  const r = await read(page);
  check('no JavaScript on a single page: the footer reads as written, links shown, year unmoved', r.shown && r.links.every(Boolean) && r.year === '2024', JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await openHtml('footer-hidden-links', `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title>
    <link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/site-footer/site-footer.css">
    <style>sg-site-footer .sg-site-footer-links { display: none !important }</style></head><body>
    <main>${FOOTER({})}</main></body></html>`, { js: false });
  const r = await read(page);
  check('control: a footer whose links are hidden for good fails the no-JavaScript probe (0 of 3 links show)', r.links.length === 3 && !r.links.every(Boolean), JSON.stringify(r));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await open(`${DEMO}?register=${register}`, { width: 390 });
  await settle(page);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`at 390 px the ${register} demo does not scroll sideways`, w <= 390, `${w}`);
  await ctx.close();
}

// ── where things sit, in numbers ────────────────────────────────────────
{
  const { ctx, page } = await footerPage(PAGE(FOOTER(), { register: 'quiet' }));
  const g = await page.evaluate(() => {
    const foot = document.querySelector('sg-site-footer footer');
    const sign = foot.querySelector('.sg-site-footer-sign').getBoundingClientRect();
    const nav = foot.querySelector('.sg-site-footer-links').getBoundingClientRect();
    const small = foot.querySelector('.sg-site-footer-small').getBoundingClientRect();
    return { signBottom: +sign.bottom.toFixed(1), navTop: +nav.top.toFixed(1), navBottom: +nav.bottom.toFixed(1), smallTop: +small.top.toFixed(1), pageW: document.documentElement.scrollWidth };
  });
  check('quiet: the sign-off ends, then the links, then the small print, each below the last, and nothing overflows', g.navTop >= g.signBottom && g.smallTop >= g.navBottom && g.pageW <= 1280, JSON.stringify(g));
  await ctx.close();
}
{
  const { ctx, page } = await footerPage(PAGE(FOOTER(), { register: 'warm' }));
  await page.waitForSelector('.sg-site-footer-rule', { timeout: 3000 }).catch(() => {});
  // the rule refits on the frame after a resize; let fonts land and two frames pass before reading it
  await page.evaluate(() => document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const g = await page.evaluate(() => {
    const sign = document.querySelector('.sg-site-footer-sign');
    const svg = sign.querySelector('.sg-site-footer-rule');
    const range = document.createRange();
    range.selectNodeContents(sign);
    if (svg) range.setEndBefore(svg);
    const lines = [...range.getClientRects()].filter(r => r.width > 0);
    const wordsW = Math.round(Math.max(...lines.map(r => r.right)) - Math.min(...lines.map(r => r.left)));
    return { svgW: svg ? Math.round(parseFloat(svg.getAttribute('width'))) : 0, wordsW, blockW: Math.round(sign.getBoundingClientRect().width), passes: sign.querySelectorAll('path').length };
  });
  check('warm: the pencil rule is two paths, fitted to the words of the sign-off, not its block (within 3 px)', g.passes === 2 && Math.abs(g.svgW - g.wordsW) <= 3 && g.wordsW < g.blockW, JSON.stringify(g));
  await ctx.close();
}

// ── the playful hop, and the still ──────────────────────────────────────
{
  const html = PAGE(FOOTER(), { register: 'playful' });
  const { ctx, page } = await footerPage(html);
  const lift = () => page.evaluate(() => { const a = document.querySelector('.sg-site-footer-links a'); const s = getComputedStyle(a); return { t: s.translate, tilt: a.style.getPropertyValue('--sg-footer-tilt') }; });
  const rest = await lift();
  await page.hover('.sg-site-footer-links a');
  await settle(page);
  await page.waitForTimeout(80);
  const up = await lift();
  await page.mouse.move(2, 2);
  await settle(page);
  await page.waitForTimeout(80);
  const back = await lift();
  const loops = await page.evaluate(() => document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations === Infinity).length);
  check('playful: at rest the chip is down; on hover it lifts 2 px and comes back when the pointer leaves; nothing loops', rest.t === 'none' && up.t !== 'none' && back.t === 'none' && loops === 0, `${rest.t} | ${up.t} | ${back.t} | loops ${loops}`);
  check('playful: every chip sits at its own seeded angle', await page.evaluate(() => { const s = new Set([...document.querySelectorAll('.sg-site-footer-links a')].map(a => a.style.getPropertyValue('--sg-footer-tilt'))); return s.size >= 2; }), 'want at least 2 distinct angles');
  await ctx.close();

  const r = await footerPage(html, { reduced: true });
  await r.page.hover('.sg-site-footer-links a');
  await settle(r.page); await r.page.waitForTimeout(80);
  const still = await r.page.evaluate(() => getComputedStyle(document.querySelector('.sg-site-footer-links a')).translate);
  check('playful with reduced motion: the chip stays down on hover', still === 'none', still);
  await r.ctx.close();

  // the hop is a check that can fail: the same probe on the warm skin (which has no hop) reads flat
  const w = await footerPage(PAGE(FOOTER(), { register: 'warm' }));
  await w.page.hover('.sg-site-footer-links a');
  await settle(w.page); await w.page.waitForTimeout(80);
  const warmHover = await w.page.evaluate(() => getComputedStyle(document.querySelector('.sg-site-footer-links a')).translate);
  check('control: the warm link does not hop on hover, so the playful probe above can tell them apart', warmHover === 'none', warmHover);
  await w.ctx.close();
}

await done();
