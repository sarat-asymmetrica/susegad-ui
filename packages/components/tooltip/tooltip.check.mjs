// Browser checks for <sg-tooltip>: the no-JS path first, then every register.
//
//   node packages/components/tooltip/tooltip.check.mjs
//
// No JavaScript: aria-describedby links the trigger to the text always; CSS
// alone reveals the panel on hover and on focus, by opacity, never display.
// With JavaScript, in quiet, warm and playful: the panel becomes a popover,
// shown after a delay on hover and instantly on focus, hidden on blur and on
// Escape, and it flips below a trigger with no room above; forced colours
// give it a real border.

import { harness } from '../../../tools/lib/component-check.mjs';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';

const h = await harness({ axe: "tools/smoke.mjs axes /packages/components/tooltip/demo.html once, at 1280 px in the default register and light theme; the other registers, the dark theme and the states this check opens are not axe-checked (docs/DEBT.md row 48)" });
const { server, browser, check } = h;
const demo = `${server.url}/packages/components/tooltip/demo.html`;

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await h.context({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(demo);
  const defined = await p.evaluate(() => typeof customElements.get('sg-tooltip'));
  check('no JS: the element is never defined', defined === 'undefined');
  const described = await p.evaluate(() => document.getElementById('cancel-btn').getAttribute('aria-describedby'));
  check('no JS: the trigger already names the tooltip text as its description', described === 'cancel-note', described);
  const before = await p.evaluate(() => getComputedStyle(document.getElementById('cancel-note')).opacity);
  await p.hover('#cancel-btn');
  // wait on the state, not the clock: the opacity transition is 140 ms on a quiet machine and longer on a busy one (seen 0.999959 after 220 ms in WebKit)
  await p.waitForFunction(() => +getComputedStyle(document.getElementById('cancel-note')).opacity > 0.999, null, { timeout: 3000 }).catch(() => {});
  const during = await p.evaluate(() => String(Math.round(+getComputedStyle(document.getElementById('cancel-note')).opacity * 1000) / 1000));
  check('no JS: hovering the trigger reveals the panel by opacity', before === '0' && during === '1', `${before} -> ${during}`);
  const snap = await p.locator('#cancel-btn').ariaSnapshot();
  check('no JS: the button carries the description in its accessible tree', /button "Free cancellation"/.test(snap), snap.trim());
  await ctx.close();
}

// ── with JavaScript, every register ─────────────────────────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await h.context();
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-tooltip')].every(e => e.dataset.skin));
  const tag = `${register}:`;

  const isOpen = id => p.evaluate(s => document.getElementById(s).closest('sg-tooltip').open, id);
  // stamp the pointer's arrival and the opening inside the page: on a busy machine hover() itself can take longer than the 320 ms
  // show delay to return, so a wait of 120 ms after it measures nothing
  await p.evaluate(() => {
    const tt = document.getElementById('cancel-btn').closest('sg-tooltip');
    document.getElementById('cancel-btn').addEventListener('pointerenter', () => { window.__enter = performance.now(); }, { once: true });
    new MutationObserver(() => { if (tt.hasAttribute('data-open') && !window.__opened) window.__opened = performance.now(); }).observe(tt, { attributes: true, attributeFilter: ['data-open'] });
  });
  await p.hover('#cancel-btn');
  // wait on the state: the show delay is a timer, and a busy machine runs it late
  await p.waitForFunction(() => document.getElementById('cancel-btn').closest('sg-tooltip').open, null, { timeout: 3000 }).catch(() => {});
  const delay = await p.evaluate(() => window.__opened - window.__enter);
  check(`${tag} hovering does not open it before the show delay`, delay >= 300, `opened ${delay.toFixed(0)} ms after the pointer arrived (delay 320)`);
  check(`${tag} it opens after the show delay`, await isOpen('cancel-btn'));
  // wait on the state, not the clock: the fade is a CSS transition that may not have started on a busy machine
  await p.evaluate(() => Promise.all(document.getElementById('cancel-note').getAnimations().map(a => a.finished.catch(() => {}))));
  const info = await p.evaluate(() => {
    const el = document.getElementById('cancel-note');
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, opacity: getComputedStyle(el).opacity, popoverOpen: el.matches(':popover-open') };
  });
  const onScreen = info.w > 0 && info.h > 0 && +info.opacity >= 0.95; // the fade may still be a frame from settling
  check(`${tag} the panel is really visible on screen`, onScreen, JSON.stringify(info));
  await p.mouse.move(0, 0);
  await p.waitForFunction(() => !document.getElementById('cancel-btn').closest('sg-tooltip').open, null, { timeout: 3000 }).catch(() => {}); // the hide delay is 300 ms: wait on the state
  check(`${tag} leaving the trigger closes it`, !(await isOpen('cancel-btn')));

  // timed inside the page, from the focus event to the open state: polling from Node on a busy machine measures the machine, not the tooltip
  // (a 500 ms poll missed once in WebKit). 50 ms is the budget; a tooltip that waits its 320 ms show delay, or even 100 ms, reads red.
  await p.evaluate(() => {
    const tt = document.getElementById('rate-btn').closest('sg-tooltip'); window.__f = 0; window.__o = 0;
    document.getElementById('rate-btn').addEventListener('focus', () => { window.__f = performance.now(); }, { once: true });
    new MutationObserver(() => { if (tt.hasAttribute('data-open') && !window.__o) window.__o = performance.now(); }).observe(tt, { attributes: true, attributeFilter: ['data-open'] });
  });
  await p.focus('#rate-btn');
  await p.waitForFunction(() => document.getElementById('rate-btn').closest('sg-tooltip').open, null, { timeout: 3000 }).catch(() => {});
  const focusDelay = await p.evaluate(() => (window.__o || NaN) - window.__f);
  check(`${tag} focus opens it instantly, no delay`, focusDelay < 50, `open ${focusDelay.toFixed(1)} ms after the focus event (budget 50)`);
  await p.keyboard.press('Escape');
  check(`${tag} Escape closes it`, !(await isOpen('rate-btn')));
  await p.evaluate(() => document.activeElement.blur());

  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── flips below a trigger with no room above ────────────────────────────────
{
  const ctx = await h.context();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.focus('#top-btn');
  await p.waitForTimeout(80);
  const rects = await p.evaluate(() => {
    const t = document.getElementById('top-btn').getBoundingClientRect();
    const panel = document.getElementById('top-note').getBoundingClientRect();
    return { triggerBottom: t.bottom, panelTop: panel.top };
  });
  check('the panel opens below a trigger with no room above', rects.panelTop >= rects.triggerBottom - 2, JSON.stringify(rects));
  await ctx.close();
}

