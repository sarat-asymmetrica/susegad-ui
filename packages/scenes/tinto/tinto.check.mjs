// Browser checks for Tinto that a Node test cannot reach:
//
//   node packages/scenes/tinto/tinto.check.mjs
//
// 1. every line is real text in the accessibility tree (control: the same
//    probe goes red once the list is taken out);
// 2. focus pins the tourist's card: the card (found as the pixels that differ
//    between lines on and lines off, on a frozen clock) stays by the tourist at
//    1 s and 9 s (control: with no focus the card moves on with the round);
// 3. the calm zone: under the page's text the square barely changes between
//    two moments (control: the same box with no text changes plainly);
// 4. no request leaves the page (control: a page with the sketchbook's Google
//    Fonts link is caught);
// 5. playful: the arrow keys and Enter say a line, once, in a live region;
// 6. axe (WCAG 2.2 AA) on the demo in every register, light and dark, and no
//    console errors.
//
// Scene time is stepped, not waited for: every page that moves or reads its pixels runs on virtual frames
// (tools/lib/virtual-time.mjs). On the real clock still: the network clause (what leaves the page) and axe.

import { harness } from '../../../tools/lib/component-check.mjs';
import { VIGNETTES } from './model.js';
import { loaded } from '../../../tools/lib/wait.mjs';
import { frames, openStepped, until, untilFrozen } from '../../../tools/lib/virtual-time.mjs';

const h = await harness();
const { check } = h;
// component-check's open() waits for __ready !== false, which is already true of a page that has not set it
// yet; a scene page sets __ready = true on sg-ready, so wait for exactly that
const openReady = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 }).catch(() => check(`ready: ${path}`, false, 'no sg-ready in 20 s'));
  return r;
};
// a page on virtual frames, stepped to sg-ready (a page that never gets there fails the check and ends the run)
const stepped = path => openStepped(h, path, { ms: 20000 });
const scene = q => `/tools/harness/scene.html?name=tinto&${q}`;

/** The canvas at one moment, downsampled 4x, as [r, g, b] triples, with its size. */
async function grab(page) {
  return page.evaluate(() => {
    const cv = window.__piece.shadowRoot.querySelector('canvas'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data;
    const s = 4, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), out = new Uint8Array(w * hh * 3);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; out[o] = d[i]; out[o + 1] = d[i + 1]; out[o + 2] = d[i + 2]; }
    return { w, h: hh, kx: 1200 / w, ky: 800 / hh, px: out };
  });
}
/** Open a harness page on a frozen clock and grab its canvas once the clock stops (stepped to the frame that freezes it). */
async function frozen(q) {
  const { ctx, page, errors } = await stepped(scene(q));
  if (!(await untilFrozen(page, { ms: 60000 }))) check(`frozen: ${q}`, false, 'never froze in 60 s');
  const img = await grab(page);
  await ctx.close();
  return { img, errors };
}
/** Pixels that differ between two grabs inside a box (logical units): share, and their centroid. */
function diff(a, b, box = { x: 0, y: 0, w: 1200, h: 800 }, th = 40) {
  let n = 0, c = 0, sx = 0, sy = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const lx = x * a.kx, ly = y * a.ky;
    if (lx < box.x || lx > box.x + box.w || ly < box.y || ly > box.y + box.h) continue;
    const o = (y * a.w + x) * 3; n++;
    if (Math.abs(a.px[o] - b.px[o]) + Math.abs(a.px[o + 1] - b.px[o + 1]) + Math.abs(a.px[o + 2] - b.px[o + 2]) > th) { c++; sx += lx; sy += ly; }
  }
  return { share: n ? c / n : 0, cx: c ? sx / c : null, cy: c ? sy / c : null };
}
const fmt = d => (d.cx === null ? 'no card' : `${d.cx.toFixed(0)}, ${d.cy.toFixed(0)}`);

