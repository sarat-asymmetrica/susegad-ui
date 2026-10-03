// Browser checks for the Kantar interlude: named phases (curtain down, the
// song, curtain up), the skip control, the quiet and reduced-motion
// fallback to a plain status line, honest timing (never shorter than the
// real work, never outlasts it past minWaitMs), and no console errors.
//
//   node packages/transitions/kantar/kantar.check.mjs      (or: npm run check)

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';
import { singerSilhouette, singerHead, singerBun } from './kantar.core.js';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/transitions/kantar/demo.html`;

const curtain = p => p.evaluate(() => +getComputedStyle(document.querySelector('.sg-kantar')).getPropertyValue('--sg-kantar-curtain'));

// ── warm: the named phases across a run ─────────────────────────────────────
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${demo}?register=warm`);
  await p.waitForFunction(() => window.__ready);

  const t0 = Date.now();
  await p.click('#go-slow'); // a 3s work promise
  await p.waitForSelector('.sg-kantar-curtain');

  await p.waitForTimeout(120);
  check('named phase, curtain down: the curtain is part-way closed early on', (await curtain(p)) > 0 && (await curtain(p)) < 1, `curtain=${await curtain(p)}`);

  await p.waitForTimeout(900); // well past curtainDown (700ms default); still mid-wait, since work takes 3s
  const midCurtain = await curtain(p);
  const spotShown = await p.evaluate(() => +getComputedStyle(document.querySelector('.sg-kantar')).getPropertyValue('--sg-kantar-spot'));
  check('named phase, the song: the curtain is fully closed and the spotlight is on', midCurtain === 1 && spotShown === 1, `curtain=${midCurtain} spot=${spotShown}`);
  const line1 = await p.evaluate(() => document.querySelector('.sg-kantar-line').textContent);
  check('the song shows one of the given lines while waiting', line1.includes('Checking') || line1.includes('Holding'), line1);

  // step 2 has not appeared yet: the real work (3s) is not done
  check('the wait genuinely tracks the real work: step 2 has not swapped in yet', await p.evaluate(() => !document.getElementById('step-2')));

  await p.waitForTimeout(3200); // work resolves at ~3s from click; curtain rises after
  check('named phase, curtain up (or settled): step 2 is now showing', await p.evaluate(() => !!document.getElementById('step-2')));
  await p.waitForFunction(() => !document.querySelector('.sg-kantar-curtain'), { timeout: 2000 });
  check('the interlude tears itself down once the curtain has fully risen', await p.evaluate(() => !document.querySelector('.sg-kantar')));

  const elapsed = Date.now() - t0;
  check('the whole run took at least as long as the real 3s work (never shorter)', elapsed >= 3000, `${elapsed}ms`);

  check('no console or page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── S3 (Rasika's Wave 5 review, both rounds): the singer and the spotlight
