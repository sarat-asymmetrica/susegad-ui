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

const VERSION = '5'; // bump to re-shoot everything (a change to how posters are taken)
const DESK = { width: 760, height: 475 }; // a demo is shot at this viewport (narrow enough that its words read on a card)...
const DEMO_SCALE = 640 / 760; // ...and this device scale: a 640 x 400 picture
const SCENE_VIEW = { width: 720, height: 900 };
const CONCURRENCY = 4;
/** The formats of a poster, in the order a <picture> offers them; the last is the fallback. */
export const POSTER_FORMATS = ['avif', 'webp', 'jpg'];
const ENCODE = { avif: { quality: 55, effort: 4 }, webp: { quality: 78, effort: 4 }, jpg: { quality: 72, mozjpeg: true } };

/**
 * Pieces whose demo, photographed at rest, shows words and a bare button (the dialog is cropped through its
 * heading; the menu and the popover are one small button on an empty page). Each is photographed at the moment
 * it exists for instead: the steps run in the page after it settles, in the order written.
 *   unplaceholder:x (sample copy that says "Placeholder:" reads as a finished sample in the picture; the demo itself still says it)
 *   click:SEL  hover:SEL  focus:SEL  scroll:SEL (put it at the top of the picture)  center:SEL  css:RULES  wait-for:SEL  wait:MS
 * `past: false` keeps the demo at the top; the default scrolls past its heading and lede.
 */
export const POSTER_STAGES = {
  dialog: { steps: ['click:[data-sg-dialog=confirm]', 'wait-for:#confirm-dialog[open]', 'wait:900'], past: false },
  drawer: { steps: ['click:[data-sg-drawer=rooms]', 'wait-for:#rooms-dialog[open]', 'wait:900'], past: false },
  'action-menu': { steps: ['click:#account-trigger', 'wait-for:#account-menu:popover-open', 'wait:300'] },
  popover: { steps: ['click:[popovertarget=rates]', 'wait-for:#rates:popover-open', 'wait:300'] },
  tooltip: { steps: ['hover:#cancel-btn', 'wait:600'] },
  // the recipe's headline says Placeholder on purpose (it is sample copy); the picture shows the work, which is the recipe
  'studio-home': { steps: ['unplaceholder:x', 'scroll:#work', 'wait:400'], past: false },
  'now-note': { steps: ['unplaceholder:x', 'wait:300'] },
  // a quote with a name under it must never read as a real testimonial: the picture says (sample) beside each role, as studio-home does
  quote: { steps: ['unplaceholder:x', 'css:.sg-quote-role::after { content: " (sample)"; }', 'wait:300'] },
  postcard: { steps: ['unplaceholder:x', 'wait:300'] },
};

/**
 * The front door's own pictures: a signature of a piece, bigger than a card's poster, taken at the same
 * moment. name -> { of: the registry item it is taken from, steps, past }. Written beside the posters as
 * posters/<name>.<register>.<theme>.<format>, with their size in the map makePosters returns.
 */
export const SIGNATURES = {
  'sig-dialog': { of: 'dialog', ...POSTER_STAGES.dialog },
  'sig-ribbon': { of: 'date-range', steps: ['scroll:#stay', 'wait:400'], past: false },
  // five blooms, one per name, laid out big enough to read as a picture
  'sig-bloom': { of: 'bloom', steps: ['css:h1, h2, p { visibility: hidden; } .names { justify-content: center; gap: 14px; } .names sg-bloom { zoom: 2; }', 'center:.names', 'wait:400'], past: false },
};
const SIG_SCALE = 1.5;

const loadSharp = async () => { try { return (await import('sharp')).default; } catch { return null; } };

/** One shot as every format, beside `stem`. Pure of the page: bytes in, files out. Returns the formats written. */
export async function encodePoster(sharp, png, stem) {
  await Promise.all(POSTER_FORMATS.map(f => sharp(png)[f === 'jpg' ? 'jpeg' : f](ENCODE[f]).toFile(`${stem}.${f}`)));
  return POSTER_FORMATS;
}

