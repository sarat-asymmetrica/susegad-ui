// Browser checks for the WhatsApp order composer: the plain link with no JavaScript, the
// keyboard walk, the exact message (the link's address decodes to the preview, word for
// word), notice, delivery and pickup, the honest line after the tap, and the phone.
// Run by hand or with `npm run check`:
//
//   node packages/components/wa-order/wa-order.check.mjs
//   node packages/components/wa-order/wa-order.check.mjs --break=<mode>   a deliberately broken piece;
//                                                                         the checks named for the mode must go red
//
// Break modes (each rewrites served files, and the run fails if the text to break has moved):
//   stale-link   the link keeps its first address as fields change      -> "decodes to the preview"
//   no-notice    a day inside the notice is accepted                    -> "notice"
//   says-placed  the line after the tap says the order is placed        -> "honest line"
//   empty-sends  an empty cart gets a link                              -> "empty"
//   no-focus     pressing the link too early does not take you anywhere  -> "keyboard: pressing"
//   no-fallback  the page has no plain link                             -> "no JS"
//   touches-min  the date's `min` is rewritten on every keystroke        -> "typed by hand"
//   low-contrast the preview's words are a pale grey                    -> "contrast"
//   unnamed      the date field has no label                            -> "axe"

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';
import { contrastReport } from '../../../tools/lib/contrast.mjs';

const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const BREAK = process.argv.find(a => a.startsWith('--break='))?.slice('--break='.length) ?? '';
const shots = process.argv.includes('--shots');
if (shots) fs.mkdirSync('.shots/wa-order', { recursive: true });
const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const PAGE = (reg, extra = '') => `${server.url}/packages/components/wa-order/demo.html?register=${reg}${extra}`;

