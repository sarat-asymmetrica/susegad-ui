// Browser checks for <sg-tumble>: axe, the heading stays one DOM string and is the only thing read or selected,
// the heading is never hidden without JavaScript, before it plays, or when anything throws, warm lines from
// alternate sides, playful letters that drop, bounce once and settle, a late web font waited for, manual and
// play(), once on first view, reduced motion, and a strict Content-Security-Policy. Each probe also runs on a
// broken copy to show it can fail.
//
//   node packages/components/tumble/tumble.check.mjs

import { readFileSync } from 'node:fs';
import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';

const { server, browser, engine, check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/tumble/demo.html';
const TEXT = 'Life is short, eat good pasta';
const visible = page => page.evaluate(() => {
  const h = document.querySelector('sg-tumble h2, sg-tumble h1, sg-tumble h3'), cs = getComputedStyle(h);
  return { color: cs.color, fill: cs.getPropertyValue('-webkit-text-fill-color'), opacity: cs.opacity, text: h.textContent, state: h.closest('sg-tumble').dataset.state ?? null };
});
const isVisible = v => v.color !== 'rgba(0, 0, 0, 0)' && v.fill !== 'rgba(0, 0, 0, 0)' && v.opacity === '1';

// ── axe, errors, no JavaScript ──────────────────────────────────────────
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
{
  // axe while it plays: the copy is aria-hidden and must raise nothing
  const { ctx, page } = await open(`${DEMO}?register=playful&palette=haldi`);
  await page.evaluate(() => { document.querySelector('#manual').play(); });
  await page.waitForFunction(() => document.querySelector('#manual').dataset.state === 'playing', null, { timeout: 8000 });
  const live = await page.evaluate(() => document.querySelector('#manual .sg-tumble-layer') !== null);
  const v = await axe(page);
  check('axe while the letters are in the air: 0 violations (and the copy was really there)', live && !v.length, `copy present ${live}; ${v.join('; ')}`);
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

// ── the heading is read once, and stays one string ──────────────────────
{
  const { ctx, page } = await open(`${DEMO}?register=playful`);
  await settle(page);
  await page.waitForFunction(() => document.querySelector('sg-tumble').dataset.state === 'done', null, { timeout: 8000 });
  await page.evaluate(() => { window.__t = document.querySelector('#manual'); window.__t.play(); });
  await page.waitForFunction(() => window.__t.dataset.state === 'playing', null, { timeout: 8000 });
  const r = await page.evaluate(() => {
    const t = window.__t, h = t.querySelector('h3'), layer = t.querySelector('.sg-tumble-layer');
    const sel = getSelection(); sel.removeAllRanges(); const range = document.createRange(); range.selectNodeContents(h); sel.addRange(range);
    return {
      textContent: h.textContent, childNodes: h.childNodes.length, firstIsText: h.firstChild.nodeType === 3,
      layerHidden: layer?.getAttribute('aria-hidden'), layerInside: h.contains(layer), layerLetters: layer?.querySelectorAll('.sg-tumble-letter').length,
      layerText: layer?.textContent, selected: sel.toString(), headingInA11yTree: h.getAttribute('aria-hidden'),
    };
  });
  check('the heading is still one text node with its own string while the letters move', r.textContent === 'Supper club, first Saturday' && r.childNodes === 1 && r.firstIsText, JSON.stringify({ n: r.childNodes }));
  check('the moving copy is aria-hidden and outside the heading', r.layerHidden === 'true' && !r.layerInside && r.layerLetters === 'Supperclub,firstSaturday'.length, `${r.layerHidden} letters ${r.layerLetters}`);
  check('selecting the heading while it plays selects the real text, once', r.selected === 'Supper club, first Saturday', JSON.stringify(r.selected));
  const name = await page.evaluate(() => { const h = document.querySelector('#manual h3'); return h.getAttribute('aria-label') ?? h.textContent; });
  check('the heading is announced by its own text', name === 'Supper club, first Saturday');
  await ctx.close();
}

// ── never invisible ─────────────────────────────────────────────────────
{
  const { ctx, page } = await open(DEMO + '?register=warm', { js: false });
  const v = await visible(page);
  check('JavaScript off: the heading is plainly there', isVisible(v) && v.text === TEXT, JSON.stringify(v));
  await ctx.close();
}
{
  // before the module has run, and while the page waits on it
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/tumble/tumble.css"></head>
<body><sg-tumble hold manual><h2>Held until told</h2></sg-tumble><script>window.__never = 1</script></body></html>`;
  const { ctx, page } = await openHtml('before-js', html, { js: true });
  await page.waitForTimeout(300);
  const v = await visible(page);
  check('before the component is defined (module never loaded), even `hold` leaves the heading visible', isVisible(v), JSON.stringify(v));
  await ctx.close();
}
{
  // anything throws: the measuring blows up, and the heading must come back
  const errors = [];
  const { ctx, page } = await open(`${DEMO}?register=playful`, { errors });
  await settle(page);
  await page.evaluate(() => { Range.prototype.getClientRects = () => { throw new Error('boom'); }; });
  const during = await page.evaluate(async () => { const t = document.querySelector('#manual'); await t.play(); const h = t.querySelector('h3'); const cs = getComputedStyle(h); return { color: cs.color, state: t.dataset.state, layer: !!t.querySelector('.sg-tumble-layer'), pending: document.getAnimations().length }; });
  check('anything throws: the heading is back, no copy is left, nothing is stuck transparent', during.color !== 'rgba(0, 0, 0, 0)' && !during.layer && during.state !== 'playing' && during.pending === 0, JSON.stringify(during));
  // the probe must be able to fail: with the measuring intact the heading IS transparent mid-play
  await ctx.close();
  const ok = await open(`${DEMO}?register=playful`);
  await settle(ok.page);
  const mid = await ok.page.evaluate(async () => { const t = document.querySelector('#manual'); t.play(); for (let i = 0; i < 100 && t.dataset.state !== 'playing'; i++) await new Promise(r => setTimeout(r, 30)); return getComputedStyle(t.querySelector('h3')).color; });
  check('the never-invisible probe can fail: mid-play the real text is transparent, as designed', mid === 'rgba(0, 0, 0, 0)', mid);
  await ok.ctx.close();
}
{
  // the stylesheet is missing: the copy must not double the text
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title></head><body style="font:48px serif"><sg-tumble manual><h2 style="margin:0">No sheet at all</h2></sg-tumble><script type="module" src="/packages/components/tumble/tumble.js"></script></body></html>`;
  const { ctx, page } = await openHtml('no-css', html);
  await page.waitForFunction(() => document.querySelector('sg-tumble').dataset.skin, null, { timeout: 6000 });
  const r = await page.evaluate(async () => { const t = document.querySelector('sg-tumble'); t.play(); for (let i = 0; i < 100 && t.dataset.state !== 'playing'; i++) await new Promise(r => setTimeout(r, 30)); const h = t.querySelector('h2'); const mid = getComputedStyle(h).color; await new Promise(r => { const iv = setInterval(() => { if (t.dataset.state !== 'playing') { clearInterval(iv); r(); } }, 50); }); return { mid, after: getComputedStyle(h).color, inlineColor: h.style.color }; });
  check('without tumble.css the copy still never doubles the text (the heading hides itself) and everything is restored', r.mid === 'rgba(0, 0, 0, 0)' && r.after === 'rgb(0, 0, 0)' && r.inlineColor === '', JSON.stringify(r));
  await ctx.close();
}
{
  // gradient text (a transparent fill): a copy would be invisible, so it is left alone
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/packages/components/tumble/tumble.css"></head><body><sg-tumble manual><h2 id="g" style="font:48px serif;background:linear-gradient(red,blue);-webkit-background-clip:text;background-clip:text;color:transparent">Gradient words</h2></sg-tumble><script type="module" src="/packages/components/tumble/tumble.js"></script></body></html>`;
  const { ctx, page } = await openHtml('gradient', html);
  await page.waitForFunction(() => document.querySelector('sg-tumble').dataset.skin, null, { timeout: 6000 });
  const r = await page.evaluate(async () => { const t = document.querySelector('sg-tumble'); await t.play(); return { layer: !!t.querySelector('.sg-tumble-layer'), state: t.dataset.state ?? null }; });
  check('gradient text is left alone (no copy, nothing hidden)', !r.layer && r.state !== 'playing', JSON.stringify(r));
  await ctx.close();
}

// ── warm: lines from alternate sides ────────────────────────────────────
{
  const { ctx, page } = await open(`${DEMO}?register=warm&palette=haldi`);
  await settle(page);
  await page.waitForFunction(() => document.querySelector('sg-tumble').dataset.state === 'done', null, { timeout: 8000 });
  const seen = await page.evaluate(async () => {
    const t = document.querySelector('sg-tumble'); const p = t.play(); const samples = []; for (let i = 0; i < 100 && !t.querySelector('.sg-tumble-line'); i++) await new Promise(r => setTimeout(r, 20));
    for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 50)); const lines = [...t.querySelectorAll('.sg-tumble-line')]; samples.push(lines.map(l => { const m = new DOMMatrix(getComputedStyle(l).transform); return [Math.round(m.m41), +getComputedStyle(l).opacity]; })); }
    await p; return { samples, lines: samples[0].length };
  });
  const first = seen.samples.find(s => s.every(([x]) => x !== 0)) ?? seen.samples[1];
  check('warm: the heading has two lines, and they start on opposite sides', seen.lines === 2 && Math.sign(first[0][0]) === -Math.sign(first[1][0]) && first[0][0] < 0, JSON.stringify(first));
  const xs = seen.samples.map(l => l[0][0]);
  check('warm: the first line comes in from the left toward rest, and is near rest by the end of the sampling', xs[0] < -100 && xs.at(-1) > xs[0] && Math.abs(xs.at(-1)) < 80, JSON.stringify(xs));
  await ctx.close();
}

