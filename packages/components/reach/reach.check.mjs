// Browser checks for <sg-reach>: axe, the links as built, the copy button
// (it copies, and says so in words; the probe also runs on a button that
// copies silently, to show it can fail), keyboard, and no JavaScript.
//
//   node packages/components/reach/reach.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { grantsPermission, unsupportedIn } from '../../../tools/lib/engine.mjs';
import { readWaLink } from './reach.core.js';

const { check, open, openHtml, axe, axeNoJs, done, engine } = await harness();
const DEMO = '/packages/components/reach/demo.html';
const NUMBER = '+91 90000 12345';

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

{
  const { ctx, page } = await open(DEMO);
  const links = await page.evaluate(() => [...document.querySelectorAll('sg-reach a')].map(a => a.getAttribute('href')));
  const wa = links.filter(h => h.startsWith('https://wa.me/')).map(readWaLink);
  const mail = links.filter(h => h.startsWith('mailto:'));
  check('the WhatsApp links read back to the number and the written message', wa.length === 3 && wa.every(w => w?.digits === '919000012345' && w.text.startsWith('Hello!')), JSON.stringify(wa[0]));
  check('the email links are mailto: with a subject, spaces as %20', mail.length === 3 && mail.every(m => m === 'mailto:hello@casa-studio.example?subject=A%20project'), mail[0]);
  await ctx.close();
}

// Copy, then read the clipboard and the words on the page.
const copyProbe = async (page, button) => {
  await page.evaluate(() => navigator.clipboard.writeText('nothing yet'));
  await page.click(button);
  await page.waitForTimeout(150);
  return page.evaluate(b => {
    const host = document.querySelector(b).closest('sg-reach, .broken');
    const status = host.querySelector('[role="status"]');
    return navigator.clipboard.readText().then(clip => ({ clip, said: status?.textContent ?? '', label: document.querySelector(b).textContent }));
  }, button);
};
if (!grantsPermission(engine, 'clipboard-write')) {
  unsupportedIn(engine, 'navigator.clipboard reads and writes from an automated context', 'no clipboard-read/clipboard-write grant');
  // Still real, and independent of the clipboard: the button itself is there and big enough.
  const { ctx, page } = await open(DEMO);
  const size = await page.evaluate(() => Math.round(document.querySelector('.sg-reach-copy').getBoundingClientRect().height));
  check('the copy button is at least 24 px tall', size >= 24, `${size}`);
  await ctx.close();
} else {
  {
    const { ctx, page } = await open(DEMO);
    const r = await copyProbe(page, '[data-register="warm"] .sg-reach-copy');
    check('copy: the number is on the clipboard and a status line says so in words', r.clip === NUMBER && r.said.includes(`Copied ${NUMBER}`) && r.label === 'Copied', JSON.stringify(r));
    await page.waitForTimeout(2700);
    check('the button says Copy number again after a moment', await page.textContent('[data-register="warm"] .sg-reach-copy') === 'Copy number');
    // keyboard: Tab from the email link reaches WhatsApp, then the button; Enter copies
    await page.focus('[data-register="quiet"] a[href^="mailto:"]');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const onButton = await page.evaluate(() => document.activeElement.classList.contains('sg-reach-copy'));
    await page.evaluate(() => navigator.clipboard.writeText('nothing yet'));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check('keyboard: email, WhatsApp, then the copy button; Enter copies', onButton && clip === NUMBER, JSON.stringify({ onButton, clip }));
    const size = await page.evaluate(() => Math.round(document.querySelector('.sg-reach-copy').getBoundingClientRect().height));
    check('the copy button is at least 24 px tall', size >= 24, `${size}`);
    await ctx.close();
  }
  {
    // broken on purpose: a button that copies and says nothing
    const { ctx, page } = await openHtml('silent-copy', `<!doctype html><html lang="en"><head><title>t</title></head><body>
      <div class="broken"><a href="https://wa.me/919000012345">${NUMBER}</a> <button type="button" id="b">Copy number</button></div>
      <script>document.getElementById('b').addEventListener('click', () => navigator.clipboard.writeText('${NUMBER}'));</script></body></html>`);
    const r = await copyProbe(page, '#b');
    check('control: a button that copies silently fails the same probe', r.clip === NUMBER && !r.said.includes('Copied'), JSON.stringify(r));
    await ctx.close();
  }
}
// ── the inland letter reads blue, not grey, by day and by night ──
// Read the paper's colour from pixels (a 1x1 canvas resolves any CSS colour to sRGB), then to OKLCH chroma and hue.
const paper = page => page.evaluate(() => {
  const a = document.querySelector('[data-register="warm"] address');
  const layers = getComputedStyle(a).backgroundImage.includes('gradient') ? getComputedStyle(a).backgroundColor : '';
  const g = document.createElement('canvas').getContext('2d');
  g.fillStyle = getComputedStyle(a).backgroundColor; g.fillRect(0, 0, 1, 1);
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(gr), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { rgb: `${r},${gr},${b}`, L: +L.toFixed(3), C: +Math.hypot(A, Bb).toFixed(3), h: Math.round((Math.atan2(Bb, A) * 180 / Math.PI + 360) % 360), css: layers };
});
const blue = p => p.C >= 0.025 && p.h >= 195 && p.h <= 250 && p.L >= 0.85;
for (const theme of ['light', 'dark']) {
  const { ctx, page } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const p = await paper(page);
  check(`warm, ${theme}: the inland letter is pale blue (chroma at least 0.025, a blue hue), not grey`, blue(p), JSON.stringify(p));
  await page.addStyleTag({ content: 'sg-reach[data-skin="warm"] address { --sg-reach-inland: color-mix(in oklch, var(--sg-info) 13%, var(--sg-surface-raised)) !important }' });
  const grey = await paper(page);
  if (theme === 'light') check('control: the old grey paper fails the same probe', !blue(grey), JSON.stringify(grey));
  await ctx.close();
}

{
  const { ctx, page } = await open(DEMO, { js: false });
  const r = await page.evaluate(() => ({ buttons: [...document.querySelectorAll('.sg-reach-copy')].filter(b => b.getBoundingClientRect().height > 0).length, links: document.querySelectorAll('sg-reach a[href]').length }));
  check('without JavaScript: the six links work and no copy button shows (it could do nothing)', r.buttons === 0 && r.links === 6, JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await open(DEMO, { width: 390 });
  await settle(page);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check('at 390 px the page does not scroll sideways', w <= 390, `${w}`);
  await ctx.close();
}

await done();
