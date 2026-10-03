// One labelled PNG of a piece: quiet / warm / playful down the side; across the top, the page at
// 1440 px (light, dark), at 390 px (light, dark) and with reduced motion. Fifteen cells, one file,
// so a reviewer can look at the whole matrix at once. The matrix tool (tools/matrix.mjs) shoots a
// piece at rest and writes many files; this one can first drive the page to the moment the piece
// exists for (an open drawer, a menu mid-open) and then tiles the result.
//
//   node tools/contact-sheet.mjs --url /packages/components/drawer/demo.html --name drawer \
//        --act "click:a[data-sg-drawer=rooms]" --act "wait-for:#rooms dialog[open]" --act "settle"
//
//   --url PATH      the page to shoot (or --scene NAME, as shot.mjs)
//   --name NAME     the label and file name (default: the url's slug)
//   --act STEP      a step run, in order, before every shot (repeat). Steps:
//                     click:SELECTOR      click it
//                     press:KEY           press a key (Tab, Escape, Shift+Tab ...)
//                     hover:SELECTOR      move the pointer onto it
//                     wait:MS             wait
//                     wait-for:SELECTOR   wait until it exists and is visible
//                     settle              wait for every finite animation to finish (CSS and WAAPI; ones that loop forever are left running)
//                     eval:JS             run an expression in the page
//   --selector SEL  shoot this element instead of the viewport
//   --full          shoot the full page height (cells are scaled to fit; tall pages get small)
//   --at S          seconds to let the piece run after it is ready, before the steps (default 1)
//   --out DIR       default docs/shots/front
//   --widths A,B    desktop and phone widths (default 1440,390)
//
// The sheet is <out>/<name>-contact.png and <out>/<name>-contact.json (errors per cell). Exits
// non-zero when any cell had a console error, a page error or a failed request.
//
// A step that cannot run (the selector is missing in a register) is recorded in that cell's label
// as "step failed", so a missing piece is visible in the sheet instead of reading as a blank shot.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { TARGET_SPEC, REGISTERS, targetFrom, targetSlug } from './lib/target.mjs';
import { session, openTarget, waitReady, errorCount, shoot } from './lib/browser.mjs';

const SPEC = { ...TARGET_SPEC, name: 'string', act: 'list', selector: 'string', full: 'bool', at: 'number', out: 'string', widths: 'string' };
let parsed;
try { parsed = parseArgs(process.argv.slice(2), SPEC, { at: 1, out: path.join('docs', 'shots', 'front'), widths: '1440,390' }); }
catch (e) { console.error(e.message); process.exit(2); }
const { opts, positional } = parsed;
let base;
try { base = targetFrom(opts, positional); } catch (e) { console.error(e.message); process.exit(2); }
if (!base.scene && !base.url) { console.error('usage: node tools/contact-sheet.mjs --url <path> | --scene <name> [--act step]...'); process.exit(2); }
const name = opts.name || targetSlug(base);
const [wide, narrow] = opts.widths.split(',').map(Number);
fs.mkdirSync(opts.out, { recursive: true });

const DESKTOP = { width: wide, height: 900, dpr: 1, touch: false };
const PHONE = { width: narrow, height: 844, dpr: 2, touch: true };
const COLUMNS = [
  { id: 'wide-light', label: `${wide} light`, view: DESKTOP, theme: 'light', reduced: false },
  { id: 'wide-dark', label: `${wide} dark`, view: DESKTOP, theme: 'dark', reduced: false },
  { id: 'phone-light', label: `${narrow} light`, view: PHONE, theme: 'light', reduced: false },
  { id: 'phone-dark', label: `${narrow} dark`, view: PHONE, theme: 'dark', reduced: false },
  { id: 'reduced', label: `${wide} light, reduced motion`, view: DESKTOP, theme: 'light', reduced: true },
];

/** Run one step; returns '' or the reason it failed. */
async function runStep(page, step) {
  const i = step.indexOf(':');
  const kind = i < 0 ? step : step.slice(0, i), arg = i < 0 ? '' : step.slice(i + 1);
  try {
    if (kind === 'click') await page.click(arg, { timeout: 5000 });
    else if (kind === 'press') await page.keyboard.press(arg);
    else if (kind === 'hover') await page.hover(arg, { timeout: 5000 });
    else if (kind === 'wait') await page.waitForTimeout(Number(arg) || 0);
    else if (kind === 'wait-for') await page.waitForSelector(arg, { state: 'visible', timeout: 5000 });
    else if (kind === 'settle') {
      await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
      await page.waitForTimeout(60);
    } else if (kind === 'eval') await page.evaluate(arg);
    else return `unknown step "${step}"`;
    return '';
  } catch (e) { return `${step}: ${e.message.split('\n')[0]}`; }
}

