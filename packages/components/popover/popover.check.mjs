// Browser checks for <sg-popover>: the no-JS path first, then every register.
//
//   node packages/components/popover/popover.check.mjs
//
// No JavaScript: popovertarget opens and closes the panel, Escape closes it,
// focus returns to the trigger. With JavaScript, in quiet, warm and playful:
// the same, plus the panel near the bottom of the page flips above; forced
// colours simplify the card.

import { clickFocusesButtons, engineName, pickEngine, unsupportedIn } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/popover/demo.html`;

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(demo);
  const defined = await p.evaluate(() => typeof customElements.get('sg-popover'));
  check('no JS: the element is never defined; popovertarget still opens the panel', defined === 'undefined');
  const before = await p.isVisible('#rates');
  // where a click does not focus a button (WebKit), the trigger is focused and Enter pressed: the same open, asked from the keyboard
  const clickFocuses = await clickFocusesButtons(browser);
  if (clickFocuses) await p.click('button[popovertarget="rates"]');
  else { unsupportedIn(engineName(), 'a mouse click giving the trigger focus', 'a click leaves focus where it was in this engine, so the panel is opened by focusing the trigger and pressing Enter'); await p.focus('button[popovertarget="rates"]'); await p.keyboard.press('Enter'); }
  check('no JS: clicking the trigger opens the panel', !before && await p.isVisible('#rates'));
  await p.keyboard.press('Escape');
  // it fades out over 120ms: wait for it to be gone rather than reading the first frame of the exit
  check('no JS: Escape closes it', await p.waitForSelector('#rates', { state: 'hidden', timeout: 2000 }).then(() => true, () => false));
  const focused = await p.evaluate(() => document.activeElement.getAttribute('popovertarget'));
  check('no JS: focus returns to the trigger', focused === 'rates');
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-popover')].every(e => e.dataset.skin));
  const tag = `${register}:`;

  await p.click('button[popovertarget="rates"]');
  await p.waitForTimeout(180);
  const open = await p.evaluate(() => document.querySelector('sg-popover').open);
  check(`${tag} the element's own "open" reflects the native panel`, open === true);
  const seen = await p.locator('#rates').isVisible();
  check(`${tag} the panel is really on screen`, seen);
  // AB1: the panel must sit against its trigger, not at whatever static
  // flow position a bare `position: fixed` falls back to.
  const rects = await p.evaluate(() => {
    const t = document.querySelector('button[popovertarget="rates"]').getBoundingClientRect();
    const panel = document.getElementById('rates').getBoundingClientRect();
    return { trigger: t, panel };
  });
  const gap = Math.abs(rects.panel.top - rects.trigger.bottom);
  check(`${tag} the panel's top edge sits within 8px of the trigger's bottom edge`, gap <= 8, `gap ${gap.toFixed(1)}px; trigger bottom ${rects.trigger.bottom.toFixed(0)}, panel top ${rects.panel.top.toFixed(0)}`);
  await p.keyboard.press('Escape');
  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── flips above near the bottom of the page ─────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready);
  // align the trigger's own bottom edge with the viewport's, so there is
  // genuinely no room below it (not just "somewhere further down the page")
  await p.evaluate(() => document.querySelector('button[popovertarget="low"]').scrollIntoView({ block: 'end' }));
  await p.click('button[popovertarget="low"]');
  await p.waitForTimeout(150);
  const rects = await p.evaluate(() => {
    const t = document.querySelector('button[popovertarget="low"]').getBoundingClientRect();
    const panel = document.getElementById('low').getBoundingClientRect();
    return { triggerTop: t.top, panelBottom: panel.bottom };
  });
  check('the panel opens above a trigger with no room below', rects.panelBottom <= rects.triggerTop + 4, JSON.stringify(rects));
  await ctx.close();
}

