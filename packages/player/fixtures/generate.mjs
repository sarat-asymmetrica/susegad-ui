// generate.mjs: renders the library's own Kolam scene to a small WebM and
// writes it here, alongside a short WebVTT caption track, so the player's
// demo and checks have a real sample clip without fetching anything from
// the web or generating one (with its blob-URL teardown races) on every
// page load. Re-run by hand after a Kolam or export change:
//
//   node packages/player/fixtures/generate.mjs

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startServer } from '../../../tools/serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => { console.error('PAGE ERROR', String(e)); process.exitCode = 1; });

await page.goto(`${server.url}/packages/player/fixtures/generate.harness.html`);
await page.waitForFunction(() => window.__done === true, { timeout: 30000 });
const base64 = await page.evaluate(() => window.__webmBase64);
const bytes = Buffer.from(base64, 'base64');
writeFileSync(path.join(here, 'sample.webm'), bytes);
console.log(`wrote sample.webm, ${(bytes.length / 1024).toFixed(1)} KB`);

await browser.close();
await server.close();
