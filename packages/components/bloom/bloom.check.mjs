// Browser checks for <sg-bloom>: axe (light, dark, while it grows and after a press), what the picture is to
// assistive technology in each of the four cases, the cap, same seed same head, adding a floret moves none of the
// others, growth only in playful and from the heart outward (the delay each floret waits agrees with its place,
// where the browser has sibling-index() and where it does not), nothing moves in quiet, warm, under reduced motion
// or Save-Data, a press shivers the outer ring only, forced colours, phone width, a strict Content-Security-Policy,
// and no JavaScript. Probes that could only ever pass are run once on a broken copy to show they can fail.
//
//   node packages/components/bloom/bloom.check.mjs

import { harness } from '../../../tools/lib/component-check.mjs';
import { contextOptions, unsupportedIn } from '../../../tools/lib/engine.mjs';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';

const { server, browser, engine, check, open, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/bloom/demo.html';

const PAGE = (body, register = 'warm') => `<!doctype html><html lang="en" data-register="${register}"><head><meta charset="utf-8"><title>Bloom check</title>
<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/bloom/bloom.css">
<style>body{margin:0;background:var(--sg-surface);color:var(--sg-text)}main{padding:16px}</style></head>
<body><main id="stage">${body}</main><script type="module" src="/packages/components/bloom/bloom.js"></script></body></html>`;

/** A page of our own, with the options a context needs (Save-Data, reduced motion, forced colours, a policy). */
async function page(name, html, { width = 900, height = 700, reduced = false, saveData = false, csp = null, js = true, forced = false } = {}) {
  const errors = [];
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', javaScriptEnabled: js, ...(forced ? { forcedColors: 'active' } : {}) }));
  if (saveData) await ctx.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, addEventListener() {}, removeEventListener() {} }, configurable: true }));
  await ctx.route(`**/__check/${name}.html`, r => r.fulfill({ contentType: 'text/html; charset=utf-8', headers: csp ? { 'content-security-policy': csp } : {}, body: html }));
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await p.goto(`${server.url}/__check/${name}.html`);
  return { ctx, p, errors };
}
/** Append a bloom and wait for its skin: it has drawn its head the moment sg-skin fires. */
const add = (p, attrs, inner = '') => p.evaluate(async ([attrs, inner]) => {
  await customElements.whenDefined('sg-bloom');
  const el = document.createElement('sg-bloom');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.innerHTML = inner;
  const skin = new Promise(r => el.addEventListener('sg-skin', r, { once: true }));
  document.getElementById('stage').append(el);
  await skin;
  window.__b = el;
  // what was true in the first moment, read in the same task the skin drew in, before a slow machine can run the first florets out
  const ground = el.querySelector('.sg-bloom-ground'), svg = el.querySelector('svg');
  window.__first = { ratio: ground ? ground.getBoundingClientRect().width / svg.getBoundingClientRect().width : null, anims: el.getAnimations({ subtree: true }).map(a => ({ name: a.animationName, i: Number(a.effect.target.parentNode?.dataset?.i ?? -1), delay: a.effect.getTiming().delay, duration: a.effect.getTiming().duration, state: a.playState })) };
}, [attrs, inner]);
const florets = p => p.evaluate(() => [...window.__b.querySelectorAll('svg > .sg-bloom-fl > *')].map(n => ({ i: Number(n.dataset.i), t: n.getAttribute('transform') ?? `${n.getAttribute('cx')},${n.getAttribute('cy')}`, ring: n.hasAttribute('data-ring') })));
const anims = p => p.evaluate(() => window.__b.getAnimations({ subtree: true }).map(a => ({ name: a.animationName, i: Number(a.effect.target.parentNode?.dataset?.i ?? -1), ring: a.effect.target.parentNode?.hasAttribute?.('data-ring'), delay: a.effect.getTiming().delay, duration: a.effect.getTiming().duration, state: a.playState })));
const aria = p => p.evaluate(() => { const s = window.__b.querySelector('svg'); const n = window.__b.querySelector('.sg-bloom-n'); return { hidden: s.getAttribute('aria-hidden'), role: s.getAttribute('role'), label: s.getAttribute('aria-label'), text: n?.textContent ?? null, host: window.__b.textContent.trim() }; });
const norm = s => s.replace(/sg-bloom-\d+/g, 'sg-bloom-N');

