// Browser checks for Toast behaviour the screenshots cannot show. Not a unit
// test (npm test runs the pure core); run it by hand or from CI:
//
//   node packages/components/toast/toast.check.mjs
//
// Checks: focus is never taken; every toast reaches a live region (errors the
// alert one); a toast times out after its reading time; pointing at the pile
// stops the clock and lays it out; Alt+Shift+T moves to the newest toast on request;
// Escape dismisses it and focus goes back; an error stays; reduced motion
// shows the letter open at once.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

async function page({ reduced = false, register = 'warm' } = {}) {
  const ctx = await browser.newContext({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // a blank page with an input, a region and the component: nothing else to interfere
  await p.goto(`${server.url}/tools/harness/blank.html?register=${register}`);
  await p.evaluate(async () => {
    document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/toast/toast.css">');
    document.body.innerHTML = '<label for="q">Search</label> <input id="q"><sg-toast-region></sg-toast-region>';
    await import('/packages/components/toast/toast.js');
    await customElements.whenDefined('sg-toast-region');
  });
  return { ctx, p, errors };
}

{
  const { ctx, p, errors } = await page();
  await p.focus('#q');
  await p.keyboard.type('goa');
  await p.evaluate(() => {
    const r = document.querySelector('sg-toast-region');
    window.t1 = r.show({ tone: 'success', title: 'Saved', message: 'Your changes are saved.' });
    window.t2 = r.show({ tone: 'error', title: "Couldn't save", message: 'Check your connection and try again.', action: { label: 'Try again', keep: true } });
  });
  await p.waitForTimeout(400);
  const s = await p.evaluate(() => ({
    active: document.activeElement.id,
    status: document.querySelector('.sg-toast-live[role=status]').textContent,
    alert: document.querySelector('.sg-toast-live[role=alert]').textContent,
    polite: document.querySelector('.sg-toast-live[role=status]').getAttribute('aria-live'),
    label: document.querySelector('.sg-toast-stack').getAttribute('aria-label'),
    close: window.t1.querySelector('.sg-toast-close').getAttribute('aria-label'),
    close2: window.t2.querySelector('.sg-toast-close').getAttribute('aria-label'),
  }));
  check('focus stays in the search field while toasts arrive', s.active === 'q', `active=${s.active}`);
  check('the success is spoken politely, with a pause after its title', s.status.includes('Saved. Your changes are saved.') && s.polite === 'polite', s.status);
  check('the error is spoken as an alert, with its tone in words and without its button label', s.alert === "Error: Couldn't save. Check your connection and try again.", s.alert);
  check('the stack is a named region; each dismiss button names its toast', s.label === 'Notifications' && s.close.startsWith('Dismiss: Saved. Your'), s.close);
  check('a dismiss button names the message, not the action or the tone', s.close2 === "Dismiss: Couldn't save. Check your connection and try again.", s.close2);

  // the pile: only the front letter (the error, newest) is timed, and an error never is; so the success waits
  await p.waitForTimeout(5600);
  check('behind an error, a success waits its turn instead of timing out unseen', await p.evaluate(() => window.t1.isConnected));

  // hover lays the pile out and stops every clock
  await p.hover('.sg-toast-stack sg-toast[data-front]');
  await p.waitForTimeout(200);
  check('pointing at the pile lays it out', await p.evaluate(() => document.querySelector('sg-toast-region').hasAttribute('data-expanded')));

  // Alt+Shift+T, then Escape: dismisses the newest and focus returns
  await p.mouse.move(5, 5);
  await p.focus('#q');
  await p.keyboard.press('Alt+Shift+T');
  const inToast = await p.evaluate(() => document.activeElement.closest('sg-toast')?.id === window.t2.id);
  check('Alt+Shift+T moves focus to the newest toast', inToast);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(900);
  const mid = await p.evaluate(() => ({ gone: !window.t2.isConnected, next: document.activeElement.closest('sg-toast')?.id === window.t1.id }));
  check('Escape dismisses it and focus moves to the next letter in the pile', mid.gone && mid.next, JSON.stringify(mid));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(900);
  const after = await p.evaluate(() => ({ gone: !window.t1.isConnected, active: document.activeElement.id }));
  check('Escape on the last one: focus goes back to the field', after.gone && after.active === 'q', JSON.stringify(after));

  // a short success on its own leaves after its reading time (5 s minimum)
  await p.evaluate(() => { window.t3 = document.querySelector('sg-toast-region').show({ tone: 'success', message: 'Saved' }); });
  const t0 = Date.now();
  await p.waitForFunction(() => !window.t3.isConnected, null, { timeout: 9000 }).catch(() => {});
  const took = Date.now() - t0;
  check('a short success leaves after about 5 s', took > 4500 && took < 7000, `${took} ms`);
  check('no console or page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

{
  const { ctx, p, errors } = await page();
  await p.evaluate(() => { window.t = document.querySelector('sg-toast-region').show({ tone: 'info', message: 'Checkout is at 11 in the morning.' }); });
  await p.hover('.sg-toast-stack sg-toast');
  await p.waitForTimeout(7000);
  check('while pointed at, a toast does not time out', await p.evaluate(() => window.t.isConnected));
  await p.mouse.move(5, 5);
  await p.waitForFunction(() => !window.t.isConnected, null, { timeout: 9000 }).catch(() => {});
  check('after the pointer leaves, the clock resumes and it goes', await p.evaluate(() => !window.t.isConnected));
  check('no console or page errors (pause)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

{
  const { ctx, p } = await page({ reduced: true });
  await p.evaluate(() => { window.t = document.querySelector('sg-toast-region').show({ tone: 'success', message: 'Saved' }); });
  await p.waitForTimeout(150);
  const s = await p.evaluate(() => ({ phase: window.t.dataset.phase, flap: window.t.querySelector('.sg-toast-flap')?.hidden, anims: window.t.getAnimations({ subtree: true }).length }));
  await p.evaluate(() => { document.querySelector('sg-toast-region').hidden = true; });
  check('a hidden region is not displayed', await p.evaluate(() => getComputedStyle(document.querySelector('sg-toast-region')).display === 'none'));
  check('reduced motion: the letter is open at once, with nothing moving', s.phase === 'shown' && s.flap === true && s.anims === 0, JSON.stringify(s));
  await ctx.close();
}

// ── WCAG 2.4.11 at phone width: with an error pinned, no focused control is covered by the pile ──
for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(`${server.url}/packages/components/toast/demo.html?register=${register}`);
  await p.waitForFunction(() => window.__ready === true);
  await p.waitForTimeout(900); // the letters have unfolded
  const worst = [];
  for (let i = 0; i < 40; i++) {
    await p.keyboard.press('Tab');
    await p.waitForTimeout(60);
    const r = await p.evaluate(() => {
      const el = document.activeElement;
      const stack = document.querySelector('.sg-toast-stack');
      if (!el || el === document.body || stack.contains(el)) return null;
      const t = el.getBoundingClientRect();
      const area = Math.max(1, t.width * t.height);
      let covered = 0;
      for (const l of stack.querySelectorAll(':scope > sg-toast:not([hidden])')) {
        if (getComputedStyle(l).display === 'none') continue;
        const q = l.getBoundingClientRect();
        const w = Math.min(t.right, q.right) - Math.max(t.left, q.left), h = Math.min(t.bottom, q.bottom) - Math.max(t.top, q.top);
        if (w > 0 && h > 0) covered += w * h;
      }
      return { what: (el.textContent || el.getAttribute('aria-label') || el.localName).trim().slice(0, 30), covered: Math.min(1, covered / area) };
    });
    if (r) worst.push(r);
  }
  const bad = worst.filter(w => w.covered > 0);
  check(`${register}, 390 px: tabbing ${worst.length} controls with an error up, none is covered by the pile`, worst.length >= 8 && bad.length === 0,
    bad.length ? bad.map(b => `${b.what} ${(b.covered * 100).toFixed(0)}%`).join('; ') : `${worst.length} checked`);
  const pile = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sg-toast-pile').trim());
  check(`${register}: the region tells the page how much room the pile takes`, /^\d+px$/.test(pile) && parseInt(pile, 10) > 60, pile);
  check(`${register}: no page errors at phone width`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
