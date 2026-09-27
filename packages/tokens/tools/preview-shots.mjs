#!/usr/bin/env node
// Screenshots of packages/tokens/preview.html, with console errors collected.
//
//   node packages/tokens/tools/preview-shots.mjs [--out .shots/tokens]
//
// Serves the repo root on a free port with a tiny static server (no
// dependency beyond Playwright), then shoots desktop and phone, system light
// and system dark, reduced motion, and the no-web-font fallback.

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const outIdx = process.argv.indexOf('--out');
const out = outIdx > 0 ? process.argv[outIdx + 1] : join(root, '.shots', 'tokens');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(root, path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/packages/tokens/preview.html`;

const { chromium } = await import('playwright');
const browser = await chromium.launch();
await mkdir(out, { recursive: true });

const runs = [
  { name: 'desktop-light', viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
  { name: 'desktop-dark-system', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
  { name: 'phone-light', viewport: { width: 390, height: 844 }, colorScheme: 'light', deviceScaleFactor: 2 },
  { name: 'phone-dark-reduced', viewport: { width: 390, height: 844 }, colorScheme: 'dark', reducedMotion: 'reduce', deviceScaleFactor: 2 },
  { name: 'desktop-nofonts', viewport: { width: 1440, height: 900 }, colorScheme: 'light', query: '?nofonts' },
];

const report = [];
for (const run of runs) {
  const ctx = await browser.newContext({ viewport: run.viewport, colorScheme: run.colorScheme, reducedMotion: run.reducedMotion ?? 'no-preference', deviceScaleFactor: run.deviceScaleFactor ?? 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  // The fonts are self-hosted: any request that leaves this server is an error.
  const woff2 = [];
  page.on('request', r => {
    const u = new URL(r.url());
    if (u.hostname !== '127.0.0.1') errors.push(`third-party request: ${r.url()}`);
    if (u.pathname.endsWith('.woff2')) woff2.push(u.pathname.split('/').pop());
  });
  await page.goto(base + (run.query ?? ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  const fails = await page.evaluate(() => window.__fails);
  const facts = await page.evaluate(() => {
    // A face counts as loaded when one of its faces for this script has status "loaded".
    const loaded = name => [...document.fonts].some(f => f.family.replace(/['"]/g, '') === name && f.status === 'loaded');
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      fonts: Object.fromEntries(['Mukta', 'Castoro', 'Tiro Devanagari Marathi', 'Tiro Kannada', 'Noto Sans Kannada', 'Kalam'].map(f => [f, loaded(f)])),
      quietCalm: getComputedStyle(document.querySelector('[data-register="quiet"]')).getPropertyValue('--sg-dur-calm').trim(),
    };
  });
  const file = join(out, `${run.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  // A tight crop of the first panel, which is easier to judge closely.
  await page.locator('.panel').first().screenshot({ path: join(out, `${run.name}-panel.png`) });
  report.push({ run: run.name, file, errors, belowTarget: fails, woff2, ...facts });
  await ctx.close();
}
await browser.close();
server.close();

await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
for (const r of report) {
  const faces = Object.entries(r.fonts).filter(([, v]) => v).length;
  console.log(`${r.run.padEnd(22)} errors ${r.errors.length}  below target ${r.belowTarget}  width ${r.scrollWidth}/${r.innerWidth}  quiet calm ${r.quietCalm}  web faces ${faces}/6  woff2 ${r.woff2.length}`);
  for (const e of r.errors) console.log('   ', e);
}
if (report.some(r => r.errors.length || r.belowTarget || r.scrollWidth > r.innerWidth)) process.exitCode = 1;
