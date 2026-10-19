// Browser checks for Vaati that a Node test cannot reach:
//
//   node packages/scenes/vaati/vaati.check.mjs
//
// 1. progress is real state: with progress set, the canvas does not change
//    over two seconds of running frames, and the status names the work.
// 2. the still is finished: under reduced motion the bowl holds sauce and
//    cheese inside its ring (measured against the same bowl without each,
//    and against a bowl before the pour, which must read none).
// 3. the settle event fires exactly once per run, after the garnish lands,
//    never under progress; a toss does not fire it again.
// 4. nothing is drawn outside the bowl once settled (pasta-coloured pixels
//    outside the rim), while a piece in flight does read outside it.
// 5. the bowl is at most 62% of the scene's height and centred; playful:
//    Enter tosses the pieces and they land again, with no errors.
//
// 6. the demo's opening (?opening=1), at 390x844 and 1280x800 in each register: the scene's pause button
//    is wholly inside the viewport and focusing it scrolls nothing; "Come in" is not focusable or visible
//    until the meal is made; "Skip" is visible from the first frame, inside the viewport, and brings in
//    "Come in" at once; the bowl leaves room for pieces to arrive on a phone.
//
// Each was watched failing first on a broken build (see the request,
// docs/requests/2026-10-04-food-site.md, and the report).

import { harness } from '../../../tools/lib/component-check.mjs';
import { openScene } from '../../../tools/lib/scene-probe.mjs';
import { BOWL, W, H, timeline } from './model.js';
import { canvasPrint, pollUntil, rafs, stillSettled } from '../../../tools/lib/wait.mjs';
import { frames, openStepped, until } from '../../../tools/lib/virtual-time.mjs';

const s = await harness({ axe: 'tools/smoke.mjs axes the scene page once, in its default register and theme; the other registers are not axe-checked yet (docs/DEBT.md)' });
const { check } = s;

// Scene time is stepped where a clause waits for the scene's own clock: the run to the garnish, the toss in the air, the opening that
// settles by itself (tools/lib/virtual-time.mjs: each step is a sixtieth of a second of the scene's time). On the real clock still:
// the stills (nothing moves), and "Skip settles the opening within 1500 ms", which is a bar on the page's real latency.
/** The scene page on virtual frames, with the pixel probes of openScene (tools/lib/scene-probe.mjs) that these clauses use. */
async function openRun(params, { reduced = false, init = null } = {}) {
  const q = new URLSearchParams({ name: 'vaati', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const o = await openStepped(s, `/tools/harness/scene.html?${q}`, { reduced, setup: init ? ctx => ctx.addInitScript(init) : null });
  const { page } = o;
  await page.evaluate(() => document.fonts.ready);
  return {
    ...o,
    hash: () => page.evaluate(() => {
      const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data;
      let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) >>> 0;
      return h;
    }),
    status: () => page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent),
    snap: name => page.evaluate(n => { const cv = window.__piece.shadowRoot.querySelector('canvas'); (window.__snaps ??= {})[n] = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height); }, name),
    changed: (a, b, box, threshold = 24) => page.evaluate(([a, b, box, threshold]) => {
      const A = window.__snaps[a], B = window.__snaps[b], { W, H } = window.__piece.meta, kx = A.width / W, ky = A.height / H;
      const x0 = Math.max(0, Math.round(box.x * kx)), y0 = Math.max(0, Math.round(box.y * ky)), x1 = Math.min(A.width, Math.round((box.x + box.w) * kx)), y1 = Math.min(A.height, Math.round((box.y + box.h) * ky));
      let n = 0, c = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * A.width + x) * 4; n++; if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > threshold) c++; }
      return n ? c / n : 0;
    }, [a, b, box, threshold]),
    close: () => o.ctx.close(),
  };
}
/** stillSettled (tools/lib/wait.mjs) for a stepped page: fonts in, and the canvas fingerprint unchanged for 6 frames. {ok:false} means it kept changing. */
const steady = (page, { need = 6, max = 1200 } = {}) => page.evaluate(async ([src, need, max]) => {
  await document.fonts?.ready;
  const print = new Function(`return (${src})()`);
  let last, same = 0;
  for (let i = 0; i < max; i++) { await window.__tools.step(1); const v = print(); if (v === last) same++; else { same = 0; last = v; } if (same >= need) return { ok: true }; }
  return { ok: false };
}, [canvasPrint.toString(), need, max]);

