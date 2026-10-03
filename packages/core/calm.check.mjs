// Browser checks for the scene's keep-away list (the calm rects a renderer is given):
//
//   node packages/core/calm.check.mjs
//
// 1. the stale-calm bug: change only --sg-reading-place (on the element, then
//    through an ancestor's class) and the calm rect follows the words, whether
//    the scene is running or held still (control: core with the fix patched
//    out is caught, as is core as it stood on 654935d when SG_OLD_CORE is set);
// 2. keepClear(id, rect) joins the list beside the slotted words, replaces by
//    id, leaves with null, and the scene redraws with it (control: a renderer
//    that never sees the rect is caught by the same probe).

import { readFileSync } from 'node:fs';
import { harness } from '../../tools/lib/component-check.mjs';
import { contextOptions } from '../../tools/lib/engine.mjs';

const h = await harness();
const { check, browser, server, engine } = h;
const CORE = new URL('./scene-element.js', import.meta.url);

/** A fresh page on the blank harness page; `patch` is [from, to] pairs applied to core's source (each must be found). */
async function open({ patch = [], body = null } = {}) {
  const errors = [];
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1000, height: 800 } }));
  let source = body ?? readFileSync(CORE, 'utf8');
  for (const [from, to] of patch) {
    if (!source.includes(from)) throw new Error(`patch did not apply: ${from}`);
    source = source.replace(from, to);
  }
  if (patch.length || body) await ctx.route('**/packages/core/scene-element.js*', r => r.fulfill({ contentType: 'text/javascript; charset=utf-8', body: source }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${server.url}/tools/harness/blank.html`);
  return { ctx, page, errors };
}

/** Mount a probe scene whose renderer records every calm list it is handed. Runs in the page. */
const mountProbe = () => {
  return async () => {
    const { defineScene } = await import('/packages/core/index.js');
    window.__renders = 0;
    defineScene({
      name: 'calm-probe', meta: { W: 1200, H: 800, title: 'Probe', alt: 'Probe' }, params: {}, model: () => ({}), kind: 'canvas2d', interactive: [],
      createRenderer: () => ({ render(d, f) { window.__renders++; window.__calm = f.calm.map(r => ({ ...r })); }, destroy() {} }),
    });
    const box = document.createElement('div');
    box.id = 'box'; box.style.cssText = 'width:900px;margin:0 auto';
    box.innerHTML = '<sg-scene name="calm-probe"><h2 style="margin:0">Come for the rain</h2><p style="margin:0">Our lowest rate, June to September.</p></sg-scene>';
    document.body.append(box);
    const el = box.firstElementChild;
    await new Promise(r => { el.addEventListener('sg-ready', r, { once: true }); });
    return true;
  };
};

/** Where the slotted words really are, in logical units, and the rect the renderer was last given first. */
const truth = () => {
  const el = document.querySelector('sg-scene'), st = el.shadowRoot.querySelector('.stage'), s = st.getBoundingClientRect();
  const k = 1200 / s.width, r = el.querySelector('h2').getBoundingClientRect();
  const words = { x: (r.left - s.left) * k, y: (r.top - s.top) * k };
  const got = window.__calm?.[0] ?? null;
  return { words, got, gap: got ? Math.hypot(got.x - words.x, got.y - words.y) : null };
};
const settle = page => page.evaluate(() => new Promise(r => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 120)));

/** Every way the reading place can change without anything resizing; the gap (logical units) between the renderer's calm and the words. */
async function staleCalm(opts) {
  const { ctx, page, errors } = await open(opts);
  await page.evaluate(mountProbe());
  await settle(page);
  const start = await page.evaluate(truth);
  const out = { start: start.gap };
  // a. the element's own style, the scene running
  await page.evaluate(() => document.querySelector('sg-scene').style.setProperty('--sg-reading-place', 'start end'));
  await settle(page);
  out.running = (await page.evaluate(truth)).gap;
  // b. the same again, the scene held still (nothing draws until something asks)
  await page.evaluate(() => { const el = document.querySelector('sg-scene'); el.still(); el.style.setProperty('--sg-reading-place', 'center start'); });
  await settle(page);
  out.held = (await page.evaluate(truth)).gap;
  // c. an ancestor's class and a stylesheet rule, the scene held still
  await page.evaluate(() => {
    const st = document.createElement('style'); st.textContent = '#box.top sg-scene{--sg-reading-place:start start}'; document.head.append(st);
    document.querySelector('sg-scene').style.removeProperty('--sg-reading-place');
    document.getElementById('box').classList.add('top');
  });
  await settle(page);
  out.ancestor = (await page.evaluate(truth)).gap;
  // d. a stylesheet rule that lands with no attribute change anywhere (a media query flipping is the same event), the scene running again
  await page.evaluate(() => { const st = document.createElement('style'); st.textContent = 'sg-scene{--sg-reading-place:end end !important}'; document.head.append(st); });
  await page.evaluate(() => document.querySelector('sg-scene').play());
  await settle(page);
  await settle(page);
  out.sheet = (await page.evaluate(truth)).gap;
  await ctx.close();
  return { out, errors };
}
const fmt = o => Object.entries(o).map(([k, v]) => `${k} ${v === null ? 'none' : v.toFixed(1)}`).join(', ');
const followed = o => Object.values(o).every(v => v !== null && v < 3);

// 1. the stale-calm bug
{
  const { out, errors } = await staleCalm();
  check('the calm follows a change of only --sg-reading-place (element style, held, ancestor class, stylesheet)', followed(out), `gap between the renderer's calm and the words, logical units: ${fmt(out)}`);
  check('no console errors (calm)', errors.length === 0, errors.join(' | '));
  const src = readFileSync(CORE, 'utf8');
  if (src.includes('#watchPlace')) {
    // the fix is one named seam: patch out what it starts, and the same probe must go red
    const broken = await staleCalm({ patch: [['this.#watchPlace();', '']] });
    check('control: with the reading-place watcher patched out, the calm goes stale and the probe catches it', !followed(broken.out), fmt(broken.out));
  } else {
    check('control: core as it stood (no watcher) goes stale and the probe catches it', !followed(out), fmt(out));
  }
}

// 2. the keep-away list is open to anyone
{
  const list = async opts => {
    const { ctx, page, errors } = await open(opts);
    await page.evaluate(mountProbe());
    await settle(page);
    const out = await page.evaluate(async () => {
      const el = document.querySelector('sg-scene'), wait = () => new Promise(r => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 100));
      const seen = () => (window.__calm ?? []).map(r => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`);
      const r = { words: seen().length };
      el.keepClear('badge', { x: 900, y: 40, w: 200, h: 120 }); await wait();
      r.joined = seen().includes('900,40,200,120') && seen().length === r.words + 1;
      r.getter = el.calm.length === seen().length && el.calm.some(c => c.x === 900);
      el.keepClear('badge', { x: 100, y: 40, w: 50, h: 50 }); await wait();
      r.replaced = seen().includes('100,40,50,50') && !seen().includes('900,40,200,120') && seen().length === r.words + 1;
      el.still(); const before = window.__renders; el.keepClear('lamp', { x: 500, y: 300, w: 60, h: 60 }); await wait();
      r.redrew = window.__renders > before && seen().includes('500,300,60,60');
      el.keepClear('badge', null); el.keepClear('lamp', null); await wait();
      r.left = seen().length === r.words && el.calm.length === r.words;
      el.keepClear('nan', { x: NaN, y: 0, w: 5, h: 5 }); await wait();
      r.refused = seen().length === r.words;
      return r;
    });
    await ctx.close();
    return { out, errors };
  };
  const ok = o => o.words === 2 && o.joined && o.getter && o.replaced && o.redrew && o.left && o.refused;
  const { out, errors } = await list();
  check('keepClear: a rect joins beside the words, replaces by id, leaves with null, and a held scene redraws', ok(out), JSON.stringify(out));
  check('no console errors (keepClear)', errors.length === 0, errors.join(' | '));
  const broken = await list({ patch: [['[...this.#calm, ...this.#extra.values()]', 'this.#calm']] });
  check('control: a core that never merges the list is caught by the same probe', !ok(broken.out), JSON.stringify(broken.out));
}

await h.done();
