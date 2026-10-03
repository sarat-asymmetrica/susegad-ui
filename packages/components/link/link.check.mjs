// Browser checks for <sg-link>: the no-JS path first, then every register.
//
//   node packages/components/link/link.check.mjs
//
// No JavaScript: the native link works and is announced correctly. With
// JavaScript, in quiet, warm and playful: the same; warm's line stays
// undrawn until hover or focus and draws back out on leave; playful's kolam
// line is always drawn; forced colours bring back the native underline.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/link/demo.html`;

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(demo);
  const defined = await p.evaluate(() => typeof customElements.get('sg-link'));
  check('no JS: the element is never defined; the native link still works', defined === 'undefined');
  const snap = await p.locator('#see-rooms').ariaSnapshot();
  check('no JS: it is announced as a link, by its own text', /^- link "See the rooms"/.test(snap.trim()), snap.trim());
  const deco = await p.evaluate(s => getComputedStyle(document.querySelector(s)).textDecorationLine, '#see-rooms');
  check('no JS: a real underline, not colour alone', deco.includes('underline'), deco);
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-link')].every(e => e.dataset.skin));
  const tag = `${register}:`;

  if (register === 'warm') {
    const offsetAt = async () => p.evaluate(s => {
      const path = document.querySelector(s).closest('sg-link').querySelector('.sg-link-ink path');
      return { off: getComputedStyle(path).strokeDashoffset, dash: getComputedStyle(path).strokeDasharray };
    }, '#see-rooms');
    const before = await offsetAt();
    check(`${tag} the drawn line starts fully undrawn`, before.off === before.dash && before.off !== '0px', JSON.stringify(before));
    await p.hover('#see-rooms');
    await p.waitForTimeout(320);
    const during = await offsetAt();
    check(`${tag} hovering draws the line in`, during.off === '0px', JSON.stringify(during));
    await p.mouse.move(0, 0);
    await p.waitForTimeout(320);
    const after = await offsetAt();
    check(`${tag} leaving draws it back out`, after.off === after.dash, JSON.stringify(after));
  }
  if (register === 'playful') {
    const drawn = await p.evaluate(s => !!document.querySelector(s).closest('sg-link').querySelector('.sg-link-ink path').getAttribute('d'), '#see-rooms');
    check(`${tag} the kolam line is drawn without needing hover`, drawn);
  }

  const snap = await p.locator('#see-rooms').ariaSnapshot();
  check(`${tag} still announced as a link`, /^- link "See the rooms"/.test(snap.trim()), snap.trim());
  const hidden = register === 'quiet' ? 'n/a' : await p.evaluate(s => document.querySelector(s).closest('sg-link').querySelector('.sg-link-ink').getAttribute('aria-hidden'), '#see-rooms');
  check(`${tag} the drawing is hidden from assistive tech`, hidden === 'n/a' || hidden === 'true', hidden);
  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── forced colours ──────────────────────────────────────────────────────────
for (const register of ['warm', 'playful']) {
  const ctx = await browser.newContext({ forcedColors: 'active' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready);
  const fc = await p.evaluate(s => {
    const a = document.querySelector(s);
    const ink = a.closest('sg-link').querySelector('.sg-link-ink');
    return { deco: getComputedStyle(a).textDecorationLine, ink: ink ? getComputedStyle(ink).display : 'none' };
  }, '#see-rooms');
  check(`${register}, forced colours: the native underline returns, the drawn ink hides`, fc.deco.includes('underline') && fc.ink === 'none', JSON.stringify(fc));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
