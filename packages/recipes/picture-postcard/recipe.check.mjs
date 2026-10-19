// Browser checks for the picture-postcard recipe: the proof that a typed name makes a postcard and that saving it is honest.
//
//   node packages/recipes/picture-postcard/recipe.check.mjs                  every clause, in the engine SG_ENGINE names
//   SG_ENGINE=webkit node packages/recipes/picture-postcard/recipe.check.mjs
//   node packages/recipes/picture-postcard/recipe.check.mjs --break=<mode>   a deliberately broken piece (modes below)
//   node packages/recipes/picture-postcard/recipe.check.mjs --sheet          the owner's contact sheet, to .shots/postcard/<engine>/
//
// What it proves: the same name and scene make the same pixels and another name does not; names of any length and any
// script (Latin, Devanagari, Kannada, Malayalam, Urdu, a one-letter name, a 60-letter word) lay out inside the card, in
// their own place, without touching the picture or the stamp; the PNG is a PNG and the GIF is a GIF89a of 30 frames
// under 5 MB whose first frame is the PNG's picture, whose picture moves and whose name and stamp do not; making the GIF
// never holds the page still for long and a cancel stops it; sharing hands over the file where the browser can and
// downloads where it cannot; reduced motion plays nothing by itself; and making and saving a card sends nothing.
//
// Break modes (each rewrites one served file; the run fails if the text to break has moved), and the clause each turns red:
//   no-yield      the GIF's drawing loop never lets the page breathe          -> "making the GIF never holds the page still"
//   no-abort      a cancel is ignored                                          -> "a cancel stops the GIF"
//   extra-frame   31 frames, not 30                                            -> "the GIF is 30 frames"
//   name-wide     the name is never shrunk or wrapped                          -> "every name sits inside its place"
//   unseeded      the paper is seeded from Math.random                         -> "the same name twice makes the same pixels"
//   beacon        the PNG export posts the name to a server                    -> "the only requests are static files"
//   share-off     the share sheet is never used                                -> "share hands the file to the share sheet"
//   autoplay      the GIF is shown on the page under reduced motion            -> "reduced motion: the GIF is not shown"
//   unlabelled    the name field has no label                                  -> "axe, light: 0 violations"
//   wide-card     the preview is 1800 px wide whatever the screen              -> "no sideways scroll at 390 px"
//   no-fonts      the display face is not waited for                           -> "a Kannada name is drawn in the library's face"
//   png-as-jpg    a PNG is named .jpg                                          -> "the PNG is a PNG by its bytes, named .png"
//   gif-first-not-png  a live scene's card shows its rest, not the moment its GIF starts at (posta) -> "every scene's GIF starts on the PNG's picture"
//   dark-card     the scene is drawn in the page's theme, so a dark page makes a night card -> "a dark page makes the same card"
//   png-silent    a PNG that cannot be made says nothing                       -> "a picture that cannot be made says so"
//   large-silent  a GIF over the size budget says nothing about it             -> "a GIF over the size budget says so"
//   nudge-off     Save with no name makes a card for no one                    -> "Save and Share with no name move to the name field"
//   fonts-silent  slow fonts are said nothing about                            -> "fonts that stall: the card is drawn in a plain face ... says so"
//   fell-back-silent  a share that became a download says only "Saved"        -> "and says it was saved instead of shared"
//   no-share-text the share sheet gets no text and link                        -> "the share sheet gets a title and a text"
//   name-flush    the name has no inset, and runs to the picture's edge        -> "a name keeps the inset of the picture mat"
//   tinto-caption tinto's caption cards are left on in the card's picture      -> "the tinto card is made with its caption cards off"
//   urdu-stack    Noto Naskh/Nastaliq first: WebKit sets the second word lower  -> "the two words of an Urdu name sit on one baseline" (red in WebKit)
//   gif-wrong     the GIF is not the first picture's frame (the first frame's picture is 24 px out of place)-> "the GIF's first frame is the PNG's picture"
//
// Waits are for states (a ready flag, a progress bar, a download, a status line), never for time.

import fs from 'node:fs';
import path from 'node:path';
import { harness } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';
import { plantFault } from '../../../tools/lib/virtual-time.mjs';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';
import { readGif, meanDiff, blockDiff } from './gif-read.mjs';

const { server, browser, engine, check, axe, axeNoJs, done } = await harness();
console.log(`engine: ${engine}`);
const BASE = '/packages/recipes/picture-postcard';
const PAGE = `${BASE}/index.html`;
// The engine comes from SG_ENGINE only. A bare --engine flag is not read here (only `npm run check -- --engine=...` turns it into
// SG_ENGINE), so it would run Chromium while looking like another engine: refuse it, and say which engine is running.
if (process.argv.some(a => a === '--engine' || a.startsWith('--engine='))) { console.error('this check reads SG_ENGINE, not --engine: run it as  SG_ENGINE=webkit node <this file>  (or through npm run check -- --engine=webkit)'); process.exit(2); }
const SHEET = process.argv.includes('--sheet');
const BREAK = process.argv.find(a => a.startsWith('--break='))?.slice('--break='.length) ?? '';

const BREAKS = {
  'no-yield': ['postcard.draw.js', 'export const breathe = () => new Promise(resolve => {', 'export const breathe = () => Promise.resolve(); const unusedBreathe = () => new Promise(resolve => {'],
  'no-abort': ['recipe.js', 'const stop = () => { if (signal?.aborted) throw aborted(); };', 'const stop = () => {};'],
  'extra-frame': ['postcard.core.js', 'const n = Math.max(1, Math.round(fps * seconds));', 'const n = Math.max(1, Math.round(fps * seconds)) + 1;'],
  'name-wide': ['postcard.core.js', 'const fit = shown ? fitName(shown, measure, { tall: sc.tall })', 'const fit = shown ? fitName(shown, measure, { tall: sc.tall, w: 9000 })'],
  unseeded: ['postcard.draw.js', "seed: 11, mottle: 0.035", "seed: Math.random() * 1e6, mottle: 0.035"],
  beacon: ['recipe.js', 'export async function exportPng(canvas, name) {', "export async function exportPng(canvas, name) {\n  fetch(`/beacon?n=${encodeURIComponent(name)}`, { method: 'POST', body: name }).catch(() => {});"],
  'share-off': ['recipe.js', "if (typeof navigator.canShare === 'function' &&", 'if (false &&'],
  autoplay: ['recipe.js', 'if (!reduced.matches) {', 'if (true) {'],
  unlabelled: ['index.html', '<label for="name">Your name</label>', ''],
  'wide-card': ['recipe.css', '.pc__preview canvas, .pc__preview img {\n  display: block; inline-size: 100%;', '.pc__preview canvas, .pc__preview img {\n  display: block; inline-size: 1800px;'],
  'no-fonts': ['postcard.draw.js', "fontReady(fontOf('display', 100), text || placeholder || 'Name'),", ''],
  'png-as-jpg': ['postcard.core.js', "const EXT = { 'image/png': 'png',", "const EXT = { 'image/png': 'jpg',"],
  'gif-first-not-png': ['postcard.draw.js', 'if (motion && !motion.warm && motion.from !== undefined)', 'if (false)'],
  'still-offers-gif': ['scenes.js', "still: true /* its GIF works", "/* its GIF works"],
  'dark-card': ['postcard.draw.js', 'overflow:hidden;color-scheme:light', 'overflow:hidden'],
  'png-silent': ['recipe.js', "} catch { say(t('pngFailed')); return null; }", '} catch { return null; }'],
  'large-silent': ['recipe.js', "out.withinBudget ? '' :", "true ? '' :"],
  'nudge-off': ['recipe.js', 'if (!normaliseName(nameEl.value)) { say(t', 'if (false) { say(t'],
  'fonts-silent': ['recipe.js', "fontsWaiting = lateTried = true; say(t('errFonts'));", 'fontsWaiting = lateTried = true;'],
  'fell-back-silent': ['recipe.js', "return share ? 'fell-back' : 'downloaded';", "return 'downloaded';"],
  'no-share-text': ['recipe.js', '...(text ? { text } : {})', ''],
  'name-flush': ['postcard.core.js', 'const NAME_BOX = { x: MARGIN + PICTURE.border, y: 880, w: 1056 - 2 * PICTURE.border, h: 248 };', 'const NAME_BOX = { x: MARGIN, y: 880, w: 1056, h: 248 };'],
  'tinto-caption': ['postcard.draw.js', 'params: { lines: false }, W, H });', 'params: {}, W, H });'],
  'urdu-stack': ['postcard.core.js', "'Geeza Pro', 'Segoe UI', Tahoma, 'Noto Naskh Arabic', 'Arial Unicode MS'", "'Noto Naskh Arabic', 'Noto Nastaliq Urdu', 'Geeza Pro', 'Segoe UI', Tahoma, 'Arial Unicode MS'"],
  'made-silent': ['recipe.js', "$('maker').dispatchEvent(new CustomEvent('postcard-made'", "void ($('maker'), new CustomEvent('postcard-made'"],
  'gif-wrong': ['recipe.js', 'fg.drawImage(patch, ix, iy);', 'fg.drawImage(patch, ix + 24, iy);'],
};
if (BREAK && !BREAKS[BREAK]) { console.error(`unknown --break mode "${BREAK}"`); process.exit(2); }
const TYPES = { '.html': 'text/html', '.css': 'text/css' };
// plantFault serves every fault as JavaScript, which is right for a module and wrong for the page or its stylesheet
const faults = (BREAK ? plantFault(import.meta.url, check, BREAKS[BREAK]) : []).map(([pattern, handler]) => {
  const type = Object.entries(TYPES).find(([ext]) => pattern.includes(`${ext}*`))?.[1];
  return type ? [pattern, r => handler({ fulfill: o => r.fulfill({ ...o, contentType: type }) })] : [pattern, handler];
});