/** Samples of the canvas inside the bowl's lip (every 3rd pixel), as [r,g,b] triples, for comparing two bowls. */
const grab = p => p.page.evaluate(([cx, cy, R]) => {
  const el = window.__piece, cv = el.shadowRoot.querySelector('canvas'), { W, H } = el.meta, k = cv.width / W;
  const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data, out = [];
  for (let y = 0; y < cv.height; y += 3) for (let x = 0; x < cv.width; x += 3) {
    if (Math.hypot(x / k - cx, y / k - cy) > R) continue;
    const i = (y * cv.width + x) * 4; out.push(d[i], d[i + 1], d[i + 2]);
  }
  return out;
}, [BOWL.x, BOWL.y, BOWL.lip]);
const diffShare = (a, b) => { let n = 0, c = 0; for (let i = 0; i < a.length; i += 3) { n++; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) c++; } return c / n; };
/** Count pixels passing `test` (source of a function of [r,g,b]) inside or outside a ring of logical radius R around the bowl. */
const ring = (p, test, { inside = true, R = BOWL.lip } = {}) => p.page.evaluate(([src, cx, cy, R, inside]) => {
  const el = window.__piece, cv = el.shadowRoot.querySelector('canvas'), { W } = el.meta, k = cv.width / W, fn = new Function('return ' + src)();
  const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data;
  let hit = 0, n = 0;
  for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 2) {
    const within = Math.hypot(x / k - cx, y / k - cy) <= R;
    if (within !== inside) continue;
    n++; const i = (y * cv.width + x) * 4;
    if (fn([d[i], d[i + 1], d[i + 2]])) hit++;
  }
  return { hit, n };
}, [test.toString(), BOWL.x, BOWL.y, R, inside]);
const SAUCE = ([r, g, b]) => r > 140 && r - g > 55 && r - b > 45 && g < 125; // tomato red
const PASTA = ([r, g, b]) => r > 205 && g > 160 && g < 215 && b < 125 && r - b > 95; // golden pasta (flat poster colour)