// ── 1.4.13 hoverable, the gap: the point midway between trigger and panel belongs to the tooltip, and the pointer can rest there ──
for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await h.context({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-tooltip')].every(e => e.dataset.skin));
  await p.hover('#cancel-btn');
  await p.waitForFunction(() => document.getElementById('cancel-btn').closest('sg-tooltip').open);
  await p.evaluate(() => Promise.all(document.getElementById('cancel-note').getAnimations().map(a => a.finished.catch(() => {}))));
  await p.waitForFunction(() => { const t = document.getElementById('cancel-btn').closest('sg-tooltip'); return t.hasAttribute('data-above') || document.getElementById('cancel-note').getBoundingClientRect().top > document.getElementById('cancel-btn').getBoundingClientRect().bottom; });
  const g = await p.evaluate(() => {
    const t = document.getElementById('cancel-btn').getBoundingClientRect(), n = document.getElementById('cancel-note').getBoundingClientRect();
    const above = n.bottom <= t.top + 1, gap = above ? t.top - n.bottom : n.top - t.bottom;
    const y = above ? n.bottom + gap / 2 : t.bottom + gap / 2, x = t.left + t.width / 2;
    const el = document.elementFromPoint(x, y);
    return { x, y, gap: Math.round(gap * 10) / 10, owner: el ? (el.closest('#cancel-note') ? 'panel' : el.closest('sg-tooltip') === document.getElementById('cancel-btn').closest('sg-tooltip') ? 'tooltip' : el.localName) : 'nothing' };
  });
  check(`${register}: the point midway across the ${g.gap} px gap belongs to the tooltip (the panel or its bridge), not the page`, g.gap > 0 && (g.owner === 'panel' || g.owner === 'tooltip'), JSON.stringify(g));
  const t = await p.locator('#cancel-btn').boundingBox();
  await p.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await p.mouse.move(g.x, g.y, { steps: 6 });
  await p.waitForTimeout(450);
  check(`${register}: the pointer rests in the gap for 450 ms (longer than the 300 ms hide delay) and the tooltip is still open`, await p.evaluate(() => document.getElementById('cancel-btn').closest('sg-tooltip').open));
  // a neighbour button one gap below the trigger still gets its click (the bands stop where the gap stops); it comes before the tooltip in the document, so the bands, which come later, paint over it if they overlap
  await p.mouse.move(5, 5);
  await p.waitForFunction(() => !document.getElementById('cancel-btn').closest('sg-tooltip').open);
  await p.evaluate(() => { const t = document.getElementById('cancel-btn').getBoundingClientRect(); const b = document.createElement('button'); b.id = 'neighbour'; b.textContent = 'neighbour'; b.style.cssText = `position:absolute;left:${t.left + scrollX}px;top:${t.bottom + scrollY + 8}px;width:${t.width}px;height:40px`; window.__n = 0; b.addEventListener('click', () => { window.__n++; }); document.getElementById('cancel-btn').closest('sg-tooltip').before(b); });
  await p.hover('#cancel-btn');
  await p.waitForFunction(() => document.getElementById('cancel-btn').closest('sg-tooltip').open);
  const nb = await p.locator('#neighbour').boundingBox();
  await p.mouse.click(nb.x + nb.width / 2, nb.y + 1);
  check(`${register}: with the tooltip open, a click 1 px inside a button one gap below the trigger lands on that button`, await p.evaluate(() => window.__n) === 1, `${await p.evaluate(() => window.__n)} clicks`);
  await ctx.close();
}

// ── touch: a real tap reveals it, it stays while read, a tap elsewhere or a second tap closes it, and the button still acts ──
{
  const ctx = await h.context({ hasTouch: true, viewport: { width: 390, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-tooltip')].every(e => e.dataset.skin));
  await p.evaluate(() => { window.__clicks = 0; window.__opens = 0; const b = document.getElementById('cancel-btn'); b.addEventListener('click', () => { window.__clicks++; }); new MutationObserver(() => { if (b.closest('sg-tooltip').hasAttribute('data-open')) window.__opens++; }).observe(b.closest('sg-tooltip'), { attributes: true, attributeFilter: ['data-open'] }); });
  const isOpen = () => p.evaluate(() => document.getElementById('cancel-btn').closest('sg-tooltip').open);
  await p.locator('#cancel-btn').tap();
  await p.waitForTimeout(100);
  check('touch: a tap on the trigger shows the tooltip', await isOpen());
  await p.waitForTimeout(1200);
  check('touch: it stays open while the reader reads', await isOpen());
  check('touch: the tap still pressed the button (its own click fired once)', await p.evaluate(() => window.__clicks) === 1, `${await p.evaluate(() => window.__clicks)} clicks`);
  check('touch: it opened once, with no flicker (focus and pointerup together)', await p.evaluate(() => window.__opens) === 1, `${await p.evaluate(() => window.__opens)} opens`);
  await p.locator('#cancel-btn').tap();
  await p.waitForTimeout(250);
  check('touch: a second tap on the trigger closes it', !(await isOpen()));
  await p.locator('#cancel-btn').tap();
  await p.waitForTimeout(100);
  const reopened = await isOpen();
  await p.touchscreen.tap(20, 20);
  await p.waitForTimeout(250);
  check('touch: a tap elsewhere closes it (control: it was open first)', reopened && !(await isOpen()));
  await ctx.close();
}


// ── forced colours ──────────────────────────────────────────────────────────
{
  const ctx = await h.context({ forcedColors: 'active' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=playful`);
  await p.waitForFunction(() => window.__ready);
  await p.focus('#cancel-btn');
  await p.waitForTimeout(60);
  const fc = await p.evaluate(() => {
    const panel = document.getElementById('cancel-note');
    return { border: getComputedStyle(panel).borderStyle, leader: getComputedStyle(panel, '::after').display };
  });
  check('forced colours: a real border, the leader line hidden', fc.border === 'solid' && fc.leader === 'none', JSON.stringify(fc));
  await ctx.close();
}

// ── 1.4.13: the panel is hoverable: the pointer can travel from the trigger onto it and it stays ──
for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await h.context({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-tooltip')].every(e => e.dataset.skin));
  const isOpen = () => p.evaluate(() => document.getElementById('cancel-btn').closest('sg-tooltip').open);
  await p.hover('#cancel-btn');
  await p.waitForFunction(() => document.getElementById('cancel-btn').closest('sg-tooltip').open);
  await p.evaluate(() => Promise.all(document.getElementById('cancel-note').getAnimations().map(a => a.finished.catch(() => {}))));
  const onTrigger = await isOpen();
  const t = await p.locator('#cancel-btn').boundingBox(), n = await p.locator('#cancel-note').boundingBox();
  // travel in 12 steps from the trigger's centre to the panel's centre, then rest there
  await p.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await p.mouse.move(n.x + n.width / 2, n.y + n.height / 2, { steps: 12 });
  await p.waitForTimeout(700);
  const r = await p.evaluate(([x, y]) => ({ open: document.getElementById('cancel-btn').closest('sg-tooltip').open, onPanel: !!document.elementFromPoint(x, y)?.closest('#cancel-note') }), [n.x + n.width / 2, n.y + n.height / 2]);
  check(`${register}: moving the pointer onto the panel keeps it open and the panel is under the pointer (control: it was open on the trigger: ${onTrigger})`, onTrigger && r.open && r.onPanel, JSON.stringify(r));
  await p.mouse.move(5, 5);
  await p.waitForTimeout(700);
  check(`${register}: leaving the panel closes it`, !(await isOpen()));
  await ctx.close();
}

// ── 1.4.13 dismissible: Escape closes it with the pointer alone (no focus on the trigger), and with the pointer on the panel ──
for (const register of ['quiet', 'warm', 'playful']) for (const where of ['trigger', 'panel']) {
  const ctx = await h.context({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-tooltip')].every(e => e.dataset.skin));
  await p.hover('#cancel-btn');
  await p.waitForFunction(() => document.getElementById('cancel-btn').closest('sg-tooltip').open);
  await p.evaluate(() => Promise.all(document.getElementById('cancel-note').getAnimations().map(a => a.finished.catch(() => {}))));
  if (where === 'panel') { const n = await p.locator('#cancel-note').boundingBox(); await p.mouse.move(n.x + n.width / 2, n.y + n.height / 2, { steps: 8 }); await p.waitForTimeout(300); }
  const before = await p.evaluate(() => ({ open: document.getElementById('cancel-btn').closest('sg-tooltip').open, focus: document.activeElement === document.getElementById('cancel-btn') }));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(250);
  const after = await p.evaluate(() => ({ open: document.getElementById('cancel-btn').closest('sg-tooltip').open, body: document.activeElement === document.body }));
  check(`${register}: pointer on the ${where}, no focus: Escape closes it and focus does not move (control: it was open, trigger unfocused)`, before.open && !before.focus && !after.open && after.body, JSON.stringify({ before, after }));
  await ctx.close();
}

// ── a phone, a trigger at the right edge: the open tooltip stays inside the visual viewport ──
// Mobile Chromium widens innerWidth (and a fixed box's containing block with it) to fit overflowing content, so a
// placement measured against innerWidth lets the tooltip spill past the phone. Four phones: a clean page and one
// that something else has widened to 700 px, each with the browser's anchor positioning and with it switched off
// (the JS fallback, with the stylesheet's @supports block stripped too). The yardstick is the visual viewport, and tools/lib/overflow.mjs for the page.
for (const scenario of [
  { name: 'clean page', wide: false, anchors: true }, { name: 'widened page', wide: true, anchors: true },
  { name: 'clean page, JS fallback', wide: false, anchors: false }, { name: 'widened page, JS fallback', wide: true, anchors: false },
]) for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await h.context({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  // a browser with no anchor positioning has neither the API nor the stylesheet's @supports block: strip both (the shim alone leaves the CSS anchoring under the JS placement, a state no browser is in)
  if (!scenario.anchors) await p.route('**/*.css', async route => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replaceAll('@supports (anchor-name: --a)', '@supports not (display: block)') }); });
  if (!scenario.anchors) await p.addInitScript(() => { const s = CSS.supports.bind(CSS); CSS.supports = (...a) => (String(a[0]).includes('anchor-name') ? false : s(...a)); });
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-tooltip')].every(e => e.dataset.skin));
  await p.evaluate(wide => {
    document.body.insertAdjacentHTML('beforeend', `<div id="edge-host" style="position:absolute;top:60px;right:0"><sg-tooltip><button type="button" id="edge-btn" aria-describedby="edge" style="min-height:44px">View</button><span id="edge" role="tooltip">The register is yours to choose, and it stays with you on every page of the site.</span></sg-tooltip></div>`);
    if (wide) document.body.insertAdjacentHTML('beforeend', '<div style="width:700px;height:1px"></div>');
  }, scenario.wide);
  await p.waitForFunction(() => document.querySelector('#edge-host sg-tooltip')?.dataset.skin);
  const before = await sidewaysScroll(p, 390);
  await p.evaluate(() => document.getElementById('edge-btn').focus());
  await p.waitForFunction(() => document.querySelector('#edge-host sg-tooltip').open);
  await p.evaluate(() => Promise.all(document.getElementById('edge').getAnimations().map(a => a.finished.catch(() => {}))));
  const m = await p.evaluate(() => { const r = document.getElementById('edge').getBoundingClientRect(), v = window.visualViewport;
    const t = document.querySelector('#edge-btn').getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vl: v.offsetLeft, vr: v.offsetLeft + v.width, vt: v.offsetTop, vb: v.offsetTop + v.height, tTop: t.top, tBottom: t.bottom, inner: innerWidth, innerH: innerHeight }; });
  const after = await sidewaysScroll(p, 390);
  // on screen up and down too, and still against its trigger (a panel that drops off the top reads fine sideways)
  const apart = Math.min(Math.abs(m.top - m.tBottom), Math.abs(m.tTop - m.bottom));
  check(`${register}, phone, ${scenario.name}: it is on screen vertically and within 14 px of its trigger`, m.top >= m.vt - 0.5 && m.bottom <= m.vb + 0.5 && apart <= 14,
    `top ${m.top.toFixed(1)}, bottom ${m.bottom.toFixed(1)} in 0..${m.vb}; trigger ${m.tTop.toFixed(1)}..${m.tBottom.toFixed(1)}; apart ${apart.toFixed(1)} px, innerHeight ${m.innerH}`);
  const tag = `${register}, phone, ${scenario.name}:`;
  check(`${tag} a tooltip opened from the right edge stays inside the visual viewport`, m.left >= m.vl - 0.5 && m.right <= m.vr + 0.5,
    `tooltip ${m.left.toFixed(1)}..${m.right.toFixed(1)}, visual viewport ${m.vl}..${m.vr} (right-edge gap ${(m.vr - m.right).toFixed(1)} px), innerWidth ${m.inner}`);
  // this one can fail: the hover bridge on the element itself (not the top-layer panel) once added 24 px of sideways scroll
  check(`${tag} opening it adds no sideways scroll to the page`, after.overflow <= before.overflow, `overflow ${before.overflow} px before, ${after.overflow} px after (scrollWidth ${after.scrollWidth}, view ${after.viewWidth})`);
  await ctx.close();
}

// ── 1.4.10: a tooltip wider than the screen is capped to it (warm's hand-lettered panel at 22em is 352 px, a 320 px phone is not) ──
for (const width of [320, 390]) for (const register of ['warm', 'quiet']) for (const anchored of [true, false]) {
  const ctx = await h.context({ viewport: { width, height: 700 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  if (!anchored) await p.route('**/*.css', async route => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replaceAll('@supports (anchor-name: --a)', '@supports not (display: block)') }); });
  if (!anchored) await p.addInitScript(() => { const s = CSS.supports.bind(CSS); CSS.supports = (...a) => (String(a[0]).includes('anchor-name') ? false : s(...a)); });
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-tooltip')].every(e => e.dataset.skin));
  await p.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<div style="position:absolute;top:140px;left:60px"><sg-tooltip><button type="button" id="long-btn" aria-describedby="long" style="min-height:44px">Dates</button><span id="long" role="tooltip">Free cancellation up to 48 hours before arrival, then one night is charged; the rest is refunded within a week.</span></sg-tooltip></div>');
  });
  await p.waitForFunction(() => document.getElementById('long').closest('sg-tooltip').dataset.skin);
  await p.evaluate(() => document.getElementById('long-btn').focus());
  await p.waitForFunction(() => document.getElementById('long').closest('sg-tooltip').open);
  await p.evaluate(() => Promise.all(document.getElementById('long').getAnimations().map(a => a.finished.catch(() => {}))));
  const m = await p.evaluate(() => { const r = document.getElementById('long').getBoundingClientRect(), v = visualViewport; return { left: r.left, right: r.right, width: r.width, vr: v.offsetLeft + v.width }; });
  check(`${register} at ${width} px, ${anchored ? 'anchored' : 'JS fallback'}: a long tooltip is no wider than the screen and sits inside it`, m.left >= -0.5 && m.right <= m.vr + 0.5,
    `panel ${m.left.toFixed(1)}..${m.right.toFixed(1)} (${m.width.toFixed(1)} wide) in 0..${m.vr}`);
  await ctx.close();
}

// ── a hand-flipped tooltip stays with its trigger when the page scrolls (it is below the trigger because the top edge cut it) ──
for (const anchored of [true, false]) {
  const ctx = await h.context({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  if (!anchored) await p.route('**/*.css', async route => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replaceAll('@supports (anchor-name: --a)', '@supports not (display: block)') }); });
  if (!anchored) await p.addInitScript(() => { const s = CSS.supports.bind(CSS); CSS.supports = (...a) => (String(a[0]).includes('anchor-name') ? false : s(...a)); });
  await p.goto(`${demo}?register=warm`);
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-tooltip')].every(e => e.dataset.skin));
  await p.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div style="position:absolute;top:40px;right:0"><sg-tooltip><button type="button" id="edge-btn" aria-describedby="edge" style="min-height:44px">View</button><span id="edge" role="tooltip">The register is yours to choose, and it stays with you on every page of the site.</span></sg-tooltip></div>'));
  await p.waitForFunction(() => document.getElementById('edge').closest('sg-tooltip').dataset.skin);
  await p.evaluate(() => document.getElementById('edge-btn').focus());
  await p.waitForFunction(() => document.getElementById('edge').closest('sg-tooltip').open);
  await p.evaluate(() => Promise.all(document.getElementById('edge').getAnimations().map(a => a.finished.catch(() => {}))));
  const geo = () => p.evaluate(() => { const r = document.getElementById('edge').getBoundingClientRect(), t = document.getElementById('edge-btn').getBoundingClientRect(); return { open: document.getElementById('edge').closest('sg-tooltip').open, top: r.top, bottom: r.bottom, tTop: t.top, tBottom: t.bottom }; });
  const rest = await geo();
  await p.evaluate(() => window.scrollBy(0, 120));
  await p.waitForTimeout(150); // a scroll listener runs on the next frame
  const g = await geo();
  const apart = Math.min(Math.abs(g.top - g.tBottom), Math.abs(g.tTop - g.bottom));
  check(`warm, phone, ${anchored ? 'anchored' : 'JS fallback'}: a tooltip flipped below its trigger stays within 14 px of it after the page scrolls 120 px`, rest.top > rest.tBottom - 1 && (!g.open || apart <= 14),
    `before: panel ${rest.top.toFixed(1)}..${rest.bottom.toFixed(1)}, trigger ${rest.tTop.toFixed(1)}..${rest.tBottom.toFixed(1)}; after scroll: panel ${g.top.toFixed(1)}..${g.bottom.toFixed(1)}, trigger ${g.tTop.toFixed(1)}..${g.tBottom.toFixed(1)}, apart ${apart.toFixed(1)} px`);
  await ctx.close();
}

await h.done();