// ── pages ───────────────────────────────────────────────────────────────

const SHARE_STUB = `(() => {
  window.__shared = []; window.__shareFail = null;
  const def = (k, v) => { try { Object.defineProperty(navigator, k, { value: v, configurable: true }); } catch { navigator[k] = v; } };
  def('canShare', d => !!(d && d.files && d.files.length));
  def('share', async d => { if (window.__shareFail) throw new DOMException('closed', window.__shareFail); window.__shared.push(...d.files.map(f => ({ name: f.name, type: f.type, size: f.size, title: d.title, text: d.text }))); });
})();`;

/** A page in its own context, with the planted fault (if any) served, the requests recorded once it is ready, and errors collected. */
async function openPage({ width = 1280, height = 900, reduced = false, touch = false, stubShare = false, js = true, theme = '' } = {}) {
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: touch, isMobile: touch, acceptDownloads: true, javaScriptEnabled: js }));
  for (const [pattern, handler] of faults) await ctx.route(pattern, handler);
  if (stubShare) await ctx.addInitScript(SHARE_STUB);
  const page = await ctx.newPage(), errors = [], requests = [], downloads = [];
  let watching = false;
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (watching && /^https?:/.test(r.url())) requests.push({ url: r.url(), method: r.method(), body: r.postData() }); });
  page.on('download', d => downloads.push(d));
  await page.goto(`${server.url}${PAGE}${theme ? `?theme=${theme}` : ''}`);
  if (js) {
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    await page.evaluate(() => { window.__r = import('/packages/recipes/picture-postcard/recipe.js'); });
  }
  watching = true;
  return { ctx, page, errors, requests, downloads, origin: server.url };
}

/** One card in the page, as numbers: digests of the whole card and of its regions, the ink boxes, the layout. */
const MAKE = `async ({ name, placeholder, scene, seed, event, keep }) => {
  const m = await window.__r, c = document.createElement('canvas');
  const o = await m.drawPostcard(c, { name, placeholder, scene, seed, event: event ?? m.CONCLAVE_2026 });
  const g = c.getContext('2d', { willReadFrequently: true });
  const hex = async b => [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join('');
  const region = async r => hex(g.getImageData(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)).data);
  const L = o.layout, f = L.picture.frame;
  const ink = (r) => { const d = g.getImageData(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 120 && d[i + 1] < 120 && d[i + 2] < 120) n++; return n; };
  // the first name line's words: the widest empty gap between its dark columns splits it in two, and each side's densest row is where it sits
  const wordRows = () => {
    const b = L.name.lines[0] && o.boxes.find(x => x.what === 'name'); if (!b) return null;
    const x0 = Math.floor(b.x), y0 = Math.floor(b.y) - 20, w = Math.ceil(b.w) + 1, h = Math.ceil(b.h) + 40, d = g.getImageData(x0, y0, w, h).data;
    const dark = (x, y) => { const i = (y * w + x) * 4; return d[i] < 120 && d[i + 1] < 120 && d[i + 2] < 120; };
    const col = Array.from({ length: w }, (_, x) => { for (let y = 0; y < h; y++) if (dark(x, y)) return true; return false; });
    let best = { len: 0, at: 0 }, run = 0, first = col.indexOf(true), last = col.lastIndexOf(true);
    for (let x = first; x <= last; x++) { if (col[x]) { if (run > best.len) best = { len: run, at: x - run }; run = 0; } else run++; }
    const side = (a, z) => { const rows = new Array(h).fill(0); let top = h, bottom = -1; for (let y = 0; y < h; y++) for (let x = a; x < z; x++) if (dark(x, y)) { rows[y]++; top = Math.min(top, y); bottom = Math.max(bottom, y); } return { peak: rows.indexOf(Math.max(...rows)) + y0, top: top + y0, bottom: bottom + y0, x0: a + x0, x1: z + x0 }; };
    return { gap: best.len, left: side(first, best.at), right: side(best.at + best.len, last + 1) };
  };
  const all = g.getImageData(0, 0, c.width, c.height).data;
  const out = {
    px: await hex(all.buffer.slice(0)), w: c.width, h: c.height,
    picture: await region(f), right: await region({ x: L.right.x, y: 0, w: L.right.w + 72, h: 1200 }), kicker: await region({ x: 72, y: 800, w: 1056, h: 70 }),
    nameInk: ink(L.name.box), boxes: o.boxes, layout: { name: L.name, script: L.script, rtl: L.rtl, covered: L.covered, seed: L.seed, inner: L.picture.inner, frame: f, divider: L.divider, alt: L.alt },
    wordRows: wordRows(),
  };
  if (keep) { const blob = await new Promise(r => c.toBlob(r, 'image/png')), b = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); out.png = btoa(s); }
  return out;
}`;
const make = (page, o) => page.evaluate(`(${MAKE})(${JSON.stringify(o)})`);

