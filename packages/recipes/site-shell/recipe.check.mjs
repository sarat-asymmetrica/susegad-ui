// Browser checks for the site-shell recipe: every piece really works once
// composed, not just alone. Tabs switches which section shows, Menu opens
// with its keyboard model, Dialog and Drawer open/trap focus/close, the
// scroll section drives the Paus scene by real scroll, and the Kantar
// interlude runs between the two booking steps -- all on one page, none
// of them stepping on another.
//
//   node packages/recipes/site-shell/recipe.check.mjs

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/recipes/site-shell/index.html`;

for (const register of ['warm', 'playful']) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready);
  const tag = `${register}:`;

  // Tabs: switching sections
  check(`${tag} starts on Overview`, await p.evaluate(() => !document.getElementById('overview').hidden && document.getElementById('rooms').hidden));
  await p.click('#nav a[href="#rooms"]');
  await p.waitForTimeout(80);
  check(`${tag} Tabs switches to Rooms`, await p.evaluate(() => document.getElementById('rooms').hidden === false && document.getElementById('overview').hidden === true));

  // Menu: ARIA APG keyboard model
  await p.focus('#account-menu + * , sg-action-menu button'); // best-effort; then use keyboard from the trigger directly
  await p.click('sg-action-menu button[popovertarget]');
  await p.waitForTimeout(60);
  const menuOpen = await p.evaluate(() => document.getElementById('account-menu').matches(':popover-open'));
  check(`${tag} Menu opens on click`, menuOpen);
  await p.keyboard.press('ArrowDown');
  const menuFocus = await p.evaluate(() => document.activeElement?.textContent?.trim());
  check(`${tag} Menu's roving focus lands on an item`, menuFocus === 'Your stays' || menuFocus === 'Sign out', menuFocus);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(60);
  check(`${tag} Escape closes the menu`, !(await p.evaluate(() => document.getElementById('account-menu').matches(':popover-open'))));

  // Dialog: open, focus trapped, close returns focus
  await p.click('#nav a[href="#overview"]');
  await p.waitForTimeout(80);
  const opener = p.locator('a[data-sg-dialog="ask"]');
  await opener.focus();
  await opener.click();
  await p.waitForTimeout(200); // the Carepa scrim mounts, in warm/playful
  check(`${tag} Dialog opens`, await p.evaluate(() => document.querySelector('#ask dialog').open));
  const trapped = await p.evaluate(() => document.activeElement?.closest?.('#ask') != null);
  check(`${tag} focus moves inside the open dialog`, trapped);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  check(`${tag} Escape closes the dialog and returns focus to the opener`, await p.evaluate(() => !document.querySelector('#ask dialog').open && document.activeElement === document.querySelector('a[data-sg-dialog="ask"]')));

  // Drawer: same contract, from the Rooms section
  await p.click('#nav a[href="#rooms"]');
  await p.waitForTimeout(80);
  const roomsOpener = p.locator('a[data-sg-drawer="rooms-drawer"]');
  await roomsOpener.focus();
  await roomsOpener.click();
  await p.waitForTimeout(200);
  check(`${tag} Drawer opens`, await p.evaluate(() => document.querySelector('#rooms-drawer dialog').open));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  check(`${tag} Escape closes the drawer and returns focus`, await p.evaluate(() => !document.querySelector('#rooms-drawer dialog').open) && await roomsOpener.evaluate(el => el === document.activeElement));

  // Scroll section: real scroll drives the Paus scene's progress, only on Overview
  await p.click('#nav a[href="#overview"]');
  await p.waitForTimeout(200); // the cross-fade / underline settle
  const before = await p.evaluate(() => document.querySelector('sg-scroll-section')?.progress ?? null);
  await p.mouse.wheel(0, 500);
  await p.waitForTimeout(250);
  const after = await p.evaluate(() => document.querySelector('sg-scroll-section')?.progress ?? null);
  check(`${tag} the scroll section's progress moves with real scroll`, before != null && after != null && after > before, `${before} -> ${after}`);
  const sceneProgress = await p.evaluate(() => document.querySelector('sg-scroll-section sg-scene')?.getAttribute('progress'));
  check(`${tag} the Paus scene receives that same progress`, sceneProgress != null && Math.abs(+sceneProgress - after) < 0.01, `${sceneProgress} vs ${after}`);

  // Kantar: runs between the two booking steps
  await p.click('#nav a[href="#book"]');
  await p.waitForTimeout(120);
  check(`${tag} starts on booking step 1`, await p.evaluate(() => !!document.getElementById('booking-step-1')));
  await p.click('#booking-confirm');
  await p.waitForTimeout(200);
  const duringWait = await p.evaluate(() => !!document.querySelector('.sg-kantar') && !document.querySelector('#booking-stage h3[tabindex="-1"]'));
  check(`${tag} the Kantar interlude covers the stage while the hold is in flight`, duringWait);
  await p.waitForFunction(() => document.querySelector('#booking-stage h3[tabindex="-1"]'), { timeout: 3000 });
  check(`${tag} step 2 lands once the curtain rises`, await p.evaluate(() => document.querySelector('#booking-stage h3[tabindex="-1"]')?.textContent.includes('Held')));
  await p.waitForFunction(() => !document.querySelector('.sg-kantar'), { timeout: 2000 });
  check(`${tag} the interlude tears itself down`, await p.evaluate(() => !document.querySelector('.sg-kantar')));

  check(`${tag} no console or page errors across the whole run`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// quiet: no curtain theatre for Kantar, still works end to end
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready);
  await p.click('#nav a[href="#book"]');
  await p.waitForTimeout(80);
  await p.click('#booking-confirm');
  const has = await p.evaluate(() => !!document.querySelector('.sg-kantar-plain') && !document.querySelector('.sg-kantar-curtain'));
  check('quiet: Kantar falls back to a plain status line here too', has);
  await p.waitForFunction(() => document.querySelector('#booking-stage h3[tabindex="-1"]'), { timeout: 3000 });
  check('quiet: the booking flow still completes', true);
  await ctx.close();
}

// no JavaScript: nothing is unreachable
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(demo);
  const look = await p.evaluate(() => ({
    tabsUndefined: typeof customElements.get('sg-tabs'),
    everySectionShows: [...document.querySelectorAll('main > section')].every(s => !s.hidden),
    dialogOpenerIsRealLink: document.querySelector('a[data-sg-dialog="ask"]').getAttribute('href') === './no-js.html',
    drawerOpenerIsRealLink: document.querySelector('a[data-sg-drawer="rooms-drawer"]').getAttribute('href') === './no-js.html',
  }));
  check('no JS: the tablist is never enhanced, every section shows, and Dialog/Drawer openers are real links', look.tabsUndefined === 'undefined' && look.everySectionShows && look.dialogOpenerIsRealLink && look.drawerOpenerIsRealLink, JSON.stringify(look));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
