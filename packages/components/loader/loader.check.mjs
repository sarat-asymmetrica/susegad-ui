// Browser checks for <sg-loader>: a loader added to the page is announced once,
// a change of words is announced, nothing is read twice, and it works without
// JavaScript. Run by hand or with `npm run check`:
//
//   node packages/components/loader/loader.check.mjs

import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const url = `${server.url}/packages/components/loader/demo.html`;

// ── without JavaScript: the words are simply there ──
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(url);
  check('no JS: the words show', (await page.locator('sg-loader').nth(1).textContent()).includes('Checking the calendar'));
  await ctx.close();
}

for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await browser.newContext({ reducedMotion: register === 'quiet' ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${url}?register=${register}`);
  await page.waitForFunction(() => window.__ready === true);

  // A loader arrives with its words already in it, as a page or a server would add it.
  const seen = await page.evaluate(() => new Promise(resolve => {
    const host = document.createElement('div');
    document.querySelector('main').append(host);
    const log = [];
    const watch = new MutationObserver(() => {
      const live = host.querySelector('[role="status"]');
      if (live) log.push(live.textContent);
    });
    watch.observe(host, { subtree: true, childList: true, characterData: true });
    host.innerHTML = '<sg-loader>Loading your invoices</sg-loader>';
    const atInsert = host.querySelector('[role="status"]')?.textContent ?? null;
    setTimeout(() => { watch.disconnect(); resolve({ atInsert, log, final: host.querySelector('[role="status"]')?.textContent }); }, 600);
  }));
  check(`${register}: the status line starts empty when the loader arrives`, seen.atInsert === '', JSON.stringify(seen.atInsert));
  check(`${register}: then it is filled once with the words, which is what gets announced`, seen.final === 'Loading your invoices' && seen.log.filter(t => t === 'Loading your invoices').length === 1, seen.log.join(' | '));

  const tree = await page.locator('main sg-loader').last().ariaSnapshot();
  check(`${register}: a screen reader finds the words once, in a status`, (tree.match(/Loading your invoices/g) ?? []).length === 1 && /status/.test(tree), tree.replace(/\n/g, ' | '));

  await page.evaluate(() => { const l = [...document.querySelectorAll('sg-loader')].at(-1); l.setAttribute('label', 'Making previews'); });
  const after = await page.evaluate(() => [...document.querySelectorAll('sg-loader')].at(-1).querySelector('[role="status"]').textContent);
  check(`${register}: a new label is announced as it changes`, after === 'Making previews', after);
  check(`${register}: no console errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
await server.close();
if (results.some(r => !r.ok)) process.exit(1);
