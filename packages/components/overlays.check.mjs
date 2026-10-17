// Browser checks for the overlays' native sweep (rung 2 of the October run):
// popover, tooltip, action-menu, dialog, drawer and toast.
//
//   node packages/components/overlays.check.mjs          (SG_ENGINE=firefox|webkit for the others)
//
//   - anchor positioning: the panel sits against its trigger with no script
//     at all, and with the script it places by CSS (no inline offsets), the
//     JS placement staying only as the fallback (forced here by hiding
//     anchor-name support from the component);
//   - invoker commands: <button commandfor command="show-modal"> opens a
//     dialog and a drawer with the component script blocked, the skin and
//     the events still run when the script is there, and the click handler
//     covers a browser without commandForElement;
//   - @starting-style entries: the first frame of an open is a CSS
//     transition (opacity below 1 in quiet, warm and playful), and is the
//     target itself under reduced motion;
//   - the tala stagger is the stylesheet's (sibling-index()), and equals
//     talaDelay() beat for beat, khali included;
//   - the touch contract: a press state per register, answering at once, no
//     movement for the keyboard or reduced motion.
//
// Each of these was run against the code before the sweep and failed first.

import { pickEngine, engineName, keyHeldActivates, unsupportedIn } from '../../tools/lib/engine.mjs';
import { startServer } from '../../tools/serve.mjs';
import { talaDelay } from '../tokens/tokens.js';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const engine = engineName();
let kbNoted = false;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const url = path => `${server.url}${path}`;
const REGISTERS = ['quiet', 'warm', 'playful'];

const ITEMS = Array.from({ length: 14 }, (_, i) => `<li role="none"><button type="button" role="menuitem" id="mi${i}">Item ${i + 1}</button></li>`).join('');
const BODY = `
<style>#pt, #tt, #mt { font: inherit; padding: 0.5em 1em; border: 1px solid #888; border-radius: 6px; background: #f4f0e8; color: #222; }</style>
<main style="padding: 120px 40px 40px">
  <sg-popover><button type="button" popovertarget="p1" id="pt">Trigger</button><div id="p1" popover><p>The panel.</p></div></sg-popover>
  <sg-tooltip><button aria-describedby="t1" id="tt">Tip</button><span id="t1" role="tooltip">Some words.</span></sg-tooltip>
  <sg-action-menu><button type="button" popovertarget="m1" id="mt">Menu</button><ul id="m1" popover role="menu">${ITEMS}</ul></sg-action-menu>
  <sg-dialog id="dlg"><dialog id="d1"><h2>Dialog</h2><p>Words.</p><form method="dialog"><menu><button type="submit" value="dismiss" id="d-cancel">Cancel</button><button type="submit" value="ok" id="d-ok">Okay</button></menu></form></dialog></sg-dialog>
  <sg-drawer id="drw" edge="end"><dialog id="r1"><h2>Drawer</h2><p>Words.</p><form method="dialog"><button type="submit" value="dismiss" id="r-close">Close</button></form></dialog></sg-drawer>
  <sg-toast-region id="reg"></sg-toast-region>
</main>`;

/** A blank page with all six components and plain triggers, in `register`. */
async function fixture({ register = 'warm', reduced = false, noAnchors = false, noInvoker = false, viewport } = {}) {
  const ctx = await browser.newContext({ reducedMotion: reduced ? 'reduce' : 'no-preference', ...(viewport ? { viewport } : {}) });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // the emulated browser has no position-try either, and the page's own CSS would flip a hand-placed panel
  if (noAnchors) await p.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => document.head.insertAdjacentHTML('beforeend', '<style>[popover] { position-try-fallbacks: none !important }</style>')); });
  if (noAnchors) await p.addInitScript(() => {
    const real = CSS.supports.bind(CSS);
    CSS.supports = (...a) => (String(a[0]).includes('anchor-name') ? false : real(...a));
  });
  if (noInvoker) await p.addInitScript(() => { delete HTMLButtonElement.prototype.commandForElement; });
  await p.goto(url('/tools/harness/blank.html'));
  await p.evaluate(async ({ body, register }) => {
    document.documentElement.setAttribute('data-register', register);
    const css = ['/packages/tokens/tokens.css', ...['popover', 'tooltip', 'action-menu', 'dialog', 'drawer', 'toast'].map(c => `/packages/components/${c}/${c}.css`)];
    await Promise.all(css.map(href => new Promise(res => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = l.onerror = res; document.head.append(l);
    })));
    document.body.innerHTML = body;
    await import('/packages/core/index.js');
    for (const c of ['popover', 'tooltip', 'action-menu', 'dialog', 'drawer', 'toast']) await import(`/packages/components/${c}/${c}.js`);
    await Promise.all(['sg-popover', 'sg-tooltip', 'sg-action-menu', 'sg-dialog', 'sg-drawer', 'sg-toast-region'].map(t => customElements.whenDefined(t)));
    await new Promise(res => { const t = setInterval(() => { if ([...document.querySelectorAll('sg-popover, sg-tooltip, sg-action-menu, sg-dialog, sg-drawer')].every(e => e.dataset.skin)) { clearInterval(t); res(); } }, 20); });
  }, { body: BODY, register });
  return { ctx, p, errors };
}

