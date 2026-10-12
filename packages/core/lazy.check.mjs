// Browser check for <sg-lazy> (decision 0024):
//
//   node packages/core/lazy.check.mjs
//
// Every case runs under a strict Content-Security-Policy (style-src 'self') and must raise no violation.
//   far below the fold   the poster is up and nothing of the engine or the scene has been fetched; scrolled
//                        near, the scene loads, draws and the poster is hidden (the control: this is what
//                        "fetched" looks like, so the held cases below can fail)
//   held, in view        reduced motion, Save-Data, the quiet register, a 1 GB device: after the page has
//                        settled the poster is still the only picture, nothing was fetched, and data-hold
//                        says why; start() then loads and plays it, start({ play: false }) only draws it
//   a hold that lifts    quiet to warm at run time: the scene starts
//   a scene that fails   a bad src leaves the poster, state "failed", no uncaught error
//   no JavaScript        at 390 px with lazy.css linked, the poster fits and keeps its shape and the scene is hidden;
//                        without the link it overflows (the control)

import { pickEngine } from '../../tools/lib/engine.mjs';
import { startServer } from '../../tools/serve.mjs';
import { sidewaysScroll } from '../../tools/lib/overflow.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const HEAVY = /\/packages\/(engine\/|scenes\/kolam\/|core\/index\.js|core\/scene-element\.js)/;

const POSTER = '<picture><img src="/apps/docs/og.jpg" width="1200" height="630" alt="A poster" decoding="async"></picture>';
const lazy = (attrs = '', src = '/packages/scenes/kolam/index.js') => `<sg-lazy src="${src}" ${attrs}>${POSTER}<sg-scene name="kolam" hidden></sg-scene></sg-lazy>`;

async function open(contextOptions = {}, init = null) {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 }, ...contextOptions });
  const page = await context.newPage();
  const seen = { heavy: [], errors: [], violations: [] };
  page.on('request', r => { if (HEAVY.test(new URL(r.url()).pathname)) seen.heavy.push(new URL(r.url()).pathname); });
  page.on('pageerror', e => seen.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' ) seen.errors.push(m.text()); });
  await page.route('**/tools/harness/blank.html', async route => {
    const r = await route.fetch();
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-security-policy': "style-src 'self'" } });
  });
  await page.addInitScript(() => { window.__v = []; document.addEventListener('securitypolicyviolation', e => window.__v.push(`${e.violatedDirective}: ${e.blockedURI || 'inline'}`)); });
  if (init) await page.addInitScript(init);
  await page.goto(`${server.url}/tools/harness/blank.html`);
  // `heights` sizes elements by id from script before lazy.js loads: a style attribute would itself be a CSP violation, and the element must not be in view for even a frame
  const mount = async (html, heights = {}) => { await page.evaluate(async ([h, hs]) => { document.body.innerHTML = h; for (const [id, px] of Object.entries(hs)) document.getElementById(id).style.height = `${px}px`; await import('/packages/core/lazy.js'); }, [html, heights]); };
  const state = () => page.evaluate(() => { const l = document.querySelector('sg-lazy'); return { state: l.dataset.state, hold: l.dataset.hold ?? null, canvases: l.querySelector('sg-scene')?.shadowRoot?.querySelectorAll('.stage canvas').length ?? 0, hidden: l.querySelector('sg-scene')?.hidden, pic: getComputedStyle(l.querySelector('picture')).visibility }; });
  const finish = async () => { seen.violations = await page.evaluate(() => window.__v); await context.close(); return seen; };
  return { page, seen, mount, state, finish };
}
const waitFor = (page, fn, arg, ms = 12000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);

// ── far below the fold, then scrolled near ───────────────────────────
{
  const t = await open();
  await t.mount(`<div id="a"></div>${lazy()}<div id="b"></div>`, { a: 4000, b: 800 });
  await t.page.waitForTimeout(1500);
  let s = await t.state();
  check('below the fold: the poster is up and the scene stays unfetched', s.state === 'poster' && s.hidden === true && t.seen.heavy.length === 0 && s.pic === 'visible', `${JSON.stringify(s)}, ${t.seen.heavy.length} heavy requests`);
  await t.page.evaluate(() => document.querySelector('sg-lazy').scrollIntoView());
  const live = await waitFor(t.page, () => document.querySelector('sg-lazy').dataset.state === 'live');
  s = await t.state();
  check('scrolled near: the scene is fetched, draws once, and the poster steps aside', live && s.canvases >= 1 && s.hidden === false && t.seen.heavy.some(u => u.includes('/scenes/kolam/')) && t.seen.heavy.some(u => u.includes('/engine/')), `${JSON.stringify(s)}, ${t.seen.heavy.length} heavy requests`);
  await t.page.waitForTimeout(500);
  s = await t.state();
  check('live: the poster is hidden from sight and from the accessibility tree', s.pic === 'hidden', s.pic);
  const seen = await t.finish();
  check('below the fold: no CSP violation, no error', seen.violations.length === 0 && seen.errors.length === 0, [...seen.violations, ...seen.errors].join(' | '));
}

