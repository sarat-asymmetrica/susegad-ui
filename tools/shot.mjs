// Headless screenshots of a scene or a page over time.
//
//   node tools/shot.mjs <scene> [seconds ...] [options]
//   node tools/shot.mjs --url /apps/docs/index.html [seconds ...] [options]
//
//   --out DIR            where to save (default .shots/shot)
//   --register R         quiet | warm | playful
//   --theme T            light | dark
//   --palette P          sets data-palette on :root
//   --seed N             scene seed
//   --param k=v          any scene attribute (repeatable)
//   --content            slot sample reading content into the scene
//   --reduced            prefers-reduced-motion: reduce
//   --width N --height N viewport (default 1280 x 900)
//   --dpr N              device pixel ratio (default 1)
//   --touch              hasTouch + isMobile
//   --selector CSS       what to screenshot (default #box for scenes, the viewport for pages)
//   --move x,y@s         move the pointer to a fraction of the target at s seconds (repeatable)
//   --click x,y@s        click there (a tap with --touch)
//   --call method@s      call window.__piece[method]() at s seconds
//   --allow-errors       do not exit non-zero on console errors, page errors or failed requests
//
// Saves <out>/<target>-<register>-<theme>-<s>s[-reduced].png at each requested second
// (default 2). Prints every problem and the mean frame time.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, parseAction } from './lib/args.mjs';
import { TARGET_SPEC, targetFrom, targetSlug } from './lib/target.mjs';
import { session, openTarget, waitReady, printLog, shoot } from './lib/browser.mjs';
import { frameStats, fmtMs } from './lib/stats.mjs';

const SPEC = {
  ...TARGET_SPEC, out: 'string', reduced: 'bool', width: 'number', height: 'number', dpr: 'number',
  touch: 'bool', selector: 'string', move: 'list', click: 'list', call: 'list', 'allow-errors': 'bool',
};

let parsed;
try { parsed = parseArgs(process.argv.slice(2), SPEC, { out: '.shots/shot', width: 1280, height: 900, dpr: 1 }); }
catch (e) { console.error(e.message); process.exit(2); }
const { opts, positional } = parsed;
let t;
try { t = targetFrom(opts, positional); } catch (e) { console.error(e.message); process.exit(2); }
const secondsArgs = opts.url ? positional : positional.slice(opts.scene ? 0 : 1);
const times = secondsArgs.map(Number);
if (!t.scene && !t.url) {
  console.error('usage: node tools/shot.mjs <scene> [seconds ...] [options]   (see the top of tools/shot.mjs)');
  process.exit(2);
}
if (times.some(v => !Number.isFinite(v) || v < 0)) { console.error(`bad seconds: ${secondsArgs.join(' ')}`); process.exit(2); }
if (!times.length) times.push(2);
const actions = [
  ...opts.move.map(s => parseAction('move', s)),
  ...opts.click.map(s => parseAction('click', s)),
  ...opts.call.map(s => parseAction('call', s)),
];
const selector = opts.selector || (t.scene ? '#box' : null);
fs.mkdirSync(opts.out, { recursive: true });

const s = await session();
let failed = 0;
try {
  const { page, log, url } = await openTarget(s, t, {
    width: opts.width, height: opts.height, dpr: opts.dpr, touch: opts.touch, reduced: opts.reduced,
  });
  console.log(`open ${url}`);
  const ready = await waitReady(page, t);
  if (!ready.ok) { console.log(`not ready: ${ready.reason}`); failed++; }

  await page.evaluate(() => {
    window.__frames = [];
    let prev = performance.now();
    const tick = now => { window.__frames.push(now - prev); prev = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });

  const target = selector ? page.locator(selector).first() : null;
  if (target && !(await target.count())) { console.log(`selector ${selector} matched nothing`); failed++; }
  const pointerTarget = t.scene ? page.locator('#box > *').first() : target;
  const box = pointerTarget && await pointerTarget.count() ? await pointerTarget.boundingBox() : null;
  const tag = [targetSlug(t), t.register, t.theme].filter(Boolean).join('-');
  const events = [...times.map(at => ({ kind: 'shot', at })), ...actions].sort((a, b) => a.at - b.at);
  const start = Date.now();
  for (const ev of events) {
    const wait = ev.at * 1000 - (Date.now() - start);
    if (wait > 0) await page.waitForTimeout(wait);
    if (ev.kind === 'shot') {
      const file = path.join(opts.out, `${tag}-${ev.at}s${opts.reduced ? '-reduced' : ''}.png`);
      await shoot(page, selector, file);
      console.log(`saved ${file}`);
    } else if (ev.kind === 'call') {
      const r = await page.evaluate(m => {
        const p = window.__piece;
        if (!p || typeof p[m] !== 'function') return `no method ${m} on window.__piece`;
        p[m]();
        return null;
      }, ev.method);
      if (r) { console.log(r); failed++; }
    } else if (!box) {
      console.log(`no element to ${ev.kind} on`); failed++;
    } else {
      const x = box.x + ev.x * box.width, y = box.y + ev.y * box.height;
      if (ev.kind === 'move') await page.mouse.move(x, y, { steps: 12 });
      else if (opts.touch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    }
  }

  const frames = await page.evaluate(() => window.__frames.slice(5));
  const st = frameStats(frames);
  if (st.count) console.log(`frames: ${st.count}, mean ${fmtMs(st.mean)}, p95 ${fmtMs(st.p95)}, worst ${fmtMs(st.worst)} (headless Chromium ${s.version}, ${opts.dpr}x DPR)`);
  const errors = printLog(log);
  if (errors) console.log(`${errors} error(s)${opts['allow-errors'] ? ' (allowed)' : ''}`);
  if (!opts['allow-errors']) failed += errors;
} finally {
  await s.done();
}
process.exit(failed ? 1 : 0);
