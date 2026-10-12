// Browser checks for <sg-qr>: the rendered modules are the core's matrix, a screenshot of the plate decodes
// (jsQR, dark on light only) in every register, theme, width and in forced colours, the plate stays light in dark
// mode, the words beside it select and wrap, the label is the picture's name, axe on every register and theme,
// the frame draws on in playful only and never under reduced motion, a value that will not fit leaves the words
// and says so, and nothing is missing without JavaScript. Each probe that could pass by accident also runs on a
// broken copy to show it can fail.
//
//   node packages/components/qr/qr.check.mjs                 (SG_ENGINE=webkit or firefox for the others)

import jsQR from 'jsqr';
import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';
import { encode, pathData } from './qr.core.js';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';

const { server, browser, engine, check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/qr/demo.html';
const REGISTERS = ['quiet', 'warm', 'playful'];
const IDS = ['upi', 'wifi', 'ticket', 'indic'];

const ready = (page, register) => page.waitForFunction(r => {
  const all = [...document.querySelectorAll('sg-qr')];
  return all.length && all.every(e => e.dataset.skin === r && e.symbol);
}, register, { timeout: 10000 });

/** A screenshot of `selector` as RGBA pixels, read back through a canvas in the page. */
async function pixels(page, selector) {
  const png = await page.locator(selector).screenshot();
  const b64 = await page.evaluate(async src => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const bytes = new Uint8Array(g.getImageData(0, 0, c.width, c.height).data.buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { w: c.width, h: c.height, b64: btoa(s) };
  }, 'data:image/png;base64,' + png.toString('base64'));
  return { w: b64.w, h: b64.h, data: new Uint8ClampedArray(Buffer.from(b64.b64, 'base64')) };
}
/** What a phone camera would make of it: dark modules on a light ground only, no inverted codes. */
const scan = px => jsQR(px.data, px.w, px.h, { inversionAttempts: 'dontInvert' })?.data ?? null;
const lum = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
/** Contrast between the lightest and the darkest 5th percentile of the pixels in the picture. */
function contrast(px) {
  const ls = [];
  for (let i = 0; i < px.data.length; i += 4) ls.push(lum(px.data[i], px.data[i + 1], px.data[i + 2]));
  ls.sort((a, b) => a - b);
  const lo = ls[Math.floor(ls.length * 0.05)], hi = ls[Math.floor(ls.length * 0.95)];
  return (hi + 0.05) / (lo + 0.05);
}
const info = page => page.evaluate(() => [...document.querySelectorAll('sg-qr')].map(e => ({
  id: e.id, value: e.value, ecc: e.getAttribute('ecc'), rows: e.symbol?.rows ?? null,
  d: e.querySelector('.sg-qr-dark')?.getAttribute('d') ?? null, viewBox: e.querySelector('.sg-qr-code')?.getAttribute('viewBox') ?? null,
})));

// ── the picture is the core's matrix ────────────────────────────────────
{
  const { ctx, page, errors } = await open(`${DEMO}?register=quiet`);
  await ready(page, 'quiet');
  const els = await info(page);
  let same = true, detail = [];
  for (const e of els) {
    const want = encode(e.value, { ecc: e.ecc ?? 'M' }), p = pathData(want.rows);
    const grid = Array.from({ length: want.size }, () => Array(want.size).fill('0'));
    for (const [, x, y, w] of e.d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) for (let i = 0; i < +w; i++) grid[+y - 4][+x - 4 + i] = '1';
    const ok = e.d === p.d && e.viewBox === `0 0 ${p.size} ${p.size}` && grid.map(r => r.join('')).join() === want.rows.join() && e.rows.join() === want.rows.join();
    if (!ok) same = false;
    detail.push(`${e.id} v${want.version} ${want.size}x${want.size}`);
  }
  check('every drawn SVG path equals the Node core matrix (module for module, with its quiet zone)', same && els.length === 4, detail.join(', '));
  check('no console or page errors', !errors.length, errors.join(' | '));

  // the control: a path with one module missing must not pass the same comparison
  const want = encode(els[0].value, { ecc: els[0].ecc ?? 'M' });
  check('control: the comparison fails when one module is flipped', pathData(want.rows.map((r, y) => (y === 9 ? r.replace(/^(.{9})./, (_, a) => a + (r[9] === '1' ? '0' : '1')) : r))).d !== els[0].d);
  await ctx.close();
}

// ── scanning: every register, both themes, desktop and phone ────────────
for (const register of REGISTERS) for (const theme of ['light', 'dark']) for (const [name, width] of [['desktop', 1280], ['phone', 390]]) {
  const { ctx, page } = await open(`${DEMO}?register=${register}&theme=${theme}`, { width, height: 900, touch: width < 500 });
  await ready(page, register);
  await settle(page);
  const els = await info(page);
  const results = [];
  for (const e of els) {
    const px = await pixels(page, `#${e.id} .sg-qr-plate`);
    results.push({ id: e.id, ok: scan(px) === e.value, contrast: contrast(px).toFixed(1) });
  }
  check(`${register} / ${theme} / ${name}: the plate, frame and all, decodes to its value (dark on light only)`, results.every(r => r.ok), results.map(r => `${r.id} ${r.ok ? 'ok' : 'NO'} c${r.contrast}`).join(', '));
  const code = await pixels(page, '#upi .sg-qr-code');
  check(`${register} / ${theme} / ${name}: the modules sit on a light ground, contrast at least 10:1`, contrast(code) >= 10, `${contrast(code).toFixed(1)}:1`);
  await ctx.close();
}

// ── the checks can fail ────────────────────────────────────────────────
{
  const { ctx, page } = await open(`${DEMO}?register=warm&theme=dark`);
  await ready(page, 'warm');
  await page.addStyleTag({ content: 'sg-qr { --sg-qr-light: #14110e !important; --sg-qr-dark: #fcf6e6 !important; }' });
  const px = await pixels(page, '#upi .sg-qr-plate');
  check('control: an inverted plate (light modules on dark) does not scan, and the scan check says so', scan(px) === null);
  await page.addStyleTag({ content: 'sg-qr { --sg-qr-light: #777 !important; --sg-qr-dark: #5c5c5c !important; }' });
  check('control: a grey-on-grey plate fails the 10:1 contrast check', contrast(await pixels(page, '#upi .sg-qr-code')) < 10);
  await ctx.close();
}

// ── forced colours ─────────────────────────────────────────────────────
for (const register of REGISTERS) {
  let ctx;
  try {
    ctx = await browser.newContext(contextOptions(engine, { forcedColors: 'active', viewport: { width: 1280, height: 900 } }));
  } catch (e) { check(`${register}, forced colours: this engine does not offer the setting`, false, String(e.message).split('\n')[0]); continue; }
  const page = await ctx.newPage();
  await page.goto(`${server.url}${DEMO}?register=${register}&theme=dark`);
  await page.waitForFunction(() => window.__ready !== false);
  await ready(page, register);
  await settle(page);
  const fc = await page.evaluate(() => ({
    mq: matchMedia('(forced-colors: active)').matches,
    light: getComputedStyle(document.querySelector('#upi .sg-qr-light')).fill, dark: getComputedStyle(document.querySelector('#upi .sg-qr-dark')).fill,
    plate: getComputedStyle(document.querySelector('#upi .sg-qr-plate')).backgroundColor, border: getComputedStyle(document.querySelector('#upi .sg-qr-plate')).borderTopColor,
    bg: getComputedStyle(document.body).backgroundColor,
  }));
  const px = await pixels(page, '#upi .sg-qr-plate');
  check(`${register}, forced colours (${fc.mq ? 'active' : 'NOT active'}): the plate keeps dark modules on a light ground and still decodes`, fc.mq && scan(px) === (await info(page))[0].value && contrast(px) >= 10, `fill ${fc.dark} on ${fc.light}, plate ${fc.plate}, border ${fc.border}, page ${fc.bg}, contrast ${contrast(px).toFixed(1)}`);
  await ctx.close();
}

// ── the size floor: two CSS px per module, so the smallest plate still scans at 1x ──
for (const register of REGISTERS) {
  const { ctx, page } = await open(`${DEMO}?register=${register}&theme=dark`, { width: 1280, height: 900 });
  await ready(page, register);
  await page.evaluate(() => document.querySelectorAll('sg-qr').forEach(e => e.setAttribute('size', '1')));
  await page.waitForTimeout(100);
  await settle(page);
  const els = await info(page), out = [];
  for (const e of els) {
    const m = await page.evaluate(id => { const q = document.querySelector(`#${id}`), s = q.querySelector('.sg-qr-code').getBoundingClientRect(); return { plate: q.querySelector('.sg-qr-plate').getBoundingClientRect().width, code: s.width, units: +q.style.getPropertyValue('--sg-qr-units') }; }, e.id);
    const px = await pixels(page, `#${e.id} .sg-qr-plate`);
    out.push({ id: e.id, pitch: +(m.code / m.units).toFixed(2), ok: scan(px) === e.value });
  }
  check(`${register}: size="1" is raised to the floor, every module is at least 2 px, and all four codes still decode at 1x`, out.every(o => o.ok && o.pitch >= 2), out.map(o => `${o.id} ${o.pitch}px ${o.ok ? 'ok' : 'NO'}`).join(', '));
  if (register === 'warm') {
    await page.addStyleTag({ content: 'sg-qr .sg-qr-plate { min-width: 0 !important; }' });
    await page.waitForTimeout(100);
    const m = await page.evaluate(() => { const q = document.querySelector('#indic'); return q.querySelector('.sg-qr-plate').getBoundingClientRect().width; });
    const px = await pixels(page, '#indic .sg-qr-plate');
    check('control: without the floor the same size="1" plate is a few pixels wide and does not scan', m < 20 && scan(px) === null, `${m}px`);
  }
  await ctx.close();
}
{
  const { ctx, page } = await open(`${DEMO}?register=quiet`, { width: 390, height: 900, touch: true });
  await ready(page, 'quiet');
  const r = await page.evaluate(() => { const e = document.querySelector('#upi'), p = e.querySelector('.sg-qr-plate').getBoundingClientRect(), h = e.getBoundingClientRect(); return { plateMid: p.left + p.width / 2, hostMid: h.left + h.width / 2 }; });
  check('phone: the plate is centred on its own line', Math.abs(r.plateMid - r.hostMid) < 1, JSON.stringify(r));
  await ctx.close();
}

// ── layout: beside on a laptop, below on a phone; no sideways scroll ────
{
  const { ctx, page } = await open(`${DEMO}?register=warm`, { width: 1280, height: 900 });
  await ready(page, 'warm');
  const r = await page.evaluate(() => {
    const e = document.querySelector('#upi'), p = e.querySelector('.sg-qr-plate').getBoundingClientRect(), t = e.querySelector('.sg-qr-text').getBoundingClientRect();
    return { plateW: p.width, plateH: p.height, gap: t.left - p.right, textTop: t.top, plateTop: p.top, plateBottom: p.bottom, textBottom: t.bottom };
  });
  check('desktop: the words sit beside the plate (left edge 16 px or more past its right edge) and the plate is a 192 px square',
    r.gap >= 16 && Math.abs(r.plateW - 192) < 0.6 && Math.abs(r.plateH - r.plateW) < 0.6 && r.textTop < r.plateBottom, JSON.stringify(r));
  await ctx.close();
}
for (const width of [390, 320]) {
  const { ctx, page } = await open(`${DEMO}?register=playful&theme=dark`, { width, height: 900, touch: true });
  await ready(page, 'playful');
  await settle(page);
  const r = await page.evaluate(() => {
    const e = document.querySelector('#upi'), p = e.querySelector('.sg-qr-plate').getBoundingClientRect(), t = e.querySelector('.sg-qr-text').getBoundingClientRect(), host = e.getBoundingClientRect();
    return { plate: [p.left, p.top, p.width, p.height].map(Math.round), textTop: Math.round(t.top), plateBottom: Math.round(p.bottom), textLeft: Math.round(t.left), textRight: Math.round(t.right), hostRight: Math.round(host.right),
      overflow: 0, vw: 0 };
  });
  const o = await sidewaysScroll(page);
  r.overflow = o.overflow; r.vw = o.viewWidth;
  check(`${width} px: the words wrap below the plate, nothing scrolls sideways, the text stays inside the card`,
    r.textTop >= r.plateBottom + 12 && r.overflow <= 0 && r.textRight <= r.hostRight + 1 && r.plate[0] + r.plate[2] <= r.vw - 16, JSON.stringify(r));
  await ctx.close();
}
{
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>t</title>
<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/qr/qr.css"><script type="module" src="/packages/components/qr/qr.js"></script></head>
<body style="margin:0;padding:16px"><sg-qr id="long" value="upi://pay?pa=casaexemplo@okaxis&pn=Casa%20Exemplo&am=25500.00&cu=INR" label="QR code for the UPI payment link"><p>upi://pay?pa=casaexemplo@okaxis&amp;pn=Casa%20Exemplo&amp;am=25500.00&amp;cu=INR</p></sg-qr></body></html>`;
  const { ctx, page } = await openHtml('long-link', html, { width: 320, height: 800, touch: true });
  await page.waitForFunction(() => document.querySelector('#long')?.dataset.skin);
  const r = { overflow: (await sidewaysScroll(page)).overflow, ...(await page.evaluate(() => ({ t: document.querySelector('.sg-qr-text').scrollWidth - document.querySelector('.sg-qr-text').clientWidth }))) };
  check('a 70-character link with no spaces wraps inside a 320 px screen', r.overflow <= 0 && r.t <= 0, JSON.stringify(r));
  await ctx.close();
}

// ── words: selectable, and the label is the picture's name ─────────────
{
  const { ctx, page } = await open(`${DEMO}?register=quiet`);
  await ready(page, 'quiet');
  const r = await page.evaluate(() => {
    const t = document.querySelector('#upi .sg-qr-text'), sel = getSelection();
    sel.removeAllRanges();
    const range = document.createRange(); range.selectNodeContents(t); sel.addRange(range);
    const imgs = [...document.querySelectorAll('[role="img"]')];
    return { selected: sel.toString(), us: getComputedStyle(t).userSelect, imgs: imgs.length, names: imgs.map(i => i.getAttribute('aria-label')), frames: document.querySelectorAll('.sg-qr-frame').length, ticketName: document.querySelector('#ticket svg').getAttribute('aria-label') };
  });
  check('the words beside the code select as real text, with the UPI address in them', /casaexemplo@okaxis/.test(r.selected) && r.us !== 'none', JSON.stringify(r.selected));
  check('one role="img" per code, named by its label (and "QR code" when none is given)', r.imgs === 4 && r.names.includes('QR code for the UPI payment link') && r.ticketName === 'QR code for the ticket number', JSON.stringify(r.names));
  const byRole = await page.getByRole('img', { name: 'QR code for the UPI payment link' }).count();
  check('the accessibility tree offers the labelled picture once', byRole === 1, `${byRole}`);
  await ctx.close();
}
{
  const { ctx, page } = await open(`${DEMO}?register=playful`);
  await ready(page, 'playful');
  const n = await page.evaluate(() => [...document.querySelectorAll('.sg-qr-frame')].map(f => f.getAttribute('aria-hidden')));
  const imgs = await page.getByRole('img').count();
  check('playful: the frame is aria-hidden, so the tree still holds only the four codes', n.length === 4 && n.every(v => v === 'true') && imgs === 4, `${n.length} frames, ${imgs} images`);
  await ctx.close();
}

// ── it follows its attributes and its words ────────────────────────────
{
  const { ctx, page, errors } = await open(`${DEMO}?register=warm`);
  await ready(page, 'warm');
  const r = await page.evaluate(async () => {
    const out = {}, tick = () => new Promise(r => setTimeout(r, 50));
    const e = document.querySelector('#ticket');
    out.v0 = e.symbol.version;
    e.setAttribute('ecc', 'L'); await tick(); out.eccL = e.symbol.ecc;
    e.setAttribute('value', 'https://susegad.dev/ui/qr'); await tick();
    out.mode = e.symbol.mode;
    e.setAttribute('label', 'Booking code'); await tick(); out.label = e.querySelector('svg').getAttribute('aria-label');
    e.setAttribute('size', '6rem'); await tick(); out.size = Math.round(e.querySelector('.sg-qr-plate').getBoundingClientRect().width);
    e.setAttribute('size', '140'); await tick(); out.size2 = Math.round(e.querySelector('.sg-qr-plate').getBoundingClientRect().width);
    // no value attribute: the words are the value
    const w = document.createElement('sg-qr'); w.textContent = 'plain words'; document.body.append(w); await tick(); out.fromText = w.symbol?.mode + ':' + w.value;
    w.querySelector('.sg-qr-text').firstChild.data = 'edited words'; await tick(); out.edited = w.value;
    // a value that cannot fit: the words stay, the picture goes, the page is told
    const big = document.createElement('sg-qr'); let ev = null; big.addEventListener('sg-qr-error', x => { ev = x.detail.message; });
    big.setAttribute('value', 'x'.repeat(4000)); big.setAttribute('ecc', 'H'); big.textContent = 'Too much text'; document.body.append(big); await tick();
    out.big = { error: big.hasAttribute('data-error'), plateHidden: big.querySelector('.sg-qr-plate').hidden, ev, text: big.querySelector('.sg-qr-text').textContent, symbol: big.symbol };
    const empty = document.createElement('sg-qr'); empty.setAttribute('value', ''); empty.textContent = 'Nothing to encode'; document.body.append(empty); await tick();
    out.empty = { hidden: empty.querySelector('.sg-qr-plate').hidden, error: empty.hasAttribute('data-error') };
    return out;
  });
  const want = encode('https://susegad.dev/ui/qr', { ecc: 'L' }).rows.join('');
  const now = await page.evaluate(() => document.querySelector('#ticket').symbol.rows.join(''));
  check('changing ecc, value, label and size redraws the picture and the plate', r.eccL === 'L' && now === want && r.mode === 'byte' && r.label === 'Booking code' && r.size === 96 && r.size2 === 140, JSON.stringify(r));
  check('with no value attribute the words are the value, and editing them redraws', r.fromText === 'byte:plain words' && r.edited === 'edited words', `${r.fromText} / ${r.edited}`);
  check('a value too long for any code keeps the words, drops the picture, flags data-error and fires sg-qr-error with a plain message',
    r.big.error && r.big.plateHidden && r.big.symbol === null && r.big.text === 'Too much text' && /too long/.test(r.big.ev ?? ''), JSON.stringify(r.big));
  check('an empty value draws nothing and is not an error', r.empty.hidden && !r.empty.error, JSON.stringify(r.empty));
  check('no page errors from any of it (the too-long warning is a warning, not an error)', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── motion: the frame draws on in playful only ──────────────────────────
{
  const html = reg => `<!doctype html><html lang="en" data-register="${reg}"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/qr/qr.css"><script type="module" src="/packages/components/qr/qr.js"></script></head><body><main id="m"></main></body></html>`;
  const probe = async (reg, reduced) => {
    const { ctx, page } = await openHtml(`motion-${reg}-${reduced}`, html(reg), { reduced });
    await page.waitForFunction(() => customElements.get('sg-qr'));
    const r = await page.evaluate(async () => {
      const e = document.createElement('sg-qr'); e.setAttribute('value', 'motion probe'); e.textContent = 'words';
      const skinned = new Promise(res => e.addEventListener('sg-skin', res, { once: true }));
      document.querySelector('#m').append(e);
      await skinned;
      await new Promise(r => setTimeout(r, 120));
      const during = document.getAnimations().length;
      const names = document.getAnimations().map(a => a.effect.target.getAttribute('class'));
      await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})));
      await new Promise(r => setTimeout(r, 50));
      return { during, names, after: document.getAnimations().length, dash: getComputedStyle(e.querySelector('.sg-qr-rule') ?? e).strokeDasharray };
    });
    await ctx.close();
    return r;
  };
  const play = await probe('playful', false);
  check('playful, motion allowed: the frame\'s rules and studs animate once, then none are left running', play.during >= 2 && play.after === 0 && play.dash === 'none', JSON.stringify(play));
  const redu = await probe('playful', true);
  check('playful, reduced motion: nothing animates at all, and the frame is already whole', redu.during === 0 && redu.after === 0 && redu.dash === 'none', JSON.stringify(redu));
  for (const reg of ['quiet', 'warm']) {
    const r = await probe(reg, false);
    check(`${reg}: nothing animates`, r.during === 0, JSON.stringify(r));
  }
}

