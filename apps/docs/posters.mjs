// Posters: a still of every piece that has something to show, in each
// register and theme, captured at build time so the index pages run nothing
// live (decision in docs/requests/2026-09-29-site-map.md).
//
//   const posters = await makePosters({ root, out, registry });
//   // -> { [registryName]: { w, h } }, files at <out>/posters/<name>.<register>.<theme>.jpg
//
// How each is taken:
//   a scene    the scene harness under reduced motion, so <sg-scene> draws its
//              own authored still (meta.stillTime), deterministic in every register;
//              the <sg-scene> element alone is photographed
//   a demo     the piece's demo.html (or a recipe's index.html) at a desk width,
//              scrolled past its own heading and lede the way the old gallery's
//              cards were, photographed at 0.64 scale
//   otherwise  no poster; the card is text only
//
// Captures are cached in .cache/posters/ under a key made from everything that
// can change the picture (the item's registry hash, its entry page, the tokens,
// fonts and harness), so a build only re-shoots what changed.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { REGISTERS, THEMES, slugOf } from './site.core.js';

const VERSION = '3'; // bump to re-shoot everything (a change to how posters are taken)
const DESK = { width: 760, height: 475 }; // a demo is shot at this viewport (narrow enough that its words read on a card)...
const DEMO_SCALE = 640 / 760; // ...and this device scale: a 640 x 400 picture
const SCENE_VIEW = { width: 720, height: 900 };
const CONCURRENCY = 4;

/** What a poster is taken from, or null. Pure. */
export function posterSource(item, fileExists) {
  if (item.type === 'scene') return { kind: 'scene', url: `/tools/harness/scene.html?name=${encodeURIComponent(slugOf(item))}&seed=1` };
  const dir = path.posix.dirname(item.manifest);
  for (const f of ['demo.html', 'index.html']) {
    if (fileExists(`${dir}/${f}`)) return { kind: 'demo', url: `/${dir}/${f}`, file: `${dir}/${f}`, pastHeading: f === 'demo.html' };
  }
  return null;
}

const hashFiles = (root, files) => {
  const h = crypto.createHash('sha256');
  for (const f of files) {
    const p = path.join(root, f);
    h.update(f);
    h.update(fs.existsSync(p) ? fs.readFileSync(p) : 'missing');
  }
  return h;
};

export async function makePosters({ root, out, registry, log = console.log }) {
  const cacheDir = path.join(root, '.cache', 'posters');
  fs.mkdirSync(cacheDir, { recursive: true });
  const shared = hashFiles(root, ['packages/tokens/tokens.css', 'packages/tokens/fonts.css', 'tools/harness/demo.js', 'tools/harness/scene.html', 'tools/harness/demo.css']).digest('hex');
  const exists = p => fs.existsSync(path.join(root, p));

  const jobs = [];
  for (const item of registry.items) {
    const src = posterSource(item, exists);
    if (!src) continue;
    const h = crypto.createHash('sha256').update(VERSION).update(shared).update(item.hash || '');
    if (src.file) h.update(fs.readFileSync(path.join(root, src.file)));
    const key = h.digest('hex').slice(0, 12);
    const stem = path.join(cacheDir, `${item.name}.${key}`);
    jobs.push({ item, src, stem });
  }

  const todo = jobs.filter(j => !fs.existsSync(`${j.stem}.json`));
  let shot = 0, failed = [];
  if (todo.length) {
    const { chromium } = await import('playwright');
    const { startServer } = await import('../../tools/serve.mjs');
    const server = await startServer({ root, quiet: true });
    const browser = await chromium.launch();
    try {
      const queue = [...todo];
      await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        for (let j = queue.shift(); j; j = queue.shift()) {
          try { await capture(browser, server.url, j); shot++; }
          catch (err) { failed.push(`${j.item.name}: ${String(err.message || err).split('\n')[0]}`); }
        }
      }));
    } finally {
      await browser.close();
      await server.close();
    }
  }

  // copy what exists into the site, and say what each poster measures
  const posters = {};
  const dest = path.join(out, 'posters');
  fs.mkdirSync(dest, { recursive: true });
  for (const j of jobs) {
    if (!fs.existsSync(`${j.stem}.json`)) continue;
    posters[j.item.name] = JSON.parse(fs.readFileSync(`${j.stem}.json`, 'utf8'));
    for (const r of REGISTERS) for (const t of THEMES) fs.copyFileSync(`${j.stem}.${r}.${t}.jpg`, path.join(dest, `${j.item.name}.${r}.${t}.jpg`));
  }
  // an old capture whose key no longer matches is dead weight: clear it
  const live = new Set(jobs.map(j => path.basename(j.stem)));
  for (const f of fs.readdirSync(cacheDir)) if (!live.has(f.split('.').slice(0, 2).join('.'))) fs.rmSync(path.join(cacheDir, f));

  log(`posters: ${Object.keys(posters).length} of ${jobs.length} pieces (${shot} shot now, ${jobs.length - todo.length} from the cache)${failed.length ? `; failed: ${failed.join('; ')}` : ''}`);
  return { posters, failed };
}

