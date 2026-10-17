// Browser checks for the arriving lists (menu, event-list, gallery, data-table): the tala
// stagger in CSS, and the press state on what they let you press. Run by hand or with
// `npm run check`:
//
//   node packages/components/event-list/arrive.check.mjs
//   node packages/components/event-list/arrive.check.mjs --shots     writes .shots/arrive/
//   node packages/components/event-list/arrive.check.mjs --break=<mode>   a deliberately broken
//                                                         piece; the checks named for the mode must go red
//
// Break modes (each rewrites one served file, and the run fails if the text to break has moved):
//   no-delay    the stagger delay is dropped                       -> "stagger"
//   replays     a sort is not told it moved seen rows              -> "a sort"
//   always      the arrival plays in quiet and under reduced motion -> "quiet", "reduced"
//   slow-press  :active keeps the release transition               -> "answers within a frame"
//   no-press    the playful press does not give                     -> "press"

import fs from 'node:fs';
import { engineName, keyHeldActivates, pickEngine, unsupportedIn } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';
import { arrivalDelay } from '../../core/arrive.js';

const BREAK = process.argv.find(a => a.startsWith('--break='))?.slice('--break='.length) ?? '';
const shots = process.argv.includes('--shots');
if (shots) fs.mkdirSync('.shots/arrive', { recursive: true });
const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const BREAKS = {
  'no-delay': ['css', 'animation-delay: var(--sg-arrive-delay, calc(', 'animation-delay: var(--sg-arrive-delay, 0ms); --unused: calc('],
  replays: ['js', 'seen(nodes) { mark([...nodes]); },', 'seen() {},'],
  always: ['js', "const animates = () => host.motion === 'ambient' || host.motion === 'full';", 'const animates = () => true;'],
  'slow-press': ['css', 'transition: none; translate: 0 1px;', 'translate: 0 1px;'],
  'no-press': ['css', 'translate: none; scale: 0.97;', 'translate: none;'],
};
if (BREAK && !BREAKS[BREAK]) { console.error(`unknown --break mode "${BREAK}"`); process.exit(2); }
let broke = false;
async function ctxFor(opts = {}) {
  const ctx = await browser.newContext(opts);
  if (BREAK) {
    const [kind, from, to] = BREAKS[BREAK];
    const ok = u => (kind === 'css' ? /\/(menu|event-list|gallery|data-table)\/\1\.css$/ : /\/core\/arrive\.js$/).test(u.pathname);
    await ctx.route(ok, async route => {
      const res = await route.fetch();
      const body = await res.text();
      if (!body.includes(from)) { await route.fulfill({ response: res }); return; }
      broke = true;
      await route.fulfill({ response: res, body: body.replaceAll(from, to) });
    });
  }
  return ctx;
}

const LISTS = {
  menu: { demo: 'menu', item: '.sg-menu-item', make: n => `<sg-menu orderable id="fx"><section class="sg-menu-section"><h3 class="sg-menu-section-title">Test</h3><ul class="sg-menu-items">${row(n, i => `<li class="sg-menu-item" data-id="d${i}" data-availability="available"><span class="sg-menu-name">Dish ${i}</span><span class="sg-menu-price"><data value="100">₹100</data></span></li>`)}</ul></section></sg-menu>`, add: 'ul.sg-menu-items', more: i => `<li class="sg-menu-item" data-id="n${i}" data-availability="available"><span class="sg-menu-name">New ${i}</span><span class="sg-menu-price"><data value="100">₹100</data></span></li>` },
  'event-list': { demo: 'event-list', item: '.sg-event-upcoming > sg-event-card', make: n => `<sg-event-list id="fx" now="2026-10-02T10:00"><h2>On</h2>${row(n, i => `<sg-event-card kind="workshop" start="2026-10-${String(9 + (i % 20)).padStart(2, '0')}T19:30"><article><h3>Event ${i}</h3><p>Words</p></article></sg-event-card>`)}</sg-event-list>`, add: 'sg-event-list', more: i => `<sg-event-card kind="workshop" start="2026-11-${String(1 + i).padStart(2, '0')}T19:30"><article><h3>New ${i}</h3><p>Words</p></article></sg-event-card>` },
  gallery: { demo: 'gallery', item: '.sg-gallery-slot', make: n => `<sg-gallery id="fx" seed="fx">${row(n, i => `<figure class="sg-gallery-slot" consent="pending"><figcaption>Photo ${i}</figcaption></figure>`)}</sg-gallery>`, add: 'sg-gallery', more: i => `<figure class="sg-gallery-slot" consent="pending"><figcaption>New ${i}</figcaption></figure>` },
  'data-table': { demo: 'data-table', item: 'tbody tr', make: n => `<sg-data-table id="fx"><table><caption>Test</caption><thead><tr><th scope="col" data-sort="n">Number</th></tr></thead><tbody>${row(n, i => `<tr><td data-value="${(i * 7) % 20}">${(i * 7) % 20}</td></tr>`)}</tbody></table></sg-data-table>`, add: 'tbody', more: i => `<tr><td data-value="${100 + i}">${100 + i}</td></tr>` },
};
const row = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');

