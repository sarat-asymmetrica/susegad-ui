// Browser checks for Shet that a Node test cannot reach:
//
//   node packages/scenes/shet/shet.check.mjs
//   node packages/scenes/shet/shet.check.mjs --break   (planted faults: the checks marked --break must FAIL)
//
// 1. the still is the plate's ripening gold: quiet and warm under reduced
//    motion paint the same field (control: the running year two seconds in is
//    a different field);
// 2. progress holds the year: the canvas is unchanged over three seconds
//    (--break: the model ignores progress), and the status says
//    how far (control: with no progress the canvas changes);
// 3. the calm zone: under the page's words the field holds still between two
//    moments (control: the same boxes with no words change; --break: the calm
//    zone is never held);
// 4. playful: Enter sends a gust that swings the wind round (--break: Enter
//    does nothing);
// 5. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors;
// 6. a scape: the still never loads year.js, and with it unreachable warm
//    still shows the finished still (controls: the running year loads it and
//    moves on).
//
// Scene time is stepped, not waited for. The pages that move run on virtual
// frames (virtualFrames below): each step is a sixtieth of a second of the
// scene's time, drawn as fast as the page can draw it. A frozen moment is the
// same pixels the real clock gives (12 October: 0 channels differ at 2 s and at
// 40.2 s). On the real clock still: the stills (nothing moves), "no request
// leaves the page" and the still's "never loads year.js" (both watch the
// network), and axe.

import { readFileSync } from 'node:fs';
import { harness } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';

const BREAK = process.argv.includes('--break');
const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=shet&${q}`;
/** One of Shet's files with `from` replaced, for a control or a --break fault; fails loudly if the line has moved. */
const patched = (from, to, file = 'render.js') => {
  const src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
  if (!src.includes(from)) check(`the patch applies (${from.slice(0, 48)})`, false, `${file} changed; update the patch`);
  return src.replace(from, to);
};
const serve = (body, file = 'render.js') => [[`**/packages/scenes/shet/${file}*`, r => r.fulfill({ contentType: 'text/javascript', body })]];

// Virtual frames, the idea of tools/lib/browser.mjs's hold script: requestAnimationFrame callbacks
// queue and run only when the check steps them, each step 1/60 s of rAF time, with a message-channel
// settle between steps so promises, the network and module loads still land. The harness's ?freeze
// clock advances once per step just as it does once per real frame, so ?freeze=t is the same picture.
function virtualFrames() {
  const caf = window.cancelAnimationFrame.bind(window), queued = new Map(), port = new MessageChannel();
  let id = 0, ts = 1000;
  const settle = () => new Promise(r => { port.port1.onmessage = () => r(); port.port2.postMessage(0); });
  window.requestAnimationFrame = cb => { queued.set(++id, cb); return id; };
  window.cancelAnimationFrame = i => { if (!queued.delete(i)) caf(i); };
  const one = async () => {
    const cbs = [...queued.values()];
    queued.clear(); ts += 1000 / 60; fast.frames++;
    for (const cb of cbs) try { cb(ts); } catch (e) { setTimeout(() => { throw e; }); }
    await settle();
  };
  const fast = window.__fast = {
    frames: 0,
    async step(n) { for (let i = 0; i < n; i++) await one(); },
    /** Step until the harness clock reads `t` seconds: the frame that drew t is the last one run. */
    async toTime(t) { while (!(window.__clock?.time >= t - 1e-6)) await one(); },
  };
}
const frames = (page, n) => page.evaluate(n => window.__fast.step(n), n);
/** Step frames until `cond` (a page function) holds, or `ms` of real time pass; true if it held. */
async function until(page, cond, { arg, ms = 30000, batch = 6 } = {}) {
  const t0 = Date.now();
  while (!(await page.evaluate(cond, arg))) { if (Date.now() - t0 > ms) return false; await frames(page, batch); }
  return true;
}
const context = reduced => h.browser.newContext(contextOptions(h.engine, { viewport: { width: 1280, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' }));
/** A page on virtual frames in its own context, stepped to sg-ready. `setup(ctx)` runs before it loads. */
async function load(path, { reduced = false, routes = [], setup = null } = {}) {
  const ctx = await context(reduced);
  await ctx.addInitScript(virtualFrames);
  for (const [url, handler] of routes) await ctx.route(url, handler);
  if (setup) await setup(ctx);
  const page = await ctx.newPage(), errors = [], pageErrors = [];
  page.on('pageerror', e => { errors.push(String(e)); pageErrors.push(String(e).slice(0, 90)); });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${h.server.url}${path}`);
  if (!(await until(page, () => window.__ready === true, { ms: 40000 }))) { check(`ready: ${path}`, false, 'no sg-ready in 40 s'); await h.done(); }
  return { ctx, page, errors, pageErrors };
}
/** A page on the real clock (the stills, the network and axe). */
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 40000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 40 s'); await h.done(); });
  return r;
};
// The pixels come back as base64 bytes: a plain array of 2.6 M numbers took 2.3 to 3.5 s a grab to serialise.
const pixels = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const s = 2, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), px = new Uint8Array(w * hh * 3);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; px[o] = d[i]; px[o + 1] = d[i + 1]; px[o + 2] = d[i + 2]; }
  const el = window.__piece, st = el.shadowRoot.querySelector('.stage').getBoundingClientRect(), k = 1200 / st.width;
  const words = [...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - st.left) * k, y: (r.top - st.top) * k, w: r.width * k, h: r.height * k }; });
  let bin = ''; for (let i = 0; i < px.length; i += 0x8000) bin += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
  return { w, h: hh, kx: 1200 / w, ky: 800 / hh, px: btoa(bin), words, local: el.shadowRoot.querySelector('.stage').dataset.local };
});
const grab = async page => { const g = await pixels(page); return { ...g, px: Buffer.from(g.px, 'base64') }; };
/** The frozen picture at ?freeze's moment, and before it (same page, same run) each moment of `at` on the way. */
async function frozen(q, { at = [], routes = [] } = {}) {
  const { ctx, page } = await load(scene(q), { routes });
  const imgs = [];
  for (const t of at) { await page.evaluate(t => window.__fast.toTime(t), t); imgs.push(await grab(page)); }
  if (!(await until(page, () => window.__frozen === true, { ms: 120000, batch: 30 }))) check(`frozen: ${q}`, false, 'never froze in 120 s');
  imgs.push(await grab(page));
  await ctx.close();
  return at.length ? imgs : imgs[0];
}
function diff(a, b, box = { x: 0, y: 0, w: 1200, h: 800 }, th = 40) {
  let n = 0, c = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const lx = x * a.kx, ly = y * a.ky;
    if (lx < box.x || lx > box.x + box.w || ly < box.y || ly > box.y + box.h) continue;
    const o = (y * a.w + x) * 3; n++;
    if (Math.abs(a.px[o] - b.px[o]) + Math.abs(a.px[o + 1] - b.px[o + 1]) + Math.abs(a.px[o + 2] - b.px[o + 2]) > th) c++;
  }
  return n ? c / n : 0;
}
const pct = v => `${(v * 100).toFixed(2)}%`;

