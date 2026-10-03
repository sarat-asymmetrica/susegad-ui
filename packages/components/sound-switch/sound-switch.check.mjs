// Browser checks for <sg-sound-switch>.
//
//   node packages/components/sound-switch/sound-switch.check.mjs   (or: npm run check)
//
// No JavaScript: CSS alone draws the switch; it is announced as a switch; the
// "needs JavaScript" note shows. With JavaScript: no AudioContext exists and
// nothing plays until the switch is actually clicked; clicking it turns the
// shared switch on, plays its own confirmation, and a second switch on the
// page follows without a reload; the drawing follows in warm and playful;
// reduced motion holds it still; forced colours bring back the native control.

import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/sound-switch/demo.html`;
const sw = 'sg-sound-switch input[type="checkbox"]';

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(demo);
  const defined = await p.evaluate(() => typeof customElements.get('sg-sound-switch'));
  check('no JS: the element is never defined; CSS alone draws the switch', defined === 'undefined');
  const noteVisible = await p.locator('.sg-sound-switch-note').first().isVisible();
  check('no JS: the "needs JavaScript" note shows', noteVisible);
  const snap = await p.locator(sw).first().ariaSnapshot();
  check('no JS: it is announced as a switch, by its label', /^- switch "Sound"/.test(snap.trim()), snap.trim());
  await ctx.close();
}

// ── nothing plays before a gesture, even the first click on the switch itself ──
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  // count every AudioContext ever constructed, and every resume() call, before the module even loads
  await p.addInitScript(() => {
    window.__acCount = 0; window.__lastCtx = null;
    const AC = window.AudioContext;
    window.AudioContext = new Proxy(AC, { construct(t, a) { window.__acCount++; window.__lastCtx = new t(...a); return window.__lastCtx; } });
  });
  await p.goto(demo);
  await p.waitForFunction(() => window.__ready);
  await p.waitForTimeout(200); // long enough for any load-time sound to have started, if the contract were broken
  let before = await p.evaluate(() => window.__acCount);
  check('before any gesture: no AudioContext exists yet', before === 0, `${before} contexts`);
  await p.click(sw);
  await p.waitForTimeout(80);
  // whichever way Chromium grants it (already running from the click, or resumed explicitly),
  // what matters is that a context now exists and is actually running, not merely constructed
  const after = await p.evaluate(() => ({ count: window.__acCount, state: window.__lastCtx?.state }));
  check('the click that turns sound on is itself the gesture: a context now exists and is running', after.count >= 1 && after.state === 'running', JSON.stringify(after));
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-sound-switch')].every(e => e.dataset.skin));
  const tag = `${register}:`;
  const read = () => p.evaluate(s => {
    const host = document.querySelector(s).closest('sg-sound-switch');
    const svg = host.querySelector('.sg-sound-switch-art');
    return { on: host.on, drawn: svg ? svg.hasAttribute('data-on') : null, hidden: svg?.getAttribute('aria-hidden') ?? 'no art' };
  }, sw);

  await p.click(sw);
  await p.waitForTimeout(350);
  let s = await read();
  check(`${tag} clicking turns it on, and the drawing follows`, s.on && (register === 'quiet' ? s.drawn === null : s.drawn === true), JSON.stringify(s));
  if (register !== 'quiet') check(`${tag} the drawing is hidden from assistive tech`, s.hidden === 'true');

  // a second switch on the same page follows, with no reload
  const second = await p.evaluate(() => document.getElementById('second').on);
  check(`${tag} a second switch on the page follows the same setting`, second === true);

  const stored = await p.evaluate(() => localStorage.getItem('sg-sound'));
  check(`${tag} the setting is remembered`, stored === '1', stored);

  await p.click(sw);
  await p.waitForTimeout(350);
  s = await read();
  check(`${tag} clicking again turns it off, and the drawing follows`, !s.on && (register === 'quiet' ? true : s.drawn === false), JSON.stringify(s));

  const snap = await p.locator(sw).first().ariaSnapshot();
  check(`${tag} still announced as a switch`, /switch "Sound"/.test(snap), snap.trim());
  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── playful: the arcs pause off screen and hold still under reduced motion ──
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=playful`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-sound-switch')].every(e => e.dataset.skin));
  await p.click(sw);
  await p.waitForTimeout(100);
  const running = await p.evaluate(s => document.querySelector(s).closest('sg-sound-switch').querySelector('.sg-sound-switch-arcs').getAnimations()[0]?.playState, sw);
  check('playful: the arcs animate once on', running === 'running', running);
  await ctx.close();
}
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=playful`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-sound-switch')].every(e => e.dataset.skin));
  await p.click(sw);
  await p.waitForTimeout(100);
  const n = await p.evaluate(() => [...document.querySelectorAll('sg-sound-switch')].flatMap(t => t.getAnimations({ subtree: true })).filter(a => a.effect.getTiming().duration > 1).length);
  check('reduced motion: no long-running animation', n === 0, `${n} animations`);
  await ctx.close();
}

// ── forced colours ──────────────────────────────────────────────────────────
for (const register of ['quiet', 'playful']) {
  const ctx = await browser.newContext({ forcedColors: 'active' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready);
  const fc = await p.evaluate(s => {
    const i = document.querySelector(s);
    const art = i.closest('sg-sound-switch').querySelector('.sg-sound-switch-art');
    return { appearance: getComputedStyle(i).appearance, art: art ? getComputedStyle(art).display : 'none' };
  }, sw);
  check(`${register}, forced colours: the system's own control, drawing hidden`, fc.appearance === 'auto' && fc.art === 'none', JSON.stringify(fc));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
