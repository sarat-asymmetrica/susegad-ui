// Browser checks for notes that stay with the place, the walk and the postcards (<sg-veranda-stage>, words.html and walk.html).
//
//   node packages/scenes/veranda/notes.check.mjs            (or: npm run check)
//   node packages/scenes/veranda/notes.check.mjs --break    (against patched builds: every check marked below must FAIL)
//
// Runs on this machine's GPU (ANGLE on Direct3D 11). A note's tail is where place(u, v, d) puts its anchor; the anchors are read
// from world.js (the drawing's own solids), so the check does not trust the element's copy of where a surface is.
//
//  1. a note stays with its place: at three camera positions each note's tail is where place() puts its anchor (to 1.5 px), the
//     notes move when the camera does, and at rest they are where world.js's own projection puts the surfaces;
//  2. a drop finds its surface: a note let go on the near pillar, the window, the far tree, sticks to that one, by the depth map;
//  3. keyboard parity: the grip's arrows reach every anchor a drop can, each one said;
//  4. the walk: scrolling dollies the camera forward and never back, stops at each note in order (nearest first) with it in focus
//     and its tail on its place; under reduced motion the camera takes only the stops' own positions;
//  5. postcards: the hash carries anchors and text ids and nothing else, a link opens with the notes where they were, and a hash
//     that says something the page does not is ignored.
//
// --break patches the served build once per family: notes that do not follow the camera (1), a drop that ignores the depth map
// (2), a grip with no arrows (3), a walk that ignores the scroll (4), a page that puts words in the hash (5).

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';
import { ANCHORS, anchorPoint, projectM } from './world.js';

