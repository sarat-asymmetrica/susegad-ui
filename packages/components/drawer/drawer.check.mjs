// Browser checks for Drawer behaviour: focus trap, Escape, return focus, the
// no-JS link, and — since Rasika's OB1 found the panel-only backdrop left
// the rest of the page dimmed but still readable — a legibility check that
// can actually fail (see dialog.check.mjs's longer comment on why a first
// version of this measured the wrong signal twice).
//
//   node packages/components/drawer/drawer.check.mjs

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

/** See dialog.check.mjs: focus() on a background element silently fails
 *  while it is blocked by an open modal dialog (the HTML spec's own words),
 *  which is the real reachability signal — not a literal [inert]/[aria-hidden]
 *  attribute or the .inert IDL property, neither of which reflect it. */
const isBlockedByModal = (p, selector) => p.evaluate(sel => {
  const el = document.querySelector(sel);
  const had = el.hasAttribute('tabindex'), prev = el.getAttribute('tabindex');
  if (!had) el.setAttribute('tabindex', '-1');
  el.focus();
  const blocked = document.activeElement !== el;
  if (had) el.setAttribute('tabindex', prev); else el.removeAttribute('tabindex');
  return blocked;
}, selector);

/** See dialog.check.mjs's long comment: this went through two failed
 *  instruments before landing here. Returns the Laplacian-of-luminance edge
 *  map of a region (one number per interior pixel), from a real screenshot
 *  decoded in-page. edgeCorrelation() below compares two maps' SHAPE, not
 *  their sum — a first version summed into one "edge energy" number and a
 *  threshold, which could not tell a plain ::backdrop dim (still human
 *  readable) apart from Carepa's opaque cover (fully gone): both reduced
 *  the sum by a similar amount, because dimming alone already lowers
 *  contrast a lot. Correlating the maps catches whether the same letters
 *  are still sitting in the same place, dim or not. */
async function edgeMap(p, selector) {
  const clip = await p.evaluate(sel => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), width: Math.max(2, Math.round(r.width)), height: Math.max(2, Math.round(r.height)) };
  }, selector);
  const buf = await p.screenshot({ clip });
  return p.evaluate(async b64 => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}`; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const { data, width: w, height: h } = g.getImageData(0, 0, c.width, c.height);
    const lum = i => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const out = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const c0 = lum(i), n0 = lum(((y - 1) * w + x) * 4), s0 = lum(((y + 1) * w + x) * 4), e0 = lum((y * w + x + 1) * 4), w0 = lum((y * w + x - 1) * 4);
      out.push(4 * c0 - n0 - s0 - e0 - w0);
    }
    return out;
  }, buf.toString('base64'));
}

/** Pearson correlation between two equal-shaped edge maps (see dialog.check.mjs). */
function edgeCorrelation(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; cov += da * db; va += da * da; vb += db * db; }
  const denom = Math.sqrt(va * vb);
  return denom > 0 ? cov / denom : 0;
}

async function page({ register = 'warm' } = {}) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${server.url}/packages/components/drawer/demo.html?register=${register}`);
  await p.waitForFunction(() => window.__ready === true);
  return { ctx, p, errors };
}

for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, p, errors } = await page({ register });
  const REGION = 'main > p.body-copy';
  const baselineMap = await edgeMap(p, REGION);

  // Rasika S1: a fixed 500ms wait here flaked under tools/checks.mjs's full-
  // suite concurrency (2 of 4 runs) while never failing in isolation, 5 of 5
  // — a timing assumption racing load, not a real bug. Wait on the actual
  // state instead (open, and its entrance animation settled, the same
  // pattern as karigar-actions' menu.check.mjs): however long the machine
  // takes, the legibility screenshot and Tab-loop below never start early.
  await p.click('a[data-sg-drawer="rooms"]');
  await p.waitForFunction(() => {
    const dlg = document.querySelector('#rooms dialog');
    if (!dlg?.open) return false;
    const card = document.querySelector('#rooms .sg-drawer-card');
    const anims = [...dlg.getAnimations(), ...(card ? card.getAnimations() : [])];
    return anims.every(a => a.playState !== 'running');
  });
  check(`${register}: clicking the opener shows the drawer modally`, await p.evaluate(() => document.querySelector('#rooms dialog').open));

  // Chromium's wrap-step quirk (see dialog.check.mjs): document.body is a
  // transient, non-actionable stop, at most once per wrap, never a real leak.
  let leaked = false, sinceWrap = 0, maxBodyPerWrap = 0, firstKey = null;
  for (let i = 0; i < 10; i++) {
    await p.keyboard.press('Tab');
    const stop = await p.evaluate(() => {
      const el = document.activeElement, isBody = el === document.body;
      return { inside: document.querySelector('#rooms dialog').contains(el), isBody, key: isBody ? 'body' : (el.id || el.outerHTML.slice(0, 40)) };
    });
    if (!stop.inside && !stop.isBody) { leaked = true; break; }
    if (stop.isBody) { sinceWrap++; maxBodyPerWrap = Math.max(maxBodyPerWrap, sinceWrap); }
    else {
      // see dialog.check.mjs: the reset must also fire on the very first sighting of the
      // real element, or a dialog with only one focusable control (Drawer's "Close" button)
      // always reports a false failure.
      if (firstKey === null) firstKey = stop.key;
      if (stop.key === firstKey) sinceWrap = 0;
    }
  }
  check(`${register}: Tab never leaves the open drawer onto real page content`, !leaked);
  check(`${register}: at most one transient body stop per wrap, never stuck`, maxBodyPerWrap <= 1, `${maxBodyPerWrap} in a row`);

  // reachability and legibility of the page behind, same as Dialog (Rasika OB1/OB2)
  check(`${register}: the body copy behind the drawer is blocked from focus while it is modal`, await isBlockedByModal(p, REGION));
  if (register !== 'quiet') {
    const openMap = await edgeMap(p, REGION);
    const corr = edgeCorrelation(baselineMap, openMap);
    check(`${register}: the body copy's letterforms no longer correlate with the open-page baseline`, corr < 0.3,
      `edge-map correlation ${corr.toFixed(2)} against the legible baseline (>=0.3 means the same letters are still sitting there)`);
  }

  // Same fix as above: wait for the real close (open === false) and for
  // focus to actually land back on the opener, not a fixed 150ms guess.
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => document.querySelector('#rooms dialog')?.open === false);
  await p.waitForFunction(() => document.activeElement?.getAttribute('data-sg-drawer') === 'rooms').catch(() => {});
  const after = await p.evaluate(() => ({ open: document.querySelector('#rooms dialog').open, active: document.activeElement.getAttribute('data-sg-drawer') }));
  check(`${register}: Escape closes the drawer`, after.open === false);
  check(`${register}: focus returns to the opener`, after.active === 'rooms', JSON.stringify(after));

  check(`${register}: no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(`${server.url}/packages/components/drawer/demo.html`);
  await p.click('a[data-sg-drawer="rooms"]');
  await p.waitForLoadState();
  check('no JavaScript: the opener navigates to a real page, nothing is unreachable', p.url().includes('no-js.html'));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
