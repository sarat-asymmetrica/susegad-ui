// Browser checks for the words in the veranda (<sg-veranda-stage>, words.html): the pane inside the drawing.
//
//   node packages/scenes/veranda/words.check.mjs            (or: npm run check)
//   node packages/scenes/veranda/words.check.mjs --break    (against patched builds: every check marked below must FAIL)
//
// Runs on this machine's GPU (ANGLE on Direct3D 11) so the live tier is real. What is measured is what a person sees (the page's
// own screenshots) and the page's own accessibility tree; the depth the checks read is world.js's G-buffer, made independently
// of the element's own copy of the map.
//
//  1. real text: at four depths and in three tiers (live, 2D without WebGL, quiet) the words are in the accessibility tree;
//  2. occlusion is honest: with the pane half behind the pillar, the pane's pixels are gone where the depth map is nearer than
//     the pane, and where it is not they are the pane;
//  3. readable on release: drop the pane behind the pillar and, once it has settled, less than 15% of the lines' area is covered;
//  4. contrast: 4.5:1 against every pixel under each line box, at three depths, light and dark;
//  5. the still first: without WebGL, with three blocked, under reduced motion and in quiet, the finished veranda shows with the
//     words on it, and quiet and reduced motion never request three; with three held back the still is already up;
//  6. keyboard parity with depth: PageUp and PageDown reach every depth the wheel reaches, each press is said, Home goes home;
//  7. phone width: the words are flat below the picture, no grip, no mask, no horizontal scroll.
//
// --break patches the served build once per family: the words drawn into a canvas only (1), a mask that ignores depth (2), no
// settle on release (3), a 20% tint (4), a page that awaits three before it draws (5), a grip that ignores PageUp and PageDown (6).

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';
import { TURN } from '../../core/orient.core.js';

