// Browser checks for <sg-depth-photo>, on its demo page.
//
//   node packages/stage3d/depth-photo/depth-photo.check.mjs            (or: npm run check)
//   node packages/stage3d/depth-photo/depth-photo.check.mjs --break    (against broken pages: every check must FAIL)
//
// Runs on this machine's GPU (ANGLE on Direct3D 11) so the live tier is real;
// the no-WebGL and reduced-motion runs prove the 2D tier.
// No JS: the <img> is the picture, with its alt. Each register: the right tier
// (quiet 2D, warm and playful live), the canvas hidden from assistive tech and
// the picture still named; "Focus on the plate" racks the focus (the plate's
// sharpness, read back from the pixels, rises at least fivefold); playful leans
// with the pointer and warm does not; the same t draws the same pixels; an
// export target is exactly the size asked. Reduced motion: three is never
// requested and nothing draws while idle.
// --break: the alt removed (no JS), the 2D renderer blocked (quiet), the focus
// button unwired and warm given playful's lean and a renderFrame that shows the
// live clock (warm), the canvas made visible to assistive tech and an export a
// pixel short (playful), a console error on every page, and three allowed
// under reduced motion.

import { session, openTarget, waitReady } from '../../../tools/lib/browser.mjs';

const BREAK = process.argv.includes('--break');
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const URL_ = '/packages/stage3d/depth-photo/demo.html';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

// variance of the Laplacian inside the plate's box, read from the drawn frame in the same task
const sharpness = page => page.evaluate(async () => {
  const dp = document.getElementById('dp');
  await dp.renderFrame(dp.params.t);
  const c = dp.canvas, k = c.width / dp.clientWidth;
  const [ax, ay] = dp.place(0.33, 0.54, 0.874), [bx, by] = dp.place(0.58, 0.66, 0.874);
  const x = Math.round(ax * k), y = Math.round(ay * k), w = Math.round((bx - ax) * k), h = Math.round((by - ay) * k);
  const g = new OffscreenCanvas(w, h).getContext('2d');
  g.drawImage(c, x, y, w, h, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, L = j => 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2];
  let s = 0, s2 = 0, n = 0;
  for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
    const j = (yy * w + xx) * 4, lap = L(j - 4) + L(j + 4) + L(j - 4 * w) + L(j + 4 * w) - 4 * L(j);
    s += lap; s2 += lap * lap; n++;
  }
  return Math.round(s2 / n - (s / n) ** 2);
});
const hashFrame = (page, t) => page.evaluate(async t => {
  const dp = document.getElementById('dp');
  const c = await dp.renderFrame(t);
  const g = new OffscreenCanvas(c.width, c.height).getContext('2d');
  g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i += 7) { h ^= d[i]; h = Math.imul(h, 16777619); }
  return h >>> 0;
}, t);