const BREAKS = {
  'stale-link': [['wa-order.js', 'link.href = r.href;', 'link.href = link.getAttribute("href") || r.href;']],
  'no-notice': [['wa-order.core.js', 'else if (date < earliest)', 'else if (false)']],
  'says-placed': [['wa-order.core.js', "written: \"Your order is written; send it in WhatsApp and we'll confirm.\"", "written: 'Your order is placed.'"]],
  'empty-sends': [['wa-order.core.js', 'if (!usable(order.lines).length) p.push({ field: \'lines\', message: STRINGS.emptyCart });', ''], ['wa-order.core.js', 'if (!usable(order.lines).length) return empty;', '']],
  'no-focus': [['wa-order.js', 'if (first) { first.focus(); first.reportValidity?.(); }', '']],
  'touches-min': [['wa-order.js', 'if (f.date.min !== earliest) f.date.min = earliest;', 'f.date.min = earliest;']],
  'no-fallback': [['demo.html', '<a class="sg-wa-send" href="https://wa.me/919000012345?text=Hello%20Sample%20Pasta%20Studio!%20I%20would%20like%20to%20order.%20What%20is%20available%3F">Order on WhatsApp</a>', '']],
  'low-contrast': [['wa-order.css', 'sg-wa-order .sg-wa-text[data-empty] { color: var(--sg-text-soft);', 'sg-wa-order .sg-wa-text { color: color-mix(in oklch, var(--sg-text) 35%, var(--sg-surface)); }\nsg-wa-order .sg-wa-text[data-empty] { color: var(--sg-text-soft);']],
  unnamed: [['wa-order.js', "return h('div', { class: 'sg-wa-plain' }, h('label', { for: cid, text: label }), hintEl, control);", "return h('div', { class: 'sg-wa-plain' }, f.date === control ? null : h('label', { for: cid, text: label }), hintEl, control);"]],
};
if (BREAK && !BREAKS[BREAK]) { console.error(`unknown --break mode "${BREAK}"`); process.exit(2); }
const served = new Set();
async function ctxFor(opts = {}) {
  const ctx = await browser.newContext({ timezoneId: 'Asia/Kolkata', locale: 'en-IN', ...opts });
  // 2 October 2026, 2:30 pm in Goa: the day the notice is counted from
  await ctx.clock.setFixedTime(new Date('2026-10-02T14:30:00+05:30'));
  // nothing leaves the machine: a tap on the send link opens a stub, never WhatsApp
  await ctx.route(/^https:\/\/wa\.me\//, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
  if (BREAK) {
    await ctx.route(u => /\/packages\/components\/(wa-order|menu)\//.test(u.pathname), async route => {
      const url = new URL(route.request().url());
      const file = url.pathname.split('/').pop();
      const edits = BREAKS[BREAK].filter(([f]) => f === file);
      if (!edits.length) return route.continue();
      const res = await route.fetch();
      let body = await res.text();
      for (const [, from, to] of edits) {
        if (!body.includes(from)) { console.error(`break "${BREAK}": the text to break is not in ${file} any more`); process.exit(2); }
        body = body.replace(from, to);
        served.add(`${BREAK}:${file}`);
      }
      await route.fulfill({ response: res, body });
    });
  }
  return ctx;
}
async function open(ctx, reg, extra = '') {
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(PAGE(reg, extra));
  await p.waitForFunction(() => window.__ready === true);
  await p.waitForFunction(r => document.getElementById('order').dataset.skin === r && document.getElementById('menu').dataset.skin === r, reg);
  p.errors = errors;
  return p;
}
const MESSAGE = [
  'Hello Sample Pasta Studio! I would like to order:',
  '',
  '2 × Fresh fettuccine (10 pieces, egg-less, veg): ₹900',
  '1 × Spinach ravioli (serves 2, veg): ₹520',
  '',
  'Estimated total: ₹1,420. Please confirm the total and any delivery charge.',
  '',
  'When: Sun 4 Oct 2026, Morning (9 to 12)',
  'Delivery to: Porvorim',
  'Name: Anjali',
  'Dietary: No nuts',
  'Notes: Ring twice please 🍝',
  '',
  'Thank you!',
].join('\n');
const view = p => p.evaluate(() => {
  const o = document.getElementById('order');
  const a = o.querySelector('a.sg-wa-send');
  const href = a.getAttribute('href');
  let decoded = null, digits = null;
  if (href) { try { const u = new URL(href); decoded = u.searchParams.get('text'); digits = u.pathname.slice(1); } catch { /* not a url */ } }
  return {
    href, decoded, digits,
    disabled: a.getAttribute('aria-disabled'), tabindex: a.getAttribute('tabindex'), role: a.getAttribute('role'), label: a.textContent.trim(), target: a.target, rel: a.rel,
    preview: o.querySelector('.sg-wa-text').textContent,
    empty: o.querySelector('.sg-wa-text').hasAttribute('data-empty'),
    reason: o.querySelector('.sg-wa-reason').textContent,
    written: o.querySelector('.sg-wa-written').textContent,
    menuLink: !o.querySelector('.sg-wa-menu-link').hidden ? o.querySelector('.sg-wa-menu-link').getAttribute('href') : null,
    min: o.querySelector('input[type=date]').min,
  };
});
async function fillAll(p, over = {}) {
  const v = { date: '2026-10-04', slot: 'Morning (9 to 12)', area: 'Porvorim', name: 'Anjali', dietary: 'No nuts', notes: 'Ring twice please 🍝', ...over };
  const f = n => `#order [name=${n}]`;
  if (v.date !== null) await p.fill(f('date'), v.date);
  await p.selectOption(f('slot'), v.slot);
  if (v.area !== null) await p.fill(f('area'), v.area);
  await p.fill(f('name'), v.name);
  await p.fill(f('dietary'), v.dietary);
  await p.fill(f('notes'), v.notes);
}