const BREAK = process.argv.includes('--break');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const server = await startServer({ quiet: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const THREE = /node_modules\/three\/|three\.named\.js|three(\.module|\.core)?\.js/;

/** Patches by file, applied to the served text when --break asks for one. */
const BREAKS = {
  canvasText: [/stage-element\.js$/, s => s.replace('panel.append(...words.filter(w => w !== this.#flowP));', "words.forEach(w => w.remove ? w.remove() : null); panel.append(Object.assign(document.createElement('canvas'), { width: 300, height: 60 }));")],
  flatMask: [/stage-element\.js$/, s => s.replace('shownPath(grid, cw, ch)', 'shownPath(new Uint8Array(grid.length), cw, ch)')],
  noSettle: [/stage-element\.js$/, s => s.replace('#settle({ quiet = false } = {}) {', '#settle({ quiet = false } = {}) {\n    return;')],
  awaitThree: [/stage-element\.js$/, s => s.replace('async #init() {', "async #init() {\n    await import('../../stage3d/vendor/three.named.js');")],
  noDepthKeys: [/stage-element\.js$/, s => s.replace("if (e.key !== 'PageUp' && e.key !== 'PageDown') return;", 'return;')],
  noPlates: [/stage-element\.js$/, s => s.replace('var(--sg-lens-plate,60%)', 'var(--sg-lens-plate,0%)')],
  bareTint: [/stage-element\.js$/, s => s.replace('sg-veranda-stage[data-register=warm]{--sg-glass-tint:46%}', 'sg-veranda-stage{--sg-glass-tint:46%}')],
  tint20: [/stage-element.js$/, s => s.replace(/--sg-glass-tint:(46|40|50|52)%/g, '--sg-glass-tint:20%')],
};

async function open({ query = 'register=warm', theme = 'light', reduced = false, noGL = false, blockThree = false, holdThree = 0, width = 1280, height = 900, patches = [], always = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', colorScheme: theme, deviceScaleFactor: 1 });
  const requests = [], errors = [];
  context.on('request', r => requests.push(r.url()));
  if (noGL) await context.addInitScript("const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); };");
  if (blockThree) await context.route(THREE, r => r.abort());
  if (holdThree) await context.route(THREE, async r => { await new Promise(res => setTimeout(res, holdThree)); r.continue().catch(() => {}); });
  for (const key of BREAK || always ? patches : []) {
    const [re, fn] = BREAKS[key];
    await context.route(u => re.test(u.pathname), async r => { const res = await r.fetch(); r.fulfill({ response: res, body: fn(await res.text()) }); });
  }
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${server.url}/packages/scenes/veranda/words.html?${query}&theme=${theme}`);
  await page.addScriptTag({ content: PROBE });
  return { context, page, requests, errors, three: () => requests.filter(u => THREE.test(u)) };
}
const ready = async (p, ms = 60000) => { await p.page.waitForFunction(() => window.__ready === true, null, { timeout: ms }); await p.page.waitForTimeout(700); };

/** In the page: world.js's own G-buffer as the depth truth, and the lines' covered share against it. */
const PROBE = `
window.__probe = async () => {
  if (window.__P) return window.__P;
  const w = await import('/packages/scenes/veranda/world.js');
  const G = w.gbuffer(), bytes = w.depthMap(G), s = window.__stage, dp = s.depthPhoto;
  const map = d => { const a = dp.place(0, 0, d), b = dp.place(1, 1, d); return (x, y) => [(x - a[0]) / (b[0] - a[0]), (y - a[1]) / (b[1] - a[1])]; };
  const at = (d, x, y) => { const [u, v] = map(d)(x, y); return bytes[Math.min(G.h - 1, Math.max(0, Math.floor(v * G.h))) * G.w + Math.min(G.w - 1, Math.max(0, Math.floor(u * G.w)))]; };
  const lines = () => { const st = s.querySelector('.stage').getBoundingClientRect(), out = []; for (const el of s.pane.children) { if (el.matches('.grip,.lens-view,.lens-btn')) continue; const r = document.createRange(); r.selectNodeContents(el); for (const q of r.getClientRects()) if (q.width > 1) out.push({ x: q.left - st.left, y: q.top - st.top, w: q.width, h: q.height }); } return out; };
  const share = d => { let n = 0, hid = 0; for (const l of lines()) for (let y = l.y + 2; y < l.y + l.h; y += 4) for (let x = l.x + 2; x < l.x + l.w; x += 4) { n++; if (at(d, x, y) > Math.round(d * 255) + 2) hid++; } return n ? hid / n : 0; };
  return (window.__P = { at, lines, share });
};`;

// 1. real text
{
  const NEED = /heading "Come and sit"[\s\S]*The lamp is on at six/;
  const seen = [];
  for (const [tier, opts] of [['live', {}], ['2D', { noGL: true }], ['quiet', { query: 'register=quiet' }]]) {
    const p = await open({ ...opts, patches: ['canvasText'] });
    await ready(p);
    for (const d of [0.15, 0.3, 0.6, 0.8]) {
      await p.page.evaluate(d => { window.__stage.paneDepth = d; }, d);
      await p.page.waitForTimeout(250);
      const snap = await p.page.locator('sg-veranda-stage').ariaSnapshot();
      seen.push({ tier, d, ok: NEED.test(snap.replace(/\n/g, ' ')) && (await p.page.evaluate(() => window.__stage.dataset.tier)) === (tier === 'live' ? 'live' : '2d') });
    }
    await p.context.close();
  }
  check('real text: the words are in the accessibility tree at four depths, live, in 2D and in quiet', seen.every(s => s.ok), seen.filter(s => !s.ok).map(s => `${s.tier} at ${s.d}`).join('; ') || `${seen.length} readings`);
}

// 2, 3. occlusion, and readable on release
async function dragBehindPillar(p, hold) {
  const g = await p.page.evaluate(() => { const r = window.__stage.querySelector('.grip').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await p.page.mouse.move(g[0], g[1]); await p.page.mouse.down();
  await p.page.mouse.move(g[0] + 300, g[1] + 20, { steps: 12 });
  if (!hold) { await p.page.mouse.up(); await p.page.waitForTimeout(1000); }
}
{
  const p = await open({ patches: ['flatMask'] });
  await ready(p);
  await dragBehindPillar(p, true);
  await p.page.waitForTimeout(500);
  const box = await p.page.evaluate(() => { const r = window.__stage.pane.getBoundingClientRect(), s = window.__stage.querySelector('.stage').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, sx: s.left, sy: s.top }; });
  const png = async () => (await p.page.screenshot()).toString('base64');
  const A = await png();
  await p.page.evaluate(() => { window.__stage.pane.style.visibility = 'hidden'; });
  await p.page.waitForTimeout(250);
  const B = await png();
  const r = await p.page.evaluate(async ([A, B, box]) => {
    const P = await window.__probe(), d = window.__stage.paneDepth;
    const load = async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = new OffscreenCanvas(i.width, i.height), g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
    const a = await load(A), b = await load(B);
    let hidden = 0, hiddenSame = 0, shown = 0, shownDiff = 0;
    for (let y = box.y + 6; y < box.y + box.h - 6; y += 3) for (let x = box.x + 6; x < box.x + box.w - 30; x += 3) {
      const i = (Math.round(y) * a.width + Math.round(x)) * 4, diff = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      const byte = P.at(d, x - box.sx, y - box.sy), nearer = byte > Math.round(d * 255) + 6, farther = byte < Math.round(d * 255) - 6;
      if (nearer) { hidden++; if (diff <= 30) hiddenSame++; } else if (farther) { shown++; if (diff > 30) shownDiff++; }
    }
    return { d, hidden, hiddenSame, shown, shownDiff };
  }, [A, B, box]);
  check('occlusion is honest: behind the pillar the pane is gone where the map is nearer, and is the pane where it is not', r.hidden > 150 && r.shown > 150 && r.hiddenSame / r.hidden > 0.93 && r.shownDiff / r.shown > 0.6, `pane at depth ${r.d.toFixed(2)}: ${r.hiddenSame} of ${r.hidden} nearer pixels unchanged by the pane, ${r.shownDiff} of ${r.shown} farther pixels changed`);
  await p.context.close();
}
{
  const p = await open({ patches: ['noSettle'] });
  await ready(p);
  await p.page.evaluate(() => window.__probe());
  await dragBehindPillar(p, true);
  const mid = await p.page.evaluate(async () => (await window.__probe()).share(window.__stage.paneDepth));
  await p.page.mouse.up(); await p.page.waitForTimeout(1000);
  const after = await p.page.evaluate(async () => { const P = await window.__probe(), s = window.__stage; return { share: P.share(s.paneDepth), d: s.paneDepth, settled: s.dataset.settled ?? null, said: [...s.querySelectorAll('[role=status]')].map(x => x.textContent).join(' | ') }; });
  check('readable on release: dropped behind the pillar, the pane settles to under 15% covered and says so', mid > 0.4 && after.share < 0.15 && !!after.settled && /brought forward/.test(after.said), `covered ${(mid * 100).toFixed(0)}% while dragging, ${(after.share * 100).toFixed(1)}% after, depth ${after.d.toFixed(2)}, "${after.said}"`);
  await p.context.close();
}

// 4. contrast
async function contrast(theme, d, register = 'warm', patches = [], always = false, extra = '') {
  const p = await open({ query: `register=${register}&pane-depth=${d}&words-at=0.45+0.4${extra}`, theme, patches, always });
  await ready(p);
  await p.page.waitForTimeout(600);
  const lines = await p.page.evaluate(() => {
    const rgba = css => { const x = new OffscreenCanvas(1, 1).getContext('2d'); x.fillStyle = css; x.fillRect(0, 0, 1, 1); const dd = x.getImageData(0, 0, 1, 1).data; return [dd[0], dd[1], dd[2], dd[3] / 255]; };
    const s = window.__stage, out = [];
    for (const el of s.pane.children) { if (el.matches('.grip,.lens-view,.lens-btn')) continue; const cs = getComputedStyle(el), r = document.createRange(); r.selectNodeContents(el); for (const q of r.getClientRects()) if (q.width > 1) out.push({ x: q.left, y: q.top, w: q.width, h: q.height, ink: rgba(cs.color) }); }
    const st = document.createElement('style'); st.textContent = 'sg-veranda-stage h2, sg-veranda-stage p { color: transparent !important; } sg-veranda-stage .grip { visibility: hidden }'; document.head.append(st);
    return { out, d: s.paneDepth };
  });
  let worst = 99, bad = 0, n = 0;
  for (let k = 0; k < 2; k++) {
    await p.page.waitForTimeout(300);
    for (const l of lines.out) {
      const png = await p.page.screenshot({ clip: { x: l.x, y: l.y, width: l.w, height: l.h } });
      const r = await p.page.evaluate(async ([b64, ink, l]) => {
        // pixels the depth map says something nearer hides (or is within 6 px of hiding: the mask's edge is a grid of 3 px cells) are not pane pixels: no text is drawn there, so none is read
        const P = await window.__probe(), st = window.__stage.querySelector('.stage').getBoundingClientRect(), dd0 = window.__stage.paneDepth, cut = Math.round(dd0 * 255) + 2;
        const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode();
        const cv = new OffscreenCanvas(i.width, i.height), g = cv.getContext('2d'); g.drawImage(i, 0, 0);
        const dd = g.getImageData(0, 0, i.width, i.height).data, lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, L = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
        const [tr, tg, tb, ta] = ink; let lo = 99, cnt = 0, bd = 0;
        for (let q = 0; q < dd.length; q += 4) { const px = (q / 4) % i.width, py = Math.floor(q / 4 / i.width); if ([-6, 0, 6].some(a => [-6, 0, 6].some(b => P.at(dd0, l.x + px - st.left + a, l.y + py - st.top + b) > cut))) continue; const lb = L(dd[q], dd[q + 1], dd[q + 2]), lt = L(tr * ta + dd[q] * (1 - ta), tg * ta + dd[q + 1] * (1 - ta), tb * ta + dd[q + 2] * (1 - ta)), ratio = (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05); cnt++; lo = Math.min(lo, ratio); if (ratio < 4.5) bd++; }
        return { lo, cnt, bd };
      }, [png.toString('base64'), l.ink, { x: l.x, y: l.y }]);
      worst = Math.min(worst, r.lo); bad += r.bd; n += r.cnt;
    }
  }
  await p.context.close();
  return { worst, bad, n, d: lines.d };
}
{
  const rows = [];
  for (const theme of ['light', 'dark']) for (const d of [0.3, 0.5, 0.75]) rows.push({ theme, d, ...(await contrast(theme, d)) });
  const low = rows.reduce((a, b) => (b.worst < a.worst ? b : a));
  check('contrast: 4.5:1 against every pixel under every line box, at three depths, light and dark', rows.every(r => r.bad === 0 && r.n > 1000), `worst ${low.worst.toFixed(2)}:1 (${low.theme}, depth ${low.d.toFixed(2)}); ${rows.reduce((a, r) => a + r.n, 0)} pixels read`);
  const weak = await contrast('light', 0.5, 'warm', ['tint20'], true);
  check('control: a 20% tint on the pane fails the same contrast test', weak.bad > 0, `${weak.bad} pixels under 4.5:1, worst ${weak.worst.toFixed(2)}:1`);
}

// 4a. the tint is the one that was found: what the glass really has, not what the stylesheet says. (A bare element selector loses to
//     tokens.css's [data-register=warm]{--sg-glass-tint:74%}, and for a round the warm pane was 74% while the notes said 56%.)
{
  const want = { 'warm light': 46, 'warm dark': 50, 'playful light': 40, 'playful dark': 52 }, got = {};
  for (const [key, w] of Object.entries(want)) {
    const [register, theme] = key.split(' ');
    const p = await open({ query: 'register=' + register, theme, patches: ['bareTint'] });
    await ready(p);
    got[key] = await p.page.evaluate(() => { const s = window.__stage, bg = getComputedStyle(s.pane).backgroundColor, a = /\/\s*([0-9.]+)%?\s*\)/.exec(bg), v = getComputedStyle(s).getPropertyValue('--sg-glass-tint').trim(); return { v, alpha: a ? (a[1].includes('.') && +a[1] <= 1 ? +a[1] * 100 : +a[1]) : null }; });
    await p.context.close();
  }
  check('the glass has the tint that was found for it, in each register and theme (the computed token and the pane\'s real background)', Object.entries(want).every(([k, w]) => parseInt(got[k].v) === w && got[k].alpha !== null && Math.abs(got[k].alpha - w) < 3), Object.entries(want).map(([k, w]) => k + ': ' + got[k].v + ' (background alpha ' + (got[k].alpha === null ? '?' : Math.round(got[k].alpha)) + '%, wanted ' + w + ')').join('; '));
}

// 4b. the lens: another veranda through the glass
{
  const rows = [];
  for (const [theme, lens] of [['light', 'monsoon'], ['dark', 'monsoon'], ['light', 'dusk'], ['dark', 'dusk']]) rows.push({ theme, lens, ...(await contrast(theme, 0.5, 'playful', [], false, '&lens=' + lens)) });
  const low = rows.reduce((a, b) => (b.worst < a.worst ? b : a));
  check('contrast in the lens: 4.5:1 against every pixel under each line, monsoon and dusk, light and dark', rows.every(r => r.bad === 0 && r.n > 1000), `worst ${low.worst.toFixed(2)}:1 (${low.theme}, ${low.lens}); ${rows.reduce((a, r) => a + r.n, 0)} pixels read`);
  const bare = await contrast('light', 0.5, 'playful', ['noPlates'], true, '&lens=monsoon');
  check('control: the lens without the paper plates under the words fails the same contrast test', bare.bad > 0, `${bare.bad} pixels under 4.5:1, worst ${bare.worst.toFixed(2)}:1`);
}
{
  // it really shows another veranda inside the pane's rect, in both tiers; and it is off in quiet, in warm and under reduced motion
  const read = async (opts, query) => {
    const p = await open({ ...opts, query });
    await ready(p); await p.page.waitForTimeout(900);
    const r = await p.page.evaluate(() => {
      const s = window.__stage, cv = s.querySelector('.lens-view'), mean = (src, sx, sy, sw, sh) => { const c = document.createElement('canvas'); c.width = 48; c.height = 32; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, sx, sy, sw, sh, 0, 0, 48, 32); const d = g.getImageData(0, 0, 48, 32).data, m = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; } return m.map(v => Math.round(v / 1536)); };
      // the lens against the day's still, cropped to the same rect on the picture: the same veranda in other weather, not a copy of it
      const look = s.assets.look, dp = s.depthPhoto, pr = s.pane.getBoundingClientRect(), st = s.querySelector('.stage').getBoundingClientRect(), a = dp.place(0, 0, 0.3), b = dp.place(1, 1, 0.3), kx = look.width / (b[0] - a[0]), ky = look.height / (b[1] - a[1]);
      const lens = cv.width > 2 ? mean(cv, 0, 0, cv.width, cv.height) : null, day = mean(look, (pr.left - st.left - a[0]) * kx, (pr.top - st.top - a[1]) * ky, pr.width * kx, pr.height * ky);
      return { on: s.pane.classList.contains('lens'), btn: getComputedStyle(s.querySelector('.lens-btn')).display, mean: lens, day, visible: getComputedStyle(cv).display, tier: s.dataset.tier };
    });
    await p.context.close();
    return r;
  };
  const greener = r => r.mean && r.mean[1] - r.mean[0] > r.day[1] - r.day[0] + 6 && Math.abs(r.mean[0] - r.day[0]) + Math.abs(r.mean[1] - r.day[1]) + Math.abs(r.mean[2] - r.day[2]) > 20;
  const live = await read({}, 'register=playful&lens=monsoon'), flat = await read({ noGL: true }, 'register=playful&lens=monsoon');
  const quiet = await read({}, 'register=quiet&lens=monsoon'), calm = await read({ reduced: true }, 'register=playful&lens=monsoon'), warm = await read({}, 'register=warm&lens=monsoon');
  check('the lens shows the other veranda inside the pane, on the live tier and on the 2D tier', live.on && flat.on && live.tier === 'live' && flat.tier === '2d' && live.visible === 'block' && greener(live) && greener(flat), `live ${JSON.stringify(live.mean)}, 2D ${JSON.stringify(flat.mean)} against the day's ${JSON.stringify(live.day)} (the monsoon is darker and less red)`);
  check('no lens in quiet, in warm, or under reduced motion; the button is not offered there either', !quiet.on && !warm.on && !calm.on && quiet.btn === 'none' && warm.btn === 'none' && calm.btn === 'none', `quiet ${quiet.on}/${quiet.btn}, warm ${warm.on}/${warm.btn}, reduced ${calm.on}/${calm.btn}`);
}

// 5. the still first
async function seen(p) {
  const png = (await p.page.locator('sg-veranda-stage .stage').screenshot()).toString('base64');
  return p.page.evaluate(async png => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0, blank = 0;
    for (let i = 0; i < d.length; i += 4) { n++; if (d[i] > 225 && d[i + 1] > 222 && d[i + 2] > 212) blank++; }
    const s = window.__stage, st = s.querySelector('.stage').getBoundingClientRect(), pr = s.pane.getBoundingClientRect();
    const top = document.elementFromPoint(pr.left + pr.width / 2, pr.top + pr.height / 2);
    return { blank: blank / n, words: !!top && s.pane.contains(top) && pr.width > 100 && pr.left >= st.left - 1 && pr.right <= st.right + 1, tier: s.dataset.tier };
  }, png);
}
{
  const cases = [['WebGL disabled', { noGL: true }, false], ['three blocked', { blockThree: true }, false], ['reduced motion', { reduced: true }, true], ['quiet', { query: 'register=quiet' }, true]];
  for (const [label, opts, never] of cases) {
    const p = await open(opts);
    await ready(p);
    const s = await seen(p);
    check(`the still first: ${label} shows the finished veranda with the words on it${never ? ', and never requests three' : ''}`, s.blank < 0.25 && s.words && s.tier === '2d' && (!never || p.three().length === 0), `${s.tier}, ${(s.blank * 100).toFixed(0)}% paper, words on top ${s.words}, ${p.three().length} three requests`);
    await p.context.close();
  }
  const p = await open({ holdThree: 6000, patches: ['awaitThree'] });
  await p.page.waitForTimeout(4500);
  const s = await p.page.evaluate(() => ({ still: !!window.__stage?.querySelector('sg-depth-photo img') }));
  const shot = s.still ? await seen(p) : { blank: 1, words: false };
  check('the still is on screen while three is still loading', s.still && shot.blank < 0.25, s.still ? `${(shot.blank * 100).toFixed(0)}% paper with three held back` : 'no picture yet: the page is waiting for three');
  await p.context.close();
}

// 6. keyboard parity with depth
{
  const p = await open({ patches: ['noDepthKeys'] });
  await ready(p);
  const r = await p.page.evaluate(async () => {
    const s = window.__stage, grip = s.querySelector('.grip'), said = () => [...s.querySelectorAll('[role=status]')].map(x => x.textContent).filter(Boolean).at(-1) ?? '';
    grip.focus();
    const press = (key, shift = false) => grip.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true }));
    const wheel = dy => grip.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true }));
    const out = {};
    for (let i = 0; i < 30; i++) press('PageDown'); out.back = s.paneDepth; out.backSaid = said();
    for (let i = 0; i < 40; i++) press('PageUp'); out.front = s.paneDepth; out.frontSaid = said();
    press('PageDown', true); out.big = out.front - s.paneDepth;
    s.paneDepth = 0.3;
    for (let i = 0; i < 40; i++) wheel(-100); out.wheelFront = s.paneDepth;
    for (let i = 0; i < 40; i++) wheel(100); out.wheelBack = s.paneDepth;
    press('PageUp'); press('Home'); out.home = s.paneDepth;
    return out;
  });
  check('keyboard parity: PageDown and PageUp reach the wheel\'s furthest depths, Shift steps bigger, each press is said, Home goes home', Math.abs(r.back - 0.1) < 0.005 && Math.abs(r.front - 0.85) < 0.005 && Math.abs(r.wheelFront - 0.85) < 0.005 && Math.abs(r.wheelBack - 0.1) < 0.005 && r.big > 0.05 && r.home >= 0.295 && r.home <= 0.4 && /as far back as they go/.test(r.backSaid) && /far forward/.test(r.frontSaid),
    `keys reached ${r.back.toFixed(2)} and ${r.front.toFixed(2)}, the wheel ${r.wheelBack.toFixed(2)} and ${r.wheelFront.toFixed(2)}, Shift ${r.big.toFixed(2)}, Home ${r.home.toFixed(2)}, last said "${r.frontSaid}"`);
  await p.context.close();
}

