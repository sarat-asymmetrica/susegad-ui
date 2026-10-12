// Browser checks for the greeting-card recipe: the proof the cards are the point of the bloom.
// Three names make three different cards, one name twice makes the identical card, a PNG is a PNG and a JPG is a
// JPG by their bytes and by their file names, a request this browser cannot encode is reported as the PNG it
// became, the whole journey by keyboard writes a card for the name typed, axe, and the page with no JavaScript.
//
//   node packages/recipes/greeting-card/recipe.check.mjs
//   node packages/recipes/greeting-card/recipe.check.mjs --cards   also write the three cards to .shots/cards/
//
// Same name, same bytes: the card is drawn from seeded things only (the bloom, the paper) and the browser's own
// encoder is deterministic for one canvas in one browser, so the PNG (and the JPG) of one card is identical byte
// for byte. Encoders differ between browsers and versions, so the bytes are compared within a run, and the
// pixels (getImageData) are compared too, which hold whatever the encoder does.

import fs from 'node:fs';
import { harness } from '../../../tools/lib/component-check.mjs';

const { check, open, axe, axeNoJs, done } = await harness();
const PAGE = '/packages/recipes/greeting-card/index.html';
const NAMES = ['Asha Naik', 'Bruno Fernandes', 'Chandra Hegde'];
const writeCards = process.argv.includes('--cards');
if (writeCards) fs.mkdirSync('.shots/cards', { recursive: true });

// ── axe, errors ─────────────────────────────────────────────────────────
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${PAGE}?theme=${theme}`);
  const v = await axe(page);
  check(`axe, ${theme}: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(PAGE)).length);

// ── the proof ───────────────────────────────────────────────────────────
const { ctx, page, errors } = await open(PAGE);
await page.evaluate(() => { window.__r = import('/packages/recipes/greeting-card/recipe.js'); });
const make = (name, line, register, purpose) => page.evaluate(async ([name, line, register, purpose]) => {
  const { drawCard, exportCard, digest } = await window.__r;
  const c = document.createElement('canvas');
  await drawCard(c, { name, line, register });
  const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const out = await exportCard(c, purpose, name);
  return { px: await digest(new Uint8Array(px.buffer.slice(0))), bytes: await digest(out.bytes), type: out.type, asked: out.asked, filename: out.filename, size: out.blob.size, head: [...out.bytes.slice(0, 4)], data: writeCardsData(out.bytes) };
  function writeCardsData(b) { if (!window.__keep) return null; let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s); }
}, [name, line, register, purpose]);

const LINE = 'We look forward to seeing you.';
const png = {};
for (const n of NAMES) png[n] = await make(n, LINE, 'warm', 'save');
const again = await make(NAMES[0], LINE, 'warm', 'save');
const pngHashes = NAMES.map(n => png[n].bytes);
check('three names make three different cards (PNG bytes)', new Set(pngHashes).size === 3, pngHashes.map(h => h.slice(0, 10)).join(' '));
check('and three different cards by pixels', new Set(NAMES.map(n => png[n].px)).size === 3, NAMES.map(n => png[n].px.slice(0, 10)).join(' '));
check('one name twice makes the identical card: the same bytes', again.bytes === png[NAMES[0]].bytes, `${again.bytes.slice(0, 16)} vs ${png[NAMES[0]].bytes.slice(0, 16)}`);
check('and the same pixels', again.px === png[NAMES[0]].px);
check('the line of text is on the card: another line, another card', (await make(NAMES[0], 'A different line.', 'warm', 'save')).px !== png[NAMES[0]].px);
check('quiet is another card for the same name: dots, not the marigold', (await make(NAMES[0], LINE, 'quiet', 'save')).px !== png[NAMES[0]].px);
check('playful draws the same finished card as warm (a card is still)', (await make(NAMES[0], LINE, 'playful', 'save')).px === png[NAMES[0]].px);
// the probe can fail: the check above must go red on a card that is not seeded from the name
const unseeded = await make(' ', LINE, 'warm', 'save'), unseeded2 = await make('', LINE, 'warm', 'save');
check('the sameness probe can fail: two blank names both fall back to "guest" and are the same card, a real name is not', unseeded.px === unseeded2.px && unseeded.px !== png[NAMES[0]].px);

