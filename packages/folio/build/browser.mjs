// Folio build: the parts that need a real browser. Chromium comes from
// Playwright, which the repo already has as a dev dependency.

import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

let shared = null;
export async function browser() { return (shared ??= await chromium.launch()); }
export async function closeBrowser() { await shared?.close(); shared = null; }

/** Wait until the page's sg-* elements are defined and its scenes have drawn. */
async function settle(page, ms = 1200) {
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    const tags = [...new Set([...document.querySelectorAll('*')].map(e => e.localName).filter(n => n.startsWith('sg-')))];
    await Promise.race([Promise.all(tags.map(t => customElements.whenDefined(t))), new Promise(r => setTimeout(r, 4000))]);
    try { await document.fonts.ready; } catch { /* no fonts API */ }
  });
  await page.waitForTimeout(ms);
}

/**
 * Render the source page and report what it uses: every character a person
 * can see or hear (text, including inside shadow roots, and alt, title,
 * aria-label, placeholder and value), and each font family, weight and style
 * that text is set in. Also any console errors, so a broken source is caught early.
 */
export async function usage(url, { register } = {}) {
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await settle(page);
  // Read on screen and again as print, since print can show words the screen does not.
  const read = () => page.evaluate(() => {
    // Runs of text by font: the family stack, weight and style, and every character set in it.
    const runs = new Map();
    const note = (el, text, pseudo) => {
      const cs = getComputedStyle(el, pseudo);
      const stack = cs.fontFamily.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, ''));
      const key = `${stack.join(',')}|${cs.fontWeight}|${cs.fontStyle}`;
      if (!runs.has(key)) runs.set(key, { stack, weight: +cs.fontWeight, style: cs.fontStyle, text: '' });
      runs.get(key).text += text;
    };
    const walk = root => {
      for (const el of root.querySelectorAll('*')) {
        let text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
        for (const a of ['alt', 'title', 'aria-label', 'placeholder', 'value', 'label']) if (el.getAttribute(a)) text += el.getAttribute(a);
        if (el.value && typeof el.value === 'string') text += el.value;
        if (el.localName === 'a' && el.getAttribute('href')) text += el.getAttribute('href'); // print shows each link's address
        if (text.trim()) note(el, text);
        // generated content: quoted strings as they are, and counters as any digit
        for (const pseudo of ['::before', '::after', '::marker']) {
          const c = getComputedStyle(el, pseudo).content;
          if (!c || c === 'none' || c === 'normal') continue;
          const words = [...c.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]).join('') + (/counter/.test(c) ? '0123456789' : '');
          if (words.trim()) note(el, words, pseudo);
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return [...runs.values()];
  });
  const title = await page.title();
  const screen = await read();
  await page.emulateMedia({ media: 'print' });
  const print = await read();
  await ctx.close();
  const runs = new Map();
  for (const r of [...screen, ...print]) {
    const key = `${r.stack.join(',')}|${r.weight}|${r.style}`;
    if (runs.has(key)) runs.get(key).text += r.text; else runs.set(key, { ...r });
  }
  const all = [...runs.values()];
  return { runs: all, text: all.map(r => r.text).join('') + title, errors };
}

/**
 * Load a built file under its own policy and collect the hashes Chromium asks
 * for: styles and scripts added at run time (a scene's shadow <style>, for one).
 * Exercises what a reader might do: load, reduced motion, and print.
 */
export async function cspProbe(file) {
  const b = await browser();
  const url = pathToFileURL(file).href;
  const hashes = new Set(), violations = [];
  for (const [reducedMotion, print] of [['no-preference', false], ['reduce', false], ['no-preference', true]]) {
    const ctx = await b.newContext({ reducedMotion });
    const page = await ctx.newPage();
    page.on('console', m => {
      const t = m.text();
      if (!/Content Security Policy/.test(t)) return;
      violations.push(t);
      for (const h of t.matchAll(/'sha256-([A-Za-z0-9+/=]+)'/g)) hashes.add(h[1]);
    });
    await page.goto(url);
    await settle(page, 800);
    if (print) {
      await page.emulateMedia({ media: 'print' });
      await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
      await page.waitForTimeout(500);
    }
    await ctx.close();
  }
  return { hashes: [...hashes], violations };
}

/**
 * Open the file with every network request refused and logged. A sealed
 * document should ask for nothing but itself.
 */
export async function blockedLoad(file) {
  const b = await browser();
  const url = pathToFileURL(file).href;
  const ctx = await b.newContext();
  const requests = [], errors = [], csp = [];
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u === url) return route.continue();
    requests.push(u);
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') (/Content Security Policy/.test(m.text()) ? csp : errors).push(m.text()); });
  await page.goto(url);
  await settle(page);
  const ready = await page.evaluate(() => ({
    scenes: document.querySelectorAll('sg-scene').length,
    drawn: [...document.querySelectorAll('sg-scene')].filter(s => s.shadowRoot?.querySelector('canvas, svg')).length,
  }));
  await ctx.close();
  return { requests, errors, csp, ...ready };
}

/** Print to PDF the way a reader's browser would: print media, scenes as stills, at 2x. */
export async function printPdf(file, out, { page: size = 'A4' } = {}) {
  const b = await browser();
  const ctx = await b.newContext({ deviceScaleFactor: 2, viewport: { width: size === 'Letter' ? 816 : 794, height: 1123 } });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(file).href);
  await settle(page, 600);
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
  await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
  await page.waitForTimeout(800);
  await page.pdf({ path: out, format: size, preferCSSPageSize: true, printBackground: true }); // the page's own @page size wins when it sets one
  await ctx.close();
}

/**
 * Encode a raster image for the document. WebP through Chromium's canvas;
 * AVIF only if the optional `sharp` package happens to be installed.
 * Returns the smaller of the new encoding and the original.
 */
export async function encodeImage(buf, mime, { maxWidth = 2000, quality = 0.8 } = {}) {
  try {
    const sharp = (await import('sharp')).default;
    const avif = await sharp(buf).resize({ width: maxWidth, withoutEnlargement: true }).avif({ quality: Math.round(quality * 60) }).toBuffer();
    if (avif.length < buf.length) return { buf: avif, mime: 'image/avif', how: 'AVIF (sharp)' };
  } catch { /* no sharp: WebP through the browser */ }
  const b = await browser();
  const page = await b.newPage();
  const out = await page.evaluate(async ({ b64, mime, maxWidth, quality }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: mime }));
    const k = Math.min(1, maxWidth / bmp.width);
    const c = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await c.convertToBlob({ type: 'image/webp', quality });
    const u8 = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return { b64: btoa(s), type: blob.type, w: c.width, h: c.height };
  }, { b64: buf.toString('base64'), mime, maxWidth, quality });
  await page.close();
  const webp = Buffer.from(out.b64, 'base64');
  return out.type === 'image/webp' && webp.length < buf.length ? { buf: webp, mime: 'image/webp', how: `WebP (Chromium), ${out.w}x${out.h}` } : { buf, mime, how: 'original (smaller than WebP)' };
}
