// Browser checks for the veranda scene that a Node test cannot reach.
//
//   node packages/scenes/veranda/veranda.check.mjs            (or: npm run check)
//   node packages/scenes/veranda/veranda.check.mjs --break    (against patched builds: every check must FAIL)
//
// Everything is read from the pixels of the scene's own canvas, in the scene's logical units.
//
//  1. ready and clean: sg-ready in every register, light and dark, no console errors;
//  2. the lamp: it swings in warm and playful, and is at rest in quiet and under reduced motion;
//  3. quiet is a hairline drawing on paper, warm is washed: the share of paper-coloured pixels;
//  4. the dark theme is dusk: darker overall, and the lit lamp lights the roof above it;
//  5. the sun: the pillars' shadows on the floor change when the sun's param changes;
//  6. playful's hand moves the sun (the floor changes with the pointer, and Enter puts it back),
//     warm's does not (the floor stays put under the pointer);
//  7. the arrow keys do what the hand does;
//  8. phone width: no horizontal scroll, and the drawing still fits.
//
// --break patches the served scene once per check family: the lamp never swings, quiet washes,
// the dark theme stays day, the shadows are never traced, and the hand is ignored.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';
import { projectM, W, H, gbuffer, SOLIDS } from './world.js';

const BREAK = process.argv.includes('--break');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const pct = v => `${(v * 100).toFixed(1)}%`;

const server = await startServer({ quiet: true });
const browser = await chromium.launch();

/** Boxes in the scene's logical units. The lamp hangs at about (u, v) of its top, 0.35 of the picture tall. */
const [lu, lv] = projectM(0.25, 2.88, 4.4);
const LAMP = { x: lu * W - 90, y: lv * H - 5, w: 180, h: 220 };
const FLOOR = { x: 380, y: 600, w: 500, h: 190 };
const ROOF = { x: lu * W - 130, y: 10, w: 100, h: 70 };   // the ceiling beside the lamp
const FAR_ROOF = { x: 850, y: 10, w: 100, h: 70 };         // the ceiling far from it, at the top right

