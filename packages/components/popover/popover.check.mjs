// Browser checks for <sg-popover>: the no-JS path first, then every register.
//
//   node packages/components/popover/popover.check.mjs
//
// No JavaScript: popovertarget opens and closes the panel, Escape closes it,
// focus returns to the trigger. With JavaScript, in quiet, warm and playful:
// the same, plus the panel near the bottom of the page flips above; forced
// colours simplify the card.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/popover/demo.html`;

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(demo);
  const defined = await p.evaluate(() => typeof customElements.get('sg-popover'));
  check('no JS: the element is never defined; popovertarget still opens the panel', defined === 'undefined');
  const before = await p.isVisible('#rates');
  await p.click('button[popovertarget="rates"]');
  check('no JS: clicking the trigger opens the panel', !before && await p.isVisible('#rates'));
  await p.keyboard.press('Escape');
  check('no JS: Escape closes it', !(await p.isVisible('#rates')));
  const focused = await p.evaluate(() => document.activeElement.getAttribute('popovertarget'));
  check('no JS: focus returns to the trigger', focused === 'rates');
  await ctx.close();
}

// ── with JavaScript, every register ─────────────────────────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-popover')].every(e => e.dataset.skin));
  const tag = `${register}:`;

  await p.click('button[popovertarget="rates"]');
  await p.waitForTimeout(180);
  const open = await p.evaluate(() => document.querySelector('sg-popover').open);
  check(`${tag} the element's own "open" reflects the native panel`, open === true);
  const seen = await p.locator('#rates').isVisible();
  check(`${tag} the panel is really on screen`, seen);
  // AB1: the panel must sit against its trigger, not at whatever static
  // flow position a bare `position: fixed` falls back to.
  const rects = await p.evaluate(() => {
    const t = document.querySelector('button[popovertarget="rates"]').getBoundingClientRect();
    const panel = document.getElementById('rates').getBoundingClientRect();
    return { trigger: t, panel };
  });
  const gap = Math.abs(rects.panel.top - rects.trigger.bottom);
  check(`${tag} the panel's top edge sits within 8px of the trigger's bottom edge`, gap <= 8, `gap ${gap.toFixed(1)}px; trigger bottom ${rects.trigger.bottom.toFixed(0)}, panel top ${rects.panel.top.toFixed(0)}`);
  await p.keyboard.press('Escape');
  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── flips above near the bottom of the page ─────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready);
  // align the trigger's own bottom edge with the viewport's, so there is
  // genuinely no room below it (not just "somewhere further down the page")
  await p.evaluate(() => document.querySelector('button[popovertarget="low"]').scrollIntoView({ block: 'end' }));
  await p.click('button[popovertarget="low"]');
  await p.waitForTimeout(150);
  const rects = await p.evaluate(() => {
    const t = document.querySelector('button[popovertarget="low"]').getBoundingClientRect();
    const panel = document.getElementById('low').getBoundingClientRect();
    return { triggerTop: t.top, panelBottom: panel.bottom };
  });
  check('the panel opens above a trigger with no room below', rects.panelBottom <= rects.triggerTop + 4, JSON.stringify(rects));
  await ctx.close();
}

// ── forced colours ──────────────────────────────────────────────────────────
for (const register of ['warm', 'playful']) {
  const ctx = await browser.newContext({ forcedColors: 'active' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready);
  await p.click('button[popovertarget="rates"]');
  await p.waitForTimeout(100);
  const fc = await p.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('rates'), '::before');
    return { display: cs.display };
  });
  check(`${register}, forced colours: the postmark/fold is hidden`, fc.display === 'none', JSON.stringify(fc));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