/** A GIF made in the page (through the module API), as base64 bytes with its numbers, plus the PNG's picture scaled to the GIF's size. */
const GIF_IN_PAGE = `async ({ name, scene, seed, cancelAt, rafGaps, withPng }) => {
  const m = await window.__r, pc = await m.preparePostcard({ name, scene, seed, event: m.CONCLAVE_2026 });
  const ac = new AbortController(); let calls = 0, after = 0, aborted = false, abortedAt = 0;
  let last = performance.now(), gap = 0, run = true; const tick = () => { const n = performance.now(); gap = Math.max(gap, n - last); last = n; if (run) requestAnimationFrame(tick); };
  const longs = []; let po = null; try { po = new PerformanceObserver(l => longs.push(...l.getEntries().map(e => [Math.round(e.startTime), Math.round(e.duration)]))); po.observe({ type: 'longtask' }); } catch {}
  if (rafGaps) requestAnimationFrame(tick);
  // the page paints the card on screen before anyone presses Save GIF, and that first draw of the scene is where its
  // set-up cost lands; so the card is painted first here too, and its own longest gap is reported apart from the GIF's
  const tp = performance.now(); await pc.paint(document.createElement('canvas'));
  const paintMs = Math.round(performance.now() - tp);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const paintGap = Math.round(gap), paintLong = Math.max(0, ...longs.map(l => l[1]));
  // the control: how long a frame takes to arrive on this machine, in this state, while nothing of ours is running
  gap = 0; last = performance.now(); await new Promise(r => setTimeout(r, 600)); await new Promise(r => requestAnimationFrame(r));
  const idleGap = Math.round(gap); gap = 0; last = performance.now();
  const t0 = performance.now(); longs.length = 0;
  let out = null, err = null;
  try { out = await m.makeGif(pc, { signal: ac.signal, onProgress: p => { calls++; if (aborted) after++; if (cancelAt && p.done === cancelAt) { aborted = true; abortedAt = performance.now(); ac.abort(); } } }); } catch (e) { err = e.name; }
  // a frame has to be able to arrive after the work for the gap to be seen: a gap is only measured when the next frame lands
  if (rafGaps) await new Promise(r => requestAnimationFrame(r));
  run = false; po?.disconnect(); const ms = performance.now() - t0, settledMs = aborted ? performance.now() - abortedAt : 0;
  const res = { err, calls, after, gap: Math.round(gap), ms: Math.round(ms), settledMs: Math.round(settledMs), paintMs, paintGap, paintLong, idleGap, longs: longs.filter(l => l[0] >= t0 - 1), longMax: Math.max(0, ...longs.filter(l => l[0] >= t0 - 1).map(l => l[1])) };
  if (out) {
    const b = out.bytes; let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
    Object.assign(res, { b64: btoa(s), size: b.length, frames: out.frames, colors: out.colors, type: out.type, filename: out.filename, within: out.withinBudget, encodeMs: out.ms });
    if (withPng) {
      const c = document.createElement('canvas'); await pc.paint(c);
      const half = document.createElement('canvas'); half.width = 900; half.height = 600; const hg = half.getContext('2d', { willReadFrequently: true }); hg.drawImage(c, 0, 0, 900, 600);
      const d = hg.getImageData(0, 0, 900, 600).data; let t = ''; const rgb = new Uint8Array(900 * 600 * 3); for (let i = 0, j = 0; i < d.length; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; }
      for (let i = 0; i < rgb.length; i += 8192) t += String.fromCharCode(...rgb.subarray(i, i + 8192)); res.pngRgb = btoa(t);
    }
  }
  pc.destroy(); return res;
}`;
const statusIs = (page, re, timeout = 90000) => page.waitForFunction(src => new RegExp(src).test(document.querySelector('#status').textContent), re.source, { timeout });
const gifIn = (page, o) => page.evaluate(`(${GIF_IN_PAGE})(${JSON.stringify(o)})`);
const bytesOf = b64 => new Uint8Array(Buffer.from(b64, 'base64'));
const sizeKB = n => `${(n / 1024).toFixed(0)} KB`;

const NAMES = {
  long: 'Maria Conceição Fernandes de Albuquerque', one: 'J', ascii: 'Asha Naik', devanagari: 'आशा नाईक', kannada: 'ಕಾರ್ತಿಕ್ ಹೆಗಡೆ',
  malayalam: 'അനിത മേനോൻ', urdu: 'فاطمہ خان', word: 'W'.repeat(60), tamil: 'தமிழ்செல்வி', bengali: 'অনিতা সরকার',
  longDev: 'श्रीमती सुनीता प्रभुदेसाई गावकर कामत', longKn: 'ಶ್ರೀಮತಿ ಸುನೀತಾ ಪ್ರಭುದೇಸಾಯಿ ಗಾವ್ಕರ್ ಕಾಮತ್',
};

// ═══ the owner's contact sheet ═══════════════════════════════════════════════
if (SHEET) {
  const outDir = `.shots/postcard/${engine}`;
  fs.mkdirSync(`${outDir}/png`, { recursive: true }); fs.mkdirSync(`${outDir}/gif`, { recursive: true }); fs.mkdirSync(`${outDir}/gif-first`, { recursive: true });
  // twelve names across six scenes, two to a scene
  const CELLS = [
    ['posta', NAMES.long], ['ferry', NAMES.one], ['mithagar', NAMES.devanagari], ['tinto', NAMES.kannada], ['saanj', NAMES.malayalam], ['dar', NAMES.urdu],
    ['posta', 'Dev Kamat'], ['ferry', 'Zoë D’Souza'], ['mithagar', 'Bruno Fernandes'], ['tinto', 'Sunita Prabhudesai'], ['saanj', 'Rohan Gaonkar'], ['dar', 'Joaquim Menezes'],
  ];
  const { ctx, page } = await openPage();
  const report = { engine, commit: process.env.SG_COMMIT ?? '', cells: [] };
  const pngs = [], firsts = [];
  const stills = await page.evaluate(async () => (await window.__r).SCENES.filter(s => s.still).map(s => s.name));
  const showPng = async (rgbaB64, w, h, kind) => page.evaluate(async ([b64, w, h, kind]) => {
    const bin = atob(b64), c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), id = g.createImageData(w, h);
    for (let i = 0, j = 0; i < w * h * 4; i += 4, j += 3) { id.data[i] = bin.charCodeAt(j); id.data[i + 1] = bin.charCodeAt(j + 1); id.data[i + 2] = bin.charCodeAt(j + 2); id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); const blob = await new Promise(r => c.toBlob(r, 'image/png')), b = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s);
  }, [rgbaB64, w, h, kind]);
  for (const [i, [scene, name]] of CELLS.entries()) {
    const id = `${String(i + 1).padStart(2, '0')}-${scene}`;
    const t0 = Date.now(), card = await make(page, { name, scene, keep: true });
    fs.writeFileSync(`${outDir}/png/${id}.png`, Buffer.from(card.png, 'base64')); pngs.push(`${outDir}/png/${id}.png`);
    const png = Date.now() - t0;
    if (stills.includes(scene)) { // no GIF is offered for a picture that stands still: its "first frame" is the card itself
      fs.copyFileSync(`${outDir}/png/${id}.png`, `${outDir}/gif-first/${id}.png`); firsts.push(`${outDir}/gif-first/${id}.png`);
      report.cells.push({ id, scene, name, pngMs: png, gif: 'none: the picture stands still', lines: card.layout.name.lines.length, nameSize: card.layout.name.size, script: card.layout.script });
      console.log(`  ${id}  ${name.slice(0, 22).padEnd(22)}  png ${png} ms  no GIF offered (the picture stands still)`); continue;
    }
    const g = await gifIn(page, { name, scene, withPng: true });
    fs.writeFileSync(`${outDir}/gif/${id}.gif`, Buffer.from(g.b64, 'base64'));
    const dec = readGif(bytesOf(g.b64)), f0 = dec.frames[0].rgb;
    const first = await showPng(Buffer.from(f0).toString('base64'), dec.w, dec.h);
    fs.writeFileSync(`${outDir}/gif-first/${id}.png`, Buffer.from(first, 'base64')); firsts.push(`${outDir}/gif-first/${id}.png`);
    const vsPng = meanDiff(f0, bytesOf(g.pngRgb), dec.w); const blk = blockDiff(f0, bytesOf(g.pngRgb), dec.w);
    const moved = meanDiff(dec.frames[0].rgb, dec.frames[15].rgb, dec.w, { x: 48, y: 48, w: 504, h: 336 });
    report.cells.push({ id, scene, name, pngMs: png, gifMs: g.ms, gifBytes: g.size, gifFrames: g.frames, colors: g.colors, firstFrameVsPng: +vsPng.toFixed(2), firstFrameBlockDiff: +blk.toFixed(2), pictureMovedByFrame15: +moved.toFixed(2), lines: card.layout.name.lines.length, nameSize: card.layout.name.size, script: card.layout.script });
    console.log(`  ${id}  ${name.slice(0, 22).padEnd(22)}  png ${png} ms  gif ${g.ms} ms  ${sizeKB(g.size)}  first frame vs png: block ${blk.toFixed(2)}, pixel ${vsPng.toFixed(2)}  moved ${moved.toFixed(2)}`);
  }
  // the two sheets: PNGs, and the GIFs' first frames, 4 columns of 3 rows
  const sheet = async (files, name) => {
    const p = await ctx.newPage(); await p.setViewportSize({ width: 2000, height: 1000 });
    const imgs = files.map(f => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`);
    await p.setContent(`<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(3,660px);gap:10px;padding:10px;width:2000px">${imgs.map(s => `<img src="${s}" style="width:660px;height:440px">`).join('')}</body>`);
    await p.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
    await p.screenshot({ path: `${outDir}/${name}.png`, fullPage: true }); await p.close();
  };
  await sheet(pngs, 'sheet-png'); await sheet(firsts, 'sheet-gif-first');
  // the GIF's cost on a slow phone: CPU throttled four times over, Chromium only
  if (engine === 'chromium') {
    const cdp = await ctx.newCDPSession(page);
    report.throttle = [];
    for (const scene of ['ferry', 'posta', 'tinto', 'rampon']) {
      const row = { scene };
      for (const [label, rate] of [['unthrottled', 1], ['x4', 4]]) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        const g = await gifIn(page, { name: 'Asha Naik', scene, rafGaps: true });
        row[label] = { ms: g.ms, bytes: g.size, maxFrameGapMs: g.gap, colors: g.colors };
      }
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      report.throttle.push(row); console.log(`  throttle ${scene}: ${JSON.stringify(row)}`);
    }
  }
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
  console.log(`wrote ${outDir}/sheet-png.png, sheet-gif-first.png, png/, gif/, gif-first/, report.json`);
  await ctx.close(); await done();
}

