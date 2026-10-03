// Browser checks for <sg-action-menu>: the no-JS path first, then the full ARIA APG
// menu button keyboard model, in every register.
//
//   node packages/components/action-menu/action-menu.check.mjs
//
// No JavaScript: the button opens and closes the list, and Tab cycles its
// real items. With JavaScript: ArrowDown/Up open the menu focused on the
// first/last item; ArrowDown/Up, Home, End and typeahead move a roving
// tabindex; Enter/click activates an item, closes the menu and returns
// focus; Tab closes without stealing focus; hover moves the same roving
// focus; Escape returns focus (native); the stagger is off under reduced
// motion; forced colours simplify the list.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/action-menu/demo.html`;

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(demo);
  const defined = await p.evaluate(() => typeof customElements.get('sg-action-menu'));
  check('no JS: the element is never defined', defined === 'undefined');
  check('no JS: the list starts closed', !(await p.isVisible('#account-menu')));
  await p.click('#account-trigger');
  check('no JS: clicking the trigger opens the list', await p.isVisible('#account-menu'));
  await p.keyboard.press('Tab');
  const firstFocused = await p.evaluate(() => document.activeElement.id);
  check('no JS: Tab reaches the first real item', firstFocused === 'mi-profile', firstFocused);
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-action-menu')].every(e => e.dataset.skin));
  const tag = `${register}:`;
  const focused = () => p.evaluate(() => document.activeElement.id);
  const isOpen = () => p.evaluate(() => document.getElementById('account-trigger').closest('sg-action-menu').open);

  // ArrowDown on the closed button opens it, focused on the first item
  await p.focus('#account-trigger');
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(60);
  check(`${tag} ArrowDown opens the menu, focused on the first item`, await isOpen() && await focused() === 'mi-profile');

  // AB1: the list must sit against its trigger, not at a static flow
  // position. AB2: its box should fit its four items, not balloon past them.
  const rects = await p.evaluate(() => {
    const t = document.getElementById('account-trigger').getBoundingClientRect();
    const menu = document.getElementById('account-menu').getBoundingClientRect();
    const items = [...document.querySelectorAll('#account-menu [role="menuitem"]')].map(el => el.getBoundingClientRect().height);
    return { trigger: t, menu, items };
  });
  const gap = Math.abs(rects.menu.top - rects.trigger.bottom);
  check(`${tag} the list's top edge sits within 8px of the trigger's bottom edge`, gap <= 8, `gap ${gap.toFixed(1)}px; trigger bottom ${rects.trigger.bottom.toFixed(0)}, menu top ${rects.menu.top.toFixed(0)}`);
  const itemsTotal = rects.items.reduce((a, b) => a + b, 0);
  check(`${tag} the list's own height stays close to its items' total height (no ballooning empty area)`, rects.menu.height - itemsTotal < 40, `menu ${rects.menu.height.toFixed(0)}px, items sum to ${itemsTotal.toFixed(0)}px`);

  // ArrowDown/Up move the roving focus, wrapping
  await p.keyboard.press('ArrowDown');
  check(`${tag} ArrowDown moves to the second item`, await focused() !== 'mi-profile');
  await p.keyboard.press('Home');
  check(`${tag} Home returns to the first item`, await focused() === 'mi-profile');
  await p.keyboard.press('ArrowUp');
  check(`${tag} ArrowUp from the first item wraps to the last`, await focused() === 'mi-signout');
  await p.keyboard.press('End');
  check(`${tag} End reaches the last item`, await focused() === 'mi-signout');

  // typeahead: "P" from the last item should reach "Payment methods"
  await p.keyboard.press('p');
  const afterP = await focused();
  const label = await p.evaluate(id => document.getElementById(id).textContent.trim(), afterP);
  check(`${tag} typing "p" jumps to an item starting with P`, /^P/.test(label), `${afterP}: ${label}`);

  // hover moves the same roving focus
  await p.hover('#mi-signout');
  check(`${tag} hovering an item moves the roving focus to it`, await focused() === 'mi-signout');

  // Enter activates, closes the menu, returns focus to the trigger
  await p.evaluate(() => document.getElementById('last-choice').textContent = '');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(60);
  check(`${tag} Enter activates the item's own click handler`, (await p.evaluate(() => document.getElementById('last-choice').textContent)) === 'Chosen: Sign out');
  check(`${tag} activating an item closes the menu`, !(await isOpen()));
  check(`${tag} focus returns to the trigger`, await focused() === 'account-trigger');

  // ArrowUp on the closed button opens it, focused on the last item
  await p.keyboard.press('ArrowUp');
  await p.waitForTimeout(60);
  check(`${tag} ArrowUp opens the menu, focused on the last item`, await focused() === 'mi-signout');

  // Tab closes the menu but does not steal focus back to the trigger
  await p.keyboard.press('Tab');
  await p.waitForTimeout(60);
  check(`${tag} Tab closes the menu`, !(await isOpen()));
  check(`${tag} Tab does not return focus to the trigger`, await focused() !== 'account-trigger');

  // the teental stagger: items carry increasing, non-negative delays
  await p.focus('#account-trigger');
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(30);
  const delays = await p.evaluate(() => [...document.querySelectorAll('#account-menu [role="menuitem"]')].map(el => parseFloat(getComputedStyle(el).animationDelay) * 1000));
  check(`${tag} each item carries its own teental stagger delay`, delays.every(d => d >= 0) && delays[1] > delays[0], JSON.stringify(delays));
  // every item, including the last (the one most likely to be shot mid-stagger),
  // really reaches full opacity once its own entrance animation finishes —
  // waited for by animation state, never a guessed timeout
  await p.waitForFunction(() => [...document.querySelectorAll('#account-menu [role="menuitem"]')].every(el => el.getAnimations().every(a => a.playState !== 'running')));
  const settled = await p.evaluate(() => [...document.querySelectorAll('#account-menu [role="menuitem"]')].map(el => getComputedStyle(el).opacity));
  check(`${tag} every item, including the last, reaches full opacity once its entrance finishes`, settled.every(o => o === '1'), JSON.stringify(settled));
  await p.keyboard.press('Escape');
  // the next block reopens at once: wait for this close to really finish, or the ArrowDown can land mid-close
  await p.waitForFunction(() => !document.querySelector('#account-menu').matches(':popover-open'));

  // playful only: the stamped landing (S2, Rasika's Wave 5 review) — a
  // real impression per item, on the same teental beat as the entrance,
  // that never delays the roving focus action-menu.js already moved synchronously.
  if (register === 'playful') {
    await p.focus('#account-trigger');
    await p.keyboard.press('ArrowDown');
    // "At once" is within 150 ms: far inside the stamp's bloom (hundreds of ms), but not the same
    // task as the key press, since the popover's own toggle handler moves focus. Read in the same
    // evaluate as the key press it failed 4 runs of 4 on a quiet machine, a race in the check.
    await p.waitForFunction(() => document.activeElement?.id === 'mi-profile', null, { timeout: 150 }).catch(() => {});
    const focusedAtOnce = await focused();
    check(`${tag} focus lands on the first item at once, before the stamp has even started blooming`, focusedAtOnce === 'mi-profile');
    await p.waitForFunction(() => [...document.querySelectorAll('#account-menu .sg-action-menu-item-stamp')].every(s => s.getAnimations().every(a => a.playState !== 'running')), { timeout: 3000 });
    const stamps = await p.evaluate(() => [...document.querySelectorAll('#account-menu .sg-action-menu-item-stamp')].map(s => getComputedStyle(s).opacity));
    check(`${tag} every item's stamp blooms and fades fully, leaving no permanent mark`, stamps.length === 4 && stamps.every(o => o === '0'), JSON.stringify(stamps));
    await p.keyboard.press('Escape');
  }

  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── Escape returns focus to the trigger (native popover="auto") ────────────
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready);
  await p.click('#account-trigger');
  await p.waitForTimeout(60);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(60);
  const focused = await p.evaluate(() => document.activeElement.id);
  const open = await p.evaluate(() => document.getElementById('account-trigger').closest('sg-action-menu').open);
  check('Escape closes the menu and returns focus to the trigger', !open && focused === 'account-trigger', focused);
  await ctx.close();
}

// ── reduced motion: no stagger animation plays ──────────────────────────────
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=playful`);
  await p.waitForFunction(() => window.__ready);
  await p.click('#account-trigger');
  await p.waitForTimeout(60);
  const n = await p.evaluate(() => document.getElementById('account-menu').getAnimations({ subtree: true }).length);
  check('reduced motion: no entrance animation runs', n === 0, `${n} animations`);
  const stampCount = await p.evaluate(() => document.querySelectorAll('#account-menu .sg-action-menu-item-stamp').length);
  check('reduced motion, playful: the stamp is never even created, not just paused', stampCount === 0, `${stampCount} stamps`);
  await ctx.close();
}

// ── forced colours ──────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ forcedColors: 'active' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=playful`);
  await p.waitForFunction(() => window.__ready);
  await p.click('#account-trigger');
  await p.waitForTimeout(60);
  const border = await p.evaluate(() => getComputedStyle(document.getElementById('account-menu')).borderStyle);
  check('forced colours: a real border on the list', border === 'solid', border);
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
