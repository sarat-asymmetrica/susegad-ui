// A gate that can't fail is worse than none (A10): this one points sidewaysScroll at a page that
// really does scroll sideways, in a phone context, and shows the old innerWidth yardstick missing it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { pickEngine, engineName, contextOptions } from './engine.mjs';
import { sidewaysScroll } from './overflow.mjs';
import { acquireSlot } from './slots.mjs';

const wide = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div style="width:700px;height:20px;background:#c33"></div>';
const noMeta = '<!doctype html><body style="margin:0"><div style="width:100px;height:20px"></div>';
const clip = (on) => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${on}{overflow-x:hidden}</style><body style="margin:0"><div style="width:700px;height:20px;background:#c33"></div>`;
const fits = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div style="width:100%;height:20px"></div>';

async function open(browser, html, mobile) {
  const context = await browser.newContext(contextOptions(engineName(), {
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: mobile, isMobile: mobile,
  }));
  const page = await context.newPage();
  await page.setContent(html);
  return { page, context };
}

test('sidewaysScroll sees a 700 px child on a 390 px phone; innerWidth could not', { timeout: 300000 }, async () => {
  // a browser takes a machine-wide slot like every check (docs/RUNBOOK.md §4); the wait counts against the timeout, so it is generous
  const release = await acquireSlot({ label: 'overflow.test.mjs' });
  const browser = await pickEngine().launch().catch(e => { release(); throw e; });
  try {
    for (const mobile of [true, false]) {
      const bad = await open(browser, wide, mobile);
      const old = await bad.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      const said = await sidewaysScroll(bad.page, 390);
      const auto = await sidewaysScroll(bad.page);
      assert.equal(said.overflow, 310, `requested width, mobile=${mobile}: ${JSON.stringify(said)}`);
      assert.equal(auto.overflow, 310, `clientWidth, mobile=${mobile}: ${JSON.stringify(auto)}`);
      // the instrument being replaced: in a mobile Chromium context it reads "no overflow"
      if (mobile && engineName() === 'chromium') assert.ok(old.sw <= old.iw, `the old yardstick should be blind here: ${JSON.stringify(old)}`);
      await bad.context.close();

      const ok = await open(browser, fits, mobile);
      assert.equal((await sidewaysScroll(ok.page, 390)).overflow, 0);
      assert.equal((await sidewaysScroll(ok.page)).overflow, 0);
      await ok.context.close();
    }
    // no meta viewport: a phone lays the page out at 980 px, clientWidth follows, a small page "fits"
    // by clientWidth and by innerWidth, and is still wrong. The honest yardstick calls it out.
    const nm = await open(browser, noMeta, true);
    const r = await sidewaysScroll(nm.page);
    assert.equal(r.metaViewport, false);
    if (engineName() !== 'firefox') assert.ok(r.overflow > 0, `no meta viewport on a phone must read as overflow: ${JSON.stringify(r)}`);
    assert.equal((await sidewaysScroll(nm.page, 390)).overflow, 590 * (engineName() === 'firefox' ? 0 : 1));
    await nm.context.close();
    const withMeta = await open(browser, fits, true);
    assert.equal((await sidewaysScroll(withMeta.page)).metaViewport, true);
    await withMeta.context.close();
    // clipping is not fitting: hidden on html AND body used to read 0 while a 700 px child was cut off
    for (const [on, html] of [['html,body', clip('html,body')], ['html', clip('html')], ['body', clip('body')]]) {
      const c = await open(browser, html, true);
      const r = await sidewaysScroll(c.page, 390);
      assert.equal(r.overflow, 310, `overflow-x hidden on ${on}: ${JSON.stringify(r)}`);
      assert.equal(r.clipped, true, `clipped flag on ${on}`);
      const allowed = await sidewaysScroll(c.page, 390, { allowClipped: 'a decorative bleed, in this fixture' });
      assert.equal(allowed.clipped, false);
      await c.context.close();
    }
    assert.throws(() => sidewaysScroll(null, 390, { allowClipped: ' ' }), /needs a reason/);
    // desktop: a fitting page wider than the monitor must not read as overflow (Firefox's screen.width is the real screen)
    const dctx = await browser.newContext(contextOptions(engineName(), { viewport: { width: 1440, height: 900 } }));
    const dpage = await dctx.newPage();
    await dpage.setContent(fits);
    const dr = await sidewaysScroll(dpage);
    assert.equal(dr.overflow, 0, `1440 desktop, auto: ${JSON.stringify(dr)}`);
    assert.equal(dr.clipped, false);
    await dctx.close();
  } finally { await browser.close(); release(); }
});