// ── Without JavaScript: the plain link is all there is, and it works ──
{
  const ctx = await ctxFor({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(PAGE('quiet'));
  await p.waitForLoadState('load');
  const r = await p.evaluate(() => {
    const o = document.getElementById('order');
    const a = o.querySelector('a');
    const box = a?.getBoundingClientRect();
    let text = null;
    try { text = new URL(a.href).searchParams.get('text'); } catch { /* no link */ }
    return { has: !!a, href: a?.getAttribute('href'), text, visible: !!box && box.width > 0 && box.height >= 44, inputs: o.querySelectorAll('input, select, textarea, button').length, overflow: document.documentElement.scrollWidth - innerWidth, label: a?.textContent.trim() };
  });
  check('no JS: a plain wa.me link stays in the markup, visible and 44 px tall, with a short message', r.has && r.href.startsWith('https://wa.me/919000012345?text=') && r.text === 'Hello Sample Pasta Studio! I would like to order. What is available?' && r.visible && r.label === 'Order on WhatsApp', JSON.stringify(r));
  check('no JS: nothing that would not work (no fields, no steppers) and nothing scrolls sideways', r.inputs === 0 && r.overflow <= 0, `${r.inputs} controls, ${r.overflow}px`);
  if (shots) await p.screenshot({ path: '.shots/wa-order/no-js-390.png', fullPage: true });
  await ctx.close();
}

// ── With JavaScript, in each register ──
for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await ctxFor({ viewport: { width: 1280, height: 1100 } });
  const p = await open(ctx, reg);

  // the empty cart
  let v = await view(p);
  check(`${reg}: an empty cart has no link, says why, and points back to the menu`, !v.href && v.disabled === 'true' && v.reason === 'Choose something from the menu first.' && v.empty && v.preview === 'Choose something from the menu and your message will appear here.' && v.menuLink === '#menu', JSON.stringify({ href: v.href, d: v.disabled, r: v.reason, m: v.menuLink }));

  // notice: the earliest day counts the hours
  check(`${reg}: the date field's earliest day respects the 24 hours of notice (now is 2 Oct, 2:30 pm)`, v.min === '2026-10-03', v.min);

  // choose dishes in the menu
  await p.click('#menu [data-id=fettuccine] .sg-menu-plus');
  await p.click('#menu [data-id=fettuccine] .sg-menu-plus');
  await p.click('#menu [data-id=ravioli] .sg-menu-plus');
  await p.waitForTimeout(80);
  v = await view(p);
  check(`${reg}: the dishes appear in the message as they are chosen, with units and tags`, v.preview.startsWith('Hello Sample Pasta Studio! I would like to order:\n\n2 × Fresh fettuccine (10 pieces, egg-less, veg): ₹900\n1 × Spinach ravioli (serves 2, veg): ₹520\n\nEstimated total: ₹1,420.') && !v.empty, JSON.stringify(v.preview.slice(0, 160)));
  check(`${reg}: still missing the day and a name: no link yet, and it says what is first`, !v.href && v.disabled === 'true' && v.reason === 'Pick the day you want it.' && v.menuLink === null, JSON.stringify({ href: v.href, r: v.reason }));

  // keyboard: the walk through the composer, ending on the link
  await p.focus('#order [name=date]');
  const order = [];
  for (let i = 0; i < 11; i++) { order.push(await p.evaluate(() => { const a = document.activeElement; return a.name || a.className || a.localName; })); await p.keyboard.press('Tab'); }
  // a date input is several stops of its own (day, month, year, the picker): count it once
  const walk = order.filter((n, i) => i === 0 || n !== order[i - 1]);
  const radio = await p.evaluate(() => document.querySelector('#order input[type=radio]:checked').name);
  check(`${reg}: Tab walks the fields in reading order and ends on the send link`, walk.join(',') === `date,slot,${radio},area,name,dietary,notes,sg-wa-send`, walk.join(','));

  // pressing the link too early takes you to the first thing missing, and says it in words
  await p.focus('#order a.sg-wa-send');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(60);
  const early = await p.evaluate(() => ({ focus: document.activeElement.name, tried: document.getElementById('order').hasAttribute('data-tried'), msg: document.querySelector('#order [name=date]').validationMessage, opened: false }));
  check(`${reg}: keyboard: pressing the link too early moves focus to the first missing field and says what is missing`, early.focus === 'date' && early.tried && early.msg === 'Pick the day you want it.', JSON.stringify(early));

  // a day inside the notice
  await p.fill('#order [name=date]', '2026-10-02');
  v = await view(p);
  const tooEarly = await p.evaluate(() => document.querySelector('#order [name=date]').validationMessage);
  check(`${reg}: notice: today is refused, and the reason says when the earliest day is`, !v.href && tooEarly === 'We need a day of notice. The earliest day is Sat 3 Oct 2026.' && v.reason === tooEarly, JSON.stringify({ tooEarly, reason: v.reason }));
  await p.fill('#order [name=date]', '2026-10-03');
  check(`${reg}: notice: the earliest day itself is accepted`, (await p.evaluate(() => document.querySelector('#order [name=date]').validationMessage)) === '');

  // a date typed by hand, digit by digit: the form must not rewrite the field under the fingers
  await p.fill('#order [name=date]', '');
  await p.focus('#order [name=date]');
  await p.keyboard.type('04102026');
  const typed = await p.evaluate(() => document.querySelector('#order [name=date]').value);
  check(`${reg}: keyboard: a date typed by hand (04102026) is kept as it is typed`, typed === '2026-10-04', typed || 'empty');

  // everything filled in
  await fillAll(p);
  await p.waitForTimeout(60);
  v = await view(p);
  check(`${reg}: the message is exactly what the seller will read`, v.preview === MESSAGE, v.preview === MESSAGE ? '' : JSON.stringify(v.preview));
  check(`${reg}: the link's address decodes to the preview, word for word (emoji, ×, ₹ and line breaks included), to the right number`, v.href && v.decoded === v.preview && v.digits === '919000012345' && v.disabled === null && v.role === null, JSON.stringify({ digits: v.digits, same: v.decoded === v.preview }));
  check(`${reg}: it is a real link that opens WhatsApp in a new tab`, v.target === '_blank' && /noopener/.test(v.rel) && v.label === 'Send on WhatsApp' && v.reason === '' && v.written === '', JSON.stringify({ t: v.target, r: v.rel, l: v.label }));
  check(`${reg}: the message has no markdown WhatsApp would garble, and no em dash`, !/[*_~`]/.test(v.preview) && !/[—–]/.test(v.preview) && !/^[#>]/m.test(v.preview));

  // changing a field changes the link, not just the preview
  await p.fill('#order [name=name]', 'Anjali Kamat');
  v = await view(p);
  check(`${reg}: changing the name changes the link too (the address always equals the preview)`, v.decoded === v.preview && /Name: Anjali Kamat/.test(v.decoded), JSON.stringify(v.decoded?.split('\n').filter(l => l.startsWith('Name'))));
  await p.fill('#order [name=name]', 'Anjali');

  // pickup, by keyboard
  await p.focus('#order input[type=radio]:checked');
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(60);
  v = await view(p);
  const areaHidden = await p.evaluate(() => document.querySelector('#order [name=area]').closest('sg-field').hidden);
  check(`${reg}: pickup (arrow key on the radio) hides the area, drops the address from the message, and the link stays good`, areaHidden && /^Pickup: I will collect it$/m.test(v.preview) && !/Porvorim|Delivery/.test(v.preview) && v.href && v.decoded === v.preview, JSON.stringify(v.preview.split('\n').slice(7, 10)));
  await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(60);
  v = await view(p);
  check(`${reg}: back to delivery brings the area back, with what was typed`, v.preview === MESSAGE && v.decoded === MESSAGE);

  // the tap: opens WhatsApp (stubbed), and says honestly what happened
  const popup = ctx.waitForEvent('page');
  await p.evaluate(() => { window.__opened = []; document.getElementById('order').addEventListener('sg-wa-open', e => window.__opened.push(e.detail)); });
  await p.click('#order a.sg-wa-send');
  const pop = await popup;
  await pop.waitForLoadState('domcontentloaded').catch(() => {});
  const popUrl = pop.url();
  await pop.close();
  await p.waitForTimeout(80);
  v = await view(p);
  const opened = await p.evaluate(() => window.__opened);
  check(`${reg}: the tap opens that exact link in WhatsApp's address`, popUrl === v.href, popUrl.slice(0, 60));
  check(`${reg}: honest line: it says the order is written and must be sent, never that it is placed`, v.written === "Your order is written; send it in WhatsApp and we'll confirm." && !/placed|confirmed|received|booked/i.test(v.written + v.preview + (await p.evaluate(() => document.getElementById('order').textContent.replace(/\s+/g, ' ')))), v.written);
  check(`${reg}: sg-wa-open tells the page what was handed over`, opened.length === 1 && opened[0].text === MESSAGE && opened[0].lines.length === 2 && opened[0].total === 1420 && opened[0].href === v.href, JSON.stringify(opened[0] && { n: opened[0].lines.length, t: opened[0].total }));
  await p.fill('#order [name=notes]', 'Ring twice please 🍝, and thank you');
  check(`${reg}: change the order after sending and the "written" line goes, since it no longer matches`, (await view(p)).written === '');
  await p.fill('#order [name=notes]', 'Ring twice please 🍝');

  // the menu changing under it
  await p.click('#menu [data-id=pesto] .sg-menu-plus');
  await p.waitForTimeout(60);
  v = await view(p);
  check(`${reg}: a dish added in the menu reaches the message and the link at once`, /1 × Walnut pesto \(1 jar, veg, contains nuts\): ₹340/.test(v.preview) && /Estimated total: ₹1,760\./.test(v.preview) && v.decoded === v.preview);
  await p.click('#menu .sg-menu-clear');
  await p.waitForTimeout(60);
  v = await view(p);
  check(`${reg}: starting again in the menu empties the message and takes the link away`, !v.href && v.empty && v.reason === 'Choose something from the menu first.' && v.menuLink === '#menu', JSON.stringify({ href: v.href, r: v.reason }));

  // a register swap keeps what was typed
  await p.click('#menu [data-id=fettuccine] .sg-menu-plus');
  await p.evaluate(r => { document.documentElement.dataset.register = r === 'quiet' ? 'warm' : 'quiet'; }, reg);
  await p.waitForTimeout(500);
  check(`${reg}: a register change keeps the fields, and the message`, await p.evaluate(() => document.querySelector('#order [name=name]').value === 'Anjali' && document.querySelector('#order [name=area]').value === 'Porvorim' && document.querySelector('#order .sg-wa-text').textContent.includes('1 × Fresh fettuccine')));

  if (reg === 'warm') {
    await p.evaluate(() => { document.documentElement.dataset.register = 'warm'; });
    await p.waitForFunction(() => document.getElementById('order').dataset.skin === 'warm');
    await p.waitForTimeout(300);
    const w = await p.evaluate(() => { const o = document.getElementById('order'); const r = o.querySelector('.sg-wa-rule'); const t = o.querySelector('.sg-wa-title').getBoundingClientRect(); const rb = r?.getBoundingClientRect(); return { rule: !!r, paths: r?.querySelectorAll('path').length, hidden: r?.getAttribute('aria-hidden'), gap: rb ? Math.round(rb.top - t.bottom) : null, font: getComputedStyle(o.querySelector('.sg-wa-text')).fontFamily.split(',')[0] }; });
    check('warm: the message is on ruled paper in the hand, its title ruled under by hand (drawn beside the heading, not in it)', w.rule && w.paths === 1 && w.hidden === 'true' && Math.abs(w.gap) <= 12 && /Kalam/.test(w.font), JSON.stringify(w));
  }
  check(`${reg}: no console errors`, p.errors.length === 0, p.errors.join(' | '));
  if (shots) {
    await p.evaluate(() => { document.querySelector('#order').scrollIntoView(); });
    await p.screenshot({ path: `.shots/wa-order/${reg}-1280.png` });
  }
  await ctx.close();
}

// ── A composer with a menu nested inside it needs no `for` ──
{
  const ctx = await ctxFor({ viewport: { width: 900, height: 900 } });
  const p = await open(ctx, 'quiet');
  const r = await p.evaluate(async () => {
    const o = document.createElement('sg-wa-order');
    o.setAttribute('number', '98765 43210'); o.setAttribute('business', 'Tea Stall'); o.setAttribute('areas', 'Anjuna');
    const m = document.createElement('sg-menu'); m.setAttribute('orderable', '');
    o.append(m);
    document.body.append(o);
    m.items = [{ items: [{ name: 'Masala chai', price: 20, unit: 'a cup' }] }];
    await new Promise(r => setTimeout(r, 100));
    m.querySelector('.sg-menu-plus').click();
    await new Promise(r => setTimeout(r, 100));
    const t = o.querySelector('.sg-wa-text').textContent;
    const out = { text: t, digits: o.querySelector('a.sg-wa-send') ? 'link' : null, noFor: !o.hasAttribute('for') };
    o.remove();
    return out;
  });
  check('a nested <sg-menu> is read without `for`; a bare 10-digit Indian number is understood', r.noFor && r.text.startsWith('Hello Tea Stall! I would like to order:\n\n1 × Masala chai (a cup): ₹20'), JSON.stringify(r.text.slice(0, 90)));
  await ctx.close();
}

// ── Playful: "written" stamps in once; reduced motion is still ──
async function sendOnce(p) {
  await p.click('#menu [data-id=fettuccine] .sg-menu-plus');
  await fillAll(p, { date: '2026-10-04' });
  await p.waitForTimeout(60);
  await p.evaluate(() => document.querySelector('#order a.sg-wa-send').addEventListener('click', e => e.preventDefault()));
  await p.click('#order a.sg-wa-send');
}
for (const reduced of [false, true]) {
  const ctx = await ctxFor({ viewport: { width: 1280, height: 1100 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await open(ctx, 'playful');
  await sendOnce(p);
  const anims = await p.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.closest?.('sg-wa-order')).map(a => ({ target: a.effect.target.className, dur: a.effect.getTiming().duration, iter: a.effect.getTiming().iterations })));
  if (!reduced) {
    check('playful: the "written" line stamps in once (one short animation, a finite run)', anims.length === 1 && anims[0].target === 'sg-wa-written' && anims[0].iter === 1 && anims[0].dur <= 400, JSON.stringify(anims));
    await p.waitForTimeout(600);
    check('playful: and it is over (nothing left running)', (await p.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.closest?.('sg-wa-order')).length)) === 0);
  } else {
    check('reduced motion: playful says it is written with no animation at all', anims.length === 0, JSON.stringify(anims));
  }
  await ctx.close();
}

// ── Contrast, from painted colours: the empty state and a finished order, both themes ──
for (const reg of ['quiet', 'warm', 'playful']) {
  for (const theme of ['light', 'dark']) {
    const ctx = await ctxFor({ viewport: { width: 1280, height: 1100 } });
    const p = await open(ctx, reg, `&theme=${theme}`);
    const empty = await contrastReport(p, 'sg-wa-order#order', { ruled: 'sg-field textarea' });
    await p.click('#menu [data-id=fettuccine] .sg-menu-plus');
    await fillAll(p);
    await p.evaluate(() => document.querySelector('#order a.sg-wa-send').addEventListener('click', e => e.preventDefault()));
    await p.click('#order a.sg-wa-send');
    await p.waitForTimeout(500);
    const done = await contrastReport(p, 'sg-wa-order#order', { ruled: 'sg-field textarea' });
    const bad = [...empty.failures, ...done.failures], skipped = [...empty.skipped, ...done.skipped];
    check(`contrast ${reg}/${theme}: empty and finished states meet 4.5:1 (3:1 when large), from painted colours`, empty.checked > 12 && done.checked > 20 && bad.length === 0 && skipped.length === 0,
      `${empty.checked}+${done.checked} measured${bad[0] ? `, failing: ${JSON.stringify(bad.slice(0, 3))}` : ''}${skipped[0] ? `, unmeasured: ${skipped[0].path} (${skipped[0].why})` : ''}`);
    await ctx.close();
  }
}

// ── axe on the states a person meets: nothing chosen, an order half-written, a finished one ──
for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await ctxFor({ viewport: { width: 1280, height: 1100 } });
  const p = await open(ctx, reg);
  await p.addScriptTag({ content: AXE });
  const run = () => p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(x => `${x.id}: ${x.nodes.map(n => n.target.join(' ')).slice(0, 2).join(' | ')}`));
  const states = { empty: await run() };
  await p.click('#menu [data-id=fettuccine] .sg-menu-plus');
  await p.focus('#order a.sg-wa-send'); await p.keyboard.press('Enter'); // too early: the date is flagged
  await p.waitForTimeout(100);
  states.flagged = await run();
  await fillAll(p);
  await p.evaluate(() => document.querySelector('#order a.sg-wa-send').addEventListener('click', e => e.preventDefault()));
  await p.click('#order a.sg-wa-send');
  await p.waitForTimeout(400);
  states.written = await run();
  const all = Object.entries(states).flatMap(([k, v]) => v.map(x => `${k}: ${x}`));
  check(`axe ${reg}: nothing chosen, flagged, and written states have no violations (WCAG 2.2 AA)`, all.length === 0, all.join('; '));
  await ctx.close();
}