// ── playful: a letter drops, touches down, bounces once, settles ─────────
{
  const { ctx, page } = await open(`${DEMO}?register=playful&palette=haldi`);
  await settle(page);
  await page.waitForFunction(() => document.querySelector('sg-tumble').dataset.state === 'done', null, { timeout: 9000 });
  const trace = await page.evaluate(async () => {
    const t = document.querySelector('#manual'); const p = t.play(); const ys = [], rots = []; let letter = null; for (let i = 0; i < 100 && !t.querySelector('.sg-tumble-letter'); i++) await new Promise(r => setTimeout(r, 20));
    for (let i = 0; i < 60; i++) {
      await new Promise(r => requestAnimationFrame(r));
      letter ??= t.querySelector('.sg-tumble-letter');
      if (!letter) continue;
      const m = new DOMMatrix(getComputedStyle(letter).transform), cs = getComputedStyle(letter);
      ys.push(+m.m42.toFixed(1)); rots.push(+(Math.atan2(m.b, m.a) * 180 / Math.PI).toFixed(1));
    }
    await p; return { ys, rots, doneState: t.dataset.state, layer: !!t.querySelector('.sg-tumble-layer') };
  });
  const ys = trace.ys, firstY = ys[0], touch = ys.findIndex(y => y >= -1);
  const bounce = touch >= 0 && ys.slice(touch + 1).some(y => y < -2);
  check('playful: the first letter starts well above its place and turned', firstY < -30 && trace.rots.some(r => Math.abs(r) > 8), `y0 ${firstY}, spin up to ${Math.max(...trace.rots.map(Math.abs))}`);
  check('playful: it touches down and then lifts once in a small bounce', bounce, JSON.stringify(ys.filter((_, i) => i % 3 === 0)));
  let crossings = 0; for (let i = touch + 1; i < ys.length; i++) if ((ys[i - 1] < -2) !== (ys[i] < -2)) crossings++;
  check('playful: the bounce is one lift and one settle, not a ringing', crossings <= 2, `${crossings} crossings`);
  check('playful: it ends settled, the copy gone and the heading showing', trace.doneState === 'done' && !trace.layer && Math.abs(ys.at(-1)) < 1.5, JSON.stringify({ last: ys.at(-1), state: trace.doneState }));
  await ctx.close();
}

