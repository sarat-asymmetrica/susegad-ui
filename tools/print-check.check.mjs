// print-check (tools/print-check.mjs) held to account: green on a page that draws where it predicts, and red,
// for the right reason, on each planted fault, so a green from it means something (A10). The fixture page is
// tools/fixtures/print-check/index.html; its faults are query flags.
//
//   node tools/print-check.check.mjs        (by hand: it is not under packages/, so `npm run check` does not pick it up)

import { harness } from './lib/component-check.mjs';
import { runPrintCheck, judgeSample, THRESHOLDS } from './print-check.mjs';

const { check, open, done } = await harness({ axe: 'a measuring tool, not a page' });
const PAGE = '/tools/fixtures/print-check/index.html';

async function run(query = '') {
  const lines = [];
  const { ctx, page, errors } = await open(PAGE + query, { width: 640, height: 300 });
  const r = await runPrintCheck(page, { log: l => lines.push(l) });
  await ctx.close();
  return { ...r, lines, errors };
}
const failsOf = r => r.samples.flatMap(s => s.result?.layers.flatMap(l => l.fails.map(f => `${l.name}: ${f}`)) ?? [s.error]);
const first = r => failsOf(r)[0] ?? 'none';

// green as drawn
const good = await run();
check('as drawn: every layer at every sample agrees with its prediction', good.ok && good.samples.length === 3, `${good.samples.length} samples; ${good.lines[1]}`);
check('as drawn: the control falls at every sample', good.samples.every(s => s.result.layers.every(l => (l.kind === 'print' ? l.control.inside < THRESHOLDS.controlInsideBelow : l.control.covered < THRESHOLDS.controlCoveredBelow))), good.lines.filter((_, i) => i % 2 === 0).map(l => l.match(/control \(slid\) covered [\d.]+/)?.[0]).join(' | '));
check('as drawn: the page raised no errors', !good.errors.length, good.errors.join(' | '));

// red on each planted fault, and for the reason it was planted
const off = await run('?offset=80');
check('print drawn 80 px off its box: red, on "inside the predicted shapes"', !off.ok && /print: inside the predicted shapes/.test(first(off)), first(off));
const cloth = await run('?cloth=60');
check('cloth drawn 60 px off its rectangle: red, on spill or coverage', !cloth.ok && /cloth: (spill|covered)/.test(first(cloth)), first(cloth));
const wide = await run('?wide=1');
check('a prediction that covers everything is red: the control could not fall', !wide.ok && /control did not fall/.test(failsOf(wide).join(' ')), failsOf(wide).find(f => /control/.test(f)));
const tiny = await run('?tiny=1');
check('a print of a few pixels is red: nothing to judge is not a pass', !tiny.ok && /nothing to judge/.test(failsOf(tiny).join(' ')), failsOf(tiny).find(f => /nothing/.test(f)));

// the judge on its own: the contract's edges
const W = 40, H = 20, blank = () => new Uint8ClampedArray(W * H * 4).fill(255);
const ink = (b, x0, x1) => { for (let y = 5; y < 15; y++) for (let x = x0; x < x1; x++) b.set([0, 0, 0, 255], (y * W + x) * 4); return b; };
const sample = (predicted, extra = {}) => ({ w: W, h: H, controlShift: [20, 0], layers: [{ name: 'p', kind: 'print', base: [...blank()], drawn: [...ink(blank(), 5, 25)], predicted, ...extra }] });
const lowPx = { ...THRESHOLDS, minPixels: 10 };
check('judge: ink inside its box is ok when the slid box misses it', judgeSample(sample([{ x: 5, y: 5, w: 20, h: 10 }]), lowPx).ok);
check('judge: ink outside its box is red', !judgeSample(sample([{ x: 30, y: 5, w: 8, h: 10 }]), lowPx).ok);
check('judge: a buffer of the wrong size is refused, not misread', (() => { try { judgeSample({ ...sample([{ x: 0, y: 0, w: 1, h: 1 }]), w: 41 }); return false; } catch (e) { return /bytes/.test(e.message); } })());
check('judge: "on" a layer that does not exist is red', !judgeSample(sample([{ x: 5, y: 5, w: 20, h: 10 }], { on: 'nothing' }), lowPx).ok);

await done();