// ── no JavaScript ───────────────────────────────────────────────────────────
{
  const s = await session();
  const t = { url: URL_, register: 'warm', theme: 'light', noJs: true };
  const { context, page } = await openTarget(s, t, { width: 390, height: 844 });
  if (BREAK) {
    await context.route(/depth-photo\/demo\.html/, async r => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace(/alt="An ink[^"]*"/, 'alt=""') }); });
    await page.reload();
  }
  await waitReady(page, t);
  const r = await page.evaluate(() => { const img = document.querySelector('#dp img'); return { alt: img.alt.length, shown: img.getBoundingClientRect().height > 200 && img.complete && img.naturalWidth > 0, canvas: !!document.querySelector('#dp canvas') }; });
  check('no JS: the picture is the <img>, loaded, with its alt text; no canvas', r.alt > 40 && r.shown && !r.canvas, JSON.stringify(r));
  await s.done();
}

// ── each register, live on the GPU ──────────────────────────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  const s = await session({ args: GPU });
  const t = { url: URL_, register, theme: 'light' };
  const { context, page, log } = await openTarget(s, t, { width: 1280, height: 900 });
  if (BREAK) {
    if (register === 'quiet') await context.route(/depth-photo\.2d\.js/, r => r.abort());
    if (register === 'warm') await context.route(/depth-photo\/demo\.html/, async r => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace("addEventListener('click', () => pull(0.874))", "addEventListener('click', () => {})") }); });
    await page.reload();
  }
  await waitReady(page, t, { timeout: 30000 });
  const tag = `${register}:`;
  const want = register === 'quiet' ? '2d' : 'live';
  const st = await page.evaluate(br => {
    const dp = document.getElementById('dp');
    if (br) dp.querySelector('canvas')?.removeAttribute('aria-hidden');
    return { tier: dp.tier, hidden: dp.querySelector('canvas')?.getAttribute('aria-hidden'), drawn: dp.dataset.drawn !== undefined };
  }, BREAK && register === 'playful');
  const snap = await page.locator('#dp').ariaSnapshot();
  check(`${tag} draws on the ${want} tier`, st.tier === want && st.drawn, JSON.stringify(st));
  check(`${tag} the canvas is hidden from assistive tech; the picture keeps its name`, st.hidden === 'true' && /img "An ink and wash drawing/.test(snap), `aria-hidden=${st.hidden}, ${snap.split('\n')[0]}`);
  if (st.tier) {
    const far = await sharpness(page);
    await page.click('#near');
    await page.waitForFunction(() => Math.abs(document.getElementById('dp').params.focus - 0.874) < 1e-3, null, { timeout: 5000 }).catch(() => {});
    const near = await sharpness(page);
    check(`${tag} "Focus on the plate" racks the focus: the plate sharpens at least fivefold`, near > Math.max(20, far * 5), `plate sharpness ${far} -> ${near}`);
    // parallax: a full lean right, measured where the plate's centre lands
    const lean = await page.evaluate(async br => {
      const dp = document.getElementById('dp'), r = dp.getBoundingClientRect();
      const before = dp.place(0.466, 0.6, 0.874)[0];
      if (br) dp.setAttribute('register', br); // warm borrowing playful's lean, or playful losing its own
      await new Promise(res => setTimeout(res, 300));
      dp.dispatchEvent(new PointerEvent('pointermove', { clientX: r.right - 1, clientY: r.top + r.height / 2, bubbles: true }));
      await new Promise(res => setTimeout(res, 1600));
      return dp.place(0.466, 0.6, 0.874)[0] - before;
    }, BREAK && { warm: 'playful', playful: 'warm' }[register]);
    if (register === 'playful') check(`${tag} the camera leans with the pointer`, Math.abs(lean) > 5, `plate moved ${lean.toFixed(1)} px`);
    if (register === 'warm') check(`${tag} the pointer never moves the camera`, Math.abs(lean) < 0.01, `plate moved ${lean.toFixed(2)} px`);
    if (BREAK && register === 'warm') await page.evaluate(() => { // a renderFrame that shows the live clock instead of t
      const dp = document.getElementById('dp'); dp.setAttribute('register', 'warm');
      dp.renderFrame = async () => { await new Promise(r => setTimeout(r, 300)); await new Promise(r => requestAnimationFrame(r)); return dp.canvas; };
    });
    const h1 = await hashFrame(page, 2), h2 = await hashFrame(page, 5), h3 = await hashFrame(page, 2);
    check(`${tag} the same t draws the same pixels`, h1 === h3 && (register === 'quiet' || h1 !== h2), `t=2 ${h1}, t=5 ${h2}, t=2 again ${h3}`);
    const size = await page.evaluate(async br => { const dp = document.getElementById('dp'); const tg = await dp.canvasFor(br ? 1079 : 1080, 1920); const c = await tg.renderFrame(1); const r = [c.width, c.height]; tg.release(); return r; }, BREAK && register === 'playful');
    check(`${tag} an export target is exactly 1080 x 1920`, size[0] === 1080 && size[1] === 1920, size.join(' x '));
  }
  if (BREAK) await page.evaluate(() => console.error('a broken page logs an error'));
  const errs = log.consoleErrors.length + log.pageErrors.length;
  check(`${tag} no console errors`, errs === 0, [...log.consoleErrors, ...log.pageErrors].slice(0, 2).join(' | '));
  await s.done();
}

// ── reduced motion ──────────────────────────────────────────────────────────
{
  const s = await session({ args: GPU });
  const t = { url: URL_, register: 'playful', theme: 'light' };
  const { page } = await openTarget(s, t, { width: 1280, height: 900, reduced: true });
  if (BREAK) await page.evaluate(() => document.querySelectorAll('sg-depth-photo').forEach(e => e.setAttribute('renderer', 'live')));
  await waitReady(page, t, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    const dp = document.getElementById('dp'), c = dp.canvas, g = c.getContext('2d') || c.getContext('webgl2');
    const key = g.drawImage ? 'drawImage' : 'drawElements', orig = g[key];
    let n = 0; g[key] = function (...a) { n++; return orig.apply(this, a); };
    await new Promise(res => setTimeout(res, 1500));
    g[key] = orig;
    return { tier: dp.tier, draws: n, three: performance.getEntriesByType('resource').filter(e => /three\/build|three\.named\.js/.test(e.name)).length };
  });
  check('reduced motion: 2D, three never requested, and nothing draws while idle', r.tier === '2d' && r.three === 0 && r.draws === 0, JSON.stringify(r));
  await s.done();
}

const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} pass${BREAK ? ' (--break: the broken checks should FAIL)' : ''}`);
process.exit(BREAK ? 0 : failed ? 1 : 0);