async function open(ctx, name, reg) {
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  await p.goto(`${server.url}/packages/components/${LISTS[name].demo}/demo.html?register=${reg}`);
  await p.waitForFunction(() => document.body.dataset.ready === 'true' || window.__ready === true || document.querySelector('[data-skin]'), null, { timeout: 8000 });
  return p;
}
/** Put a fresh list of n items on the page, and report each item's arrival as soon as it is in. */
async function fresh(p, name, reg, n = 20) {
  const L = LISTS[name];
  return p.evaluate(async ({ html, item, reg }) => {
    document.querySelector('#fx')?.remove();
    const t = document.createElement('template'); t.innerHTML = html;
    const host = t.content.firstElementChild;
    host.setAttribute('register', reg);
    document.body.prepend(host);
    await Promise.resolve(); // a microtask later the new items have their style, and no frame has moved them yet (a slow machine cannot finish an arrival before it is read)
    return [...host.querySelectorAll(item)].map(el => { const cs = getComputedStyle(el); return { name: cs.animationName, delay: parseFloat(cs.animationDelay) * 1000, opacity: +cs.opacity }; });
  }, { html: L.make(n), item: L.item, reg });
}
// every animation that has an end and is running (an ambient one that loops, or one a skin has paused, never settles, and is not what is being measured); never longer than 2 s
const settle = p => p.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().endTime !== Infinity && a.playState !== 'paused').map(a => a.finished.catch(() => {}))), new Promise(r => setTimeout(r, 2000))]).then(() => 0));
const near = (a, b) => Math.abs(a - b) < 1.5;

// ── the stagger, per list, per register ──
for (const name of Object.keys(LISTS)) {
  for (const reg of ['warm', 'playful']) {
    const ctx = await ctxFor({ viewport: { width: 1100, height: 900 } });
    const p = await open(ctx, name, reg);
    const items = await fresh(p, name, reg);
    const want = items.map((_, i) => arrivalDelay(i));
    const got = items.map(i => Math.round(i.delay));
    check(`${name} ${reg}: stagger, the first ${Math.min(16, items.length)} delays are arrivalDelay()`, items.length >= 16 && items.slice(0, 16).every((it, i) => it.name === 'sg-arrive' && near(it.delay, want[i])), `got ${got.slice(0, 16).join(',')} want ${want.slice(0, 16).join(',')}`);
    check(`${name} ${reg}: stagger, the tail lands with the fifth (every item past it has the fifth's delay, nothing waits past 520 ms)`, items.slice(5).every(it => near(it.delay, items[4].delay)) && Math.max(...got) <= 520 && items[4].delay > items[3].delay, `max ${Math.max(...got)}, tail ${got.slice(5, 9)}`);
    if (shots && name === 'event-list' && reg === 'warm') {
      await p.evaluate(() => { document.querySelector('#fx')?.remove(); });
      await p.evaluate(({ html, reg }) => { const t = document.createElement('template'); t.innerHTML = html; const h = t.content.firstElementChild; h.setAttribute('register', reg); document.body.prepend(h); }, { html: LISTS[name].make(10), reg });
      // freeze every arrival at 400 ms in: card 0 is down, card 1 is landing, card 2 is half way, card 3 has not begun
      await p.evaluate(() => document.getAnimations().filter(an => an.animationName === 'sg-arrive').forEach(an => { an.pause(); an.currentTime = 400; }));
      await p.screenshot({ path: '.shots/arrive/event-list-mid-stagger-warm.png' });
    }
    await ctx.close();
  }
}

// ── arriving items are never hidden from assistive technology: opacity 0 under fill-mode backwards is visual only ──
{
  const ctx = await ctxFor({ viewport: { width: 1100, height: 900 } });
  const p = await open(ctx, 'menu', 'playful');
  await fresh(p, 'menu', 'playful', 30);
  const snap = await p.locator('#fx').ariaSnapshot();
  const sees = n => snap.includes(n);
  await p.evaluate(() => { document.querySelector('#fx [data-id=d29]').style.display = 'none'; });
  const control = await p.locator('#fx').ariaSnapshot();
  check('menu playful: every dish, the 30th too, is in the accessibility tree while it is still arriving', sees('Dish 0') && sees('Dish 29') && !control.includes('Dish 29'), `first and last present: ${sees('Dish 0')} ${sees('Dish 29')}; control (hidden) drops the last: ${!control.includes('Dish 29')}`);
  await ctx.close();
}

