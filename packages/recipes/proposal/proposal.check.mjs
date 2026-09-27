// Browser checks for the proposal recipe, run by `npm run check`. It builds the
// sample proposal (examples/sample/proposal.md) into one sealed file and checks
// the essentials: the seal and a one-byte change, no network requests and no
// errors, axe with and without JavaScript, and the phone (no sideways scroll,
// the price table re-prices, the plan walks, an option and a typed signature).
// A sealed release build has its own fuller gate; see proposal.docs.md.
//
//   node packages/recipes/proposal/proposal.check.mjs

import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { buildProposal } from './build.mjs';
import { verify } from '../../folio/build/seal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const AXE = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const tmp = await mkdtemp(join(tmpdir(), 'proposal-check-'));
const out = join(tmp, 'sample.folio.html');
const built = await buildProposal(join(HERE, 'examples/sample/proposal.md'), { out, budget: '1.5MB', log: () => {} });
check('the sample builds under 1.5 MB', built.ok, `${built.bytes} bytes`);

// the seal
const text = await readFile(out, 'utf8');
check('the seal matches', verify(text).ok);
const i = text.indexOf('Where things stand', text.indexOf('<body')) + 2;
check('one byte changed in the body breaks the seal', !verify(text.slice(0, i) + (text[i] === 'e' ? 'a' : 'e') + text.slice(i + 1)).ok);

const url = pathToFileURL(out).href;
const browser = await chromium.launch();
const open = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, ...opts });
  const requests = [], errors = [];
  await ctx.route('**/*', route => { if (route.request().url() === url) return route.continue(); requests.push(route.request().url()); return route.abort(); });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  if (opts.javaScriptEnabled !== false) await page.evaluate(() => Promise.race([Promise.all(['sg-price-table', 'sg-timeline', 'sg-signature'].map(t => customElements.whenDefined(t))), new Promise(r => setTimeout(r, 4000))]));
  await page.waitForTimeout(800);
  return { ctx, page, requests, errors };
};
const axe = async page => {
  await page.evaluate(AXE);
  return page.evaluate(async tags => (await window.axe.run(document, { runOnly: { type: 'tag', values: tags } })).violations.map(v => `${v.id} (${v.nodes.length})`), TAGS);
};

try {
  {
    const { ctx, page, requests, errors } = await open();
    check('opened with every request blocked: none asked for', requests.length === 0, requests.join(' '));
    check('no console or page errors', errors.length === 0, errors.join(' | '));
    const v = await axe(page);
    check('axe with JavaScript: 0 violations', !v.length, v.join(', '));
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ javaScriptEnabled: false });
    const r = await page.evaluate(() => ({ tables: document.querySelectorAll('sg-price-table table').length, plan: document.querySelectorAll('sg-timeline ol > li').length, options: document.querySelectorAll('.folio-signature__options input').length }));
    check('without JavaScript: the tables, the plan as a list, the options', r.tables === 2 && r.plan === 3 && r.options === 2, JSON.stringify(r));
    const dom = (await page.content()).replace(/<script\b[\s\S]*?<\/script>/gi, '');
    await ctx.close();
    const c2 = await browser.newContext({ bypassCSP: true });
    const p2 = await c2.newPage();
    await p2.route('**/*', route => route.abort());
    await p2.setContent(dom, { waitUntil: 'load' });
    const v = await axe(p2);
    check('axe without JavaScript: 0 violations', !v.length, v.join(', '));
    await c2.close();
  }
  {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('390 px: no sideways scroll', over <= 0, `${over}`);
    const stay = page.locator('sg-price-table[arrival]');
    const before = await stay.locator('tr.is-total td').textContent();
    await stay.locator('.price-table__try summary').tap();
    await stay.locator('input[type=date]').nth(1).fill('2026-11-23');
    await stay.locator('input[type=date]').nth(1).dispatchEvent('change');
    check('390 px: the price table re-prices other dates', before !== await stay.locator('tr.is-total td').textContent());
    await page.locator('sg-timeline input[type=range]').focus();
    await page.keyboard.press('ArrowRight');
    check('390 px: the plan walks', await page.evaluate(() => document.querySelector('sg-timeline li[aria-current=step]')?.dataset.step) === '2');
    await page.locator('.folio-signature__choice label').nth(1).tap();
    const name = page.locator('sg-signature input:not([type=hidden])');
    await name.tap();
    await page.keyboard.type('Ana Fernandes');
    await name.press('Tab');
    const said = await page.locator('.proposal-keep__said').textContent();
    check('390 px: an option chosen and a name typed are said', /Signed by Ana Fernandes for option 2/.test(said), said);
    check('no console or page errors (phone)', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  await rm(tmp, { recursive: true, force: true });
}

const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
