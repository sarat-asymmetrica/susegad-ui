// Browser checks for Kairi that a Node test cannot reach:
//
//   node packages/scenes/kairi/kairi.check.mjs
//
// 1. progress: 0.4 draws two paisleys and says "Order progress: 40% done";
//    1 draws all five, where the fifth paisley's place is plainly inked
//    (control: progress 0.4 leaves that place bare cloth);
// 2. reduced motion shows the finished border, in playful too;
// 3. the calm zone: the circle-count note never runs under the page's words
//    (control: with no text it does), while the machine clear of the words
//    keeps drawing; a machine the words overlap hushes;
// 4. playful: Enter goes on to the next paisley (control: without it the
//    border has not moved on);
// 5. no request leaves the page (control: a page with the sketchbook's Google
//    Fonts link is caught);
// 6. axe (WCAG 2.2 AA) on the demo in every register, light and dark, and no
//    console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
// a scene page sets __ready = true on sg-ready; wait for exactly that
const openReady = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 }).catch(() => check(`ready: ${path}`, false, 'no sg-ready in 20 s'));
  return r;
};
const scene = q => `/tools/harness/scene.html?name=kairi&${q}`;
const done = page => page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage').dataset.done);

/** The canvas at one moment, downsampled 4x, as [r, g, b] triples, with its size. */
async function grab(page) {
  return page.evaluate(() => {
    const cv = window.__piece.shadowRoot.querySelector('canvas'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data;
    const s = 4, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), out = new Array(w * hh * 3);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; out[o] = d[i]; out[o + 1] = d[i + 1]; out[o + 2] = d[i + 2]; }
    return { w, h: hh, kx: 1200 / w, ky: 760 / hh, px: out };
  });
}
async function frozen(q) {
  const { ctx, page, errors } = await h.open(scene(q));
  await page.waitForFunction(() => window.__frozen === true, null, { timeout: 30000 });
  const img = await grab(page);
  await ctx.close();
  return { img, errors };
}
/** Share of pixels that differ between two grabs inside a box (logical units). */
function diff(a, b, box, th = 40) {
  let n = 0, c = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const lx = x * a.kx, ly = y * a.ky;
    if (lx < box.x || lx > box.x + box.w || ly < box.y || ly > box.y + box.h) continue;
    const o = (y * a.w + x) * 3; n++;
    if (Math.abs(a.px[o] - b.px[o]) + Math.abs(a.px[o + 1] - b.px[o + 1]) + Math.abs(a.px[o + 2] - b.px[o + 2]) > th) c++;
  }
  return n ? c / n : 0;
}
/** Share of pixels in a box far from the bare cloth's own colour (the box's brightest tone). */
function inked(a, box) {
  let n = 0, c = 0; const px = [];
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const lx = x * a.kx, ly = y * a.ky;
    if (lx < box.x || lx > box.x + box.w || ly < box.y || ly > box.y + box.h) continue;
    const o = (y * a.w + x) * 3; px.push(a.px[o] + a.px[o + 1] + a.px[o + 2]);
  }
  const cloth = px.slice().sort((p, q) => q - p)[Math.floor(px.length * 0.1)];
  for (const p of px) { n++; if (cloth - p > 120) c++; }
  return n ? c / n : 0;
}
const FIFTH = { x: 1010, y: 290, w: 160, h: 200 }; // where the fifth paisley sits, from the model (cx 1080)

