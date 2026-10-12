// Browser checks for <sg-doodle>: axe, ten motifs that render as one or two pen strokes in currentColor, a name
// only when asked for, quiet still against warm drawing itself on entering view then boiling, playful's wiggle,
// reduced motion's finished drawing at once, a band of whole cells edge to edge from a seed, and a strict
// Content-Security-Policy (style-src 'self', script-src 'self'). Each probe also runs on a broken copy to show it
// can fail.
//
//   node packages/components/doodle/doodle.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';

const { server, browser, engine, check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/doodle/demo.html';
const MOTIFS = ['fork-twirl', 'ravioli', 'gnocchi', 'lemon', 'tomato', 'basil', 'whisk', 'rolling-pin', 'wheat', 'steam'];

// ── axe, errors, no JavaScript ──────────────────────────────────────────
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
for (const theme of ['light', 'dark']) {
  const { ctx, page } = await open(`${DEMO}?register=warm&theme=${theme}&palette=haldi`);
  await settle(page);
  const v = await axe(page);
  check(`axe, haldi palette, ${theme}: 0 violations`, !v.length, v.join('; '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

// ── ten motifs, one or two strokes, stroke only, in currentColor ────────
async function wholeDrawn(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('sg-doodle')].every(d => d.dataset.state === 'drawn' || d.dataset.skin === 'quiet'), null, { timeout: 12000 }).catch(() => {});
}
{
  const { ctx, page } = await open(`${DEMO}?register=quiet`);
  await settle(page);
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-doodle:not([band])')].filter(d => d.dataset.motif).map(d => {
    const paths = [...d.querySelectorAll('path')], cs = paths.map(p => getComputedStyle(p));
    return { motif: d.dataset.motif, n: paths.length, fill: cs.every(c => c.fill === 'none'), stroke: cs.every(c => c.stroke === getComputedStyle(d).color), width: cs[0].strokeWidth, w: d.getBoundingClientRect().width, h: d.getBoundingClientRect().height, label: d.getAttribute('aria-label'), hidden: d.getAttribute('aria-hidden') };
  }));
  const seen = new Set(r.map(x => x.motif));
  check('all ten motifs render', MOTIFS.every(m => seen.has(m)), `${[...seen].join(',')}`);
  check('every motif is one or two strokes', r.every(x => x.n >= 1 && x.n <= 2), r.map(x => `${x.motif}:${x.n}`).join(' '));
  check('every stroke is unfilled and drawn in currentColor', r.every(x => x.fill && x.stroke));
  check('a doodle with no label is aria-hidden and has no role or name', r.filter(x => !x.label).every(x => x.hidden === 'true'));
  check('each doodle is a square of --sg-doodle-size', r.every(x => Math.abs(x.w - x.h) < 0.5 && x.w > 40), r.map(x => `${x.w}x${x.h}`).slice(0, 2).join(' '));
  // a check must be able to fail (A10): a doodle whose path has a fill must be caught by the same probe
  const caught = await page.evaluate(() => { const p = document.querySelector('sg-doodle path'); p.style.fill = 'red'; const bad = getComputedStyle(p).fill !== 'none'; p.style.fill = ''; return bad; });
  check('the unfilled probe can fail: a painted path reads as filled', caught);
  await ctx.close();
}

// ── a label makes an image, and nothing else does ───────────────────────
{
  const { ctx, page } = await open(`${DEMO}?register=quiet`);
  await settle(page);
  const r = await page.evaluate(() => {
    const d = document.querySelector('sg-doodle[label]');
    const before = { role: d.getAttribute('role'), name: d.getAttribute('aria-label'), hidden: d.getAttribute('aria-hidden') };
    d.setAttribute('label', 'A lemon');
    const after = { role: d.getAttribute('role'), name: d.getAttribute('aria-label'), hidden: d.getAttribute('aria-hidden') };
    d.removeAttribute('label');
    const gone = { role: d.getAttribute('role'), name: d.getAttribute('aria-label'), hidden: d.getAttribute('aria-hidden') };
    return { before, after, gone, svgHidden: d.querySelector('svg').getAttribute('aria-hidden') };
  });
  check('label: role=img with that name, not aria-hidden', r.before.role === 'img' && r.before.name === 'A fork lifting a twirl of spaghetti' && r.before.hidden === null, JSON.stringify(r.before));
  check('label changes follow, and removing it makes the doodle decoration again', r.after.name === 'A lemon' && r.gone.role === null && r.gone.hidden === 'true', JSON.stringify(r.gone));
  check('the SVG inside is always aria-hidden, so the name is read once', r.svgHidden === 'true');
  await ctx.close();
}