// ── forced colours ──────────────────────────────────────────────────────────
for (const register of ['warm', 'playful']) {
  const ctx = await browser.newContext({ forcedColors: 'active' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready);
  await p.click('button[popovertarget="rates"]');
  await p.waitForTimeout(100);
  const fc = await p.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('rates'), '::before');
    return { display: cs.display };
  });
  check(`${register}, forced colours: the postmark/fold is hidden`, fc.display === 'none', JSON.stringify(fc));
  await ctx.close();
}

// ── 1.4.10: at 390 px and at 320 px an open panel cannot be scrolled sideways, in every register ──
// The probe tries to scroll it: scrollLeft = 50 and read back. (scrollWidth alone would also count painted
// decoration that an `overflow: clip` panel shows but nobody can scroll to.)
for (const width of [390, 320]) for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready);
  const rows = [];
  for (const id of ['rates', 'kn-rates']) {
    await p.click(`button[popovertarget="${id}"]`);
    await p.waitForFunction(i => document.getElementById(i).matches(':popover-open'), id);
    rows.push(await p.evaluate(i => { const el = document.getElementById(i), r = el.getBoundingClientRect(); el.scrollLeft = 50; const moved = el.scrollLeft; el.scrollLeft = 0;
      return { id: i, moved, scrollW: el.scrollWidth, clientW: el.clientWidth, left: Math.round(r.left), right: Math.round(r.right), page: document.documentElement.scrollWidth }; }, id));
    await p.keyboard.press('Escape');
  }
  const bad = rows.filter(r => r.moved > 0 || r.left < 0 || r.right > width || r.page > width);
  check(`${register} at ${width} px: the open panels do not scroll sideways, inside the screen`, !bad.length, bad.map(r => `${r.id}: scrolled ${r.moved} px sideways (scrollWidth ${r.scrollW} vs clientWidth ${r.clientW}), box ${r.left}-${r.right}`).join('; ') || rows.map(r => `${r.id} scrolls ${r.moved} px`).join(', '));
  await ctx.close();
}

