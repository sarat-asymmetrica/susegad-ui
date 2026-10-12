// Browser checks for <sg-gallery>: axe in every register and theme, the
// consent-pending frames (frame, count, never the image, never a control),
// the native dialog by keyboard, no JavaScript, 390 px, reduced motion,
// and a control probe that can fail.
//
//   node packages/components/gallery/gallery.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';
import { readFile } from 'node:fs/promises';

const { server, browser, engine, check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/gallery/demo.html';

// The demo's sample photographs are the library's scene posters. They live in
// the built docs site, not in the worktree, so any /posters/ request is served
// from there (the harness server serves this repo root).
const POSTER_DIR = 'C:/Projects/susegad-ui/out/docs/posters';
const posterFile = u => `${POSTER_DIR}/${u.split('/').pop()}`;
async function routePosters(page) {
  await page.route('**/posters/**', r => readFile(posterFile(r.request().url()))
    .then(body => r.fulfill({ contentType: 'image/jpeg', body }))
    .catch(() => r.fulfill({ status: 404, contentType: 'text/plain', body: 'no poster' })));
}
/** Open a demo path with the posters served. */
async function demo(path, opts = {}) {
  const ctx = await browser.newContext(contextOptions(engine, {
    viewport: { width: opts.width ?? 1280, height: 900 },
    javaScriptEnabled: opts.js ?? true,
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
  }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await routePosters(page);
  await page.goto(`${server.url}${path}`);
  if (opts.js ?? true) await page.waitForFunction(() => window.__ready !== false, null, { timeout: 10000 });
  return { ctx, page, errors };
}

// ── axe: every register, both themes, with and without JavaScript ───────
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await demo(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await demo(`${DEMO}?register=${register}&theme=dark`, { reduced: register === 'playful' });
  await settle(page);
  const v = await axe(page);
  check(`axe, dark, ${register} on its own${register === 'playful' ? ' with reduced motion' : ''}: 0 violations`, !v.length, v.join('; '));
  await ctx.close();
}
{
  const { ctx, page } = await demo(`${DEMO}?register=quiet`, { js: false });
  await page.waitForLoadState('load');
  const html = await page.evaluate(() => { document.querySelectorAll('script').forEach(s => s.remove()); return '<!doctype html>' + document.documentElement.outerHTML; });
  await ctx.close();
  const copy = await openHtml(`gallery-nojs-${Math.random().toString(36).slice(2)}`, html.replace('<head>', `<head><base href="${server.url}${DEMO}">`));
  await copy.page.waitForLoadState('load');
  await routePosters(copy.page);
  const v = await axe(copy.page);
  check('axe without JavaScript: 0 violations', !v.length, v.join('; '));
  await copy.ctx.close();
}

// ── consent pending: the frame, the count, never the image ──────────────
// The probe every pending slot must pass. It is also the control later.
const pendingProbe = page => page.evaluate(() => [...document.querySelectorAll('sg-gallery')].map(g => ({
  pending: [...g.querySelectorAll('.sg-gallery-slot[data-consent="pending"]')].map(s => ({
    frame: !!s.querySelector('.sg-gallery-frame'),
    strokes: s.querySelector('.sg-gallery-frame')?.childElementCount ?? 0,   // 4 hand-drawn corners in warm/playful
    count: s.querySelector('.sg-gallery-count')?.textContent ?? '',
    img: s.querySelector('img')?.getAttribute('src') ?? null,   // null is good: absent, or no src
    focusable: !!s.querySelector('button, [tabindex], a'),
  })),
  granted: [...g.querySelectorAll('.sg-gallery-slot[data-consent="granted"]')].map(s => ({
    img: s.querySelector('img')?.getAttribute('src') ?? null,   // a src is good here
    button: !!s.querySelector('button.sg-gallery-open'),
  })),
})));

for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await demo(`${DEMO}?register=${register}`);
  await settle(page);
  const r = await pendingProbe(page);
  const bad = r.flatMap(g => g.pending).find(s => s.img !== null || !s.frame || !s.count || s.focusable);
  check(`${register}: every pending slot shows its frame and its count, and never an image or a control`, !bad, JSON.stringify(bad ?? r[0]));
  const counts = await page.evaluate(() => [...document.querySelectorAll('.sg-gallery-count')].map(c => c.textContent));
  check(`${register}: the count line reads "n photos, coming soon" and matches the slot's own gallery`, counts.length === 5 && counts.every(c => /^(1 photo|2 photos|3 photos), coming soon$/.test(c)), JSON.stringify(counts.slice(0, 3)));
  const strokes = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.sg-gallery-slot[data-consent="pending"] .sg-gallery-frame')].map(f => f.childElementCount)));
  check(`${register}: the frames are drawn in code (${register === 'quiet' ? 'ruled corners in CSS, 0 SVG strokes' : '4 hand-drawn corner strokes each, aria-hidden'})`, strokes === (register === 'quiet' ? 0 : 4), `${strokes} strokes`);
  const granted = await page.evaluate(() => [...document.querySelectorAll('.sg-gallery-slot[data-consent="granted"]')].every(s => s.querySelector('button.sg-gallery-open img')?.getAttribute('src')));
  check(`${register}: granted photographs show (a real src, behind a button)`, granted);
  await ctx.close();
}
{
  // the consent line in words: each pending slot's caption is still there beside the count
  const { ctx, page } = await demo(`${DEMO}?register=warm`);
  const caps = await page.evaluate(() => [...document.querySelectorAll('.sg-gallery-slot[data-consent="pending"]')].map(s => (s.querySelector('figcaption')?.textContent ?? '').trim()));
  check('pending slots keep their captions as real text (5 pending slots, all named)', caps.length === 5 && caps.every(c => c.length > 4), JSON.stringify(caps));
  await ctx.close();
}

// ── the control: the same probe on markup the element never touched ─────
{
  const PLAIN = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title>
    <link rel="stylesheet" href="/packages/tokens/fonts.css"><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/gallery/gallery.css"></head><body>
    <figure class="sg-gallery-slot"><img src="/posters/scene-paus.warm.light.jpg" alt="Rain on tiles" width="300" height="188"><figcaption>Rain on tiles</figcaption></figure>
    </body></html>`;
  const { ctx, page } = await openHtml('gallery-control', PLAIN);
  await page.waitForLoadState('load');
  await routePosters(page);
  const img = await page.evaluate(() => document.querySelector('figure img')?.getAttribute('src') ?? null);
  const frame = await page.evaluate(() => !!document.querySelector('.sg-gallery-frame'));
  check('control: the same "never the image" probe on a plain figure (the element never touched it) reads img present and no frame, so the probe above can fail', img !== null && !frame, `img ${img}, frame ${frame}`);
  await ctx.close();
}

// ── the dialog: opened by keyboard, closed by Escape, focus back ────────
async function tabTo(page, sel, max = 20) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(s => document.activeElement?.matches(s), sel)) return i + 1;
  }
  return 0;
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await demo(`${DEMO}?register=${register}`);
  await settle(page);
  const presses = await tabTo(page, '.sg-gallery-open');
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
  check(`${register}: Tab reaches a photograph (${presses} presses) and it shows a focus ring`, presses > 0 && ring, `presses ${presses}, ring ${ring}`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('sg-gallery dialog[open]', { timeout: 3000 });
  const dlg = await page.evaluate(() => { const d = document.querySelector('sg-gallery dialog[open]'); return { method: d.matches('dialog'), caption: d.querySelector('figcaption')?.textContent, named: d.matches('[aria-label]'), close: !!d.querySelector('.sg-gallery-close'), src: d.querySelector('img')?.getAttribute('src') }; });
  const expected = await page.evaluate(() => document.querySelector('sg-gallery .sg-gallery-slot[data-consent="granted"] figcaption').textContent);
  check(`${register}: Enter opens the native <dialog> with the photograph and its caption`, dlg.method && !!dlg.src && dlg.caption === expected && dlg.named, JSON.stringify(dlg));
  check(`${register}: the dialog's caption is the slot's caption, word for word`, dlg.caption === expected, `"${dlg.caption}" vs "${expected}"`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('sg-gallery dialog[open]'), null, { timeout: 3000 });
  const back = await page.evaluate(() => document.activeElement?.className);
  check(`${register}: Escape closes the dialog and focus returns to the opener`, /sg-gallery-open/.test(back), back);
  await ctx.close();
}
{
  // a pending slot never opens: nothing in it is focusable, so Tab skips the frame entirely
  const { ctx, page } = await demo(`${DEMO}?register=warm`);
  await settle(page);
  const n = await page.evaluate(() => document.querySelectorAll('sg-gallery .sg-gallery-slot[data-consent="pending"] button, sg-gallery .sg-gallery-slot[data-consent="pending"] [tabindex]').length);
  check('a consent-pending slot never opens: it holds no button and nothing focusable', n === 0, `${n}`);
  await ctx.close();
}

// ── no JavaScript ───────────────────────────────────────────────────────
{
  const { ctx, page } = await demo(`${DEMO}?register=quiet`, { js: false });
  await page.waitForLoadState('load');
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-gallery')].map(g => ({
    photos: [...g.querySelectorAll('img')].every(i => (i.getAttribute('src') || '').length > 4),
    visible: [...g.querySelectorAll('img')].every(i => i.getClientRects().length > 0),
    written: [...g.querySelectorAll('.sg-gallery-slot[data-consent="pending"] figcaption')].every(c => (c.textContent || '').trim().length > 4),
  })));
  check('without JavaScript: photographs show from their own src, pending slots show their written captions', r.length === 3 && r.every(x => x.photos && x.visible && x.written), JSON.stringify(r.find(x => !(x.photos && x.visible && x.written)) ?? r[0]));
  await ctx.close();
}

// ── 390 px: no sideways scroll, one column, frames still drawn ──────────
{
  const { ctx, page } = await demo(`${DEMO}?register=warm`, { width: 390 });
  await settle(page);
  const r = await page.evaluate(() => {
    const g = document.querySelector('sg-gallery');
    return { scrollW: document.documentElement.scrollWidth, cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, tilt: getComputedStyle(g.querySelector('.sg-gallery-slot')).rotate };
  });
  check('at 390 px the demo does not scroll sideways', r.scrollW <= 390, `${r.scrollW}`);
  check('at 390 px the grid is a single column', r.cols === 1, `${r.cols} columns`);
  await ctx.close();
}

// ── reduced motion: everything still ────────────────────────────────────
{
  const { ctx, page } = await demo(`${DEMO}?register=playful`, { reduced: true });
  await settle(page);
  const loops = await page.evaluate(() => document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations === Infinity).length);
  await page.hover('.sg-gallery-open');
  await settle(page);
  const tilt = await page.evaluate(() => getComputedStyle(document.querySelector('sg-gallery .sg-gallery-slot')).rotate);
  check('reduced motion: nothing loops, and the playful lean does not apply', loops === 0 && (tilt === 'none' || tilt === '0deg'), `${loops} loops, rotate ${tilt}`);
  await ctx.close();
  const full = await demo(`${DEMO}?register=playful`);
  await settle(full.page);
  const rot = await full.page.evaluate(() => getComputedStyle(document.querySelector('sg-gallery .sg-gallery-slot')).rotate);
  check('control: with motion the playful slots do lean (so the reduced probe can tell them apart)', rot !== 'none' && rot !== '0deg' && rot.includes('deg'), rot);
  await full.ctx.close();
}

// ── 3.1.2: the gallery's own words come from the shared strings table, in the page's language ──
// The demo is served with its <html lang> changed to Konkani in Romi. "Close" is in that table in Konkani and
// must show as such, and so must the two names that also hold the author's own words (", open larger" and
// ", a photograph", each with a Konkani twin now). They carry no lang of their own: the page's lang stands.
for (const [tag, want] of [['en', 'Close'], ['gom-Latn', 'Bond korchem'], ['gom-Deva', 'बंद करचें']]) {
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1280, height: 900 } }));
  const page = await ctx.newPage();
  await routePosters(page);
  await page.route('**/gallery/demo.html*', async r => {
    const res = await r.fetch();
    r.fulfill({ response: res, body: (await res.text()).replace('<html lang="en">', `<html lang="${tag}">`) });
  });
  await page.goto(`${server.url}${DEMO}?register=quiet`);
  await page.waitForFunction(() => window.__ready !== false);
  await settle(page);
  await page.locator('.sg-gallery-slot[data-consent="granted"] button.sg-gallery-open').first().click();
  await page.waitForFunction(() => document.querySelector('dialog.sg-gallery-dialog')?.open);
  const got = await page.evaluate(() => {
    const close = document.querySelector('.sg-gallery-close'), op = document.querySelector('.sg-gallery-slot[data-consent="granted"] button.sg-gallery-open');
    return { close: close.textContent, closeLang: close.getAttribute('lang'), open: op.getAttribute('aria-label'), openLang: op.getAttribute('lang'), dlg: document.querySelector('dialog.sg-gallery-dialog').getAttribute('aria-label'), dlgLang: document.querySelector('dialog.sg-gallery-dialog').getAttribute('lang') };
  });
  check(`lang ${tag}: the Close button reads "${want}"`, got.close === want, got.close);
  const names = { en: [o => o.endsWith(', open larger'), d => d.endsWith(', a photograph')], 'gom-Latn': [o => o.endsWith(', vhodd korun ugodchem'), d => d.startsWith('Foto: ')], 'gom-Deva': [o => o.endsWith(', व्हड करून उगडचें'), d => d.startsWith('फोटो: ')] }[tag];
  check(`lang ${tag}: the opener and viewer names are in the page language (the Konkani twins of ", open larger" and ", a photograph"), no blanks or keys`, names[0](got.open) && names[1](got.dlg), `${got.open.slice(-30)} | ${got.dlg.slice(0, 40)}`);
  await ctx.close();
}

await done();
