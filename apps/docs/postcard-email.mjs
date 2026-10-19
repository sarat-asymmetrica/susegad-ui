// Makes apps/docs/postcard/email.jpg: the Goa postcard as it sits in an email, 1200 x 800 for a 600 x 400 display.
//
//   node apps/docs/postcard-email.mjs          draw it through the recipe in Chromium and write the file (committed)
//
// The card is the recipe's own: GOA_OCT_2026, warm, the ferry, the name space empty with its placeholder. It is drawn at
// 1800 x 1200, stepped down to 1200 x 800 and saved as a JPEG; the quality is the highest that keeps the file under the
// budget (150 KB: an email image that is large is one that is slow to open on a phone and sometimes held back).
// The site build only copies the file to /postcard/email.jpg, so building the site needs no browser.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../../tools/serve.mjs';
import { acquireSlot } from '../../tools/lib/slots.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
export const EMAIL_IMAGE = { file: path.join(HERE, 'postcard', 'email.jpg'), w: 1200, h: 800, budgetBytes: 150 * 1024, scene: 'ferry' };

const release = await acquireSlot({ label: 'postcard-email' });
const site = await startServer({ root: ROOT, quiet: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on('pageerror', e => { throw e; });
  await page.goto(`${site.url}/packages/recipes/picture-postcard/index.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const made = await page.evaluate(async ({ w, h, scene, budget }) => {
    const m = await import('/packages/recipes/picture-postcard/recipe.js');
    const { GOA_OCT_2026 } = await import('/packages/recipes/picture-postcard/events/goa-oct-2026.js');
    const full = document.createElement('canvas');
    const drawn = await m.drawPostcard(full, { name: '', placeholder: m.WORDS.emptyCard, scene, event: GOA_OCT_2026 });
    // stepped down in two halvings' worth of smoothing: one big drawImage from 1800 to 1200 is fine, high quality
    const small = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const g = small.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(full, 0, 0, w, h);
    const jpeg = q => new Promise(res => small.toBlob(res, 'image/jpeg', q));
    let lo = 0.5, hi = 0.95, best = null;
    for (let i = 0; i < 8; i++) {
      const q = (lo + hi) / 2, b = await jpeg(q);
      if (b.size <= budget) { best = { q, b }; lo = q; } else hi = q;
    }
    if (!best) throw new Error('no JPEG quality from 0.5 up fits the budget');
    const bytes = new Uint8Array(await best.b.arrayBuffer());
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { b64: btoa(bin), q: best.q, alt: drawn.alt ?? '' };
  }, { w: EMAIL_IMAGE.w, h: EMAIL_IMAGE.h, scene: EMAIL_IMAGE.scene, budget: EMAIL_IMAGE.budgetBytes });
  const buf = Buffer.from(made.b64, 'base64');
  fs.writeFileSync(EMAIL_IMAGE.file, buf);
  console.log(`wrote ${path.relative(ROOT, EMAIL_IMAGE.file)}: ${EMAIL_IMAGE.w} x ${EMAIL_IMAGE.h}, ${(buf.length / 1024).toFixed(1)} KB at quality ${made.q.toFixed(3)}; alt "${made.alt}"`);
} finally { await browser.close(); await site.close?.(); release(); }
