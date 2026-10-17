// Browser checks for <sg-field>: keyboard, the ink, the count, and the page
// without JavaScript. Run by hand or with `npm run check`:
//
//   node packages/components/field/field.check.mjs

import { harness } from '../../../tools/lib/component-check.mjs';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';

const h = await harness({ axe: "tools/smoke.mjs axes /packages/components/field/demo.html once, at 1280 px in the default register and light theme; the other registers, the dark theme and the states this check opens are not axe-checked, and the pages it builds itself are in no axe check (docs/DEBT.md row 48)" });
const { server, check } = h;

const PAGE = `
  <form id="f" action="/tools/harness/blank.html" method="get">
    <sg-field><label>Your name</label><input name="name" autocomplete="off"></sg-field>
    <sg-field><label for="code">Booking code</label><input id="code" name="code" maxlength="12"></sg-field>
    <sg-field><label for="msg">Anything else</label><textarea id="msg" name="message" rows="4"></textarea></sg-field>
    <button id="send">Send</button>
  </form>`;

const SELECT_PAGE = `
  <form id="f" action="/tools/harness/blank.html" method="get">
    <sg-field><label for="town">Town</label>
      <select id="town" name="town"><option value="">Choose a town</option><option value="a-03">Aldona</option><option value="s-17">Siolim</option></select></sg-field>
    <sg-field><label for="nm">Your name</label><input id="nm" name="name"></sg-field>
    <sg-field><label>Just a note</label><p>No control in here, so nothing to ink.</p></sg-field>
  </form>`;

