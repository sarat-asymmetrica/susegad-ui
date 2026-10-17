// The front door's before-and-after shots: a handful of pages of the BUILT site (out/docs),
// at 390 and 1440, in every register and both themes, as full-page PNGs, plus a first-screen PNG
// per cell, tiled into one labelled contact sheet per page. It also prints each cell's header
// height and sideways scroll, so a number stands beside every picture.
//
//   node apps/docs/door-shots.mjs --out .shots/pack/door-before [--pages /,/start,/components/dialog]
//
// Takes a machine browser slot (tools/lib/slots.mjs). Build the site first (npm run docs:build).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { startServer } from '../../tools/serve.mjs';
import { acquireSlot } from '../../tools/lib/slots.mjs';
import { measureOverflow } from '../../tools/lib/overflow.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(ROOT, arg('out', '.shots/pack/door'));
const pages = arg('pages', '/,/start,/components/dialog,/scenes/kantar,/foundations').split(',');
const REGISTERS = ['quiet', 'warm', 'playful'], THEMES = ['light', 'dark'];
const VIEWS = [{ w: 1440, h: 900, touch: false }, { w: 390, h: 844, touch: true }];
const slug = p => (p === '/' ? 'home' : p.replace(/^\//, '').replace(/\//g, '-'));

fs.mkdirSync(out, { recursive: true });
const release = await acquireSlot({ label: 'door-shots' });
const server = await startServer({ root: path.join(ROOT, 'out', 'docs'), quiet: true, notFoundHtml: '404.html' });
const browser = await chromium.launch();
const facts = [];
try {
  for (const p of pages) {
    const cells = [];
    for (const v of VIEWS) for (const theme of THEMES) for (const register of REGISTERS) {
      const ctx = await browser.newContext({
        viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.touch ? 2 : 1, hasTouch: v.touch, isMobile: v.touch,
        colorScheme: theme,
      });
      await ctx.addInitScript(prefs => { try { localStorage.setItem('sg-docs-prefs', JSON.stringify(prefs)); } catch {} }, { register, theme, palette: 'susegad' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(server.url + p, { waitUntil: 'load' });
      try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 }); } catch { errors.push('never set __ready'); }
      await page.evaluate(() => document.fonts.ready);
      // a full-page shot shows every picture: lazy ones are asked for now and waited for
      await page.evaluate(async () => {
        const imgs = [...document.images];
        imgs.forEach(i => { i.loading = 'eager'; });
        await Promise.all(imgs.map(i => i.decode().catch(() => {})));
      });
      await page.waitForTimeout(700);
      const name = `${slug(p)}-${v.w}-${register}-${theme}`;
      const first = path.join(out, `${name}.png`);
      await page.screenshot({ path: first, animations: 'allow' });
      const fullFile = path.join(out, `${name}-full.png`);
      await page.screenshot({ path: fullFile, fullPage: true, animations: 'allow' });
      const m = await page.evaluate(() => ({ bar: document.querySelector('header.bar')?.getBoundingClientRect().height ?? null, vh: innerHeight, docH: document.documentElement.scrollHeight }));
      const ov = await page.evaluate(measureOverflow, { width: v.w });
      facts.push({ page: p, view: v.w, register, theme, header: Math.round(m.bar), headerPct: Math.round((m.bar / m.vh) * 1000) / 10, docHeight: m.docH, overflow: ov.overflow, errors });
      cells.push({ name, file: first, label: `${v.w} ${register} ${theme} · header ${Math.round(m.bar)}px` });
      await ctx.close();
    }
    // contact sheet: 1440 cells (3 across, 2 rows by theme) then 390 cells (6 across), scaled to a fixed cell height
    const tile = async (cs, w, h) => Promise.all(cs.map(async c => ({
      input: await sharp(c.file).resize(w, h, { fit: 'contain', background: '#888' }).toBuffer(),
      label: c.label,
    })));
    const wide = await tile(cells.filter(c => c.name.includes('-1440-')), 480, 300);
    const narrow = await tile(cells.filter(c => c.name.includes('-390-')), 180, 390);
    const W = 480 * 3, H = 300 * 2 + 390 + 40;
    const comps = [];
    wide.forEach((t, i) => comps.push({ input: t.input, left: (i % 3) * 480, top: Math.floor(i / 3) * 300 }));
    narrow.forEach((t, i) => comps.push({ input: t.input, left: i * 180 + 180 / 2 * 0, top: 600 + 20 }));
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(W, 180 * 6)}" height="${H}"><text x="8" y="${600 + 14}" font-family="sans-serif" font-size="12" fill="#fff">390 px: quiet, warm, playful light then dark</text><text x="8" y="14" font-family="sans-serif" font-size="12" fill="#fff"></text></svg>`);
    await sharp({ create: { width: Math.max(W, 180 * 6), height: H, channels: 3, background: '#222' } })
      .composite([...comps, { input: svg, left: 0, top: 0 }]).png().toFile(path.join(out, `${slug(p)}-sheet.png`));
  }
} finally {
  await browser.close();
  await server.close();
  release();
}
fs.writeFileSync(path.join(out, 'facts.json'), JSON.stringify(facts, null, 1));
for (const f of facts.filter(x => x.view === 390 && x.register === 'quiet' && x.theme === 'light')) console.log(`${f.page.padEnd(22)} 390 quiet light: header ${f.header}px (${f.headerPct}% of the viewport), page ${f.docHeight}px tall, sideways ${f.overflow}px, errors ${f.errors.length}`);
const bad = facts.filter(f => f.overflow > 0 || f.errors.length);
console.log(`${facts.length} cells in ${path.relative(ROOT, out)}; ${bad.length} with sideways scroll or errors`);
for (const f of bad.slice(0, 12)) console.log(`  ${f.page} ${f.view} ${f.register} ${f.theme}: overflow ${f.overflow}px ${f.errors.slice(0, 2).join(' | ')}`);
