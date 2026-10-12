// Browser checks for the native sweep on the text inputs: a textarea grows with what is typed
// (field-sizing: content) to a ceiling, in field and in form, and what a press touches in
// field and form answers within a frame. Run by hand or with `npm run check`:
//
//   node packages/components/field/grow-press.check.mjs
//   node packages/components/field/grow-press.check.mjs --shots     writes .shots/grow-press/
//   node packages/components/field/grow-press.check.mjs --break=<mode>
//
// Break modes (each rewrites one served file, and the run fails if the text to break has moved):
//   no-grow     the textarea does not size to its content          -> "grows"
//   no-ceiling  the textarea has no ceiling                         -> "ceiling"
//   no-press    the submit button has no press state                -> "submit"

import fs from 'node:fs';
import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const BREAK = process.argv.find(a => a.startsWith('--break='))?.slice('--break='.length) ?? '';
const shots = process.argv.includes('--shots');
if (shots) fs.mkdirSync('.shots/grow-press', { recursive: true });
const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const BREAKS = {
  'no-grow': ['field.css', 'field-sizing: content;', 'field-sizing: fixed;'],
  'no-ceiling': ['field.css', 'max-block-size: calc(var(--field-line) * 14 + 0.25rem);', 'max-block-size: none;'],
  'no-press': ['form.css', 'sg-form :is(button:not([type="button"], [type="reset"]), input[type="submit"]):not([aria-disabled="true"], :disabled):active { transition: none; translate: 0 1px; filter: brightness(0.94); }', ''],
};
if (BREAK && !BREAKS[BREAK]) { console.error(`unknown --break mode "${BREAK}"`); process.exit(2); }
let broke = false;
async function ctxFor(opts = {}) {
  const ctx = await browser.newContext(opts);
  if (BREAK) {
    const [file, from, to] = BREAKS[BREAK];
    await ctx.route(u => u.pathname.endsWith(`/${file}`), async route => {
      const res = await route.fetch();
      const body = await res.text();
      if (!body.includes(from)) { console.error(`break "${BREAK}": the text to break is not in ${file} any more`); process.exit(2); }
      broke = true;
      await route.fulfill({ response: res, body: body.replace(from, to) });
    });
  }
  return ctx;
}
async function open(ctx, page, reg) {
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  await p.goto(`${server.url}/packages/components/${page}/demo.html`);
  await p.evaluate(r => { document.documentElement.dataset.register = r; }, reg);
  await p.waitForFunction(r => [...document.querySelectorAll('sg-field, sg-form')].every(e => e.dataset.skin === r), reg, { timeout: 8000 });
  await p.waitForTimeout(300);
  return p;
}
const lines = n => Array.from({ length: n }, (_, i) => `Line ${i + 1} of what I am typing.`).join('\n');
const height = (p, sel) => p.$eval(sel, e => ({ h: Math.round(e.getBoundingClientRect().height), scroll: e.scrollHeight, client: e.clientHeight, max: getComputedStyle(e).maxHeight, fs: getComputedStyle(e).fieldSizing }));

// ── the textarea grows with what is typed, to a ceiling ──
for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await ctxFor({ viewport: { width: 1100, height: 1000 } });
  const p = await open(ctx, 'field', reg);
  await p.fill('#msg', 'One line.');
  const one = await height(p, '#msg');
  await p.fill('#msg', lines(3));
  const three = await height(p, '#msg');
  await p.fill('#msg', lines(8));
  const eight = await height(p, '#msg');
  await p.fill('#msg', lines(60));
  await p.waitForTimeout(100);
  const sixty = await height(p, '#msg');
  check(`${reg}: a field's textarea grows with what is typed (field-sizing: content)`, one.fs === 'content' && eight.h > three.h + 40 && eight.h > one.h + 80, `1 line ${one.h}px, 3 lines ${three.h}px, 8 lines ${eight.h}px`);
  check(`${reg}: a field's textarea has a ceiling, and scrolls inside it`, sixty.h <= 14 * 28 + 4 + 2 && sixty.h >= eight.h && sixty.scroll > sixty.client, `60 lines ${sixty.h}px, scrolls ${sixty.scroll} in ${sixty.client}`);
  if (reg !== 'quiet') {
    // the pencil rules are drawn on the textarea and follow it as it grows
    const ink = await p.$eval('#msg', e => { const f = e.closest('sg-field'); const s = f.querySelector('.sg-field-ink'); return s ? { svg: Math.round(s.getBoundingClientRect().height), area: Math.round(e.getBoundingClientRect().height) } : null; });
    check(`${reg}: the drawn rules follow the textarea's height`, !ink || Math.abs(ink.svg - ink.area) <= 6, JSON.stringify(ink));
  }
  if (shots && reg === 'quiet') {
    await p.setViewportSize({ width: 390, height: 844 });
    await p.fill('#msg', lines(3));
    await p.waitForTimeout(150);
    await p.locator('#msg').scrollIntoViewIfNeeded();
    await p.screenshot({ path: '.shots/grow-press/field-textarea-3-lines-quiet-390.png' });
    await p.fill('#msg', lines(7));
    await p.waitForTimeout(150);
    await p.locator('#msg').scrollIntoViewIfNeeded();
    await p.screenshot({ path: '.shots/grow-press/field-textarea-7-lines-quiet-390.png' });
  }
  await ctx.close();
}