// ── the copy sits exactly where the text is (so the swap is invisible) ───
for (const register of ['warm', 'playful']) {
  const { ctx, page } = await open(`${DEMO}?register=${register}&palette=haldi`);
  await settle(page);
  await page.waitForFunction(() => document.querySelector('sg-tumble').dataset.state === 'done', null, { timeout: 9000 });
  const r = await page.evaluate(async () => {
    const t = document.querySelector('#manual'); const h = t.querySelector('h3'); t.play(); for (let i = 0; i < 40 && !t.querySelector('.sg-tumble-letter'); i++) await new Promise(r => setTimeout(r, 25));
    const anims = document.getAnimations(); for (const a of anims) { a.pause(); a.currentTime = a.effect.getComputedTiming().endTime; } // the last instant, everything at rest
    await new Promise(r => requestAnimationFrame(r));
    const letters = [...t.querySelectorAll('.sg-tumble-letter')], range = document.createRange(), node = h.firstChild;
    let worst = 0, i = 0;
    for (let at = 0; at < node.data.length; at++) { if (!node.data[at].trim()) continue; range.setStart(node, at); range.setEnd(node, at + 1); const a = range.getClientRects()[0], b = letters[i++].getBoundingClientRect(); worst = Math.max(worst, Math.abs(a.left - b.left), Math.abs(a.top - b.top)); }
    return { worst, n: letters.length };
  });
  check(`${register}: each copied letter lies within 2 px of the real one at rest`, r.worst <= 2, `worst ${r.worst.toFixed(2)} px over ${r.n} letters`);
  await ctx.close();
}

