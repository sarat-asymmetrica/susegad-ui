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

import { engineName, pickEngine, unsupportedIn } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const engine = engineName();
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
  // Which items does this engine put in the tab order? WebKit's default leaves links out (Safari reaches
  // them with Option+Tab, which Playwright's WebKit does not do), so ask the engine instead of assuming.
  const probe = await ctx.newPage(); // a page of its own: Tab moves the sequential-focus starting point, so it must not be this one
  await probe.setContent('<a href="#x">x</a><button>b</button>');
  await probe.keyboard.press('Tab');
  const tabsToLinks = await probe.evaluate(() => document.activeElement.localName === 'a');
  await probe.close();
  await p.keyboard.press('Tab');
  const firstFocused = await p.evaluate(() => document.activeElement.id);
  const expected = tabsToLinks ? 'mi-profile' : 'mi-signout'; // written out, not read from the page: a reordered list must read red
  if (!tabsToLinks) unsupportedIn(engine, 'Tab to a link', 'links are not tab stops in this engine by default, so Tab is asked for the first item it does stop at');
  check(`no JS: Tab reaches the first real item${tabsToLinks ? '' : ' this engine tabs to'} (${expected})`, firstFocused === expected, firstFocused);
  await ctx.close();
}

// control: the same walk on a copy whose list is out of order (Sign out first) must go red
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  await ctx.route('**/action-menu/demo.html', async r => {
    const res = await r.fetch();
    let html = await res.text();
    const out = html.match(/ *<li role="none"><button type="button" role="menuitem" id="mi-signout">Sign out<\/button><\/li>\r?\n?/)[0];
    html = html.replace(out, '').replace(/(<ul id="account-menu"[^>]*>\r?\n)/, `$1${out}`);
    await r.fulfill({ response: res, body: html });
  });
  const p = await ctx.newPage();
  await p.goto(demo);
  await p.click('#account-trigger');
  await p.keyboard.press('Tab');
  const first = await p.evaluate(() => document.activeElement.id);
  const order = await p.evaluate(() => [...document.querySelectorAll('#account-menu [role="menuitem"]')].map(e => e.id || e.textContent.trim()[0]).join());
  check(`control: with Sign out moved to the front of the list, the first item reached is mi-signout, not mi-profile (${order})`, first === 'mi-signout' && first !== 'mi-profile', first);
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
  const rects = await p.evaluate(async () => {
    // measure the settled box: playful's entry is a transition, and a rect read mid-way is a few px off under load
    await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})));
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
  // the next block reopens at once: wait for this close to really finish, or the ArrowDown can land mid-close. The popover stops
  // matching :popover-open a task before its toggle event reaches the component, and until then the component still believes it
  // is open (aria-expanded, data-open): an ArrowDown in that gap moves focus inside a closed menu and nothing opens
  await p.waitForFunction(() => !document.querySelector('#account-menu').matches(':popover-open') && document.querySelector('#account-trigger').getAttribute('aria-expanded') === 'false');

  // playful only: the stamped landing (S2, Rasika's Wave 5 review) — a
  // real impression per item, on the same teental beat as the entrance,
  // that never delays the roving focus action-menu.js already moved synchronously.
  if (register === 'playful') {
    await p.focus('#account-trigger');
    // "At once" is timed inside the page, from the key's keydown to the first item's focusin, so
    // the harness's own round trips can't count against the component (a 150 ms window polled
    // from Node failed about one run in three on a quiet machine). Not the same task as the key
    // press, since the popover's toggle handler moves focus, but far inside the stamp's bloom.
    await p.evaluate(() => {
      window.__atOnce = { down: null, focus: null };
      document.addEventListener('keydown', e => { if (e.key === 'ArrowDown' && window.__atOnce.down === null) window.__atOnce.down = performance.now(); }, { capture: true });
      document.addEventListener('focusin', e => { if (e.target.id === 'mi-profile' && window.__atOnce.focus === null) window.__atOnce.focus = performance.now(); });
    });
    await p.keyboard.press('ArrowDown');
    await p.waitForFunction(() => window.__atOnce.focus !== null, null, { timeout: 3000 }).catch(() => {});
    const atOnce = await p.evaluate(() => window.__atOnce);
    const lag = atOnce.down !== null && atOnce.focus !== null ? atOnce.focus - atOnce.down : null;
    check(`${tag} focus lands on the first item at once, before the stamp has even started blooming`, lag !== null && lag < 50, lag === null ? 'focus never reached mi-profile' : `${lag.toFixed(1)} ms from keydown to focus`);
    await p.waitForFunction(() => [...document.querySelectorAll('#account-menu .sg-action-menu-item-stamp')].every(s => s.getAnimations().every(a => a.playState !== 'running')), { timeout: 3000 });
    const stamps = await p.evaluate(() => [...document.querySelectorAll('#account-menu .sg-action-menu-item-stamp')].map(s => getComputedStyle(s).opacity));
    check(`${tag} every item's stamp blooms and fades fully, leaving no permanent mark`, stamps.length === 4 && stamps.every(o => o === '0'), JSON.stringify(stamps));
    await p.keyboard.press('Escape');
  }

  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── opened from the keyboard: Escape returns focus to the trigger, in every engine ──