// ── axe, every register and theme, mid-reveal, phone, no JavaScript ─────
for (const theme of ['light', 'dark']) for (const register of REGISTERS) {
  const { ctx, page } = await open(`${DEMO}?register=${register}&theme=${theme}`);
  await ready(page, register);
  const v = await axe(page);
  check(`axe, ${register}, ${theme}: 0 violations`, !v.length, v.join('; '));
  await ctx.close();
}
{
  const { ctx, page } = await open(`${DEMO}?register=playful&theme=dark`, { width: 390, touch: true });
  await ready(page, 'playful');
  const v = await axe(page);
  check('axe, playful, dark, phone width: 0 violations', !v.length, v.join('; '));
  await ctx.close();
}
{
  const { ctx, page } = await open(`${DEMO}?register=playful`);
  await page.evaluate(() => { const e = document.createElement('sg-qr'); e.setAttribute('value', 'live'); e.setAttribute('label', 'Late code'); e.textContent = 'words'; document.body.append(e); });
  await page.waitForFunction(() => document.getAnimations().length > 0, null, { timeout: 5000 }).catch(() => {});
  const live = await page.evaluate(() => document.getAnimations().length);
  const v = await axe(page);
  check('axe while the frame is drawing on: 0 violations (and it really was drawing)', live > 0 && !v.length, `${live} animations; ${v.join('; ')}`);
  await ctx.close();
}
{
  const v = await axeNoJs(DEMO);
  check('axe without JavaScript: 0 violations', !v.length, v.join('; '));
  const { ctx, page } = await open(`${DEMO}?register=playful`, { js: false });
  await page.waitForLoadState('load');
  const r = await page.evaluate(() => ({ plates: document.querySelectorAll('.sg-qr-plate, svg').length, text: document.querySelector('#upi').innerText, shown: getComputedStyle(document.querySelector('#upi p')).visibility }));
  check('without JavaScript the words show, in the demo layout, and there is no picture', r.plates === 0 && /Pay Casa Exemplo/.test(r.text) && /casaexemplo@okaxis/.test(r.text) && r.shown === 'visible', JSON.stringify(r));
  await ctx.close();
}

await done();