/** Patches by file, applied to the served sources when --break asks for one. */
const BREAKS = {
  lamp: [/model\.js$/, s => s.replace(/warm: \{ swing: [0-9.]+/, 'warm: { swing: 0').replace(/playful: \{ swing: [0-9.]+/, 'playful: { swing: 0')],
  hair: [/render\.js$/, s => s.replace("const mode = reg === 'quiet' ? 'hair' : 'ink'", "const mode = 'ink'").replace("isStill = frame.still || reg === 'quiet'", 'isStill = frame.still')],
  dusk: [/render\.js$/, s => s.replace("d.mood === 'auto' || !d.mood ? (isDark() ? 'dusk' : 'day') : d.mood", "'day'")],
  rim: [/paint[.]js$/, s => s.replace('tone > 1 && !rim ? 2', 'tone > 1 ? 2')],
  sun: [/paint\.js$/, s => s.replace("if (!gb || mode === 'hair' || mood === 'dusk') return null;", 'return null;')],
  warmhand: [/model\.js$/, s => s.replace(/warm: \{ swing: ([0-9.]+), motes: ([0-9]+), hand: false/, 'warm: { swing: $1, motes: $2, hand: true')],
  hand: [/model\.js$/, s => s.replace(/playful: \{ swing: ([0-9.]+), motes: ([0-9]+), hand: true/, 'playful: { swing: $1, motes: $2, hand: false')],
};

async function open({ register = 'warm', theme = 'light', reduced = false, width = 1280, height = 900, content = false, seed, params = {}, patches = [] } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', colorScheme: theme === 'dark' ? 'dark' : 'light', deviceScaleFactor: 1 });
  for (const key of BREAK ? patches : []) {
    const [re, fn] = BREAKS[key];
    await context.route(u => re.test(u.pathname) && u.pathname.includes('/scenes/veranda/'), async r => { const res = await r.fetch(); r.fulfill({ response: res, body: fn(await res.text()) }); });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const q = new URLSearchParams({ name: 'veranda', register, theme, ...(seed ? { seed } : {}), ...(content ? { content: '1' } : {}), ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  await page.goto(`${server.url}/tools/harness/scene.html?${q}`);
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const api = {
    page, context, errors,
    wait: ms => page.waitForTimeout(ms),
    snap: name => page.evaluate(n => { const cv = window.__piece.shadowRoot.querySelector('canvas'); (window.__snaps ??= {})[n] = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height); }, name),
    changed: (a, b, box) => page.evaluate(([a, b, box]) => {
      const A = window.__snaps[a], B = window.__snaps[b], k = A.width / 1200;
      const x0 = Math.round(box.x * k), y0 = Math.round(box.y * k), x1 = Math.min(A.width, Math.round((box.x + box.w) * k)), y1 = Math.min(A.height, Math.round((box.y + box.h) * k));
      let n = 0, c = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * A.width + x) * 4; n++; if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 30) c++; }
      return n ? c / n : 0;
    }, [a, b, box]),
    /** Mean luminance (0..1) of a box, and the share of pixels within 14 of the paper colour of the page's canvas corner. */
    stats: box => page.evaluate(box => {
      const cv = window.__piece.shadowRoot.querySelector('canvas'), g = cv.getContext('2d'), k = cv.width / 1200;
      const d = g.getImageData(Math.round(box.x * k), Math.round(box.y * k), Math.round(box.w * k), Math.round(box.h * k)).data;
      let lum = 0, paper = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { n++; lum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; if (Math.abs(d[i] - 241) < 16 && Math.abs(d[i + 1] - 237) < 16 && Math.abs(d[i + 2] - 228) < 16) paper++; }
      return { lum: lum / n, paper: paper / n };
    }, box),
    stageBox: () => page.evaluate(() => { const r = window.__piece.shadowRoot.querySelector('.stage').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }),
  };
  return api;
}
const ALL = { x: 0, y: 0, w: W, h: H };

// 1. ready and clean, every register and theme
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const p = await open({ register, theme });
  const s = await p.stats(ALL);
  check(`${register} ${theme}: ready, painted, no console errors`, p.errors.length === 0 && s.lum > 0.02, `mean luminance ${s.lum.toFixed(2)}${p.errors.length ? ', ' + p.errors[0] : ''}`);
  await p.context.close();
}

// 2. the lamp
{
  const swing = async (register, reduced = false, patches = []) => {
    const p = await open({ register, reduced, patches });
    await p.wait(300); await p.snap('a'); await p.wait(2300); await p.snap('b');
    const c = await p.changed('a', 'b', LAMP), playing = await p.page.evaluate(() => window.__piece.playing);
    await p.context.close();
    return { c, playing };
  };
  const warm = await swing('warm', false, ['lamp']), playful = await swing('playful', false, ['lamp']), quiet = await swing('quiet'), red = await swing('warm', true);
  check('the lamp swings in warm', warm.c > 0.004, `${pct(warm.c)} of the lamp's box changed in 2.3 s`);
  check('the lamp swings in playful', playful.c > 0.004, `${pct(playful.c)}`);
  check('the lamp is at rest in quiet, and the scene stops drawing', quiet.c === 0 && quiet.playing === false, `${pct(quiet.c)}, playing ${quiet.playing}`);
  check('under reduced motion the lamp is at rest', red.c === 0, `${pct(red.c)}`);
}

// 3. hairline against wash
{
  const paperShare = async (register, patches = []) => { const p = await open({ register, patches: BREAK ? patches : [] }); const s = await p.stats(ALL); await p.context.close(); return s.paper; };
  const q = await paperShare('quiet', ['hair']), w = await paperShare('warm');
  check('quiet is a hairline drawing on paper; warm is washed', q > 0.85 && w < 0.25, `paper-coloured: quiet ${pct(q)}, warm ${pct(w)}`);
}

// 4. dusk
{
  const load = async (theme, patches = []) => { const p = await open({ register: 'warm', theme, patches }); const all = await p.stats(ALL), roof = await p.stats(ROOF), far = await p.stats(FAR_ROOF); await p.context.close(); return { all: all.lum, roof: roof.lum, far: far.lum }; };
  const day = await load('light'), dusk = await load('dark', ['dusk']);
  check('the dark theme is dusk: darker overall, and the lit lamp lights the ceiling beside it', dusk.all < day.all * 0.75 && dusk.roof > dusk.far * 1.5, `mean luminance day ${day.all.toFixed(2)}, dusk ${dusk.all.toFixed(2)}; ceiling beside the lamp ${dusk.roof.toFixed(2)} against the far ceiling ${dusk.far.toFixed(2)}`);
}

// 5. the sun's param moves the shadows
{
  const p = await open({ register: 'warm', patches: ['sun'] });
  await p.snap('a'); await p.page.evaluate(() => window.__piece.set({ sun: 0.95 })); await p.wait(500); await p.snap('b');
  const c = await p.changed('a', 'b', FLOOR);
  check('the pillars\' shadows on the floor change with the sun', c > 0.02, `${pct(c)} of the floor changed`);
  await p.context.close();
}

// 6 and 7. the hand and the keys
{
  const move = async (register, patches = []) => {
    const p = await open({ register, patches });
    const box = await p.stageBox(), at = u => [box.x + box.w * u, box.y + box.h * 0.5];
    await p.page.mouse.move(...at(0.55)); await p.page.mouse.move(...at(0.3), { steps: 4 }); await p.wait(700); await p.snap('a');
    await p.page.mouse.move(...at(0.95), { steps: 8 }); await p.wait(900); await p.snap('b');
    const c = await p.changed('a', 'b', FLOOR);
    await p.context.close();
    return c;
  };
  const playful = await move('playful', ['hand']), warm = await move('warm', ['warmhand']);
  check('playful: the hand moves the sun and the shadows sweep the floor', playful > 0.02, `${pct(playful)} of the floor changed between the hand at 30% and at 95%`);
  check('warm: the pointer moves nothing', warm < 0.004, `${pct(warm)}`);

  const p = await open({ register: 'playful', patches: ['hand'] });
  await p.page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage').focus());
  await p.wait(300); await p.snap('a');
  for (let i = 0; i < 6; i++) await p.page.keyboard.press('ArrowRight');
  await p.wait(900); await p.snap('b');
  const keys = await p.changed('a', 'b', FLOOR);
  await p.page.keyboard.press('Enter'); await p.wait(900); await p.snap('c');
  const back = await p.changed('a', 'c', FLOOR);
  check('the arrow keys move the sun, and Enter puts it back', keys > 0.02 && back < 0.01, `${pct(keys)} changed by the keys, ${pct(back)} left after Enter`);
  await p.context.close();
}

// 7b. the crowns' edges: no pale dotted contour against the sky
{
  // rows where a crown (banana, mango) ends on the sky, from the G-buffer; the drawing's pixels just inside its edge must not be paler than the crown's own leaves
  const G = gbuffer(), name = k => SOLIDS[G.id[k]]?.id ?? 'sky', rows = [];
  for (let y = 60; y < 300; y += 3) for (let x = 400; x < G.w - 2; x++) { const k = y * G.w + x; if (/^(banana|mcrown|mlobe)/.test(name(k)) && name(k + 1) === 'sky' && name(k - 3).startsWith(name(k).slice(0, 4))) { rows.push([x * 2, y * 2]); break; } }
  const p = await open({ register: 'warm', patches: ['rim'] });
  const r = await p.page.evaluate(rows => {
    const cv = window.__piece.shadowRoot.querySelector('canvas'), g = cv.getContext('2d', { willReadFrequently: true }), k = cv.width / 1200;
    const lum = d => 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
    let pale = 0, worst = 0;
    for (const [x, y] of rows) {
      const edge = Math.max(...[-8, -7, -6, -5, -4].map(o => lum(g.getImageData(Math.round((x + o) * k), Math.round(y * k), 1, 1).data))), inner = lum(g.getImageData(Math.round((x - 16) * k), Math.round(y * k), 1, 1).data);
      if (edge - inner > 28) pale++; worst = Math.max(worst, edge - inner);
    }
    return { n: rows.length, pale, worst: Math.round(worst) };
  }, rows);
  check('the crowns have no pale dotted rim against the sky', r.n >= 8 && r.pale / r.n < 0.2 && r.worst < 40, `${r.pale} of ${r.n} edge rows paler than the leaves inside by more than 28, worst ${r.worst}`);
  await p.context.close();
}

// 8. phone width
{
  const p = await open({ register: 'warm', width: 390, height: 844 });
  const r = await p.page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: innerWidth, w: window.__piece.getBoundingClientRect().width }));
  check('at 390 px there is no horizontal scroll and the drawing fits', r.sw <= r.iw && r.w <= r.iw, `scroll width ${r.sw}, window ${r.iw}, drawing ${r.w.toFixed(0)}`);
  await p.context.close();
}

await browser.close(); await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} pass${BREAK ? ' (--break: the patched builds should FAIL their checks)' : ''}`);
process.exit(BREAK ? 0 : failed ? 1 : 0);