// ── the closed "Before" drawer's cards are not arrivals: nothing plays in what cannot be seen ──
{
  const ctx = await ctxFor({ viewport: { width: 1100, height: 900 } });
  const p = await open(ctx, 'event-list', 'playful');
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ past: [...document.querySelectorAll('details.sg-event-before sg-event-card')].map(c => getComputedStyle(c).animationName), live: document.getAnimations().filter(a => a.animationName === 'sg-arrive' && a.effect.target.closest('details')).length }));
  check('event-list: cards put away in the closed Before drawer do not play an arrival', r.past.length > 0 && r.past.every(n => n === 'none') && r.live === 0, JSON.stringify(r));
  await ctx.close();
}

// ── quiet gets none; reduced motion gets none ──
for (const name of Object.keys(LISTS)) {
  const ctx = await ctxFor({ viewport: { width: 1100, height: 900 } });
  const p = await open(ctx, name, 'quiet');
  const items = await fresh(p, name, 'quiet');
  check(`${name} quiet: no stagger (state only)`, items.length >= 16 && items.every(i => i.name === 'none' && i.opacity === 1), `${new Set(items.map(i => i.name))}`);
  await ctx.close();
  const rctx = await ctxFor({ viewport: { width: 1100, height: 900 }, reducedMotion: 'reduce' });
  for (const reg of ['warm', 'playful']) {
    const rp = await open(rctx, name, reg);
    const r = await fresh(rp, name, reg);
    check(`${name} ${reg} reduced motion: nothing arrives`, r.length >= 16 && r.every(i => i.name === 'none' && i.opacity === 1), `${new Set(r.map(i => i.name))}`);
    await rp.close();
  }
  await rctx.close();
}

// ── only arrivals: a sort never replays, and a new row starts again from the first beat ──
{
  const ctx = await ctxFor({ viewport: { width: 1100, height: 900 } });
  const p = await open(ctx, 'data-table', 'playful');
  await fresh(p, 'data-table', 'playful');
  await settle(p);
  const done = await p.evaluate(() => [...document.querySelectorAll('#fx tbody tr')].every(r => r.hasAttribute('data-seen')));
  check('data-table: every row is marked seen once its arrival has played', done);
  await p.click('#fx .sg-table-sort');
  const after = await p.evaluate(() => ({ anims: document.getAnimations().filter(a => a.animationName === 'sg-arrive').length, order: [...document.querySelectorAll('#fx tbody td')].slice(0, 4).map(t => t.textContent) }));
  check('data-table: a sort the reader asked for does not replay the arrival', after.anims === 0 && after.order.join() === '0,1,2,3', JSON.stringify(after));
  // a sort while the first arrival is still playing is still not an arrival
  await fresh(p, 'data-table', 'playful');
  await p.click('#fx .sg-table-sort');
  const mid = await p.evaluate(() => ({ replayed: [...document.querySelectorAll('#fx tbody tr')].some(r => !r.hasAttribute('data-seen')) }));
  check('data-table: a sort in the middle of the first arrival marks the rows seen', mid.replayed === false, JSON.stringify(mid));
  await fresh(p, 'data-table', 'playful');
  await settle(p);
  const late = await p.evaluate(async () => {
    const tb = document.querySelector('#fx tbody');
    const rows = [100, 101, 102].map(v => { const tr = document.createElement('tr'); tr.innerHTML = `<td data-value="${v}">${v}</td>`; return tr; });
    tb.append(...rows);
    await Promise.resolve(); // a microtask later the new items have their style, and no frame has moved them yet (a slow machine cannot finish an arrival before it is read)
    return { fresh: rows.map(r => Math.round(parseFloat(getComputedStyle(r).animationDelay) * 1000)), old: getComputedStyle(tb.rows[0]).animationName };
  });
  check('data-table: new rows arrive from the first beat; old rows stay put', late.fresh.join() === [0, 1, 2].map(i => arrivalDelay(i)).join() && late.old === 'none', JSON.stringify(late));
  await ctx.close();
}