async function capture(browser, base, { item, src, stem }) {
  let size = null;
  for (const theme of THEMES) for (const register of REGISTERS) {
    const scene = src.kind === 'scene';
    const context = await browser.newContext({
      viewport: scene ? SCENE_VIEW : DESK,
      deviceScaleFactor: scene ? 1 : DEMO_SCALE,
      reducedMotion: 'reduce',
      colorScheme: theme,
    });
    try {
      const page = await context.newPage();
      const sep = src.url.includes('?') ? '&' : '?';
      await page.goto(`${base}${src.url}${sep}register=${register}&theme=${theme}`, { waitUntil: 'load', timeout: 30000 });
      // a page that declares itself unready (__ready === false) and never finishes has
      // nothing finished to photograph; one that does not take part (undefined) is loaded
      await page.waitForFunction(() => window.__ready !== false, null, { timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(settleMedia);
      // a scene's own play/pause corner button is a control, not part of the picture
      await page.addStyleTag({ content: 'sg-scene::part(toggle) { display: none !important; }' });
      await page.waitForTimeout(scene ? 300 : 500);
      const file = `${stem}.${register}.${theme}.jpg`;
      if (scene) {
        const el = page.locator('sg-scene').first();
        await el.screenshot({ path: file, type: 'jpeg', quality: 72, animations: 'disabled' });
        const box = await el.boundingBox();
        size ??= { w: Math.round(box.width), h: Math.round(box.height) };
      } else {
        if (src.pastHeading) await page.evaluate(scrollPastHeading);
        await page.screenshot({ path: file, type: 'jpeg', quality: 72, animations: 'disabled' });
        size ??= { w: Math.round(DESK.width * DEMO_SCALE), h: Math.round(DESK.height * DEMO_SCALE) };
      }
    } finally {
      await context.close();
    }
  }
  // the size file is written last: its presence means all six pictures exist
  fs.writeFileSync(`${stem}.json`, JSON.stringify(size));
}

// Runs in the page. Waits for every picture and player to load, then refuses the
// shot if one did not: a broken image's alt text or a player stuck at 0:00 is not
// a still of the piece. An <img> with no src is an empty slot, also not finished.
async function settleMedia() {
  const imgs = [...document.images];
  const vids = [...document.querySelectorAll('video')];
  await Promise.all([
    ...imgs.map(i => i.decode().catch(() => {})),
    ...vids.map(v => new Promise(res => {
      // a frame, not a buffering spinner: load it, then seek into it so one is on screen
      const seek = () => { v.addEventListener('seeked', res, { once: true }); v.currentTime = 0.1; };
      if (v.readyState >= 2) seek(); else v.addEventListener('loadeddata', seek, { once: true });
      v.addEventListener('error', res, { once: true });
      setTimeout(res, 5000);
    })),
  ]);
  const bad = [
    ...imgs.filter(i => !i.getAttribute('src') || !i.naturalWidth).map(i => `img ${i.id || i.alt || i.currentSrc}`),
    ...vids.filter(v => v.readyState < 2).map(v => `video ${v.id || v.currentSrc}`),
  ];
  if (bad.length) throw new Error(`unfinished media: ${bad.join(', ')}`);
}

// Runs in the page. A demo opens with its <h1> and the paragraphs right after
// it (the words the card already shows), then the examples: skip the heading
// and every <p> straight after it, and start at whatever comes next.
function scrollPastHeading() {
  const main = document.querySelector('main');
  const h1 = main?.querySelector(':scope > h1');
  if (!h1) return;
  let last = h1, bottom = h1.offsetTop + h1.offsetHeight;
  while (last.nextElementSibling?.tagName === 'P') {
    last = last.nextElementSibling;
    bottom = Math.max(bottom, last.offsetTop + last.offsetHeight);
  }
  scrollTo(0, Math.max(0, bottom));
}