// 1
for (const register of ['warm', 'playful']) {
  const p = await openRun({ register, progress: 0.5, label: 'Your order' });
  await steady(p.page);
  const a = await p.hash();
  await frames(p.page, 120); // two seconds of the scene's time
  const b = await p.hash();
  // the scene's status is said at most once a second on the real clock (a timer, scene-element.js #status): a page this young has not said it yet
  await until(p.page, () => window.__piece.shadowRoot.querySelector('[role=status]').textContent !== '', { ms: 5000 });
  check(`progress set (${register}): the drawing holds still while the work does`, a === b, `${a} then ${b}`);
  check(`progress set (${register}): the status names the work`, (await p.status()) === 'Your order: 50% full', `"${await p.status()}"`);
  check(`no console errors (progress, ${register})`, p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 2
for (const register of ['warm', 'playful']) {
  const full = await openScene(s, 'vaati', { register, reduced: true });
  await stillSettled(full.page);
  const fullPx = await grab(full), sauce = await ring(full, SAUCE);
  const bare = await openScene(s, 'vaati', { register, reduced: true, sauce: 'none' });
  const bareSauce = await ring(bare, SAUCE), barePx = await grab(bare);
  const plain = await openScene(s, 'vaati', { register, reduced: true, topping: 'none' });
  const plainPx = await grab(plain);
  const pre = await openScene(s, 'vaati', { register, progress: 0.2 });
  await stillSettled(pre.page);
  const preSauce = await ring(pre, SAUCE);
  const share = sauce.hit / sauce.n;
  check(`the still (${register}) shows sauce inside the bowl ring`, share > 0.12 && bareSauce.hit / bareSauce.n < 0.01, `tomato-red share ${share.toFixed(3)} with sauce, ${(bareSauce.hit / bareSauce.n).toFixed(4)} without`);
  check(`the still (${register}) differs from a bowl without sauce by a good part of the ring`, diffShare(fullPx, barePx) > 0.15, `${diffShare(fullPx, barePx).toFixed(3)} of the ring differs`);
  check(`the still (${register}) shows cheese: it differs from the same bowl without topping`, diffShare(fullPx, plainPx) > 0.01, `${diffShare(fullPx, plainPx).toFixed(4)} of the ring differs`);
  check(`a bowl before the pour (progress 0.2, ${register}) reads no sauce, so the check can fail`, preSauce.hit / preSauce.n < 0.01, `share ${(preSauce.hit / preSauce.n).toFixed(4)}`);
  for (const q of [full, bare, plain, pre]) await q.close();
}

// 3: count sg-scene-settled the way a page would, with a listener there before the scene mounts. Time is the scene's own: frames stepped, 60 to the second.
async function events(query, seconds, { press = false, reduced = false } = {}) {
  const run = await openRun(Object.fromEntries(new URLSearchParams(query)), { reduced, init: `
    window.__events = [];
    document.addEventListener('sg-scene-settled', e => window.__events.push({ at: window.__tools.frames, pieces: e.detail.pieces, composed: e.composed }), true);` });
  const { page } = run;
  const t0 = await page.evaluate(() => window.__tools.frames);
  if (press) {
    await until(page, () => window.__piece.hasAttribute('data-settled'), { ms: 20000 });
    await page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage').focus());
    await page.keyboard.press('Enter');
    await until(page, () => !window.__piece.playing, { ms: 20000 }); // the toss in the air, and landed: the event must not come again
  }
  await frames(page, Math.round(seconds * 60)); // 'exactly once', 'never' and 'within 0.3 s' are claims about the scene's clock
  const out = await page.evaluate(() => ({ events: window.__events, settled: window.__piece.hasAttribute('data-settled') }));
  await run.close();
  return { events: out.events.map(e => ({ ...e, at: (e.at - t0) / 60 })), settled: out.settled, t0, errors: run.errors };
}
{
  const done = timeline('playful').done;
  const run = await events('register=playful', done + 2.5);
  check('playful run: sg-scene-settled fires exactly once', run.events.length === 1, `${run.events.length} event(s)`);
  const at = run.events[0] ? run.events[0].at : -1;
  check('playful run: it fires when the garnish lands, within 0.3 s either way', at >= done - 0.3 && at <= done + 0.3, `fired ${at.toFixed(2)} s of scene time after ready, the garnish lands at ${done.toFixed(2)} s`);
  check('playful run: the event bubbles out of the shadow root, and the page can also read data-settled', run.events[0]?.composed === true && run.settled, `composed ${run.events[0]?.composed}, data-settled ${run.settled}`);
  const prog = await events('register=playful&progress=1', 2.5);
  check('progress set: the event never fires and data-settled is not set', prog.events.length === 0 && !prog.settled, `${prog.events.length} event(s), data-settled ${prog.settled}`);
  const quiet = await events('register=quiet', 0.6), calm = await events('register=warm', 0.6, { reduced: true });
  check('the still (quiet, and reduced motion) fires the event once so a page can bring in its words', quiet.events.length === 1 && calm.events.length === 1, `quiet ${quiet.events.length}, reduced ${calm.events.length}`);
  const tossed = await events('register=playful', 0.5, { press: true });
  check('playful: a toss does not fire the event again', tossed.events.length === 1, `${tossed.events.length} event(s) after the run and a toss`);
  check('no console errors (events)', run.errors.length + prog.errors.length + tossed.errors.length === 0, [...run.errors, ...prog.errors, ...tossed.errors].join(' | '));
}

// 4
{
  const p = await openScene(s, 'vaati', { register: 'playful', reduced: true });
  await stillSettled(p.page);
  const out = await ring(p, PASTA, { inside: false, R: BOWL.R + 6 }), inside = await ring(p, PASTA);
  check('settled: no pasta-coloured pixel outside the rim', out.hit === 0 && inside.hit > 500, `${out.hit} outside, ${inside.hit} inside`);
  await p.close();
  // while a piece is in flight, the same measure must read pasta outside the rim (it can fail)
  const fly = await openScene(s, 'vaati', { register: 'playful', progress: 0.065 });
  await stillSettled(fly.page);
  const flying = await ring(fly, PASTA, { inside: false, R: BOWL.R + 6 });
  check('a piece in flight does read outside the rim, so the check can fail', flying.hit > 100, `${flying.hit} pasta pixels outside the rim at progress 0.065`);
  await fly.close();
}

// 5
{
  const p = await openScene(s, 'vaati', { register: 'playful', reduced: true });
  await stillSettled(p.page);
  const box = await p.page.evaluate(() => {
    const cv = window.__piece.shadowRoot.querySelector('canvas'), { W, H } = window.__piece.meta, k = cv.width / W;
    const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data, bg = [d[0], d[1], d[2]];
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4;
      if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 60) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    return { x0: x0 / k, y0: y0 / k, x1: x1 / k, y1: y1 / k };
  });
  const height = box.y1 - box.y0, cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  check('the bowl (with its shadow) is at most 62% of the scene height', height <= 0.62 * H, `${height.toFixed(0)} of ${H} units tall (${((height / H) * 100).toFixed(1)}%)`);
  check('the bowl is centred', Math.abs(cx - W / 2) < 14 && Math.abs(cy - H / 2) < 14, `centre ${cx.toFixed(0)}, ${cy.toFixed(0)} against ${W / 2}, ${H / 2}`);
  await p.close();
}
{
  const p = await openRun({ register: 'playful' });
  await until(p.page, () => window.__piece.hasAttribute('data-settled'), { ms: 20000 });
  await until(p.page, () => !window.__piece.playing, { ms: 20000 }); // the scene has come to rest
  await steady(p.page);
  await p.snap('rest');
  await p.page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage').focus());
  await p.page.keyboard.press('Enter');
  const ringBox = { x: BOWL.x - BOWL.lip, y: BOWL.y - BOWL.lip, w: BOWL.lip * 2, h: BOWL.lip * 2 };
  // the bowl changes while the pieces are in the air: looked at, frame after frame, until it has (no longer than 5 s of the scene's time)
  let air = { ok: false };
  for (let k = 0; k < 300 && !air.ok; k++) { await frames(p.page, 1); await p.snap('air'); air.ok = (await p.changed('rest', 'air', ringBox)) > 0.04 && await p.page.evaluate(() => window.__piece.playing); }
  const moved = await p.changed('rest', 'air', ringBox);
  // and they land: the scene stops asking for frames
  await until(p.page, () => !window.__piece.playing, { ms: 30000 });
  await steady(p.page);
  await p.snap('landed');
  const same = await p.changed('rest', 'landed', ringBox);
  const playing = await p.page.evaluate(() => window.__piece.playing);
  check('playful: Enter tosses the pieces (the bowl changes mid-air)', moved > 0.04, `${(moved * 100).toFixed(1)}% of the ring changed once the pieces were in the air${air.ok ? '' : ' (they never were, in 5 s)'}`);
  check('playful: they land again and the scene rests (no frames)', !playing, `playing ${playing}`);
  check('playful: they land in a different arrangement', same > 0.01, `${(same * 100).toFixed(1)}% of the ring differs from before the toss`);
  check('no console errors (toss)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 6
const inside = (r, vw, vh) => r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= vw && r.bottom <= vh;
for (const [vw, vh] of [[390, 844], [1280, 800], [1200, 800]]) for (const register of ['quiet', 'warm', 'playful']) {
  const tag = `opening ${vw}x${vh} ${register}`;
  const page = await s.browser.newPage({ viewport: { width: vw, height: vh } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${s.server.url}/packages/scenes/vaati/demo.html?opening=1&register=${register}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await rafs(page, 5);
  const probe = () => page.evaluate(() => {
    const sc = document.getElementById('open-scene'), tg = sc.shadowRoot.querySelector('[part=toggle]'), op = document.getElementById('opening');
    const box = e => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const en = document.getElementById('enter'), sk = document.getElementById('skip');
    return {
      toggle: tg && !tg.hidden ? box(tg) : null, masked: (getComputedStyle(sc).maskImage || 'none') !== 'none', skip: !sk || getComputedStyle(sk).display === 'none' ? null : box(sk), scene: box(sc),
      enterVis: getComputedStyle(en).visibility, settled: op.classList.contains('settled'),
      scroll: [op.scrollLeft, op.scrollTop, window.scrollX, window.scrollY],
      active: document.activeElement === document.body ? 'body' : document.activeElement.id || (document.activeElement.shadowRoot ? 'scene' : document.activeElement.tagName),
      inShadow: !!sc.shadowRoot.activeElement && (sc.shadowRoot.activeElement.getAttribute('part') || sc.shadowRoot.activeElement.className),
    };
  });
  const first = await probe();
  if (register === 'quiet') {
    check(`${tag}: a still bowl has no pause button and settles at once`, first.toggle === null && first.settled, `toggle ${JSON.stringify(first.toggle)}, settled ${first.settled}`);
  } else {
    check(`${tag}: the pause button is wholly inside the viewport`, first.toggle && inside(first.toggle, vw, vh), first.toggle ? `rect x ${first.toggle.left.toFixed(0)}..${first.toggle.right.toFixed(0)}, y ${first.toggle.top.toFixed(0)}..${first.toggle.bottom.toFixed(0)} of ${vw}x${vh}` : 'no button while playing');
    if (first.toggle) { const f = 0.14 * first.scene.height, r = first.scene; const inFade = first.masked && (first.toggle.bottom > r.top && first.toggle.top < r.top + f || first.toggle.top < r.bottom && first.toggle.bottom > r.bottom - f); check(`${tag}: the pause button is not under the scene's edge fade`, !inFade, `masked ${first.masked}, scene y ${r.top.toFixed(0)}..${r.bottom.toFixed(0)}, button y ${first.toggle.top.toFixed(0)}..${first.toggle.bottom.toFixed(0)}`); }
    check(`${tag}: "Skip" has an accessible name that says what it does`, await page.$eval('#skip', e => e.getAttribute('aria-label') === 'Skip the animation' && e.textContent.trim() === 'Skip'), 'aria-label "Skip the animation", visible "Skip"');
    check(`${tag}: "Skip" is visible from the first frame and inside the viewport`, first.skip && inside(first.skip, vw, vh) && first.skip.width >= 44 && first.skip.height >= 44, first.skip ? `rect x ${first.skip.left.toFixed(0)}..${first.skip.right.toFixed(0)}, ${first.skip.width.toFixed(0)}x${first.skip.height.toFixed(0)}` : 'no Skip');
    check(`${tag}: "Come in" is hidden from the page until the meal is made`, first.enterVis === 'hidden' && !first.settled, `visibility ${first.enterVis}, settled ${first.settled}`);
    // Tab through everything before the settle: nothing may scroll the opening, and "Come in" must not take focus
    const seen = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); const r = await probe(); seen.push(`${r.active}${r.inShadow ? ':' + r.inShadow : ''}`); if (r.scroll.some(v => v !== 0)) seen.push(`SCROLLED ${r.scroll}`); }
    const after = await probe();
    after.scroll = seen.some(x => x.startsWith('SCROLLED')) ? seen.find(x => x.startsWith('SCROLLED')).split(' ')[1].split(',').map(Number) : after.scroll;
    check(`${tag}: Tab reaches the pause button and scrolls nothing`, seen.some(x => /toggle/.test(x)) && after.scroll.every(v => v === 0), `focus order ${seen.join(' > ')}; scroll ${after.scroll}`);
    check(`${tag}: before the settle Tab never lands on "Come in"`, !seen.some(x => x === 'enter') && !after.settled, `focus order ${seen.join(' > ')}`);
    if (vw === 390 && register === 'playful') {
      const bowl = (2 * (BOWL.R + 14) * first.scene.width) / W;
      check(`${tag}: the bowl and its shadow leave room each side for pieces to arrive`, bowl <= 0.82 * vw, `bowl with shadow ${bowl.toFixed(0)} of ${vw} px wide (${((bowl / vw) * 100).toFixed(0)}%), scene ${first.scene.width.toFixed(0)} px wide`);
    }
    // Skip: the way in, at once
    if (!(await page.$('#skip'))) { check(`${tag}: Skip exists`, false, 'no #skip in the demo'); await page.close(); continue; }
    await page.evaluate(() => { document.getElementById('opening').scrollTo(0, 0); document.getElementById('skip').focus(); });
    const t0 = Date.now();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('opening').classList.contains('settled'), null, { timeout: 4000 });
    const settleMs = Date.now() - t0; // the time it took to settle, read at once: the old check slept 700 ms after this and wanted 1,500 ms in all, so 800 ms is the same bar
    await page.waitForFunction(() => document.activeElement.id === 'enter' && getComputedStyle(document.getElementById('enter')).visibility === 'visible', null, { timeout: 3000 }).catch(() => {});
    const totalMs = Date.now() - t0; // the old bar kept: "Come in" focused within 1500 ms of the press, in all
    const skipped = await probe();
    check(`${tag}: Skip settles the opening within a second and brings in "Come in", focused`, skipped.enterVis === 'visible' && skipped.active === 'enter' && settleMs < 800 && totalMs < 1500, `visibility ${skipped.enterVis}, focus on ${skipped.active}, settled in ${settleMs} ms, "Come in" focused by ${totalMs} ms`);
    // a settle on its own, with focus on Skip: focus moves on to "Come in", and the page says so
    if (register === 'playful' && vw === 1280) {
      // the meal settles on the scene's own clock: stepped, not waited for (the Skip bar above stays on the real one)
      const { ctx: qc, page: q } = await openStepped(s, '/packages/scenes/vaati/demo.html?opening=1&register=playful', { view: { viewport: { width: vw, height: vh } } });
      await q.evaluate(() => document.getElementById('skip').focus());
      const said0 = await q.$eval('#ready', e => e.textContent);
      await until(q, () => document.getElementById('opening').classList.contains('settled'), { ms: 30000 });
      await until(q, () => document.activeElement.id === 'enter', { ms: 3000 });
      const st = await q.evaluate(() => ({ active: document.activeElement.id, said: document.getElementById('ready').textContent, role: document.getElementById('ready').getAttribute('role'), inside: document.getElementById('opening').contains(document.getElementById('ready')) }));
      check(`${tag}: if Skip has focus when the meal settles by itself, focus moves to "Come in"`, st.active === 'enter', `focus on ${st.active}`);
      check(`${tag}: a status region in the opening says the bowl is ready, only on the settle`, said0 === '' && st.said === 'The bowl is ready.' && st.role === 'status' && st.inside, `before "${said0}", after "${st.said}"`);
      await qc.close();
    }
  }
  check(`no console errors (${tag})`, errors.length === 0, errors.join(' | '));
  await page.close();
}

await s.done();