// ═══ clauses ═════════════════════════════════════════════════════════════════

// ── axe, errors, no JavaScript ──────────────────────────────────────────────
{
  for (const theme of ['light', 'dark']) {
    const { ctx, page, errors } = await openPage({ theme });
    const v = await axe(page);
    check(`axe, ${theme}: 0 violations`, !v.length, v.join('; '));
    check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
    await ctx.close();
  }
  const noJs = await axeNoJs(PAGE);
  check('axe without JavaScript: 0 violations', !noJs.length, noJs.join('; '));
  const { ctx, page } = await openPage({ js: false });
  check('with no JavaScript the page says cards are drawn in the browser', /needs JavaScript/.test(await page.locator('noscript').first().evaluate(n => n.textContent)));
  await ctx.close();
}

// ── same name, same card; another name, another card ────────────────────────
{
  const { ctx, page } = await openPage();
  const a = await make(page, { name: NAMES.ascii, scene: 'ferry' }), a2 = await make(page, { name: NAMES.ascii, scene: 'ferry' });
  check('the same name twice makes the same pixels', a.px === a2.px, `${a.px.slice(0, 12)} vs ${a2.px.slice(0, 12)}`);
  const b = await make(page, { name: 'Bruno Fernandes', scene: 'ferry' }), p = await make(page, { name: NAMES.ascii, scene: 'posta' });
  check('another name makes another card, and so does another scene', new Set([a.px, b.px, p.px]).size === 3);
  check('a name with a space around it is the same card', (await make(page, { name: '  Asha   Naik ', scene: 'ferry' })).px === a.px);
  check('the card is 1800 by 1200, 3:2', a.w === 1800 && a.h === 1200, `${a.w} x ${a.h}`);
  const blank1 = await make(page, { name: '', scene: 'posta' }), blank2 = await make(page, { name: '   ', scene: 'posta' });
  check('the probe can fail: two blank names are one card, a real name is not', blank1.px === blank2.px && blank1.px !== p.px);
  check('the alt text reads the card', /^A postcard for Asha Naik: the ferry crossing the Mandovi, with a jetty on each bank\. Stamped Conclave 2026, postmarked Goa 22–23 Oct 2026\.$/.test(a.layout.alt), a.layout.alt);

  // ── names of every length and script: each sits inside its place and touches nothing else ──
  const ref = await make(page, { name: NAMES.ascii, scene: 'posta', seed: 1 });
  const bad = [], notes = [];
  for (const [kind, name] of Object.entries(NAMES)) {
    const r = await make(page, { name, scene: 'posta', seed: 1 });
    for (const b of r.boxes.filter(b => b.what === 'name')) {
      const w = b.within, inside = b.x >= w.x - 1 && b.y >= w.y - 1 && b.x + b.w <= w.x + w.w + 1 && b.y + b.h <= w.y + w.h + 1 && b.x >= 0 && b.y >= 0 && b.x + b.w <= r.w && b.y + b.h <= r.h;
      if (!inside) bad.push(`${kind}: ink ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)} is outside ${w.x},${w.y} ${w.w}x${w.h}`);
    }
    if (r.picture !== ref.picture || r.right !== ref.right || r.kicker !== ref.kicker) bad.push(`${kind}: the name changed the picture, the stamp column or the kicker`);
    if (r.nameInk < 200) bad.push(`${kind}: only ${r.nameInk} dark pixels where the name is`);
    notes.push(`${kind} ${r.layout.name.lines.length}x${r.layout.name.size}`);
  }
  check('every name sits inside its place (the long, the one letter, a 60-letter word, Devanagari, Kannada, Malayalam, Tamil, Bengali, Urdu), and leaves the picture, the stamp and the footer as they were', !bad.length, bad.join(' | ') || notes.join(', '));
  // ── the name has a real inset: its ink starts and ends inside the picture's own frame, and keeps clear of the divider ──
  {
    const rows = [];
    for (const name of ['Sunita Prabhudesai', 'Bruno Fernandes', 'Joaquim Menezes', NAMES.long, NAMES.devanagari]) {
      const r = await make(page, { name, scene: 'posta', seed: 1 }), inner = r.layout.inner, inset = inner.x - r.layout.frame.x;
      for (const b of r.boxes.filter(b => b.what === 'name')) {
        const left = b.x - inner.x, right = inner.x + inner.w - (b.x + b.w), gap = r.layout.divider.x - (b.x + b.w);
        if (left < -1 || right < -1 || gap < inset - 1) rows.push(`${name}: ink starts ${Math.round(left)} px inside the picture's left edge, ends ${Math.round(right)} px inside its right, ${Math.round(gap)} px from the divider (inset ${inset})`);
      }
    }
    check('a name keeps the inset of the picture mat: its ink lies inside the picture frame inner edges and at least that far from the divider and the card edge', !rows.length, rows.join(' | ') || 'Sunita Prabhudesai, Bruno Fernandes, Joaquim Menezes, the 60-letter name, Devanagari');
  }

  // ── one baseline: the two words of an Urdu name sit level, in either engine ──
  {
    const u = await make(page, { name: NAMES.urdu, scene: 'posta', seed: 1 }), w = u.wordRows, size = u.layout.name.size;
    const drop = w ? Math.abs(w.left.peak - w.right.peak) : Infinity;
    check('the two words of an Urdu name sit on one baseline: their densest ink rows are within a tenth of the type size', !!w && w.gap > size * 0.12 && drop <= size * 0.1, w ? `densest rows ${w.right.peak} (first word, right) and ${w.left.peak} (second word, left), ${drop} px apart at ${size} px type, ink ${w.right.top}-${w.right.bottom} and ${w.left.top}-${w.left.bottom}, word gap ${w.gap} px, ${engine}` : 'no ink found');
  }

  // ── tinto's caption cards are words baked into the picture; a card turns them off ──
  {
    // the instrument: every string the card's canvases are asked to draw; a caption is one of tinto's own lines (or a wrapped part of one)
    const seen = await page.evaluate(`(async () => {
      const m = await window.__r, { VIGNETTES } = await import('/packages/scenes/tinto/index.js');
      const lines = VIGNETTES.map(v => v.line), drawn = [], was = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { drawn.push(String(t)); return was.call(this, t, ...r); };
      try { await m.drawPostcard(document.createElement('canvas'), { name: 'Sunita Prabhudesai', scene: 'tinto', event: m.CONCLAVE_2026 }); } finally { CanvasRenderingContext2D.prototype.fillText = was; }
      return { lines: lines.length, drawn: drawn.length, captions: drawn.filter(t => t.length > 8 && lines.some(l => l.includes(t))) };
    })()`);
    check('the tinto card is made with its caption cards off', seen.lines > 5 && seen.drawn > 3 && !seen.captions.length, JSON.stringify(seen));
  }
  const urdu = await make(page, { name: NAMES.urdu, scene: 'posta' }), one = await make(page, { name: NAMES.one, scene: 'posta' }), long = await make(page, { name: NAMES.long, scene: 'posta' });
  check('Urdu is laid out right to left, Malayalam is flagged as outside the library faces', urdu.layout.rtl && urdu.layout.name.direction === 'rtl' && !(await make(page, { name: NAMES.malayalam, scene: 'posta' })).layout.covered);
  check('one letter is set large on one line; a long name is smaller and wraps', one.layout.name.lines.length === 1 && one.layout.name.size >= 150 && long.layout.name.lines.length >= 2 && long.layout.name.size < one.layout.name.size, `J ${one.layout.name.size}px, long ${long.layout.name.lines.length} lines at ${long.layout.name.size}px`);
  // the sensitivity probe: a name far too long for any size is cut at 60 graphemes, never drawn past the card
  const huge = await make(page, { name: 'x'.repeat(400), scene: 'posta', seed: 1 });
  check('a 400-letter name is cut to the limit and still sits inside its place', huge.layout.name.text.length === 60 && huge.boxes.filter(b => b.what === 'name').every(b => b.x >= 72 - 1 && b.x + b.w <= 1128 + 1));

  await ctx.close();
}