async function open({ register = 'warm', js = true, reduced = false, html = PAGE } = {}) {
  const ctx = await h.context({ javaScriptEnabled: js, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (!js) {
    // no scripts at all: a static page with the markup and the stylesheets
    await p.route('**/nojs.html', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en" data-register="quiet"><head><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/field/field.css"></head><body>${PAGE}</body></html>` }));
    await p.goto(`${server.url}/nojs.html`);
    return { ctx, p, errors };
  }
  await p.goto(`${server.url}/tools/harness/blank.html`);
  await p.evaluate(async ({ html, register }) => {
    document.documentElement.dataset.register = register;
    document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/field/field.css">');
    document.body.innerHTML = html;
    await import('/packages/components/field/field.js');
    await customElements.whenDefined('sg-field');
    await new Promise(r => document.querySelector('sg-field').addEventListener('sg-skin', r, { once: true }));
  }, { html, register });
  return { ctx, p, errors };
}

const inkOf = (p, sel) => p.evaluate(s => {
  const f = document.querySelector(s).closest('sg-field');
  const paths = [...f.querySelectorAll('.sg-field-words path')]; // the ink under the words, not the pencil rule or the focus ink
  return { n: paths.length, d: paths.map(x => x.getAttribute('d')).join('|'), w: paths.map(x => Math.round(x.getBBox().width)), hidden: f.querySelector('.sg-field-ink')?.getAttribute('aria-hidden') };
}, sel);

// ── warm: keyboard and ink ──
{
  const { ctx, p, errors } = await open({ register: 'warm' });
  const rest = await p.evaluate(() => {
    const f = document.querySelector('sg-field'), i = f.querySelector('input'), focus = f.querySelector('.sg-field-focus');
    return { pencil: f.querySelectorAll('.sg-field-pencil path').length, border: getComputedStyle(i).borderBottomColor, focus: getComputedStyle(focus).display,
      margin: document.querySelectorAll('#msg ~ .sg-field-ink .sg-field-margin, sg-field:has(#msg) .sg-field-margin').length };
  });
  check('warm at rest: the rule is drawn in pencil, two passes, and the CSS rule steps aside', rest.pencil === 2 && rest.border === 'rgba(0, 0, 0, 0)' && rest.focus === 'none', JSON.stringify(rest));
  check('warm: a textarea gets the exercise-book margin', rest.margin === 1, `${rest.margin}`);
  await p.focus('input[name=name]');
  const focused = await p.evaluate(() => { const e = document.querySelector('sg-field .sg-field-focus'); return { shown: getComputedStyle(e).display !== 'none', anims: e.getAnimations().length }; });
  check('warm: focus inks the whole rule, drawn in from the left', focused.shown && focused.anims === 1, JSON.stringify(focused));
  await p.mouse.click(2, 2); // away, and Tab starts again from the top
  await p.waitForTimeout(40);
  const linked = await p.evaluate(() => { const i = document.querySelector('input[name=name]'); return i.labels.length === 1 && i.labels[0].textContent; });
  check('a label without `for` is linked to its field', linked === 'Your name', String(linked));
  await p.keyboard.press('Tab');
  await p.keyboard.type('Sarat');
  check('Tab reaches the field and typing goes in', await p.evaluate(() => document.activeElement.name === 'name' && document.activeElement.value === 'Sarat'));
  const ink = await inkOf(p, 'input[name=name]');
  const textW = await p.evaluate(() => { const i = document.querySelector('input[name=name]'); const c = document.createElement('canvas').getContext('2d'); const cs = getComputedStyle(i); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return Math.round(c.measureText(i.value).width); });
  check('warm: the rule inks as far as the words go', ink.n === 1 && Math.abs(ink.w[0] - textW) <= 2, `ink ${ink.w[0]} px, words ${textW} px`);
  check('the ink is hidden from assistive technology', ink.hidden === 'true');
  await p.keyboard.type(' Chandran');
  const longer = await inkOf(p, 'input[name=name]');
  check('more words, more ink', longer.w[0] > ink.w[0], `${ink.w[0]} to ${longer.w[0]}`);
  await p.keyboard.press('Tab');
  await p.keyboard.type('VQ-2026');
  let count = await p.evaluate(() => document.querySelector('.sg-field-count')?.textContent);
  check('the count shows in the last stretch of a maxlength', count === '5 characters left', count);
  await p.keyboard.type('-10ABCD');
  count = await p.evaluate(() => ({ seen: document.querySelector('.sg-field-count').textContent, heard: document.querySelector('.sg-field-sr').textContent, value: document.getElementById('code').value }));
  check('the maxlength stops typing; the count shows and says "0 characters left"', count.value === 'VQ-2026-10AB' && count.seen === '0 characters left' && count.heard === '0 characters left', JSON.stringify(count));
  await p.keyboard.press('Tab');
  await p.keyboard.type('We are four adults.\nWe would like to arrive after lunch.');
  const area = await inkOf(p, '#msg');
  check('a textarea inks one line per line of words', area.n === 2, `${area.n} lines`);
  await p.evaluate(() => document.getElementById('f').reset());
  await p.waitForTimeout(80);
  const cleared = await inkOf(p, 'input[name=name]');
  check('resetting the form takes the ink away', cleared.n === 0, `${cleared.n}`);
  check('no console or page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}


// ── a select inside sg-field: every register, no page error, the native select stays the control ──
for (const register of ['quiet', 'warm', 'playful']) for (const width of [1280, 390]) {
  const ctx = await h.context({ viewport: { width, height: 800 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${server.url}/tools/harness/blank.html`);
  await p.evaluate(async ({ html, register }) => {
    document.documentElement.dataset.register = register;
    document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/field/field.css">');
    document.body.innerHTML = html;
    await import('/packages/components/field/field.js');
    await customElements.whenDefined('sg-field');
    await Promise.all([...document.querySelectorAll('sg-field')].map(f => new Promise(r => { f.addEventListener('sg-skin', r, { once: true }); setTimeout(r, 2500); }))); // a skin that throws never says sg-skin; the checks below then fail instead of hanging
  }, { html: SELECT_PAGE, register });
  const words = () => p.evaluate(() => { const f = document.querySelector('sg-field'); return [...f.querySelectorAll('.sg-field-words path')].map(x => Math.round(x.getBBox().width)); });
  const rest = await p.evaluate(() => {
    const f = document.querySelector('sg-field'), s = f.querySelector('select');
    return { control: f.control === s, filled: f.hasAttribute('data-filled'), pencil: f.querySelectorAll('.sg-field-pencil path').length, labelled: s.labels.length === 1 };
  });
  const before = await words();
  await p.selectOption('#town', 's-17');
  if (register !== 'quiet') await p.waitForFunction(() => document.querySelector('sg-field .sg-field-words path'), null, { timeout: 3000 }).catch(() => {}); // wait on the ink, not on the clock
  const after = await words();
  const textW = await p.evaluate(() => { const s = document.getElementById('town'); const c = document.createElement('canvas').getContext('2d'); const cs = getComputedStyle(s); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return Math.round(c.measureText(s.selectedOptions[0].text).width); });
  const filled = await p.evaluate(() => document.querySelector('sg-field').hasAttribute('data-filled'));
  const plain = await p.evaluate(() => { const f = document.querySelectorAll('sg-field')[2]; return !f.querySelector('svg') && f.children.length === 2; });
  const page = (await sidewaysScroll(p)).overflow === 0;
  const inked = register !== 'quiet';
  check(`${register} at ${width}px: a select in sg-field loads its skin, stays the labelled control, and throws nothing`, rest.control && rest.labelled && !rest.filled && errors.length === 0, `${JSON.stringify(rest)} ${errors.join(' | ')}`);
  check(`${register} at ${width}px: ${inked ? 'the pencil rule is drawn, and the ink follows the chosen option' : 'the hairline needs no drawing'}`,
    inked ? rest.pencil === 2 && before.length === 0 && after.length === 1 && Math.abs(after[0] - textW) <= 2 && filled : rest.pencil === 0 && after.length === 0 && filled, `pencil ${rest.pencil}, ink ${before.length}->${after}, option ${textW} px`);
  check(`${register} at ${width}px: a sg-field with no supported control stays plain, and the page does not scroll sideways`, plain && page && errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── the select's arrow shows under forced colours too, and radios and checkboxes are left alone ──
const inkPixels = async (p, box) => {
  const png = await p.screenshot({ clip: box });
  return p.evaluate(async b64 => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height }), g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data, bg = [d[0], d[1], d[2]];
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 120) n++;
    return n;
  }, png.toString('base64'));
};
for (const register of ['quiet', 'warm', 'playful']) for (const forced of [false, true]) {
  const ctx = await h.context({ viewport: { width: 700, height: 500 }, forcedColors: forced ? 'active' : 'none' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(`${server.url}/tools/harness/blank.html`);
  await p.evaluate(async ({ html, register }) => {
    document.documentElement.dataset.register = register;
    document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/field/field.css">');
    document.body.innerHTML = html + '<sg-field id="tick"><label><input type="checkbox" name="c"> Send me the menu</input></label></sg-field>';
    await import('/packages/components/field/field.js');
    await customElements.whenDefined('sg-field');
    await new Promise(r => { const f = document.querySelector('sg-field'); f.addEventListener('sg-skin', r, { once: true }); setTimeout(r, 2500); });
  }, { html: SELECT_PAGE, register });
  await p.waitForTimeout(150);
  const box = await p.evaluate(() => { const r = document.getElementById('town').getBoundingClientRect(); return { x: Math.floor(r.right - 40), y: Math.floor(r.top + 4), width: 32, height: Math.floor(r.height - 10) }; });
  const n = await inkPixels(p, box);
  check(`${register}${forced ? ' under forced colours' : ''}: the select's arrow is drawn in its box`, n >= 8, `${n} arrow pixels`);
  if (!forced && register === 'warm') {
    const boxed = await p.evaluate(() => document.getElementById('tick').control === null);
    const rings = await p.evaluate(() => document.querySelectorAll('#tick svg').length);
    check('a checkbox inside sg-field is not taken as its control, so nothing is drawn for it', boxed && rings === 0 && errors.length === 0, `svg ${rings} ${errors.join(' | ')}`);
  }
  await ctx.close();
}

// ── the demo: every note wraps, nothing is clipped, in every register, wide and narrow ──
for (const register of ['quiet', 'warm', 'playful']) for (const width of [1280, 390]) {
  const ctx = await h.context({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${server.url}/packages/components/field/demo.html?register=${register}`);
  await p.waitForFunction(() => window.__ready === true);
  // let the playful note finish writing itself in (a clip-path reveal, not a clip)
  await p.waitForFunction(() => document.getAnimations().filter(a => a.playState === 'running').length === 0, null, { timeout: 5000 }).catch(() => {});
  const r = await p.evaluate(() => {
    const note = document.querySelector('sg-field-note .sg-note-text');
    const field = note.closest('sg-field').getBoundingClientRect(), box = note.getBoundingClientRect();
    return {
      scroll: note.scrollWidth, client: note.clientWidth, clip: getComputedStyle(note).clipPath,
      inside: box.right <= field.right + 1, lines: Math.round(box.height / parseFloat(getComputedStyle(note).lineHeight)),
      fields: [...document.querySelectorAll('sg-field')].filter(f => f.scrollWidth > f.clientWidth + 1).length,
    };
  });
  r.page = (await sidewaysScroll(p)).overflow === 0;
  check(`${register} at ${width}px: the field note wraps inside its field, whole, and no field overflows`, r.scroll <= r.client + 1 && r.clip === 'none' && r.inside && r.fields === 0 && r.page, JSON.stringify(r));
  await ctx.close();
}

// ── playful: the wobble on twos while typing, then still ──
for (const reduced of [false, true]) {
  const { ctx, p } = await open({ register: 'playful', reduced });
  await p.focus('input[name=name]');
  await p.keyboard.type('Susegad');
  const a = (await inkOf(p, 'input[name=name]')).d;
  await p.waitForTimeout(120);
  const b = (await inkOf(p, 'input[name=name]')).d;
  await p.waitForTimeout(900);
  const c = (await inkOf(p, 'input[name=name]')).d;
  await p.waitForTimeout(300);
  const d = (await inkOf(p, 'input[name=name]')).d;
  if (!reduced) check('playful: the ink wobbles while you type', a !== b);
  else check('playful under reduced motion: the ink never wobbles', a === b && b === c);
  check(`playful${reduced ? ' (reduced motion)' : ''}: it settles when you stop`, c === d);
  await ctx.close();
}

// ── no JavaScript: the same label and line, and it submits ──
{
  const { ctx, p } = await open({ js: false });
  await p.click('text=Booking code');
  const focused = await p.evaluate(() => document.activeElement?.id);
  check('without JavaScript, a label with `for` still focuses its field', focused === 'code', focused);
  await p.keyboard.type('VQ-1');
  await p.focus('textarea');
  await p.keyboard.type('Hello');
  const look = await p.evaluate(() => { const cs = getComputedStyle(document.getElementById('code')); return { rule: cs.borderBottomStyle, width: parseFloat(cs.borderBottomWidth) }; });
  check('without JavaScript, the field is the ruled line', look.rule === 'solid' && look.width >= 1, JSON.stringify(look));
  await Promise.all([p.waitForURL(/blank\.html\?/), p.click('#send')]);
  const q = new URL(p.url()).searchParams;
  check('without JavaScript, the form submits every field', q.get('code') === 'VQ-1' && q.get('message') === 'Hello', p.url().split('?')[1]);
  await ctx.close();
}

await h.done();
