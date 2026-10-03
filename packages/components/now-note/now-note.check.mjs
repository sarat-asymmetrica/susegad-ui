// Browser checks for <sg-now-note>: axe, the age in words, the stale warning
// in text (the probe also runs on a note whose date is long past but whose
// element can't say so, to show it can fail), and no JavaScript.
//
//   node packages/components/now-note/now-note.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';

const { check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/now-note/demo.html';

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

// A note older than its limit must say so in words a screen reader reads.
const honesty = page => page.evaluate(() => [...document.querySelectorAll('sg-now-note, .broken-note')].map(n => {
  const when = n.querySelector('time[datetime]')?.getAttribute('datetime');
  const days = (Date.UTC(2026, 8, 27) - Date.parse(`${when}T00:00:00Z`)) / 864e5;
  const said = /may be out of date/i.test(n.innerText);
  return { when, old: days > 45, said, age: n.querySelector('.sg-now-age')?.textContent ?? '' };
}));
{
  const { ctx, page } = await open(DEMO);
  await settle(page);
  const r = await honesty(page);
  check('every note older than 45 days says it may be out of date; no fresh one does', r.length === 6 && r.every(n => n.old === n.said), JSON.stringify(r));
  check('each note says how long ago, in words', r.every(n => n.age === (n.old ? ', 3 months ago' : ', 3 days ago')), r.map(n => n.age).join(' | '));
  await ctx.close();
}
{
  // broken on purpose: a stale note with the element missing, so nothing can say it's stale
  const { ctx, page } = await openHtml('stale-silent', `<!doctype html><html lang="en"><head><title>t</title></head><body>
    <div class="broken-note"><h3>Now</h3><p>Old news.</p><p class="sg-now-updated">Updated <time datetime="2026-06-02">2 June 2026</time></p></div></body></html>`);
  const r = await honesty(page);
  check('control: a long-past note that says nothing fails the same probe', r[0].old && !r[0].said, JSON.stringify(r[0]));
  await ctx.close();
}
{
  // the limit is the builder's: stale-after="2" makes a three-day-old note stale, live
  const { ctx, page } = await open(DEMO);
  const r = await page.evaluate(async () => {
    const n = document.querySelector('[data-register="quiet"] sg-now-note');
    n.setAttribute('stale-after', '2');
    await new Promise(r => setTimeout(r, 20));
    return { stale: n.hasAttribute('data-stale'), text: n.querySelector('.sg-now-stale')?.textContent };
  });
  check('stale-after is honoured when it changes', r.stale && r.text === 'This note may be out of date.', JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await open(DEMO, { js: false });
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-now-note')].map(n => ({ date: !!n.querySelector('time'), state: n.querySelector('sg-badge')?.textContent.trim() })));
  check('without JavaScript: the words, the state in words and the date all show', r.length === 6 && r.every(n => n.date && n.state), JSON.stringify(r[0]));
  await ctx.close();
}
{
  const { ctx, page } = await open(DEMO, { width: 390 });
  await settle(page);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check('at 390 px the page does not scroll sideways', w <= 390, `${w}`);
  await ctx.close();
}

await done();
