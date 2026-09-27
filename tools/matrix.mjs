// The register matrix: quiet / warm / playful x desktop / phone x light / dark,
// plus one reduced-motion cell per register. For each cell: a screenshot, console
// and page errors, failed requests, a horizontal overflow check, and at phone width
// a pointer-mapping check.
//
//   node tools/matrix.mjs --scene kolam [--seed 3] [--param k=v] [--content] [--at 2]
//   node tools/matrix.mjs --url /apps/docs/index.html
//
//   --at S       seconds to let the piece run after it is ready (default 2)
//   --out DIR    default .shots/matrix/<target>
//   --jobs N     cells run in parallel (default 3)
//   --no-js      pages only: JavaScript off; ready at load + fonts; output in <target>-nojs
//
// Writes <out>/index.json and a contact sheet <out>/index.html. Exits non-zero if any cell fails.
//
// Pointer check: at phone width it taps a known fraction of the scene and reads
// window.__piece.lastPointer ({ x, y } in logical units) and the logical size from
// __piece.meta ({ W, H }). A scene that exposes neither is reported "not run", with the reason.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { TARGET_SPEC, REGISTERS, THEMES, targetFrom, targetSlug } from './lib/target.mjs';
import { session, openTarget, waitReady, errorCount, shoot, PHONE, DESKTOP } from './lib/browser.mjs';
import { renderSheet } from './lib/sheet.mjs';

const SPEC = { ...TARGET_SPEC, at: 'number', out: 'string', jobs: 'number' };
let parsed;
try { parsed = parseArgs(process.argv.slice(2), SPEC, { at: 2, jobs: 3 }); }
catch (e) { console.error(e.message); process.exit(2); }
const { opts, positional } = parsed;
let base;
try { base = targetFrom(opts, positional); } catch (e) { console.error(e.message); process.exit(2); }
if (!base.scene && !base.url) { console.error('usage: node tools/matrix.mjs --scene <name> | --url <path>'); process.exit(2); }
if (base.register || base.theme) console.log('note: --register and --theme are ignored; the matrix covers all of them');
const slug = targetSlug(base) + (base.noJs ? '-nojs' : '');
const out = opts.out || path.join('.shots', 'matrix', slug);
fs.mkdirSync(out, { recursive: true });

/**
 * Fractions of the scene the pointer check may tap, in order. Off-centre and unequal on
 * purpose, so a transposed or mirrored mapping fails. The first one not covered by slotted
 * reading content is used.
 */
const TAPS = [{ fx: 0.72, fy: 0.28 }, { fx: 0.28, fy: 0.22 }, { fx: 0.82, fy: 0.7 }, { fx: 0.9, fy: 0.12 }];
/** Allowed error in logical units, as a share of the logical size. */
const POINTER_TOLERANCE = 0.02;

const cells = [];
for (const register of REGISTERS) {
  for (const [viewName, view] of [['desktop', DESKTOP], ['phone', PHONE]]) {
    for (const theme of THEMES) cells.push({ id: `${register}-${viewName}-${theme}`, register, viewName, view, theme, reduced: false });
  }
  cells.push({ id: `${register}-desktop-light-reduced`, register, viewName: 'desktop', view: DESKTOP, theme: 'light', reduced: true });
}

const s = await session();
const started = new Date();

async function runCell(c) {
  const t = { ...base, register: c.register, theme: c.theme };
  const result = {
    id: c.id, register: c.register, view: c.viewName, width: c.view.width, theme: c.theme, reduced: c.reduced,
    shot: `${c.id}.png`, ready: null, errors: null, overflow: null, pointer: null, pass: false,
  };
  const { context, page, log } = await openTarget(s, t, { ...c.view, reduced: c.reduced });
  try {
    const ready = await waitReady(page, t);
    result.ready = ready;
    if (ready.ok) await page.waitForTimeout(opts.at * 1000);

    const shotPath = path.join(out, result.shot);
    await shoot(page, t.scene ? '#box' : null, shotPath);

    result.overflow = await page.evaluate(() => {
      const sw = document.documentElement.scrollWidth, iw = window.innerWidth;
      return { scrollWidth: sw, innerWidth: iw, pass: sw <= iw };
    });

    if (c.viewName !== 'phone') result.pointer = { status: 'n/a', reason: 'checked at phone width only' };
    else if (!ready.ok) result.pointer = { status: 'not run', reason: 'target not ready' };
    else if (!t.scene && !(await page.evaluate(() => !!window.__piece))) {
      result.pointer = { status: 'n/a', reason: 'page has no window.__piece to map the pointer onto' };
    }
    else result.pointer = await pointerCheck(page);

    result.errors = {
      console: [...log.consoleErrors], page: [...log.pageErrors], requests: [...log.failedRequests],
      warnings: [...log.warnings], count: errorCount(log),
    };
    result.pass = ready.ok && result.errors.count === 0 && result.overflow.pass && result.pointer.status !== 'fail';
  } catch (e) {
    result.errors = { console: [], page: [], requests: [], warnings: [], harness: e.message, count: 1 };
  } finally {
    await context.close();
  }
  return result;
}