// ── the press ──
async function press(p, sel) {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await settle(p);
  const read = () => el.evaluate(e => {
    const img = e.querySelector('img'), cs = getComputedStyle(e);
    return { translate: cs.translate, scale: cs.scale, bg: cs.backgroundColor, filter: cs.filter, imgOpacity: img ? +getComputedStyle(img).opacity : null, dur: cs.transitionDuration, delay: cs.transitionDelay };
  });
  const rest = await read();
  const b = await el.boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  const down = await read();
  await p.mouse.move(2, 2);
  await p.mouse.up();
  return { rest, down };
}
const changed = (a, b) => a.bg !== b.bg || a.filter !== b.filter || (a.imgOpacity !== null && a.imgOpacity !== b.imgOpacity);
const TARGETS = [
  ['menu', 'sg-menu#menu .sg-menu-plus'],
  ['menu', 'sg-menu#menu .sg-menu-minus[aria-disabled="false"], sg-menu#menu .sg-menu-clear'],
  ['event-list', 'sg-event-list .sg-event-before > summary'],
  ['gallery', 'sg-gallery .sg-gallery-open'],
  ['data-table', 'sg-data-table .sg-table-sort'],
];
for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await ctxFor({ viewport: { width: 1100, height: 1100 } });
  for (const [name, sel] of TARGETS) {
    const p = await open(ctx, name, reg);
    if (name === 'menu' && sel.includes('minus')) { await p.click('sg-menu#menu .sg-menu-plus'); await settle(p); }
    const { rest, down } = await press(p, sel);
    const what = `${name} ${reg}: ${sel.split(' ').pop()}`;
    const move = reg === 'quiet' ? down.translate === '0px 1px' : reg === 'playful' ? down.scale === '0.97' && down.translate === 'none' : down.translate === 'none' && down.scale === 'none';
    check(`${what} press: the ${reg} press moves as the contract says (quiet 1 px, warm none, playful 0.97)`, rest.translate === 'none' && move, `rest ${rest.translate}/${rest.scale}, down ${down.translate}/${down.scale}`);
    check(`${what} press: the colour changes in the next frame`, changed(rest, down), `${rest.bg} -> ${down.bg}, img ${rest.imgOpacity} -> ${down.imgOpacity}`);
    check(`${what} press: answers within a frame (no transition in), lets go in 150 ms or less`, parseFloat(down.dur) === 0 && parseFloat(rest.dur.split(',').map(parseFloat).sort((a, b) => b - a)[0]) <= 0.15, `in ${down.dur}, out ${rest.dur}`);
    if (shots && reg === 'playful' && name === 'data-table') {
      const b = await p.locator(sel).first().boundingBox();
      await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
      await p.waitForTimeout(80);
      await p.screenshot({ path: '.shots/arrive/data-table-pressed-playful.png', clip: { x: Math.max(0, b.x - 200), y: Math.max(0, b.y - 80), width: 600, height: 260 } });
      await p.mouse.move(2, 2); await p.mouse.up();
    }
    await p.close();
  }
  await ctx.close();
}
{
  // reduced motion keeps the colour and drops the movement; a key held down does not move anything
  const ctx = await ctxFor({ viewport: { width: 1100, height: 1100 }, reducedMotion: 'reduce' });
  const p = await open(ctx, 'data-table', 'playful');
  const { rest, down } = await press(p, 'sg-data-table .sg-table-sort');
  check('data-table playful reduced motion: the press keeps the colour and drops the movement', changed(rest, down) && down.translate === 'none' && down.scale === 'none', `${down.translate}/${down.scale}`);
  await ctx.close();
  const kctx = await ctxFor({ viewport: { width: 1100, height: 1100 } });
  const kp = await open(kctx, 'data-table', 'playful');
  // a real key state: core's input-modality sets data-sg-input="key" while an arrow is held (a pointer
  // press resets it to "pointer", so setting the attribute by hand and pressing with the mouse is no state a user reaches)
  await kp.focus('sg-data-table .sg-table-sort');
  await kp.keyboard.down('ArrowRight');
  await kp.keyboard.down('Space');
  await kp.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const k = await kp.evaluate(() => { const b = document.activeElement, cs = getComputedStyle(b); return { input: document.documentElement.dataset.sgInput, active: b.matches(':active'), translate: cs.translate, scale: cs.scale }; });
  await kp.keyboard.up('Space'); await kp.keyboard.up('ArrowRight');
  const keyLit = await keyHeldActivates(browser); // Firefox (as driven here) does not put a key-held button in :active at all
  if (!keyLit) unsupportedIn(engineName(), ':active while a key is held', 'a bare button with an :active rule stays at rest under a held Space in this engine, so the press itself is not asked; nothing-moves still is');
  check('data-table playful: with an arrow held (data-sg-input=key) a press does not move', k.input === 'key' && (k.active || !keyLit) && k.translate === 'none' && k.scale === 'none', JSON.stringify(k));
  await kctx.close();
}

await browser.close();
server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} arrive checks pass${BREAK ? ` (--break=${BREAK}: ${broke ? 'the break was served' : 'THE BREAK WAS NEVER SERVED'})` : ''}`);
if (BREAK && !broke) process.exit(2);
process.exit(failed ? 1 : 0);
