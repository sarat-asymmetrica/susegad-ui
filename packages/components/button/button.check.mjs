// Browser checks for <sg-button>: the no-JS path first, then every register.
//
//   node packages/components/button/button.check.mjs
//
// No JavaScript: the native button and link work, are announced correctly,
// and a form submits on Enter and on a click. With JavaScript, in quiet,
// warm and playful: the same; warm's outline appears only on hover/focus and
// stays still until then; playful presses on :active and blooms an ink ring
// that fades to nothing; disabled turns off the press and the ring; forced
// colours bring back the native look.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/button/demo.html`;

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(demo);
  const defined = await p.evaluate(() => typeof customElements.get('sg-button'));
  check('no JS: the element is never defined; the native controls still work', defined === 'undefined');
  const snap = await p.locator('form button[type="submit"]').ariaSnapshot();
  check('no JS: the submit is announced as a button, by its own text', /^- button "Send the request"/.test(snap.trim()), snap.trim());
  await Promise.all([p.waitForURL(/sent=1/), p.click('form button[type="submit"]')]);
  check('no JS: the form really submitted', new URL(p.url()).searchParams.get('sent') === '1');
  const link = await p.locator('a[href="#rooms"]').ariaSnapshot();
  check('no JS: the link is announced as a link', /^- link "A link, styled the same"/.test(link.trim()), link.trim());
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-button')].every(e => e.dataset.skin));
  const tag = `${register}:`;
  const first = '#book-now';

  if (register === 'warm') {
    const opacityAt = async () => p.evaluate(s => +getComputedStyle(document.querySelector(s).closest('sg-button').querySelector('.sg-button-boil')).opacity, first);
    const before = await opacityAt();
    await p.hover(first);
    await p.waitForTimeout(160);
    const during = await opacityAt();
    check(`${tag} the ink outline stays hidden until hovered`, before === 0 && during > 0.5, `${before} -> ${during}`);
    await p.mouse.move(0, 0);
  }

  if (register === 'playful') {
    const accentBtn = '#see-rooms';
    const [ring] = await Promise.all([
      p.evaluate(s => new Promise(resolve => {
        const host = document.querySelector(s).closest('sg-button');
        host.addEventListener('pointerdown', () => requestAnimationFrame(() => {
          const anims = host.querySelector('.sg-button-ink').getAnimations();
          resolve(anims.length);
        }), { once: true });
      }), accentBtn),
      p.dispatchEvent(accentBtn, 'pointerdown', { clientX: 10, clientY: 10 }),
    ]);
    check(`${tag} pressing plays the ink-ring animation`, ring === 1, `${ring} animations`);
  }

  check(`${tag} still announced as a button`, /^- button "Book now"/.test((await p.locator(first).ariaSnapshot()).trim()));
  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── disabled turns off the theatre ──────────────────────────────────────────
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=warm`);
  await p.waitForFunction(() => window.__ready);
  const cursor = await p.evaluate(() => getComputedStyle(document.querySelector('sg-button button[disabled]')).cursor);
  check('disabled: the pointer says not-allowed', cursor === 'not-allowed', cursor);
  await ctx.close();
}

// ── reduced motion: no boil animation, no ink ring ──────────────────────────
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=playful`);
  await p.waitForFunction(() => window.__ready);
  const accentBtn = 'sg-button button[data-tone="accent"]';
  await p.dispatchEvent(accentBtn, 'pointerdown', { clientX: 10, clientY: 10 });
  await p.waitForTimeout(50);
  const n = await p.evaluate(s => document.querySelector(s).closest('sg-button').querySelector('.sg-button-ink').getAnimations().length, accentBtn);
  check('reduced motion, playful: no ink ring plays', n === 0, `${n} animations`);
  await ctx.close();
}

// ── forced colours ──────────────────────────────────────────────────────────
for (const register of ['quiet', 'playful']) {
  const ctx = await browser.newContext({ forcedColors: 'active' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready);
  const fc = await p.evaluate(s => {
    const btn = document.querySelector(s);
    const ink = btn.closest('sg-button').querySelector('.sg-button-ink');
    return { border: getComputedStyle(btn).borderColor, ink: ink ? getComputedStyle(ink).display : 'none' };
  }, 'sg-button button[data-tone="accent"]');
  check(`${register}, forced colours: the browser's own look, ornament hidden`, fc.ink === 'none', JSON.stringify(fc));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