// ── a phone, a trigger at the right edge: the open panel stays inside the visual viewport ──
// Mobile Chromium widens innerWidth (and a fixed box's containing block with it) to fit overflowing content, so a
// placement measured against innerWidth lets the panel spill past the phone. Four phones: a clean page and one
// that something else has widened to 700 px, each with the browser's anchor positioning and with it switched off
// (the JS fallback, with the stylesheet's @supports block stripped too). The yardstick is the visual viewport, and tools/lib/overflow.mjs for the page.
for (const scenario of [
  { name: 'clean page', wide: false, anchors: true }, { name: 'widened page', wide: true, anchors: true },
  { name: 'clean page, JS fallback', wide: false, anchors: false }, { name: 'widened page, JS fallback', wide: true, anchors: false },
]) for (const register of ['quiet', 'playful']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  // a browser with no anchor positioning has neither the API nor the stylesheet's @supports block: strip both (the shim alone leaves the CSS anchoring under the JS placement, a state no browser is in)
  if (!scenario.anchors) await p.route('**/*.css', async route => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replaceAll('@supports (anchor-name: --a)', '@supports not (display: block)') }); });
  if (!scenario.anchors) await p.addInitScript(() => { const s = CSS.supports.bind(CSS); CSS.supports = (...a) => (String(a[0]).includes('anchor-name') ? false : s(...a)); });
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-popover')].every(e => e.dataset.skin));
  await p.evaluate(wide => {
    document.body.insertAdjacentHTML('beforeend', `<div id="edge-host" style="position:absolute;top:120px;right:0"><sg-popover><button type="button" popovertarget="edge" style="min-height:44px">View</button><div id="edge" popover><p>Quiet, warm or playful: the register is yours to choose, and it stays with you on every page.</p></div></sg-popover></div>`);
    if (wide) document.body.insertAdjacentHTML('beforeend', '<div style="width:700px;height:1px"></div>');
  }, scenario.wide);
  await p.waitForFunction(() => document.querySelector('#edge-host sg-popover')?.dataset.skin);
  const before = await sidewaysScroll(p, 390);
  await p.evaluate(() => document.querySelector('button[popovertarget="edge"]').click());
  await p.waitForFunction(() => document.getElementById('edge').matches(':popover-open'));
  await p.evaluate(() => Promise.all(document.getElementById('edge').getAnimations().map(a => a.finished.catch(() => {}))));
  const m = await p.evaluate(() => { const r = document.getElementById('edge').getBoundingClientRect(), v = window.visualViewport;
    const t = document.querySelector('button[popovertarget="edge"]').getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vl: v.offsetLeft, vr: v.offsetLeft + v.width, vt: v.offsetTop, vb: v.offsetTop + v.height, tTop: t.top, tBottom: t.bottom, inner: innerWidth, innerH: innerHeight }; });
  const after = await sidewaysScroll(p, 390);
  // on screen up and down too, and still against its trigger (a panel that drops off the top reads fine sideways)
  const apart = Math.min(Math.abs(m.top - m.tBottom), Math.abs(m.tTop - m.bottom));
  check(`${register}, phone, ${scenario.name}: it is on screen vertically and within 14 px of its trigger`, m.top >= m.vt - 0.5 && m.bottom <= m.vb + 0.5 && apart <= 14,
    `top ${m.top.toFixed(1)}, bottom ${m.bottom.toFixed(1)} in 0..${m.vb}; trigger ${m.tTop.toFixed(1)}..${m.tBottom.toFixed(1)}; apart ${apart.toFixed(1)} px, innerHeight ${m.innerH}`);
  const tag = `${register}, phone, ${scenario.name}:`;
  check(`${tag} a panel opened from the right edge stays inside the visual viewport`, m.left >= m.vl - 0.5 && m.right <= m.vr + 0.5,
    `panel ${m.left.toFixed(1)}..${m.right.toFixed(1)}, visual viewport ${m.vl}..${m.vr} (right-edge gap ${(m.vr - m.right).toFixed(1)} px), innerWidth ${m.inner}`);
  // a top-layer fixed panel never scrolls the page by itself, so on a popover or a menu this cell cannot go red; it stays as a guard that nothing else opening with it (a scrollbar, a lock) widens the page
  check(`${tag} opening it adds no sideways scroll to the page`, after.overflow <= before.overflow, `overflow ${before.overflow} px before, ${after.overflow} px after (scrollWidth ${after.scrollWidth}, view ${after.viewWidth})`);
  await ctx.close();
}

// ── the first painted frame is already fitted (reduced motion: no fade to hide an unfitted frame behind) ──
// Sampled with rAF from the click, on a page something else has widened to 700 px: before the fix frame 0 sat at the old place, 300 px past the screen.
for (const register of ['quiet', 'playful']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-popover')].every(e => e.dataset.skin));
  await p.evaluate(h => { document.body.insertAdjacentHTML('beforeend', h); document.body.insertAdjacentHTML('beforeend', '<div style="width:700px;height:1px"></div>'); }, `<div style="position:absolute;top:120px;right:0"><sg-popover><button type="button" popovertarget="edge" style="min-height:44px">View</button><div id="edge" popover><p>Quiet, warm or playful: the register is yours to choose, and it stays with you on every page.</p></div></sg-popover></div>`);
  await p.waitForFunction(() => document.getElementById('edge').closest('sg-popover')?.dataset.skin);
  const frames = await p.evaluate(() => new Promise(res => {
    const out = [], el = document.getElementById('edge'); let n = 0;
    const tick = () => { const r = el.getBoundingClientRect(); out.push({ open: el.matches(':popover-open'), left: r.left, right: r.right }); if (++n < 4) requestAnimationFrame(tick); else res(out); };
    document.querySelector('button[popovertarget="edge"]').click(); requestAnimationFrame(tick);
  }));
  const bad = frames.filter(f => f.open && (f.left < -0.5 || f.right > 390.5));
  check(`${register}, reduced motion, widened phone: no open frame is outside the screen, the first included`, frames[0].open && !bad.length,
    frames.map(f => `${f.open ? '' : 'closed '}${f.left.toFixed(1)}..${f.right.toFixed(1)}`).join(' | '));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
