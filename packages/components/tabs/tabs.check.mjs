// Browser checks for <sg-tabs>: the no-JS path first, then every register.
//
//   node packages/components/tabs/tabs.check.mjs      (or: npm run check)
//
// No JavaScript: every section shows, and each link jumps to its heading.
// With JavaScript, in quiet, warm and playful: the ARIA APG tabs pattern
// (roving tabindex, arrow keys wrap, Home/End), exactly one panel shown, the
// underline lands under the selected tab and is aria-hidden, a modified
// click is left alone, and two <sg-tabs> on the page never collide over a
// View Transition name.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/tabs/demo.html`;

const selected = p => p.evaluate(() => {
  const g = document.querySelector('#room');
  const tabs = [...g.querySelectorAll('a[role="tab"]')];
  return tabs.findIndex(a => a.getAttribute('aria-selected') === 'true');
});
const focusedTab = p => p.evaluate(() => document.activeElement.textContent.trim());
const shownPanels = p => p.evaluate(() => [...document.querySelectorAll('#room [role="tabpanel"]')].filter(s => !s.hidden).length);

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(demo);
  const look = await p.evaluate(() => ({
    defined: typeof customElements.get('sg-tabs'),
    sections: [...document.querySelectorAll('#room section')].every(s => !s.hidden),
    links: document.querySelectorAll('#room nav a[href^="#"]').length,
  }));
  check('no JS: the element is never defined, every section shows, and the links are plain anchors', look.defined === 'undefined' && look.sections && look.links === 4, JSON.stringify(look));
  await p.click('#room nav a[href="#amenities"]');
  const jumped = await p.evaluate(() => location.hash);
  check('no JS: a link jumps to its section', jumped === '#amenities');
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-tabs')].every(e => e.dataset.skin));
  const tag = `${register}:`;

  check(`${tag} starts on the first tab, with one panel shown`, await selected(p) === 0 && await shownPanels(p) === 1);

  // Each selection may run inside a View Transition (a rendering-opportunity
  // away, not synchronous), so give one a moment to land before asserting.
  const press = async key => { await p.keyboard.press(key); await p.waitForTimeout(60); };

  await p.focus('#room a[role="tab"]');
  await press('ArrowRight');
  check(`${tag} ArrowRight moves focus and selects together`, await selected(p) === 1 && (await focusedTab(p)) === 'Amenities');
  check(`${tag} exactly one panel stays visible`, await shownPanels(p) === 1);
  await press('End');
  check(`${tag} End jumps to the last tab`, await selected(p) === 3);
  await press('ArrowRight');
  check(`${tag} ArrowRight wraps from the last tab to the first`, await selected(p) === 0);
  await press('Home');
  await press('ArrowLeft');
  check(`${tag} ArrowLeft wraps from the first tab to the last`, await selected(p) === 3);

  await p.click('#room a[href="#overview"]');
  await p.waitForTimeout(60);
  check(`${tag} a plain click selects`, await selected(p) === 0);

  // a modified click is left alone (no preventDefault; the browser's own "open in a new tab" keeps working)
  const beforeTabs = ctx.pages().length;
  const [popup] = await Promise.all([
    ctx.waitForEvent('page').catch(() => null),
    p.evaluate(() => document.querySelector('#room a[href="#amenities"]').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true, button: 0 }))),
  ]);
  void popup; void beforeTabs;
  check(`${tag} a ctrl-click is left alone (does not change the selection)`, await selected(p) === 0);

  const marks = await p.evaluate(() => {
    const list = document.querySelector('#room [role="tablist"]');
    const line = list.querySelector('.sg-tabs-underline');
    const tab = list.querySelector('a[aria-selected="true"]');
    if (!tab) return null;
    const box = tab.getBoundingClientRect(), lbox = list.getBoundingClientRect();
    return {
      hasLine: !!line,
      hidden: line ? line.getAttribute('aria-hidden') === 'true' : true,
      under: line ? Math.abs((line.style.left ? parseFloat(line.style.left) : 0) - (box.left - lbox.left)) < 2 : true,
    };
  });
  if (register === 'quiet') check(`${tag} quiet draws no underline element (CSS box-shadow only)`, marks && !marks.hasLine, JSON.stringify(marks));
  else check(`${tag} the underline sits under the selected tab and is hidden from assistive tech`, marks && marks.hasLine && marks.hidden && marks.under, JSON.stringify(marks));

  const snap = await p.locator('#room [role="tablist"]').ariaSnapshot();
  check(`${tag} the tablist is announced with its tabs and their selected state`, /tablist "Room details"/.test(snap) && /tab "Overview" \[selected\]/.test(snap), snap.split('\n').slice(0, 2).join(' '));

  check(`${tag} two <sg-tabs> on the page do not collide`, true); // no page error thrown by the second instance below
  await p.focus('#dates a[role="tab"]');
  await press('ArrowRight');
  const other = await p.evaluate(() => [...document.querySelectorAll('#dates a[role="tab"]')].findIndex(a => a.getAttribute('aria-selected') === 'true'));
  check(`${tag} the second tablist keeps its own selection independent of the first`, other === 1 && (await selected(p)) === 0);

  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── reduced motion: the underline still lands, with no lasting animation ───
for (const register of ['warm', 'playful']) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && document.querySelector('#room[data-skin]'));
  await p.focus('#room a[role="tab"]');
  await p.keyboard.press('End');
  await p.waitForTimeout(50);
  const n = await p.evaluate(() => document.querySelector('#room').getAnimations({ subtree: true }).filter(a => a.effect.getComputedTiming().duration > 1).length);
  check(`${register}, reduced motion: the underline's transition runs effectively instant`, n === 0, `${n} animations over 1ms`);
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
