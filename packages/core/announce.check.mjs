// Browser check for announce(): it hears what a screen reader would, by instrumenting both paths.
//
//   node packages/core/announce.check.mjs                      (chromium)
//   SG_ENGINE=webkit node packages/core/announce.check.mjs     (or firefox)
//   node packages/core/announce.check.mjs --break              (announce() replaced by a no-op:
//                                                               the checks that listen must FAIL)
//
// A screen reader cannot be run here, so the instrument is what one is told:
//   - the ariaNotify path: Document and Element .ariaNotify are replaced by recorders, so we see
//     exactly what the engine would be asked to say, and with which priority;
//   - the region path: ariaNotify is removed, and a MutationObserver records every non-empty
//     text a [data-sg-announcer] region takes, which is what a live region speaks.
// "Three presses in a second" is driven inside the page, 80 ms apart, so it is the same on every engine.

import { harness } from '../../tools/lib/component-check.mjs';
import { sidewaysScroll } from '../../tools/lib/overflow.mjs';

const BREAK = process.argv.includes('--break');
const DEMO = '/packages/core/announce.demo.html';
const { browser, engine, check, open, axe, done, server } = await harness();

// what each path hears: installed before the page's own scripts
const HEARD = `
  window.__heard = [];      // [text, priority, where] from ariaNotify
  window.__spoken = [];     // [text, role, aria-live, parent tag] from a live region
  new MutationObserver(() => {
    for (const r of document.querySelectorAll('[data-sg-announcer]')) {
      const t = r.textContent;
      if (t && window.__lastRegionText?.get(r) !== t) { (window.__lastRegionText ??= new WeakMap()).set(r, t); window.__spoken.push([t, r.getAttribute('role'), r.getAttribute('aria-live'), r.parentElement.tagName]); }
      if (!t) (window.__lastRegionText ??= new WeakMap()).delete(r);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });
`;
const NO_NATIVE = `${HEARD}
  delete Document.prototype.ariaNotify; delete Element.prototype.ariaNotify;
  Object.defineProperty(Document.prototype, 'ariaNotify', { value: undefined, configurable: true });
  Object.defineProperty(Element.prototype, 'ariaNotify', { value: undefined, configurable: true });`;
const RECORDER = `${HEARD}
  const rec = where => function (text, opts) { window.__heard.push([text, opts && opts.priority, where]); };
  Object.defineProperty(Document.prototype, 'ariaNotify', { value: rec('document'), configurable: true, writable: true });
  Object.defineProperty(Element.prototype, 'ariaNotify', { value: rec('element'), configurable: true, writable: true });`;