// ── The phone ──
{
  const ctx = await ctxFor({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  for (const reg of ['quiet', 'warm', 'playful']) {
    const p = await open(ctx, reg);
    await p.tap('#menu [data-id=fettuccine] .sg-menu-plus');
    await p.tap('#menu [data-id=fettuccine] .sg-menu-plus');
    await p.tap('#menu .sg-menu-continue');
    await p.waitForTimeout(150);
    await fillAll(p, { notes: 'Ring twice' });
    await p.waitForTimeout(80);
    const r = await p.evaluate(() => {
      const o = document.getElementById('order');
      const box = e => e.getBoundingClientRect();
      const a = o.querySelector('a.sg-wa-send');
      const fields = [...o.querySelectorAll('input:not([type=radio]), select, textarea')].filter(e => e.getClientRects().length);
      return { overflow: document.documentElement.scrollWidth - innerWidth, linkH: Math.round(box(a).height), linkW: Math.round(box(a).width), href: !!a.getAttribute('href'), widest: Math.round(Math.max(...fields.map(f => box(f).right))), minH: Math.round(Math.min(...fields.map(f => box(f).height))), radios: [...o.querySelectorAll('.sg-wa-choice')].map(c => Math.round(box(c).height)) };
    });
    check(`phone ${reg}: nothing scrolls sideways, every field fits and is 44 px tall, the send link is wide and 48 px tall`, r.overflow <= 0 && r.widest <= 390 && r.minH >= 44 && r.linkH >= 48 && r.linkW >= 300 && r.href && r.radios.every(h => h >= 44), JSON.stringify(r));
    await p.tap('#order a.sg-wa-send', { noWaitAfter: true });
    await p.waitForTimeout(150);
    for (const pg of ctx.pages()) if (pg !== p && pg.url().startsWith('https://wa.me/')) await pg.close();
    if (shots) { await p.evaluate(() => document.querySelector('#order').scrollIntoView()); await p.screenshot({ path: `.shots/wa-order/${reg}-390.png` }); }
    await p.close();
  }
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter(r => !r.ok).length;
const expected = BREAK ? BREAKS[BREAK].map(([f]) => `${BREAK}:${f}`) : [];
const allServed = expected.every(k => served.has(k));
console.log(`${results.length - failed}/${results.length} wa-order checks pass${BREAK ? ` (--break=${BREAK}: ${allServed ? 'the break was served' : 'THE BREAK WAS NEVER SERVED'})` : ''}`);
if (BREAK && !allServed) process.exit(2);
process.exit(failed ? 1 : 0);