// 1. the still
{
  const stillOf = async (q, opts) => { const { ctx, page } = await open(scene(q), opts); await page.waitForTimeout(400); const g = await grab(page); await ctx.close(); return g; };
  const quiet = await stillOf('register=quiet'), reduced = await stillOf('register=warm', { reduced: true });
  check('the still: quiet and warm under reduced motion paint the same ripening field', diff(quiet, reduced, undefined, 6) < 0.002, `${pct(diff(quiet, reduced, undefined, 6))} differ`);
  const early = await frozen('register=warm&freeze=2');
  check('control: two seconds into the running year, the field differs from the still', diff(quiet, early) > 0.2, `${pct(diff(quiet, early))} differ`);
}

// 2. progress holds the year (three seconds here are 180 frames of the scene's time)
{
  // --break: the model ignores progress, so the year turns on while the status still says 50%
  const held = await load('/packages/scenes/shet/demo.html?register=warm&content=0&progress=0.5',
    { routes: BREAK ? serve(patched('const held = params.progress != null;', 'const held = false;', 'model.js'), 'model.js') : [] });
  // a scape shows its still until the turning year lands: wait for the held month itself, then time the hold
  const t0 = Date.now(), f0 = await held.page.evaluate(() => window.__fast.frames);
  if (!(await until(held.page, () => Math.abs(window.__piece.shadowRoot.querySelector('.stage').dataset.local - 40) < 0.02, { ms: BREAK ? 5000 : 20000 }))) {
    check('progress=0.5: the held month is drawn', false, `not within ${BREAK ? 5 : 20} s`);
  }
  const landed = `${Date.now() - t0} ms and ${await held.page.evaluate(() => window.__fast.frames) - f0} frames`;
  await frames(held.page, 30);
  const a = await grab(held.page); await frames(held.page, 180); const b = await grab(held.page);
  const said = await held.page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent);
  check('progress=0.5: the canvas is unchanged over three seconds', diff(a, b, undefined, 0) === 0, `${pct(diff(a, b, undefined, 0))} changed`);
  check('progress=0.5: the status says how far through the year', said === 'Season progress: 50% done', `"${said}"`);
  console.log(`  (the held month was drawn ${landed} after sg-ready; until then, bare paper for a month before the still's, the still for one after)`);
  await held.ctx.close();
  const free = await load('/packages/scenes/shet/demo.html?register=warm&content=0');
  await frames(free.page, 90);
  const c = await grab(free.page); await frames(free.page, 180); const d = await grab(free.page);
  // early in April only the heat shimmer and the clouds move, so count any change, as the held check does
  check('control: with no progress, the same canvas changes over three seconds', diff(c, d, undefined, 0) > 0.01, `${pct(diff(c, d, undefined, 0))} changed`);
  await free.ctx.close();
}

