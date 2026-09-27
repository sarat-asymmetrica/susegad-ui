// Browser checks for <sg-radio-group>: the no-JS path first, then every register.
//
//   node packages/components/radio/radio.check.mjs      (or: npm run check)
//
// No JavaScript: CSS alone draws the circles; Tab lands on the chosen radio;
// the arrow keys move and choose, skipping a disabled one; a required group
// stops the form; a valid form submits one value per group.
// With JavaScript, in quiet, warm and playful: the same keys work; exactly one
// mark per group follows the choice; the group is announced with its legend;
// the drawing is hidden from assistive tech; `value` reads and writes; reduced
// motion adds no visible animation; forced colours bring back native radios.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/radio/demo.html`;
const chosen = (p, name) => p.evaluate(n => document.querySelector(`input[name="${n}"]:checked`)?.value ?? null, name);
const focused = p => p.evaluate(() => `${document.activeElement.name}=${document.activeElement.value}`);

async function keys(p, tag) {
  // Guests: Tab from the page start lands on the chosen radio, not the first one.
  await p.focus('h1').catch(() => {});
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('Tab');
  check(`${tag} Tab lands on the chosen radio`, await focused(p) === 'guests=2', await focused(p));
  await p.keyboard.press('ArrowRight');
  check(`${tag} ArrowRight moves and chooses`, await chosen(p, 'guests') === '4' && await focused(p) === 'guests=4');
  await p.keyboard.press('ArrowLeft');
  await p.keyboard.press('ArrowLeft');
  check(`${tag} ArrowLeft wraps from the first to the last`, await chosen(p, 'guests') === '6', await chosen(p, 'guests'));
  // Arriving by: nothing chosen, required, one option disabled.
  await p.keyboard.press('Tab');
  check(`${tag} with nothing chosen, Tab lands on the first radio`, await focused(p) === 'arrive=car', await focused(p));
  await p.keyboard.press('ArrowUp');
  check(`${tag} the arrows skip a disabled radio`, await chosen(p, 'arrive') === 'air', await chosen(p, 'arrive'));
}

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(demo);
  const look = await p.evaluate(() => {
    const i = document.querySelector('input[name="guests"]');
    return { defined: typeof customElements.get('sg-radio-group'), appearance: getComputedStyle(i).appearance, radius: getComputedStyle(i).borderTopLeftRadius };
  });
  check('no JS: the element is never defined, and CSS alone draws the hairline circles', look.defined === 'undefined' && look.appearance === 'none' && look.radius === '50%', JSON.stringify(look));
  await p.click('button[type="submit"]');
  await p.waitForTimeout(200);
  check('no JS: a required group with nothing chosen stops the form', !new URL(p.url()).searchParams.has('sent'));
  await p.goto(demo);
  await keys(p, 'no JS:');
  await Promise.all([p.waitForURL(/sent=1/), p.click('button[type="submit"]')]);
  const q = new URL(p.url()).searchParams;
  check('no JS: the form submits one value per group', q.get('guests') === '6' && q.get('arrive') === 'air' && q.get('lang') === 'en', q.toString());
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-radio-group')].every(e => e.dataset.skin));
  const tag = `${register}:`;
  await keys(p, tag);

  const marks = await p.evaluate(() => [...document.querySelectorAll('sg-radio-group')].map(g => {
    const shown = [...g.querySelectorAll('.sg-radio-art')].map(svg => [...svg.querySelectorAll('.sg-radio-ink, .sg-radio-kolam')].some(m => m.style.display !== 'none'));
    const at = shown.indexOf(true);
    return { count: shown.filter(Boolean).length, on: at < 0 ? null : g.querySelectorAll('input[type="radio"]')[at].value, value: g.value, hidden: [...g.querySelectorAll('.sg-radio-art')].every(s => s.getAttribute('aria-hidden') === 'true') };
  }));
  if (register === 'quiet') check(`${tag} quiet draws with CSS only`, marks.every(m => m.count === 0), JSON.stringify(marks));
  else {
    check(`${tag} exactly one mark per group, on the chosen radio`, marks.every(m => m.count === 1 && m.on === m.value), JSON.stringify(marks));
    check(`${tag} the drawings are hidden from assistive tech`, marks.every(m => m.hidden));
  }
  const snap = await p.locator('sg-radio-group').first().ariaSnapshot();
  check(`${tag} the group is announced by its legend, with its radios`, /group "Guests"/.test(snap) && /radio "6, the whole house" \[checked\]/.test(snap), snap.split('\n').slice(0, 2).join(' '));
  await p.evaluate(() => { document.querySelector('sg-radio-group').value = '5'; });
  check(`${tag} value writes and reads`, await chosen(p, 'guests') === '5' && await p.evaluate(() => document.querySelector('sg-radio-group').value) === '5');

  const levels = await p.evaluate(() => [...document.querySelectorAll('label[lang]')].map(l => {
    const box = l.querySelector('input').getBoundingClientRect();
    const r = document.createRange(); r.selectNodeContents(l.lastChild); const line = r.getClientRects()[0];
    return Math.abs((box.top + box.bottom) / 2 - (line.top + line.bottom) / 2);
  }));
  check(`${tag} the circle is level with Marathi, Kannada and Konkani labels`, levels.every(d => d < 3), levels.map(d => d.toFixed(1)).join(', '));
  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── reduced motion ──────────────────────────────────────────────────────────
for (const register of ['warm', 'playful']) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-radio-group')].every(e => e.dataset.skin));
  await p.click('input[name="guests"][value="6"]');
  const n = await p.evaluate(() => document.querySelector('sg-radio-group').getAnimations({ subtree: true }).filter(a => a.effect.getTiming().duration > 1).length);
  check(`${register}, reduced motion: the choice moves with no visible animation`, n === 0, `${n} animations over 1ms`);
  await ctx.close();
}

// ── forced colours ──────────────────────────────────────────────────────────
for (const register of ['quiet', 'warm']) {
  const ctx = await browser.newContext({ forcedColors: 'active' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready);
  const fc = await p.evaluate(() => {
    const i = document.querySelector('input[name="guests"]');
    const art = i.parentElement.querySelector('.sg-radio-art');
    return { appearance: getComputedStyle(i).appearance, art: art ? getComputedStyle(art).display : 'none' };
  });
  check(`${register}, forced colours: the system's own radios, drawing hidden`, fc.appearance === 'auto' && fc.art === 'none', JSON.stringify(fc));
  await ctx.close();
}

// ── S5: the register shows at 1x ────────────────────────────────────────────
for (const register of ['warm', 'playful']) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && document.querySelector('sg-radio-group[data-skin]'));
  const look = await p.evaluate(() => {
    const input = document.querySelector('input[type=radio]:checked');
    const art = input.nextElementSibling;
    const box = input.getBoundingClientRect(), shown = [...art.querySelectorAll('path, g')].filter(n => getComputedStyle(n).display !== 'none');
    const ink = art.querySelector('.sg-radio-ink')?.getBoundingClientRect();
    return { ratio: ink ? +(ink.width / box.width).toFixed(2) : null, ring: art.querySelector('.sg-radio-ring') ? getComputedStyle(art.querySelector('.sg-radio-ring')).display : null, kolam: !!shown.find(n => n.classList.contains('sg-radio-kolam')) };
  });
  if (register === 'warm') check('warm: the chosen answer is circled in ink a quarter bigger than the old ring (radius 8.6 of 10), past the edge of the radio', look.ratio >= 1.08, JSON.stringify(look));
  else check('playful: the chosen radio becomes the kolam flower in place of the circle', look.kolam && look.ring === 'none', JSON.stringify(look));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
