// Browser checks for <sg-check>: the no-JS path first, then every register.
//
//   node packages/components/check/check.check.mjs      (or: npm run check)
//
// No JavaScript: the quiet box is drawn by CSS alone, Space ticks it, a
// required box stops the form, and a valid form submits the values.
// With JavaScript, in quiet, warm and playful: Space still ticks it, the
// drawing follows, "All extras" goes checked, mixed and clear with its
// children and says "mixed" to assistive tech, the drawing is hidden from
// assistive tech, reduced motion adds no animation, forced colours bring back
// the native checkbox, and the box sits level with Indic labels.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/check/demo.html`;

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(demo);
  const look = await p.evaluate(() => {
    const i = document.querySelector('input[name="rules"]');
    return { defined: typeof customElements.get('sg-check'), appearance: getComputedStyle(i).appearance, border: getComputedStyle(i).borderTopStyle };
  });
  check('no JS: the element is never defined, and CSS alone draws the hairline box', look.defined === 'undefined' && look.appearance === 'none' && look.border === 'solid', JSON.stringify(look));
  await p.focus('input[name="rules"]');
  await p.keyboard.press('Space');
  check('no JS: Space ticks it', await p.isChecked('input[name="rules"]'));
  await p.keyboard.press('Space');
  await p.click('button[type="submit"]');
  await p.waitForTimeout(200);
  check('no JS: a required box left clear stops the form', !new URL(p.url()).searchParams.has('sent'));
  check('no JS: the browser marks it invalid', await p.evaluate(() => !document.querySelector('input[name="rules"]').checkValidity()));
  await p.check('input[name="rules"]');
  await p.check('#x-pickup');
  await Promise.all([p.waitForURL(/sent=1/), p.click('button[type="submit"]')]);
  const q = new URL(p.url()).searchParams;
  check('no JS: the form submits the ticked values', q.getAll('extras').join() === 'breakfast,pickup' && q.get('rules') === 'agreed' && !q.has('pets'), q.toString());
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-check')].every(e => e.dataset.skin));
  const tag = `${register}:`;

  await p.focus('#x-pickup');
  await p.keyboard.press('Space');
  const art = await p.evaluate(() => {
    const host = document.querySelector('#x-pickup').closest('sg-check');
    const svg = host.querySelector('.sg-check-art');
    const marks = svg ? [...svg.querySelectorAll('.sg-check-mark, .sg-check-stamp')].filter(m => m.style.display !== 'none').length : null;
    return { checked: host.checked, skin: host.dataset.skin, marks, hidden: svg?.getAttribute('aria-hidden') ?? 'no art' };
  });
  check(`${tag} Space ticks it and the drawing follows`, art.checked && art.skin === register && (register === 'quiet' ? art.marks === null : art.marks >= 1), JSON.stringify(art));
  if (register !== 'quiet') check(`${tag} the drawing is hidden from assistive tech`, art.hidden === 'true');
  if (register !== 'quiet') {
    // S5: the register shows at rest (the box) and a hand or a press shows on ticking
    await p.focus('#x-late');
    await p.keyboard.press('Space');
    const look = await p.evaluate(() => {
      const host = document.querySelector('#x-late').closest('sg-check');
      const anims = host.getAnimations({ subtree: true }).map(a => a.effect.getTiming().duration);
      const box = host.querySelector('.sg-check-box').getAttribute('d');
      const img = host.querySelector('mask image')?.getAttribute('href') ?? '';
      return { anims, strokes: (box.match(/M/g) || []).length, texture: img.startsWith('data:image/png') };
    });
    if (register === 'warm') check(`${tag} the box is four pencil strokes, and the tick is drawn in over at least 250 ms`, look.strokes === 4 && look.anims.some(d => d >= 250), JSON.stringify(look));
    await p.keyboard.press('Space'); // and back, for the checks below
    if (register === 'playful') check(`${tag} the tick is stamped with a press and printed through the stamp's ink texture`, look.anims.some(d => d >= 250) && look.texture, JSON.stringify(look));
  }

  // "All extras": breakfast and pickup are on, late is off: mixed
  let all = await p.evaluate(() => { const i = document.getElementById('x-all'); return { checked: i.checked, mixed: i.indeterminate }; });
  const snap = await p.locator('#x-all').ariaSnapshot();
  check(`${tag} some children on: All extras is mixed, and says so`, !all.checked && all.mixed && /mixed/.test(snap), snap.trim());
  await p.click('#x-all');
  const kids = await p.evaluate(() => ['x-breakfast', 'x-pickup', 'x-late'].map(id => document.getElementById(id).checked));
  all = await p.evaluate(() => { const i = document.getElementById('x-all'); return { checked: i.checked, mixed: i.indeterminate, attr: i.closest('sg-check').hasAttribute('indeterminate') }; });
  check(`${tag} ticking All extras ticks every child`, kids.every(Boolean) && all.checked && !all.mixed && !all.attr, JSON.stringify({ kids, all }));
  await p.click('#x-all');
  const cleared = await p.evaluate(() => ['x-breakfast', 'x-pickup', 'x-late'].map(id => document.getElementById(id).checked));
  check(`${tag} clearing it clears them`, cleared.every(c => !c), JSON.stringify(cleared));

  // the box sits level with the first line of an Indic label
  const levels = await p.evaluate(() => [...document.querySelectorAll('sg-check[lang] label')].map(l => {
    const box = l.querySelector('input').getBoundingClientRect();
    const r = document.createRange(); r.selectNodeContents(l.lastChild); const line = r.getClientRects()[0];
    return Math.abs((box.top + box.bottom) / 2 - (line.top + line.bottom) / 2);
  }));
  check(`${tag} the box is level with Marathi, Kannada and Konkani labels`, levels.every(d => d < 3), levels.map(d => d.toFixed(1)).join(', '));
  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── reduced motion: no animation on a tick ──────────────────────────────────
for (const register of ['warm', 'playful']) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-check')].every(e => e.dataset.skin));
  await p.click('#x-late');
  // Tokens take every movement to 0.01ms under reduced motion; count only what a person could see.
  const n = await p.evaluate(() => document.querySelector('#x-late').closest('sg-check').getAnimations({ subtree: true }).filter(a => a.effect.getTiming().duration > 1).length);
  check(`${register}, reduced motion: the mark appears with no visible animation`, n === 0, `${n} animations over 1ms`);
  await ctx.close();
}

// ── forced colours: the native checkbox, no drawing ─────────────────────────
for (const register of ['quiet', 'playful']) {
  const ctx = await browser.newContext({ forcedColors: 'active' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready);
  const fc = await p.evaluate(() => {
    const i = document.querySelector('#x-breakfast');
    const art = i.closest('sg-check').querySelector('.sg-check-art');
    return { appearance: getComputedStyle(i).appearance, art: art ? getComputedStyle(art).display : 'none' };
  });
  check(`${register}, forced colours: the system's own checkbox, drawing hidden`, fc.appearance === 'auto' && fc.art === 'none', JSON.stringify(fc));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
