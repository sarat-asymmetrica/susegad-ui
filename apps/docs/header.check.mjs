// One storey of header: at 390 px the header takes no more than 15 percent of the screen's height.
//
//   node apps/docs/header.check.mjs                    check out/docs
//   node apps/docs/header.check.mjs --out <dir>        check another build (a control)
//
// Measured with getBoundingClientRect on header.bar, on a phone-sized touch viewport, in every register
// (playful hangs bunting under the bar, and that counts), light and dark, on a spread of pages. Written
// before the View control and run against the old header first, where it read 288 px of 844 (34 percent).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../../tools/serve.mjs';
import { acquireSlot } from '../../tools/lib/slots.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BUDGET = 0.15;
const PHONE = { width: 390, height: 844 };
const PAGES = ['/', '/start', '/components/dialog', '/scenes/kantar'];

const i = process.argv.indexOf('--out');
const OUT = path.resolve(i > 0 ? process.argv[i + 1] : path.join(HERE, '..', '..', 'out', 'docs'));
const release = await acquireSlot({ label: 'header.check' });
const server = await startServer({ root: OUT, quiet: true, notFoundHtml: '404.html' });
const browser = await chromium.launch();
let worst = { px: 0 }, bad = 0, cells = 0;
try {
  for (const p of PAGES) for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: theme });
    await ctx.addInitScript(v => { try { localStorage.setItem('sg-docs-prefs', v); } catch {} }, JSON.stringify({ register, theme, palette: 'susegad' }));
    const page = await ctx.newPage();
    await page.goto(server.url + p, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const px = await page.evaluate(() => document.querySelector('header.bar')?.getBoundingClientRect().height ?? -1);
    cells++;
    const over = px < 0 || px > PHONE.height * BUDGET;
    if (over) { bad++; console.error(`  ${p} ${register} ${theme}: header is ${px < 0 ? 'missing' : `${Math.round(px)} px (${(px / PHONE.height * 100).toFixed(1)}%)`}`); }
    if (px > worst.px) worst = { px, p, register, theme };
    await ctx.close();
  }
} finally { await browser.close(); await server.close(); release(); }
const limit = Math.round(PHONE.height * BUDGET);
console.log(`${bad ? 'FAIL' : 'pass'}  one storey: the tallest header at 390 px is ${Math.round(worst.px)} px (${(worst.px / PHONE.height * 100).toFixed(1)}% of ${PHONE.height}; budget ${limit} px), ${bad} of ${cells} cells over`);
process.exit(bad ? 1 : 0);
