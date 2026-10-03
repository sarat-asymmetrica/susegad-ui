// Browser gates for the movable glass words (<sg-scene movable>, decision 0021),
// from docs/requests/2026-09-29-glass-and-depth.md, Batch A. Run by hand:
//
//   node packages/scenes/tinto/glass.check.mjs
//
// Each gate has a broken control kept in this file: a patched build, served in
// place of the real source by route interception (each patch must apply, or the
// control would quietly be the real build), that the same probe must catch.
//
// 1. without `movable`, nothing changes: Tinto warm and playful on a frozen
//    clock are pixel for pixel what main's core draws, and movable.js is never
//    requested (control: a core that pads the panel when the attribute is absent);
// 2. the scene makes room: the words dragged to three places, the square under
//    the words changes under 1% between two moments while it moves elsewhere
//    (control: a grip that does not re-measure on a move);
// 3. keyboard parity: keys reach every place the three drags did, and the
//    status line names it in the same words (control: a grip with no keys);
// 4. contrast through the glass: 4.5:1 against every real pixel under each line
//    box, light and dark, warm and playful, at the three places (control: a
//    panel at 20% tint);
// 5. phone and text size: at 390 px, and with text at 200% on it, the grip is gone
//    and the words are flat below the picture, no horizontal scroll (control: a
//    grip that ignores the stacked layout);
// 6. the pause button stays reachable: the words sent to the top right step
//    clear of it (control: a build that does not step round it);
// 7. postcards: ?words=x,y opens with the words where the sender left them, the
//    address follows a drop, and "Copy this view" copies it (control: a demo
//    that never writes the address);
// plus axe in every register, light and dark, at 390 px, with the grip focused,
// and no request leaving the page. The stale-calm gate is in core/calm.check.mjs.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { harness } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';
import { room, offsetOf, placeOf, STEP, BIG_STEP } from '../../core/movable.core.js';

const h = await harness();
const { check, browser, server, engine } = h;
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const src = p => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const GLASS = '/packages/scenes/tinto/world.html?only=glass';
const HARNESS = '/tools/harness/scene.html?name=tinto&content=1';
const want = n => !process.env.GATE || process.env.GATE.split(',').includes(n); // GATE=4 node glass.check.mjs runs one gate
const PLACES = [[1, 0], [0.5, 0.5], [0.12, 0.95]]; // the top right, the middle, the bottom left

/**
 * Open `path` in a fresh context. `patch` maps a repo path to [from, to] pairs and `raw` a repo path to a whole
 * replacement body; the page gets those instead of the real files.
 */
async function openAt(path, { width = 1280, height = 900, reduced = false, patch = {}, raw = {}, requests = null, root = null, wait = 'ready' } = {}) {
  const errors = [];
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', permissions: ['clipboard-read', 'clipboard-write'] }));
  const serve = (file, body) => ctx.route(`**/${file}*`, r => r.fulfill({ contentType: file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8', body }));
  for (const [file, pairs] of Object.entries(patch)) {
    let body = src(file);
    for (const [from, to] of pairs) {
      if (!body.includes(from)) throw new Error(`patch for ${file} did not apply: ${from}`);
      body = body.replace(from, to);
    }
    await serve(file, body);
  }
  for (const [file, body] of Object.entries(raw)) await serve(file, body);
  if (requests) ctx.on('request', r => requests.push(r.url()));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (root) await page.addInitScript(r => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = r; }); }, root);
  await page.goto(`${server.url}${path}`);
  const flag = wait === 'frozen' ? '__frozen' : '__ready';
  await page.waitForFunction(f => window[f] === true, flag, { timeout: 40000 }).catch(() => errors.push(`never ${flag}`));
  return { ctx, page, errors };
}
const frames = (page, n = 2) => page.evaluate(k => new Promise(r => { const f = i => (i ? requestAnimationFrame(() => f(i - 1)) : r()); f(k); }), n);
/** Wait until the movable module has attached (the grip exists and is shown), then two frames. */
async function grown(page) {
  const ok = await page.waitForFunction(() => { const g = window.__piece?.shadowRoot?.querySelector('.grip'); return !!g && !g.hidden; }, null, { timeout: 15000 }).then(() => true, () => false);
  await frames(page);
  return ok;
}

// ── in-page probes ─────────────────────────────────────────────────────────

