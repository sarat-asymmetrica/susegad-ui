// Browser checks for <sg-stamp>: reflow at phone widths. Run by hand or with `npm run check`:
//
//   node packages/components/stamp/stamp.check.mjs
//
// 1.4.10: the playful ink halo (.sg-stamp-spread, inset -14%) is invisible at rest but still counted
// as scrollable overflow, so the page scrolled sideways when a stamp was nearly as wide as the screen.

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';

const { check, open, done } = await harness();
const DEMO = '/packages/components/stamp/demo.html';

for (const width of [320, 390]) for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page, errors } = await open(`${DEMO}?register=${register}`, { width });
  await settle(page);
  // let every stamp's landing finish, so the measurement is of the page at rest
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
  await page.waitForTimeout(500);
  const o = await sidewaysScroll(page, width);
  const r = { w: o.scrollWidth, wide: await page.evaluate(vw => [...document.querySelectorAll('sg-stamp *')].filter(e => e.getBoundingClientRect().right > vw + 1).slice(0, 2).map(e => e.className), o.viewWidth) };
  check(`${register} at ${width} px: the page does not scroll sideways`, r.w <= width, `${r.w}${r.wide.length ? '; past the edge: ' + r.wide.join(', ') : ''}`);
  check(`${register} at ${width} px: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}

await done();