// 7. phone width
{
  const p = await open({ width: 390, height: 844 });
  await ready(p);
  const r = await p.page.evaluate(() => { const s = window.__stage, st = s.querySelector('.stage').getBoundingClientRect(), pr = s.pane.getBoundingClientRect(); return { sw: document.scrollingElement.scrollWidth, iw: innerWidth, stacked: s.querySelector('.frame').classList.contains('stacked'), grip: !!s.querySelector('.grip:not([hidden])'), below: pr.top >= st.bottom - 1, mask: getComputedStyle(s.pane).maskImage }; });
  check('at 390 px the words are flat below the picture: no grip, no mask, no horizontal scroll', r.sw <= r.iw && r.stacked && !r.grip && r.below && (r.mask === 'none' || r.mask === ''), JSON.stringify(r));
  await p.context.close();
}

// 8. the turn (opt-in `pane-turn`): the words lean a little toward the camera and settle back, the readability rule is judged in
//    the plane's own space, and the words stay real text. Off unless a page asks.
{
  const SETTLE_MS = 3400; // three and a third of warm's 0.9 s tau, plus the transition's own tail
  const STILL = /^(none|matrix\(1, 0, 0, 1, 0, 0\)|matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1\))$/;
  const tilt = (page = p.page) => page.evaluate(() => {
    const el = document.querySelector('sg-veranda-stage .turn');
    const m = el && (getComputedStyle(el).transform.match(/matrix3d\(([^)]+)\)/) || [])[1], n = m ? m.split(',').map(Number) : null;
    return { transform: el ? getComputedStyle(el).transform : 'none', tiltDeg: n ? Math.acos(Math.min(1, Math.abs(n[10]))) * 180 / Math.PI : 0 };
  });
  const flatRects = page => page.evaluate(() => window.__stage.surfaces().pane); // #lineRects: unprojected while the words lean
  const rawRects = page => page.evaluate(() => {
    const s = window.__stage, st = s.querySelector('.stage').getBoundingClientRect(), out = [];
    for (const el of s.pane.querySelector('.turn').children) {
      if (el.matches('.grip,.lens-view,.lens-btn')) continue;
      const r = document.createRange(); r.selectNodeContents(el);
      for (const q of r.getClientRects()) if (q.width > 1) out.push({ x: q.left - st.left, y: q.top - st.top, w: q.width, h: q.height });
    }
    return out;
  });
  const widest = (a, b) => Math.max(...a.map((r, i) => Math.max(Math.abs(r.x - b[i].x), Math.abs(r.y - b[i].y), Math.abs(r.w - b[i].w), Math.abs(r.h - b[i].h))));
  const dolly = (page, d) => page.evaluate(v => window.__stage.depthPhoto.set({ dolly: v }), d);
  const on = page => page.evaluate(() => window.__stage.setAttribute('pane-turn', ''));

  const p = await open({ query: 'register=warm' });
  await ready(p);
  const absent = await p.page.evaluate(() => !!window.__stage.pane.querySelector('.turn'));
  check('the turn is off unless a page asks: no layer is made and nothing is turned', !absent, `turn layer ${absent}`);
  await on(p.page); await p.page.waitForTimeout(300);
  const a0 = await tilt();
  check('pane-turn at rest: the layer is mounted, and only the register\'s idle sway leans the words', await p.page.evaluate(() => !!window.__stage.pane.querySelector('.turn')) && a0.tiltDeg <= TURN.warm, `tilt ${a0.tiltDeg.toFixed(2)} deg, inside the ${TURN.warm}-deg cone`);
  // the camera drives it: the pan becomes a gentle pointer, the words lean, the cone holds and they come to rest
  await dolly(p.page, 0.9);
  let most = 0;
  for (let i = 0; i < 30; i++) { await p.page.waitForTimeout(120); most = Math.max(most, (await tilt()).tiltDeg); }
  const a = await tilt(); await p.page.waitForTimeout(300); const b = await tilt();
  check('the camera turns the words: a little, inside warm\'s 6 degrees, and they settle', most > 0.3 && most <= TURN.warm + 0.2 && Math.abs(b.tiltDeg - a.tiltDeg) <= 0.2, `most ${most.toFixed(2)} deg of ${TURN.warm}, ${Math.abs(b.tiltDeg - a.tiltDeg) <= 0.2 ? 'settled' : 'still moving'}`);
  const text = await p.page.evaluate(() => {
    const el = window.__stage.pane.querySelector('.turn h2');
    const range = document.createRange(); range.selectNodeContents(el);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const picked = sel.toString().trim(); sel.removeAllRanges();
    return { real: !!el && el.childElementCount === 0 && el.textContent.trim().length > 0, picked };
  });
  check('the words stay real text under the turn: a selection over the turned layer yields them', text.real && /Come and sit/.test(text.picked), `selection "${text.picked}"`);
  // unproject: the rects the settle judges are the plane's own, though the turn moved them on screen
  const thr = await flatRects(p.page), raw = await rawRects(p.page);
  await p.page.evaluate(() => window.__stage.removeAttribute('pane-turn')); await p.page.waitForTimeout(300);
  const flat = await flatRects(p.page);
  const turned = raw.length && raw.length === flat.length ? widest(raw, flat) : 0, off = thr.length === flat.length ? widest(thr, flat) : 99;
  check('occlusion is judged in the plane\'s own space: unproject() hands the flat rects back within 1 px, though the turn moved them on screen', raw.length > 0 && off <= 1 && turned > 1, `the turn moved the lines ${turned.toFixed(2)} px on screen, unprojected within ${off.toFixed(3)} px`);
  // the camera rests and the look is gone: back to flat, and nothing jitters
  await on(p.page); await p.page.waitForTimeout(200);
  await dolly(p.page, 0.9); await p.page.waitForTimeout(SETTLE_MS);
  await dolly(p.page, 0); await p.page.waitForTimeout(SETTLE_MS);
  const c = await tilt(); await p.page.waitForTimeout(400); const d = await tilt();
  check('the camera comes to rest and the words come back to flat, without jitter', c.tiltDeg < 1.5 && Math.abs(d.tiltDeg - c.tiltDeg) <= 0.2, `tilt ${c.tiltDeg.toFixed(2)} deg at rest, ${Math.abs(d.tiltDeg - c.tiltDeg) <= 0.2 ? 'settled' : 'still moving'}`);
  await p.context.close();
  // quiet and reduced motion stay perfectly still even with the attribute on and the camera moving
  for (const [label, opts] of [['quiet', { query: 'register=quiet' }], ['reduced motion', { reduced: true }]]) {
    const q = await open(opts);
    await ready(q);
    await on(q.page);
    await dolly(q.page, 0.9);
    await q.page.waitForTimeout(1400);
    const t = await tilt(q.page);
    check(`${label} with pane-turn stays perfectly still`, STILL.test(t.transform), `transform ${t.transform || 'none'}`);
    await q.context.close();
  }
}

await browser.close(); await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} pass${BREAK ? ' (--break: the patched builds should FAIL their checks)' : ''}`);
process.exit(BREAK ? 0 : failed ? 1 : 0);