// 3. under the words the field holds still (warm, 40.2 s and 40.7 s: flooded and green, both inside one six-second step)
{
  // one page per pair: 40.2 s on the way to a 40.7 s freeze is the picture ?freeze=40.2 freezes
  // --break: the calm zone is never held
  const calmFault = BREAK ? serve(patched('if (calm.length && !still) year.hold(', 'if (false) year.hold(')) : [];
  const [w1, w2] = await frozen('register=warm&freeze=40.7&content=1', { at: [40.2], routes: calmFault });
  const [b1, b2] = await frozen('register=warm&freeze=40.7', { at: [40.2] });
  const avg = (a, b) => w1.words.reduce((m, box) => m + diff(a, b, box, 20), 0) / w1.words.length;
  const under = avg(w1, w2), bare = avg(b1, b2), rest = diff(w1, w2, { x: 650, y: 250, w: 500, h: 500 }, 20);
  check('calm: under the words nothing moves while the field moves elsewhere', under < 0.001 && rest > 0.01, `${pct(under)} under the words, ${pct(rest)} elsewhere`);
  check('control: the same boxes with no words do change', bare > 0.01, pct(bare));
}

// 4. playful: Enter sends a gust that swings the wind
{
  // --break: Enter does nothing
  const { ctx, page, errors } = await load('/packages/scenes/shet/demo.html?register=playful&content=0',
    { routes: BREAK ? serve(patched('activate(p) {\n      if (!p) return;', 'activate(p) {\n      if (p) return;')) : [] });
  await frames(page, 90);
  const wind = () => page.evaluate(() => Number(window.__piece.shadowRoot.querySelector('.stage').dataset.wind));
  const stage = page.locator('sg-scene').locator('.stage');
  await stage.focus();
  await page.keyboard.press('ArrowLeft'); await frames(page, 18);
  const before = await wind();
  await page.keyboard.press('Enter'); await frames(page, 90);
  const after = await wind();
  check('playful: Enter sends a gust from the keyboard hand and the wind swings round', Math.abs(after - before) > 0.01, `wind ${before} then ${after}`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 5. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/shet/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
// 6. a scape (decision 0020): the still needs only its first sight, and the turning year loads after
{
  const LAZY = /\/scenes\/shet\/(year|year-model)\.js/;
  /**
   * Open with the year's files watched (and, with block, never answered), and grab once settled.
   * On the real clock for 2.5 s: the still (quiet, or warm under reduced motion), since "never loads" watches
   * the network; and a held month with the year blocked. On virtual frames that one never gets ready: it goes
   * to sleep (settled) in a loop tick while its layers still paint, and the frame its renderer asked for in that
   * tick is dropped (scene-element #invalidate returns while the loop plays). On the real clock its first frames
   * come in another order and it is ready in 1.2 to 2.4 s. Which order is right is core's question (reported).
   * The rest step 2.5 s of scene time, after the blocked request has failed.
   */
  const visit = async (q, { block = false, reduced = false, render = null } = {}) => {
    const asked = [], failed = [];
    const watch = async ctx => {
      ctx.on('request', r => { if (LAZY.test(r.url())) asked.push(r.url().split('/').pop()); });
      ctx.on('requestfailed', r => { if (LAZY.test(r.url())) failed.push(r.url()); });
      if (block) await ctx.route(LAZY, r => r.abort());
    };
    const routes = render ? serve(render) : [];
    let ctx, page;
    if (reduced || /quiet/.test(q) || (block && /progress/.test(q))) {
      ctx = await context(reduced);
      await watch(ctx);
      for (const [url, handler] of routes) await ctx.route(url, handler);
      page = await ctx.newPage();
      await page.goto(`${h.server.url}${scene(q)}`);
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 40000 });
      await page.waitForTimeout(2500);
    } else {
      ({ ctx, page } = await load(scene(q), { routes, setup: watch }));
      for (const t0 = Date.now(); block && !failed.length && Date.now() - t0 < 10000;) await frames(page, 6);
      await frames(page, 150);
      if (!block) await until(page, () => window.__piece.shadowRoot.querySelector('.stage').dataset.local !== '61.00', { ms: 20000 });
    }
    const img = await grab(page), local = img.local; // one evaluate: the month and the pixels of the same frame
    await ctx.close();
    return { asked: [...new Set(asked)], img, local };
  };
  const quiet = await visit('register=quiet'), reduced = await visit('register=warm', { reduced: true });
  check('scape: the still (quiet, and warm under reduced motion) never loads the turning year', !quiet.asked.length && !reduced.asked.length, `quiet ${quiet.asked.join(', ') || 'none'}; reduced ${reduced.asked.join(', ') || 'none'}`);
  const running = await visit('register=warm');
  check('control: the running year does load it', running.asked.includes('year.js') && running.asked.includes('year-model.js'), running.asked.join(', ') || 'nothing');
  const blocked = await visit('register=warm', { block: true });
  const d = diff(quiet.img, blocked.img, undefined, 6);
  check('scape: with year.js unreachable, warm still shows the finished still (first sight suffices)', blocked.local === '61.00' && d < 0.002, `month ${blocked.local}, ${pct(d)} differ from the quiet still`);
  check('control: with year.js reachable, warm has moved on from the still', running.local !== '61.00' && diff(quiet.img, running.img) > 0.2, `month ${running.local}, ${pct(diff(quiet.img, running.img))} differ`);

  // a held month earlier than the still's never shows the ripe still while the year loads: bare paper instead
  const heldEarly = await visit('register=warm&progress=0.2', { block: true }), heldLate = await visit('register=warm&progress=0.9', { block: true });
  const uniform = img => { let n = 0, same = 0; for (let i = 0; i < img.px.length; i += 3) { n++; if (Math.abs(img.px[i] - img.px[0]) + Math.abs(img.px[i + 1] - img.px[1]) + Math.abs(img.px[i + 2] - img.px[2]) < 6) same++; } return same / n; };
  check('scape: progress=0.2 with the year unreachable shows bare paper, never the ripe still', uniform(heldEarly.img) > 0.99 && diff(quiet.img, heldEarly.img) > 0.5, `${pct(uniform(heldEarly.img))} one colour, ${pct(diff(quiet.img, heldEarly.img))} from the still`);
  { // control: the first split, which showed the ripe still under any held month while it waited
    const old = await visit('register=warm&progress=0.2', { block: true, render: patched('(early && data.held && data.local < STILL_AT)', 'false') });
    check('control: a build that shows the ripe still for progress=0.2 is caught', !(uniform(old.img) > 0.99 && diff(quiet.img, old.img) > 0.5), `${pct(uniform(old.img))} one colour, ${pct(diff(quiet.img, old.img))} from the still`);
  }
  check('control: progress=0.9 (a later month than the still) may show the still meanwhile', diff(quiet.img, heldLate.img, undefined, 6) < 0.002, `${pct(diff(quiet.img, heldLate.img, undefined, 6))} from the still`);

  // a resize rebuilds the still's layers before the year's: no frame may draw a year layer that is not there yet
  const resized = async renderSource => {
    const { ctx, page, pageErrors: errors } = await load(scene('register=warm'), { routes: renderSource ? serve(renderSource) : [] });
    await until(page, () => window.__piece.shadowRoot.querySelector('.stage').dataset.local !== '61.00', { ms: 20000 });
    for (const w of [900, 1280, 700, 1100]) {
      // the canvas takes its new size in a ResizeObserver callback: wait for that, then draw 36 frames (0.6 s) on it
      const was = await page.evaluate(() => window.__piece.shadowRoot.querySelector('canvas').width);
      await page.setViewportSize({ width: w, height: 900 });
      await until(page, was => window.__piece.shadowRoot.querySelector('canvas').width !== was, { arg: was, ms: 5000 });
      await frames(page, 36);
    }
    await ctx.close();
    return errors;
  };
  const now = await resized();
  check('scape: resizing a running year raises no errors', now.length === 0, now.join(' | ') || 'none');
  // control: a build whose rebuild forgets that the year's layers went with it (the first split's bug, in another form)
  const old = await resized(patched('function start() { built = false; yearBuilt = false; yearBuilder = null;', 'function start() { built = false; yearBuilder = null;'));
  check('control: a rebuild that keeps believing the year is painted is caught', old.length > 0, old[0] || 'no error');
}

for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/shet/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

if (BREAK) console.log('\n--break: "progress=0.5: the held month is drawn", "progress=0.5: the canvas is unchanged", "calm: under the words" and "playful: Enter sends a gust" should FAIL');
await h.done();
