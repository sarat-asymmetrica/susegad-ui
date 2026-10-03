// Browser checks for <sg-quote>: axe with and without JavaScript, that the
// ornament adds no words to what assistive technology reads (the probe also
// runs on a mark drawn as text, to show it can fail), the ink-in and reduced
// motion, and phone width.
//
//   node packages/components/quote/quote.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';

const { check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/quote/demo.html';

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

// What a screen reader reads: the figure's text, minus aria-hidden subtrees.
const spoken = page => page.evaluate(() => [...document.querySelectorAll('sg-quote figure')].map(f => {
  const walk = n => n.nodeType === 3 ? n.data : (n.nodeType === 1 && (n.getAttribute('aria-hidden') === 'true' || getComputedStyle(n).display === 'none')) ? '' : [...n.childNodes].map(walk).join('');
  return walk(f).replace(/\s+/g, ' ').trim();
}));
{
  const { ctx, page } = await open(DEMO, { js: false });
  const plain = await spoken(page);
  await ctx.close();
  const { ctx: c2, page: p2 } = await open(DEMO);
  await settle(p2);
  const dressed = await spoken(p2);
  const orn = await p2.evaluate(() => ({ bracket: document.querySelectorAll('.sg-quote-bracket[aria-hidden="true"]').length, mark: document.querySelectorAll('.sg-quote-mark[aria-hidden="true"]').length }));
  check('the ornament adds no words: what is read is the same with and without the skins', plain.length === 6 && plain.every((t, i) => t === dressed[i]), dressed[5]);
  check('warm draws two pencil brackets and playful two quotation marks, all aria-hidden', orn.bracket === 2 && orn.mark === 2, JSON.stringify(orn));
  await c2.close();
}
{
  // broken on purpose: a quotation mark written as text, not hidden
  const { ctx, page } = await openHtml('mark-as-text', `<!doctype html><html lang="en"><head><title>t</title></head><body>
    <sg-quote><figure><span class="sg-quote-mark">“</span><blockquote><p>Words.</p></blockquote><figcaption>Someone</figcaption></figure></sg-quote></body></html>`);
  const t = await spoken(page);
  check('control: a quotation mark drawn as text shows up in the same probe', t[0].includes('“'), t[0]);
  await ctx.close();
}

// ── the playful mark inks in; never under reduced motion ──
for (const reduced of [false, true]) {
  const { ctx, page } = await open(DEMO, { reduced });
  const n = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 60)); return document.querySelector('[data-register="playful"] sg-quote').getAnimations({ subtree: true }).length; });
  if (reduced) check('playful under reduced motion: the mark is simply there, no ink-in', n === 0, `${n} animations`);
  else check('playful: the two blots ink in when the quote is on screen', n === 2, `${n} animations`);
  await settle(page);
  const op = await page.evaluate(() => [...document.querySelectorAll('.sg-quote-mark path')].map(p => getComputedStyle(p).opacity));
  check(`playful${reduced ? ' (reduced motion)' : ''}: the mark ends fully inked`, op.every(o => o === '1'), op.join(','));
  await ctx.close();
}

// ── phone width, and the source link is a real 24 px target ──
{
  const { ctx, page } = await open(DEMO, { width: 390 });
  await settle(page);
  const r = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, links: [...document.querySelectorAll('.sg-quote-source')].map(a => Math.round(a.getBoundingClientRect().height)) }));
  check('at 390 px: no sideways scroll; source links at least 24 px tall', r.w <= 390 && r.links.every(h => h >= 24), JSON.stringify(r));
  await ctx.close();
}

await done();