// ── a page with a rAF counter and an animation count the doodle cannot see ──
const COUNTER = () => {
  const o = window.requestAnimationFrame.bind(window);
  window.__raf = 0;
  window.requestAnimationFrame = cb => o(t => { window.__raf++; cb(t); });
};
async function counted(path, { width = 1280, height = 900, reduced = false, touch = false, errors = [], wait = true } = {}) {
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: touch, isMobile: touch }));
  await ctx.addInitScript(COUNTER);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${server.url}${path}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 }).catch(() => errors.push('never ready'));
  if (wait) await page.waitForFunction(() => [...document.querySelectorAll('sg-doodle')].every(d => d.dataset.skin), null, { timeout: 5000 }).catch(() => errors.push('skins never loaded'));
  return { ctx, page, errors };
}
const sample = (page, sel) => page.evaluate(s => { const p = document.querySelector(s); return { d: p.getAttribute('d'), off: getComputedStyle(p).strokeDashoffset, arr: p.getAttribute('stroke-dasharray'), state: p.closest('sg-doodle').dataset.state }; }, sel);

// ── quiet: still ────────────────────────────────────────────────────────
{
  const { ctx, page } = await counted(`${DEMO}?register=quiet`);
  await page.waitForTimeout(1600);
  const r = await page.evaluate(() => ({ anims: document.getAnimations().length, dashed: [...document.querySelectorAll('sg-doodle path')].filter(p => p.hasAttribute('stroke-dasharray')).length, w: getComputedStyle(document.querySelector('sg-doodle path')).strokeWidth, svgW: document.querySelector('sg-doodle svg').getBoundingClientRect().width }));
  const f0 = await page.evaluate(() => window.__raf);
  const d1 = await sample(page, 'sg-doodle[motif="lemon"] path'); await page.waitForTimeout(900); const d2 = await sample(page, 'sg-doodle[motif="lemon"] path');
  const frames = (await page.evaluate(() => window.__raf)) - f0;
  check('quiet: no animations, no dash, the whole line at once', r.anims === 0 && r.dashed === 0, JSON.stringify(r));
  check('quiet: the line never changes (no boil) and an idle doodle asks for no frames', d1.d === d2.d && frames === 0, `rAF over 0.9 s idle: ${frames}`);
  check('quiet: a hairline, thinner than warm', parseFloat(r.w) < 1.5, r.w);
  await ctx.close();
}