const BREAK = process.argv.includes('--break');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const server = await startServer({ quiet: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

const BREAKS = {
  noFollow: [/stage-element\.js$/, s => s.replace("if (key === this.#noteKey && !this.#drag) return;", "if (this.#noteKey && !this.#drag) return;")],
  noLookup: [/stage-element\.js$/, s => s.replace('if (hit && hit.anchor.id !== n.anchor)', 'if (false)')],
  noArrows: [/stage-element\.js$/, s => s.replace('#noteKeydown(e, id) {', '#noteKeydown(e, id) {\n    return;')],
  noWalk: [/stage-element\.js$/, s => s.replace('#walkTick() {', '#walkTick() {\n    return;')],
  walk2dContinuous: [/stage-element\.js$/, s => s.replace(" || this.#dp.tier === '2d'", '')],
  // the old way: a PNG made on a GPU-backed canvas (toBlob is a readback, about 100 ms) and remade every 60 ms while the camera moves
  pngMaskWhileMoving: [/stage-element\.js$/, s => s.replace('const wait = Math.max(now ? 0 : 60, 180 - (performance.now() - this.#camAt));', 'const wait = now ? 0 : 60;').replace('if (performance.now() - this.#camAt < 170) return this.#scheduleMask(true); ', '').replace('    // a vector mask (the shown cells as rects), not a PNG', "    await new Promise(r => { const c = document.createElement('canvas'); c.width = 342; c.height = 228; c.getContext('2d').fillRect(0, 0, 342, 228); c.toBlob(r, 'image/png'); });\n    // a vector mask (the shown cells as rects), not a PNG")],
  wordsInHash: [/words\.html$/, s => s.replace("const h = encodeNotes(st.notes);", "const h = encodeNotes(st.notes) + (st.notes.length ? '&text=' + encodeURIComponent(st.noteTexts[st.notes[0].text]) : '');")],
};
async function open({ path = 'words.html', query = 'register=warm', hash = '', reduced = false, width = 1280, height = 900, patches = [], noGL = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const errors = [];
  if (noGL) await context.addInitScript("const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); };");
  for (const key of BREAK ? patches : []) {
    const [re, fn] = BREAKS[key];
    await context.route(u => re.test(u.pathname), async r => { const res = await r.fetch(); r.fulfill({ response: res, body: fn(await res.text()) }); });
  }
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${server.url}/packages/scenes/veranda/${path}?${query}${hash}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(900);
  return { context, page, errors };
}
const frames = (p, n = 3) => p.page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const HASH = '#notes=door.3,lamp.2,pillar.0,balcao.4';

// 1. a note stays with its place
{
  const p = await open({ hash: HASH, patches: ['noFollow'] });
  const read = async dolly => {
    await p.page.evaluate(d => window.__stage.depthPhoto.set({ dolly: d }), dolly);
    await frames(p, 4);
    return p.page.evaluate(() => { const s = window.__stage, dp = s.depthPhoto, out = []; for (const el of s.querySelectorAll('.note')) { const a = s.anchors.find(x => x.id === el.dataset.anchor), [x, y] = dp.place(a.u, a.v, a.d), st = s.querySelector('.stage').getBoundingClientRect(), r = el.getBoundingClientRect(), t = parseFloat(el.style.getPropertyValue('--tail')), side = el.dataset.side; if (x < 0 || y < 0 || x > st.width || y > st.height) continue; out.push({ id: a.id, want: [x, y], has: [side[1] === 'r' ? r.left - st.left : r.right - st.left, side[0] === 't' ? r.bottom - st.top + t : r.top - st.top - t] }); } const a0 = dp.place(0, 0, 0.3), a1 = dp.place(1, 1, 0.3); return { notes: out, a0, a1 }; });
  };
  const runs = [await read(0), await read(0.45), await read(0.9)];
  const off = runs.flatMap(r => r.notes.map(n => Math.hypot(n.want[0] - n.has[0], n.want[1] - n.has[1])));
  // (a note whose anchor has walked off the stage is not read: it goes with its anchor)
  const moved = runs[0].notes.map(n => { const m = runs[2].notes.find(q => q.id === n.id); return m ? Math.hypot(n.has[0] - m.has[0], n.has[1] - m.has[1]) : 0; });
  // at rest: the anchors' own projection in world.js, mapped onto the stage by the picture's two corners, against where the notes are
  const r0 = runs[0], sx = r0.a1[0] - r0.a0[0], sy = r0.a1[1] - r0.a0[1];
  const rest = ANCHORS.filter(a => r0.notes.some(n => n.id === a.id)).map(a => { const [u, v] = projectM(...a.at), n = r0.notes.find(q => q.id === a.id); return Math.hypot(r0.a0[0] + u * sx - n.has[0], r0.a0[1] + v * sy - n.has[1]); });
  check('a note stays with its place: at three camera positions its drawn tail is where place() puts its anchor, and the camera moves it', off.length >= 9 && Math.max(...off) < 1.5 && Math.max(...moved) > 25 && Math.max(...rest) < 2.5,
    `${off.length} readings, worst ${Math.max(...off).toFixed(2)} px off; the notes moved up to ${Math.max(...moved).toFixed(0)} px between dolly 0 and 0.9; at rest the anchors are within ${Math.max(...rest).toFixed(2)} px of world.js's projection`);
  await p.context.close();
}

// 2. a drop finds its surface
async function dropOn(p, id, at) {
  await p.page.evaluate(() => { window.__stage.pane.style.display = 'none'; }); // the pane floats mid-picture and would take the pointer
  const g = await p.page.evaluate(id => { const el = window.__stage.querySelector('.note[data-anchor="' + id + '"] .note-grip'); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  await p.page.mouse.move(g[0], g[1]); await p.page.mouse.down();
  await p.page.mouse.move((g[0] + at[0]) / 2, (g[1] + at[1]) / 2, { steps: 5 }); await p.page.mouse.move(at[0], at[1], { steps: 6 });
  await p.page.mouse.up(); await frames(p, 4);
}
{
  const p = await open({ hash: '#notes=door.3', patches: ['noLookup'] });
  const spot = id => p.page.evaluate(id => { const s = window.__stage, a = s.anchors.find(x => x.id === id), [x, y] = s.depthPhoto.place(a.u, a.v, a.d), r = s.querySelector('.stage').getBoundingClientRect(); return [r.left + x + 4, r.top + y + 6]; }, id);
  const landed = [];
  for (const target of ['pillar', 'window', 'mango', 'balcao']) {
    const from = await p.page.evaluate(() => window.__stage.notes[0].anchor);
    await dropOn(p, from, await spot(target));
    landed.push([target, await p.page.evaluate(() => window.__stage.notes[0].anchor), await p.page.evaluate(() => [...window.__stage.querySelectorAll('[role=status]')].map(x => x.textContent).filter(Boolean).at(-1))]);
  }
  check('a drop finds its surface: a note let go on the pillar, the window, the far tree and the seat sticks to that one, by the depth map', landed.every(([t, a]) => t === a), landed.map(([t, a, said]) => `${t} -> ${a} ("${said}")`).join('; '));
  await p.context.close();
}

// 3. keyboard parity
{
  const p = await open({ hash: '#notes=door.3', patches: ['noArrows'] });
  const r = await p.page.evaluate(async () => {
    const s = window.__stage, seen = [s.notes[0].anchor], said = [], ids = s.anchors.map(a => a.id);
    for (let i = 0; i < ids.length + 1; i++) { const grip = s.querySelector('.note-grip'); grip.focus(); grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); seen.push(s.notes[0].anchor); said.push([...s.querySelectorAll('[role=status]')].map(x => x.textContent).filter(Boolean).at(-1)); }
    const back = []; for (let i = 0; i < 2; i++) { const grip = s.querySelector('.note-grip'); grip.focus(); grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })); back.push(s.notes[0].anchor); }
    return { seen, said, back, ids, kept: document.activeElement?.classList.contains('note-grip') };
  });
  const reached = new Set(r.seen);
  check('keyboard parity: the grip\'s arrows reach every anchor a drop can, each one said, and the focus stays on the grip', r.ids.every(i => reached.has(i)) && r.said.every(t => /Note moved to/.test(t ?? '')) && r.kept && r.back[0] !== r.seen.at(-1), `reached ${[...reached].join(', ')}; last said "${r.said.at(-1)}"`);
  await p.context.close();
}

// 4. the walk
{
  const drive = async (reduced, patches, noGL = false) => {
    const p = await open({ path: 'walk.html', reduced, patches, noGL });
    const steps = 40, out = [];
    for (let k = 0; k <= steps; k++) {
      await p.page.evaluate(pr => { const s = window.__stage, range = s.offsetHeight - s.querySelector('.frame').offsetHeight; scrollTo(0, s.getBoundingClientRect().top + scrollY + pr * range); }, k / steps);
      await frames(p, 2);
      out.push(await p.page.evaluate(() => { const s = window.__stage, dp = s.depthPhoto, el = s.querySelector('.note[data-active]'); let tail = null; if (el) { const a = s.anchors.find(x => x.id === el.dataset.anchor), [x, y] = dp.place(a.u, a.v, a.d); tail = { off: Math.hypot(x - +el.dataset.x, y - +el.dataset.y), d: a.d }; } return { dolly: dp.params.dolly, focus: dp.params.focus, stop: +s.dataset.walkStop, active: el?.dataset.anchor ?? null, tail }; }));
    }
    await p.context.close();
    return out;
  };
  const run = await drive(false, ['noWalk']);
  const order = ['pillar', 'balcao', 'lamp', 'window', 'door', 'mango'].filter(id => run.some(r => r.active === id));
  const activeSeq = run.map(r => r.active).filter((a, i, all) => a && a !== all[i - 1]);
  const mono = run.every((r, i) => i === 0 || r.dolly >= run[i - 1].dolly - 1e-6), moved = run.at(-1).dolly - run[0].dolly;
  const holds = run.filter(r => r.active), tailOk = holds.every(r => r.tail && r.tail.off < 1.5), focusOk = holds.every(r => Math.abs(r.focus - r.tail.d) < 0.02);
  check('the walk: scrolling dollies the camera forward, never back, and stops at each note in order with it in focus and its tail on its place', mono && moved > 0.5 && activeSeq.length >= 3 && JSON.stringify(activeSeq) === JSON.stringify(activeSeq.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b))) && tailOk && focusOk,
    `dolly ${run[0].dolly.toFixed(2)} to ${run.at(-1).dolly.toFixed(2)}, stops ${activeSeq.join(' > ')}, ${holds.length} holds all on their place: ${tailOk}, in focus: ${focusOk}`);
  const still = await drive(true, []);
  const stops = new Set(still.map(r => r.dolly.toFixed(3)));
  const moving = await drive(false, []);
  const free = new Set(moving.map(r => r.dolly.toFixed(3)));
  check('under reduced motion the camera takes only the stops\' own positions: one still per section', stops.size <= 6 && free.size > stops.size + 3, `${stops.size} positions under reduced motion, ${free.size} with motion`);
  // the 2D tier repaints the whole picture on the CPU for each change of camera, so with motion on it steps between stills too
  const flat = await drive(false, ['walk2dContinuous'], true);
  const flatPos = new Set(flat.map(r => r.dolly.toFixed(3)));
  check('on the 2D tier the walk steps between stills even with motion on: the camera takes only the stops\' own positions, and still stops at each note', flatPos.size <= 6 && flat.filter(r => r.active).length >= 8, `${flatPos.size} camera positions over 41 scroll positions (3D tier: ${free.size}), ${new Set(flat.map(r => r.active).filter(Boolean)).size} notes held`);
}