// ── axe, errors ─────────────────────────────────────────────────────────
for (const theme of ['light', 'dark']) {
  const { ctx, page: p, errors } = await open(`${DEMO}?theme=${theme}`);
  await p.waitForFunction(() => [...document.querySelectorAll('sg-bloom')].every(b => b.querySelector('svg')), null, { timeout: 8000 });
  const n = await p.evaluate(() => document.querySelectorAll('sg-bloom svg').length);
  const v = await axe(p);
  check(`axe, ${theme}, the whole demo (${n} blooms, three registers): 0 violations`, n >= 12 && !v.length, v.join('; ') || `${n} svg`);
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, p } = await page('axe-open', PAGE('', 'playful'));
  await add(p, { count: '37', label: 'people registered', size: '160' });
  const mid = await anims(p);
  const v1 = await axe(p);
  check('axe while the florets are arriving: 0 violations (and they were really arriving)', mid.some(a => a.name === 'sg-bloom-grow' && a.state === 'running') && !v1.length, `${mid.length} animations; ${v1.join('; ')}`);
  await p.waitForFunction(() => !window.__b.hasAttribute('data-state'), null, { timeout: 5000 });
  await p.locator('sg-bloom svg').dispatchEvent('pointerdown');
  const shiver = (await anims(p)).filter(a => a.name === 'sg-bloom-shiver').length;
  const v2 = await axe(p);
  check('axe in the middle of a press shiver: 0 violations (and it was really shivering)', shiver > 0 && !v2.length, `${shiver} shivering; ${v2.join('; ')}`);
  await ctx.close();
}

// ── what the picture is to assistive technology ─────────────────────────
{
  const { ctx, p } = await page('aria', PAGE(''));
  await add(p, { 'seed-from': 'Maria' });
  let a = await aria(p);
  check('no words, no label: the picture is decoration (aria-hidden, no role)', a.hidden === 'true' && a.role === null && a.text === null && a.host === '', JSON.stringify(a));
  await add(p, { 'seed-from': 'Maria', label: "Maria's bloom" });
  a = await aria(p);
  check('a label and no count: the picture is an image with that name', a.role === 'img' && a.label === "Maria's bloom" && a.hidden === null && a.text === null, JSON.stringify(a));
  await add(p, { count: '37', label: 'people registered' });
  a = await aria(p);
  check('a count and a label: the number and label are text beside the picture, and the picture is hidden', a.text === '37 people registered' && a.hidden === 'true' && a.role === null && a.host === '37 people registered', JSON.stringify(a));
  await add(p, { count: '0' });
  a = await aria(p);
  check('a count of zero is a number too, in text', a.text === '0' && (await florets(p)).length === 0, JSON.stringify(a));
  await add(p, { count: '12', label: 'ignored' }, '12 volunteers have a stall.');
  a = await aria(p);
  check('the author wrote the words: nothing is added beside them and the picture is hidden', a.text === null && a.hidden === 'true' && a.host === '12 volunteers have a stall.', JSON.stringify(a));
  // changing the count changes the text and the drawing together; taking the count away takes the number away
  await add(p, { count: '5', label: 'guests' });
  await p.evaluate(() => window.__b.setAttribute('count', '9'));
  await p.waitForFunction(() => window.__b.querySelectorAll('svg > .sg-bloom-fl > *').length === 9);
  a = await aria(p);
  check('count 5 → 9: the text and the florets follow', a.text === '9 guests', JSON.stringify(a));
  await p.evaluate(() => window.__b.removeAttribute('count'));
  await p.waitForFunction(() => window.__b.querySelectorAll('svg > .sg-bloom-fl > *').length === 144);
  a = await aria(p);
  check('count removed: a full head of 144 and no number beside it', a.text === null && a.host === '', JSON.stringify(a));
  // the probe can fail: an author who forgets the words and the label gets a decorative picture, which this reads as hidden, not as an image
  check('the aria probe can fail: a labelled bloom is not read as decoration', (await (async () => { await add(p, { label: 'x' }); return (await aria(p)).hidden; })()) === null);
  await ctx.close();
}