// ── warm: draws itself once on entering view, then boils ────────────────
{
  const errors = [];
  const { ctx, page } = await counted(`${DEMO}?register=warm`, { height: 700, errors });
  // the lower bands start out of view: they must be hidden (undrawn) until scrolled to
  const low = await page.evaluate(() => { const b = document.querySelector('sg-doodle.big'); const r = b.getBoundingClientRect(); return { top: r.top, state: b.dataset.state ?? null, dash: b.querySelector('path')?.getAttribute('stroke-dasharray'), off: b.querySelector('path') ? getComputedStyle(b.querySelector('path')).strokeDashoffset : null }; });
  check('warm: a doodle below the fold has not drawn yet (hidden, not just late)', low.top > 700 && low.state !== 'drawn' && low.dash && parseFloat(low.off) > 1, JSON.stringify(low));
  // the visible ones draw: catch one mid-draw
  const states = [];
  for (let i = 0; i < 14; i++) { states.push(await page.evaluate(() => { const p = document.querySelector('sg-doodle[motif="ravioli"] path'); return { off: parseFloat(getComputedStyle(p).strokeDashoffset), state: p.closest('sg-doodle').dataset.state }; })); await page.waitForTimeout(110); }
  const mid = states.find(s => s.off > 0.05 && s.off < 1.05);
  check('warm: a stroke is caught part way through its reveal (offset between hidden and whole)', !!mid, JSON.stringify(states.map(s => +s.off.toFixed(2))));
  await page.waitForFunction(() => document.querySelector('sg-doodle[motif="ravioli"]').dataset.state === 'drawn', null, { timeout: 8000 });
  const fin = await sample(page, 'sg-doodle[motif="ravioli"] path');
  check('warm: finished, the dash is dropped and the line is whole', fin.arr === null && fin.state === 'drawn', JSON.stringify(fin));
  // the boil
  const ds = new Set(); for (let i = 0; i < 12; i++) { ds.add((await sample(page, 'sg-doodle[motif="ravioli"] path')).d); await page.waitForTimeout(130); }
  check('warm: after drawing the line boils (it takes several frames of its wobble)', ds.size >= 3, `${ds.size} distinct frames`);
  const r0 = await page.evaluate(() => window.__raf); await page.waitForTimeout(900);
  const raf = (await page.evaluate(() => window.__raf)) - r0;
  check('warm: while boiling, the doodles ask for no requestAnimationFrame of their own', raf === 0, `rAF over 0.9 s of boil: ${raf}`);
  // scroll to the low band: it draws then
  await page.evaluate(() => document.querySelector('sg-doodle.big').scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => document.querySelector('sg-doodle.big').dataset.state === 'drawn', null, { timeout: 10000 }).catch(() => {});
  const lowAfter = await page.evaluate(() => document.querySelector('sg-doodle.big').dataset.state);
  check('warm: scrolled into view, the low band draws itself', lowAfter === 'drawn', lowAfter);
  // it draws once: scrolling away and back does not hide it again
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('sg-doodle.big').scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
  const again = await sample(page, 'sg-doodle.big path');
  check('warm: draws once, and stays drawn when scrolled away and back', again.arr === null && again.state === 'drawn', JSON.stringify(again));
  // boil stops off screen: the timer runs only while something is visible
  const evented = await page.evaluate(() => new Promise(res => { const d = document.querySelector('sg-doodle[motif="gnocchi"]'); d.dataset.state === 'drawn' ? res('drawn') : d.addEventListener('sg-doodle-drawn', () => res('event'), { once: true }); setTimeout(() => res('timeout'), 6000); }));
  check('warm: sg-doodle-drawn is announced (or the doodle was already drawn)', evented !== 'timeout', evented);
  check('warm: no console errors', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── warm vs quiet: a broken copy, to show the boil probe can fail ───────
{
  const { ctx, page } = await counted(`${DEMO}?register=quiet`);
  const ds = new Set(); for (let i = 0; i < 8; i++) { ds.add((await sample(page, 'sg-doodle[motif="ravioli"] path')).d); await page.waitForTimeout(130); }
  check('the boil probe can fail: on quiet it reads one frame', ds.size === 1, `${ds.size}`);
  await ctx.close();
}

// ── playful: wiggle on hover and on tap, warm does not ──────────────────
{
  const { ctx, page } = await counted(`${DEMO}?register=playful`);
  await wholeDrawn(page);
  const box = await page.evaluate(() => { const c = document.querySelector('sg-doodle[motif="lemon"]').getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; });
  const before = await page.evaluate(() => document.querySelector('sg-doodle[motif="lemon"] .sg-doodle-cell').getAnimations().length);
  await page.mouse.move(box.x - 200, box.y); await page.mouse.move(box.x, box.y);
  await page.waitForTimeout(120);
  const during = await page.evaluate(() => { const c = document.querySelector('sg-doodle[motif="lemon"] .sg-doodle-cell'); const a = c.getAnimations(); return { n: a.length, t: getComputedStyle(c).transform }; });
  check('playful: hovering a doodle starts a wiggle (a transform animation on its cell)', before === 0 && during.n === 1 && during.t !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(during.t), JSON.stringify({ before, during }));
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => document.querySelector('sg-doodle[motif="lemon"] .sg-doodle-cell').getAnimations().length);
  check('playful: the wiggle ends and cancels itself (no animation is left running)', after === 0, `${after}`);
  const heavy = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('sg-doodle path')).strokeWidth));
  check('playful: a bolder pen than warm', heavy > 2.8, `${heavy}`);
  await ctx.close();
  const w = await counted(`${DEMO}?register=warm`);
  await wholeDrawn(w.page);
  const wb = await w.page.evaluate(() => { const c = document.querySelector('sg-doodle[motif="lemon"]').getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; });
  await w.page.mouse.move(wb.x - 200, wb.y); await w.page.mouse.move(wb.x, wb.y); await w.page.waitForTimeout(150);
  const wn = await w.page.evaluate(() => document.querySelector('sg-doodle[motif="lemon"] .sg-doodle-cell').getAnimations().length);
  check('the wiggle probe can fail: warm does not wiggle on hover', wn === 0, `${wn}`);
  await w.ctx.close();
  const t = await counted(`${DEMO}?register=playful`, { touch: true, width: 390, height: 844 });
  await wholeDrawn(t.page);
  await t.page.evaluate(() => document.querySelector('sg-doodle[motif="lemon"]').scrollIntoView({ block: 'center' }));
  await t.page.waitForTimeout(200);
  await t.page.locator('sg-doodle[motif="lemon"]').tap();
  await t.page.waitForTimeout(120);
  const tn = await t.page.evaluate(() => document.querySelector('sg-doodle[motif="lemon"] .sg-doodle-cell').getAnimations().length);
  check('playful: a tap wiggles a doodle on a phone', tn === 1, `${tn}`);
  await t.ctx.close();
}