/** Rects (client px) of the stage, the panel and the grip, and what the element says about itself. */
const geometry = page => page.evaluate(() => {
  const el = window.__piece, sr = el.shadowRoot, box = e => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const g = sr.querySelector('.grip'), p = sr.querySelector('.panel');
  const say = [...sr.querySelectorAll('[role=status]')].at(-1)?.textContent ?? '';
  return { stage: box(sr.querySelector('.stage')), panel: box(p), grip: g ? box(g) : null, gripShown: !!g && !g.hidden, transform: p.style.transform, said: say, at: el.wordsAt, stacked: sr.querySelector('.frame').classList.contains('stacked'), scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
});
/** Where the slotted words really are, in logical units (not what the element says it measured). */
const wordBoxes = page => page.evaluate(() => {
  const el = window.__piece, s = el.shadowRoot.querySelector('.stage').getBoundingClientRect(), k = 1200 / s.width;
  return [...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - s.left) * k, y: (r.top - s.top) * k, w: r.width * k, h: r.height * k }; });
});
/** The canvas at one moment, downsampled 4x. */
const grab = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data;
  const s = 4, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), out = new Array(w * hh * 3);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; out[o] = d[i]; out[o + 1] = d[i + 1]; out[o + 2] = d[i + 2]; }
  return { w, h: hh, kx: 1200 / w, ky: 800 / hh, px: out };
});
/** Share of the pixels inside boxes (logical units) that differ between two grabs, and the same for everything outside them. */
function diff(a, b, boxes, th = 40) {
  let n = 0, c = 0, no = 0, co = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const lx = x * a.kx, ly = y * a.ky, inside = boxes.some(r => lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h);
    const o = (y * a.w + x) * 3, d = Math.abs(a.px[o] - b.px[o]) + Math.abs(a.px[o + 1] - b.px[o + 1]) + Math.abs(a.px[o + 2] - b.px[o + 2]) > th;
    if (inside) { n++; if (d) c++; } else { no++; if (d) co++; }
  }
  return { under: n ? c / n : 0, elsewhere: no ? co / no : 0 };
}

/** Drag the grip from home to the place (fx, fy) with the mouse: the pointer goes down on the grip, moves in steps, and lets go. */
async function dragTo(page, fx, fy) {
  const g = await geometry(page);
  const r = room(g.stage, { left: g.panel.left, top: g.panel.top, width: g.panel.width, height: g.panel.height });
  const o = offsetOf(r, fx, fy);
  await page.mouse.move(g.grip.x, g.grip.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(g.grip.x + (o.dx * i) / 8, g.grip.y + (o.dy * i) / 8);
  await page.mouse.up();
  await frames(page, 3);
  return { moved: o, after: await geometry(page) };
}
/** Press a key on the focused grip `n` times. */
async function press(page, key, n) { for (let i = 0; i < n; i++) await page.keyboard.press(key); await frames(page, 2); }

// ── 1. without `movable`, nothing changes ─────────────────────────────────────
if (want('1')) {
  const MAIN = (() => { try { return execFileSync('git', ['show', '654935d:packages/core/scene-element.js'], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 24 }); } catch (e) { return null; } })();
  check('main’s core (654935d) is readable for the pixel comparison', !!MAIN, MAIN ? `${MAIN.length} chars` : 'git show failed');
  const shot = async (register, opts) => {
    const { ctx, page, errors } = await openAt(`${HARNESS}&register=${register}&freeze=4`, { wait: 'frozen', ...opts });
    const png = await page.locator('#box').screenshot();
    const hasGrip = await page.evaluate(() => !!window.__piece.shadowRoot.querySelector('.grip'));
    await ctx.close();
    return { png, hasGrip, errors };
  };
  const same = (a, b) => h.browser.newContext().then(async c => {
    const p = await c.newPage();
    const r = await p.evaluate(async ([x, y]) => {
      const img = async s => { const i = new Image(); i.src = `data:image/png;base64,${s}`; await i.decode(); const cv = new OffscreenCanvas(i.width, i.height), g = cv.getContext('2d'); g.drawImage(i, 0, 0); return { w: i.width, h: i.height, d: g.getImageData(0, 0, i.width, i.height).data }; };
      const A = await img(x), B = await img(y);
      if (A.w !== B.w || A.h !== B.h) return { size: `${A.w}x${A.h} vs ${B.w}x${B.h}`, differ: -1 };
      let n = 0; for (let i = 0; i < A.d.length; i += 4) if (A.d[i] !== B.d[i] || A.d[i + 1] !== B.d[i + 1] || A.d[i + 2] !== B.d[i + 2]) n++;
      return { size: `${A.w}x${A.h}`, differ: n };
    }, [a.toString('base64'), b.toString('base64')]);
    await c.close();
    return r;
  });
  for (const register of ['warm', 'playful']) {
    const mine = await shot(register), again = await shot(register);
    const rep = await same(mine.png, again.png);
    check(`the frozen ${register} frame is repeatable (my core twice: 0 pixels differ), so the comparison below can fail`, rep.differ === 0, `${rep.differ} of ${rep.size} differ`);
    const theirs = await shot(register, { raw: { 'packages/core/scene-element.js': MAIN } });
    const d = await same(mine.png, theirs.png);
    check(`without movable, Tinto ${register} is pixel for pixel what main’s core draws, and has no grip`, d.differ === 0 && !mine.hasGrip, `${d.differ} of ${d.size} pixels differ; grip in the tree: ${mine.hasGrip}`);
    if (register === 'warm') {
      const broken = await shot(register, { patch: { 'packages/core/scene-element.js': [['padding:.85em 1.1em;border-radius:var(--sg-radius-2,8px);', 'padding:.9em 1.1em;border-radius:var(--sg-radius-2,8px);']] } });
      const bd = await same(broken.png, theirs.png);
      check('control: a core that changes the panel when movable is absent is caught by the same comparison', bd.differ > 0, `${bd.differ} pixels differ`);
    }
  }
  // the module is not even fetched
  const asked = [], { ctx, page } = await openAt(`${HARNESS}&register=warm`, { requests: asked });
  await frames(page, 4);
  check('without movable, movable.js is never requested', !asked.some(u => /movable/.test(u)), asked.filter(u => /movable/.test(u)).join(', ') || 'no request');
  await ctx.close();
  const withIt = [], w = await openAt(`${HARNESS}&register=warm&movable=`, { requests: withIt });
  const got = await grown(w.page);
  check('with movable, movable.js is requested and the grip appears', got && withIt.some(u => /movable\.js/.test(u)), `grip shown: ${got}`);
  await w.ctx.close();
}