// line never share a box, and the figure's own true top -- the head, which
// round 1 restored the body's 21 points but not singer()'s head/bun/mic,
// leaving the figure headless -- is what this measures against, not just
// the body polygon on its own. The figure's own vertical extent is computed
// the same way kantar.js draws it (feetY 0.66×h, figH 0.28×h, over every
// sway the figure actually takes), so this is a real geometric check
// against the box the line must clear, not just "it looks fine at one
// instant". ──────────────────────────────────────────────────────────────
for (const [width, tag] of [[900, 'desktop'], [390, 'phone']]) {
  const ctx = await browser.newContext({ viewport: { width, height: 500 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=playful`);
  await p.waitForFunction(() => window.__ready);
  await p.click('#go-slow');
  await p.waitForTimeout(1600); // well into the song
  const stage = await p.locator('.stage').boundingBox();
  const line = await p.locator('.sg-kantar-line').boundingBox();
  // The figure sways with sin(tSec * 1.4) * 0.5; sample across a full period
  // for the true min/max, not one frame's sway, and include the head and
  // bun's own ellipse extents (their top edge is cy - ry), not just the
  // body polygon's points.
  let minPy = Infinity, maxPy = -Infinity;
  for (let s = -0.5; s <= 0.5; s += 0.05) {
    for (const [, py] of singerSilhouette(s)) { if (py < minPy) minPy = py; if (py > maxPy) maxPy = py; }
    const head = singerHead(s), bun = singerBun(s);
    minPy = Math.min(minPy, head.cy - head.ry, bun.cy - bun.ry);
    maxPy = Math.max(maxPy, head.cy + head.ry, bun.cy + bun.ry);
  }
  const feetY = stage.y + stage.height * 0.66, figH = stage.height * 0.28;
  const figTop = feetY + minPy * figH, figBottom = feetY + maxPy * figH;
  const clear = line.y >= figBottom;
  check(
    `S3, playful ${tag}: the line's box sits below the figure's box (head and bun included), no overlap`,
    clear,
    `figure y ${figTop.toFixed(0)}..${figBottom.toFixed(0)}, line y ${line.y.toFixed(0)}..${(line.y + line.height).toFixed(0)}`,
  );
  await ctx.close();
}

// ── KB1: never outlasts the real wait -- work resolving to the next step
// being focused stays at or under 300ms, for real (not instant, not
// pathologically slow) work ────────────────────────────────────────────────
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=warm`);
  await p.waitForFunction(() => window.__ready);
  await p.evaluate(() => { window.__workDoneAt = 0; window.__origSetTimeout = window.setTimeout; });
  // #go's work is a 1.2s setTimeout; mark the moment it actually resolves.
  await p.evaluate(() => {
    const orig = window.setTimeout;
    window.setTimeout = (fn, ms, ...rest) => orig(() => { if (ms === 1200) window.__workDoneAt = performance.now(); fn(); }, ms, ...rest);
  });
  await p.click('#go');
  await p.waitForFunction(() => document.activeElement?.tagName === 'H2' && document.activeElement.textContent.includes('Step 2'), { timeout: 3000 });
  const gap = await p.evaluate(() => performance.now() - window.__workDoneAt);
  check('KB1: work resolving to the next step\'s heading being focused is <= 300ms', gap <= 300, `${gap.toFixed(1)}ms`);
  await ctx.close();
}

// ── the skip control ─────────────────────────────────────────────────────
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=warm`);
  await p.waitForFunction(() => window.__ready);
  await p.click('#go-slow'); // 3s work, but we will skip long before that
  await p.waitForSelector('.sg-kantar-skip');
  const t0 = Date.now();
  await p.click('.sg-kantar-skip');
  await p.waitForFunction(() => !document.querySelector('.sg-kantar'), { timeout: 2000 });
  const elapsed = Date.now() - t0;
  check('skip ends the interlude in well under the real 3s wait', elapsed < 2000, `${elapsed}ms`);
  const log = await p.evaluate(() => document.getElementById('log').textContent);
  check('skip is reported honestly: the work had not finished, so nothing was swapped', /"skipped":true/.test(log) && /"workDone":false/.test(log) && /"swapped":false/.test(log), log.trim());
  check('skipping before the work finishes does not swap in step 2', await p.evaluate(() => !document.getElementById('step-2')));
  await ctx.close();
}

// ── instant work still gets one readable beat, never a flash ───────────────
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=warm`);
  await p.waitForFunction(() => window.__ready);
  const t0 = Date.now();
  await p.click('#go-fast'); // work resolves immediately
  await p.waitForFunction(() => !document.querySelector('.sg-kantar'), { timeout: 3000 });
  const elapsed = Date.now() - t0;
  // curtainDown (700) + minWaitMs (300) + curtainUp (300) = 1300ms, the honest
  // floor for a fixed theatrical entrance and exit (KB1 lowered both from
  // 900ms so real work isn't held up; this is instant work, so the floor is
  // the whole story).
  check('instant work still runs the full curtain choreography, not a flash', elapsed >= 1200 && elapsed < 2000, `${elapsed}ms`);
  check('instant work still swaps in step 2', await p.evaluate(() => !!document.getElementById('step-2')));
  await ctx.close();
}

// ── quiet: a plain status line, no curtain theatre ──────────────────────────
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready);
  await p.click('#go');
  const has = await p.evaluate(() => !!document.querySelector('.sg-kantar-plain') && !document.querySelector('.sg-kantar-curtain'));
  check('quiet: a plain status line mounts, with no curtain', has);
  await p.waitForFunction(() => !!document.getElementById('step-2'), { timeout: 3000 });
  check('quiet: the real work still finishes and swaps step 2', true);
  await ctx.close();
}

// ── reduced motion: the same plain fallback ─────────────────────────────────
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=warm`);
  await p.waitForFunction(() => window.__ready);
  await p.click('#go');
  const has = await p.evaluate(() => !!document.querySelector('.sg-kantar-plain') && !document.querySelector('.sg-kantar-curtain'));
  check('reduced motion: falls back to the plain status line even in warm', has);
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
