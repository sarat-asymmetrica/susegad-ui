// Browser checks for packages/export: a scene renders to a real PNG, WebM
// and GIF, in the browser (canvas, MediaRecorder), with no console errors
// and no network request (the library dogfoods its own Kolam scene).
//
//   node packages/export/export.check.mjs

import { chromium } from 'playwright';
import { startServer } from '../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
const requests = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', r => requests.push(r.url()));

await page.goto(`${server.url}/packages/export/demo.html`);
// The generic demo.js fallback flips window.__ready once the page has
// loaded and any sg-* elements are defined — this page uses none, so that
// happens almost immediately, well before the real work (recording a WebM,
// encoding a GIF) is done. Wait for the page's own completion text instead.
await page.waitForFunction(() => document.getElementById('status')?.textContent === 'Done.' || /Error/.test(document.getElementById('status')?.textContent || ''), { timeout: 60000 });

const status = await page.textContent('#status');
check('the demo page finished without throwing', status === 'Done.', status);

const pngBytes = await page.evaluate(() => window.__pngBytes);
check('a PNG was produced, a real size', pngBytes > 500 && pngBytes < 300000, `${pngBytes} bytes`);
const pngNatural = await page.evaluate(() => document.getElementById('png').naturalWidth);
check('the PNG decodes back as an image', pngNatural > 0, `naturalWidth ${pngNatural}`);

const webmBytes = await page.evaluate(() => window.__webmBytes);
check('a WebM was produced, a real size', webmBytes > 500, `${webmBytes} bytes`);
// MediaRecorder's own WebM container often reports an inaccurate (sometimes
// tiny, sometimes Infinity) duration until the player has actually seeked
// once — a known Chromium quirk, not a sign the recording is short. Seeking
// to the end and back is the standard workaround for reading the real one.
const videoDuration = await page.evaluate(() => new Promise((resolve, reject) => {
  const v = document.getElementById('webm');
  const settle = () => {
    if (Number.isFinite(v.duration) && v.duration > 0.5) return resolve(v.duration);
    v.currentTime = 1e7;
    v.addEventListener('seeked', () => { v.currentTime = 0; resolve(v.duration); }, { once: true });
  };
  if (v.readyState >= 1) settle(); else v.addEventListener('loadedmetadata', settle, { once: true });
  setTimeout(() => reject(new Error('duration never settled')), 8000);
}));
check('the WebM decodes with a real duration, close to the 2 s asked for', videoDuration > 1 && videoDuration < 4, `${videoDuration}s`);

const gifBytes = await page.evaluate(() => window.__gifBytes);
check('a GIF was produced, a real size', gifBytes > 200 && gifBytes < 1500000, `${gifBytes} bytes`);
const gifNatural = await page.evaluate(() => document.getElementById('gif').naturalWidth);
check('the GIF decodes back as an image', gifNatural > 0, `naturalWidth ${gifNatural}`);

// The GIF is genuinely animated: walk its real block structure and count
// image descriptors (0x2C is also an ordinary byte value inside compressed
// pixel data, so a raw byte scan over-counts; this follows the format).
const gifFrames = await page.evaluate(async () => {
  const res = await fetch(document.getElementById('gif').src);
  const b = new Uint8Array(await res.arrayBuffer());
  const tableEntries = 2 << (b[10] & 0x07);
  let i = 13 + tableEntries * 3, n = 0;
  while (i < b.length) {
    if (b[i] === 0x21) { i += 2; const len = b[i]; i += 1 + len; while (i < b.length && b[i] !== 0) i += 1 + b[i]; i += 1; continue; }
    if (b[i] === 0x2C) {
      n++;
      const dataStart = i + 11;
      let end = dataStart;
      while (end < b.length && b[end] !== 0) end += 1 + b[end];
      i = end + 1;
      continue;
    }
    break;
  }
  return n;
});
check('the GIF has more than one frame', gifFrames >= 2 && gifFrames <= 20, `${gifFrames} image descriptors`);

check('nothing was fetched from another origin', requests.every(u => u.startsWith(server.url) || u.startsWith('blob:') || u.startsWith('data:')), requests.filter(u => !u.startsWith(server.url) && !u.startsWith('blob:')).join(', '));
check('no console errors', errors.length === 0, errors.join(' | '));

await ctx.close();
await browser.close();
await server.close();
if (results.some(r => !r.ok)) process.exit(1);
