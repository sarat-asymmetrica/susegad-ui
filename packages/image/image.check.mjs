// Browser checks for the image tier, on its demo page: text laid by the type tier beside floated pictures whose
// bytes are late, and the plain-CSS reading everywhere else.
//
//   node packages/image/image.check.mjs            (or: npm run check)
//   node packages/image/image.check.mjs --break    (a broken oracle: the checks that depend on it must FAIL)
//
// The pictures' bytes are delayed by a route (1.2 s). A request that carries a Range header is the oracle reading the
// header: the route answers it at once with the first 64 KB, as a server that honours ranges would. So the words are
// laid against reserved boxes while the pictures are still on their way, and the check compares every line and
// every box before and after they arrive (and the browser's own layout-shift entries). Quiet, reduced motion and no
// JavaScript must never ask for the oracle, the type tier or Pretext: the request log says so.
// --break: the oracle's header reads are refused, so the size only arrives with the bytes; the first layout has to
// guess, and the words move when the pictures land.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { session } from '../../tools/lib/browser.mjs';
import { contextOptions } from '../../tools/lib/engine.mjs';

const BREAK = process.argv.includes('--break');
const DELAY = 1200;
const GAP = 12; // the demo's gap round each picture, px
const PAGE = '/packages/image/demo.html';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const fixture = n => readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url)));

const INIT = `(() => {
  window.__shifts = []; window.__flows = []; window.__loads = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__shifts.push({ t: e.startTime, v: e.value, input: e.hadRecentInput, nodes: (e.sources || []).map(s => (s.node ? s.node.nodeName + (s.node.id ? '#' + s.node.id : '') : '?')).join(' ') }); }).observe({ type: 'layout-shift', buffered: true }); } catch {}
  document.addEventListener('sg-flow', e => window.__flows.push({ t: performance.now(), lines: e.detail.lines }), true);
  document.addEventListener('load', e => { if (e.target.tagName === 'IMG') window.__loads.push({ src: e.target.getAttribute('src'), t: performance.now() }); }, true);
})();`;

const s = await session();
const SHIFTS = s.engine === 'chromium'; // layout-shift entries are a Chromium API; other engines check geometry only