// (WebKit does not focus a button on a mouse click, so the pointer path below differs there: docs/BROWSERS.md)
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready);
  await p.focus('#account-trigger');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.getElementById('account-trigger').closest('sg-action-menu').open);
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.getElementById('account-trigger').closest('sg-action-menu').open);
  const focused = await p.evaluate(() => document.activeElement.id);
  check('opened from the keyboard: Escape closes the menu and returns focus to the trigger', focused === 'account-trigger', focused);
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
  // WebKit does not focus a button on a mouse click, so there is no focus to return to; the keyboard-opened case above asks the same question there
  if (engine === 'webkit' && !open && focused === '') unsupportedIn(engine, 'focus return after a mouse open', 'a click does not focus the button in WebKit (docs/BROWSERS.md); see the keyboard-opened check');
  else check('Escape closes the menu and returns focus to the trigger', !open && focused === 'account-trigger', focused);
  await ctx.close();
}

// ── an ArrowDown in the same task as a close still opens the menu ───────────
// The popover stops matching :popover-open a task before its toggle event reaches the component. A key that lands in that gap used to
// be answered from the component's stale idea of itself (open), so focus moved inside a closed menu and nothing opened. Here the gap is
// made on purpose: hidePopover() and the key in one task, where the toggle event cannot have run yet.
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready);
  await p.focus('#account-trigger');
  await p.keyboard.press('ArrowDown');
  await p.waitForFunction(() => document.getElementById('account-trigger').closest('sg-action-menu').open);
  const sameTask = await p.evaluate(() => {
    const trigger = document.getElementById('account-trigger'), menu = document.getElementById('account-menu');
    menu.hidePopover();
    const closed = !menu.matches(':popover-open'), believesOpen = trigger.closest('sg-action-menu').open;
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    return { closed, believesOpen };
  });
  await p.waitForFunction(() => document.getElementById('account-menu').matches(':popover-open'), null, { timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(100);
  const after = await p.evaluate(() => ({ open: document.getElementById('account-menu').matches(':popover-open'), focus: document.activeElement.id }));
  check('control: the gap is real (closed by hidePopover(), the component still believes it is open)', sameTask.closed && sameTask.believesOpen, JSON.stringify(sameTask));
  check('ArrowDown in the same task as hidePopover() opens the menu again, focus on the first item', after.open && after.focus === 'mi-profile', JSON.stringify(after));
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

// ── a phone, a trigger at the right edge: the open list stays inside the visual viewport ──
// Mobile Chromium widens innerWidth (and a fixed box's containing block with it) to fit overflowing content, so a
// placement measured against innerWidth lets the list spill past the phone. Four phones: a clean page and one
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-action-menu')].every(e => e.dataset.skin));
  await p.evaluate(wide => {
    document.body.insertAdjacentHTML('beforeend', `<div id="edge-host" style="position:absolute;top:120px;right:0"><sg-action-menu><button type="button" popovertarget="edge" style="min-height:44px">View</button><ul id="edge" popover role="menu"><li role="none"><a href="#quiet" role="menuitem">Quiet</a></li><li role="none"><a href="#warm" role="menuitem">Warm, with a longer label</a></li><li role="none"><a href="#playful" role="menuitem">Playful</a></li></ul></sg-action-menu></div>`);
    if (wide) document.body.insertAdjacentHTML('beforeend', '<div style="width:700px;height:1px"></div>');
  }, scenario.wide);
  await p.waitForFunction(() => document.querySelector('#edge-host sg-action-menu')?.dataset.skin);
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
  check(`${tag} a list opened from the right edge stays inside the visual viewport`, m.left >= m.vl - 0.5 && m.right <= m.vr + 0.5,
    `list ${m.left.toFixed(1)}..${m.right.toFixed(1)}, visual viewport ${m.vl}..${m.vr} (right-edge gap ${(m.vr - m.right).toFixed(1)} px), innerWidth ${m.inner}`);
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-action-menu')].every(e => e.dataset.skin));
  await p.evaluate(h => { document.body.insertAdjacentHTML('beforeend', h); document.body.insertAdjacentHTML('beforeend', '<div style="width:700px;height:1px"></div>'); }, `<div style="position:absolute;top:120px;right:0"><sg-action-menu><button type="button" popovertarget="edge" style="min-height:44px">View</button><ul id="edge" popover role="menu"><li role="none"><a href="#a" role="menuitem">Quiet</a></li><li role="none"><a href="#b" role="menuitem">Warm, with a longer label</a></li></ul></sg-action-menu></div>`);
  await p.waitForFunction(() => document.getElementById('edge').closest('sg-action-menu')?.dataset.skin);
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
