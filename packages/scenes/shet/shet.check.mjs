// Browser checks for Shet that a Node test cannot reach:
//
//   node packages/scenes/shet/shet.check.mjs
//
// 1. the still is the plate's ripening gold: quiet and warm under reduced
//    motion paint the same field (control: the running year two seconds in is
//    a different field);
// 2. progress holds the year: the canvas is unchanged over three seconds, and
//    the status says how far (control: with no progress the canvas changes);
// 3. the calm zone: under the page's words the field holds still between two
//    moments (control: the same boxes with no words change);
// 4. playful: Enter sends a gust that swings the wind round;
// 5. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors;
// 6. a scape: the still never loads year.js, and with it unreachable warm
//    still shows the finished still (controls: the running year loads it and
//    moves on).

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=shet&${q}`;
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 40000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 40 s'); await h.done(); });
  return r;
};
const grab = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const s = 2, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), px = new Array(w * hh * 3);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; px[o] = d[i]; px[o + 1] = d[i + 1]; px[o + 2] = d[i + 2]; }
  const el = window.__piece, st = el.shadowRoot.querySelector('.stage').getBoundingClientRect(), k = 1200 / st.width;
  const words = [...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - st.left) * k, y: (r.top - st.top) * k, w: r.width * k, h: r.height * k }; });
  return { w, h: hh, kx: 1200 / w, ky: 800 / hh, px, words, local: el.shadowRoot.querySelector('.stage').dataset.local };
});
async function frozen(q) {
  const { ctx, page } = await h.open(scene(q));
  await page.waitForFunction(() => window.__frozen === true, null, { timeout: 120000 });
  const img = await grab(page);
  await ctx.close();
  return img;
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

// 2. progress holds the year
{
  const held = await open('/packages/scenes/shet/demo.html?register=warm&content=0&progress=0.5');
  // a scape shows its still until the turning year lands: wait for the held month itself, then time the hold
  const t0 = Date.now();
  await held.page.waitForFunction(() => Math.abs(window.__piece.shadowRoot.querySelector('.stage').dataset.local - 40) < 0.02, null, { timeout: 20000 });
  const landed = Date.now() - t0;
  await held.page.waitForTimeout(500);
  const a = await grab(held.page); await held.page.waitForTimeout(3000); const b = await grab(held.page);
  const said = await held.page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent);
  check('progress=0.5: the canvas is unchanged over three seconds', diff(a, b, undefined, 0) === 0, `${pct(diff(a, b, undefined, 0))} changed`);
  check('progress=0.5: the status says how far through the year', said === 'Season progress: 50% done', `"${said}"`);
  console.log(`  (the held month was drawn ${landed} ms after sg-ready; until then, bare paper for a month before the still's, the still for one after)`);
  await held.ctx.close();
  const free = await open('/packages/scenes/shet/demo.html?register=warm&content=0');
  await free.page.waitForTimeout(1500);
  const c = await grab(free.page); await free.page.waitForTimeout(3000); const d = await grab(free.page);
  // early in April only the heat shimmer and the clouds move, so count any change, as the held check does
  check('control: with no progress, the same canvas changes over three seconds', diff(c, d, undefined, 0) > 0.01, `${pct(diff(c, d, undefined, 0))} changed`);
  await free.ctx.close();
}

// 3. under the words the field holds still (warm, 40.2 s and 40.7 s: flooded and green, both inside one six-second step)
{
  const w1 = await frozen('register=warm&freeze=40.2&content=1'), w2 = await frozen('register=warm&freeze=40.7&content=1');
  const b1 = await frozen('register=warm&freeze=40.2'), b2 = await frozen('register=warm&freeze=40.7');
  const avg = (a, b) => w1.words.reduce((m, box) => m + diff(a, b, box, 20), 0) / w1.words.length;
  const under = avg(w1, w2), bare = avg(b1, b2), rest = diff(w1, w2, { x: 650, y: 250, w: 500, h: 500 }, 20);
  check('calm: under the words nothing moves while the field moves elsewhere', under < 0.001 && rest > 0.01, `${pct(under)} under the words, ${pct(rest)} elsewhere`);
  check('control: the same boxes with no words do change', bare > 0.01, pct(bare));
}

