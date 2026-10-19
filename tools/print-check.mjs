// Does a page draw its print where its own model says it is?
//
//   node tools/print-check.mjs <page> [--query '&offset=40'] [--width 1280] [--height 900] [--at 0,1.5] [--engine=webkit]
//
// <page> is a path the dev server serves (/tools/fixtures/print-check/index.html). The page implements the contract below;
// for each sample time the tool compares the pixels the page drew with the shapes the page predicts for them, in Node, with
// pixels.mjs's maths, prints one line per layer with its numbers and the control's, and exits 1 on any failure.
// The first user is the carrier kit's banner and pennants (lab/sketches/carrier-kit/tools/print-check.mjs, which this is ported from).
//
// THE CONTRACT. The page sets window.__printCheck (and window.__ready = true when it can be asked):
//
//   plan():  number[]            the times worth sampling (seconds, in the page's own clock), e.g. the middle of each caption
//   at(t):   sample              puts the page at t, draws, and returns (a promise is fine):
//     { w, h,                    the pixel size of every buffer below
//       controlShift?: [dx, dy], how far the control slides the prediction (default 70, 45; enough to leave the ink)
//       layers: [{
//         name:      string,
//         kind:      'print' | 'fill',   print: ink on something (a word); fill: an area (the cloth). Decides what is judged
//         drawn:     rgba,       the frame with this layer drawn
//         base?:     rgba,       the same frame without it; the layer's ink is where they differ (pixels.mjs, LAYER_THRESHOLD).
//                                Without it, the ink is every pixel with alpha > 0 in `drawn` (a layer on a cleared canvas)
//         predicted: shapes,     where the model says the ink lies: boxes {x,y,w,h} and/or polygons [[x,y],...], in buffer pixels
//         tolerance?: number,    px the prediction may be off before ink counts as spill (default 0)
//         on?:       string,     print only: the name of an earlier layer whose ink this one must lie on
//         spill?:    false,      fill only: do not judge spill (pennants, whose cloth edge is not modelled); printed as "not judged"
//       }] }
//   rgba is the w*h*4 bytes of getImageData(...).data as base64 (btoa), so a frame crosses the wire as one string; a plain array works too.
//
// WHAT IS JUDGED (the numbers are the lab's, from its first clean run; a page cannot loosen them):
//   print: at least minPixels of ink (an empty layer is not a pass); inside >= 0.8 (share of the ink that lies in the predicted
//          shapes); on >= 0.85 when `on` is set (share of the ink that lies on the other layer's ink)
//   fill:  at least minPixels of ink; covered >= 0.85 (share of the predicted area that was drawn); spill <= 0.08 (share of the ink
//          outside the prediction grown by `tolerance`) unless the layer says spill: false
//   control: the prediction slid by controlShift. A print layer's inside must fall below 0.6, a fill's covered below 0.5. A control
//          that does not fall means the prediction could not have been wrong (it covers everything), so the layer fails.
//
// The pure half (judgeSample, formatLayer) needs no browser and is exercised in print-check.check.mjs, with the fixture page.

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { diffMask, alphaMask, rasterize, shiftShapes, agreement, count, share } from './lib/pixels.mjs';
import { parseArgs } from './lib/args.mjs';

export const THRESHOLDS = {
  minPixels: 200,
  insideMin: 0.8, onMin: 0.85,
  coveredMin: 0.85, spillMax: 0.08,
  controlInsideBelow: 0.6, controlCoveredBelow: 0.5,
  controlShift: [70, 45],
};

const rgbaOf = (v, n) => {
  const a = typeof v === 'string' ? new Uint8ClampedArray(Buffer.from(v, 'base64')) : Uint8ClampedArray.from(v);
  if (a.length !== n * 4) throw new Error(`a buffer holds ${a.length} bytes, not ${n * 4} (w x h x 4)`);
  return a;
};
const r2 = x => Math.round(x * 100) / 100;

/**
 * Judge one sample from the page. Pure: no browser.
 * @returns {{ ok: boolean, layers: { name: string, kind: string, ink: number, inside: number, covered: number, spill: number|null, on: number|null,
 *   control: { inside: number, covered: number }, fails: string[], ok: boolean }[] }}
 */