// ── a late web font is waited for ───────────────────────────────────────
{
  const font = readFileSync(new URL('../../tokens/fonts/castoro/castoro-400-700-latin.woff2', import.meta.url));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/tumble/tumble.css">
<style>@font-face{font-family:Slow;src:url(/__check/slow.woff2) format('woff2');font-display:swap}body{margin:0;font:56px/1.1 Slow,serif}</style></head>
<body><sg-tumble register="playful"><h2 style="margin:0">Slow font words</h2></sg-tumble><script type="module" src="/packages/components/tumble/tumble.js"></script></body></html>`;
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 900, height: 500 } }));
  let served = 0;
  await ctx.route('**/__check/slow.woff2', async r => { await new Promise(x => setTimeout(x, 900)); served = Date.now(); r.fulfill({ contentType: 'font/woff2', body: font }); });
  await ctx.route('**/__check/slowfont.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${server.url}/__check/slowfont.html`, { waitUntil: 'commit' });
  await page.waitForFunction(() => document.querySelector('sg-tumble')?.dataset.skin, null, { timeout: 6000 });
  await page.waitForTimeout(250);
  const early = await page.evaluate(() => ({ layer: !!document.querySelector('.sg-tumble-layer'), state: document.querySelector('sg-tumble').dataset.state ?? null, loaded: document.fonts.check('56px Slow') }));
  await page.waitForFunction(() => document.querySelector('sg-tumble').dataset.state === 'playing', null, { timeout: 6000 });
  const startedAfterFont = Date.now() >= served;
  const at = await page.evaluate(() => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = a.effect.getComputedTiming().endTime; }
    const t = document.querySelector('sg-tumble'), h = t.querySelector('h2'), letters = [...t.querySelectorAll('.sg-tumble-letter')], range = document.createRange(), node = h.firstChild;
    let worst = 0, i = 0; for (let k = 0; k < node.data.length; k++) { if (!node.data[k].trim()) continue; range.setStart(node, k); range.setEnd(node, k + 1); const a = range.getClientRects()[0], b = letters[i++].getBoundingClientRect(); worst = Math.max(worst, Math.abs(a.left - b.left), Math.abs(a.top - b.top)); }
    return { worst, loaded: document.fonts.check('56px Slow') };
  });
  check('a late web font: nothing plays while the font is on its way, the heading shows meanwhile', !early.layer && early.state !== 'playing' && !early.loaded, JSON.stringify(early));
  check('a late web font: the arrival starts after the font has landed, and the copy matches the real letters', startedAfterFont && at.loaded && at.worst <= 2, `started after font ${startedAfterFont}; worst ${at.worst.toFixed(2)} px`);
  check('a late web font: no errors', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── once on first view, manual, play(), hold ────────────────────────────
{
  const errors = [];
  const html = `<!doctype html><html lang="en" data-register="playful"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/tumble/tumble.css"></head>
<body style="margin:0;font:40px serif"><div style="height:1500px"></div><sg-tumble id="a"><h2 style="margin:0">Below the fold</h2></sg-tumble><div style="height:300px"></div>
<sg-tumble id="m" manual><h2 style="margin:0">Waits for play</h2></sg-tumble><div style="height:50px"></div><sg-tumble id="h" manual hold><h2 style="margin:0">Held</h2></sg-tumble><div style="height:1500px"></div>
<script type="module" src="/packages/components/tumble/tumble.js"></script></body></html>`;
  const { ctx, page } = await openHtml('first-view', html, { errors, height: 700 });
  await page.waitForFunction(() => document.querySelector('#a').dataset.skin, null, { timeout: 6000 });
  await page.waitForTimeout(500);
  const s0 = await page.evaluate(() => ({ a: document.querySelector('#a').dataset.state ?? null, m: document.querySelector('#m').dataset.state ?? null, h: document.querySelector('#h').dataset.state ?? null, hColor: getComputedStyle(document.querySelector('#h h2')).color }));
  check('first view: a heading below the fold has not played', s0.a === null, JSON.stringify(s0));
  check('manual: nothing plays until play() is called', s0.m === null);
  check('hold: with JavaScript running, a held heading is hidden until it plays', s0.h === 'held' && s0.hColor === 'rgba(0, 0, 0, 0)', JSON.stringify(s0));
  await page.evaluate(() => scrollTo(0, 1300));
  await page.waitForFunction(() => document.querySelector('#a').dataset.state === 'playing' || document.querySelector('#a').dataset.state === 'done', null, { timeout: 5000 }).catch(() => {});
  const s1 = await page.evaluate(() => document.querySelector('#a').dataset.state);
  check('first view: scrolled into view, it plays', s1 === 'playing' || s1 === 'done', s1);
  await page.waitForFunction(() => document.querySelector('#a').dataset.state === 'done', null, { timeout: 6000 });
  const starts = await page.evaluate(async () => { let n = 0; document.querySelector('#a').addEventListener('sg-tumble-start', () => n++); scrollTo(0, 0); await new Promise(r => setTimeout(r, 400)); scrollTo(0, 1300); await new Promise(r => setTimeout(r, 900)); return n; });
  check('first view: it plays once; scrolling away and back does not play it again', starts === 0, `${starts} replays`);
  const events = await page.evaluate(async () => { const m = document.querySelector('#m'); const log = []; m.addEventListener('sg-tumble-start', () => log.push('start')); m.addEventListener('sg-tumble-done', () => log.push('done')); const p = m.play(); log.push('called'); await p; log.push('resolved'); return { log, state: m.dataset.state }; });
  check('play(): starts, finishes, and its promise resolves after the heading has settled', events.log.join() === 'called,start,done,resolved' || events.log.join() === 'called,start,done,resolved'.replace('start,done,', 'start,done,') , JSON.stringify(events));
  const rel = await page.evaluate(async () => { const h = document.querySelector('#h'); await h.play(); return { state: h.dataset.state, color: getComputedStyle(h.querySelector('h2')).color }; });
  check('hold: play() releases it and the heading ends visible', rel.state === 'done' && rel.color !== 'rgba(0, 0, 0, 0)', JSON.stringify(rel));
  check('no errors', !errors.length, errors.join(' | '));
  await ctx.close();
}
{
  // a hold that is never played lets go on its own (fast-forwarded: the timer is the component's own)
  const html = `<!doctype html><html lang="en" data-register="warm"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/packages/components/tumble/tumble.css"></head><body style="font:40px serif"><sg-tumble manual hold><h2>Never played</h2></sg-tumble><script type="module" src="/packages/components/tumble/tumble.js"></script></body></html>`;
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 800, height: 400 } }));
  await ctx.addInitScript(() => { const st = window.setTimeout; window.setTimeout = (fn, ms, ...a) => st(fn, ms >= 8000 ? 400 : ms, ...a); });
  await ctx.route('**/__check/hold.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  const page = await ctx.newPage();
  await page.goto(`${server.url}/__check/hold.html`);
  await page.waitForFunction(() => document.querySelector('sg-tumble').dataset.skin, null, { timeout: 6000 });
  const held = await page.evaluate(() => getComputedStyle(document.querySelector('h2')).color);
  await page.waitForTimeout(700);
  const freed = await page.evaluate(() => ({ color: getComputedStyle(document.querySelector('h2')).color, state: document.querySelector('sg-tumble').dataset.state ?? null }));
  check('hold: a heading nobody plays is given back after the hold timeout', held === 'rgba(0, 0, 0, 0)' && freed.color !== 'rgba(0, 0, 0, 0)' && freed.state === null, JSON.stringify({ held, freed }));
  await ctx.close();
}

