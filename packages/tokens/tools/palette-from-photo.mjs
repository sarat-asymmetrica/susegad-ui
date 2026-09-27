#!/usr/bin/env node
// Palette from photographs.
//
//   node packages/tokens/tools/palette-from-photo.mjs a.webp b.jpg --name casa --out palette.css
//
// Options
//   --name <n>        palette name, used as data-palette="<n>" (default: photo)
//   --out <file>      write the CSS block here (default: print it)
//   --json <file>     write the report here (default: next to --out, .json)
//   --compare casa    compare with the hand-made Casa palette in the report
//   --size <px>       longest side the photos are scaled to before sampling (default 320)
//
// Chromium (from Playwright, a dev dependency at the repo root) decodes the
// images, so any format the browser reads works: WebP, AVIF, JPEG, PNG. The
// colour work is the pure code in ../palette.js.

import { readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paletteFromPixels, paletteToCss, compareToReference, worstContrast } from '../palette.js';
import { palettes } from '../tokens.js';

const MIME = { '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };

function parseArgs(argv) {
  const opts = { files: [], name: 'photo', out: null, json: null, compare: null, size: 320 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name') opts.name = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--json') opts.json = argv[++i];
    else if (a === '--compare') opts.compare = argv[++i];
    else if (a === '--size') opts.size = +argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
    else opts.files.push(a);
  }
  return opts;
}

/**
 * Decode images to RGBA pixels in headless Chromium.
 * @param {string[]} files
 * @param {number} size longest side after scaling
 */
export async function decodeImages(files, size = 320) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const images = [];
    for (const file of files) {
      const mime = MIME[extname(file).toLowerCase()];
      if (!mime) throw new Error(`Cannot tell the image type of ${file}. Use .webp, .avif, .jpg, .png or .gif.`);
      const b64 = readFileSync(file).toString('base64');
      const img = await page.evaluate(async ({ b64, mime, size }) => {
        const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: mime }));
        const k = Math.min(1, size / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
        const cv = new OffscreenCanvas(w, h);
        const g = cv.getContext('2d', { colorSpace: 'srgb' });
        g.imageSmoothingQuality = 'high';
        g.drawImage(bmp, 0, 0, w, h);
        const data = g.getImageData(0, 0, w, h).data;
        let s = '';
        for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
        return { width: w, height: h, data: btoa(s) };
      }, { b64, mime, size });
      images.push({ width: img.width, height: img.height, data: Uint8Array.from(Buffer.from(img.data, 'base64')), file });
    }
    return images;
  } finally {
    await browser.close();
  }
}

/** The hand-made Casa palette, role by role, for --compare casa. */
export const casaReference = {
  reference: {
    paper: '#F4F0E6', 'paper-raised': '#FBF9F4', 'paper-deep': '#EAE4D6', rule: '#DED8C8',
    ink: '#2E2419', 'ink-soft': '#6A5F4E', 'ink-faint': palettes.casa.themed['ink-faint'].light.hex,
    teak: '#7E5F32', tile: '#8F4C20', pool: palettes.casa.roles.info.light.hex, moss: '#4C5A42', laterite: '#A4452C',
  },
  map: { teak: 'accent-text', tile: 'warning', pool: 'info', moss: 'success', laterite: 'danger' },
};

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.files.length) {
    console.log('Usage: node packages/tokens/tools/palette-from-photo.mjs <images...> [--name n] [--out palette.css] [--json report.json] [--compare casa] [--size 320]');
    process.exit(opts.help ? 0 : 1);
  }
  const images = await decodeImages(opts.files.map(f => resolve(f)), opts.size);
  const p = paletteFromPixels(images, { name: opts.name });
  const css = paletteToCss(p);
  const report = {
    name: p.name,
    files: opts.files,
    samples: p.samples,
    swatches: p.swatches,
    pigments: p.pigments,
    sources: p.sources,
    light: p.light,
    dark: p.dark,
    contrast: p.contrast,
    worst: worstContrast(p.contrast),
  };
  if (opts.compare === 'casa') report.comparison = compareToReference(p, casaReference.reference, casaReference.map);

  if (opts.out) {
    writeFileSync(opts.out, css);
    const json = opts.json ?? opts.out.replace(/\.css$/i, '') + '.json';
    writeFileSync(json, JSON.stringify(report, null, 2) + '\n');
    console.log(`wrote ${opts.out} and ${json}`);
  } else {
    process.stdout.write(css);
    if (opts.json) writeFileSync(opts.json, JSON.stringify(report, null, 2) + '\n');
  }
  const w = report.worst;
  console.log(`${p.samples} samples from ${images.length} image${images.length === 1 ? '' : 's'}; lowest text contrast ${w.ratio}:1 (${w.role} on ${w.ground}, ${w.theme})`);
  if (report.comparison) {
    console.log('role          hand     photo    ΔE');
    for (const r of report.comparison) console.log(`${r.role.padEnd(13)} ${r.reference}  ${r.extracted}  ${r.deltaE}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(err => { console.error(err.message); process.exit(1); });
}