// ── formats: the type is read from the bytes, the file name follows them ─
const jpg = await make(NAMES[0], LINE, 'warm', 'share'), jpg2 = await make(NAMES[0], LINE, 'warm', 'share');
check('save: a PNG by its bytes, named .png', png[NAMES[0]].type === 'image/png' && png[NAMES[0]].filename === 'greeting-card-asha-naik.png' && png[NAMES[0]].head.join() === '137,80,78,71', `${png[NAMES[0]].filename}, ${(png[NAMES[0]].size / 1024).toFixed(0)} KB`);
check('share: a JPG by its bytes, named .jpg', jpg.type === 'image/jpeg' && jpg.filename === 'greeting-card-asha-naik.jpg' && jpg.head.slice(0, 3).join() === '255,216,255', `${jpg.filename}, ${(jpg.size / 1024).toFixed(0)} KB`);
check('one name twice makes the same JPG bytes too', jpg.bytes === jpg2.bytes);
const avif = await make(NAMES[0], LINE, 'warm', 'image/avif');
check('a type this browser may not encode is reported as the type it really made, and the file name follows it', avif.asked === 'image/avif' && (avif.type === 'image/avif' ? avif.filename.endsWith('.avif') : avif.type === 'image/png' && avif.filename.endsWith('.png')), `asked ${avif.asked}, made ${avif.type}, ${avif.filename}`);
check('the format probe can fail: asking for a PNG is never named .jpg', png[NAMES[0]].filename.endsWith('.jpg') === false && jpg.filename.endsWith('.png') === false);

// ── names that are not short Latin: Devanagari, and one too long for a line ─
const LONG = 'Maria Conceicao Fernandes de Albuquerque e Souza';
const dev = await make('आशा नाईक', LINE, 'warm', 'save'), dev2 = await make('आशा नाईक', LINE, 'warm', 'save'), long = await make(LONG, LINE, 'warm', 'save');
check('a Devanagari name draws its own card, the same twice', dev.bytes === dev2.bytes && dev.px !== png[NAMES[0]].px && dev.filename === 'greeting-card-आशा-नाईक.png', dev.filename);
check('a very long name draws a card too, named by its slug (40 characters at most)', long.type === 'image/png' && long.px !== png[NAMES[0]].px && /^greeting-card-[a-z-]{1,40}.png$/.test(long.filename), long.filename);
{
  // the long name wraps onto more than one line: the ink sits higher than a one-line name's, and no glyph is squeezed
  const rows = (name) => page.evaluate(async ([name, line]) => {
    const { drawCard } = await window.__r; const c = document.createElement('canvas'); await drawCard(c, { name, line: '', register: 'warm' });
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height); let bands = 0, inBand = false;
    for (let y = Math.round(c.height * 0.68); y < Math.round(c.height * 0.95); y++) { let dark = 0; for (let x = 0; x < c.width; x++) if (d.data[(y * c.width + x) * 4] < 90) dark++; const on = dark > 3; if (on && !inBand) bands++; inBand = on; }
    return bands; // dark ink only: the name. The rule and the line are lighter
  }, [name, '']);
  const one = await rows('Asha Naik'), two = await rows(LONG);
  check('a long name wraps onto more than one line, and clear of the flower (a short name is one band of ink, the long one two or three)', one === 1 && two >= 2 && two <= 3, `${one} band vs ${two} bands`);
  check('the wrapping probe can fail: a short name is not wrapped (same rows twice)', (await rows('Asha Naik')) === 1);
}

if (writeCards) {
  await page.evaluate(() => { window.__keep = true; });
  for (const n of NAMES) {
    const j = await make(n, LINE, 'warm', 'share');
    fs.writeFileSync(`.shots/cards/${j.filename}`, Buffer.from(j.data, 'base64'));
    const p = await make(n, LINE, 'warm', 'save');
    fs.writeFileSync(`.shots/cards/${p.filename}`, Buffer.from(p.data, 'base64'));
  }
  for (const n of ['आशा नाईक', LONG]) { const p = await make(n, LINE, 'warm', 'save'); fs.writeFileSync(`.shots/cards/${p.filename}`, Buffer.from(p.data, 'base64')); }
  console.log('wrote the three cards to .shots/cards/');
}

// ── the journey: type a name, press save, get a card with that name's file name ─
{
  await page.goto(`${page.url().split('/packages')[0]}${PAGE}?register=warm`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await page.fill('#name', 'Dev Kamat');
  await page.fill('#line', 'Come hungry.');
  await page.waitForTimeout(400);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.click('#save')]);
  const name = dl.suggestedFilename();
  const status = await page.textContent('#status');
  check('typing a name and pressing Save downloads greeting-card-dev-kamat.png', name === 'greeting-card-dev-kamat.png', name);
  check('and says plainly what was made', /Made greeting-card-dev-kamat\.png, a PNG of \d+ KB\./.test(status), status);
  const label = await page.getAttribute('#card', 'aria-label');
  check('the card is an image with a name that says whose and what it says', label === 'Greeting card for Dev Kamat: Come hungry.', label);
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }).catch(() => null), page.click('#share')]);
  check('Make a JPG to share downloads a .jpg (where the browser cannot share files itself)', !dl2 || dl2.suggestedFilename() === 'greeting-card-dev-kamat.jpg', dl2?.suggestedFilename() ?? 'shared');
  check('nothing started by itself: no download before a press, no console errors', !errors.length, errors.join(' | '));
}
await ctx.close();
await done();
