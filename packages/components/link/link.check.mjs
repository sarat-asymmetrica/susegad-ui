// Browser checks for <sg-link>: the no-JS path first, then every register.
//
//   node packages/components/link/link.check.mjs
//
// No JavaScript: the native link works and is announced correctly. With
// JavaScript, in quiet, warm and playful: the same; every register's line is there at rest in a sentence,
// warm's inks heavier on hover and focus; forced colours bring back the native underline.

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
    const widthAt = async () => p.evaluate(s => parseFloat(getComputedStyle(document.querySelector(s).closest('sg-link').querySelector('.sg-link-ink path')).strokeWidth), '#see-rooms');
    const before = await widthAt();
    check(`${tag} the drawn line is already there at rest`, before > 0 && await p.evaluate(s => !!document.querySelector(s).closest('sg-link').querySelector('.sg-link-ink path').getAttribute('d'), '#see-rooms'), `${before}px`);
    await p.hover('#see-rooms');
    await p.waitForTimeout(320);
    const during = await widthAt();
    check(`${tag} hovering inks it heavier`, during > before * 1.4, `${before}px to ${during}px`);
    await p.mouse.move(0, 0);
    await p.waitForTimeout(320);
    const after = await widthAt();
    check(`${tag} leaving lets it back to its rest weight`, Math.abs(after - before) < 0.05, `${after}px`);
  }
  if (register === 'playful') {
    const drawn = await p.evaluate(s => !!document.querySelector(s).closest('sg-link').querySelector('.sg-link-ink path').getAttribute('d'), '#see-rooms');
    check(`${tag} the kolam line is drawn without needing hover`, drawn);
  }

  // 1.4.1: a link inside a sentence is told from the words around it by more than colour, at rest (no hover, no
  // focus). Instrument: screenshot the strip under the link's text with the link as it is, then again with its
  // underline taken away (the drawn line hidden, any text-decoration off), and count the pixels that changed.
  // With nothing to take away the count is 0, so the probe can say "no underline" as well as "underline".
  {
    const sel = '.prose sg-link:first-of-type a';
    await p.mouse.move(0, 0);
    await p.evaluate(() => document.activeElement?.blur());
    await p.locator(sel).scrollIntoViewIfNeeded();
    const strip = async () => {
      const box = await p.locator(sel).boundingBox();
      const clip = { x: Math.floor(box.x), y: Math.floor(box.y + box.height - 6), width: Math.ceil(box.width), height: 12 };
      const png = await p.screenshot({ clip });
      return { clip, png };
    };
    const rest = await strip();
    await p.addStyleTag({ content: `${'.prose'} sg-link .sg-link-ink { visibility: hidden !important } .prose sg-link a { text-decoration-line: none !important }` });
    const bare = await strip();
    const changed = await p.evaluate(async ([a, b]) => {
      const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:image/png;base64,${src}`; });
      const px = async src => { const i = await load(src), c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width }; };
      const [x, y] = [await px(a), await px(b)];
      const cols = new Set();
      for (let i = 0; i < x.d.length; i += 4) if (Math.abs(x.d[i] - y.d[i]) + Math.abs(x.d[i + 1] - y.d[i + 1]) + Math.abs(x.d[i + 2] - y.d[i + 2]) > 60) cols.add((i / 4) % x.w);
      return { cols: cols.size, w: x.w };
    }, [rest.png.toString('base64'), bare.png.toString('base64')]);
    check(`${tag} a link in a sentence has an underline at rest (rest versus underline removed)`, changed.cols >= changed.w * 0.7, `${changed.cols} of ${changed.w} columns changed`);
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
