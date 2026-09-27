// Visual diff against a stored baseline, made deterministic by seed and a frozen clock.
//
//   node tools/diff.mjs --scene kolam --seed 3 --at 2 [--register warm] [--theme light] [--update]
//   node tools/diff.mjs --url /apps/docs/index.html --at 1
//
//   --at S           freeze the scene clock at S seconds (default 2); see ?freeze in tools/harness/scene.html
//   --update         write the baseline instead of comparing
//   --threshold D    per-pixel colour distance, 0..1, above which a pixel counts as changed (default 0.02)
//   --max-ratio R    share of changed pixels allowed (default 0.001, one pixel in a thousand)
//   --width/--height/--dpr/--reduced/--content/--param as for shot.mjs
//   --out DIR        where the actual and diff images go (default .shots/diff)
//
// Baselines live in tools/baselines/<target>-<register>-<theme>.png, with a .json beside each
// recording the seed, params and time it was made with. The comparison runs in the browser on
// canvas ImageData, using tools/lib/pixeldiff.mjs; no image dependency.
//
// Pages given by --url have no harness clock, so they are shot after --at real seconds and are
// only as deterministic as the page itself.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { TARGET_SPEC, targetFrom, targetSlug } from './lib/target.mjs';
import { session, openTarget, waitReady, printLog, shoot, DESKTOP } from './lib/browser.mjs';
import { REPO_ROOT } from './serve.mjs';

const SPEC = {
  ...TARGET_SPEC, at: 'number', update: 'bool', threshold: 'number', 'max-ratio': 'number', out: 'string',
  width: 'number', height: 'number', dpr: 'number', reduced: 'bool',
};
let parsed;
try {
  parsed = parseArgs(process.argv.slice(2), SPEC, {
    at: 2, threshold: 0.02, 'max-ratio': 0.001, out: '.shots/diff', width: DESKTOP.width, height: DESKTOP.height, dpr: 1,
  });
} catch (e) { console.error(e.message); process.exit(2); }
const { opts, positional } = parsed;
let t;
try { t = targetFrom(opts, positional); } catch (e) { console.error(e.message); process.exit(2); }
if (!t.scene && !t.url) { console.error('usage: node tools/diff.mjs --scene <name> [--seed N] [--at S] [--update]'); process.exit(2); }
t.register ??= 'warm';
t.theme ??= 'light';
if (t.scene) t.freeze = opts.at;

const name = `${targetSlug(t)}-${t.register}-${t.theme}${opts.reduced ? '-reduced' : ''}`;
const baseDir = path.join(REPO_ROOT, 'tools', 'baselines');
const basePng = path.join(baseDir, `${name}.png`);
const baseJson = path.join(baseDir, `${name}.json`);
const recipe = { seed: t.seed ?? null, params: t.params, content: t.content, at: opts.at, width: opts.width, height: opts.height, dpr: opts.dpr, reduced: !!opts.reduced };

const s = await session();
let code = 0;
try {
  const { context, page, log } = await openTarget(s, t, { width: opts.width, height: opts.height, dpr: opts.dpr, reduced: opts.reduced });
  const ready = await waitReady(page, t, { timeout: 15000 + opts.at * 3000 });
  if (!ready.ok) { console.log(`not ready: ${ready.reason}`); printLog(log); process.exitCode = 1; throw new Error('not ready'); }
  if (!t.scene) await page.waitForTimeout(opts.at * 1000);
  const clock = t.scene ? await page.evaluate(() => ({ time: window.__clock?.time, frames: window.__clock?.frames })) : null;
  const png = await shoot(page, t.scene ? '#box' : null);
  if (printLog(log)) { console.log('the page logged errors; the diff is still made'); code = 1; }
  await context.close();
  if (clock) console.log(`frozen at ${clock.time.toFixed(3)} s after ${clock.frames} virtual frames`);

  if (opts.update) {
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(basePng, png);
    fs.writeFileSync(baseJson, JSON.stringify(recipe, null, 2) + '\n');
    console.log(`baseline written: ${path.relative(REPO_ROOT, basePng)}`);
  } else if (!fs.existsSync(basePng)) {
    console.log(`no baseline at ${path.relative(REPO_ROOT, basePng)}; make one with --update`);
    code = 1;
  } else {
    const was = fs.existsSync(baseJson) ? JSON.parse(fs.readFileSync(baseJson, 'utf8')) : null;
    if (was) {
      const changed = Object.keys(recipe).filter(k => JSON.stringify(recipe[k]) !== JSON.stringify(was[k]));
      if (changed.length) console.log(`note: the baseline was made with different ${changed.map(k => `${k} (${JSON.stringify(was[k])} then, ${JSON.stringify(recipe[k])} now)`).join(', ')}`);
    }
    fs.mkdirSync(opts.out, { recursive: true });
    const actualPath = path.join(opts.out, `${name}-actual.png`);
    const diffPath = path.join(opts.out, `${name}-diff.png`);
    fs.writeFileSync(actualPath, png);

    const work = await (await s.browser.newContext()).newPage();
    await work.goto(`${s.base}/tools/harness/blank.html`);
    const r = await work.evaluate(async ({ a, b, threshold, maxRatio }) => {
      const { comparePixels } = await import('/tools/lib/pixeldiff.mjs');
      const decode = async b64 => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
        const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(bmp, 0, 0);
        return x.getImageData(0, 0, bmp.width, bmp.height);
      };
      const [A, B] = await Promise.all([decode(a), decode(b)]);
      if (A.width !== B.width || A.height !== B.height) {
        return { sizeMismatch: true, a: [A.width, A.height], b: [B.width, B.height] };
      }
      const res = comparePixels(A.data, B.data, A.width, A.height, { threshold, maxRatio });
      const c = new OffscreenCanvas(A.width, A.height);
      c.getContext('2d').putImageData(new ImageData(res.diff, A.width, A.height), 0, 0);
      const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const { diff, ...rest } = res;
      return { ...rest, width: A.width, height: A.height, diffPng: btoa(bin) };
    }, { a: fs.readFileSync(basePng).toString('base64'), b: png.toString('base64'), threshold: opts.threshold, maxRatio: opts['max-ratio'] });
    await work.context().close();

    if (r.sizeMismatch) {
      console.log(`FAIL  size changed: baseline ${r.a.join('x')}, now ${r.b.join('x')}`);
      code = 1;
    } else {
      fs.writeFileSync(diffPath, Buffer.from(r.diffPng, 'base64'));
      const pct = (r.ratio * 100).toFixed(3);
      console.log(`${r.pass ? 'pass' : 'FAIL'}  ${name}: ${r.changed} of ${r.total} pixels changed (${pct}%, allowed ${(opts['max-ratio'] * 100).toFixed(3)}%), largest distance ${r.maxDistance.toFixed(3)}`);
      if (r.bbox) console.log(`      changed region x ${r.bbox.x}, y ${r.bbox.y}, ${r.bbox.w} x ${r.bbox.h} px`);
      console.log(`      actual ${actualPath}`);
      console.log(`      diff   ${diffPath}`);
      if (!r.pass) code = 1;
    }
  }
} catch (e) {
  if (e.message !== 'not ready') console.error(e);
  code = 1;
} finally {
  await s.done();
}
process.exit(code);