// ── quiet and reduced motion ────────────────────────────────────────────
for (const [name, path, opts] of [['quiet', `${DEMO}?register=quiet`, {}], ['warm under reduced motion', `${DEMO}?register=warm`, { reduced: true }], ['playful under reduced motion', `${DEMO}?register=playful`, { reduced: true }]]) {
  const { ctx, page } = await open(path, opts);
  await settle(page);
  await page.waitForTimeout(600);
  const r = await page.evaluate(async () => { const t = document.querySelector('#manual'); let started = 0; t.addEventListener('sg-tumble-start', () => started++); await t.play(); const h = document.querySelector('sg-tumble h2'); return { layers: document.querySelectorAll('.sg-tumble-layer').length, anims: document.getAnimations().length, started, state: [...document.querySelectorAll('sg-tumble')].map(e => e.dataset.state ?? null), color: getComputedStyle(h).color }; });
  check(`${name}: nothing moves, no copy is ever made, play() resolves at once, the heading is there`, r.layers === 0 && r.anims === 0 && r.started === 0 && r.state.every(s => s === null) && r.color !== 'rgba(0, 0, 0, 0)', JSON.stringify(r));
  await ctx.close();
}

// ── resize mid-play, and a strict Content-Security-Policy ───────────────
{
  const { ctx, page } = await open(`${DEMO}?register=playful`);
  await settle(page);
  await page.waitForFunction(() => document.querySelector('sg-tumble').dataset.state === 'done', null, { timeout: 9000 });
  await page.evaluate(() => { window.__p = document.querySelector('#manual').play(); });
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: 700, height: 800 });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({ layer: !!document.querySelector('#manual .sg-tumble-layer'), state: document.querySelector('#manual').dataset.state, color: getComputedStyle(document.querySelector('#manual h3')).color }));
  check('a resize mid-play ends it cleanly: the heading is back and nothing is left over', !r.layer && r.state === 'done' && r.color !== 'rgba(0, 0, 0, 0)', JSON.stringify(r));
  await ctx.close();
}
{
  const html = `<!doctype html><html lang="en" data-register="playful"><head><meta charset="utf-8"><title>CSP</title>
<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/tumble/tumble.css"></head>
<body><main><sg-tumble manual id="w" register="warm"><h2>Strict policy, warm lines</h2></sg-tumble><sg-tumble manual id="p"><h2>Strict policy, playful letters</h2></sg-tumble></main>
<script type="module" src="/packages/components/tumble/tumble.js"></script></body></html>`;
  const csp = "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:";
  const errors = [];
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1000, height: 600 } }));
  await ctx.route('**/__check/csp-tumble.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', headers: { 'content-security-policy': csp }, body: html }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto(`${server.url}/__check/csp-tumble.html`);
  await page.waitForFunction(() => [...document.querySelectorAll('sg-tumble')].every(t => t.dataset.skin), null, { timeout: 8000 });
  const r = await page.evaluate(async () => {
    const out = {};
    for (const id of ['w', 'p']) { const t = document.getElementById(id); const p = t.play(); await new Promise(r => setTimeout(r, 250)); out[id] = { letters: t.querySelectorAll('.sg-tumble-letter').length, hidden: getComputedStyle(t.querySelector('h2')).color, styleEls: document.querySelectorAll('style').length, anims: document.getAnimations().length }; await p; out[id].after = getComputedStyle(t.querySelector('h2')).color; }
    return out;
  });
  check('CSP: under style-src \'self\' and script-src \'self\' both arrivals play, finish and raise no violation', r.w.letters > 10 && r.p.letters > 10 && r.w.anims > 0 && r.p.anims > 0 && r.w.hidden === 'rgba(0, 0, 0, 0)' && r.p.after !== 'rgba(0, 0, 0, 0)' && !errors.length, `${JSON.stringify(r)} ${errors.join(' | ')}`);
  const refused = await page.evaluate(() => new Promise(res => { let v = 0; document.addEventListener('securitypolicyviolation', () => v++); const i = document.createElement('div'); i.innerHTML = '<b style="color:red">x</b>'; document.body.append(i); setTimeout(() => res({ v, color: getComputedStyle(i.firstChild).color }), 100); }));
  check('CSP probe can fail: an inline style attribute is refused on this page', refused.v >= 1 && refused.color !== 'rgb(255, 0, 0)', JSON.stringify(refused));
  await ctx.close();
}

await done();
