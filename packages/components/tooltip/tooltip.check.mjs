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

import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/tooltip/demo.html`;

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(demo);
  const defined = await p.evaluate(() => typeof customElements.get('sg-tooltip'));
  check('no JS: the element is never defined', defined === 'undefined');
  const described = await p.evaluate(() => document.getElementById('cancel-btn').getAttribute('aria-describedby'));
  check('no JS: the trigger already names the tooltip text as its description', described === 'cancel-note', described);
  const before = await p.evaluate(() => getComputedStyle(document.getElementById('cancel-note')).opacity);
  await p.hover('#cancel-btn');
  await p.waitForTimeout(220); // the opacity transition
  const during = await p.evaluate(() => getComputedStyle(document.getElementById('cancel-note')).opacity);
  check('no JS: hovering the trigger reveals the panel by opacity', before === '0' && during === '1', `${before} -> ${during}`);
  const snap = await p.locator('#cancel-btn').ariaSnapshot();
  check('no JS: the button carries the description in its accessible tree', /button "Free cancellation"/.test(snap), snap.trim());
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
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-tooltip')].every(e => e.dataset.skin));
  const tag = `${register}:`;

  const isOpen = id => p.evaluate(s => document.getElementById(s).closest('sg-tooltip').open, id);
  await p.hover('#cancel-btn');
  await p.waitForTimeout(120);
  check(`${tag} hovering does not open it before the show delay`, !(await isOpen('cancel-btn')));
  await p.waitForTimeout(280);
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

  await p.focus('#rate-btn');
  // focus queues the show with a zero delay: wait for the state, not for the clock
  const openOnFocus = await p.waitForFunction(() => document.getElementById('rate-btn').closest('sg-tooltip').open, null, { timeout: 500 }).then(() => true, () => false);
  check(`${tag} focus opens it instantly, no delay`, openOnFocus);
  await p.keyboard.press('Escape');
  check(`${tag} Escape closes it`, !(await isOpen('rate-btn')));
  await p.evaluate(() => document.activeElement.blur());

  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── flips below a trigger with no room above ────────────────────────────────
{
  const ctx = await browser.newContext();
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 800 } });
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
  const ctx = await browser.newContext({ forcedColors: 'active' });
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
