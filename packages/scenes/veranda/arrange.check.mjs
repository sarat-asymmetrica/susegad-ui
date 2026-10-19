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

import { harness } from '../../../tools/lib/component-check.mjs';
import { TIMERS_SCRIPT, stable } from '../../../tools/lib/wait.mjs';

const BREAK = process.argv.includes('--break');
const h = await harness({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'], axe: 'not axe-checked anywhere yet: this page is not in tools/smoke.mjs (docs/DEBT.md); this check asks about drawing and layout' });
const { server, browser, check, results } = h;
// The stall clause (4) measures GPU raster of two backdrop blurs; on a software renderer (a CI runner, or SG_FORCE_SOFTWARE_GL=1)
// the CPU rasterises them, so a 250 ms ceiling says nothing about the product. It skips (`skip  <clause>  (no GPU: <renderer>)`, tools/lib/gpu.mjs).
const gate = await h.gpu();

const BREAKS = {
  ignoresOthers: [/stage-element\.js$/, s => s.replace('#others() { const flow', '#others() { return []; const flow')],
  loadAndReleaseOnly: [/stage-element\.js$/, s => s.replace('#arrangeSoon(ms = 120) {', '#arrangeSoon(ms = 120) {\n    if (window.__frozen) return;').replace('this.#arrT = 0; this.#settle({ quiet: true });', 'this.#arrT = 0; if (window.__frozen) return; this.#settle({ quiet: true });')],
  chips: [/stage-element\.js$/, s => s.replace('.panel.lens > :is(h1,h2,h3,h4,h5,h6,p,li){position:relative;z-index:2}', '.panel.lens > :is(h1,h2,h3,h4,h5,h6,p,li){position:relative;z-index:2;width:fit-content;max-width:100%;background:color-mix(in oklab,var(--sg-surface-raised,Canvas) 92%,transparent);padding:.15em .5em;border-radius:5px}')],
  blurWhileMoving: [/stage-element\.js$/, s => s.replace('sg-veranda-stage[data-moving] .flow-card{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}\n', '')],
  buttonOver: [/stage-element\.js$/, s => s.replace('.lens-btn{position:absolute;z-index:3;left:1.1em;bottom:.6em;', '.lens-btn{position:absolute;z-index:3;left:1.1em;top:.6em;')],
};

async function open({ query = 'register=warm', hash = '#notes=window.1,door.3,lamp.2,pillar.0', patches = [], width = 1280 } = {}) {
  const context = await h.context({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  await context.addInitScript(TIMERS_SCRIPT); // the stage's debounces and settle timers are what 'at rest' means here
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
  await atRest({ page });
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

/** At rest: none of the stage's short timers pending and every line box where it was for four frames. A slow machine waits longer, not less. */
const atRest = async p => { const r = await stable(p.page, () => window.__lines(), { frames: 4, ms: 30000, timers: true }); if (!r.ok) console.log(`     (not at rest after 30 s: ${JSON.stringify(r.value).slice(0, 120)})`); return r; };
const settle = atRest;
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
  await atRest(q);
  await q.page.evaluate(() => { const s = window.__stage; window.__frozen = true; s.setAttribute('words-at', '0.4 0.15'); s.paneDepth = 0.45; });
  await atRest(q);
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
    // the lens is really on (the glass wears it) before the lines are read, or 'in place' would be 'not yet moved'
    await p.page.waitForFunction(() => window.__stage.pane.classList.contains('lens'), null, { timeout: 30000 }).catch(() => {});
    await atRest(p);
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
  // sampling, kept: open() used to end with this 1.2 s dwell, and the 1.3 s stall of the plant showed only on a busy machine after it; the page-age wait the review suggested did not bring it back. The clause no longer rests on the stall alone: it reads the cause (backdrop blur on a card while the stage is moving) from the page
  await p.page.waitForTimeout(1200);
  await p.page.evaluate(() => { window.__f = []; let q = -1; const t = n => { if (q >= 0) window.__f.push(n - q); q = n; requestAnimationFrame(t); }; requestAnimationFrame(t); const dp = window.__stage.depthPhoto, t0 = performance.now(); window.__mv = { frames: 0, blurred: 0, cards: 0 }; const f = n => { dp.set({ dolly: 0.5 + 0.5 * Math.sin((n - t0) / 1000) }); const st = window.__stage, cs = [...st.querySelectorAll('.flow-card')]; if (st.hasAttribute('data-moving') && cs.length) { window.__mv.frames++; window.__mv.cards = cs.length; if (cs.some(c => { const b = getComputedStyle(c).backdropFilter; return b && b !== 'none'; })) window.__mv.blurred++; } requestAnimationFrame(f); }; requestAnimationFrame(f); });
  // sampling, kept: six seconds of the real clock are the subject (the longest frame the camera's movement costs); nothing to wait for but the time
  await p.page.waitForTimeout(6500);
  const worst = await p.page.evaluate(() => Math.max(...window.__f.slice(2))), mv = await p.page.evaluate(() => window.__mv);
  await p.context.close();
  return { ms: Math.round(worst), ...mv };
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
  if ((!only || only === 'blurWhileMoving') && !gate.skip('no stall while the camera moves with both panes of glass on screen: six seconds of camera movement, three fresh contexts, no frame over 250 ms')) {
    const worst = [];
    for (let k = 0; k < 3; k++) worst.push(await longestFrame(patches));
    // the stall itself is machine-dependent (the plant took 1.3 s frames on a busy machine and 33 ms on a quiet one, base and branch alike), so the clause also reads the cause
    // from the page: in every frame the stage says it is moving, no flow card may still have a backdrop blur; and the sampler must have seen moving frames with cards (else it measured nothing)
    const seen = worst.every(w => w.frames > 30 && w.cards > 0);
    check('no stall while the camera moves with both panes of glass on screen: six seconds of camera movement, three fresh contexts, no frame over 250 ms', seen && worst.every(w => w.ms <= 250 && w.blurred === 0), `longest frames ${worst.map(w => w.ms).join(', ')} ms; moving frames with a blur on a card ${worst.map(w => `${w.blurred} of ${w.frames}`).join(', ')}`);
  }
  if (!only || only === 'chips' || only === 'buttonOver') {
    const r = await lens(patches);
    check('the lens leaves the words alone: with it on, the lines are where they were with it off and the lens button touches none of them', r.hasBtn && r.offBtnTouch === 0 && r.seen.every(s => s.same && !s.touching && s.inside && s.n >= 3), detailLens(r));
  }
}

const failed = results.filter(r => !r.ok).length;
await h.done({ summary: `${gate.finalLine(results.length - failed, results.length)}${BREAK ? ' (--break: the patched builds should FAIL their checks)' : ''}`, expectRed: BREAK, allRed: BREAK });
