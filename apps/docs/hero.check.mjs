// The home page's hero: the tiatr (front-door-2, section 1). Every check here was run against
// a state that should fail it before it was believed (see the ledger entry for the run):
// the old kolam masthead, a show that loops, a still taken mid-rise, lettering on the canvas.
//
//   node apps/docs/hero.check.mjs                 the source tree
//   node apps/docs/hero.check.mjs --root DIR      another checkout's tree (to watch it fail)
//
// What it holds the hero to:
//   1  the masthead is the kantar scene, drawn
//   2  quiet: the curtain is up, the canvas does not change and no frame is requested
//   3  warm: it rises once; 3 s apart after that, the canvas is identical and no frame is requested
//   4  playful: never plays by itself (it rests the same way); a click strikes one act, the stage
//      then comes to rest on the next set, and a second rest costs no frames either
//   5  it pauses off screen: scrolled away mid-act, no frame is requested
//   6  reduced motion: the first frame is the finished still (the same pixels as warm at rest)
//   7  the words are real: the line is in the DOM and the accessibility tree, and the canvas never
//      draws text (fillText and strokeText are counted across a whole act)
//   8  the page paints without a long task and its largest paint is text, not the canvas
//   9  the frame is a seam: .mast-border exists, is empty and is ignored by pointers

import path from 'node:path';
import { chromium } from 'playwright';
import { startServer, REPO_ROOT } from '../../tools/serve.mjs';