// ── a bare textarea in a form grows too, and field's does not fight it ──
{
  const ctx = await ctxFor({ viewport: { width: 900, height: 900 } });
  const p = await open(ctx, 'form', 'warm');
  await p.evaluate(() => {
    const f = document.querySelector('#idle form');
    const t = document.createElement('textarea'); t.id = 'bare'; t.name = 'bare'; t.setAttribute('aria-label', 'Bare');
    f.prepend(t);
  });
  await p.fill('#bare', 'One line.');
  const one = await height(p, '#bare');
  await p.fill('#bare', lines(10));
  const ten = await height(p, '#bare');
  await p.fill('#bare', lines(80));
  const eighty = await height(p, '#bare');
  check('a bare textarea in a form grows with what is typed', one.fs === 'content' && ten.h > one.h + 60, `${one.h}px -> ${ten.h}px`);
  // the ceiling is 20em of the textarea's own font (form.css), around which sit its padding and border; a bare textarea has the
  // browser's default font, whose size differs by platform (13.3 px on Windows, 16 px on Linux), so measure against what it has
  const box = await p.evaluate(() => { const cs = getComputedStyle(document.getElementById('bare')); return { em: parseFloat(cs.fontSize), around: ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((n, k) => n + parseFloat(cs[k]), 0) }; });
  check('a bare textarea in a form has a ceiling', eighty.h <= 20 * box.em + box.around + 1 && eighty.scroll > eighty.client, `${eighty.h}px, 20em of ${box.em}px plus ${box.around}px around it`);
  await ctx.close();
}

// ── the press ──
async function press(p, sel) {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  const read = () => el.evaluate(e => { const cs = getComputedStyle(e); return { translate: cs.translate, scale: cs.scale, bg: cs.backgroundColor, filter: cs.filter, dur: cs.transitionDuration }; });
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
for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await ctxFor({ viewport: { width: 1100, height: 1000 } });
  const fp = await open(ctx, 'form', reg);
  const f = await press(fp, '#idle button');
  const move = reg === 'quiet' ? f.down.translate === '0px 1px' : reg === 'playful' ? f.down.scale === '0.97' : f.down.translate === 'none' && f.down.scale === 'none';
  check(`${reg}: the form's submit button moves as the contract says on press (quiet 1 px, warm none, playful 0.97)`, f.rest.translate === 'none' && move, `rest ${f.rest.translate}/${f.rest.scale}, down ${f.down.translate}/${f.down.scale}`);
  check(`${reg}: the form's submit button shades in the next frame, with no transition in`, f.down.filter !== f.rest.filter && parseFloat(f.down.dur) === 0, `${f.rest.filter} -> ${f.down.filter}, in ${f.down.dur}`);
  check(`${reg}: the form's submit button lets go in 150 ms or less`, Math.max(...f.rest.dur.split(',').map(parseFloat)) <= 0.15, f.rest.dur);
  const sp = await open(ctx, 'field', reg);
  if (await sp.locator('sg-field select').count()) {
    const s = await press(sp, 'sg-field select');
    check(`${reg}: a field's select shades in the next frame`, s.down.bg !== s.rest.bg && parseFloat(s.down.dur) === 0, `${s.rest.bg} -> ${s.down.bg}`);
  }
  await ctx.close();
}
{
  const ctx = await ctxFor({ viewport: { width: 1100, height: 1000 }, reducedMotion: 'reduce' });
  const fp = await open(ctx, 'form', 'playful');
  const f = await press(fp, '#idle button');
  check('playful reduced motion: the submit press keeps the shade and drops the movement', f.down.filter !== f.rest.filter && f.down.translate === 'none' && f.down.scale === 'none', `${f.down.translate}/${f.down.scale}/${f.down.filter}`);
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} grow-press checks pass${BREAK ? ` (--break=${BREAK}: ${broke ? 'the break was served' : 'THE BREAK WAS NEVER SERVED'})` : ''}`);
if (BREAK && !broke) process.exit(2);
process.exit(failed ? 1 : 0);
