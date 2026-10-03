// Browser checks for Dialog behaviour the screenshots cannot show:
//
//   node packages/components/dialog/dialog.check.mjs
//
// Checks: showModal() traps focus (Tab cannot leave the dialog); Escape
// closes it and focus returns to the opener; a click on the dimmed fill
// outside the card closes it; the no-JS opener is a real, reachable link;
// the reading paragraph behind the dialog is inert (Rasika OB2's honest
// name: this tests reachability, not legibility) AND, separately, actually
// loses its legible detail once the dialog is warm or playful (measured
// from real screenshot pixels, not a guess — a check that could fail, and
// did fail against the pre-fix Drawer: see drawer.check.mjs).

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

/**
 * True while `selector` cannot actually receive focus — per the HTML spec,
 * "the focusing steps for an element blocked by a modal dialog do nothing",
 * so a focus() call on it silently fails while a modal is open. This is the
 * real, spec-guaranteed reachability signal; a literal [aria-hidden]/[inert]
 * DOM attribute or the .inert IDL property do NOT reflect a background
 * element being blocked by an *open modal dialog* (verified: both read
 * false here even though the browser really does refuse the element focus —
 * a first version of this check tested the wrong DOM signal and always
 * failed, an evidence-bearing gate that couldn't actually fail the other
 * way. Rasika OB2, and A7: the instrument, not the implementation, was wrong.)
 * Temporarily adds tabindex="-1" only if the element has none, so a
 * naturally unfocusable element (like a <p>) can be tried at all.
 */
const isBlockedByModal = (p, selector) => p.evaluate(sel => {
  const el = document.querySelector(sel);
  const had = el.hasAttribute('tabindex'), prev = el.getAttribute('tabindex');
  if (!had) el.setAttribute('tabindex', '-1');
  el.focus();
  const blocked = document.activeElement !== el;
  if (had) el.setAttribute('tabindex', prev); else el.removeAttribute('tabindex');
  return blocked;
}, selector);

/**
 * The Laplacian-of-luminance edge map of `selector`'s screen box, from a
 * real screenshot decoded back in the page (no image dependency — the same
 * trick tools/diff.mjs uses for canvas ImageData): one number per interior
 * pixel, high where a letterform's stroke edge sits, near zero over flat
 * ground. Flattened to a plain array so it can be compared across two shots.
 *
 * A first version of this check summed the edge map into one "edge energy"
 * number and compared it to a threshold. That failed to tell "dimmed but
 * still human-readable" (a plain ::backdrop tint, which the pre-fix Drawer
 * used everywhere outside its panel) apart from "painted over and truly
 * gone" (Dialog's opaque Carepa wall): both landed around the same reduced
 * energy, because dimming lowers contrast a lot even though the same
 * letters are still sitting right there. What actually tells them apart is
 * whether the SAME edges are still in the SAME places — so this returns
 * the map itself, and edgeCorrelation() below compares two maps' shapes,
 * not just their totals (A7: the first instrument answered a different
 * question than the one being asked).
 */
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

/** Pearson correlation between two equal-shaped edge maps: near 1 when the
 *  same edges sit in the same places (the letters are still there, however
 *  dim); near 0 or negative when the pattern has genuinely changed. */
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