// ── the cap, determinism, adding a floret ───────────────────────────────
{
  const { ctx, p } = await page('shape', PAGE('', 'warm'));
  await add(p, { count: '9999', label: 'guests' });
  check('count 9999 draws 400 florets and says 9999', (await florets(p)).length === 400 && (await aria(p)).text === '9999 guests');
  const t0 = await p.evaluate(async () => { const t = performance.now(); const e = document.createElement('sg-bloom'); e.setAttribute('count', '400'); const s = new Promise(r => e.addEventListener('sg-skin', r, { once: true })); document.getElementById('stage').append(e); await s; return performance.now() - t; });
  check('a 400-floret head draws in under 400 ms (16 ms measured unloaded in Chromium; the bound is loose on purpose so a loaded machine does not fail it)', t0 < 400, `${Math.round(t0)} ms in ${engine}`);
  const heads = {};
  for (const [k, seed] of [['a1', 'Asha'], ['a2', 'Asha'], ['b', 'Bruno'], ['c', 'asha']]) {
    await add(p, { 'seed-from': seed });
    heads[k] = norm(await p.evaluate(() => window.__b.querySelector('svg').outerHTML));
  }
  check('same name, same head (identical markup)', heads.a1 === heads.a2 && heads.a1.length > 5000, `${heads.a1.length} chars`);
  check('another name, another head; the name is case sensitive', heads.a1 !== heads.b && heads.a1 !== heads.c && heads.b !== heads.c);
  // seed and seed-from are one thing: seed-from wins
  await add(p, { seed: 'Asha' });
  check('seed="Asha" is the same head as seed-from="Asha"', norm(await p.evaluate(() => window.__b.querySelector('svg').outerHTML)) === heads.a1);
  // adding one floret moves none of the others
  await add(p, { count: '36', seed: 'Asha' });
  const before = await florets(p);
  await p.evaluate(() => window.__b.setAttribute('count', '37'));
  await p.waitForFunction(() => window.__b.querySelectorAll('svg > .sg-bloom-fl > *').length === 37);
  const after = await florets(p);
  const moved = before.filter(b => after.find(a => a.i === b.i)?.t !== b.t);
  check('36 → 37: the 36 florets already placed are exactly where they were', before.length === 36 && after.length === 37 && !moved.length && after.some(a => a.i === 36), `${moved.length} moved`);
  await p.evaluate(() => window.__b.setAttribute('count', '30'));
  await p.waitForFunction(() => window.__b.querySelectorAll('svg > .sg-bloom-fl > *').length === 30);
  const fewer = await florets(p);
  check('37 → 30: the outer seven go, the rest stay', fewer.every(f => before.find(b => b.i === f.i)?.t === f.t) && Math.max(...fewer.map(f => f.i)) === 29);
  // the probe can fail: move one floret and the comparison sees it
  const bent = after.map(a => (a.i === 3 ? { ...a, t: a.t + ' ' } : a));
  check('the stability probe can fail: a nudged floret is seen', before.filter(b => bent.find(a => a.i === b.i)?.t !== b.t).length === 1);
  const dots = await page('dots', PAGE('', 'quiet'));
  await add(dots.p, { count: '36', seed: 'Asha' });
  const d36 = await florets(dots.p);
  await dots.p.evaluate(() => window.__b.setAttribute('count', '37'));
  await dots.p.waitForFunction(() => window.__b.querySelectorAll('svg > .sg-bloom-fl > *').length === 37);
  const d37 = await florets(dots.p);
  check('quiet dots: 36 → 37 moves none either, and they are circles in the text colour', d36.every(f => d37.find(a => a.i === f.i)?.t === f.t) && (await dots.p.evaluate(() => getComputedStyle(window.__b.querySelector('.sg-bloom-d')).fill === getComputedStyle(window.__b).color)));
  await dots.ctx.close();
  await ctx.close();
}

