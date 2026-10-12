// Browser checks for <sg-popover>: the no-JS path first, then every register.
//
//   node packages/components/popover/popover.check.mjs
//
// No JavaScript: popovertarget opens and closes the panel, Escape closes it,
// focus returns to the trigger. With JavaScript, in quiet, warm and playful:
// the same, plus the panel near the bottom of the page flips above; forced
// colours simplify the card.

import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
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
  // it fades out over 120ms: wait for it to be gone rather than reading the first frame of the exit
  check('no JS: Escape closes it', await p.waitForSelector('#rates', { state: 'hidden', timeout: 2000 }).then(() => true, () => false));
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

// ── 1.4.10: at 390 px and at 320 px an open panel cannot be scrolled sideways, in every register ──
// The probe tries to scroll it: scrollLeft = 50 and read back. (scrollWidth alone would also count painted
// decoration that an `overflow: clip` panel shows but nobody can scroll to.)
for (const width of [390, 320]) for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready);
  const rows = [];
  for (const id of ['rates', 'kn-rates']) {
    await p.click(`button[popovertarget="${id}"]`);
    await p.waitForFunction(i => document.getElementById(i).matches(':popover-open'), id);
    rows.push(await p.evaluate(i => { const el = document.getElementById(i), r = el.getBoundingClientRect(); el.scrollLeft = 50; const moved = el.scrollLeft; el.scrollLeft = 0;
      return { id: i, moved, scrollW: el.scrollWidth, clientW: el.clientWidth, left: Math.round(r.left), right: Math.round(r.right), page: document.documentElement.scrollWidth }; }, id));
    await p.keyboard.press('Escape');
  }
  const bad = rows.filter(r => r.moved > 0 || r.left < 0 || r.right > width || r.page > width);
  check(`${register} at ${width} px: the open panels do not scroll sideways, inside the screen`, !bad.length, bad.map(r => `${r.id}: scrolled ${r.moved} px sideways (scrollWidth ${r.scrollW} vs clientWidth ${r.clientW}), box ${r.left}-${r.right}`).join('; ') || rows.map(r => `${r.id} scrolls ${r.moved} px`).join(', '));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