// ── the faces: the first card of a fresh page is already in the library's faces, not laid out in a fallback and redrawn ──
{
  const { ctx, page } = await openPage();
  const first = await make(page, { name: NAMES.kannada, scene: 'posta' });
  const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '')));
  const again = await make(page, { name: NAMES.kannada, scene: 'posta' });
  const dev1 = await make(page, { name: NAMES.devanagari, scene: 'posta' }), dev2 = await make(page, { name: NAMES.devanagari, scene: 'posta' });
  check("a Kannada name is in the library's face the first time it is drawn, and so is a Devanagari one: drawing it again changes nothing", loaded.some(f => /Tiro Kannada|Noto Sans Kannada/.test(f)) && first.px === again.px && dev1.px === dev2.px, `loaded after the first card: ${loaded.join(', ')}; Kannada ${first.px === again.px ? 'same' : 'changed'}, Devanagari ${dev1.px === dev2.px ? 'same' : 'changed'}`);
  await ctx.close();
}

// ── every listed scene draws a real picture ─────────────────────────────────
{
  const { ctx, page } = await openPage();
  const names = await page.evaluate(async () => (await window.__r).SCENES.map(s => s.name));
  const stats = [];
  for (const scene of names) {
    const r = await page.evaluate(async scene => {
      const m = await window.__r, c = document.createElement('canvas'), o = await m.drawPostcard(c, { name: 'Asha', scene, seed: 1 });
      const i = o.layout.picture.inner, d = c.getContext('2d').getImageData(i.x + 4, i.y + 4, i.w - 8, i.h - 8).data; const seen = new Set(); let mat = 0;
      for (let k = 0; k < d.length; k += 4 * 37) { seen.add((d[k] >> 3) << 10 | (d[k + 1] >> 3) << 5 | d[k + 2] >> 3); if (d[k] === 0xd9 && d[k + 1] === 0xcd && d[k + 2] === 0xb6) mat++; }
      return { colours: seen.size, mat: mat / (d.length / 4 / 37) };
    }, scene);
    stats.push(`${scene} ${r.colours}c`); if (r.colours < 40 || r.mat > 0.5) stats.push(`(${scene} looks blank)`);
  }
  check('every scene in the picker draws a real picture, not the mat', !stats.some(s => s.includes('blank')), stats.join(', '));
  await ctx.close();
}

// ── PNG and GIF: the bytes, the names, the numbers ──────────────────────────
{
  const { ctx, page } = await openPage();
  const png = await page.evaluate(async () => {
    const m = await window.__r, c = document.createElement('canvas'); await m.drawPostcard(c, { name: 'Dev Kamat', scene: 'ferry' });
    const out = await m.exportPng(c, 'Dev Kamat'); return { type: out.type, filename: out.filename, head: [...out.bytes.slice(0, 8)], size: out.blob.size };
  });
  check('the PNG is a PNG by its bytes, named .png', png.type === 'image/png' && png.head.join() === '137,80,78,71,13,10,26,10' && png.filename === 'postcard-dev-kamat.png', `${png.filename}, ${sizeKB(png.size)}`);

  const g = await gifIn(page, { name: 'Dev Kamat', scene: 'ferry', rafGaps: true, withPng: true });
  const bytes = bytesOf(g.b64), dec = readGif(bytes);
  check('the GIF is a GIF89a by its bytes, named .gif', String.fromCharCode(...bytes.subarray(0, 6)) === 'GIF89a' && g.filename === 'postcard-dev-kamat.gif' && bytes.at(-1) === 0x3b, `${g.filename}, ${sizeKB(g.size)}`);
  check('the GIF is 30 frames, ten a second, looping, 900 by 600', dec.frames.length === 30 && dec.frames.every(f => f.delay === 100) && dec.loops && dec.w === 900 && dec.h === 600, `${dec.frames.length} frames, delays ${[...new Set(dec.frames.map(f => f.delay))]}, loops ${dec.loops}`);
  check('the GIF is under 5 MB', g.size < 5_000_000 && g.within, `${(g.size / 1e6).toFixed(2)} MB, ${g.colors} colours, ${g.ms} ms unthrottled in ${engine}`);
  const frame = dec.frames[0], R = { x: 48, y: 48, w: 504, h: 336 };
  check('every frame after the first is only the picture, the rest of the card is left alone', dec.frames.slice(1).every(f => f.x === R.x && f.y === R.y && f.w === R.w && f.h === R.h) && frame.w === 900 && frame.h === 600);
  const movement = dec.frames.slice(1).map((f, i) => meanDiff(dec.frames[i].rgb, f.rgb, dec.w, R)), moved = movement.filter(d => d > 0.3).length;
  check('the picture moves: most frames differ from the one before', moved >= 15, `${moved} of 29 frames moved, mean ${(movement.reduce((a, b) => a + b, 0) / 29).toFixed(2)}`);
  const below = { x: 0, y: 410, w: 900, h: 190 }, right = { x: 580, y: 0, w: 320, h: 600 };
  const still = dec.frames.map(f => Math.max(meanDiff(dec.frames[0].rgb, f.rgb, dec.w, below), meanDiff(dec.frames[0].rgb, f.rgb, dec.w, right)));
  check('the name, the stamp and the postmark do not move: no frame differs from the first outside the picture', Math.max(...still) === 0, `max diff ${Math.max(...still)}`);
  const toPng = blockDiff(frame.rgb, bytesOf(g.pngRgb), dec.w), toPngFine = meanDiff(frame.rgb, bytesOf(g.pngRgb), dec.w);
  const other = await make(page, { name: 'Bruno Fernandes', scene: 'ferry', keep: true });
  const otherRgb = await page.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = 900; c.height = 600; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 900, 600); const d = g.getImageData(0, 0, 900, 600).data, rgb = new Uint8Array(900 * 600 * 3); for (let i = 0, j = 0; i < d.length; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; } let s = ''; for (let i = 0; i < rgb.length; i += 8192) s += String.fromCharCode(...rgb.subarray(i, i + 8192)); return btoa(s); }, other.png);
  const toOther = blockDiff(frame.rgb, bytesOf(otherRgb), dec.w);
  check("the GIF's first frame is the PNG's picture: close to it, and clearly closer than to another name's card", toPng < 2.5 && toOther > toPng * 1.5, `8 px block difference ${toPng.toFixed(2)} from this name's PNG (pixel by pixel ${toPngFine.toFixed(2)}), ${toOther.toFixed(2)} from another's`);
  const gap = g.gap;
  check('making the GIF never holds the page still: the longest gap between frames stays short', gap < 150 + 2 * g.idleGap, `longest gap between frames ${gap} ms (allowed 150 plus twice the ${g.idleGap} ms an idle page shows on this machine just now) over a ${g.ms} ms make${engine === 'chromium' ? `, longest long task ${g.longMax} ms (${g.longs.length} over 50 ms)` : ''}, in ${engine}; the card's own first paint: ${g.paintMs} ms, longest gap ${g.paintGap} ms${engine === 'chromium' ? `, long task ${g.paintLong} ms` : ''}`);

  // ── cancel: stops at the next step, reports nothing after, and the page is free at once ──
  const c = await gifIn(page, { name: 'Dev Kamat', scene: 'ferry', cancelAt: 6 });
  check('a cancel stops the GIF: it rejects with an AbortError, says nothing more, and finishes at once', c.err === 'AbortError' && c.after === 0 && c.calls === 6 && c.settledMs < 500, `${c.err}, ${c.calls} steps, ${c.after} after the cancel, ${c.settledMs} ms to settle`);
  const c2 = await gifIn(page, { name: 'Dev Kamat', scene: 'ferry', cancelAt: 45 });
  check('a cancel while the frames are being put together stops it too', c2.err === 'AbortError' && c2.after === 0 && c2.calls === 45 && c2.settledMs < 500, `${c2.err}, ${c2.calls} steps, ${c2.after} after the cancel`);

  // every scene's GIF, made the way the page makes it (after the card was painted): it starts on the picture, not the bare mat,
  // and the picture never jumps from one frame to the next (a hard cut would show as a step far above the usual motion)
  const sceneNames = await page.evaluate(async () => (await window.__r).SCENES.filter(s => !s.still).map(s => s.name)), bad = [], notes = [];
  for (const scene of sceneNames) {
    const gs = await gifIn(page, { name: 'Asha Naik', scene, withPng: true }), d = readGif(bytesOf(gs.b64)), f0 = d.frames[0].rgb;
    let mat = 0, n = 0; for (let y = 60; y < 380; y += 4) for (let x = 60; x < 540; x += 4) { const k = (y * d.w + x) * 3; n++; if (Math.abs(f0[k] - 0xd9) < 12 && Math.abs(f0[k + 1] - 0xcd) < 12 && Math.abs(f0[k + 2] - 0xb6) < 12) mat++; }
    const steps = d.frames.slice(1).map((f, i) => meanDiff(d.frames[i].rgb, f.rgb, d.w, R)), top = Math.max(...steps);
    notes.push(`${scene} ${(gs.size / 1e6).toFixed(1)} MB, ${(mat / n * 100).toFixed(0)}% mat, step ${top.toFixed(1)}`);
    if (mat / n > 0.5) bad.push(`${scene}: the first frame is ${(mat / n * 100).toFixed(0)}% bare mat`);
    if (top > 8) bad.push(`${scene}: the picture jumps by ${top.toFixed(1)} between two frames`);
    if (gs.size >= 5_000_000) bad.push(`${scene}: ${gs.size} bytes`);
    const onPng = blockDiff(d.frames[0].rgb, bytesOf(gs.pngRgb), d.w, 8, R); notes.push(`first frame vs PNG ${onPng.toFixed(2)} in the picture`);
    if (onPng > 3) bad.push(`${scene}: the first frame is ${onPng.toFixed(2)} from the PNG's picture (about 1 is the 256 colours)`);
  }
  check("every scene's GIF starts on the PNG's picture, never jumps from one frame to the next, and is under 5 MB", !bad.length, bad.join(' | ') || notes.join(', '));
  await ctx.close();
}