const settle = p => p.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));

// ── anchor positioning, with no script ──────────────────────────────────────
{
  const anchored = await (async () => { const c = await browser.newContext(); const p = await c.newPage(); const r = await p.evaluate(() => CSS.supports('anchor-name: --a')); await c.close(); return r; })();
  for (const [name, trigger, panel, demo] of [['popover', 'button[popovertarget="rates"]', '#rates', '/packages/components/popover/demo.html'], ['action-menu', '#account-trigger', '#account-menu', '/packages/components/action-menu/demo.html']]) {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const p = await ctx.newPage();
    await p.goto(url(demo));
    await p.click(trigger);
    await p.waitForTimeout(250);
    const r = await p.evaluate(({ trigger, panel }) => {
      const t = document.querySelector(trigger).getBoundingClientRect(), b = document.querySelector(panel).getBoundingClientRect();
      return { gap: b.top - t.bottom, dx: b.left - t.left };
    }, { trigger, panel });
    if (anchored) check(`${name}: with no script the panel is placed by anchor, against its trigger`, Math.abs(r.gap) <= 12 && Math.abs(r.dx) <= 12, `gap ${r.gap.toFixed(1)}px, left offset ${r.dx.toFixed(1)}px`);
    await ctx.close();
  }
}

// ── anchor positioning with the script: CSS places it, JS is the fallback ───
for (const register of REGISTERS) {
  const { ctx, p, errors } = await fixture({ register });
  const tag = `${register}:`;
  const anchored = await p.evaluate(() => CSS.supports('anchor-name: --a'));
  for (const [name, trigger, panel] of [['popover', '#pt', '#p1'], ['tooltip', '#tt', '#t1'], ['action-menu', '#mt', '#m1']]) {
    // a short menu here: the long one has its own case below
    if (name === 'action-menu') await p.evaluate(() => document.querySelectorAll('#m1 li:nth-child(n+5)').forEach(li => { li.hidden = true; }));
    if (name === 'tooltip') await p.focus(trigger); else await p.click(trigger);
    await p.waitForTimeout(260);
    const r = await p.evaluate(({ trigger, panel }) => {
      const t = document.querySelector(trigger).getBoundingClientRect(), el = document.querySelector(panel), b = el.getBoundingClientRect();
      return { gap: Math.min(Math.abs(b.top - t.bottom), Math.abs(t.top - b.bottom)), inline: ['left', 'top', 'bottom'].map(k => el.style[k]).join('|'), name: document.querySelector(trigger).style.getPropertyValue('anchor-name'), pos: el.style.getPropertyValue('position-anchor') };
    }, { trigger, panel });
    check(`${tag} ${name}: the panel sits within 14px of its trigger (above or below)`, r.gap >= 0 && r.gap <= 14, `gap ${r.gap.toFixed(1)}px`);
    if (anchored) {
      check(`${tag} ${name}: placed by CSS anchor, no inline left/top/bottom`, r.inline === '||' && !!r.name && r.name === r.pos, `inline "${r.inline}", anchor-name "${r.name}", position-anchor "${r.pos}"`);
      if (register === 'warm') {
        // it keeps its place while the page scrolls under it, with no scroll listener to do it
        await p.evaluate(() => window.scrollBy(0, 30));
        await p.waitForTimeout(60);
        const after = await p.evaluate(({ trigger, panel }) => { const t = document.querySelector(trigger).getBoundingClientRect(), b = document.querySelector(panel).getBoundingClientRect(); return Math.min(Math.abs(b.top - t.bottom), Math.abs(t.top - b.bottom)); }, { trigger, panel });
        check(`${tag} ${name}: scrolled 30px, the gap to its trigger is unchanged`, Math.abs(after - r.gap) <= 1, `${r.gap.toFixed(1)} -> ${after.toFixed(1)}`);
        await p.evaluate(() => window.scrollTo(0, 0));
      }
    }
    if (name === 'tooltip') await p.evaluate(() => document.activeElement.blur()); else await p.keyboard.press('Escape');
    await p.waitForTimeout(260);
  }
  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// the JS placement is still there when anchor positioning is not
{
  const { ctx, p } = await fixture({ register: 'warm', noAnchors: true });
  for (const [name, trigger, panel] of [['popover', '#pt', '#p1'], ['tooltip', '#tt', '#t1'], ['action-menu', '#mt', '#m1']]) {
    if (name === 'tooltip') await p.focus(trigger); else await p.click(trigger);
    await p.waitForTimeout(260);
    const r = await p.evaluate(({ trigger, panel }) => {
      const t = document.querySelector(trigger).getBoundingClientRect(), el = document.querySelector(panel), b = el.getBoundingClientRect();
      return { gap: Math.min(Math.abs(b.top - t.bottom), Math.abs(t.top - b.bottom)), left: el.style.left };
    }, { trigger, panel });
    check(`fallback: ${name} still places itself by JS where anchor positioning is not available`, r.gap >= 0 && r.gap <= 14 && r.left.endsWith('px'), `gap ${r.gap.toFixed(1)}px, left "${r.left}"`);
    if (name === 'tooltip') await p.evaluate(() => document.activeElement.blur()); else await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
  }
  await ctx.close();
}

// flips above near the bottom edge, by CSS or by JS
for (const noAnchors of [false, true]) {
  const { ctx, p } = await fixture({ register: 'warm', noAnchors, viewport: { width: 900, height: 600 } });
  await p.evaluate(() => { const t = document.getElementById('pt'); Object.assign(t.style, { position: 'fixed', left: '200px', bottom: '12px' }); });
  await p.click('#pt');
  await p.waitForTimeout(260);
  const r = await p.evaluate(() => ({ t: document.getElementById('pt').getBoundingClientRect(), b: document.getElementById('p1').getBoundingClientRect() }));
  check(`near the bottom edge (${noAnchors ? 'JS fallback' : 'CSS anchor'}): the popover flips above, its bottom edge ${(r.t.top - r.b.bottom).toFixed(1)}px over the trigger`, r.b.bottom <= r.t.top + 1 && r.t.top - r.b.bottom <= 14, `panel ${r.b.top.toFixed(0)}-${r.b.bottom.toFixed(0)}, trigger top ${r.t.top.toFixed(0)}`);
  await ctx.close();
}

// ── @starting-style: the first frame of an open is a transition ─────────────
const FIRST = {
  popover: { open: () => document.getElementById('p1').showPopover(), el: '#p1' },
  action: { open: () => document.getElementById('m1').showPopover(), el: '#m1' },
  dialog: { open: () => document.getElementById('d1').showModal(), el: '#d1' },
  drawer: { open: () => document.getElementById('r1').showModal(), el: '#r1' },
};
for (const register of REGISTERS) {
  const { ctx, p } = await fixture({ register });
  for (const [key, f] of Object.entries(FIRST)) {
    const r = await p.evaluate(({ open, el }) => {
      const node = document.querySelector(el);
      new Function(`(${open})()`)();
      getComputedStyle(node).opacity;
      // the transition's own first keyframe: Firefox may already have run a second style pass (anchor fallbacks) by the time a read returns
      const t = node.getAnimations().find(a => a.transitionProperty === 'opacity');
      const o = t ? +t.effect.getKeyframes()[0].opacity : +getComputedStyle(node).opacity;
      const kinds = node.getAnimations().map(a => `${a.constructor.name}:${a.transitionProperty ?? a.animationName}`);
      return { o, kinds, tr: kinds.some(k => k.startsWith('CSSTransition')) };
    }, { open: String(f.open), el: f.el });
    check(`${register}: ${key} opens as a CSS transition from opacity ${r.o.toFixed(2)} (@starting-style)`, r.o < 1 && r.tr, r.kinds.join(', '));
    await p.evaluate(sel => { const n = document.querySelector(sel); if (n.matches('dialog')) n.close(); else n.hidePopover(); }, f.el);
    await settle(p);
  }
  await ctx.close();
}
{
  const { ctx, p } = await fixture({ register: 'playful', reduced: true });
  for (const [key, f] of Object.entries(FIRST)) {
    const r = await p.evaluate(({ open, el }) => {
      const node = document.querySelector(el);
      new Function(`(${open})()`)();
      return { o: +getComputedStyle(node).opacity, n: node.getAnimations({ subtree: true }).length };
    }, { open: String(f.open), el: f.el });
    check(`reduced motion: ${key} opens at once, opacity ${r.o}, ${r.n} animations (the still)`, r.o === 1 && r.n === 0);
    await p.evaluate(sel => { const n = document.querySelector(sel); if (n.matches('dialog')) n.close(); else n.hidePopover(); }, f.el);
  }
  await ctx.close();
}

// exits: the panel is still on screen, fading, just after it closes (Chromium's overlay property)
{
  const { ctx, p } = await fixture({ register: 'warm' });
  if (await p.evaluate(() => CSS.supports('overlay: auto'))) {
    for (const [key, id] of [['popover', 'p1'], ['dialog', 'd1']]) {
      const r = await p.evaluate(async id => {
        const el = document.getElementById(id);
        el.matches('dialog') ? el.showModal() : el.showPopover();
        await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})));
        el.matches('dialog') ? el.close() : el.hidePopover();
        // poll a few frames: the first can still be the old opacity while the skin tears its scrim down
        let o = 1, shown = false;
        for (let i = 0; i < 20 && o >= 1; i++) { await new Promise(r => requestAnimationFrame(r)); o = +getComputedStyle(el).opacity; shown = el.getBoundingClientRect().height > 0; }
        await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})));
        return { o, shown, after: el.getBoundingClientRect().height };
      }, id);
      check(`warm: the ${key} fades out (still drawn, opacity ${r.o.toFixed(2)}, a frame after it closes) and then goes`, r.shown && r.o < 1 && r.after === 0, JSON.stringify(r));
    }
  }
  await ctx.close();
}