// 1. every line is text a screen reader reaches
{
  const { ctx, page, errors } = await stepped('/packages/scenes/tinto/demo.html?register=warm');
  const tree = await page.locator('sg-scene').ariaSnapshot();
  const missing = VIGNETTES.filter(v => !tree.includes(v.line.slice(0, 30)));
  check('every one of the seventeen lines is in the accessibility tree', missing.length === 0, missing.length ? `missing: ${missing.map(v => v.id).join(', ')}` : '17 of 17');
  await page.evaluate(() => window.__piece.shadowRoot.querySelector('[part=lines]')?.remove());
  const broken = await page.locator('sg-scene').ariaSnapshot();
  const found = VIGNETTES.filter(v => broken.includes(v.line.slice(0, 30))).length;
  check('control: with the list taken out, the same probe finds the lines gone', found === 0, `${found} of 17 still found`);
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 2. focus pins the card by the tourist; without it the round moves the card on
{
  const TOURIST = [330, 494]; // his head, from the drawing
  const near = d => d.cx !== null && Math.hypot(d.cx - TOURIST[0], d.cy - TOURIST[1]) < 260;
  const at = async (t, extra) => diff((await frozen(`register=warm&freeze=${t}&${extra}`)).img, (await frozen(`register=warm&freeze=${t}&${extra}&lines=false`)).img);
  const a = await at(1, 'focus=tourist'), b = await at(9, 'focus=tourist');
  check('focus=tourist: the card is by the tourist at 1 s and at 9 s', near(a) && near(b), `card at ${fmt(a)}, then ${fmt(b)}; tourist ${TOURIST}`);
  const c = await at(1, ''), d = await at(9, '');
  const moved = c.cx !== null && d.cx !== null && Math.hypot(c.cx - d.cx, c.cy - d.cy) > 150;
  check('control: with no focus, the round has moved the card on by 9 s', moved, `card at ${fmt(c)}, then ${fmt(d)}`);
}

// 3. the calm zone keeps the square still under the page's words
{
  const PANEL = { x: 40, y: 560, w: 540, h: 200 }; // where the harness's sample text sits, bottom left
  const with1 = await frozen('register=playful&freeze=4&content=1'), with2 = await frozen('register=playful&freeze=7&content=1');
  const calm = diff(with1.img, with2.img, PANEL), rest = diff(with1.img, with2.img, { x: 620, y: 360, w: 580, h: 400 });
  const bare1 = await frozen('register=playful&freeze=4'), bare2 = await frozen('register=playful&freeze=7');
  const bare = diff(bare1.img, bare2.img, PANEL);
  check('calm: under the text the square changes by under 1% between 4 s and 7 s', calm.share < 0.01, `${(calm.share * 100).toFixed(2)}% under the text, ${(rest.share * 100).toFixed(2)}% elsewhere`);
  check('control: the same box with no text changes plainly (over 1%)', bare.share > 0.01, `${(bare.share * 100).toFixed(2)}%`);
}

// 4. no request leaves the page
{
  const count = async (open, control = false) => {
    const out = [];
    const { ctx, page } = await open();
    page.on('request', r => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) out.push(u.host); });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
    await page.reload();
    await loaded(page, { ready: !control, quiet: 1500 });
    await ctx.close();
    return [...new Set(out)];
  };
  const ours = await count(() => openReady('/packages/scenes/tinto/demo.html?register=playful'));
  check('no request leaves the page (the library’s own Kalam, no Google Fonts)', ours.length === 0, ours.join(', ') || 'none');
  const theirs = await count(() => h.openHtml('tinto-fonts-control', '<!doctype html><html lang="en"><title>control</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kalam:wght@300;400&display=swap"><p>control</p></html>'), true);
  check('control: a page with the sketchbook’s Google Fonts link is caught', theirs.length > 0, theirs.join(', ') || 'nothing caught');
}

// 5. playful: the keyboard hand and Enter say a line, once
{
  const { ctx, page, errors } = await stepped('/packages/scenes/tinto/demo.html?register=playful&content=0');
  const stage = page.locator('sg-scene').locator('.stage');
  await stage.focus();
  const said = () => page.evaluate(() => window.__piece.shadowRoot.querySelector('[aria-live=polite]').textContent);
  // the hand starts at the middle; walk it left towards the card players under the tree
  for (let k = 0; k < 6; k++) { await page.keyboard.press('ArrowLeft'); await frames(page, 2); } // a press, and a frame or two for the scene to take it
  const live = () => window.__piece.shadowRoot.querySelector('[aria-live=polite]').textContent;
  // the line the hand ended on, and nothing more to come before Enter: the same reading for twenty frames in a row
  for (let last, same = 0, t0 = Date.now(); same < 20 && Date.now() - t0 < 10000; await frames(page, 1)) { const v = await said(); same = v === last ? same + 1 : 0; last = v; }
  const first = await said();
  await page.keyboard.press('Enter');
  await until(page, ([live, was]) => (new Function(`return (${live})()`))() !== was, { arg: [live.toString(), first], ms: 10000 }); // and what Enter said next
  const second = await said();
  const known = s => VIGNETTES.some(v => s.endsWith(v.line));
  check('playful: the keyboard hand picks someone and their line is said', known(first), `"${first}"`);
  check('playful: Enter says the next person’s line', known(second) && second !== first, `"${second}"`);
  const role = await stage.getAttribute('role');
  check('playful: the drawing takes focus as an interactive drawing', role === 'application', role);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 6. axe in every register, light and dark
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await openReady(`/packages/scenes/tinto/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
