// Pixel probes for scene checks (*.check.mjs): open a scene in the harness,
// then read its canvas the way a person would look at it. Every probe works
// in the scene's logical units, so a check can say "at the book's left page"
// rather than a pixel that changes with the window.
//
//   const probe = await openScene(browser, server, 'vahi', { register: 'warm', progress: 0.5 });
//   const a = await probe.hash();              // a fingerprint of the whole canvas
//   const f = await probe.fraction(box, 'sheet'); // share of pixels in box matching a colour test

import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';

/** Colour tests by name, on [r, g, b] in 0..255. Kept here so checks and their fail-first runs share them. */
export const TESTS = {
  // near-white paper: a page, a receipt, a sheet
  sheet: ([r, g, b]) => r > 225 && g > 218 && b > 200,
  // brass and gold: warm, bright, low blue
  brass: ([r, g, b]) => r > 150 && g > 105 && b < 110 && r - b > 70 && r > g,
  // the laterite red of a hull or a wall
  laterite: ([r, g, b]) => r > 120 && r - g > 45 && r - b > 45 && g < 130,
  // chai's phone: a sent bubble's pale sea blue, a draft card's haldi cream, a filled tick's green
  sent: ([r, g, b]) => Math.abs(r - 213) < 9 && Math.abs(g - 230) < 9 && Math.abs(b - 234) < 9,
  draft: ([r, g, b]) => Math.abs(r - 251) < 7 && Math.abs(g - 241) < 7 && Math.abs(b - 211) < 9,
  tick: ([r, g, b]) => g > r + 20 && g > b + 20 && g > 90,
  // a sky past first light: bright, whatever its hue
  daylight: ([r, g, b]) => r + g + b > 400,
};

/** Start a server and a browser for a check. Call done() at the end. */
export async function session() {
  const server = await startServer({ quiet: true });
  const browser = await chromium.launch();
  const results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
  return {
    server, browser, check, results,
    async done() { await browser.close(); await server.close(); if (results.some(r => !r.ok)) process.exit(1); },
  };
}

/**
 * Open one scene in the harness. `opts` are harness params (register, theme,
 * seed, content, and any scene attribute); `reduced` emulates reduced motion.
 */
export async function openScene({ browser, server }, name, { reduced = false, width = 1280, height = 900, ...params } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const q = new URLSearchParams({ name, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  await page.goto(`${server.url}/tools/harness/scene.html?${q}`);
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 15000 });
  // the reading panel settles once its fonts arrive, and a scene may move its drawing aside then
  await page.evaluate(() => document.fonts.ready);
  const read = (box, test) => page.evaluate(([box, test]) => {
    const el = window.__piece, cv = el.shadowRoot.querySelector('canvas'), { W, H } = el.meta;
    const kx = cv.width / W, ky = cv.height / H, g = cv.getContext('2d', { willReadFrequently: true });
    const b = box ?? { x: 0, y: 0, w: W, h: H };
    const x = Math.max(0, Math.round(b.x * kx)), y = Math.max(0, Math.round(b.y * ky));
    const w = Math.min(cv.width - x, Math.round(b.w * kx)), h = Math.min(cv.height - y, Math.round(b.h * ky));
    const d = g.getImageData(x, y, w, h).data;
    if (test === '#hash') { let s = 0; for (let i = 0; i < d.length; i += 4) s = (s * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) >>> 0; return s; }
    const fn = new Function('return ' + test)();
    let hit = 0, n = 0, sx = 0, sy = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4;
      n++;
      if (fn([d[k], d[k + 1], d[k + 2]])) { hit++; sx += i; sy += j; }
    }
    return { fraction: hit / n, hits: hit, cx: hit ? x / kx + (sx / hit) / kx : null, cy: hit ? y / ky + (sy / hit) / ky : null };
  }, [box, test]);
  return {
    page, errors,
    hash: box => read(box, '#hash'),
    /** Share of pixels in `box` (logical units) passing a named colour test, and their centroid. */
    measure: (box, test) => read(box, TESTS[test].toString()),
    fraction: async (box, test) => (await read(box, TESTS[test].toString())).fraction,
    /** The reading panel's box in the scene's logical units, or null. */
    panel: () => page.evaluate(() => {
      const el = window.__piece, p = el.shadowRoot.querySelector('.panel'), cv = el.shadowRoot.querySelector('canvas');
      if (!p || p.hidden) return null;
      const a = p.getBoundingClientRect(), c = cv.getBoundingClientRect(), { W, H } = el.meta;
      return { x: ((a.left - c.left) / c.width) * W, y: ((a.top - c.top) / c.height) * H, w: (a.width / c.width) * W, h: (a.height / c.height) * H };
    }),
    /** Keep the whole canvas as it is now, under a name, inside the page. */
    snap: name => page.evaluate(n => { const cv = window.__piece.shadowRoot.querySelector('canvas'); (window.__snaps ??= {})[n] = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height); }, name),
    /** The share of pixels in `box` (logical units; the whole canvas if absent) that differ between two snaps. */
    changed: (a, b, box = null, threshold = 24) => page.evaluate(([a, b, box, threshold]) => {
      const A = window.__snaps[a], B = window.__snaps[b], { W, H } = window.__piece.meta, kx = A.width / W, ky = A.height / H;
      const bx = box ?? { x: 0, y: 0, w: W, h: H };
      const x0 = Math.max(0, Math.round(bx.x * kx)), y0 = Math.max(0, Math.round(bx.y * ky)), x1 = Math.min(A.width, Math.round((bx.x + bx.w) * kx)), y1 = Math.min(A.height, Math.round((bx.y + bx.h) * ky));
      let n = 0, c = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * A.width + x) * 4; n++;
        if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > threshold) c++;
      }
      return n ? c / n : 0;
    }, [a, b, box, threshold]),
    status: () => page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent),
    wait: ms => page.waitForTimeout(ms),
    close: () => page.close(),
  };
}