const s = await session();
const cells = [];
for (const register of REGISTERS) {
  for (const c of COLUMNS) {
    const t = { ...base, register, theme: c.theme };
    const cell = { register, column: c.id, label: `${register} / ${c.label}`, file: path.join(opts.out, `${name}.${register}.${c.id}.png`), failed: [], errors: 0 };
    const { context, page, log } = await openTarget(s, t, { ...c.view, reduced: c.reduced });
    page.setDefaultTimeout(8000);
    // a cell that hangs (a screenshot that never settles) is recorded as failed instead of stalling the sheet
    const watchdog = setTimeout(() => context.close().catch(() => {}), 60000);
    try {
      const ready = await waitReady(page, t);
      if (!ready.ok) cell.failed.push(`not ready: ${ready.reason}`);
      await page.waitForTimeout(opts.at * 1000);
      for (const step of opts.act) { const why = await runStep(page, step); if (why) { cell.failed.push(why); break; } }
      if (opts.full) {
        fs.writeFileSync(cell.file, await page.screenshot({ fullPage: true, animations: 'allow' }));
      } else {
        await shoot(page, opts.selector ?? null, cell.file);
      }
      cell.errors = errorCount(log);
      cell.errorText = [...log.consoleErrors, ...log.pageErrors, ...log.failedRequests];
    } catch (e) { cell.failed.push(e.message.split('\n')[0]); }
    finally { clearTimeout(watchdog); await context.close().catch(() => {}); }
    cells.push(cell);
    console.log(`${cell.failed.length || cell.errors ? 'FAIL' : 'ok  '}  ${cell.label.padEnd(44)} ${[...cell.failed, ...(cell.errorText ?? [])].join(' | ')}`);
  }
}

// Tile: one row per register, one column per view. Every cell is fitted into the same box, scaled
// down, never up, and labelled above. The drawing is done in a blank same-origin page.
const BOX = { w: 420, h: 300 }, GAP = 14, LABEL = 20, SIDE = 70, HEAD = 46;
const work = await s.browser.newContext();
const wp = await work.newPage();
await wp.goto(`${s.base}/tools/harness/blank.html`);
const png = await wp.evaluate(async ({ cells, rows, cols, BOX, GAP, LABEL, SIDE, HEAD, title, files }) => {
  const W = SIDE + cols.length * (BOX.w + GAP) + GAP, H = HEAD + rows.length * (BOX.h + LABEL + GAP) + GAP;
  const c = new OffscreenCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#f4efe4'; g.fillRect(0, 0, W, H);
  g.textBaseline = 'top'; g.imageSmoothingQuality = 'high';
  g.font = '600 15px ui-monospace, Consolas, monospace'; g.fillStyle = '#1d2742'; g.fillText(title, GAP, 14);
  for (let r = 0; r < rows.length; r++) {
    const y0 = HEAD + r * (BOX.h + LABEL + GAP);
    g.font = '600 13px ui-monospace, Consolas, monospace'; g.fillStyle = '#1d2742';
    g.save(); g.translate(GAP, y0 + LABEL + BOX.h / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(rows[r], 0, 0); g.restore();
    for (let k = 0; k < cols.length; k++) {
      const cell = cells[r * cols.length + k], x0 = SIDE + k * (BOX.w + GAP);
      g.textAlign = 'left'; g.font = '400 12px ui-monospace, Consolas, monospace';
      g.fillStyle = cell.failed.length || cell.errors ? '#b8412a' : '#5d6378';
      g.fillText(cell.failed.length ? `${cols[k]}  (step failed)` : cell.errors ? `${cols[k]}  (${cell.errors} errors)` : cols[k], x0, y0 + 3);
      g.fillStyle = '#e6dfd0'; g.fillRect(x0, y0 + LABEL, BOX.w, BOX.h);
      const b64 = files[r * cols.length + k];
      if (!b64) continue;
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const k2 = Math.min(1, BOX.w / bmp.width, BOX.h / bmp.height), w = bmp.width * k2, h = bmp.height * k2;
      g.drawImage(bmp, x0 + (BOX.w - w) / 2, y0 + LABEL + (BOX.h - h) / 2, w, h);
      g.strokeStyle = '#d9d1c0'; g.strokeRect(x0 + 0.5, y0 + LABEL + 0.5, BOX.w - 1, BOX.h - 1);
    }
  }
  const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}, {
  cells, rows: REGISTERS, cols: COLUMNS.map(c => c.label), BOX, GAP, LABEL, SIDE, HEAD,
  title: `${name}   ${base.url ?? `scene ${base.scene}`}   ${opts.act.length ? `after: ${opts.act.join(', ')}` : 'at rest'}   ${new Date().toISOString().slice(0, 10)}`,
  files: cells.map(c => (fs.existsSync(c.file) ? fs.readFileSync(c.file).toString('base64') : null)),
});
await work.close();
await s.done();

const sheet = path.join(opts.out, `${name}-contact.png`);
fs.writeFileSync(sheet, Buffer.from(png, 'base64'));
for (const c of cells) fs.rmSync(c.file, { force: true });
fs.writeFileSync(path.join(opts.out, `${name}-contact.json`), JSON.stringify({ name, target: base.url ?? base.scene, act: opts.act, cells: cells.map(({ file, ...c }) => c) }, null, 2));
const bad = cells.filter(c => c.failed.length || c.errors);
console.log(`\n${cells.length - bad.length}/${cells.length} cells clean`);
console.log(`contact sheet ${path.resolve(sheet)}`);
process.exit(bad.length ? 1 : 0);
