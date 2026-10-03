// Browser checks for how the words share the veranda (<sg-veranda-stage>, words.html): nothing over other words, nothing hidden
// while the camera or the lens changes what is in front, and a lens that leaves the words one block.
//
//   node packages/scenes/veranda/arrange.check.mjs            (or: npm run check)
//   node packages/scenes/veranda/arrange.check.mjs --break    (against patched builds: every check marked below must FAIL)
//
// Runs on this machine's GPU (ANGLE on Direct3D 11). Nothing here trusts the element's own model of where things are: the boxes are
// the page's own (Range rects of the real text, the pot's own spans), and what hides the pane is worked out again from world.js's
// G-buffer, one photo pixel at a time through <sg-depth-photo>'s place() for the camera as it stands.
//
//  1. words never over words: in every state (at load, at each stop of the walk, the lens on and off, and after the pane is
//     dropped on a note and on the pot's paragraph) no line box of any set of words meets a line box of another;
//  2. never hidden while things move: at each stop of the walk, and with the lens on and off, no line of the pane has more than
//     15% of its area behind something nearer than the pane;
//  4. no stall while the camera moves with both panes of glass on screen: over six seconds of camera movement, in three fresh browser
//     contexts, no frame takes longer than 250 ms (on this machine's integrated GPU two backdrop blurs over a moving picture made the
//     GPU raster stall for a full second at a random moment, in about half the contexts, until the pot's pane dropped its blur while
//     the camera moves);
//  3. the lens leaves the words alone: with it on, the pane's lines are where they were with it off (same rects, same count),
//     and the lens button touches no line;