// ── held cases ────────────────────────────────────────────────────────
const HELD = [
  ['reduced motion', { reducedMotion: 'reduce' }, null, '', 'reduced-motion'],
  ['Save-Data', {}, () => Object.defineProperty(navigator, 'connection', { value: { saveData: true, addEventListener() {}, removeEventListener() {} }, configurable: true }), '', 'save-data'],
  ['a 1 GB device', {}, () => Object.defineProperty(navigator, 'deviceMemory', { value: 1, configurable: true }), '', 'low-memory'],
  ['the quiet register', {}, null, 'register="quiet"', 'quiet'],
];
for (const [label, opts, init, attrs, reason] of HELD) {
  const t = await open(opts, init);
  await t.mount(lazy(attrs));
  await t.page.waitForTimeout(1800); // in view, loaded: the moment it would have started
  let s = await t.state();
  check(`${label}: in view, loaded, and still the poster only (held for "${reason}")`, s.state === 'poster' && s.hold === reason && s.hidden === true && s.canvases === 0 && t.seen.heavy.length === 0 && s.pic === 'visible', `${JSON.stringify(s)}, ${t.seen.heavy.length} heavy requests`);
  const ok = await t.page.evaluate(() => document.querySelector('sg-lazy').start());
  s = await t.state();
  const wanted = await t.page.evaluate(() => document.querySelector('sg-lazy sg-scene').wanted);
  await t.page.waitForTimeout(600); // the fade, and the poster leaving the accessibility tree after it
  s = await t.state();
  check(`${label}: start() loads and plays it for a viewer who asks, and the poster steps aside`, ok === true && s.state === 'live' && s.canvases >= 1 && wanted === true && t.seen.heavy.length > 0 && s.pic === 'hidden', `${JSON.stringify(s)}, wanted ${wanted}`);
  const seen = await t.finish();
  check(`${label}: no CSP violation, no error`, seen.violations.length === 0 && seen.errors.length === 0, [...seen.violations, ...seen.errors].join(' | '));
}

// ── look closer, not play ────────────────────────────────────────────
{
  const t = await open({ reducedMotion: 'reduce' });
  await t.mount(lazy());
  await t.page.waitForTimeout(1200);
  const ok = await t.page.evaluate(() => document.querySelector('sg-lazy').start({ play: false }));
  const s = await t.state();
  const wanted = await t.page.evaluate(() => document.querySelector('sg-lazy sg-scene').wanted);
  check('reduced motion: start({ play: false }) draws the scene as its still and does not play it', ok === true && s.state === 'live' && s.canvases >= 1 && wanted === false, `${JSON.stringify(s)}, wanted ${wanted}`);
  await t.finish();
}

// ── a hold that lifts ────────────────────────────────────────────────
{
  const t = await open();
  await t.mount(lazy('register="quiet"'));
  await t.page.waitForTimeout(1200);
  const held = (await t.state()).state === 'poster' && t.seen.heavy.length === 0;
  await t.page.evaluate(() => document.querySelector('sg-lazy').setAttribute('register', 'warm'));
  const live = await waitFor(t.page, () => document.querySelector('sg-lazy').dataset.state === 'live');
  const s = await t.state();
  check('quiet then warm at run time: held first, then the scene starts by itself', held && live && s.hold === null && s.canvases >= 1, JSON.stringify(s));
  await t.finish();
}

// ── a scene that fails ───────────────────────────────────────────────
{
  const t = await open();
  await t.mount(lazy('', '/packages/scenes/does-not-exist/index.js'));
  const failed = await waitFor(t.page, () => document.querySelector('sg-lazy').dataset.state === 'failed');
  const s = await t.state();
  check('a src that fails leaves the poster up, the scene hidden, and no uncaught error', failed && s.hidden === true && s.pic === 'visible' && t.seen.errors.filter(e => !/Failed to load|404|does-not-exist|module/i.test(e)).length === 0, `${JSON.stringify(s)} ${t.seen.errors.join(' | ')}`);
  await t.finish();
}

// ── no JavaScript, on a phone ────────────────────────────────────────
// A stranger's page: the markup from lazy.docs.md and the linked lazy.css, nothing of ours in the page's own CSS.
// Without the stylesheet the poster keeps the size of its attributes and the page scrolls sideways; the second
// page is that control, so the check can tell the difference.
for (const [label, linked] of [['with lazy.css linked', true], ['control, without it', false]]) {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const head = linked ? '<link rel="stylesheet" href="/packages/core/lazy.css">' : '';
  await page.route('**/tools/harness/blank.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width"><title>x</title>${head}<body>${lazy()}</body>` }));
  await page.goto(`${server.url}/tools/harness/blank.html`);
  await page.waitForLoadState('load');
  const o = await sidewaysScroll(page);
  const m = { scroll: o.scrollWidth, inner: o.viewWidth, ...(await page.evaluate(() => { const i = document.querySelector('sg-lazy img').getBoundingClientRect(); return { w: Math.round(i.width), h: Math.round(i.height) }; })) };
  const sceneBox = await page.locator('sg-scene').boundingBox();
  const fits = m.scroll <= m.inner && m.w <= m.inner;
  if (linked) check(`no JavaScript at 390 px, ${label}: the poster fits (no sideways scroll, scale kept) and the scene is not shown`, fits && Math.abs(m.w / m.h - 1200 / 630) < 0.02 && sceneBox === null, JSON.stringify(m));
  else check(`no JavaScript at 390 px, ${label}: the poster overflows (the control that can fail)`, !fits, JSON.stringify(m));
  await context.close();
}

await browser.close(); await server.close();
if (results.some(r => !r.ok)) process.exit(1);