/** What a poster is taken from, or null. Pure. */
export function posterSource(item, fileExists) {
  if (item.type === 'scene') return { kind: 'scene', url: `/tools/harness/scene.html?name=${encodeURIComponent(slugOf(item))}&seed=1` };
  const dir = path.posix.dirname(item.manifest);
  // a second manifest in a folder (veranda/stage.registry.json) is photographed
  // from its own page, never from the folder's main demo, which shows another piece
  const own = path.posix.basename(item.manifest).match(/^(.+)\.registry\.json$/)?.[1];
  const pages = own ? [`${own}.demo.html`, `${own}.html`] : ['demo.html', 'index.html'];
  for (const f of pages) {
    if (fileExists(`${dir}/${f}`)) return { kind: 'demo', url: `/${dir}/${f}`, file: `${dir}/${f}`, pastHeading: f !== 'index.html' };
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
    const stage = POSTER_STAGES[item.name];
    if (stage && src.kind === 'demo') { src.stage = stage; h.update(JSON.stringify(stage)); }
    const key2 = h.digest('hex').slice(0, 12);
    jobs.push({ item, src, stem: path.join(cacheDir, `${item.name}.${key2}`) });
  }
  for (const [name, spec] of Object.entries(SIGNATURES)) {
    const item = registry.items.find(i => i.name === spec.of);
    const src = item && posterSource(item, exists);
    if (!src) continue;
    const sig = { ...src, stage: spec, scale: SIG_SCALE };
    const h = crypto.createHash('sha256').update(VERSION).update(shared).update(item.hash || '').update(fs.readFileSync(path.join(root, src.file))).update(JSON.stringify(spec));
    jobs.push({ item: { ...item, name }, src: sig, stem: path.join(cacheDir, `${name}.${h.digest('hex').slice(0, 12)}`) });
  }

  const todo = jobs.filter(j => !fs.existsSync(`${j.stem}.json`));
  let shot = 0, failed = [];
  const sharp = todo.length ? await loadSharp() : null;
  if (todo.length && !sharp) log('posters: sharp is not installed, so only the JPG posters are written (no AVIF or WebP)');
  if (todo.length) {
    const { chromium } = await import('playwright');
    const { startServer } = await import('../../tools/serve.mjs');
    const server = await startServer({ root, quiet: true });
    const browser = await chromium.launch();
    try {
      const queue = [...todo];
      await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        for (let j = queue.shift(); j; j = queue.shift()) {
          try { await capture(browser, server.url, j, sharp); shot++; }
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
    for (const r of REGISTERS) for (const t of THEMES) for (const f of POSTER_FORMATS) {
      const from = `${j.stem}.${r}.${t}.${f}`;
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dest, `${j.item.name}.${r}.${t}.${f}`));
    }
  }
  // an old capture whose key no longer matches is dead weight: clear it
  const live = new Set(jobs.map(j => path.basename(j.stem)));
  for (const f of fs.readdirSync(cacheDir)) if (!live.has(f.split('.').slice(0, 2).join('.'))) fs.rmSync(path.join(cacheDir, f));

  log(`posters: ${Object.keys(posters).length} of ${jobs.length} pieces (${shot} shot now, ${jobs.length - todo.length} from the cache)${failed.length ? `; failed: ${failed.join('; ')}` : ''}`);
  return { posters, failed };
}

async function capture(browser, base, { item, src, stem }, sharp) {
  let size = null;
  for (const theme of THEMES) for (const register of REGISTERS) {
    const scene = src.kind === 'scene';
    const context = await browser.newContext({
      viewport: scene ? SCENE_VIEW : DESK,
      deviceScaleFactor: scene ? 1 : (src.scale || DEMO_SCALE),
      reducedMotion: 'reduce',
      colorScheme: theme,
    });
    try {
      const page = await context.newPage();
      const sep = src.url.includes('?') ? '&' : '?';
      await page.goto(`${base}${src.url}${sep}register=${register}&theme=${theme}`, { waitUntil: 'load', timeout: 30000 });
      // a scene page is undefined until the harness sets __ready = true after
      // sg-ready, so `!== false` here passed at once and the shot fired before
      // the scene had painted anything (D2, the blank posters). A scene must
      // actually be ready; a demo declares __ready = false first, so for it
      // `!== false` still waits properly and only refuses a page stuck unready.
      if (scene) await page.waitForFunction(() => window.__ready === true, null, { timeout: 35000 });
      else await page.waitForFunction(() => window.__ready !== false, null, { timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(settleMedia);
      // a scene's own play/pause corner button is a control, not part of the picture
      await page.addStyleTag({ content: 'sg-scene::part(toggle) { display: none !important; }' });
      await page.waitForTimeout(scene ? 300 : 500);
      const at = `${stem}.${register}.${theme}`;
      // a PNG when there is an encoder to make the three formats from it; a JPG straight from the browser when there is not
      const shoot = async (target, extra = {}) => {
        if (!sharp) return void await target.screenshot({ path: `${at}.jpg`, type: 'jpeg', quality: 72, animations: 'disabled', ...extra });
        await encodePoster(sharp, await target.screenshot({ type: 'png', animations: 'disabled', ...extra }), at);
      };
      if (scene) {
        const el = page.locator('sg-scene').first();
        await shoot(el);
        const box = await el.boundingBox();
        size ??= { w: Math.round(box.width), h: Math.round(box.height) };
      } else {
        if (src.pastHeading && src.stage?.past !== false) await page.evaluate(scrollPastHeading);
        if (src.stage) await runSteps(page, src.stage.steps);
        await shoot(page);
        const k = src.scale || DEMO_SCALE;
        size ??= { w: Math.round(DESK.width * k), h: Math.round(DESK.height * k) };
      }
    } finally {
      await context.close();
    }
  }
  // the size file is written last: its presence means all six pictures exist
  fs.writeFileSync(`${stem}.json`, JSON.stringify(size));
}

/** Runs a stage's steps (see POSTER_STAGES). A step that cannot run throws, so a poster is never a picture of the wrong moment. */
async function runSteps(page, steps = []) {
  for (const step of steps) {
    const at = step.indexOf(':');
    const [verb, arg] = [step.slice(0, at), step.slice(at + 1)];
    if (verb === 'click') await page.click(arg, { timeout: 8000 });
    else if (verb === 'hover') await page.hover(arg, { timeout: 8000 });
    else if (verb === 'focus') await page.focus(arg, { timeout: 8000 });
    else if (verb === 'scroll') await page.evaluate(sel => { const el = document.querySelector(sel); scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - 12)); }, arg);
    else if (verb === 'unplaceholder') await page.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeValue = n.nodeValue.replace(/Placeholder( quote)?: (\w)/g, (m, q, c) => c.toUpperCase()); })
    else if (verb === 'center') await page.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: 'center' }), arg);
    else if (verb === 'css') await page.addStyleTag({ content: arg });
    else if (verb === 'wait-for') await page.waitForSelector(arg, { state: 'visible', timeout: 8000 });
    else if (verb === 'wait') await page.waitForTimeout(Number(arg));
    else throw new Error(`poster step "${step}": I do not know "${verb}"`);
  }
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