// ── 2. the scene makes room ───────────────────────────────────────────────────
// The words are dragged to a place with the mouse as soon as the grip is there; the clock then runs to 4 s (one load)
// and to 7 s (another). Under the words the square changes under 1% between the two; elsewhere it moves.
const RE_MEASURE = { 'packages/core/movable.js': [['export function attach(host, { root, els, register, measure }) {', 'export function attach(host, { root, els, register, measure: real }) { const measure = () => {};']] };
async function roomAt(place, patch = {}) {
  const shots = [];
  let placed = null, boxes = null, said = '', honest = null;
  for (const t of [4, 7]) {
    const { ctx, page, errors } = await openAt(`${HARNESS}&register=warm&freeze=${t}&movable=`, { patch });
    const got = await grown(page);
    const d = await dragTo(page, ...place);
    await page.waitForFunction(() => window.__frozen === true, null, { timeout: 40000 });
    await frames(page, 4);
    shots.push(await grab(page));
    if (t === 4) {
      placed = d.after; boxes = await wordBoxes(page); said = d.after.said;
      const calm = await page.evaluate(() => window.__piece.calm.map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h })));
      // does the element's own list sit where the words really are?
      honest = boxes.every(b => calm.some(c => Math.abs(c.x - b.x) < 3 && Math.abs(c.y - b.y) < 3 && Math.abs(c.w - b.w) < 3 && Math.abs(c.h - b.h) < 3));
    }
    if (errors.length || !got) shots.errors = [...(shots.errors ?? []), ...errors, got ? '' : 'no grip'];
    await ctx.close();
  }
  return { ...diff(shots[0], shots[1], boxes), placed, said, listFollows: honest, errors: shots.errors ?? [] };
}
if (want('2')) {
  const rows = [];
  for (const place of PLACES) rows.push({ place, ...(await roomAt(place)) });
  const fmt = r => `${r.place.join(',')}: ${(r.under * 100).toFixed(2)}% under the words, ${(r.elsewhere * 100).toFixed(2)}% elsewhere`;
  check('the scene makes room: under the words the square changes under 1% between 4 s and 7 s, at three places', rows.every(r => r.under < 0.01), rows.map(fmt).join('; '));
  check('the drag lands where asked (within 12% up or down at the top edge, where the words step 22 px below the pause button), and the element’s calm list is the words’ real boxes at each place', rows.every(r => r.listFollows && r.placed.at && Math.abs(r.placed.at.x - r.place[0]) < 0.01 && Math.abs(r.placed.at.y - r.place[1]) < 0.12), rows.map(r => `${r.place.join(',')}: at ${r.placed.at ? `${r.placed.at.x.toFixed(3)},${r.placed.at.y.toFixed(3)}` : 'home'}, list follows: ${r.listFollows}`).join('; '));
  check('the square really moves elsewhere between the two moments (so 0% under the words means something)', rows.every(r => r.elsewhere > 0.005), rows.map(fmt).join('; '));
  check('no console errors (drags)', rows.every(r => !r.errors.filter(Boolean).length), rows.flatMap(r => r.errors).filter(Boolean).join(' | '));
  const broken = [];
  for (const place of PLACES) broken.push({ place, ...(await roomAt(place, RE_MEASURE)) });
  check('control: a grip that does not re-measure on a move is caught (the square changes over the words at some place)', broken.some(r => r.under >= 0.01), broken.map(fmt).join('; '));
  check('control: and its calm list stays behind where the words were', broken.some(r => !r.listFollows), broken.map(r => `${r.place.join(',')}: list follows ${r.listFollows}`).join('; '));
}