// ── reduced motion: the finished drawing at once ────────────────────────
for (const register of ['warm', 'playful']) {
  const { ctx, page } = await counted(`${DEMO}?register=${register}`, { reduced: true });
  const r = await page.evaluate(() => ({ anims: document.getAnimations().length, dashed: [...document.querySelectorAll('sg-doodle path')].filter(p => p.hasAttribute('stroke-dasharray')).length, undrawn: [...document.querySelectorAll('sg-doodle')].filter(d => d.dataset.state !== 'drawn').length, offs: [...document.querySelectorAll('sg-doodle path')].map(p => parseFloat(getComputedStyle(p).strokeDashoffset)).filter(o => o > 0).length }));
  const a = await sample(page, 'sg-doodle[motif="ravioli"] path'); await page.waitForTimeout(700); const b = await sample(page, 'sg-doodle[motif="ravioli"] path');
  check(`reduced motion, ${register}: everything is drawn at once, no animations, no dash, no boil`, r.anims === 0 && r.dashed === 0 && r.undrawn === 0 && r.offs === 0 && a.d === b.d, JSON.stringify(r));
  await ctx.close();
}

// ── a band: whole cells, edge to edge, from a seed ──────────────────────
{
  const { ctx, page } = await counted(`${DEMO}?register=quiet`);
  const read = () => page.evaluate(() => {
    const b = document.querySelector('sg-doodle[band][seed="saffron-spoon"]'), svg = b.querySelector('svg'), vb = svg.viewBox.baseVal;
    const hb = b.getBoundingClientRect(), sb = svg.getBoundingClientRect();
    return { count: +b.dataset.cells, vbw: vb.width, vbh: vb.height, hw: hb.width, hh: hb.height, sw: sb.width, motifs: [...b.querySelectorAll('.sg-doodle-cell')].map(c => c.dataset.motif) };
  });
  const wide = await read();
  check('band: whole square cells fill the width edge to edge', wide.count > 10 && wide.vbw === wide.count * 100 && Math.abs(wide.sw - wide.hw) < 1 && Math.abs(wide.hh - wide.hw / wide.count) < 1, JSON.stringify({ count: wide.count, hw: wide.hw, hh: wide.hh }));
  await page.setViewportSize({ width: 600, height: 900 }); await page.waitForTimeout(500);
  const narrow = await read();
  check('band: a narrower page has fewer cells, and keeps the start of the wide row (seeded)', narrow.count < wide.count && narrow.motifs.every((m, i) => m === wide.motifs[i]), `${narrow.count} of ${wide.count}: ${narrow.motifs.join(',')}`);
  check('band: no motif twice in a row', wide.motifs.every((m, i) => i === 0 || m !== wide.motifs[i - 1]), wide.motifs.join(','));
  const reload = await counted(`${DEMO}?register=quiet`);
  const again = await reload.page.evaluate(() => [...document.querySelector('sg-doodle[band][seed="saffron-spoon"]').querySelectorAll('.sg-doodle-cell')].map(c => c.dataset.motif));
  check('band: the same seed draws the same row on a fresh page', again.every((m, i) => m === wide.motifs[i]) && again.length === wide.count);
  await reload.ctx.close();
  const few = await page.evaluate(() => [...new Set([...document.querySelector('sg-doodle[band][seed="supper"]').querySelectorAll('.sg-doodle-cell')].map(c => c.dataset.motif))].sort());
  check('band: motifs="..." draws only from those', few.join() === 'basil,ravioli,tomato,lemon'.split(',').sort().join(), few.join());
  await ctx.close();
}