async function page({ reduced = false, register = 'warm' } = {}) {
  const ctx = await browser.newContext({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${server.url}/packages/components/dialog/demo.html?register=${register}`);
  await p.waitForFunction(() => window.__ready === true);
  return { ctx, p, errors };
}

for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, p, errors } = await page({ register });
  const REGION = 'main > p.body-copy';
  const baselineMap = await edgeMap(p, REGION);

  await p.focus('a[data-sg-dialog="ask"]');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  const opened = await p.evaluate(() => document.querySelector('#ask dialog').open);
  check(`${register}: Enter on the opener shows the dialog modally`, opened);

  // focus trap: Tab many times, focus must never land on real page content.
  // Chromium has a documented quirk where the wrap step transiently reports
  // document.activeElement as <body> for one Tab (verified interactively:
  // it self-corrects on the very next Tab) before landing back inside the
  // dialog; that single stop is not a leak a user can act on. But it must be
  // AT MOST ONE per wrap through the dialog's focusable set, not any number
  // — two in a row (or more per lap) would mean focus is actually stuck.
  let leaked = false, sinceWrap = 0, maxBodyPerWrap = 0, firstKey = null;
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press('Tab');
    const stop = await p.evaluate(() => {
      const el = document.activeElement, isBody = el === document.body;
      return { inside: document.querySelector('#ask dialog').contains(el), isBody, key: isBody ? 'body' : (el.id || el.outerHTML.slice(0, 40)) };
    });
    if (!stop.inside && !stop.isBody) { leaked = true; break; }
    if (stop.isBody) { sinceWrap++; maxBodyPerWrap = Math.max(maxBodyPerWrap, sinceWrap); }
    else {
      // landing on the real element resets the count, including the very first sighting: a
      // dialog with only one focusable control naturally wraps [control, body, control, body, …],
      // which is one body stop per wrap and must not be counted as "never reset" (the bug: the
      // first-sighting branch used to skip the reset, so a one-control dialog always failed).
      if (firstKey === null) firstKey = stop.key;
      if (stop.key === firstKey) sinceWrap = 0;
    }
  }
  check(`${register}: Tab never leaves the open dialog onto real page content`, !leaked);
  check(`${register}: at most one transient body stop per wrap, never stuck`, maxBodyPerWrap <= 1, `${maxBodyPerWrap} in a row`);

  // Escape closes it, and focus returns to the opener
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  const after = await p.evaluate(() => ({
    open: document.querySelector('#ask dialog').open,
    active: document.activeElement.getAttribute('data-sg-dialog'),
  }));
  check(`${register}: Escape closes the dialog`, after.open === false);
  check(`${register}: focus returns to the opener`, after.active === 'ask', JSON.stringify(after));

  // click on the dimmed fill outside the card closes it
  await p.click('a[data-sg-dialog="confirm"]');
  await p.waitForTimeout(150);
  await p.mouse.click(4, 4);
  await p.waitForTimeout(150);
  check(`${register}: clicking outside the card closes the dialog`, await p.evaluate(() => !document.querySelector('#confirm dialog').open));

  // reachability: the reading paragraph cannot take focus while the dialog is modal (every register)
  await p.click('a[data-sg-dialog="ask"]');
  await p.waitForTimeout(150);
  check(`${register}: the body copy behind the dialog is blocked from focus while it is modal`, await isBlockedByModal(p, REGION));

  // legibility: warm/playful claim the text stops READING as text, not only that it's unreachable.
  // Quiet never makes that claim (a plain dimmed backdrop, no Carepa), so it is exempted here on
  // purpose, not skipped by accident — its own screenshot already shows the dim, faintly-legible look.
  if (register !== 'quiet') {
    const openMap = await edgeMap(p, REGION);
    const corr = edgeCorrelation(baselineMap, openMap);
    check(`${register}: the body copy's letterforms no longer correlate with the open-page baseline`, corr < 0.3,
      `edge-map correlation ${corr.toFixed(2)} against the legible baseline (>=0.3 means the same letters are still sitting there)`);
  }
  await p.keyboard.press('Escape');

  check(`${register}: no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// the no-JS path: the opener is a real, reachable link
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(`${server.url}/packages/components/dialog/demo.html`);
  await p.click('a[data-sg-dialog="ask"]');
  await p.waitForLoadState();
  check('no JavaScript: the opener navigates to a real page, nothing is unreachable', p.url().includes('no-js.html'));
  await ctx.close();
}

// reduced motion: the playful skin's landing press never animates
{
  const { ctx, p, errors } = await page({ reduced: true, register: 'playful' });
  await p.click('a[data-sg-dialog="ask"]');
  await p.waitForTimeout(150);
  const anims = await p.evaluate(() => document.querySelector('#ask .sg-dialog-card').getAnimations().length);
  check('reduced motion: the card lands with nothing animating', anims === 0, `${anims} animation(s)`);
  check('reduced motion: no console or page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