// ── 3. keyboard parity ────────────────────────────────────────────────────────
// Each place a drag reached, the grip's keys reach to within one step, and the status line names it in the same words.
const NO_KEYS = { 'packages/core/movable.js': [["grip.addEventListener('keydown', e => {", "grip.addEventListener('keydown', e => { return;"]] };
async function keysAt(place, patch = {}) {
  const { ctx, page, errors } = await openAt(`${HARNESS}&register=warm&movable=`, { patch });
  await grown(page);
  const home = await geometry(page);
  const dragged = (await dragTo(page, ...place)).after;
  await page.evaluate(() => { window.__moved = []; window.__piece.addEventListener('sg-words-moved', e => window.__moved.push(e.detail)); });
  const grip = page.locator('sg-scene .grip');
  await grip.focus();
  await page.keyboard.press('Home');
  await frames(page, 2);
  const back = await geometry(page);
  // the keys, from home: the big step (Shift) while more than one of them is left, then the small one; a flush place presses on into the wall
  const w = home.stage.width, step = STEP * w, big = BIG_STEP * w;
  const walk = async (d, flush, plus, minus) => {
    const key = d >= 0 ? plus : minus;
    let left = Math.abs(d);
    const nb = Math.floor(left / big);
    await press(page, `Shift+${key}`, nb);
    left -= nb * big;
    // a place flush to a wall: press until the last press lands on it (a press that moves nothing would say "as far as they go")
    await press(page, key, flush ? Math.ceil(left / step) : Math.round(left / step));
  };
  const flush = v => v === 0 || v === 1;
  await walk(dragged.panel.left - home.panel.left, flush(place[0]), 'ArrowRight', 'ArrowLeft');
  await walk(dragged.panel.top - home.panel.top, flush(place[1]), 'ArrowDown', 'ArrowUp');
  const keyed = await geometry(page);
  const fired = await page.evaluate(() => window.__moved.slice());
  await ctx.close();
  return { dragged, back, keyed, fired, step, errors, home };
}
const reached = r => r.back.at === null && r.back.transform === '' && Math.abs(r.keyed.panel.left - r.dragged.panel.left) < r.step && Math.abs(r.keyed.panel.top - r.dragged.panel.top) < r.step && r.keyed.said === r.dragged.said;
if (want('3')) {
  const rows = [];
  for (const place of PLACES) rows.push({ place, ...(await keysAt(place)) });
  const off = r => `${Math.abs(r.keyed.panel.left - r.dragged.panel.left).toFixed(1)}, ${Math.abs(r.keyed.panel.top - r.dragged.panel.top).toFixed(1)} px`;
  check('keyboard parity: Home puts the words back where they started', rows.every(r => r.back.at === null && r.back.transform === '' && /back where they started/.test(r.back.said)), rows.map(r => `${r.place.join(',')}: at ${JSON.stringify(r.back.at)}, "${r.back.said}"`).join('; '));
  check('keyboard parity: the arrow keys reach each place a drag reached, to within one step', rows.every(r => Math.abs(r.keyed.panel.left - r.dragged.panel.left) < r.step && Math.abs(r.keyed.panel.top - r.dragged.panel.top) < r.step), `step ${rows[0].step.toFixed(1)} px; off by ${rows.map(off).join('; ')}`);
  check('keyboard parity: the status line names each place in the drag’s words', rows.every(r => r.keyed.said === r.dragged.said && /^Words moved to the /.test(r.keyed.said) && !/\d/.test(r.keyed.said)), rows.map(r => `drag "${r.dragged.said}" / keys "${r.keyed.said}"`).join('; '));
  check('keyboard parity: each key press fires sg-words-moved, and the last one says where the words are', rows.every(r => r.fired.length >= 1 && Math.abs(r.fired.at(-1).x - r.dragged.at.x) < 0.07 && Math.abs(r.fired.at(-1).y - r.dragged.at.y) < 0.07 && r.fired.at(-1).home === false), rows.map(r => `${r.fired.length} events, last ${r.fired.at(-1) ? `${r.fired.at(-1).x.toFixed(2)},${r.fired.at(-1).y.toFixed(2)}` : 'none'} (drag ${r.dragged.at.x.toFixed(2)},${r.dragged.at.y.toFixed(2)})`).join('; '));
  check('no console errors (keys)', rows.every(r => !r.errors.length), rows.flatMap(r => r.errors).join(' | '));
  const broken = [];
  for (const place of PLACES) broken.push({ place, ...(await keysAt(place, NO_KEYS)) });
  check('control: a grip with no key handling is caught (Home does not go home and the keys reach none of the places)', rows.every(reached) && broken.every(r => !reached(r)), broken.map(r => `${r.place.join(',')}: after Home at ${JSON.stringify(r.back.at)}, keys off by ${off(r)}, says "${r.keyed.said}"`).join('; '));
}