// ── the tala stagger belongs to the stylesheet and equals talaDelay() ───────
for (const register of REGISTERS) {
  const { ctx, p } = await fixture({ register });
  await p.click('#mt');
  await p.waitForTimeout(30);
  const r = await p.evaluate(() => [...document.querySelectorAll('#m1 [role="menuitem"]')].map(el => ({ d: parseFloat(getComputedStyle(el).animationDelay) * 1000, inline: el.style.getPropertyValue('--sg-item-delay') })));
  const want = r.map((_, i) => talaDelay(i));
  const sib = await p.evaluate(() => CSS.supports('animation-delay', 'calc(1s * sibling-index())'));
  check(`${register}: all ${r.length} item delays equal talaDelay(i) (khali beats skipped, capped at 600ms)`, r.every((x, i) => Math.abs(x.d - want[i]) < 1.5), `got ${r.map(x => Math.round(x.d))}`);
  if (sib) check(`${register}: the stagger comes from the stylesheet, no inline --sg-item-delay`, r.every(x => x.inline === ''), `inline: ${r.map(x => x.inline).join(',')}`);
  await ctx.close();
}
{
  // and the JS fallback gives the same numbers where sibling-index() is not understood
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.addInitScript(() => { const real = CSS.supports.bind(CSS); CSS.supports = (...a) => (a.join(' ').includes('sibling-index') ? false : real(...a)); });
  await p.goto(url('/tools/harness/blank.html'));
  await p.evaluate(async body => {
    document.documentElement.setAttribute('data-register', 'warm');
    for (const href of ['/packages/tokens/tokens.css', '/packages/components/action-menu/action-menu.css']) await new Promise(res => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = res; document.head.append(l); });
    document.body.innerHTML = body;
    await import('/packages/core/index.js');
    await import('/packages/components/action-menu/action-menu.js');
    await customElements.whenDefined('sg-action-menu');
    await new Promise(res => { const t = setInterval(() => { if (document.querySelector('sg-action-menu').dataset.skin) { clearInterval(t); res(); } }, 20); });
  }, BODY);
  await p.click('#mt');
  await p.waitForTimeout(30);
  const r = await p.evaluate(() => [...document.querySelectorAll('#m1 [role="menuitem"]')].map(el => el.style.getPropertyValue('--sg-item-delay')));
  check('fallback: without sibling-index() the script sets each item\'s delay from talaDelay()', r.every((v, i) => v === `${talaDelay(i)}ms`), r.join(','));
  await ctx.close();
}

