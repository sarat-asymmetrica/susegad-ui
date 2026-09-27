// Curate screenshots for the repo: node tools/curate.mjs <dir>. Converts every PNG in <dir> to
// WebP (quality 0.86, at most 1100px wide) with Chromium's encoder and removes the PNG.
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const dir = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.png'))) {
  const src = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
  const out = await p.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    const s = Math.min(1, 1100 / img.width); const c = document.createElement('canvas');
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.86).split(',')[1];
  }, src);
  fs.writeFileSync(path.join(dir, f.replace(/\.png$/, '.webp')), Buffer.from(out, 'base64'));
  fs.unlinkSync(path.join(dir, f));
}
await b.close();
