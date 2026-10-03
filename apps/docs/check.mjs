// Checks the docs home page in a real browser and screenshots it.
//
//   node apps/docs/check.mjs            the source tree, served from the repo root
//   node apps/docs/check.mjs --built    out/docs, served under a /docs/ base path
//
// For each register × theme × width: a screenshot, axe, console errors and
// horizontal overflow. Then reduced motion and the switches persisting across
// a reload. (Every other page, and Look closer, is site.check.mjs's.)
// Screenshots go to .shots/docs/ (or .shots/docs-built/).

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer, REPO_ROOT } from '../../tools/serve.mjs';

const builtMode = process.argv.includes('--built');
const outDir = path.join(REPO_ROOT, '.shots', builtMode ? 'docs-built' : 'docs');
fs.mkdirSync(outDir, { recursive: true });
const axeSource = fs.readFileSync(path.join(REPO_ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');

const server = await startServer({ root: builtMode ? path.join(REPO_ROOT, 'out') : REPO_ROOT, quiet: true });
const pageUrl = `${server.url}${builtMode ? '/docs/' : '/apps/docs/'}`;
const browser = await chromium.launch();
const results = { url: pageUrl, runs: [], problems: [] };
const problem = msg => { results.problems.push(msg); console.log(`  PROBLEM ${msg}`); };

async function openPage({ register = 'warm', theme = 'light', width = 1280, reduced = false, prefs } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    colorScheme: theme,
  });
  const saved = prefs ?? { register, theme, palette: 'susegad' };
  // seed storage once per tab, so a reload reads back what the page itself saved
  await context.addInitScript(p => {
    try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('sg-docs-prefs', p); sessionStorage.setItem('seeded', '1'); } } catch {}
  }, JSON.stringify(saved));
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('requestfailed', r => errors.push(`request failed ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  // the privacy rule: nothing leaves the site
  page.on('request', r => { if (!/^(data|blob):/.test(r.url()) && !r.url().startsWith(server.url)) errors.push(`third-party request ${r.url()}`); });
  await page.goto(pageUrl);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  // give the scenes that are on screen time to draw their first frames
  await page.waitForTimeout(1200);
  return { context, page, errors };
}

async function axe(page) {
  await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { resultTypes: ['violations', 'incomplete'] });
    window.__axeReview = res.incomplete.filter(v => v.id !== 'color-contrast').map(v => `${v.id} x${v.nodes.length}`);
    return res.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map(n => n.target.join(' ')) }));
  });
  return r;
}

async function overflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1)
      .slice(0, 5).map(el => `${el.tagName.toLowerCase()}.${el.className}`);
    return { over: doc.scrollWidth - doc.clientWidth, wide };
  });
}

// ── the matrix ───────────────────────────────────────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  for (const theme of ['light', 'dark']) {
    for (const width of [1280, 390]) {
      const tag = `${register}-${theme}-${width}`;
      const { context, page, errors } = await openPage({ register, theme, width });
      await page.evaluate(() => document.fonts.ready);
      const info = await page.evaluate(() => ({
        fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family.replace(/"/g, '')} ${f.weight}`).sort().join(', '),
        castoro: document.fonts.check('400 64px Castoro', 'Susegad'),
        register: document.documentElement.dataset.register,
        doors: document.querySelectorAll('.doors .door').length,
        ready: [...document.querySelectorAll('sg-scene')].filter(s => s.shadowRoot?.querySelector('.stage canvas, .stage svg')).length,
      }));
      await page.screenshot({ path: path.join(outDir, `${tag}-top.png`) });
      await page.screenshot({ path: path.join(outDir, `${tag}-full.png`), fullPage: true });
      const violations = await axe(page);
      const ov = await overflow(page);
      const review = await page.evaluate(() => window.__axeReview);
      if (review.length) console.log(`  ${tag} axe to review by hand: ${review.join(', ')}`);
      const run = { tag, ...info, violations, overflow: ov.over, errors };
      results.runs.push(run);
      if (tag === 'warm-light-1280') console.log(`fonts loaded: ${info.fonts}`);
      // the home page runs one drawing (the masthead tiatr) and opens every kind by a door
      if (info.ready !== 1) problem(`${tag} the masthead tiatr is not drawn (drawn: ${info.ready})`);
      if (info.doors < 5) problem(`${tag} only ${info.doors} doors into the library`);
      if (!info.castoro) problem(`${tag} Castoro did not load for the masthead`);
      console.log(`${tag}: doors=${info.doors} drawn=${info.ready} axe=${violations.length} overflow=${ov.over}px errors=${errors.length}`);
      violations.forEach(v => problem(`${tag} axe ${v.id} (${v.impact}) x${v.nodes}: ${v.targets.join(' | ')}`));
      if (ov.over > 0) problem(`${tag} overflows by ${ov.over}px: ${ov.wide.join(', ')}`);
      errors.forEach(e => problem(`${tag} console: ${e}`));
      if (info.register !== register) problem(`${tag} register attribute is ${info.register}`);
      await context.close();
    }
  }
}

// ── reduced motion ───────────────────────────────────────────────────
{
  const { context, page, errors } = await openPage({ reduced: true });
  await page.screenshot({ path: path.join(outDir, 'reduced-warm-light-1280-top.png') });
  const drawn = await page.evaluate(() => !!document.querySelector('#mast-stage')?.shadowRoot?.querySelector('.stage canvas, .stage svg'));
  console.log(`reduced motion: masthead tiatr drawn=${drawn}`);
  if (!drawn) problem('reduced motion: the masthead tiatr did not draw its still');
  errors.forEach(e => problem(`reduced console: ${e}`));
  await context.close();
}

// Look closer lives on a scene page now; site.check.mjs checks it there (focus in, Escape, focus back, the same canvas).

// ── the switches persist ─────────────────────────────────────────────
{
  const { context, page, errors } = await openPage({ prefs: {} });
  await page.getByRole('radio', { name: 'Playful' }).check();
  await page.getByRole('radio', { name: 'Dark' }).check();
  await page.getByRole('radio', { name: 'Casa' }).check();
  await page.reload();
  await page.waitForFunction(() => window.__ready === true);
  const attrs = await page.evaluate(() => ({ ...document.documentElement.dataset, checked: [...document.querySelectorAll('.prefs input:checked')].map(i => i.value) }));
  console.log(`persist: register=${attrs.register} theme=${attrs.theme} palette=${attrs.palette} checked=${attrs.checked.join(',')}`);
  await page.screenshot({ path: path.join(outDir, 'casa-playful-dark-1280-top.png') });
  if (attrs.register !== 'playful' || attrs.theme !== 'dark' || attrs.palette !== 'casa') problem('switches did not persist across reload');
  errors.forEach(e => problem(`persist console: ${e}`));
  await context.close();

  // no storage at all: the page still renders with the defaults
  const ctx2 = await browser.newContext();
  await ctx2.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  const p2 = await ctx2.newPage();
  const errs2 = [];
  p2.on('pageerror', e => errs2.push(String(e)));
  await p2.goto(pageUrl);
  await p2.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await p2.getByRole('radio', { name: 'Quiet' }).check();
  const reg = await p2.evaluate(() => document.documentElement.dataset.register);
  console.log(`no storage: renders, switch sets register=${reg}, page errors=${errs2.length}`);
  if (reg !== 'quiet' || errs2.length) problem(`storage blocked: register=${reg} errors=${errs2.join('; ')}`);
  await ctx2.close();
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
await browser.close();
await server.close();
console.log(results.problems.length ? `\n${results.problems.length} problem(s)` : '\nall clean');
process.exitCode = results.problems.length ? 1 : 0;