// 4b. the walk does not stall: no main-thread task over 50 ms and no frame over 250 ms while scrolling through every stop. (Remaking the pane's mask while the
//     picture moved made this machine's integrated GPU stall for a second in raster, and a GPU-backed mask canvas had made toBlob a 100 ms readback stall.)
{
  const long = async patches => {
    const p = await open({ path: 'walk.html', patches });
    const r = await p.page.evaluate(async () => {
      const out = []; new PerformanceObserver(l => { for (const e of l.getEntries()) out.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] });
      let q = -1; window.__gap = 0; const tick = n => { if (q >= 0) window.__gap = Math.max(window.__gap, n - q); q = n; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      const t0 = performance.now(), total = document.documentElement.scrollHeight - innerHeight;
      await new Promise(res => { const f = n => { scrollTo(0, Math.min(total, ((n - t0) / 5000) * total)); if (n - t0 < 5200) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      await new Promise(r => setTimeout(r, 300));
      out.gap = Math.round(window.__gap);
      return { tasks: out, gap: Math.round(window.__gap) };
    });
    await p.context.close();
    return r;
  };
  const r = await long(['pngMaskWhileMoving']);
  check('the walk does not stall: scrolling through every stop, no main-thread task over 50 ms and no frame over 250 ms', r.tasks.length === 0 && r.gap <= 250, `${r.tasks.length} long tasks${r.tasks.length ? ', the longest ' + Math.max(...r.tasks) + ' ms' : ''}; the longest frame ${r.gap} ms`);
}

// 5. postcards
{
  const p = await open({ hash: '#notes=door.1,lamp.0', patches: ['wordsInHash'] });
  const first = await p.page.evaluate(() => window.__stage.notes);
  await p.page.evaluate(() => window.__stage.addNote({ anchor: 'pillar', text: 4 }));
  await frames(p, 3);
  const hash = await p.page.evaluate(() => location.hash);
  await p.context.close();
  const q = await open({ hash });
  const second = await q.page.evaluate(() => window.__stage.notes);
  await q.context.close();
  const bad = await open({ hash: '#notes=door.1,nope.0,lamp.99&x=<script>' });
  const kept = await bad.page.evaluate(() => window.__stage.notes);
  await bad.context.close();
  const clean = /^#notes=([a-z]+\.\d+)(,[a-z]+\.\d+)*$/.test(hash);
  check('postcards: the hash carries anchors and text ids and nothing else; a link opens with the notes where they were; a hash that says more than the page does is ignored',
    JSON.stringify(first) === JSON.stringify([{ anchor: 'door', text: 1 }, { anchor: 'lamp', text: 0 }]) && clean && JSON.stringify(second) === JSON.stringify([{ anchor: 'door', text: 1 }, { anchor: 'lamp', text: 0 }, { anchor: 'pillar', text: 4 }]) && JSON.stringify(kept) === JSON.stringify([{ anchor: 'door', text: 1 }]),
    `hash "${hash}", reopened with ${second.length} notes, the bad hash kept ${kept.length}`);
}

await browser.close(); await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} pass${BREAK ? ' (--break: the patched builds should FAIL their checks)' : ''}`);
process.exit(BREAK ? 0 : failed ? 1 : 0);