// ── a long list in a short window stays inside it and scrolls ───────────────
{
  const { ctx, p } = await fixture({ register: 'playful', viewport: { width: 800, height: 500 } });
  if (await p.evaluate(() => CSS.supports('anchor-name: --a'))) {
    await p.click('#mt');
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const b = document.getElementById('m1').getBoundingClientRect(), el = document.getElementById('m1'); return { top: b.top, bottom: b.bottom, vh: innerHeight, scrolls: el.scrollHeight > el.clientHeight + 1 }; });
    check(`a 14-item playful menu in an 800x500 window stays on screen (${r.top.toFixed(0)} to ${r.bottom.toFixed(0)} of ${r.vh}) and scrolls`, r.top >= 0 && r.bottom <= r.vh && r.scrolls, JSON.stringify(r));
  }
  await ctx.close();
}

// ── invoker commands ────────────────────────────────────────────────────────
for (const [name, demo, ids] of [
  ['dialog', '/packages/components/dialog/demo.html', { btn: 'button[commandfor="ask-dialog"][command="show-modal"]', dlg: '#ask-dialog', el: '#ask', ev: 'sg-dialog-open' }],
  ['drawer', '/packages/components/drawer/demo.html', { btn: 'button[commandfor="rooms-dialog"][command="show-modal"]', dlg: '#rooms-dialog', el: '#rooms', ev: 'sg-drawer-open' }],
]) {
  // the component script blocked: the native command alone opens it, and Escape gives focus back
  {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.route(`**/${name}/${name}.js`, r => r.abort());
    await p.goto(url(demo), { waitUntil: 'load' });
    const defined = await p.evaluate(t => !!customElements.get(t), `sg-${name}`);
    let opened = false;
    try { await p.focus(ids.btn, { timeout: 2000 }); await p.keyboard.press('Enter'); await p.waitForTimeout(200); opened = await p.evaluate(s => document.querySelector(s).open, ids.dlg); } catch { /* no invoker in the markup */ }
    check(`${name}: with the component script blocked, a commandfor button opens it (element defined: ${defined})`, !defined && opened);
    if (opened) {
      await p.keyboard.press('Escape');
      await p.waitForTimeout(200);
      const back = await p.evaluate(sel => document.activeElement === document.querySelector(sel), ids.btn);
      check(`${name}: Escape closes it and focus returns to the invoker`, back);
    }
    await ctx.close();
  }
  // the script present: the skin and the events still run when the invoker opened it
  for (const register of ['warm', 'playful']) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(url(`${demo}?register=${register}`));
    await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-dialog, sg-drawer')].every(e => e.dataset.skin));
    await p.evaluate(({ el, ev }) => { window.__evs = []; document.querySelector(el).addEventListener(ev, e => window.__evs.push(e.type)); }, ids);
    let opened = false;
    try { await p.click(ids.btn, { timeout: 2000 }); await p.waitForTimeout(300); opened = true; } catch { /* absent */ }
    const r = opened ? await p.evaluate(({ el, dlg }) => ({ open: document.querySelector(dlg).open, scrim: !!document.querySelector(`${el} [class$="-scrim"] canvas`), evs: window.__evs.length, api: document.querySelector(el).open }), ids) : {};
    check(`${register}: ${name} opened by an invoker runs its skin (the Carepa scrim is drawn) and fires ${ids.ev} once`, opened && r.open && r.api && r.scrim && r.evs === 1, JSON.stringify(r));
    await ctx.close();
  }
  // a browser without commandForElement: our click handler opens it
  {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.addInitScript(() => { delete HTMLButtonElement.prototype.commandForElement; });
    await p.goto(url(`${demo}?register=warm`));
    await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-dialog, sg-drawer')].every(e => e.dataset.skin));
    const prevented = await p.evaluate(sel => new Promise(res => { const b = document.querySelector(sel); if (!b) return res(false); b.addEventListener('click', e => queueMicrotask(() => res(e.defaultPrevented))); b.click(); }), ids.btn);
    await p.waitForTimeout(200);
    const open = await p.evaluate(s => !!document.querySelector(s)?.open, ids.dlg);
    check(`${name}: without commandForElement the component's click handler opens it (native command prevented: ${prevented})`, open && prevented);
    await ctx.close();
  }
}