/** A context whose pictures arrive late: header reads (Range) at once, whole files after DELAY ms. */
async function open({ width = 1280, height = 900, dpr = 1, touch = false, reduced = false, noJs = false, query = '', refuseRanges = false } = {}) {
  const ctx = await s.browser.newContext(contextOptions(s.engine, { viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? 'reduce' : 'no-preference', javaScriptEnabled: !noJs }));
  await ctx.addInitScript(INIT);
  const requests = [], log = { errors: [] };
  ctx.on('request', r => requests.push({ path: new URL(r.url()).pathname, range: r.headers().range ?? null, type: r.resourceType() }));
  await ctx.route(/\/fixtures\/(jetty|laterite)\.png$/, async route => {
    const range = route.request().headers().range;
    if (range) {
      if (refuseRanges) return route.abort();
      const file = fixture(route.request().url().includes('jetty') ? 'jetty.png' : 'laterite.png'), part = file.subarray(0, 65536);
      return route.fulfill({ status: 206, headers: { 'content-type': 'image/png', 'content-range': `bytes 0-${part.length - 1}/${file.length}`, 'accept-ranges': 'bytes' }, body: part });
    }
    await new Promise(r => setTimeout(r, DELAY));
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') log.errors.push(m.text()); });
  page.on('pageerror', e => log.errors.push(e.message));
  await page.goto(s.base + PAGE + query, { waitUntil: 'commit' });
  return { ctx, page, requests, log };
}

/** Every box on the page that matters, in document pixels. */
const snapshot = page => page.evaluate(() => {
  const R = e => { const r = e.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height].map(n => +n.toFixed(2)); };
  const root = document.getElementById('flow');
  return {
    lines: [...root.querySelectorAll('[data-line]')].map(e => ({ t: e.textContent, r: R(e), b: [...root.querySelectorAll('p')].indexOf(e.parentElement) })),
    figs: [...root.querySelectorAll('figure')].map(R), imgs: [...root.querySelectorAll('img')].map(R),
    root: R(root), note: R(document.getElementById('status')),
    loaded: [...root.querySelectorAll('img')].map(i => i.complete && i.naturalWidth > 0),
    scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
  };
});
const maxDelta = (a, b) => {
  let m = 0;
  const walk = (x, y) => { if (Array.isArray(x)) x.forEach((v, i) => walk(v, y?.[i])); else if (x && typeof x === 'object') Object.keys(x).forEach(k => walk(x[k], y?.[k])); else if (typeof x === 'number') m = Math.max(m, Math.abs(x - (y ?? Infinity))); else if (x !== y) m = Infinity; };
  walk(a.lines, b.lines); walk(a.figs, b.figs); walk(a.imgs, b.imgs); walk(a.root, b.root); walk(a.note, b.note);
  return a.lines.length === b.lines.length ? m : Infinity;
};
/** The space between the first paragraph's last line and the second's first, in px beyond the line height (the paragraph margin). */
const paraGap = ({ lines }) => { const a = lines.filter(l => l.b === 0).at(-1), b = lines.find(l => l.b === 1); return a && b ? b.r[1] - (a.r[1] + a.r[3]) : NaN; };
/** The smallest horizontal gap between a line and a picture it sits beside, and how many lines sit beside one. */
const clearance = ({ lines, figs }) => {
  let min = Infinity, beside = 0;
  for (const l of lines) for (const f of figs) {
    const [lx, ly, lw, lh] = l.r, [fx, fy, fw, fh] = f;
    if (ly < fy + fh + GAP - 0.5 && ly + lh > fy + 0.5) { // shares height with the picture and its margin
      beside++;
      min = Math.min(min, lx >= fx + fw ? lx - (fx + fw) : fx >= lx + lw ? fx - (lx + lw) : -Math.min(lx + lw - fx, fx + fw - lx));
    }
  }
  return { min, beside };
};
const sumShifts = (page, from = 0, to = Infinity) => page.evaluate(([a, b]) => window.__shifts.filter(e => !e.input && e.t >= a && e.t < b).reduce((n, e) => n + e.v, 0), [from, to]);
const listShifts = page => page.evaluate(() => window.__shifts.map(e => `${e.t.toFixed(0)}ms ${e.v.toFixed(4)} [${e.nodes}]`).join('; '));
const firstLoad = page => page.evaluate(() => Math.min(...window.__loads.map(l => l.t)));
const waitFlow = (page, n = 1) => page.waitForFunction(k => window.__flows.length >= k, n, { timeout: 15000 });
const waitLoaded = page => page.waitForFunction(() => [...document.querySelectorAll('#flow img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
const heavy = reqs => reqs.filter(r => /flow\.live\.js|\/image\/measure\.js|header\.core\.js|layout\.core\.js|\/type\/|pretext/.test(r.path)).map(r => r.path);

// ── quiet: plain CSS ───────────────────────────────────────────────────────
let sourceText = [];
{
  const { ctx, page, requests, log } = await open({ query: '?register=quiet' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await waitLoaded(page);
  const st = await snapshot(page);
  sourceText = await page.evaluate(() => [...document.querySelectorAll('#flow p')].map(p => p.textContent.replace(/\s+/g, ' ').trim()));
  const floats = await page.evaluate(() => [...document.querySelectorAll('#flow figure')].map(f => getComputedStyle(f).float));
  check('quiet: the words and pictures are plain CSS floats; the type tier is not in play', floats.join() === 'right,left' && st.lines.length === 0 && (await page.evaluate(() => document.getElementById('flow').dataset.flow)) === undefined, `floats ${floats}, ${st.lines.length} laid lines`);
  check('quiet: the oracle, the type tier and Pretext are never requested', heavy(requests).length === 0 && !requests.some(r => r.range), `requests: ${heavy(requests).join(' ') || 'none'}; range requests ${requests.filter(r => r.range).length}`);
  const shift = SHIFTS ? await sumShifts(page, (await firstLoad(page)) - 16) : 0;
  check('quiet: the pictures arrive into reserved boxes (aspect-ratio from width and height): layout shift from their arrival on is 0', shift === 0, SHIFTS ? `${shift.toFixed(4)} from the first load event on; all entries: ${await listShifts(page)}` : 'not measured on this engine');
  check('quiet: no console errors', log.errors.length === 0, log.errors.join(' | '));
  await ctx.close();
}

// ── reduced motion and no JavaScript: the same plain reading ───────────────
{
  const { ctx, page, requests, log } = await open({ reduced: true });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  const st = await snapshot(page);
  check('reduced motion: plain CSS, no oracle, no type tier, no Pretext, no header read', st.lines.length === 0 && heavy(requests).length === 0 && !requests.some(r => r.range), `requests: ${heavy(requests).join(' ') || 'none'}`);
  check('reduced motion: no console errors', log.errors.length === 0, log.errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, page } = await open({ noJs: true });
  await waitLoaded(page).catch(() => {});
  const r = await page.evaluate(() => ({ floats: [...document.querySelectorAll('#flow figure')].map(f => getComputedStyle(f).float).join(), alts: [...document.querySelectorAll('#flow img')].map(i => i.alt.length > 30 && i.complete && i.naturalWidth > 0).join(), words: document.querySelector('#flow p').textContent.length > 100 }));
  check('no JavaScript: the pictures float, load and keep their alt text; the words are there', r.floats === 'right,left' && r.alts === 'true,true' && r.words, JSON.stringify(r));
  await ctx.close();
}

// ── live: warm, desktop, pictures delayed ──────────────────────────────────
let before, after;
{
  const { ctx, page, requests, log } = await open({ refuseRanges: BREAK });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await waitFlow(page);
  before = await snapshot(page);
  check('live: the words are laid while neither picture has arrived', before.lines.length > 8 && before.loaded.every(x => !x), `${before.lines.length} lines laid; pictures loaded: ${before.loaded.join(',')}`);
  const c = clearance(before);
  check('live: every line keeps at least the 12 px gap from the pictures it sits beside', c.beside > 3 && c.min >= GAP - 0.5, `${c.beside} lines beside a picture, smallest gap ${c.min.toFixed(2)} px`);
  const door = await page.evaluate(async () => { const { imageOracle } = await import('/packages/image/measure.js'); return imageOracle.peek(document.getElementById('door').getAttribute('src')); });
  const rangeReqs = requests.filter(r => r.range && /laterite/.test(r.path)).length, jettyRange = requests.filter(r => r.range && /jetty/.test(r.path)).length;
  check('live: the doorway\'s size is read from its header, once (a Range request); the jetty\'s from its attributes, with no request at all', door?.w === 600 && door?.h === 800 && door?.source === 'bytes' && rangeReqs === 1 && jettyRange === 0, `door ${JSON.stringify(door)}, header reads: door ${rangeReqs}, jetty ${jettyRange}`);
  const [a, b] = before.figs;
  check('live: the paragraphs keep their margin between them', paraGap(before) >= 8, `${paraGap(before).toFixed(1)} px between the paragraphs`);
  check('live: each reserved box has its picture\'s proportions', Math.abs(a[3] - a[2] * 640 / 960) < 0.05 && Math.abs(b[3] - b[2] * 800 / 600) < 0.05, `jetty ${a[2]} x ${a[3]} (3:2), door ${b[2]} x ${b[3]} (3:4)`);
  await waitLoaded(page);
  await page.waitForTimeout(300);
  after = await snapshot(page);
  const delta = maxDelta(before, after);
  check('live: nothing moves when the pictures arrive: every line, box and the text below keep their position', delta === 0, `largest change ${delta} px across ${before.lines.length} lines, ${before.figs.length} boxes and the readout`);
  if (SHIFTS) {
    const from = (await firstLoad(page)) - 16, arrival = await sumShifts(page, from);
    check('live: layout shift from the first picture arriving on is 0 (and the words were laid once)', arrival === 0 && (await page.evaluate(() => window.__flows.length)) === 1, `${arrival.toFixed(4)} from ${from.toFixed(0)} ms on, ${await page.evaluate(() => window.__flows.length)} lay-out; all entries, the early ones being the harness's stylesheets and the words going in: ${await listShifts(page)}`);
  }
  const text = await page.evaluate(() => [...document.querySelectorAll('#flow p')].map(p => p.textContent.replace(/\s+/g, ' ').trim()));
  check('live: the words are still the paragraph\'s own text, in order', JSON.stringify(text) === JSON.stringify(sourceText), `${text.map(t => t.length).join('+')} characters`);
  check('live: no console errors', log.errors.length === 0, log.errors.join(' | '));
  // relayout: a narrower window, then text at 200%
  const n0 = await page.evaluate(() => window.__flows.length);
  await page.setViewportSize({ width: 700, height: 900 });
  await waitFlow(page, n0 + 1);
  const mid = await snapshot(page), cm = clearance(mid);
  check('live: at 700 px the lines are laid again and keep clear, the paragraphs still apart', mid.lines.length > 8 && cm.min >= GAP - 0.5 && mid.scrollW <= mid.innerW && paraGap(mid) >= 8, `${mid.lines.length} lines, paragraph gap ${paraGap(mid).toFixed(1)} px, smallest gap ${cm.min.toFixed(2)} px, scroll width ${mid.scrollW} of ${mid.innerW}`);
  const n1 = await page.evaluate(() => window.__flows.length);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await waitFlow(page, n1 + 1);
  await page.waitForTimeout(200);
  const big = await snapshot(page), cb = clearance(big);
  check('live: with text at 200% the lines are laid again at the larger size and keep clear', big.lines.length > 8 && paraGap(big) >= 8 && big.lines[0].r[3] > before.lines[0].r[3] * 1.8 && cb.min >= GAP - 0.5 && big.scrollW <= big.innerW, `paragraph gap ${paraGap(big).toFixed(1)} px, line height ${big.lines[0].r[3]} px (was ${before.lines[0].r[3]}), smallest gap ${cb.min.toFixed(2)} px, scroll width ${big.scrollW} of ${big.innerW}`);
  await ctx.close();
}

// ── live: phone width ──────────────────────────────────────────────────────
{
  const { ctx, page, log } = await open({ width: 390, height: 844, dpr: 3, touch: true, refuseRanges: BREAK });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await waitFlow(page);
  const st = await snapshot(page), c = clearance(st);
  await waitLoaded(page);
  await page.waitForTimeout(200);
  const st2 = await snapshot(page);
  check('phone 390 px: words beside both pictures, 12 px gaps kept, no sideways scroll', st.lines.length > 8 && c.beside > 3 && c.min >= GAP - 0.5 && st.scrollW <= st.innerW, `${st.lines.length} lines, ${c.beside} beside a picture, smallest gap ${c.min.toFixed(2)} px, scroll width ${st.scrollW} of ${st.innerW}`);
  check('phone 390 px: nothing moves when the pictures arrive', maxDelta(st, st2) === 0, `largest change ${maxDelta(st, st2)} px`);
  check('phone 390 px: no console errors', log.errors.length === 0, log.errors.join(' | '));
  await ctx.close();
}

await s.done();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} pass${BREAK ? ' (--break: the oracle\'s header reads are refused, so the checks that depend on them should FAIL)' : ''}`);
process.exit(BREAK ? 0 : failed ? 1 : 0);
