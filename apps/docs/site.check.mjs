// The site map's gates: every page short enough to take in, index pages that
// run nothing live, one live drawing per scene page, every item reachable,
// old links still landing. Runs against the built copy served at the root,
// the shape Workers serves (wrangler.jsonc).
//
//   node apps/docs/build.mjs --no-verify && node apps/docs/site.check.mjs
//   node apps/docs/site.check.mjs --out <dir>   check another build (a control)
//
// Exits non-zero on any failure. Written before the redesign and run against
// the old build first, where the length and live-count gates must fail.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer, REPO_ROOT } from '../../tools/serve.mjs';
import { sidewaysScroll } from '../../tools/lib/overflow.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(REPO_ROOT, 'out', 'docs');
const registry = JSON.parse(fs.readFileSync(path.join(OUT, 'registry', 'registry.json'), 'utf8'));
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const KINDS = { scene: 'scenes', component: 'components', recipe: 'recipes', template: 'templates', package: 'foundations', surface: 'foundations' };
const slug = item => (item.type === 'scene' ? item.name.replace(/^scene-/, '') : item.type === 'template' ? item.name.replace(/^template-/, '') : item.name);
const INDEXES = ['/scenes', '/components', '/recipes', '/foundations', '/pencil-box'];

const server = await startServer({ root: OUT, quiet: true, notFoundHtml: '404.html' });
const browser = await chromium.launch();
let failed = 0, passed = 0;
const check = (name, ok, detail = '') => {
  ok ? passed++ : failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

async function open(urlPath, { width = 1440, height = 900, register = 'warm', theme = 'light' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
  await context.addInitScript(p => { try { localStorage.setItem('sg-docs-prefs', p); } catch {} }, JSON.stringify({ register, theme, palette: 'susegad' }));
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  let reqs = 0, bytes = 0;
  page.on('response', async r => { reqs++; try { bytes += (await r.body()).length; } catch {} });
  const resp = await page.goto(server.url + urlPath, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const first = { reqs, kb: Math.round(bytes / 1024) };
  return { context, page, errors, status: resp?.status(), first, totals: () => ({ reqs, kb: Math.round(bytes / 1024) }) };
}

/** Scroll to the end, letting lazy content grow the page, and return its full height in screens. */
async function scrollAll(page, height) {
  let y = 0, H = 0;
  for (let i = 0; i < 400; i++) {
    H = await page.evaluate(() => document.documentElement.scrollHeight);
    if (y >= H) break;
    y += height;
    await page.evaluate(v => scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(800);
  return H / height;
}

const liveCount = page => page.evaluate(() => ({
  iframes: document.querySelectorAll('iframe').length,
  scenes: [...document.querySelectorAll('sg-scene')].filter(s => !s.closest('dialog')).length,
}));

async function axe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map(v => `${v.id} x${v.nodes.length}`));
}

try {
  // ── 1. the home page is short, on a desk and in a hand ──────────────
  for (const [width, height, max] of [[1440, 900, 4], [390, 844, 8]]) {
    const { context, page, errors, status } = await open('/', { width, height });
    const screens = await scrollAll(page, height);
    const live = await liveCount(page);
    check(`home at ${width}px is at most ${max} screens`, status === 200 && screens <= max, `${screens.toFixed(1)} screens`);
    check(`home at ${width}px runs at most one live drawing and no iframes`, live.scenes <= 1 && live.iframes === 0, JSON.stringify(live));
    check(`home at ${width}px: no errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await context.close();
  }

  // ── 2. the index pages run nothing live and link every item ────────
  for (const p of INDEXES) {
    const { context, page, errors, status, first } = await open(p);
    const screens = await scrollAll(page, 900);
    const live = await liveCount(page);
    const links = await page.evaluate(() => [...document.querySelectorAll('main a[href]')].map(a => new URL(a.href).pathname));
    const md = links.filter(l => l.endsWith('.md'));
    check(`${p}: no links to raw .md files once rendered`, status === 200 && md.length === 0, md.slice(0, 3).join(', '));
    check(`${p}: 200, nothing live after a full scroll`, status === 200 && live.scenes === 0 && live.iframes === 0, `${JSON.stringify(live)}, ${screens.toFixed(1)} screens, first view ${first.reqs} req ${first.kb} KB`);
    check(`${p}: no errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    const kind = Object.entries(KINDS).find(([, k]) => `/${k}` === p)?.[0];
    if (kind) {
      const want = registry.items.filter(i => i.type === kind || (kind === 'package' && i.type === 'surface')).map(i => `/${KINDS[kind]}/${slug(i)}`);
      const missing = want.filter(w => !links.includes(w));
      check(`${p}: links all ${want.length} of its items`, missing.length === 0, missing.length ? `missing ${missing.slice(0, 5).join(', ')}` : '');
    }
    await context.close();
  }

  // ── 3. every item has a page; a scene page runs exactly one drawing ─
  const pages = registry.items.map(i => `/${KINDS[i.type]}/${slug(i)}`);
  const statuses = await Promise.all(pages.map(p => fetch(server.url + p).then(r => r.status, () => 0)));
  const bad = pages.filter((p, i) => statuses[i] !== 200);
  check(`all ${pages.length} item pages answer 200`, bad.length === 0, bad.slice(0, 6).join(', '));

  for (const name of ['paus', 'tinto', 'veranda']) {
    const { context, page, errors, status } = await open(`/scenes/${name}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 }).catch(() => {});
    const live = await liveCount(page);
    const screens = await page.evaluate(() => document.documentElement.scrollHeight / innerHeight);
    const drawn = await page.evaluate(() => !!document.querySelector('main sg-scene')?.shadowRoot?.querySelector('canvas, svg'));
    check(`/scenes/${name}: one live drawing, drawn`, status === 200 && live.scenes === 1 && drawn, JSON.stringify(live));
    check(`/scenes/${name}: at most 2 screens with the disclosures closed`, status === 200 && screens <= 2, `${screens.toFixed(2)} screens`);
    check(`/scenes/${name}: no errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await context.close();
  }

  // ── 3b. Look closer on a scene page: focus in, Escape, focus back, the same canvas ─
  for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    await page.goto(`${server.url}/scenes/paus`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 }).catch(() => {});
    const trigger = page.getByRole('button', { name: 'Look closer' });
    const found = await trigger.count();
    let inside = {}, after = {};
    if (found) {
      await trigger.focus();
      // remember the scene's own canvas, to prove the move does not rebuild it
      await page.evaluate(() => { window.__canvas = document.querySelector('main sg-scene')?.shadowRoot?.querySelector('.stage canvas, .stage svg'); });
      await page.keyboard.press('Enter');
      // a scene held back (reduced motion, quiet) is started by this very press, so it opens a moment later
      await page.waitForFunction(() => document.getElementById('closer').open, null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);
      // a held scene had no canvas to remember before the press: take the one it has now, then see it come home unchanged
      await page.evaluate(() => { window.__canvas ??= document.querySelector('#closer-slot sg-scene')?.shadowRoot?.querySelector('.stage canvas, .stage svg'); });
      inside = await page.evaluate(() => ({ open: document.getElementById('closer').open, focus: document.activeElement?.id, moved: !!document.querySelector('#closer-slot sg-scene') }));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      after = await page.evaluate(() => ({
        open: document.getElementById('closer').open,
        focus: document.activeElement?.textContent,
        home: !document.querySelector('#closer-slot sg-scene') && !document.querySelector('.stage-hold'),
        same: !!window.__canvas && window.__canvas === document.querySelector('main sg-scene')?.shadowRoot?.querySelector('.stage canvas, .stage svg'),
      }));
    }
    check(`Look closer${reduced ? ' (reduced motion)' : ''}: opens on Close, Escape brings focus back, the scene is moved not rebuilt`,
      found && inside.open && inside.focus === 'closer-close' && inside.moved && !after.open && after.focus === 'Look closer' && after.home && after.same,
      found ? `${JSON.stringify(inside)} then ${JSON.stringify(after)}` : 'no Look closer button');
    await context.close();
  }

  // ── 3c. a scene page does not jump when its poster settles, at 390 px ─
  // The poster's width lived in a sheet adopted by script, so the page laid the poster out at its attribute size
  // (688 px on a 390 px screen) and shrank it when the script arrived: CLS 0.110, and a sideways scroll with script off.
  // The loader is held back 2.5 s here, as on a slow phone, and a frame loop reads the poster's box every frame (a headed
  // browser paints that often; an idle headless page may not paint until the script is in, which hides the jump).
  for (const [scene, register] of [['abri', 'warm'], ['paus', 'warm'], ['abri', 'quiet']]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(r => {
      try { localStorage.setItem('sg-docs-prefs', JSON.stringify({ register: r })); } catch { /* no storage */ }
      window.__cls = 0; window.__wide = 0;
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      const tick = () => { const i = document.querySelector('sg-lazy img'); if (i) window.__wide = Math.max(window.__wide, Math.round(i.getBoundingClientRect().width)); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, register);
    await page.route('**/packages/core/lazy.js', async r => { await new Promise(res => setTimeout(res, 2500)); await r.continue(); });
    await page.goto(`${server.url}/scenes/${scene}`, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const o = await sidewaysScroll(page);
    const m = { ...(await page.evaluate(() => ({ cls: window.__cls, wide: window.__wide }))), inner: o.viewWidth, scroll: o.scrollWidth };
    check(`/scenes/${scene} at 390px ${register}: the poster never outgrows the screen and the layout shift is under 0.1`, m.wide <= m.inner && m.scroll <= m.inner && m.cls < 0.1, `CLS ${m.cls.toFixed(3)}, widest poster ${m.wide} px, scrollWidth ${m.scroll}`);
    await context.close();
  }

  // ── 3d. Play stays under the finger: pressing it on a held scene does not move it, or the words below ─
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${server.url}/scenes/abri`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 }).catch(() => {});
    const box = () => page.evaluate(() => { const b = document.querySelector('[data-act="pause"]').getBoundingClientRect(), t = document.querySelector('.scene-text').getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), textTop: Math.round(t.top), scroll: scrollY }; });
    const before = await box();
    await page.click('[data-act="pause"]');
    const busy = await page.evaluate(() => ({ busy: document.querySelector('.scene-art .controls').getAttribute('aria-busy'), said: document.querySelector('.scene-art .live').textContent }));
    await page.waitForFunction(() => document.querySelector('sg-lazy').dataset.state === 'live', null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    const after = await box();
    const label = await page.evaluate(() => document.querySelector('[data-act="pause"]').textContent);
    check('Play on a held scene: the button stays where it was pressed, the words below do not move, and it says it is loading', before.x === after.x && before.y === after.y && before.textTop === after.textTop && label === 'Pause' && busy.said === 'loading the scene',
      `before ${JSON.stringify(before)}, after ${JSON.stringify(after)}, while loading ${JSON.stringify(busy)}, then "${label}"`);
    await context.close();
  }

  // ── 4. no raw Markdown links; a page never dead-ends ────────────────
  const htmlFiles = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['packages', 'tools', 'registry', 'posters'].includes(e.name)) walk(p); }
      else if (e.name.endsWith('.html')) htmlFiles.push(p);
    }
  })(OUT);
  const mdLinks = htmlFiles.flatMap(f => [...fs.readFileSync(f, 'utf8').matchAll(/href="([^"]+\.md)"/g)].map(m => `${path.relative(OUT, f)} -> ${m[1]}`));
  check('no site page links to a raw .md file', mdLinks.length === 0, mdLinks.slice(0, 4).join(', '));

  // ── 5. old links still land ─────────────────────────────────────────
  for (const [from, to] of [['/#paus', '/scenes/paus'], ['/#pencil-box', '/pencil-box'], ['/#t-wobble', '/pencil-box#t-wobble'], ['/components.html', '/components']]) {
    const { context, page } = await open(from);
    await page.waitForTimeout(600);
    const u = new URL(page.url());
    const at = u.pathname.replace(/\.html$/, '') + u.hash;
    check(`${from} lands on ${to}`, at === to, `at ${at}`);
    await context.close();
  }

  // ── 6. the posters follow the register ──────────────────────────────
  {
    const { context, page } = await open('/scenes');
    const before = await page.evaluate(() => document.querySelector('img.poster')?.getAttribute('src') || '');
    await page.evaluate(() => { const i = document.querySelector('input[name="register"][value="quiet"]'); if (!i) return; i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => document.querySelector('img.poster')?.getAttribute('src') || '');
    check('a poster swaps when the register changes', /\.warm\./.test(before) && /\.quiet\./.test(after), `${before} -> ${after}`);
    await context.close();
  }

  // ── 7. accessible and no sideways scroll, on a sample of every kind ─
  for (const p of ['/', '/start', '/scenes', '/components', '/pencil-box', '/scenes/paus', '/components/badge', '/recipes/booking', '/foundations/core']) {
    for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
      const { context, page, status } = await open(p, { width, height: width < 600 ? 844 : 900, theme });
      const { overflow: over } = await sidewaysScroll(page);
      const v = await axe(page);
      check(`${p} at ${width}px ${theme}: axe clean, no sideways scroll`, status === 200 && v.length === 0 && over <= 0, [status !== 200 ? `status ${status}` : '', ...v, over > 0 ? `overflow ${over}px` : ''].filter(Boolean).join(', '));
      await context.close();
    }
  }

  // ── 7b. a template page links the site the build made from it, and that site fits a phone ─
  // The made site is what a visitor opens from "See it working": the raw source pages under packages/templates/ refer to
  // susegad/... paths that exist only in a made site, so they are not what is measured here.
  {
    const { context, page, status } = await open('/templates/event', { width: 1440 });
    const href = await page.locator('a.btn-solid', { hasText: 'See it working' }).first().getAttribute('href').catch(() => null);
    check('/templates/event offers "See it working", and it points at the made site', status === 200 && href === '/templates/event/site/', `status ${status}, href ${href}`);
    await context.close();
    const bad = [];
    for (const path of ['/templates/event/site/', '/templates/event/site/gom-deva/', '/templates/event/site/gom-latn/']) {
      for (const register of ['quiet', 'warm', 'playful']) {
        const c = await open(`${path}?register=${register}`, { width: 390, height: 844 });
        const o = await sidewaysScroll(c.page, 390);
        if (c.status !== 200 || o.overflow || o.clipped || c.errors.length) bad.push(`${path} ${register}: status ${c.status}, overflow ${o.overflow}${o.clipped ? ' (clipped)' : ''}, errors ${c.errors.slice(0, 2).join(' | ') || 0}`);
        await c.context.close();
      }
    }
    check('the made event site at 390 px, 3 languages x 3 registers: 0 px sideways, nothing clipped, no failed request (a missing stylesheet is a 404 here)', !bad.length, bad.slice(0, 3).join(' ; '));
  }

  {
    const robots = await (await fetch(server.url + '/robots.txt')).text();
    check('robots.txt keeps crawlers off the raw template pages (they are served for create --registry, not for visitors)', /^Disallow: \/packages\/templates\/$/m.test(robots), robots.slice(0, 120));
  }

  // ── 8. the cross-origin embed: the use-this-scene box, proven ───────
  // embed.check.mjs runs its own two servers (the docs origin with the
  // generated _headers applied, an embedder's page on another port), so it is
  // spawned as its own process. tools/checks.mjs scans packages/ and recipes/
  // only and is outside this rung's write boundary, so the site gate is where
  // this check runs in npm's pipeline.
  {
    const r = spawnSync(process.execPath, [path.join(HERE, 'embed.check.mjs')], { encoding: 'utf8', cwd: REPO_ROOT, timeout: 180000 });
    const out = (r.stdout + r.stderr).trim();
    out.split('\n').forEach(l => console.log(`  ${l}`));
    check('cross-origin embed: another origin loads a scene from the docs site and reaches sg-ready', r.status === 0, out.split('\n').at(-1) || `exit ${r.status}`);
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`\n${passed} of ${passed + failed} pass`);
if (failed) process.exit(1);