// ── the touch contract: pressed ─────────────────────────────────────────────
/** Press `sel` (mouse down, held) and read what it does, then let go off it. */
async function pressed(p, sel) {
  const box = await p.locator(sel).first().boundingBox();
  if (!box) throw new Error(`pressed(): ${sel} has no box on screen`);
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(40); // well under a frame budget of slack; the state must already be there
  const down = await p.evaluate(sel => { const cs = getComputedStyle(document.querySelector(sel)); return { translate: cs.translate, scale: cs.scale, shade: cs.boxShadow !== 'none' && /inset/.test(cs.boxShadow), transition: cs.transitionDuration }; }, sel);
  await p.mouse.move(2, 2);
  await p.mouse.up();
  // let go: wait for the ease back to finish, rather than guess how long a busy machine takes
  await p.waitForFunction(sel => { const el = document.querySelector(sel); return !el.matches(':active') && el.getAnimations().every(a => a.playState !== 'running'); }, sel, { timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(40);
  const up = await p.evaluate(sel => { const cs = getComputedStyle(document.querySelector(sel)); return { translate: cs.translate, scale: cs.scale }; }, sel);
  return { down, up };
}
const moves = d => d.translate !== 'none' && d.translate !== '0px' && d.translate !== '0px 0px';
const gives = d => d.scale !== 'none' && d.scale !== '1';
async function openAll(p) {
  await p.evaluate(() => { document.getElementById('d1').showModal(); });
}
for (const register of REGISTERS) {
  for (const [name, sel, opener] of [
    ['popover trigger', '#pt', null],
    ['tooltip trigger', '#tt', null],
    ['action-menu trigger', '#mt', null],
    ['action-menu item', '#mi1', '#m1'],
    ['dialog button', '#d-cancel', '#d1'],
    ['drawer button', '#r-close', '#r1'],
  ]) {
    const { ctx, p } = await fixture({ register });
    if (opener) { await p.evaluate(id => { const el = document.querySelector(id); el.matches('dialog') ? el.showModal() : el.showPopover(); }, opener); await settle(p); }
    const r = await pressed(p, sel);
    const tag = `${register}: ${name} press`;
    if (register === 'quiet') check(`${tag}: a 1px settle (translate ${r.down.translate}), back to ${r.up.translate} on release`, r.down.translate === '0px 1px' && !moves(r.up));
    if (register === 'warm') check(`${tag}: the colour shades (inset shade ${r.down.shade}), nothing moves (translate ${r.down.translate}, scale ${r.down.scale})`, r.down.shade && !moves(r.down) && !gives(r.down));
    if (register === 'playful') check(`${tag}: a small give (scale ${r.down.scale}), back to ${r.up.scale} on release`, r.down.scale === '0.97' && !gives(r.up));
    if (name === 'action-menu item' || name === 'dialog button') {
      // the keyboard's own presses never move
      // a real key state: core's input-modality sets data-sg-input="key" while an arrow is held, and a
      // mouse press resets it to "pointer", so: focus, hold an arrow, press Space, read the focused control
      await p.focus(sel);
      await p.keyboard.down('ArrowRight');
      await p.keyboard.down('Space');
      await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const k = { down: await p.evaluate(() => { const b = document.activeElement, cs = getComputedStyle(b); return { input: document.documentElement.dataset.sgInput, active: b.matches(':active'), translate: cs.translate, scale: cs.scale }; }) };
      await p.keyboard.up('Space'); await p.keyboard.up('ArrowRight');
      const keyLit = await keyHeldActivates(browser); // Firefox (as driven here) does not put a key-held button in :active at all; then only what it can answer is asked
      if (!keyLit && !kbNoted) { kbNoted = true; unsupportedIn(engine, ':active while a key is held', 'a bare button with an :active rule stays at rest under a held Space in this engine, so the press itself is not asked; nothing-moves still is'); }
      check(`${tag}, while the keyboard is the input: nothing moves`, k.down.input === 'key' && (k.down.active || !keyLit) && !moves(k.down) && !gives(k.down), `input ${k.down.input}, active ${k.down.active}, translate ${k.down.translate}, scale ${k.down.scale}`);
    }
    await ctx.close();
  }
}
for (const [name, sel, opener] of [['action-menu item', '#mi1', '#m1'], ['dialog button', '#d-cancel', '#d1'], ['popover trigger', '#pt', null]]) {
  const { ctx, p } = await fixture({ register: 'playful', reduced: true });
  if (opener) { await p.evaluate(id => { const el = document.querySelector(id); el.matches('dialog') ? el.showModal() : el.showPopover(); }, opener); await settle(p); }
  const r = await pressed(p, sel);
  check(`reduced motion: ${name} press keeps the colour (shade ${r.down.shade}) and drops the movement (translate ${r.down.translate}, scale ${r.down.scale})`, r.down.shade && !moves(r.down) && !gives(r.down));
  await ctx.close();
}

// ── toast: entry, exit and press ────────────────────────────────────────────
async function toastPage(register, reduced = false) {
  const { ctx, p, errors } = await fixture({ register, reduced });
  return { ctx, p, errors };
}
for (const register of REGISTERS) {
  const { ctx, p } = await toastPage(register);
  const r = await p.evaluate(() => {
    const t = document.getElementById('reg').show({ tone: 'success', title: 'Saved', message: 'Your changes are saved.', action: { label: 'Undo', keep: true } });
    window.__t = t;
    const o = +getComputedStyle(t).opacity;
    return { o, kinds: t.getAnimations().map(a => `${a.constructor.name}:${a.transitionProperty ?? a.animationName}`) };
  });
  check(`${register}: a toast arrives as a CSS transition from opacity ${r.o.toFixed(2)} (@starting-style)`, r.o < 1 && r.kinds.some(k => k.startsWith('CSSTransition:')), r.kinds.join(', '));
  await p.waitForFunction(() => window.__t.phase === 'shown', null, { timeout: 4000 });
  const press = await pressed(p, '.sg-toast-action');
  if (register === 'quiet') check(`${register}: toast action press: a 1px settle`, press.down.translate === '0px 1px' && !moves(press.up), JSON.stringify(press.down));
  if (register === 'warm') check(`${register}: toast action press: the colour shades, nothing moves`, press.down.shade && !moves(press.down) && !gives(press.down), JSON.stringify(press.down));
  if (register === 'playful') check(`${register}: toast action press: a small give`, press.down.scale === '0.97' && !gives(press.up), JSON.stringify(press.down));
  // leaving: the toast fades in CSS and is removed once it has
  const gone = await p.evaluate(async () => {
    const t = window.__t;
    t.dismiss('api');
    let o = 1;
    for (let i = 0; i < 20 && o >= 1 && t.isConnected; i++) { await new Promise(r => requestAnimationFrame(r)); o = +getComputedStyle(t).opacity; }
    const kinds = t.getAnimations().map(a => a.constructor.name + ':' + (a.transitionProperty ?? a.animationName ?? ''));
    await new Promise(r => setTimeout(r, 900));
    return { o, kinds, removed: !t.isConnected };
  });
  check(`${register}: a dismissed toast is still drawn, fading (opacity ${gone.o.toFixed(2)}), and then removed`, gone.removed && gone.o < 1 && gone.kinds.includes(register === 'quiet' ? 'CSSTransition:opacity' : 'CSSTransition:translate'), JSON.stringify(gone));
  await ctx.close();
}
{
  const { ctx, p } = await toastPage('playful', true);
  const r = await p.evaluate(() => {
    const t = document.getElementById('reg').show({ tone: 'info', message: 'Noted.' });
    return { o: +getComputedStyle(t).opacity, n: t.getAnimations({ subtree: true }).length };
  });
  check(`reduced motion: a toast is there at once, opacity ${r.o}, ${r.n} animations`, r.o === 1 && r.n === 0);
  await ctx.close();
}

// ── keyboard focus: every trigger and item shows it ─────────────────────────
{
  const { ctx, p } = await fixture({ register: 'warm' });
  await p.evaluate(() => document.getElementById('m1').showPopover());
  await settle(p);
  const r = await p.evaluate(() => { const el = document.getElementById('mi1'); el.focus({ focusVisible: true }); const cs = getComputedStyle(el); return { style: cs.outlineStyle, w: cs.outlineWidth }; });
  check('an action-menu item shows a focus ring', r.style !== 'none' && parseFloat(r.w) > 0, JSON.stringify(r));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} check(s) failed (${engine})` : `\nall ${results.length} checks pass (${engine})`);
process.exitCode = failed ? 1 : 0;
