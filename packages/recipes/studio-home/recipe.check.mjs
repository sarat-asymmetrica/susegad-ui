// Browser checks for the studio home recipe: the seven studio-site pieces on
// one page, in each register. axe with and without JavaScript, no sideways
// scroll at 390 px, no redacted text in the page, nothing sounding before a
// press, and every piece upgraded with its skin.
//
//   node packages/recipes/studio-home/recipe.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';

const { check, open, axe, axeNoJs, done } = await harness();
const PAGE = '/packages/recipes/studio-home/index.html';
const TAGS = ['sg-site-nav', 'sg-now-note', 'sg-postcard', 'sg-quote', 'sg-chat-thread', 'sg-voice-note', 'sg-reach'];

for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${PAGE}?register=${register}&theme=${theme}`);
  await page.addInitScript(() => { window.__plays = 0; const p = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function (...a) { window.__plays++; return p.apply(this, a); }; });
  await page.reload();
  await page.waitForFunction(() => window.__ready === true);
  await settle(page);
  const v = await axe(page);
  const skins = await page.evaluate(tags => tags.map(t => [...document.querySelectorAll(t)].every(e => e.dataset.skin)), TAGS);
  const quiet = await page.evaluate(() => ({ plays: window.__plays, leaked: /98765|Rohan/.test(document.documentElement.outerHTML) }));
  check(`${register} ${theme}: axe 0, every piece skinned, no page errors, nothing played, nothing leaked`, !v.length && skins.every(Boolean) && !errors.length && !quiet.plays && !quiet.leaked, [v.join('; '), JSON.stringify(skins), errors.join(' | '), JSON.stringify(quiet)].filter(Boolean).join(' / '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(PAGE)).length);
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await open(`${PAGE}?register=${register}`, { width: 390, touch: true });
  await settle(page);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`${register} at 390 px: no sideways scroll`, w <= 390, `${w}`);
  await ctx.close();
}

await done();