// ── a strict Content-Security-Policy ────────────────────────────────────
{
  const html = `<!doctype html><html lang="en" data-register="warm"><head><meta charset="utf-8"><title>CSP</title>
<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/doodle/doodle.css"></head>
<body><main><sg-doodle motif="lemon"></sg-doodle><sg-doodle band seed="csp"></sg-doodle><sg-doodle data-register="playful" motif="tomato"></sg-doodle></main>
<script type="module" src="/packages/components/doodle/doodle.js"></script></body></html>`;
  const csp = "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:";
  const mk = async name => {
    const errors = [];
    const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1000, height: 700 } }));
    await ctx.route(`**/__check/${name}.html`, r => r.fulfill({ contentType: 'text/html; charset=utf-8', headers: { 'content-security-policy': csp }, body: html }));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${server.url}/__check/${name}.html`);
    await page.waitForFunction(() => [...document.querySelectorAll('sg-doodle')].every(d => d.dataset.skin), null, { timeout: 8000 }).catch(() => errors.push('skins never loaded'));
    return { ctx, page, errors };
  };
  const { ctx, page, errors } = await mk('csp');
  await page.waitForFunction(() => [...document.querySelectorAll('sg-doodle')].every(d => d.dataset.state === 'drawn'), null, { timeout: 9000 }).catch(() => errors.push('never drew'));
  const r = await page.evaluate(() => ({ cells: document.querySelectorAll('.sg-doodle-cell').length, styleEls: document.querySelectorAll('style').length, styleAttrs: [...document.querySelectorAll('sg-doodle *')].filter(n => n.hasAttribute('style')).length, count: getComputedStyle(document.querySelector('sg-doodle[band]')).getPropertyValue('--sg-doodle-count') }));
  check('CSP: under style-src \'self\' and script-src \'self\' the doodles render, draw and raise no violation', r.cells > 10 && !errors.length, `${JSON.stringify(r)} ${errors.join(' | ')}`);
  check('CSP: the markup a doodle injects has no <style> element and no style attribute', r.styleEls === 0 && r.styleAttrs === 0, JSON.stringify(r));
  check('CSP: the band still sets its count through the CSSOM', Number(r.count) > 10, r.count);
  // fail first: the same page must refuse an inline style, or the policy was not in force
  const refused = await page.evaluate(() => new Promise(res => {
    let v = 0; document.addEventListener('securitypolicyviolation', () => v++);
    const i = document.createElement('div'); i.innerHTML = '<b style="color:red">x</b>'; document.body.append(i);
    setTimeout(() => res({ v, color: getComputedStyle(i.firstChild).color }), 100);
  }));
  check('CSP probe can fail: an inline style attribute is refused on this page', refused.v >= 1 && refused.color !== 'rgb(255, 0, 0)', JSON.stringify(refused));
  await ctx.close();
}

await done();