// ── the journey by keyboard, and what is saved ──────────────────────────────
{
  const { ctx, page, requests, downloads } = await openPage();
  await page.evaluate(() => document.activeElement.blur?.());
  const order = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement.id)); }
  check('Tab reaches the name, the picture, then Save picture, Save GIF, Share picture, Share GIF', order.join() === 'name,scene,save-png,save-gif,share-png,share-gif', order.join());
  await page.fill('#name', 'Dev Kamat');
  const url0 = page.url(); await page.focus('#name'); await page.keyboard.press('Enter');
  check('Enter in the name field makes no request and changes nothing', page.url() === url0 && !downloads.length);
  await page.selectOption('#scene', 'ferry');
  await page.waitForFunction(() => document.querySelector('#card').getAttribute('aria-label')?.includes('Dev Kamat') && document.querySelector('#card').getAttribute('aria-label')?.includes('Mandovi'));
  const label = await page.getAttribute('#card', 'aria-label');
  check('the card is an image whose label reads it: whose, which picture, what is stamped', label === 'A postcard for Dev Kamat: the ferry crossing the Mandovi, with a jetty on each bank. Stamped Conclave 2026, postmarked Goa 22–23 Oct 2026.', label);
  await page.focus('#save-png');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.keyboard.press('Enter')]);
  const pngPath = await dl.path(), pngBytes = fs.readFileSync(pngPath);
  check('Enter on Save picture downloads postcard-dev-kamat.png, a PNG', dl.suggestedFilename() === 'postcard-dev-kamat.png' && pngBytes.subarray(1, 4).toString() === 'PNG', dl.suggestedFilename());
  const SAVED_PNG = /^Saved postcard-dev-kamat\.png\. It should be in your downloads or your Files app\.$/;
  await page.waitForFunction(re => new RegExp(re).test(document.querySelector('#status').textContent), SAVED_PNG.source);
  check('and says plainly what was made', SAVED_PNG.test(await page.textContent('#status')), await page.textContent('#status'));

  // the GIF, by keyboard: progress appears, focus goes to Cancel, the status speaks, the file arrives
  await page.focus('#save-gif');
  const gifDl = page.waitForEvent('download', { timeout: 180000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('#progress').hidden);
  const focusAtStart = await page.evaluate(() => document.activeElement.id), spoke = await page.textContent('#status');
  const gdl = await gifDl, gbytes = fs.readFileSync(await gdl.path());
  check('Enter on Save GIF shows progress, moves focus to Cancel and says what is happening', focusAtStart === 'cancel' && /^(Making your GIF\.|Drawing the frames: \d+%|Putting the frames together: \d+%)/.test(spoke), `focus ${focusAtStart}, "${spoke}"`);
  check('and downloads postcard-dev-kamat.gif, a GIF89a', gdl.suggestedFilename() === 'postcard-dev-kamat.gif' && gbytes.subarray(0, 6).toString() === 'GIF89a', `${gdl.suggestedFilename()}, ${sizeKB(gbytes.length)}`);
  await page.waitForFunction(() => /^Saved postcard-dev-kamat\.gif \([\d.]+ (KB|MB)\)\. It should be in your downloads or your Files app\.$/.test(document.querySelector('#status').textContent));
  check('the finished GIF shows on the page and the browser decodes it (900 px wide)', await page.evaluate(() => { const i = document.querySelector('#gif-preview'); return !i.hidden && i.naturalWidth === 900; }));
  check('focus comes back to the button pressed, and the fields are free again', await page.evaluate(() => document.activeElement.id === 'save-gif' && !document.querySelector('#name').disabled));

  // a cancel by keyboard
  await page.focus('#save-gif'); const before = downloads.length;
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('#cancel').hidden && document.activeElement.id === 'cancel');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /^Cancelled\./.test(document.querySelector('#status').textContent), null, { timeout: 30000 });
  check('Enter on Cancel stops the GIF: it says so, saves nothing, and frees the page', downloads.length === before && await page.evaluate(() => document.querySelector('#progress').hidden && !document.querySelector('#save-gif').disabled && !document.querySelector('#name').disabled));
  await ctx.close();
}

// ── axe on the open state: while a GIF is being made ────────────────────────
{
  const { ctx, page } = await openPage();
  await page.click('#save-gif');
  await page.waitForFunction(() => !document.querySelector('#progress').hidden);
  const v = await axe(page);
  check('axe, while the GIF is being made (progress and cancel showing): 0 violations', !v.length, v.join('; '));
  await page.click('#cancel'); await page.waitForFunction(() => /^Cancelled\./.test(document.querySelector('#status').textContent), null, { timeout: 30000 });
  await ctx.close();
}