//
// --break patches the served build once per family: a pane that ignores the other words (1), one that settles at load and on
// release only, never when the camera moves (2), a lens that sets the words in chips (3a), a lens button laid over the words (3b), a pot's
// pane that keeps its blur while the camera moves (4).

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const BREAK = process.argv.includes('--break');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const server = await startServer({ quiet: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

const BREAKS = {
  ignoresOthers: [/stage-element\.js$/, s => s.replace('#others() { const flow', '#others() { return []; const flow')],
  loadAndReleaseOnly: [/stage-element\.js$/, s => s.replace('#arrangeSoon(ms = 120) {', '#arrangeSoon(ms = 120) {\n    if (window.__frozen) return;').replace('this.#arrT = 0; this.#settle({ quiet: true });', 'this.#arrT = 0; if (window.__frozen) return; this.#settle({ quiet: true });')],
  chips: [/stage-element\.js$/, s => s.replace('.panel.lens > :is(h1,h2,h3,h4,h5,h6,p,li){position:relative;z-index:2}', '.panel.lens > :is(h1,h2,h3,h4,h5,h6,p,li){position:relative;z-index:2;width:fit-content;max-width:100%;background:color-mix(in oklab,var(--sg-surface-raised,Canvas) 92%,transparent);padding:.15em .5em;border-radius:5px}')],
  blurWhileMoving: [/stage-element\.js$/, s => s.replace('sg-veranda-stage[data-moving] .flow-card{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}\n', '')],
  buttonOver: [/stage-element\.js$/, s => s.replace('.lens-btn{position:absolute;z-index:3;left:1.1em;bottom:.6em;', '.lens-btn{position:absolute;z-index:3;left:1.1em;top:.6em;')],
};

async function open({ query = 'register=warm', hash = '#notes=window.1,door.3,lamp.2,pillar.0', patches = [], width = 1280 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  for (const key of BREAK ? patches : []) {
    const [re, fn] = BREAKS[key];
    await context.route(u => re.test(u.pathname), async r => { const res = await r.fetch(); r.fulfill({ response: res, body: fn(await res.text()) }); });
  }
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${server.url}/packages/scenes/veranda/words.html?${query}${hash}`);
  await page.waitForFunction(() => window.__ready === true && !!window.__stage.matka?.pose, null, { timeout: 90000 });
  await page.addScriptTag({ content: PROBE });
  await page.waitForTimeout(1200);
  return { context, page, errors };
}

/** In the page: every set of words as boxes in stage px, and what hides the pane, worked out again from the drawing's own solids. */
const PROBE = `
window.__lines = () => {
  const s = window.__stage, st = s.querySelector('.stage').getBoundingClientRect(), out = { pane: [], flow: [], notes: [], btn: null, panel: null, stage: { w: st.width, h: st.height } };
  const rel = q => ({ x: q.left - st.left, y: q.top - st.top, w: q.width, h: q.height });
  const ranges = el => { const r = document.createRange(); r.selectNodeContents(el); return [...r.getClientRects()].filter(q => q.width > 1 && q.height > 1).map(rel); };
  for (const el of s.pane.children) if (!el.matches('.grip,.lens-view,.lens-btn')) out.pane.push(...ranges(el));
  for (const sp of s.querySelectorAll('.flow-card span[data-line]')) out.flow.push(...ranges(sp));
  for (const p of s.querySelectorAll('.note p')) out.notes.push(ranges(p));
  const b = s.querySelector('.lens-btn'); if (b && getComputedStyle(b).display !== 'none') out.btn = rel(b.getBoundingClientRect());
  out.panel = rel(s.pane.getBoundingClientRect());
  return out;
};
window.__hits = () => {
  const L = window.__lines(), hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y, out = [];
  const sets = [['pane', L.pane], ['pot paragraph', L.flow], ...L.notes.map((r, i) => ['note ' + (i + 1), r])];
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) for (const a of sets[i][1]) for (const b of sets[j][1]) if (hit(a, b)) { out.push(sets[i][0] + ' / ' + sets[j][0]); break; }
  return [...new Set(out)];
};
window.__worst = async () => {
  const w = await import('/packages/scenes/veranda/world.js'), s = window.__stage, dp = s.depthPhoto, st = s.querySelector('.stage').getBoundingClientRect();
  if (!window.__G) { const G = w.gbuffer(); window.__G = { G, bytes: w.depthMap(G) }; }
  const { G, bytes } = window.__G, d = s.paneDepth, cut = Math.round(d * 255) + 2, cw = Math.ceil(st.width / 3), ch = Math.ceil(st.height / 3), grid = new Uint8Array(cw * ch);
  // every second photo pixel nearer than the pane, placed exactly where the camera puts it, and spread over the pixel's own footprint
  for (let j = 0; j < G.h; j += 2) for (let i = 0; i < G.w; i += 2) {
    const b = bytes[j * G.w + i]; if (b <= cut) continue;
    const a = dp.place(i / G.w, j / G.h, b / 255), c = dp.place((i + 2) / G.w, (j + 2) / G.h, b / 255);
    const x0 = Math.floor(Math.min(a[0], c[0]) / 3), x1 = Math.floor(Math.max(a[0], c[0]) / 3), y0 = Math.floor(Math.min(a[1], c[1]) / 3), y1 = Math.floor(Math.max(a[1], c[1]) / 3);
    for (let y = Math.max(0, y0); y <= Math.min(ch - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(cw - 1, x1); x++) grid[y * cw + x] = 1;
  }
  const shares = window.__lines().pane.map(r => { let n = 0, hid = 0; for (let y = r.y + 2; y < r.y + r.h; y += 4) for (let x = r.x + 2; x < r.x + r.w; x += 4) { n++; if (grid[Math.floor(y / 3) * cw + Math.floor(x / 3)]) hid++; } return n ? hid / n : 0; });
  return { worst: Math.max(0, ...shares), d, at: (r => [Math.round(r.x), Math.round(r.y)])(window.__lines().panel) };
};`;

const settle = p => p.page.waitForTimeout(900);
// the walk's stops for four notes (walkPlan). A person walks in to the last stop, puts the words where they read there (a place at a
// middle depth that is clear at that stop), and walks back out: what stands in front of the words grows on the way back.
const DOLLIES = [0.71, 0.41, 0.12];
const fmt = (h) => h.length ? h.join('; ') : 'none';

// 1 and 2: the states of the page, each looked at the same way
async function gather(patches) {
  const rows = [];
  const state = async (label, p, act) => { if (act) await act(p); await settle(p); rows.push({ label, hits: await p.page.evaluate(() => window.__hits()), cover: await p.page.evaluate(() => window.__worst()) }); };
  const dropOn = sel => async p => {
    const t = await p.page.evaluate(sel => { const n = (sel === 'flow' ? window.__stage.matka.card : document.querySelector(sel)).getBoundingClientRect(), g = window.__stage.querySelector('.grip').getBoundingClientRect(), pr = window.__stage.pane.getBoundingClientRect(); return { from: [g.left + g.width / 2, g.top + g.height / 2], to: [n.left + n.width / 2 + (g.left - pr.left) - pr.width / 2, n.top + n.height / 2 + (g.top - pr.top) - pr.height / 2] }; }, sel);
    await p.page.mouse.move(...t.from); await p.page.mouse.down(); await p.page.mouse.move(...t.to, { steps: 10 }); await p.page.mouse.up();
  };
  const p = await open({ patches });
  await state('at load', p);
  await state('the pane dropped on the pot\'s paragraph', p, dropOn('flow'));
  await state('the pane dropped on a note', p, dropOn('.note[data-anchor=door]'));
  await p.context.close();
  const q = await open({ patches });
  await q.page.evaluate(() => { window.__stage.depthPhoto.set({ dolly: 1 }); });
  await q.page.waitForTimeout(900);
  await q.page.evaluate(() => { const s = window.__stage; window.__frozen = true; s.setAttribute('words-at', '0.4 0.15'); s.paneDepth = 0.45; });
  await q.page.waitForTimeout(500);
  const prep = await q.page.evaluate(() => window.__worst());
  for (const dolly of DOLLIES) await state(`the walk at ${dolly.toFixed(2)}`, q, async q => { await q.page.evaluate(d => { window.__frozen = true; window.__stage.depthPhoto.set({ dolly: d }); }, dolly); });
  await q.context.close();
  // the lens, off and then on in both weathers (playful is the register that offers it)
  const r = await open({ query: 'register=playful', patches });
  await state('the lens off', r);
  for (const mood of ['monsoon', 'dusk']) await state(`the lens on: ${mood}`, r, async r => { await r.page.evaluate(m => window.__stage.setAttribute('lens', m), mood); });
  await r.context.close();
  return { rows, prep };
}
/** The lens's own promise: the lines are where they were (relative to the pane), and the button is clear of every one of them. */
async function lens(patches) {
  const p = await open({ query: 'register=playful', hash: '', patches });
  const read = () => p.page.evaluate(() => { const L = window.__lines(); return { lines: L.pane.map(r => ({ x: r.x - L.panel.x, y: r.y - L.panel.y, w: r.w, h: r.h })), raw: L.pane, btn: L.btn, panel: L.panel }; });
  const off = await read(), seen = [];
  for (const mood of ['monsoon', 'dusk']) {
    await p.page.evaluate(m => window.__stage.setAttribute('lens', m), mood);
    await p.page.waitForTimeout(1300);
    const on = await read();
    const same = on.lines.length === off.lines.length && on.lines.every((l, i) => ['x', 'y', 'w', 'h'].every(k => Math.abs(l[k] - off.lines[i][k]) <= 1.5));
    const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const touching = on.raw.filter(l => on.btn && hit(l, on.btn)).length;
    const inside = !!on.btn && on.btn.x >= on.panel.x - 1 && on.btn.y >= on.panel.y - 1 && on.btn.x + on.btn.w <= on.panel.x + on.panel.w + 1 && on.btn.y + on.btn.h <= on.panel.y + on.panel.h + 1;
    seen.push({ mood, same, touching, inside, n: on.lines.length, offN: off.lines.length });
  }
  const offBtnTouch = off.raw.filter(l => off.btn && l.x < off.btn.x + off.btn.w && l.x + l.w > off.btn.x && l.y < off.btn.y + off.btn.h && l.y + l.h > off.btn.y).length;
  await p.context.close();
  return { seen, offBtnTouch, hasBtn: !!off.btn };
}
const detailLens = r => r.seen.map(s => `${s.mood}: ${s.n} of ${s.offN} lines ${s.same ? 'in place' : 'MOVED'}, button ${s.touching ? `touches ${s.touching}` : 'clear'}${s.inside ? '' : ', outside the pane'}`).join('; ');

/** Six seconds of camera movement on the words page, in a fresh context: the longest frame. */
async function longestFrame(patches) {
  const p = await open({ hash: '', patches });
  await p.page.evaluate(() => { window.__f = []; let q = -1; const t = n => { if (q >= 0) window.__f.push(n - q); q = n; requestAnimationFrame(t); }; requestAnimationFrame(t); const dp = window.__stage.depthPhoto, t0 = performance.now(); const f = n => { dp.set({ dolly: 0.5 + 0.5 * Math.sin((n - t0) / 1000) }); requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await p.page.waitForTimeout(6500);
  const worst = await p.page.evaluate(() => Math.max(...window.__f.slice(2)));
  await p.context.close();
  return Math.round(worst);
}
for (const patches of BREAK ? [['ignoresOthers'], ['loadAndReleaseOnly'], ['chips'], ['buttonOver'], ['blurWhileMoving']] : [[]]) {
  const only = patches[0];
  if (!only || only === 'ignoresOthers' || only === 'loadAndReleaseOnly') {
    const { rows, prep } = await gather(patches);
    const bad = rows.filter(r => r.hits.length);
    if (!only || only === 'ignoresOthers') check('words never over words: no line box of the pane, the notes or the pot\'s paragraph meets another, at load, on a walk, with the lens, and after a drop on a note and on the paragraph', !bad.length && rows.length === 9, bad.length ? bad.map(r => `${r.label}: ${fmt(r.hits)}`).join(' | ') : `${rows.length} states, no meeting`);
    const over = rows.filter(r => r.cover.worst > 0.15);
    if (!only || only === 'loadAndReleaseOnly') check('never hidden while things move: at each stop of the walk back out, and with the lens off and on, no line of the pane is more than 15% behind something nearer', !over.length && prep.worst <= 0.15 && rows.length === 9, over.length ? over.map(r => `${r.label}: ${(r.cover.worst * 100).toFixed(0)}% at depth ${r.cover.d.toFixed(2)}`).join(' | ') : `worst ${(Math.max(...rows.map(r => r.cover.worst)) * 100).toFixed(1)}% over ${rows.length} states; the words start the walk back at depth ${prep.d.toFixed(2)}, ${(prep.worst * 100).toFixed(0)}% covered`);
  }
  if (!only || only === 'blurWhileMoving') {
    const worst = [];
    for (let k = 0; k < 3; k++) worst.push(await longestFrame(patches));
    check('no stall while the camera moves with both panes of glass on screen: six seconds of camera movement, three fresh contexts, no frame over 250 ms', worst.every(w => w <= 250), `longest frames ${worst.join(', ')} ms`);
  }
  if (!only || only === 'chips' || only === 'buttonOver') {
    const r = await lens(patches);
    check('the lens leaves the words alone: with it on, the lines are where they were with it off and the lens button touches none of them', r.hasBtn && r.offBtnTouch === 0 && r.seen.every(s => s.same && !s.touching && s.inside && s.n >= 3), detailLens(r));
  }
}

await browser.close(); await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} pass${BREAK ? ' (--break: the patched builds should FAIL their checks)' : ''}`);
process.exit(BREAK ? 0 : failed ? 1 : 0);