// ── 4. contrast through the glass ─────────────────────────────────────────────
// Real pixels: the page is photographed with the words made transparent, so what is under each line box is the glass
// itself (tint, blur and drawing), and the words' real colour is held against every one of those pixels.
const TWENTY = { 'packages/tokens/tokens.css': [['--sg-glass-tint: 74%;', '--sg-glass-tint: 20%;'], ['--sg-glass-tint: 66%;', '--sg-glass-tint: 20%;']] };
async function glassContrast(register, theme, place, patch = {}) {
  const { ctx, page, errors } = await openAt(`${GLASS}&register=${register}&theme=${theme}&words=${place.join(',')}`, { patch });
  await grown(page);
  await page.locator('#glass').scrollIntoViewIfNeeded();
  await frames(page, 3);
  // the words' colours and boxes first, then hide them and the grip
  const lines = await page.evaluate(() => {
    const rgba = css => { const x = new OffscreenCanvas(1, 1).getContext('2d'); x.fillStyle = css; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const el = document.getElementById('glass');
    const out = [...el.children].map(c => { const r = c.getBoundingClientRect(), cs = getComputedStyle(c); return { tag: c.tagName, x: r.left, y: r.top, w: r.width, h: r.height, ink: rgba(cs.color) }; });
    const st = document.createElement('style'); st.id = 'hide'; st.textContent = '#glass h2, #glass p { color: transparent !important; }'; document.head.append(st);
    const g = el.shadowRoot.querySelector('.grip'), gs = document.createElement('style'); gs.textContent = '.grip{visibility:hidden}'; el.shadowRoot.append(gs);
    return { lines: out, grip: g && !g.hidden ? (r => ({ x: r.left, y: r.top, w: r.width, h: r.height }))(g.getBoundingClientRect()) : null, blur: getComputedStyle(el.shadowRoot.querySelector('.panel')).backdropFilter };
  });
  const worst = [];
  for (let k = 0; k < 3; k++) {
    await page.waitForTimeout(350);
    for (const l of lines.lines) {
      const png = await page.screenshot({ clip: { x: l.x, y: l.y, width: l.w, height: l.h } });
      const r = await page.evaluate(async ([b64, ink]) => {
        const i = new Image(); i.src = `data:image/png;base64,${b64}`; await i.decode();
        const cv = new OffscreenCanvas(i.width, i.height), g = cv.getContext('2d'); g.drawImage(i, 0, 0);
        const d = g.getImageData(0, 0, i.width, i.height).data;
        const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const L = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
        const [tr, tg, tb, ta] = ink; let lo = 99, hi = 0, n = 0, bad = 0;
        for (let p = 0; p < d.length; p += 4) {
          const lb = L(d[p], d[p + 1], d[p + 2]), lt = L(tr * ta + d[p] * (1 - ta), tg * ta + d[p + 1] * (1 - ta), tb * ta + d[p + 2] * (1 - ta));
          const ratio = (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05);
          n++; lo = Math.min(lo, ratio); hi = Math.max(hi, ratio); if (ratio < 4.5) bad++;
        }
        return { lo, hi, n, bad };
      }, [png.toString('base64'), l.ink]);
      worst.push({ tag: l.tag, ...r });
    }
  }
  const gripOnWords = lines.grip && lines.lines.some(l => lines.grip.x < l.x + l.w && lines.grip.x + lines.grip.w > l.x && lines.grip.y < l.y + l.h && lines.grip.y + lines.grip.h > l.y);
  await ctx.close();
  return { lo: Math.min(...worst.map(w => w.lo)), hi: Math.max(...worst.map(w => w.hi)), bad: worst.reduce((n, w) => n + w.bad, 0), px: worst.reduce((n, w) => n + w.n, 0), blur: lines.blur, gripOnWords, errors };
}
if (want('4')) {
  const rows = [];
  for (const register of ['warm', 'playful']) {
    for (const theme of ['light', 'dark']) {
      for (const place of PLACES) rows.push({ register, theme, place, ...(await glassContrast(register, theme, place)) });
    }
  }
  const tag = r => `${r.register} ${r.theme} ${r.place.join(',')}`;
  if (process.env.DETAIL) for (const r of rows) console.log(`  cell  ${tag(r)}: worst ${r.lo.toFixed(2)}:1, best ${r.hi.toFixed(1)}:1, ${r.bad} of ${r.px} pixels under 4.5`);
  const low = rows.reduce((a, r) => (r.lo < a.lo ? r : a));
  check('contrast through the glass: 4.5:1 against every real pixel under every line box, warm and playful, light and dark, at three places', rows.every(r => r.bad === 0 && r.px > 1000), `worst ${low.lo.toFixed(2)}:1 (${tag(low)}); ${rows.reduce((n, r) => n + r.px, 0)} pixels read; best ${Math.max(...rows.map(r => r.hi)).toFixed(1)}:1`);
  check('contrast: the glass is really on (backdrop-filter blurs the drawing behind the words) and the grip never sits on a line box', rows.every(r => /blur\(/.test(r.blur) && !r.gripOnWords), [...new Set(rows.map(r => r.blur))].join(' | '));
  check('no console errors (contrast)', rows.every(r => !r.errors.length), rows.flatMap(r => r.errors).join(' | '));
  const broken = [];
  for (const register of ['warm', 'playful']) {
    for (const theme of ['light', 'dark']) {
      for (const place of PLACES) broken.push({ register, theme, place, ...(await glassContrast(register, theme, place, TWENTY)) });
    }
  }
  const lowB = broken.reduce((a, r) => (r.lo < a.lo ? r : a));
  check('control: a panel at 20% tint is caught (some pixels under the words fall below 4.5:1)', broken.some(r => r.bad > 0), `${broken.filter(r => r.bad > 0).length} of ${broken.length} cells fail; worst ${lowB.lo.toFixed(2)}:1 (${tag(lowB)})`);
}

// ── 5. phone and text size ─────────────────────────────────────────────────────
// Where the words would cover too much of the picture (a phone, big text) they go below it, flat, and the grip goes.
const SHOWS_STACKED = { 'packages/core/movable.js': [["const want = reg !== 'quiet' && !frame.classList.contains('stacked') && !panel.hidden && canMove(r);", "const want = reg !== 'quiet' && !panel.hidden && canMove(r);"]] };
async function flat(width, height, { root = null, patch = {}, words = '0.5,0.5' } = {}) {
  const { ctx, page, errors } = await openAt(`${GLASS}&register=warm&words=${words}`, { width, height, root, patch });
  await frames(page, 6);
  await page.waitForTimeout(600);
  const g = await geometry(page);
  const named = await page.getByRole('button', { name: 'Move the words' }).count();
  const wordsSeen = await page.evaluate(() => { const el = document.getElementById('glass'), b = el.shadowRoot.querySelector('.stage').getBoundingClientRect(); return [...el.children].every(c => { const r = c.getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth + 1 && r.left >= -1; }); });
  await ctx.close();
  return { ...g, named, wordsSeen, errors };
}
{
  const cells = [['390 px', 390, 844, null], ['390 px, text at 200%', 390, 844, '32px']];
  const rows = [];
  for (const [name, w, hh, root] of cells) rows.push({ name, ...(await flat(w, hh, { root })) });
  const say = r => `${r.name}: grip in the tree ${r.named}, stacked ${r.stacked}, transform "${r.transform}", scroll ${r.scrollW}/${r.clientW}`;
  check('phone: at 390 px, plain and at 200% text, the grip is gone, the words are flat below the picture (even with words-at set), and nothing scrolls sideways', rows.every(r => r.named === 0 && !r.gripShown && r.stacked && r.transform === '' && r.scrollW <= r.clientW && r.wordsSeen), rows.map(say).join('; '));
  check('no console errors (phone)', rows.every(r => !r.errors.length), rows.flatMap(r => r.errors).join(' | '));
  const broken = await flat(390, 844, { patch: SHOWS_STACKED });
  check('control: a grip that ignores the stacked layout is caught (it shows over the phone’s picture)', broken.named > 0 || broken.gripShown, say({ name: '390 px, patched', ...broken }));
  // what the request calls "200%" on a desktop: worth recording, not a rule (there is room to move, so the grip stays)
  const zoom = await flat(640, 900, { words: '0.5,0.5' }), text = await flat(1280, 900, { root: '32px' });
  console.log(`  note  200% browser zoom (a 640 px viewport): grip ${zoom.gripShown}, stacked ${zoom.stacked}, scroll ${zoom.scrollW}/${zoom.clientW}; 1280 px with 200% text: grip ${text.gripShown}, stacked ${text.stacked}, scroll ${text.scrollW}/${text.clientW}`);
  check('200%: on a desktop the words stay inside the picture and nothing scrolls sideways, at 200% browser zoom and at 200% text', [zoom, text].every(r => r.scrollW <= r.clientW && r.wordsSeen), `zoom: scroll ${zoom.scrollW}/${zoom.clientW}, grip ${zoom.gripShown}; text: scroll ${text.scrollW}/${text.clientW}, grip ${text.gripShown}`);
  // quiet never moves
  const q = await openAt(`${GLASS}&register=quiet&words=0.5,0.5`);
  await frames(q.page, 6); await q.page.waitForTimeout(500);
  const qg = await geometry(q.page);
  check('quiet: no grip, no glass and no transform, whatever words-at says', !qg.gripShown && qg.transform === '' && await q.page.evaluate(() => getComputedStyle(document.getElementById('glass').shadowRoot.querySelector('.panel')).backdropFilter === 'none'), `grip ${qg.gripShown}, transform "${qg.transform}"`);
  await q.ctx.close();
}

// ── 6. the pause button stays reachable ────────────────────────────────────────
const NO_AVOID = { 'packages/core/movable.js': [['if (place && b?.width) {', 'if (false) {']] };
async function pauseClear(patch = {}) {
  const { ctx, page } = await openAt(`${GLASS}&register=warm&words=1,0`, { patch });
  await grown(page);
  const r = await page.evaluate(() => {
    const sr = document.getElementById('glass').shadowRoot, t = sr.querySelector('button[part=toggle]').getBoundingClientRect(), p = sr.querySelector('.panel').getBoundingClientRect(), g = sr.querySelector('.grip').getBoundingClientRect();
    const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return { toggleShown: !sr.querySelector('button[part=toggle]').hidden, panelOverToggle: hit(p, t), gripOverToggle: hit(g, t), toggle: [t.left, t.top, t.right, t.bottom].map(Math.round), panel: [p.left, p.top, p.right, p.bottom].map(Math.round) };
  });
  await ctx.close();
  return r;
}
{
  const ok = await pauseClear();
  check('the pause button stays reachable: with the words sent to the top right corner the panel and grip sit clear of it', ok.toggleShown && !ok.panelOverToggle && !ok.gripOverToggle, `pause ${ok.toggle}, panel ${ok.panel}`);
  const broken = await pauseClear(NO_AVOID);
  check('control: a build that does not step round the pause button is caught (the panel covers it)', broken.panelOverToggle || broken.gripOverToggle, `pause ${broken.toggle}, panel ${broken.panel}`);
}

// ── 7. postcards ──────────────────────────────────────────────────────────────
const NO_URL = { 'packages/scenes/tinto/world.html': [["history.replaceState(null, '', u.href.replace('%2C', ','));", '']] };
async function postcard(patch = {}) {
  const out = { errors: [] };
  const opened = await openAt(`${GLASS}&register=warm&words=0.25,0.8`, { patch });
  const { page } = opened;
  await grown(page);
  await page.evaluate(() => document.getElementById('glass').scrollIntoView({ block: 'center' }));
  await frames(page, 2);
  const g1 = await geometry(page);
  out.opened = g1.at;
  out.insideStage = g1.panel.left >= g1.stage.left && g1.panel.right <= g1.stage.right && g1.panel.top >= g1.stage.top && g1.panel.bottom <= g1.stage.bottom;
  await page.evaluate(() => { window.__moved = []; document.getElementById('glass').addEventListener('sg-words-moved', e => window.__moved.push(e.detail)); });
  // a drag in two halves: nothing is said until the words are let go
  const grip = await geometry(page);
  await page.mouse.move(grip.grip.x, grip.grip.y); await page.mouse.down(); await page.mouse.move(grip.grip.x - 120, grip.grip.y - 60, { steps: 5 });
  await frames(page, 3);
  out.duringDrag = await page.evaluate(() => window.__moved.length);
  await page.mouse.up(); await frames(page, 3);
  out.afterDrop = await page.evaluate(() => window.__moved.slice());
  out.url = page.url();
  out.dropped = (await geometry(page)).at;
  // Copy this view copies the address, and says so
  await page.locator('#copy').scrollIntoViewIfNeeded();
  await page.locator('#copy').click();
  await page.waitForFunction(() => document.getElementById('copied').textContent === 'Link copied', null, { timeout: 4000 }).catch(() => {});
  out.copied = await page.evaluate(() => document.getElementById('copied').textContent);
  out.clip = await page.evaluate(() => navigator.clipboard.readText()).catch(e => `no clipboard: ${e}`);
  out.href = await page.evaluate(() => document.getElementById('copy').href);
  // a shared link opens with the words where they were left
  const shared = await openAt(out.url.replace(/^https?:\/\/[^/]+/, ''), { width: 1000, height: 800 });
  await grown(shared.page);
  out.sharedAt = (await geometry(shared.page)).at;
  await shared.ctx.close();
  // Home takes the place out of the address
  await page.locator('sg-scene .grip').focus();
  await page.keyboard.press('Home'); await frames(page, 2);
  out.homeUrl = page.url();
  out.errors.push(...opened.errors);
  await opened.ctx.close();
  return out;
}
{
  const p = await postcard();
  const near = (a, x, y) => a && Math.abs(a.x - x) < 0.003 && Math.abs(a.y - y) < 0.003;
  check('postcard: ?words=0.25,0.8 opens with the words at that place, inside the picture, and says nothing about it', near(p.opened, 0.25, 0.8) && p.insideStage, `at ${JSON.stringify(p.opened)}, inside the stage: ${p.insideStage}`);
  check('postcard: nothing is announced while the words are dragged, one sg-words-moved when they are let go', p.duringDrag === 0 && p.afterDrop.length === 1 && typeof p.afterDrop[0].x === 'number' && p.afterDrop[0].home === false, `${p.duringDrag} during, ${p.afterDrop.length} after: ${JSON.stringify(p.afterDrop)}`);
  const m = /[?&]words=([\d.]+),([\d.]+)/.exec(p.url);
  check('postcard: the address follows the drop (?words=x,y, comma kept), and matches where the words are', !!m && near(p.dropped, +m[1], +m[2]) && p.afterDrop[0] && Math.abs(p.afterDrop[0].x - +m[1]) < 0.001, `${p.url.replace(/^https?:\/\/[^/]+/, '')} vs ${JSON.stringify(p.dropped)}`);
  check('postcard: "Copy this view" copies the address as it stands, and says Link copied', p.clip === p.url && p.copied === 'Link copied' && p.href === p.url, `clipboard ${p.clip === p.url ? 'equals the address' : p.clip}; says "${p.copied}"`);
  check('postcard: a shared link opens with the words where the sender left them, at another width', m && near(p.sharedAt, +m[1], +m[2]), `at ${JSON.stringify(p.sharedAt)} in a 1000 px window`);
  check('postcard: Home takes the place out of the address', !/words=/.test(p.homeUrl), p.homeUrl.replace(/^https?:\/\/[^/]+/, ''));
  check('no console errors (postcard)', !p.errors.length, p.errors.join(' | '));
  const broken = await postcard(NO_URL);
  const bm = /[?&]words=([\d.]+),([\d.]+)/.exec(broken.url);
  check('control: a demo that never writes the address is caught (the drop leaves the link where it was)', !bm || !near(broken.dropped, +bm[1], +bm[2]), broken.url.replace(/^https?:\/\/[^/]+/, ''));
}

// ── axe, and no request leaves the page ───────────────────────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  for (const theme of ['light', 'dark']) {
    const { ctx, page, errors } = await openAt(`${GLASS}&register=${register}&theme=${theme}`);
    if (register !== 'quiet') await grown(page); else await frames(page, 4);
    const v = await h.axe(page);
    check(`axe: glass, ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
    if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
    await ctx.close();
  }
}
{
  const { ctx, page } = await openAt(`${GLASS}&register=warm&theme=dark&words=0.3,0.3`);
  await grown(page);
  await page.locator('sg-scene .grip').focus();
  const focusedName = await page.evaluate(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return a?.getAttribute('aria-label'); });
  const v = await h.axe(page);
  check('axe: glass, warm, dark, with the grip focused', focusedName === 'Move the words' && v.length === 0, `focused "${focusedName}"; ${v.join('; ') || '0 violations'}`);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Shift+ArrowDown'); await frames(page, 3);
  const v2 = await h.axe(page);
  check('axe: glass, warm, dark, after the keys have moved the words', v2.length === 0, v2.join('; ') || '0 violations');
  await ctx.close();
  const phone = await openAt(`${GLASS}&register=warm`, { width: 390, height: 844 });
  await frames(phone.page, 6);
  const v3 = await h.axe(phone.page);
  check('axe: glass, warm, at 390 px', v3.length === 0, v3.join('; ') || '0 violations');
  await phone.ctx.close();
}
{
  const out = new Set();
  const { ctx, page } = await openAt(`${GLASS}&register=playful`);
  page.on('request', r => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) out.add(u.host); });
  await page.reload(); await grown(page); await page.waitForTimeout(800);
  check('no request leaves the page (glass, playful)', out.size === 0, [...out].join(', ') || 'none');
  await ctx.close();
}

await h.done();