async function page(init, { width = 1280, errors = [] } = {}) {
  const { contextOptions } = await import('../../tools/lib/engine.mjs');
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width, height: 900 } }));
  if (init) await ctx.addInitScript(init);
  if (BREAK) await ctx.route('**/packages/core/announce.js', r => r.fulfill({ contentType: 'text/javascript', body: 'export const announce = () => false; export const flushAnnouncements = () => {};' }));
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${server.url}${DEMO}`);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  return { ctx, p, errors };
}
/** n presses of a button, gapMs apart, all inside the page. */
const press = (p, id, n, gapMs = 80) => p.evaluate(async ([id, n, gap]) => { for (let i = 0; i < n; i++) { document.getElementById(id).click(); await new Promise(r => setTimeout(r, gap)); } }, [id, n, gapMs]);
const wait = (p, ms) => p.waitForTimeout(ms);
const regionInfo = p => p.evaluate(() => [...document.querySelectorAll('[data-sg-announcer]')].map(r => {
  const b = r.getBoundingClientRect(), cs = getComputedStyle(r);
  return { kind: r.dataset.sgAnnouncer, role: r.getAttribute('role'), live: r.getAttribute('aria-live'), atomic: r.getAttribute('aria-atomic'), w: b.width, h: b.height, parent: r.parentElement.tagName, clip: cs.clipPath, text: r.textContent, hasStyleAttrText: r.getAttribute('style') };
}));

// ── 1. the region path: no ariaNotify in the engine ─────────────────────
{
  const { ctx, p, errors } = await page(NO_NATIVE);
  check('region path: ariaNotify really is absent in this run (the instrument)', await p.evaluate(() => typeof document.ariaNotify !== 'function' && typeof document.body.ariaNotify !== 'function'));
  check('region path: nothing exists before the first announcement beyond the page itself', (await regionInfo(p)).length === 0);

  await press(p, 'more', 3);           // 2 -> 5 people in about 240 ms
  const hadRegion = (await regionInfo(p)).length;
  await wait(p, 700);
  const spoken = await p.evaluate(() => window.__spoken);
  check('region path: three quick presses are spoken once, as the last total', spoken.length === 1 && spoken[0][0] === '5 people, ₹7,500', JSON.stringify(spoken));
  check('region path: spoken by a polite status region in the body', spoken[0]?.[1] === 'status' && spoken[0]?.[2] === 'polite' && spoken[0]?.[3] === 'BODY', JSON.stringify(spoken[0]));
  check('region path: the region existed before its first words (a beat in the page first)', hadRegion === 1, `regions at the end of the presses: ${hadRegion}`);
  const info = await regionInfo(p);
  check('region path: one region, visually hidden (1 px, clipped) and atomic', info.length === 1 && info[0].w <= 1.01 && info[0].h <= 1.01 && info[0].clip.startsWith('inset') && info[0].atomic === 'true', JSON.stringify(info));

  await press(p, 'less', 1); await wait(p, 600);
  check('region path: the second burst reuses the same region, still one', (await regionInfo(p)).length === 1);
  check('region path: and says 4 people, ₹6,000', (await p.evaluate(() => window.__spoken)).at(-1)?.[0] === '4 people, ₹6,000');

  check('region path: assertive only when asked: no alert region yet', !(await regionInfo(p)).some(r => r.role === 'alert'));
  await press(p, 'taken', 1, 0); await wait(p, 600);
  const after = await regionInfo(p);
  const alert = (await p.evaluate(() => window.__spoken)).find(s => s[1] === 'alert');
  check('region path: asked, it is spoken by a separate assertive alert region', after.length === 2 && alert?.[0] === 'That slot was just taken. Pick another.' && alert?.[2] === 'assertive', JSON.stringify(alert));

  const v = await axe(p);
  check('axe, region path, closed page: 0 violations', !v.length, v.join('; '));
  check('region path: no console or page errors', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── 2. the ariaNotify path: the engine's own API, recorded ──────────────
{
  const { ctx, p, errors } = await page(RECORDER);
  await press(p, 'more', 3);
  await wait(p, 700);
  const heard = await p.evaluate(() => window.__heard);
  check('ariaNotify path: three quick presses ask the engine to say one thing, the last total', heard.length === 1 && heard[0][0] === '5 people, ₹7,500', JSON.stringify(heard));
  check('ariaNotify path: asked of the element that changed, at normal priority', heard[0]?.[1] === 'normal' && heard[0]?.[2] === 'element', JSON.stringify(heard[0]));
  check('ariaNotify path: no hidden live region was made at all', (await regionInfo(p)).length === 0);
  await press(p, 'taken', 1, 0); await wait(p, 600);
  const last = (await p.evaluate(() => window.__heard)).at(-1);
  check('ariaNotify path: assertive goes as high priority', last?.[0] === 'That slot was just taken. Pick another.' && last?.[1] === 'high', JSON.stringify(last));
  check('ariaNotify path: no console or page errors', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── 3. inside a modal dialog the rest of the page is inert ──────────────
{
  const { ctx, p } = await page(NO_NATIVE);
  await p.click('#open');
  await press(p, 'dmore', 2);
  await wait(p, 700);
  const spoken = await p.evaluate(() => window.__spoken);
  const info = await regionInfo(p);
  check('dialog: a sentence from inside the open dialog is spoken from a region inside it', spoken.at(-1)?.[0] === '2 extra, ₹3,000' && spoken.at(-1)?.[3] === 'DIALOG', JSON.stringify(spoken));
  // an async result has no sender: with a modal open, its words must still land inside the modal
  await p.evaluate(async () => { const { announce } = await import('/packages/core/announce.js'); announce('Saving failed. Try again.'); });
  await wait(p, 700);
  const noFrom = (await p.evaluate(() => window.__spoken)).at(-1);
  check('dialog: a sentence with no sender, while a modal is open, is spoken from a region inside the modal', noFrom?.[0] === 'Saving failed. Try again.' && noFrom?.[3] === 'DIALOG', JSON.stringify(noFrom));
  // a sender inside a component's shadow tree, inside the modal
  await p.evaluate(async () => {
    const host = document.createElement('div'); document.getElementById('dlg').append(host);
    const root = host.attachShadow({ mode: 'open' }); root.innerHTML = '<button type="button">x</button>';
    const { announce } = await import('/packages/core/announce.js');
    announce('From a shadow tree', { from: root.querySelector('button') });
  });
  await wait(p, 700);
  const shadow = (await p.evaluate(() => window.__spoken)).at(-1);
  check('dialog: a sender inside a shadow root in the modal still gets a region in the modal', shadow?.[0] === 'From a shadow tree' && shadow?.[3] === 'DIALOG', JSON.stringify(shadow));
  // an assertive error repeated (a retry that fails again) is heard both times
  const before = (await p.evaluate(() => window.__spoken)).length;
  for (let i = 0; i < 2; i++) { await p.evaluate(async () => { const { announce } = await import('/packages/core/announce.js'); announce('Still could not save', { priority: 'assertive', from: document.getElementById('dmore') }); }); await p.waitForFunction(n => window.__spoken.length > n, before + i, { timeout: 8000 }).catch(() => {}); }
  const again = (await p.evaluate(() => window.__spoken)).slice(before).filter(x => x[0] === 'Still could not save');
  check('assertive: the same error twice in a row is spoken twice', again.length === 2, JSON.stringify(again));
  const v = await axe(p);
  check('axe, region path, dialog open: 0 violations', !v.length, v.join('; '));
  check('dialog: closing and announcing outside again goes back to the body region', await (async () => {
    await p.click('#close'); await press(p, 'less', 1); await wait(p, 600);
    return (await p.evaluate(() => window.__spoken)).at(-1)?.[3] === 'BODY';
  })(), JSON.stringify(info.map(r => r.parent)));
  await wait(p, 5500);
  check('the region is emptied a few seconds after it speaks (no stray text for someone browsing)', await p.evaluate(() => [...document.querySelectorAll('[data-sg-announcer]')].every(r => r.textContent === '')));
  await ctx.close();
}

// ── 3b. a strict style CSP: the region is hidden with the CSSOM, never a style attribute ──
{
  const { contextOptions } = await import('../../tools/lib/engine.mjs');
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 800, height: 600 } }));
  await ctx.addInitScript(NO_NATIVE);
  const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'";
  const BODY = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>csp</title><meta http-equiv="Content-Security-Policy" content="${CSP}"></head><body><main>hello</main><script type="module">import { announce } from "/packages/core/announce.js"; announce("2 people, ₹3,000"); window.__ready = true;</script></body></html>`;
  await ctx.route('**/__check/csp.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: BODY }));
  const p = await ctx.newPage();
  const violations = [];
  await p.exposeFunction('__violation', d => violations.push(d));
  await p.addInitScript(() => document.addEventListener('securitypolicyviolation', e => window.__violation(e.violatedDirective)));
  await p.goto(`${server.url}/__check/csp.html`);
  await p.waitForFunction(() => window.__ready === true);
  await wait(p, 500);
  // the control: this CSP really does block an inline style attribute
  await p.evaluate(() => { const d = document.createElement('div'); d.setAttribute('style', 'color: red'); document.body.append(d); });
  await wait(p, 200);
  const info = await regionInfo(p);
  check('strict style CSP: the control (a style attribute set by script) is blocked, so the policy is live', violations.length >= 1 || engine !== 'chromium', JSON.stringify(violations));
  check('strict style CSP: the announcer region is still 1 px and clipped, with no violation of its own', info.length === 1 && info[0].w <= 1.01 && info[0].clip.startsWith('inset') && info[0].text === '2 people, ₹3,000' && violations.length <= 1, JSON.stringify({ info, violations }));
  await ctx.close();
}

// ── 4. the engine as it comes: whichever path it has, it must work ──────
{
  const { ctx, p, errors } = await page(HEARD);
  const native = await p.evaluate(() => typeof document.ariaNotify === 'function');
  await press(p, 'more', 3); await wait(p, 700);
  const regions = await regionInfo(p), spoken = await p.evaluate(() => window.__spoken);
  check(`as shipped (${engine}, native ariaNotify: ${native}): ${native ? 'no region is made, the engine speaks' : 'one region speaks the last total'}`, native ? regions.length === 0 : spoken.length === 1 && spoken[0][0] === '5 people, ₹7,500', JSON.stringify({ regions: regions.length, spoken }));
  const v = await axe(p);
  check('axe, as shipped: 0 violations', !v.length, v.join('; '));
  check('as shipped: no console or page errors', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── 5. phone width ──────────────────────────────────────────────────────
{
  const { ctx, p } = await page(NO_NATIVE, { width: 390 });
  const { overflow: over } = await sidewaysScroll(p);
  check('phone width (390): the page does not scroll sideways, and the region adds no width', over <= 0, `overflow ${over}`);
  await ctx.close();
}

if (BREAK) console.log('(--break: the listening checks above must have failed; the run exits non-zero)');
await done();
