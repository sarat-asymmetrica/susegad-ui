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
import { chromium } from 'playwright';
import { startServer, REPO_ROOT } from '../../tools/serve.mjs';

const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(REPO_ROOT, 'out', 'docs');
const registry = JSON.parse(fs.readFileSync(path.join(OUT, 'registry', 'registry.json'), 'utf8'));
const axeSource = fs.readFileSync(path.join(REPO_ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');

const KINDS = { scene: 'scenes', component: 'components', recipe: 'recipes', package: 'foundations', surface: 'foundations' };
const slug = item => (item.type === 'scene' ? item.name.replace(/^scene-/, '') : item.name);
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
      await page.waitForTimeout(800);
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
  for (const p of ['/', '/scenes', '/components', '/pencil-box', '/scenes/paus', '/components/badge', '/recipes/booking', '/foundations/core']) {
    for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
      const { context, page, status } = await open(p, { width, height: width < 600 ? 844 : 900, theme });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const v = await axe(page);
      check(`${p} at ${width}px ${theme}: axe clean, no sideways scroll`, status === 200 && v.length === 0 && over <= 0, [status !== 200 ? `status ${status}` : '', ...v, over > 0 ? `overflow ${over}px` : ''].filter(Boolean).join(', '));
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`\n${passed} of ${passed + failed} pass`);
if (failed) process.exit(1);
