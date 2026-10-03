// Browser checks for the paragraph that flows round the turning pot (matka-view.js, in <sg-veranda-stage>; words.html).
//
//   node packages/scenes/veranda/flow.check.mjs            (or: npm run check)
//   node packages/scenes/veranda/flow.check.mjs --break    (against patched builds: the marked checks must FAIL)
//
// Runs on this machine's GPU (ANGLE on Direct3D 11) so three.js really draws the pot.
//
//  1. the lines clear the pot: at four turns of the pot, no line box meets a pixel three drew (read back from its canvas);
//  2. the layout moves in steps: over four seconds the lines are re-laid a handful of times (sixteen steps a turn), never every
//     frame, and no line jumps more than a few pixels when it does;
//  3. real text: the paragraph is whole and in order in the accessibility tree, live, in 2D and in quiet;
//  4. the still: on the 2D tier, in quiet and under reduced motion the pot is drawn once and the lines are laid once (the layout
//     does not change over three seconds), and no request for three.js is made where the page does not need it;
//  5. what three drew is the silhouette the layout used: three's projected vertices against the pure silhouette at the same turn.
//
// --break: a flow that ignores the pot (1), a layout redone every frame (2).

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const BREAK = process.argv.includes('--break');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const server = await startServer({ quiet: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const THREE = /node_modules\/three\/|three\.named\.js|three(\.module|\.core)?\.js/;
const TEXT = 'The clay pot on the seat is where the water is kept cool. It has stood there since before the roof was retiled, and it turns, slowly, when nobody is looking, so that every side of it gets the same share of the evening light.';

const BREAKS = {
  ignoresPot: [/matka-view\.js$/, s => s.replace('(top, bottom) => extentIn(pot, top, bottom)', '() => null')],
  everyFrame: [/matka-view\.js$/, s => s.replace('if (step !== laidStep || key !== laidKey) {', 'if (true) {').replace('lay(s, f, quantise(th, STEPS));', 'lay(s, f, th);')],
};
async function open({ query = 'register=warm', reduced = false, noGL = false, patches = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const requests = [], errors = [];
  context.on('request', r => requests.push(r.url()));
  if (noGL) await context.addInitScript("const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); };");
  for (const key of BREAK ? patches : []) {
    const [re, fn] = BREAKS[key];
    await context.route(u => re.test(u.pathname), async r => { const res = await r.fetch(); r.fulfill({ response: res, body: fn(await res.text()) }); });
  }
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${server.url}/packages/scenes/veranda/words.html?${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__stage.matka?.pose, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  return { context, page, requests, errors, three: () => requests.filter(u => THREE.test(u)) };
}
/** The lines' signature: every span's text and where it sits, so a re-layout shows as a change. */
const SIG = () => [...window.__stage.matka.card.querySelectorAll('span[data-line]')].map(s => `${s.textContent}@${s.style.left},${s.style.top}`).join('|');

// 1. the lines clear the pot
{
  const p = await open({ patches: ['ignoresPot'] });
  const worst = [];
  for (let k = 0; k < 4; k++) {
    await p.page.waitForTimeout(1100);
    worst.push(await p.page.evaluate(() => {
      const m = window.__stage.matka, px = m.pixels(), spans = [...m.card.querySelectorAll('span[data-line]')], k = px.w / px.rect.width;
      let touched = 0, lines = 0;
      for (const sp of spans) {
        const r = sp.getBoundingClientRect(); lines++;
        const x0 = Math.floor((r.left - px.rect.left) * k), x1 = Math.ceil((r.right - px.rect.left) * k), y0 = Math.floor((r.top - px.rect.top) * k), y1 = Math.ceil((r.bottom - px.rect.top) * k);
        let hit = false;
        for (let y = Math.max(0, y0); y < Math.min(px.h, y1) && !hit; y++) for (let x = Math.max(0, x0); x < Math.min(px.w, x1); x++) if (px.alpha[y * px.w + x] > 40) { hit = true; break; }
        if (hit) touched++;
      }
      return { touched, lines, step: m.pose.step };
    }));
  }
  check('the lines clear the pot: at four turns of it no line box meets a pixel three drew', worst.every(w => w.lines >= 4 && w.touched === 0), worst.map(w => `step ${w.step}: ${w.touched} of ${w.lines} lines touch it`).join('; '));
  // 1b. the pot stands at the pane's corner: its drawn silhouette crosses the pane's edge, and the pot alone shortens at least three lines
  const g = await p.page.evaluate(() => {
    const m = window.__stage.matka, px = m.pixels(), k = px.w / px.rect.width, card = m.card.getBoundingClientRect();
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.alpha[y * px.w + x] > 40) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
    const pot = { left: px.rect.left + l / k, right: px.rect.left + r / k, top: px.rect.top + t / k, bottom: px.rect.top + b / k };
    const lines = m.lines(), short = lines.filter(q => q.room < q.full - 8), rows = short.filter(q => q.y + q.h > pot.top - window.__stage.querySelector('.stage').getBoundingClientRect().top - 2 && q.y < pot.bottom - window.__stage.querySelector('.stage').getBoundingClientRect().top + 2);
    return { pot, card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom }, lines: lines.length, short: short.length, beside: rows.length, deepest: Math.round(Math.max(0, ...short.map(q => 1 - q.w / q.full)) * 100) };
  });
  const straddles = g.pot.left < g.card.right - 8 && g.pot.right > g.card.right + 8 && g.pot.top >= g.card.top - 2 && g.pot.bottom <= g.card.bottom + 2;
  check('the pot stands at the pane\'s corner: its silhouette crosses the pane\'s edge and at least three lines are shortened by it', straddles && g.short >= 3 && g.beside === g.short, `the pot spans x ${Math.round(g.pot.left)}-${Math.round(g.pot.right)} against the pane's right edge at ${Math.round(g.card.right)}; ${g.short} of ${g.lines} lines shortened (up to ${g.deepest}%), ${g.beside} of them at the pot's height`);
  await p.context.close();
}

// 2. the layout moves in steps
{
  const p = await open({ patches: ['everyFrame'] });
  const r = await p.page.evaluate(async sig => {
    const f = new Function('return ' + sig)();
    let last = f(), changes = 0, frames = 0, worst = 0, prev = [...window.__stage.matka.card.querySelectorAll('span[data-line]')].map(s => parseFloat(s.style.left));
    const t0 = performance.now();
    await new Promise(res => { const tick = () => { frames++; const now = f(); if (now !== last) { changes++; last = now; const cur = [...window.__stage.matka.card.querySelectorAll('span[data-line]')].map(s => parseFloat(s.style.left)); for (let i = 0; i < Math.min(cur.length, prev.length); i++) worst = Math.max(worst, Math.abs(cur[i] - prev[i])); prev = cur; } if (performance.now() - t0 < 4500) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    return { changes, frames, worst: Math.round(worst) };
  }, SIG.toString());
  check('the layout moves in steps: over 4.5 s the lines are re-laid a handful of times, never every frame, and never jump far', r.changes <= 10 && r.frames > 100 && r.worst <= 40, `${r.changes} re-layouts in ${r.frames} frames, the biggest shift of a line ${r.worst} px`);
  await p.context.close();
}

// 3. real text
{
  const seen = [];
  for (const [tier, opts] of [['live', {}], ['2D', { noGL: true }], ['quiet', { query: 'register=quiet' }]]) {
    const p = await open(opts);
    const words = await p.page.evaluate(() => window.__stage.matka.card.textContent.replace(/\s+/g, ' ').trim());
    const snap = (await p.page.locator('sg-veranda-stage .flow-card').ariaSnapshot()).replace(/\n/g, ' ').replace(/\s+/g, ' ');
    seen.push({ tier, ok: words === TEXT && snap.includes('The clay pot on the seat is where the water is kept cool.') && snap.includes('every side of it gets the same share of the evening light.'), mode: await p.page.evaluate(() => window.__stage.dataset.flow) });
    await p.context.close();
  }
  check('real text: the whole paragraph is in the page, in order, live, in 2D and in quiet', seen.every(s => s.ok), seen.map(s => `${s.tier}: ${s.ok} (${s.mode})`).join('; '));
}

// 4. the still
{
  const rows = [];
  for (const [label, opts] of [['2D tier', { noGL: true }], ['quiet', { query: 'register=quiet' }], ['reduced motion', { reduced: true }]]) {
    const p = await open(opts);
    const r = await p.page.evaluate(async sig => {
      const f = new Function('return ' + sig)(), m = window.__stage.matka, a = f();
      await new Promise(r => setTimeout(r, 3000));
      const px = m.pixels(); let opaque = 0; for (const v of px.alpha) if (v > 40) opaque++;
      return { same: f() === a, mode: window.__stage.dataset.flow, opaque, lines: m.card.querySelectorAll('span[data-line]').length };
    }, SIG.toString());
    rows.push({ label, ...r, three: p.three().length });
    await p.context.close();
  }
  check('the still: on the 2D tier, in quiet and under reduced motion the pot is drawn once and the lines are laid once, with no three.js asked for', rows.every(r => r.same && r.mode === 'still' && r.opaque > 400 && r.lines >= 4 && r.three === 0), rows.map(r => `${r.label}: laid once ${r.same}, ${r.opaque} pot pixels, ${r.three} three requests`).join('; '));
}

// 5. what three drew is the silhouette the layout used
{
  const p = await open();
  const r = await p.page.evaluate(async () => {
    const core = await import('/packages/scenes/veranda/matka.core.js'), m = window.__stage.matka;
    let worst = 0, bands = 0;
    for (let k = 0; k < 4; k++) {
      await new Promise(r => setTimeout(r, 700));
      const pose = m.pose; if (!pose?.screen) continue;
      const pure = core.toScreen(core.surfacePoints(pose.th), pose.f.cx, pose.f.cy, pose.s.h);
      // three's vertices are the profile's rings, the handle and the spout: at each ring's height the two silhouettes must agree,
      // and everywhere three has a vertex it lies inside the pure silhouette (which also interpolates between the rings)
      for (const [, hy] of core.MATKA.profile.slice(1, -1)) {
        const top = pose.f.cy - hy * pose.s.h - 2, e1 = core.extentIn(pure, top, top + 4), e2 = core.extentIn(pose.screen, top, top + 4);
        if (!e1 || !e2) continue;
        bands++; worst = Math.max(worst, Math.abs(e1[0] - e2[0]), Math.abs(e1[1] - e2[1]));
      }
      for (const [x, y] of pose.screen) { const e = core.extentIn(pure, y - 1, y + 1); if (!e) { worst = Math.max(worst, 99); continue; } worst = Math.max(worst, e[0] - x, x - e[1]); }
    }
    return { worst: +worst.toFixed(2), bands };
  });
  check('what three drew is the silhouette the layout used: its projected vertices against the pure silhouette at the same turn', r.bands >= 20 && r.worst < 4.5, `${r.bands} ring heights over four turns, worst disagreement ${r.worst} px`);
  await p.context.close();
}

await browser.close(); await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} pass${BREAK ? ' (--break: the patched builds should FAIL their checks)' : ''}`);
process.exit(BREAK ? 0 : failed ? 1 : 0);