const rootArg = process.argv.indexOf('--root');
const root = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : REPO_ROOT;
const LINE = 'Susegad: the unhurried contentment of a Goan afternoon.';
const server = await startServer({ root, quiet: true });
const browser = await chromium.launch();
let failed = 0, passed = 0;
const check = (name, ok, detail = '') => { ok ? passed++ : failed++; console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

// Installed before any page script: counts frames asked for, text drawn on any canvas, long tasks, LCP.
const PROBE = `(() => {
  const P = window.__probe = { raf: 0, text: 0, long: [], lcp: null };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { P.raf++; return raf(cb); };
  for (const m of ['fillText', 'strokeText']) {
    const orig = CanvasRenderingContext2D.prototype[m];
    CanvasRenderingContext2D.prototype[m] = function (...a) { P.text++; return orig.apply(this, a); };
  }
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch {}
  try { new PerformanceObserver(l => { const e = l.getEntries().at(-1); P.lcp = { tag: e.element?.tagName ?? null, id: e.element?.id ?? '', at: Math.round(e.startTime) }; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
})();`;

async function open({ register = 'warm', theme = 'light', width = 1280, reduced = false, sample = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference', colorScheme: theme,
  });
  await context.addInitScript(PROBE);
  // The rise, caught: a distinct-frames count from navigation on (it costs main-thread time, so only when asked).
  if (sample) await context.addInitScript(`(() => { const seen = new Set(); window.__probe.frames = seen; const t = setInterval(() => {
    const c = document.querySelector('#mast-stage')?.shadowRoot?.querySelector('.stage canvas'); if (!c || !c.width) return;
    const g = document.createElement('canvas'); g.width = 24; g.height = 16; const x = g.getContext('2d'); x.drawImage(c, 0, 0, 24, 16);
    seen.add(Array.from(x.getImageData(0, 0, 24, 16).data.filter((v, i) => i % 4 < 3 && i % 5 === 0)).join(','));
  }, 60); setTimeout(() => clearInterval(t), 3200); })();`);
  await context.addInitScript(p => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('sg-docs-prefs', p); sessionStorage.setItem('seeded', '1'); } } catch {} },
    JSON.stringify({ register, theme, palette: 'susegad' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${server.url}/apps/docs/`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  return { context, page, errors };
}

/** A signature of the hero's canvas: its pixels, as a string. Null when there is no canvas. */
const sig = page => page.evaluate(() => {
  const c = document.querySelector('#mast-stage')?.shadowRoot?.querySelector('.stage canvas');
  if (!c) return null;
  const s = c.toDataURL('image/png');
  return `${s.length}:${s.slice(-400)}:${s.slice(s.length >> 1, (s.length >> 1) + 400)}`;
});
/** The canvas shrunk to 48 x 32, as RGB numbers: close enough to compare two stills that differ only by a pit player's pose. */
const thumb = page => page.evaluate(() => {
  const c = document.querySelector('#mast-stage')?.shadowRoot?.querySelector('.stage canvas');
  if (!c) return null;
  const t = new OffscreenCanvas(48, 32), g = t.getContext('2d', { willReadFrequently: true });
  g.drawImage(c, 0, 0, 48, 32);
  const d = g.getImageData(0, 0, 48, 32).data, out = [];
  for (let i = 0; i < d.length; i += 4) out.push(d[i], d[i + 1], d[i + 2]);
  return out;
});
const meanDiff = (a, b) => (a && b ? a.reduce((n, v, i) => n + Math.abs(v - b[i]), 0) / a.length : Infinity);
const frames = page => page.evaluate(() => window.__probe.raf);
/** Frames asked for and canvas change over `ms`. */
async function watch(page, ms) {
  const [f0, s0] = [await frames(page), await sig(page)];
  await page.waitForTimeout(ms);
  const [f1, s1] = [await frames(page), await sig(page)];
  return { frames: f1 - f0, changed: s0 !== s1 };
}
const drawn = page => page.evaluate(() => !!document.querySelector('#mast-stage')?.shadowRoot?.querySelector('.stage canvas'));
const click = page => page.locator('#mast-stage').click({ position: { x: 300, y: 150 }, timeout: 3000 }).then(() => true, () => false);

// 1 and 9, once
{
  const { context, page, errors } = await open();
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const s = document.querySelector('#mast-stage');
    const b = document.querySelector('.mast-border');
    return { name: s?.getAttribute('name'), border: !!b, borderEmpty: !!b && b.children.length === 0 && !b.textContent.trim(), borderPe: b ? getComputedStyle(b).pointerEvents : null, borderHidden: b?.getAttribute('aria-hidden') };
  });
  check('1. the masthead is the kantar scene, drawn', info.name === 'kantar' && await drawn(page), `name ${info.name}`);
  check('9. the frame is a seam: an empty, aria-hidden .mast-border that pointers ignore', info.border && info.borderEmpty && info.borderPe === 'none' && info.borderHidden === 'true', JSON.stringify(info));
  check('1b. no console or page errors on load', errors.length === 0, errors.slice(0, 2).join(' | '));
  await context.close();
}

// 2 quiet
{
  const { context, page } = await open({ register: 'quiet' });
  await page.waitForTimeout(1500);
  const w = await watch(page, 3000);
  check('2. quiet: curtain up and still, the canvas unchanged over 3 s and no frame requested', await drawn(page) && !w.changed && w.frames === 0, `frames ${w.frames}, changed ${w.changed}`);
  await context.close();
}

// 3 warm, 6 reduced reference
let warmRest = null, warmThumb = null;
{
  const { context, page } = await open({ register: 'warm', sample: true });
  await page.waitForTimeout(3300);
  const distinct = await page.evaluate(() => window.__probe.frames.size);
  warmRest = await sig(page);
  warmThumb = await thumb(page);
  const w = await watch(page, 3000);
  check('3a. warm: the curtain rises (several distinct frames between load and rest, not a still)', distinct >= 4, `${distinct} distinct frames sampled`);
  check('3b. warm: after the first rise, 3 s apart the canvas is identical and no frame is requested', warmRest !== null && !w.changed && w.frames === 0, `frames ${w.frames}, changed ${w.changed}`);
  await context.close();
}

// 4 playful
{
  const { context, page } = await open({ register: 'playful' });
  await page.waitForTimeout(3200);
  const rest0 = await sig(page);
  const idle = await watch(page, 3000);
  const longIdle = await watch(page, 9000); // longer than a whole act: a looping show would have moved
  check('4a. playful: left alone it rests after the rise, 12 s with no change and no frame requested', !idle.changed && !longIdle.changed && idle.frames + longIdle.frames === 0, `frames ${idle.frames + longIdle.frames}`);
  await click(page);
  await page.waitForTimeout(900);
  const mid = await sig(page);
  check('4b. playful: a click starts the act (the curtain drops)', mid !== rest0);
  await page.waitForTimeout(10500);
  const after = await sig(page);
  const again = await watch(page, 3000);
  check('4c. playful: the act ends at rest on the next set, and that rest is silent too', after !== rest0 && !again.changed && again.frames === 0, `frames ${again.frames}, set changed ${after !== rest0}`);
  await context.close();
}

// 5 off screen
{
  const { context, page } = await open({ register: 'playful' });
  await page.waitForTimeout(3200);
  await click(page);
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 99999); });
  await page.waitForTimeout(800);
  const w = await watch(page, 2500);
  check('5. it pauses off screen: scrolled away mid-act, no frame is requested for 2.5 s', w.frames === 0, `frames ${w.frames}`);
  await context.close();
}

// 6 reduced motion
{
  const { context, page } = await open({ register: 'warm', reduced: true });
  await page.waitForTimeout(1200);
  const first = await thumb(page);
  const w = await watch(page, 2500);
  const d = meanDiff(first, warmThumb);
  check('6a. reduced motion: the first frame is the finished still (curtain up, the warm rest to within a pit player pose)', d < 2, `mean difference ${d.toFixed(2)} of 255 against warm at rest`);
  check('6b. reduced motion: nothing moves and no frame is requested', !w.changed && w.frames === 0, `frames ${w.frames}`);
  await context.close();
}

// 7 words
{
  const { context, page } = await open({ register: 'playful' });
  await page.waitForTimeout(3200);
  await click(page);
  await page.waitForTimeout(6500); // inside the song
  const dom = await page.evaluate(() => ({
    caption: document.querySelector('#mast-line')?.textContent.replace(/\s+/g, ' ').trim(),
    text: window.__probe.text,
    live: document.querySelector('#mast-stage')?.shadowRoot?.querySelector('.stage [role=status], .stage .vh')?.textContent ?? '',
  }));
  let aria = '';
  try { aria = await page.locator('#mast-art').ariaSnapshot(); } catch (e) { aria = `no snapshot: ${e.message}`; }
  check('7a. the hero line is in the DOM, whole', dom.caption === LINE, JSON.stringify(dom.caption));
  check('7b. the hero line is in the accessibility tree', aria.includes(LINE) || aria.includes('contentment of a Goan afternoon'), aria.replace(/\s+/g, ' ').slice(0, 120));
  check('7c. the canvas never draws text (fillText and strokeText counted across load and a sung act)', dom.text === 0, `${dom.text} calls`);
  check('7d. the song is announced as text, and it is our line, not a placeholder', dom.live.includes(LINE), JSON.stringify(dom.live));
  await context.close();
}

// 8 paint
{
  const longs = [], lcps = [];
  for (let i = 0; i < 3; i++) {
    const { context, page } = await open({ register: 'warm' });
    await page.waitForTimeout(2500);
    const p = await page.evaluate(() => window.__probe);
    longs.push(...p.long); lcps.push(p.lcp);
    await context.close();
  }
  check('8a. no long task over 50 ms in three loads', longs.every(d => d <= 50), `long tasks: ${longs.length ? longs.join(', ') + ' ms' : 'none'}`);
  check('8b. the largest contentful paint is text, never the canvas', lcps.every(l => l && l.tag !== 'CANVAS' && l.tag !== 'SG-SCENE'), lcps.map(l => l && `${l.tag}#${l.id}@${l.at}ms`).join(', '));
}

await browser.close();
await server.close();
console.log(`\n${passed} of ${passed + failed} pass`);
process.exit(failed ? 1 : 0);
