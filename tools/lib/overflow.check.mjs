// A gate that can't fail is worse than none (A10): this one points sidewaysScroll at a page that
// really does scroll sideways, in a phone context, and shows the old innerWidth yardstick missing it.
// (It was a unit test that launched a browser; as a check it runs in the suite, through a slot.)
//
//   node tools/lib/overflow.check.mjs        (SG_ENGINE=webkit | firefox for the other engines)

import { harness } from './component-check.mjs';
import { contextOptions } from './engine.mjs';
import { sidewaysScroll } from './overflow.mjs';

const { browser, engine, check, done } = await harness();

const wide = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div style="width:700px;height:20px;background:#c33"></div>';
const noMeta = '<!doctype html><body style="margin:0"><div style="width:100px;height:20px"></div>';
const clip = on => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${on}{overflow-x:hidden}</style><body style="margin:0"><div style="width:700px;height:20px;background:#c33"></div>`;
const fits = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div style="width:100%;height:20px"></div>';

async function open(html, mobile) {
  const context = await browser.newContext(contextOptions(engine, {
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: mobile, isMobile: mobile,
  }));
  const page = await context.newPage();
  await page.setContent(html);
  return { page, context };
}
const j = o => JSON.stringify(o);

for (const mobile of [true, false]) {
  const bad = await open(wide, mobile);
  const old = await bad.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  const said = await sidewaysScroll(bad.page, 390);
  const auto = await sidewaysScroll(bad.page);
  check(`mobile=${mobile}: a 700 px child on a 390 px phone reads 310 px over, by the requested width`, said.overflow === 310, j(said));
  check(`mobile=${mobile}: and by clientWidth`, auto.overflow === 310, j(auto));
  // the instrument being replaced: in a mobile Chromium context it reads "no overflow"
  if (mobile && engine === 'chromium') check('mobile Chromium: the old innerWidth yardstick is blind to it', old.sw <= old.iw, j(old));
  await bad.context.close();

  const ok = await open(fits, mobile);
  check(`mobile=${mobile}: a page that fits reads 0 by the requested width`, (await sidewaysScroll(ok.page, 390)).overflow === 0);
  check(`mobile=${mobile}: and by clientWidth`, (await sidewaysScroll(ok.page)).overflow === 0);
  await ok.context.close();
}

// no meta viewport: a phone lays the page out at 980 px, clientWidth follows, a small page "fits"
// by clientWidth and by innerWidth, and is still wrong. The honest yardstick calls it out.
{
  const nm = await open(noMeta, true);
  const r = await sidewaysScroll(nm.page);
  check('no meta viewport is reported as such', r.metaViewport === false, j(r));
  if (engine !== 'firefox') check('no meta viewport on a phone reads as overflow', r.overflow > 0, j(r));
  const asked = (await sidewaysScroll(nm.page, 390)).overflow;
  check('no meta viewport, asked at 390 px: the page laid out at 980 is 590 over', asked === 590 * (engine === 'firefox' ? 0 : 1), String(asked));
  await nm.context.close();
  const withMeta = await open(fits, true);
  check('a page with the meta viewport says so', (await sidewaysScroll(withMeta.page)).metaViewport === true);
  await withMeta.context.close();
}

// clipping is not fitting: hidden on html AND body used to read 0 while a 700 px child was cut off
for (const on of ['html,body', 'html', 'body']) {
  const c = await open(clip(on), true);
  const r = await sidewaysScroll(c.page, 390);
  check(`overflow-x hidden on ${on}: still 310 over, and flagged clipped`, r.overflow === 310 && r.clipped === true, j(r));
  const allowed = await sidewaysScroll(c.page, 390, { allowClipped: 'a decorative bleed, in this fixture' });
  check(`overflow-x hidden on ${on}: allowed with a reason, the clipped flag is off`, allowed.clipped === false, j(allowed));
  await c.context.close();
}

// desktop: a fitting page wider than the monitor must not read as overflow (Firefox's screen.width is the real screen)
{
  const dctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1440, height: 900 } }));
  const dpage = await dctx.newPage();
  await dpage.setContent(fits);
  const dr = await sidewaysScroll(dpage);
  check('1440 desktop, auto: a fitting page is not overflow and not clipped', dr.overflow === 0 && dr.clipped === false, j(dr));
  await dctx.close();
}

await done();