// ── share: the file to the share sheet where the browser can, a download where it cannot ──
{
  const { ctx, page, downloads } = await openPage({ stubShare: true });
  await page.fill('#name', 'Dev Kamat');
  await page.click('#share-png'); await page.waitForFunction(() => /^(Shared|Saved) postcard-dev-kamat\.png/.test(document.querySelector('#status').textContent), null, { timeout: 90000 });
  await page.click('#share-gif'); await page.waitForFunction(() => /^(Shared|Saved) postcard-dev-kamat\.gif/.test(document.querySelector('#status').textContent), null, { timeout: 180000 });
  const shared = await page.evaluate(() => window.__shared);
  check('the share sheet gets a title and a text with the link to make your own', shared[0]?.title === 'Postcard for Dev Kamat' && shared[0]?.text === 'A postcard of Goa for Dev Kamat. Make yours: https://susegad.asymmetrica.ai/postcard', JSON.stringify([shared[0]?.title, shared[0]?.text]));
  check('share hands the file to the share sheet: the PNG and the GIF, named for the card, no download', shared.length === 2 && shared[0].name === 'postcard-dev-kamat.png' && shared[0].type === 'image/png' && shared[1].name === 'postcard-dev-kamat.gif' && shared[1].type === 'image/gif' && !downloads.length, JSON.stringify(shared));
  await page.evaluate(() => { window.__shareFail = 'AbortError'; });
  await page.click('#share-png'); await page.waitForFunction(() => /^Sharing cancelled\./.test(document.querySelector('#status').textContent), null, { timeout: 15000 }).catch(() => {});
  check('a closed share sheet is not an error: it says so, and makes no download', !downloads.length);
  await page.evaluate(() => { window.__shareFail = 'NotAllowedError'; });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.click('#share-png')]);
  check('a share the browser refuses falls back to a download', dl.suggestedFilename() === 'postcard-dev-kamat.png');
  const fell = await page.waitForFunction(() => /^This browser cannot share files, so the card was saved to your device instead\. Saved postcard-dev-kamat\.png\./.test(document.querySelector('#status').textContent), null, { timeout: 15000 }).then(() => true, () => false);
  check('and says it was saved instead of shared, not just "Saved"', fell, await page.textContent('#status'));
  await ctx.close();
  const plain = await openPage();
  const [d2] = await Promise.all([plain.page.waitForEvent('download', { timeout: 90000 }), plain.page.click('#share-png')]);
  check('with no share sheet to hand, Share picture is a download', /^postcard-.*[.]png$/.test(d2.suggestedFilename()), d2.suggestedFilename());
  await plain.ctx.close();
}

// ── reduced motion: the picture is the default, the GIF is offered and plays nothing ──
{
  const { ctx, page } = await openPage({ reduced: true });
  check('reduced motion: Save picture is first and Save GIF is offered, and nothing is playing at load', await page.evaluate(() => document.querySelectorAll('button')[0].id === 'save-png' && !document.querySelector('#save-gif').disabled && document.querySelector('#gif-preview').hidden));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('#save-gif')]);
  await page.waitForFunction(() => /^Saved postcard-/.test(document.querySelector('#status').textContent), null, { timeout: 60000 });
  check('reduced motion: the GIF is not shown on the page, though it is saved', dl.suggestedFilename().endsWith('.gif') && await page.evaluate(() => document.querySelector('#gif-preview').hidden));
  await ctx.close();
}

// ── a picture that does not move offers no GIF ──────────────────────────────
{
  const { ctx, page } = await openPage();
  const still = await page.evaluate(async () => (await window.__r).SCENES.filter(s => s.still).map(s => s.name));
  check('the scene list marks a picture that stands still (saanj), so the page can say so, and dar, which moves on a script, is not one', still.includes('saanj') && !still.includes('dar'), still.join(', '));
  await page.selectOption('#scene', 'saanj');
  await page.waitForFunction(() => document.querySelector('#card').getAttribute('aria-label').includes('palms'));
  const st = await page.evaluate(() => ({ save: document.querySelector('#save-gif').disabled, share: document.querySelector('#share-gif').disabled, note: !document.querySelector('#gif-note').hidden, png: document.querySelector('#save-png').disabled }));
  check('a picture that stands still has no Save GIF or Share GIF, says why, and still saves as a picture', st.save && st.share && st.note && !st.png, JSON.stringify(st));
  await page.selectOption('#scene', 'ferry');
  await page.waitForFunction(() => !document.querySelector('#save-gif').disabled && document.querySelector('#gif-note').hidden);
  check('and a scene that moves gets them back', await page.evaluate(() => !document.querySelector('#save-gif').disabled && !document.querySelector('#share-gif').disabled && document.querySelector('#gif-note').hidden));
  await ctx.close();
}

// ── when saving goes wrong, or the GIF comes out large, the page says so ────────
{
  const { ctx, page } = await openPage();
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = function (cb) { cb(null); }; });
  await page.click('#save-png');
  const said = await statusIs(page, /^The picture could not be saved just now\. Please try again\.$/).then(() => true, () => false);
  check('a picture that cannot be made says so, in plain words, and the page carries on', said && await page.evaluate(() => !document.querySelector('#save-png').disabled), await page.textContent('#status'));
  await ctx.close();
  // every GIF is "over budget" when the budget is 100 KB: the page says it is large and that the picture is smaller
  const big = await browser.newContext(contextOptions(engine, { viewport: { width: 1280, height: 900 }, acceptDownloads: true }));
  const src = fs.readFileSync(new URL('./recipe.js', import.meta.url), 'utf8');
  if (!src.includes('budgetBytes: 4_800_000')) check('the large-GIF fault applies', false, 'recipe.js changed; update the fault');
  // the planted fault (if any) is applied to the same file, so the clause can go red
  let served = src.replace('budgetBytes: 4_800_000', 'budgetBytes: 100_000');
  if (BREAK && BREAKS[BREAK][0] === 'recipe.js') served = served.split(BREAKS[BREAK][1]).join(BREAKS[BREAK][2]);
  await big.route('**/packages/recipes/picture-postcard/recipe.js*', r => r.fulfill({ contentType: 'text/javascript', body: served }));
  const p2 = await big.newPage(); await p2.goto(`${server.url}${PAGE}`); await p2.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await p2.click('#save-gif');
  const large = await statusIs(p2, /This GIF is large \([\d.]+ (KB|MB)\), and some chat apps may not take it\. You can still save it, or save the picture, which is smaller\.$/, 180000).then(() => true, () => false);
  check('a GIF over the size budget says so: it is large, some chat apps may not take it, and the picture is smaller', large, (await p2.textContent('#status')).slice(0, 120));
  await big.close();
}