// 1. progress draws the border exactly that far, and says so
{
  const { ctx, page, errors } = await openReady('/packages/scenes/kairi/demo.html?register=warm&progress=0.4');
  await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent !== '', null, { timeout: 3000 }).catch(() => {});
  const said = await page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent);
  check('progress=0.4: the status says it in words', said === 'Order progress: 40% done', `"${said}"`);
  const d4 = await done(page), img4 = await grab(page);
  await page.evaluate(() => window.__piece.setAttribute('progress', '1'));
  await page.waitForTimeout(400);
  const d1 = await done(page), img1 = await grab(page);
  check('progress=0.4 draws two paisleys; progress=1 all five', d4 === '2/5' && d1 === '5/5', `${d4}, then ${d1}`);
  const full = inked(img1, FIFTH), bare = inked(img4, FIFTH);
  check('progress=1: the fifth paisley’s place is inked (over 25%)', full > 0.25, `${(full * 100).toFixed(1)}%`);
  check('control: at progress=0.4 the same place is bare cloth (under 3%)', bare < 0.03, `${(bare * 100).toFixed(1)}%`);
  check('no console errors (progress)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 2. reduced motion: the finished border, whatever the register
for (const register of ['warm', 'playful']) {
  const { ctx, page, errors } = await openReady(`/packages/scenes/kairi/demo.html?register=${register}&content=0`, { reduced: true });
  await page.waitForTimeout(300);
  const d = await done(page), share = inked(await grab(page), FIFTH);
  check(`reduced motion (${register}): the finished border`, d === '5/5' && share > 0.25, `${d}, fifth place ${(share * 100).toFixed(1)}% inked`);
  if (errors.length) check(`no console errors (reduced, ${register})`, false, errors.join(' | '));
  await ctx.close();
}

// 3. the calm zone. The harness's text panel sits bottom left, under the band: the note row
//    ("12 circles") would run under it, so the note stays away; the machine above it keeps drawing.
{
  const NOTE = { x: 0, y: 596, w: 260, h: 44 }, BAND = { x: 0, y: 236, w: 280, h: 300 };
  const a1 = await frozen('register=warm&freeze=2.2&content=1'), a2 = await frozen('register=warm&freeze=3.8&content=1');
  const b1 = await frozen('register=warm&freeze=2.2'), b2 = await frozen('register=warm&freeze=3.8');
  const calm = diff(a1.img, a2.img, NOTE), bare = diff(b1.img, b2.img, NOTE), drawing = diff(a1.img, a2.img, BAND);
  check('calm: under the page’s words the note row does not change (under 0.2%)', calm < 0.002, `${(calm * 100).toFixed(2)}% with text`);
  check('control: with no text the note counts the circles there (over 1%)', bare > 0.01, `${(bare * 100).toFixed(2)}%`);
  check('the machine clear of the words keeps drawing (over 1% change in the band)', drawing > 0.01, `${(drawing * 100).toFixed(2)}%`);
}

// 4. playful: Enter goes on to the next paisley
{
  const { ctx, page, errors } = await openReady('/packages/scenes/kairi/demo.html?register=playful&content=0');
  const stage = page.locator('sg-scene').locator('.stage');
  await stage.focus();
  await page.waitForTimeout(600);
  const before = await done(page);
  for (let k = 0; k < 4; k++) { await page.keyboard.press('Enter'); await page.waitForTimeout(250); }
  const after = await done(page);
  check('playful: Enter goes on paisley by paisley', parseInt(after) >= 2, `${before} before, ${after} after four presses`);
  check('control: before any key the border had not moved on', before === '0/5', before);
  check('playful: the drawing takes focus as an interactive drawing', (await stage.getAttribute('role')) === 'application', await stage.getAttribute('role'));
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 5. no request leaves the page
{
  const count = async open => {
    const out = [];
    const { ctx, page } = await open();
    page.on('request', r => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) out.push(u.host); });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
    await page.reload();
    await page.waitForTimeout(1500);
    await ctx.close();
    return [...new Set(out)];
  };
  const ours = await count(() => openReady('/packages/scenes/kairi/demo.html?register=playful'));
  check('no request leaves the page (the library’s own Kalam, no Google Fonts)', ours.length === 0, ours.join(', ') || 'none');
  const theirs = await count(() => h.openHtml('kairi-fonts-control', '<!doctype html><html lang="en"><title>control</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kalam:wght@300;400&display=swap"><p>control</p></html>'));
  check('control: a page with the sketchbook’s Google Fonts link is caught', theirs.length > 0, theirs.join(', ') || 'nothing caught');
}

// 6. axe in every register, light and dark
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await openReady(`/packages/scenes/kairi/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