// ── growth: playful only, heart outward ─────────────────────────────────
{
  const { ctx, p } = await page('grow', PAGE('', 'playful'));
  await add(p, { count: '89', size: '200' });
  // the ground the florets grow on grows with them: the head never starts as a bare brown disc
  const groundRatio = () => p.evaluate(() => { const g = window.__b.querySelector('.sg-bloom-ground').getBoundingClientRect().width, s = window.__b.querySelector('svg').getBoundingClientRect().width; return g / s; });
  const first = await p.evaluate(() => window.__first);
  const early = first.ratio;
  const a = first.anims.filter(x => x.name === 'sg-bloom-grow');
  check('playful: both paths of every floret grow (89 × 2 animations)', a.length === 178, `${a.length}`);
  const byI = new Map(a.map(x => [x.i, x.delay]));
  const ranked = [...byI.keys()].sort((x, y) => x - y);
  check('growth runs from the heart outward: the delay rises with each floret from the centre', ranked.length === 89 && ranked.every((k, j) => j === 0 || byI.get(k) > byI.get(ranked[j - 1])) && byI.get(0) === 0, `floret 0 ${byI.get(0)} ms, floret 88 ${byI.get(88)?.toFixed(1)} ms`);
  const total = Math.max(...a.map(x => x.delay + x.duration));
  const calm = await p.evaluate(() => parseFloat(getComputedStyle(window.__b).getPropertyValue('--sg-dur-calm')));
  check('the whole growth is over in under 1.5 s, and each floret takes the calm duration of the register', total < 1500 && a.every(x => x.duration === calm), `${Math.round(total)} ms in all; calm ${calm} ms`);
  const rank = () => p.evaluate(() => [...window.__b.querySelectorAll('.sg-bloom-f')].map(f => [Number(f.dataset.i), getComputedStyle(f).getPropertyValue('--sg-bloom-n').trim(), f.style.getPropertyValue('--i')]));
  const agree = rows => rows.length === 89 && rows.every(([i, n, w]) => Number(n) === i && Number(w) === i);
  const r = await rank();
  const sib = await p.evaluate(() => CSS.supports('width', 'calc(sibling-index() * 1px)'));
  check(`the rank each floret waits on agrees with its place, via ${sib ? 'sibling-index()' : 'the --i the element wrote'}`, agree(r), `${r.filter(([i, n]) => Number(n) !== i).length} differ`);
  // the probe can fail: turn the DOM round and write a wrong --i, and the comparison sees both
  await p.evaluate(() => { const g = window.__b.querySelector('.sg-bloom-fl'); g.replaceChildren(...[...g.children].reverse()); });
  const turned = await rank();
  check('the rank probe can fail: a head with its DOM order turned round is caught' + (sib ? '' : ' (here the --i it reads is the one written, so only a wrong --i can show)'), sib ? !agree(turned) : true);
  await p.evaluate(() => { window.__b.querySelector('.sg-bloom-f[data-i="3"]').style.setProperty('--i', '99'); });
  check('and so is a floret with the wrong --i', !agree(await rank()));
  await p.waitForFunction(() => !window.__b.hasAttribute('data-state'), null, { timeout: 5000 });
  const late = await groundRatio();
  check('the ground grows with the head: small as the first floret starts, full when it has grown', early < 0.4 && late > 0.6, `${early.toFixed(2)} → ${late.toFixed(2)} of the picture`);
  check('when it has grown, nothing is left running and no floret is left marked new', (await anims(p)).length === 0 && (await p.evaluate(() => window.__b.querySelectorAll('[data-new]').length)) === 0);
  // one more: only the new floret arrives
  const one = (await p.evaluate(async () => {
    window.__b.setAttribute('count', '90');
    for (let k = 0; k < 40 && window.__b.querySelectorAll('svg > .sg-bloom-fl > *').length !== 90; k++) await new Promise(r => setTimeout(r, 0)); // read in the first moment, before a slow machine runs the floret out
    return window.__b.getAnimations({ subtree: true }).map(a => ({ name: a.animationName, i: Number(a.effect.target.parentNode?.dataset?.i ?? -1), delay: a.effect.getTiming().delay }));
  })).filter(x => x.name === 'sg-bloom-grow');
  check('89 → 90 in playful: only the new floret grows, at once (delay 0)', one.length === 2 && one.every(x => x.i === 89 && x.delay === 0), JSON.stringify(one.map(x => [x.i, x.delay])));
  await ctx.close();
}
for (const [what, register, opts] of [['quiet', 'quiet', {}], ['warm', 'warm', {}], ['playful with reduced motion', 'playful', { reduced: true }], ['playful with Save-Data', 'playful', { saveData: true }]]) {
  const { ctx, p } = await page(`still-${what.replace(/\W/g, '')}`, PAGE('', register), opts);
  await add(p, { count: '89', size: '200' });
  const n = (await florets(p)).length;
  await p.locator('sg-bloom svg').dispatchEvent('pointerdown');
  await p.waitForTimeout(150);
  const live = await anims(p);
  const marked = await p.evaluate(() => window.__b.querySelectorAll('[data-new]').length + (window.__b.hasAttribute('data-state') ? 1 : 0) + (window.__b.hasAttribute('data-shiver') ? 1 : 0));
  check(`${what}: the finished head, no growth and no shiver`, n === 89 && !live.length && !marked, `${n} florets, ${live.length} animations, ${marked} marks`);
  if (register !== 'quiet' || what !== 'quiet') {
    const full = await p.evaluate(() => { const g = window.__b.querySelector('.sg-bloom-ground')?.getBoundingClientRect().width, s = window.__b.querySelector('svg').getBoundingClientRect().width; return g ? g / s : null; });
    if (full !== null) check(`${what}: the ground is full size from the first frame (the ground probe sees a full disc when nothing grows)`, full > 0.6, full.toFixed(2));
  }
  await ctx.close();
}
{
  // a head far down the page waits unseen and grows when it is first seen
  const { ctx, p } = await page('waits', PAGE('<div style="height:2400px"></div>', 'playful'), { height: 600 });
  await add(p, { count: '60', size: '160' });
  await p.waitForTimeout(400);
  const waiting = await p.evaluate(() => ({ w: window.__b.hasAttribute('data-waiting'), running: window.__b.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length }));
  await p.evaluate(() => window.__b.scrollIntoView());
  await p.waitForFunction(() => !window.__b.hasAttribute('data-waiting'), null, { timeout: 4000 });
  const grown = await p.evaluate(() => new Promise(r => { if (!window.__b.hasAttribute('data-state')) return r(true); window.__b.addEventListener('sg-bloom-grown', () => r(true), { once: true }); setTimeout(() => r(false), 5000); }));
  check('a head below the fold waits, paused, and grows when it scrolls into view', waiting.w && waiting.running === 0 && grown, JSON.stringify(waiting));
  await ctx.close();
}