// 4. playful: Enter sends a gust that swings the wind
{
  const { ctx, page, errors } = await open('/packages/scenes/shet/demo.html?register=playful&content=0');
  await page.waitForTimeout(1500);
  const wind = () => page.evaluate(() => Number(window.__piece.shadowRoot.querySelector('.stage').dataset.wind));
  const stage = page.locator('sg-scene').locator('.stage');
  await stage.focus();
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(300);
  const before = await wind();
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
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
  /** Open with the year's files watched (and, with block, never answered), and grab once settled. */
  const visit = async (q, { block = false, reduced = false, render = null } = {}) => {
    const ctx = await h.browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const asked = [];
    ctx.on('request', r => { if (LAZY.test(r.url())) asked.push(r.url().split('/').pop()); });
    if (block) await ctx.route(LAZY, r => r.abort());
    if (render) await ctx.route('**/packages/scenes/shet/render.js*', r => r.fulfill({ contentType: 'text/javascript', body: render }));
    const page = await ctx.newPage();
    await page.goto(`${h.server.url}${scene(q)}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 40000 });
    await page.waitForTimeout(2500);
    if (!block && !reduced && !/quiet/.test(q)) await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.local !== '61.00', null, { timeout: 20000 }).catch(() => {});
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
    const { readFileSync } = await import('node:fs');
    const cond = '(early && data.held && data.local < STILL_AT)', body = readFileSync(new URL('./render.js', import.meta.url), 'utf8');
    if (!body.includes(cond)) check('control: the patch applies', false, 'render.js changed');
    const old = await visit('register=warm&progress=0.2', { block: true, render: body.replace(cond, 'false') });
    check('control: a build that shows the ripe still for progress=0.2 is caught', !(uniform(old.img) > 0.99 && diff(quiet.img, old.img) > 0.5), `${pct(uniform(old.img))} one colour, ${pct(diff(quiet.img, old.img))} from the still`);
  }
  check('control: progress=0.9 (a later month than the still) may show the still meanwhile', diff(quiet.img, heldLate.img, undefined, 6) < 0.002, `${pct(diff(quiet.img, heldLate.img, undefined, 6))} from the still`);

  // a resize rebuilds the still's layers before the year's: no frame may draw a year layer that is not there yet
  const resized = async renderSource => {
    const ctx = await h.browser.newContext({ viewport: { width: 1280, height: 900 } }), errors = [];
    if (renderSource) await ctx.route('**/packages/scenes/shet/render.js*', r => r.fulfill({ contentType: 'text/javascript', body: renderSource }));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e).slice(0, 90)));
    await page.goto(`${h.server.url}${scene('register=warm')}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 40000 });
    await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.local !== '61.00', null, { timeout: 20000 }).catch(() => {});
    for (const w of [900, 1280, 700, 1100]) { await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(600); }
    await ctx.close();
    return errors;
  };
  const now = await resized();
  check('scape: resizing a running year raises no errors', now.length === 0, now.join(' | ') || 'none');
  // control: a build whose rebuild forgets that the year's layers went with it (the first split's bug, in another form)
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('./render.js', import.meta.url), 'utf8'), from = 'function start() { built = false; yearBuilt = false; yearBuilder = null;';
  if (!src.includes(from)) check('control: the patch applies', false, 'start() changed; update the control');
  const old = await resized(src.replace(from, 'function start() { built = false; yearBuilder = null;'));
  check('control: a rebuild that keeps believing the year is painted is caught', old.length > 0, old[0] || 'no error');
}

for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/shet/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
