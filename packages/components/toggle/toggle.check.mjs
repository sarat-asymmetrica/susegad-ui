// Browser checks for <sg-toggle>: the no-JS path first, then every register.
//
//   node packages/components/toggle/toggle.check.mjs      (or: npm run check)
//
// No JavaScript: CSS alone draws the switch; it is announced as a switch;
// Space turns it on and off; the form submits what is on.
// With JavaScript, in quiet, warm and playful: the same; the drawing follows
// (the bolt slides into the keeper, the lamp lights); the flame flickers only
// while lit and on screen, and not at all under reduced motion; the drawing is
// hidden from assistive tech; forced colours bring back the native control.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/toggle/demo.html`;
const hk = 'input[name="housekeeping"]';

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(demo);
  const look = await p.evaluate(s => ({ defined: typeof customElements.get('sg-toggle'), appearance: getComputedStyle(document.querySelector(s)).appearance, radius: getComputedStyle(document.querySelector(s)).borderTopLeftRadius }), hk);
  check('no JS: the element is never defined, and CSS alone draws the switch', look.defined === 'undefined' && look.appearance === 'none' && parseFloat(look.radius) > 100, JSON.stringify(look));
  const snap = await p.locator(hk).ariaSnapshot();
  check('no JS: it is announced as a switch, by its label', /^- switch "Daily housekeeping, between 11 am and 1 pm"/.test(snap.trim()), snap.trim());
  await p.focus(hk);
  await p.keyboard.press('Space');
  check('no JS: Space turns it on', await p.isChecked(hk));
  const breakfast = 'input[name="breakfast"]';
  await p.focus(breakfast);
  await p.keyboard.press('Space');
  check('no JS: Space turns it off', !(await p.isChecked(breakfast)));
  await Promise.all([p.waitForURL(/sent=1/), p.click('button[type="submit"]')]);
  const q = new URL(p.url()).searchParams;
  check('no JS: the form submits what is on, and nothing that is off or disabled', q.get('housekeeping') === 'daily' && q.get('reminder') === 'whatsapp' && !q.has('breakfast') && !q.has('pool-heat'), q.toString());
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-toggle')].every(e => e.dataset.skin));
  const tag = `${register}:`;
  const read = () => p.evaluate(s => {
    const host = document.querySelector(s).closest('sg-toggle');
    const svg = host.querySelector('.sg-toggle-art');
    const bolt = svg?.querySelector('.sg-toggle-bolt');
    const fire = svg?.querySelector('.sg-toggle-fire');
    return {
      on: host.checked,
      drawn: svg ? svg.hasAttribute('data-on') : null,
      bolt: bolt ? new DOMMatrix(getComputedStyle(bolt).transform).m41 : null,
      flames: fire ? fire.getAnimations().filter(a => a.playState === 'running').length : null,
      hidden: svg?.getAttribute('aria-hidden') ?? 'no art',
    };
  }, hk);

  await p.focus(hk);
  await p.keyboard.press('Space');
  await p.waitForTimeout(450); // let the bolt's slide finish
  let s = await read();
  check(`${tag} Space turns it on and the drawing follows`, s.on && (register === 'quiet' ? s.drawn === null : s.drawn === true), JSON.stringify(s));
  if (register === 'warm') check(`${tag} the bolt has slid into the keeper`, Math.abs(s.bolt - 8.5) < 0.1, `translateX ${s.bolt}`);
  if (register === 'playful') check(`${tag} the lit flame flickers`, s.flames === 1, `${s.flames} running`);
  if (register !== 'quiet') check(`${tag} the drawing is hidden from assistive tech`, s.hidden === 'true');
  await p.keyboard.press('Space');
  await p.waitForTimeout(450);
  s = await read();
  check(`${tag} Space turns it off and the drawing follows`, !s.on && (register === 'quiet' ? true : s.drawn === false), JSON.stringify(s));
  if (register === 'warm') check(`${tag} the bolt is drawn back`, Math.abs(s.bolt) < 0.1, `translateX ${s.bolt}`);
  if (register === 'playful') check(`${tag} an unlit lamp does not flicker`, s.flames === 0, `${s.flames} running`);

  const snap = await p.locator(hk).ariaSnapshot();
  check(`${tag} still announced as a switch`, /switch "Daily housekeeping/.test(snap), snap.trim());
  const levels = await p.evaluate(() => [...document.querySelectorAll('sg-toggle[lang] label')].map(l => {
    const box = l.querySelector('input').getBoundingClientRect();
    const r = document.createRange(); r.selectNodeContents(l.lastChild); const line = r.getClientRects()[0];
    return { top: box.top - line.top, gap: box.right < line.left };
  }));
  check(`${tag} the control starts level with Indic labels and never overlaps them`, levels.every(l => Math.abs(l.top) < 8 && l.gap), JSON.stringify(levels));
  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── the flame pauses off screen, and holds still under reduced motion ───────
{
  const ctx = await browser.newContext({ viewport: { width: 800, height: 400 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=playful`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-toggle')].every(e => e.dataset.skin));
  const states = () => p.evaluate(() => [...document.querySelectorAll('sg-toggle .sg-toggle-fire')].map(f => f.getAnimations()[0]?.playState ?? 'none'));
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(300);
  const top = await states();
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(300);
  const bottom = await states();
  // breakfast (lit, near the top) runs at the top and pauses when scrolled away
  check('playful: a lit flame pauses when it leaves the screen', top[0] === 'running' && bottom[0] === 'paused', `top ${top.join('/')} | bottom ${bottom.join('/')}`);
  await ctx.close();
}
for (const register of ['warm', 'playful']) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-toggle')].every(e => e.dataset.skin));
  await p.click(hk);
  await p.waitForTimeout(100);
  const n = await p.evaluate(() => [...document.querySelectorAll('sg-toggle')].flatMap(t => t.getAnimations({ subtree: true })).filter(a => a.effect.getTiming().duration > 1).length);
  const bolt = register === 'warm' ? await p.evaluate(s => new DOMMatrix(getComputedStyle(document.querySelector(s).closest('sg-toggle').querySelector('.sg-toggle-bolt')).transform).m41, hk) : null;
  check(`${register}, reduced motion: no visible animation${register === 'warm' ? ', and the bolt is already home' : ', the flame stands still'}`, n === 0 && (bolt === null || Math.abs(bolt - 8.5) < 0.1), `${n} animations over 1ms${bolt !== null ? `, bolt ${bolt}` : ''}`);
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
    const art = i.closest('sg-toggle').querySelector('.sg-toggle-art');
    return { appearance: getComputedStyle(i).appearance, art: art ? getComputedStyle(art).display : 'none' };
  }, hk);
  check(`${register}, forced colours: the system's own control, drawing hidden`, fc.appearance === 'auto' && fc.art === 'none', JSON.stringify(fc));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
