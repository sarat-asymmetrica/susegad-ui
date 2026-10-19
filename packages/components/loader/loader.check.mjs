// Browser checks for <sg-loader>: a loader added to the page is announced once,
// a change of words is announced, nothing is read twice, and it works without
// JavaScript. Run by hand or with `npm run check`:
//
//   node packages/components/loader/loader.check.mjs

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness({ axe: "tools/smoke.mjs axes /packages/components/loader/demo.html once, at 1280 px in the default register and light theme; the other registers, the dark theme and the states this check opens are not axe-checked (docs/DEBT.md row 48)" });
const { server, check } = h;
const url = `${server.url}/packages/components/loader/demo.html`;

// ── without JavaScript: the words are simply there ──
{
  const ctx = await h.context({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(url);
  check('no JS: the words show', (await page.locator('sg-loader').nth(1).textContent()).includes('Checking the calendar'));
  await ctx.close();
}

for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await h.context({ reducedMotion: register === 'quiet' ? 'reduce' : 'no-preference' });
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

await h.done();