async function pointerCheck(page) {
  const probe = await page.evaluate(() => {
    const p = window.__piece;
    const meta = p?.meta || p?.definition?.meta;
    return { hasPointer: !!p && 'lastPointer' in p, W: meta?.W, H: meta?.H };
  });
  if (!probe.hasPointer) return { status: 'not run', reason: 'window.__piece.lastPointer is not exposed' };
  if (!probe.W || !probe.H) return { status: 'not run', reason: 'window.__piece.meta.W / H is not exposed' };
  await page.evaluate(() => window.__piece.scrollIntoView({ block: 'nearest' }));
  // The drawing surface, not the host: at phone width the host can be taller than the drawing
  // (a reading panel below it, a controls row), and the fractions are fractions of the drawing.
  const b = await page.evaluate(() => {
    const p = window.__piece, sr = p.shadowRoot;
    const surface = sr?.querySelector('[part~="stage"]') || sr?.querySelector('canvas, svg') || p;
    const r = surface.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height, surface: surface === p ? 'host' : surface.getAttribute('part') || surface.localName };
  });
  let tap = null;
  for (const c of TAPS) {
    const x = b.x + c.fx * b.width, y = b.y + c.fy * b.height;
    const free = await page.evaluate(([x, y]) => {
      const p = window.__piece;
      if (document.elementFromPoint(x, y) !== p) return false; // slotted content or something else on top
      // Inside an open shadow root, the reading panel takes its own pointer events: tap beside it.
      const inner = p.shadowRoot?.elementFromPoint(x, y);
      return !inner?.closest('[part~="panel"], [part~="reading"], button');
    }, [x, y]);
    if (free) { tap = { ...c, x, y }; break; }
  }
  if (!tap) return { status: 'not run', reason: 'every candidate tap point is covered by slotted content' };
  const where = () => page.evaluate(() => {
    const r = window.__piece.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, scrollX, scrollY, zoom: visualViewport?.scale ?? 1 };
  });
  const before = await where();
  await page.touchscreen.tap(tap.x, tap.y);
  await page.waitForTimeout(100);
  const got = await page.evaluate(() => window.__piece.lastPointer);
  const after = await where();
  const expected = { x: tap.fx * probe.W, y: tap.fy * probe.H };
  const moved = ['left', 'top', 'width', 'height', 'scrollX', 'scrollY', 'zoom'].some(k => Math.abs(before[k] - after[k]) > 0.5);
  const diag = { tap: { fx: tap.fx, fy: tap.fy, x: tap.x, y: tap.y }, surface: { ...b }, before, ...(moved ? { after } : {}) };
  if (!got || !Number.isFinite(got.x) || !Number.isFinite(got.y)) {
    return { status: 'fail', reason: 'the tap did not reach the scene', expected, got: got ?? null, ...diag };
  }
  const err = { x: Math.abs(got.x - expected.x) / probe.W, y: Math.abs(got.y - expected.y) / probe.H };
  const ok = err.x <= POINTER_TOLERANCE && err.y <= POINTER_TOLERANCE;
  return {
    status: ok ? 'pass' : 'fail',
    reason: ok ? `tap at (${tap.fx}, ${tap.fy}) mapped within ${POINTER_TOLERANCE * 100}%`
      : `the tap landed at the wrong logical position${moved ? ' (the scene moved or the page scrolled during the tap)' : ''}`,
    expected, got: { x: got.x, y: got.y, inside: got.inside, keyboard: got.keyboard }, error: err, ...diag,
  };
}

const results = new Array(cells.length);
let next = 0;
await Promise.all(Array.from({ length: Math.max(1, opts.jobs) }, async () => {
  while (next < cells.length) {
    const i = next++;
    results[i] = await runCell(cells[i]);
    const r = results[i];
    const bits = [
      r.ready?.ok ? 'ready' : `NOT READY (${r.ready?.reason ?? r.errors?.harness})`,
      `errors ${r.errors?.count ?? '?'}`,
      `overflow ${r.overflow ? (r.overflow.pass ? 'none' : `${r.overflow.scrollWidth} > ${r.overflow.innerWidth}`) : '?'}`,
      `pointer ${r.pointer?.status ?? '?'}`,
    ];
    console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.id.padEnd(30)} ${bits.join(' · ')}`);
    for (const e of [...(r.errors?.console ?? []), ...(r.errors?.page ?? []), ...(r.errors?.requests ?? [])]) console.log(`      ${e}`);
  }
}));

const summary = {
  cells: results.length,
  passed: results.filter(r => r.pass).length,
  failed: results.filter(r => !r.pass).map(r => r.id),
  pointer: results.filter(r => r.view === 'phone').map(r => `${r.id}: ${r.pointer?.status}${r.pointer?.status === 'not run' ? ` (${r.pointer.reason})` : ''}`),
};
const report = {
  target: base.scene ? { scene: base.scene, seed: base.seed ?? null, params: base.params, content: base.content } : { url: base.url, javascript: !base.noJs },
  chromium: s.version,
  date: started.toISOString(),
  settleSeconds: opts.at,
  summary,
  cells: results,
};
await s.done();

fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(out, 'index.html'), renderSheet(report, slug));
console.log(`\n${summary.passed}/${summary.cells} cells pass`);
const notRun = results.filter(r => r.pointer?.status === 'not run');
if (notRun.length) console.log(`pointer check not run in ${notRun.length} cell(s): ${notRun[0].pointer.reason}`);
console.log(`wrote ${path.join(out, 'index.json')}`);
console.log(`contact sheet ${path.resolve(out, 'index.html')}`);
process.exit(summary.failed.length ? 1 : 0);
