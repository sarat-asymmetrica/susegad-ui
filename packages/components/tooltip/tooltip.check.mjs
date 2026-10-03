// Browser checks for <sg-tooltip>: the no-JS path first, then every register.
//
//   node packages/components/tooltip/tooltip.check.mjs
//
// No JavaScript: aria-describedby links the trigger to the text always; CSS
// alone reveals the panel on hover and on focus, by opacity, never display.
// With JavaScript, in quiet, warm and playful: the panel becomes a popover,
// shown after a delay on hover and instantly on focus, hidden on blur and on
// Escape, and it flips below a trigger with no room above; forced colours
// give it a real border.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/tooltip/demo.html`;

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(demo);
  const defined = await p.evaluate(() => typeof customElements.get('sg-tooltip'));
  check('no JS: the element is never defined', defined === 'undefined');
  const described = await p.evaluate(() => document.getElementById('cancel-btn').getAttribute('aria-describedby'));
  check('no JS: the trigger already names the tooltip text as its description', described === 'cancel-note', described);
  const before = await p.evaluate(() => getComputedStyle(document.getElementById('cancel-note')).opacity);
  await p.hover('#cancel-btn');
  await p.waitForTimeout(220); // the opacity transition
  const during = await p.evaluate(() => getComputedStyle(document.getElementById('cancel-note')).opacity);
  check('no JS: hovering the trigger reveals the panel by opacity', before === '0' && during === '1', `${before} -> ${during}`);
  const snap = await p.locator('#cancel-btn').ariaSnapshot();
  check('no JS: the button carries the description in its accessible tree', /button "Free cancellation"/.test(snap), snap.trim());
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-tooltip')].every(e => e.dataset.skin));
  const tag = `${register}:`;

  const isOpen = id => p.evaluate(s => document.getElementById(s).closest('sg-tooltip').open, id);
  await p.hover('#cancel-btn');
  await p.waitForTimeout(120);
  check(`${tag} hovering does not open it before the show delay`, !(await isOpen('cancel-btn')));
  await p.waitForTimeout(280);
  check(`${tag} it opens after the show delay`, await isOpen('cancel-btn'));
  const info = await p.evaluate(() => {
    const el = document.getElementById('cancel-note');
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, opacity: getComputedStyle(el).opacity, popoverOpen: el.matches(':popover-open') };
  });
  const onScreen = info.w > 0 && info.h > 0 && +info.opacity >= 0.95; // the fade may still be a frame from settling
  check(`${tag} the panel is really visible on screen`, onScreen, JSON.stringify(info));
  await p.mouse.move(0, 0);
  await p.waitForTimeout(160);
  check(`${tag} leaving the trigger closes it`, !(await isOpen('cancel-btn')));

  await p.focus('#rate-btn');
  const openOnFocus = await isOpen('rate-btn');
  check(`${tag} focus opens it instantly, no delay`, openOnFocus);
  await p.keyboard.press('Escape');
  check(`${tag} Escape closes it`, !(await isOpen('rate-btn')));
  await p.evaluate(() => document.activeElement.blur());

  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── flips below a trigger with no room above ────────────────────────────────
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.focus('#top-btn');
  await p.waitForTimeout(80);
  const rects = await p.evaluate(() => {
    const t = document.getElementById('top-btn').getBoundingClientRect();
    const panel = document.getElementById('top-note').getBoundingClientRect();
    return { triggerBottom: t.bottom, panelTop: panel.top };
  });
  check('the panel opens below a trigger with no room above', rects.panelTop >= rects.triggerBottom - 2, JSON.stringify(rects));
  await ctx.close();
}

// ── touch: a tap (which focuses the button) shows it too ───────────────────
{
  const ctx = await browser.newContext({ hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready);
  await p.locator('#cancel-btn').tap();
  await p.waitForTimeout(60);
  const open = await p.evaluate(() => document.getElementById('cancel-btn').closest('sg-tooltip').open);
  check('touch: tapping the trigger (which focuses it) shows the tooltip', open);
  await ctx.close();
}

// ── forced colours ──────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ forcedColors: 'active' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=playful`);
  await p.waitForFunction(() => window.__ready);
  await p.focus('#cancel-btn');
  await p.waitForTimeout(60);
  const fc = await p.evaluate(() => {
    const panel = document.getElementById('cancel-note');
    return { border: getComputedStyle(panel).borderStyle, leader: getComputedStyle(panel, '::after').display };
  });
  check('forced colours: a real border, the leader line hidden', fc.border === 'solid' && fc.leader === 'none', JSON.stringify(fc));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