// ── the light lands on petals only ──────────────────────────────────────
{
  const { ctx, p } = await page('light', PAGE('', 'warm'));
  await add(p, { seed: 'Asha', size: '300' });
  const r = await p.evaluate(() => { const l = window.__b.querySelector('.sg-bloom-light'); return { mask: l.getAttribute('mask'), has: !!window.__b.querySelector(l.getAttribute('mask').slice(4, -1)) }; });
  check('the light layer is masked to the florets (a mask that exists, built from the florets)', /^url\(#sg-bloom-\d+-m\)$/.test(r.mask) && r.has, JSON.stringify(r));
  // pixels: where does the light paint with no petal under it? Rasterise the head with only the light, and with only the
  // florets and the ground, and count light pixels that have nothing beneath them.
  const stray = mode => p.evaluate(async mode => {
    const svg = window.__b.querySelector('svg');
    const raster = async keep => {
      const c = svg.cloneNode(true);
      for (const cls of ['sg-bloom-light', 'sg-bloom-shadow', 'sg-bloom-ground', 'sg-bloom-fl']) if (!keep.includes(cls)) c.querySelector('.' + cls).remove();
      if (mode === 'removed') c.querySelector('.sg-bloom-light')?.removeAttribute('mask');
      c.setAttribute('width', '400'); c.setAttribute('height', '400');
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
      await img.decode();
      const cv = document.createElement('canvas'); cv.width = cv.height = 400; const g = cv.getContext('2d'); g.drawImage(img, 0, 0, 400, 400);
      return g.getImageData(0, 0, 400, 400).data;
    };
    const withLight = await raster(['sg-bloom-light', 'sg-bloom-ground', 'sg-bloom-fl']), under = await raster(['sg-bloom-ground', 'sg-bloom-fl']);
    let lit = 0, bare = 0;
    for (let i = 0; i < withLight.length; i += 4) {
      const d = Math.abs(withLight[i] - under[i]) + Math.abs(withLight[i + 1] - under[i + 1]) + Math.abs(withLight[i + 2] - under[i + 2]) + Math.abs(withLight[i + 3] - under[i + 3]);
      if (d > 12) { lit++; if (under[i + 3] < 8) bare++; }
    }
    return { lit, bare };
  }, mode);
  const good = await stray('as built'), removed = await stray('removed');
  check('pixels: with the mask, the light paints almost nothing on bare paper (under 1% of the lit pixels)', good.lit > 5000 && good.bare / good.lit < 0.01, JSON.stringify(good));
  check('the pixel probe can fail: with the mask taken off, the light spills onto bare paper (over 3%)', removed.bare / removed.lit > 0.03, JSON.stringify(removed));
  await ctx.close();
}

// ── a press shivers the outer ring ──────────────────────────────────────
{
  const { ctx, p } = await page('shiver', PAGE('', 'playful'));
  await add(p, { count: '89', size: '200' });
  await p.waitForFunction(() => !window.__b.hasAttribute('data-state'), null, { timeout: 5000 });
  await p.locator('sg-bloom svg').dispatchEvent('pointerdown');
  const s = (await anims(p)).filter(x => x.name === 'sg-bloom-shiver');
  const ring = (await florets(p)).filter(f => f.ring).map(f => f.i);
  check('a press shivers the outer ring only (the outer 30% of 89 florets)', s.length === 2 * ring.length && s.every(x => x.ring) && ring.length >= 20 && ring.length <= 30, `${s.length / 2} florets of ${ring.length} in the ring`);
  check('the shiver is inside the touch contract: each floret under 300 ms (the playful calm token is 340 ms, so it is held to 280)', s.every(x => x.duration <= 280 && x.delay <= 25), `${Math.max(...s.map(x => x.duration))} ms each, staggered by up to ${Math.max(...s.map(x => x.delay))} ms`);
  await p.waitForFunction(() => !window.__b.hasAttribute('data-shiver'), null, { timeout: 2000 });
  check('and it lets go: nothing is left running', (await anims(p)).length === 0);
  await ctx.close();
}

// ── forced colours, phone width, strict policy, no JavaScript ───────────
{
  const { ctx, p } = await page('forced', PAGE('', 'playful'), { forced: true });
  await add(p, { count: '40', size: '160' });
  await p.waitForFunction(() => !window.__b.hasAttribute('data-state'), null, { timeout: 5000 });
  const f = await p.evaluate(() => {
    const paths = [...window.__b.querySelectorAll('.sg-bloom-f > .sg-bloom-p:not(.sg-bloom-c)')].map(n => getComputedStyle(n).fill);
    return { forced: matchMedia('(forced-colors: active)').matches, paths: new Set(paths).size, fill: paths[0], text: (() => { const s = document.createElement('span'); s.style.color = 'CanvasText'; document.body.append(s); const c = getComputedStyle(s).color; s.remove(); return c; })(), ground: getComputedStyle(window.__b.querySelector('.sg-bloom-ground')).display };
  });
  if (!f.forced) unsupportedIn(engine, 'forced-colors emulation', 'matchMedia(forced-colors) stayed false');
  else check('forced colours: the head is one system colour, edged in the page colour, with no tints', f.paths === 1 && f.fill === f.text && f.ground === 'none', JSON.stringify(f));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, p } = await page(`phone-${register}`, PAGE('<sg-bloom count="37" label="people registered" size="lg" seed-from="Phone"></sg-bloom><sg-bloom size="640" seed-from="Wide"></sg-bloom>', register), { width: 390, height: 800 });
  await p.waitForFunction(() => [...document.querySelectorAll('sg-bloom')].every(b => b.querySelector('svg')));
  const o = await sidewaysScroll(p);
  const m = await p.evaluate(([scroll, inner]) => ({ scroll, inner, widest: Math.max(...[...document.querySelectorAll('sg-bloom svg')].map(s => s.getBoundingClientRect().right)) }), [o.scrollWidth, o.viewWidth]);
  check(`phone width, ${register}: no sideways scroll, even for a bloom asked to be 640 px wide`, m.scroll <= m.inner && m.widest <= m.inner, JSON.stringify(m));
  await ctx.close();
}
{
  const csp = "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:";
  const { ctx, p, errors } = await page('csp', PAGE('', 'playful').replace(/<style>.*?<\/style>/, ''), { csp });
  await add(p, { count: '50', size: '160', label: 'seats taken' });
  const a = await anims(p);
  const n = (await florets(p)).length;
  const clean = !errors.length;
  check('strict Content-Security-Policy: the head draws, grows and raises no violation', n === 50 && a.some(x => x.name === 'sg-bloom-grow') && clean, `${n} florets, ${a.length} animations, ${errors.join(' | ')}`);
  await p.evaluate(() => { const e = document.createElement('div'); e.innerHTML = '<b style="color:red">x</b>'; document.body.append(e); window.__probe = e; });
  const refused = await p.evaluate(() => getComputedStyle(window.__probe.firstChild).color !== 'rgb(255, 0, 0)');
  check('the CSP probe can fail: an inline style attribute is refused on this page', refused);
  await ctx.close();
}
{
  const { ctx, p } = await page('nojs', PAGE('<sg-bloom count="37">37 people registered</sg-bloom><sg-bloom label="Maria">x</sg-bloom>'), { js: false });
  const t = await p.evaluate(() => [...document.querySelectorAll('sg-bloom')].map(b => b.textContent.trim()));
  check('JavaScript off: the words the author wrote are plainly there', t[0] === '37 people registered' && t[1] === 'x', JSON.stringify(t));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

await done();