// ── no name yet: the card says room is waiting, and Save and Share nudge instead of making a card for no one ──
{
  const { ctx, page, downloads } = await openPage({ stubShare: true });
  await page.fill('#name', '');
  await page.waitForFunction(() => document.querySelector('#card').getAttribute('aria-label').includes('space for your name'));
  const alt = await page.getAttribute('#card', 'aria-label');
  check('an empty name: the alt text says there is room for one, and does not call the card "Your name"', /^A postcard with space for your name: the old post office in Fontainhas/.test(alt) && !/for Your name/.test(alt), alt);
  const empty = await make(page, { name: '', placeholder: 'Your name', scene: 'ferry' }), typed = await make(page, { name: 'Your name', scene: 'ferry' });
  check('and "Your name" is drawn lighter than a real name: no dark ink where it stands', empty.nameInk === 0 && typed.nameInk > 200 && empty.layout.name.lines[0].text === 'Your name', `${empty.nameInk} dark pixels against ${typed.nameInk} for a typed "Your name"`);
  const says = [];
  for (const id of ['save-png', 'save-gif', 'share-png', 'share-gif']) {
    await page.focus(`#${id}`); await page.click(`#${id}`);
    says.push(await page.evaluate(() => [document.activeElement.id, document.querySelector('#status').textContent, document.querySelector('#progress').hidden].join('|')));
  }
  check('Save and Share with no name move to the name field, say what to do in plain words, and start nothing', says.every(x => x === 'name|Type your name first, then save your postcard.|true') && !downloads.length && !(await page.evaluate(() => window.__shared.length)), says[0]);
  // a name pasted past the limit (a paste can exceed maxlength) is cut and the person is told
  await page.evaluate(() => { const n = document.querySelector('#name'); n.value = 'x'.repeat(80); n.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Long names are shortened to 60 letters.' && document.querySelector('#card').getAttribute('aria-label').includes('x'.repeat(60) + ':'));
  check('a name pasted past 60 letters is shortened and says so', (await page.getAttribute('#card', 'aria-label')).includes('x'.repeat(60) + ':') );
  await ctx.close();
}

// ── slow fonts: the card is drawn in a plain face after a moment, says so, and is drawn again when the faces arrive ──
{
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1280, height: 900 } }));
  for (const [pattern, handler] of faults) await ctx.route(pattern, handler);
  let release; const held = new Promise(r => { release = r; });
  await ctx.route(/\.woff2?(\?.*)?$/, async r => { await held; await r.continue().catch(() => {}); });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${server.url}${PAGE}`, { waitUntil: 'domcontentloaded' });
  const FONTS_SLOW = 'The lettering is slow to load, so your card is using a plain face for now. It will switch when the fonts arrive.';
  const said = await page.waitForFunction(t => document.querySelector('#status')?.textContent === t, FONTS_SLOW, { timeout: 20000 }).then(() => true, () => false);
  await page.waitForFunction(() => document.querySelector('#card')?.width === 1800, null, { timeout: 20000 }).catch(() => {});
  const before = await page.evaluate(() => { const c = document.querySelector('#card'); return { w: c.width, ink: c.getContext('2d').getImageData(0, 0, c.width, c.height).data.reduce((a, v, i) => (i % 97 ? a : (a * 31 + v) >>> 0), 7) }; });
  check('fonts that stall: the card is drawn in a plain face after a few seconds and the status line says so', said && before.w === 1800, said ? FONTS_SLOW.slice(0, 40) : `the status line said "${await page.textContent('#status')}"`);
  release();
  const hash = `(() => { const c = document.querySelector('#card'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.reduce((a, v, i) => (i % 97 ? a : (a * 31 + v) >>> 0), 7); })()`;
  const redrawn = await page.waitForFunction(([h, was]) => eval(h) !== was, [hash, before.ink], { timeout: 30000 }).then(() => true, () => false);
  const note = await page.waitForFunction(() => document.querySelector('#status').textContent === '', null, { timeout: 5000 }).then(() => true, () => false);
  const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').length);
  check('and when the faces arrive the card is drawn again in them and the note goes', redrawn && note && loaded > 0 && !errors.length, `${loaded} faces loaded; card ${redrawn ? 'redrawn' : 'unchanged'}; note ${note ? 'gone' : 'still there'}; ${errors.join('; ')}`);
  await ctx.close();
}

// ── a card is paper and ink: a dark page makes the same card ────────────────
{
  const light = await openPage({ theme: 'light' }), dark = await openPage({ theme: 'dark' });
  const a = await make(light.page, { name: 'Asha Naik', scene: 'ferry', seed: 1 }), b = await make(dark.page, { name: 'Asha Naik', scene: 'ferry', seed: 1 });
  const dk = await dark.page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  check('a dark page makes the same card as a light one: same pixels, the picture in daylight', dk.includes('dark') && a.px === b.px && a.picture === b.picture, `page colour scheme "${dk}", ${a.px === b.px ? 'same pixels' : 'the pixels differ'}`);
  await light.ctx.close(); await dark.ctx.close();
}

// ── a phone: 390 px, no sideways scroll, targets big enough ─────────────────
{
  const { ctx, page } = await openPage({ width: 390, height: 844, touch: true });
  const side = await sidewaysScroll(page, 390);
  check('no sideways scroll at 390 px', side.overflow <= 0, `${side.overflow}px over, scroll width ${side.scrollWidth}`);
  const m = await page.evaluate(() => { const c = document.querySelector('#card').getBoundingClientRect(); return { left: c.left, right: c.right, w: c.width, h: c.height, small: [...document.querySelectorAll('button, input, select')].filter(e => e.getBoundingClientRect().height < 44 && e.offsetParent).map(e => e.id) }; });
  check('at 390 px the card fits the screen at 3:2, and every control is at least 44 px tall', m.left >= 0 && m.right <= 390 && Math.abs(m.w / m.h - 1.5) < 0.01 && !m.small.length, `card ${Math.round(m.w)} x ${Math.round(m.h)} from ${Math.round(m.left)}, small: ${m.small.join(',') || 'none'}`);
  await ctx.close();
}

// ── a page may show what was saved: the maker says what it made ──────────────────────────────
{
  const { ctx, page, downloads } = await openPage({ stubShare: true });
  await page.evaluate(() => { window.__made = []; document.querySelector('#maker').addEventListener('postcard-made', e => window.__made.push({ bytes: e.detail.out.blob.size, type: e.detail.out.blob.type, filename: e.detail.out.filename, how: e.detail.how, share: e.detail.share })); });
  await page.fill('#name', 'Asha Naik'); await page.waitForFunction(() => document.querySelector('#card').getAttribute('aria-label').includes('Asha Naik'));
  await page.click('#save-png'); await page.waitForFunction(() => window.__made.length === 1, null, { timeout: 20000 }).catch(() => {});
  await page.click('#share-png'); await page.waitForFunction(() => window.__made.length === 2, null, { timeout: 20000 }).catch(() => {});
  const made = await page.evaluate(() => window.__made);
  check('Save and Share each tell the page what was made (postcard-made: the PNG, how it was delivered, whether it was a share), once each', made[0]?.type === 'image/png' && made[0]?.filename === 'postcard-asha-naik.png' && made[0]?.how === 'downloaded' && made[0]?.share === false && made[1]?.share === true && made[1]?.how === 'shared' && made[0]?.bytes > 10000 && downloads.length === 1, JSON.stringify(made));
  await ctx.close();
}

// ── nothing leaves the device ───────────────────────────────────────────────
{
  // (1) the default card: type another Latin name, save a PNG and a GIF, share them: not one request
  const { ctx, page, requests, downloads } = await openPage({ stubShare: true });
  await page.fill('#name', 'Asha Naik'); await page.waitForFunction(() => document.querySelector('#card').getAttribute('aria-label').includes('Asha Naik'));
  await page.click('#save-png'); await page.waitForFunction(() => /^Saved .*\.png/.test(document.querySelector('#status').textContent), null, { timeout: 90000 });
  await page.click('#save-gif'); await page.waitForFunction(() => /^Saved .*\.gif/.test(document.querySelector('#status').textContent), null, { timeout: 180000 });
  await page.click('#share-png'); await page.waitForFunction(() => /^Shared .*\.png/.test(document.querySelector('#status').textContent), null, { timeout: 90000 });
  check('typing a Latin name, saving a PNG and a GIF and sharing: not one request after the page loaded', requests.length === 0, requests.map(r => `${r.method} ${r.url}`).join(', ') || 'none');
  // (2) other scenes and scripts: only static files the page's own site serves, none carrying the name
  for (const [name, scene] of [['Dev Kamat', 'ferry'], [NAMES.kannada, 'tinto'], [NAMES.devanagari, 'mithagar']]) {
    await page.selectOption('#scene', scene); await page.fill('#name', name);
    await page.waitForFunction(([n]) => document.querySelector('#card').getAttribute('aria-label').includes(n), [name]);
    await page.click('#save-png'); await page.waitForFunction(([n]) => document.querySelector('#status').textContent.includes('postcard-') && document.querySelector('#card').getAttribute('aria-label').includes(n), [name], { timeout: 90000 });
  }
  const said = ['Dev Kamat', 'Dev%20Kamat', 'Dev+Kamat', 'Kamat', 'Asha', encodeURIComponent(NAMES.kannada), NAMES.kannada, encodeURIComponent(NAMES.devanagari), NAMES.devanagari];
  const origin = new URL(page.url()).origin, odd = requests.filter(r => !(r.method === 'GET' && r.url.startsWith(origin + '/packages/') && !r.url.includes('?') && !r.body));
  check('other scenes and scripts only fetch the site\'s own static files: the only requests are static files, no query, no body, none carrying a name', !odd.length && !requests.some(r => /Kamat|Naik|Dev%20|Dev\+/i.test(r.url + (r.body ?? ''))), odd.map(r => `${r.method} ${r.url}`).join(', ') || `${requests.length} static GETs`);
  await ctx.close();
}

await done();