export function judgeSample(sample, T = THRESHOLDS) {
  const { w, h, layers } = sample;
  if (!(w > 0 && h > 0) || !Array.isArray(layers) || !layers.length) throw new Error('a sample needs w, h and at least one layer');
  const [dx, dy] = sample.controlShift ?? T.controlShift;
  const inkOf = new Map();
  const rows = layers.map(L => {
    if (L.kind !== 'print' && L.kind !== 'fill') throw new Error(`layer ${L.name}: kind must be 'print' or 'fill' (got ${L.kind})`);
    const drawn = rgbaOf(L.drawn, w * h);
    const ink = L.base ? diffMask(rgbaOf(L.base, w * h), drawn) : alphaMask(drawn);
    const region = rasterize(L.predicted, w, h);
    const a = agreement(ink, region, w, h, { tolerance: L.tolerance ?? 0 });
    const slid = agreement(ink, rasterize(shiftShapes(L.predicted, dx, dy), w, h), w, h);
    const fails = [];
    const px = count(ink);
    if (px < T.minPixels) fails.push(`only ${px} ink pixels (needs ${T.minPixels}): nothing to judge`);
    let on = null;
    if (L.kind === 'print') {
      if (a.inside < T.insideMin) fails.push(`inside the predicted shapes ${r2(a.inside)} < ${T.insideMin}`);
      if (L.on) {
        const under = inkOf.get(L.on);
        if (!under) fails.push(`on: no earlier layer named ${L.on}`);
        else { on = share(ink, under); if (on < T.onMin) fails.push(`on ${L.on} ${r2(on)} < ${T.onMin}`); }
      }
      if (!(slid.inside < T.controlInsideBelow)) fails.push(`control did not fall: the slid prediction still holds ${r2(slid.inside)} of the ink (needs < ${T.controlInsideBelow})`);
    } else {
      if (a.covered < T.coveredMin) fails.push(`covered ${r2(a.covered)} < ${T.coveredMin}`);
      if (L.spill !== false && a.spill > T.spillMax) fails.push(`spill ${r2(a.spill)} > ${T.spillMax}`);
      if (!(slid.covered < T.controlCoveredBelow)) fails.push(`control did not fall: the slid prediction still covers ${r2(slid.covered)} (needs < ${T.controlCoveredBelow})`);
    }
    inkOf.set(L.name, ink);
    return {
      name: L.name, kind: L.kind, on: L.on ?? null, onShare: on, ink: px, inside: a.inside, covered: a.covered,
      spill: L.kind === 'fill' && L.spill === false ? null : a.spill,
      control: { inside: slid.inside, covered: slid.covered }, fails, ok: !fails.length,
    };
  });
  return { ok: rows.every(r => r.ok), layers: rows };
}

/** One printed line for a layer's numbers, and the control's. */
export function formatLayer(t, r) {
  const n = x => (x == null ? 'not judged' : r2(x));
  const body = r.kind === 'print'
    ? `inside the predicted shapes ${n(r.inside)}${r.on ? `, on ${r.on} ${n(r.onShare)}` : ''}; control (slid) ${n(r.control.inside)}`
    : `covered ${n(r.covered)}, spill ${n(r.spill)}; control (slid) covered ${n(r.control.covered)}`;
  return `t ${t.toFixed(2)} ${r.name} (${r.kind}): ${r.ink} ink px, ${body}  ${r.ok ? 'ok' : `FAIL: ${r.fails.join('; ')}`}`;
}

/**
 * Sample a page that implements the contract. `page` is a Playwright page already on it.
 * @returns {Promise<{ ok: boolean, samples: { t: number, result: ReturnType<typeof judgeSample>|null, error?: string }[] }>}
 */
export async function runPrintCheck(page, { at, log = console.log } = {}) {
  await page.waitForFunction(() => window.__printCheck, null, { timeout: 30000 });
  const times = at?.length ? at : await page.evaluate(() => window.__printCheck.plan());
  if (!times.length) throw new Error('the page planned no sample times');
  const samples = [];
  for (const t of times) {
    try {
      const sample = await page.evaluate(t => window.__printCheck.at(t), t);
      const result = judgeSample(sample);
      for (const r of result.layers) log(formatLayer(t, r));
      samples.push({ t, result });
    } catch (e) {
      log(`t ${t.toFixed(2)}: FAIL: ${e.message}`);
      samples.push({ t, result: null, error: e.message });
    }
  }
  return { ok: samples.every(s => s.result?.ok), samples };
}

async function main() {
  const { opts, positional } = parseArgs(process.argv.slice(2), { query: 'string', width: 'number', height: 'number', at: 'string', engine: 'string' }, { width: 1280, height: 900 });
  if (positional.length !== 1) { console.error('usage: node tools/print-check.mjs <page path> [--query "&k=v"] [--width N] [--height N] [--at t,t] [--engine=chromium|webkit|firefox]'); process.exit(2); }
  if (opts.engine) process.env.SG_ENGINE = opts.engine;
  const { harness } = await import('./lib/component-check.mjs');
  const h = await harness({ axe: 'a measuring tool, not a page' });
  const errors = [];
  const q = (opts.query ?? '').replace(/^[?&]/, '');
  const p = positional[0] + (q ? (positional[0].includes('?') ? '&' : '?') + q : '');
  const { ctx, page } = await h.open(p, { width: opts.width, height: opts.height, errors });
  const run = await runPrintCheck(page, { at: opts.at?.split(',').map(Number) });
  h.check('the page agrees with its own model at every sample', run.ok, `${run.samples.length} samples`);
  h.check('no page errors', !errors.length, errors.join(' | '));
  await ctx.close();
  await h.done();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
