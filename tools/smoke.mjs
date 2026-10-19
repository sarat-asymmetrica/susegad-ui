// The smoke tier: every demo page in one Chromium, a fresh context each. Between `npm run gates`
// (seconds, no browser) and `npm run check` (an hour or more).
//
//   node tools/smoke.mjs                    every demo page the registry lists
//   node tools/smoke.mjs --changed          only the items the diff against main reaches
//   node tools/smoke.mjs --only menu        pages whose path contains "menu" (repeat for more)
//   node tools/smoke.mjs --page /a/b.html   run exactly these pages (repeat), registry or not; the self-check uses it
//   node tools/smoke.mjs --json out.json    also write the full result
//   node tools/smoke.mjs --engine=webkit    another engine
//   node tools/smoke.mjs --reduced          a third pass per page with prefers-reduced-motion: reduce
//   node tools/smoke.mjs --jobs 4           pages in parallel inside the one browser (default 3)
//   node tools/smoke.mjs --list             print the pages and stop
//
// Accessibility depth (tools/lib/a11y.core.js says what each judges). On in every run, one page load each, no extra axe:
//   tree        the accessibility tree: every control and image named, one main, headings, and a diff against tools/a11y-baseline/
//               (a page with no main or heading by design is in tools/a11y-baseline/exempt.json with its reason, printed every run)
//   contrast    DOM text over a canvas, measured against the canvas pixels behind it (4.5:1, 3:1 large)
//   forced      a pass under forced colours (Chromium only): loads clean, axe clean, controls keep a boundary or text, no text vanishes
// Asked for, because each costs six axe runs or more a page:
//   --registers axe in all three registers and both themes (6 cells) on the desktop pass
//   --open      axe on the open states (dialog, drawer, popover, menus), from a named list per page
//   --a11y      both of those
// Other flags:
//   --record-a11y   write the tree baselines instead of comparing (read the trees first; this is the explicit way to accept a change)
//   --no-tree --no-contrast --no-forced --no-a11y   leave a pass out (the self-check does, to keep its fixtures to one fault each)
//
// Per page: loads with 0 console errors, page errors and failed or third-party requests; axe clean
// Every visible sg-scene (also one added after load, up to 4 s in on a page that has a scene, or inside a closed <details> once opened) must fire sg-ready; hidden scenes are listed as "not checked: hidden".
// (WCAG 2.2 AA, once, at 1280 px in the page's default theme and register: a dark-theme or playful-register fault is for tools/matrix.mjs); nothing scrolls sideways at 390 px. Exits 1 on any failure, 2 on bad usage.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { parseArgs } from './lib/args.mjs';
import { REPO_ROOT } from './serve.mjs';
import { unmangleUrl } from './lib/target.mjs';
import { changedFiles } from './lib/changed.mjs';
import { discoverPages, itemsForDiff, skipReason, summarise, formatFailures } from './lib/smoke.core.js';
import { runSmoke } from './lib/smoke.mjs';
import { a11ySummary } from './lib/a11y.core.js';

const SPEC = { changed: 'bool', base: 'string', only: 'list', page: 'list', json: 'string', engine: 'string', reduced: 'bool', 'no-axe': 'bool', jobs: 'number', list: 'bool', quiet: 'bool', 'record-a11y': 'bool', registers: 'bool', open: 'bool', a11y: 'bool', 'no-a11y': 'bool', 'no-tree': 'bool', 'no-contrast': 'bool', 'no-forced': 'bool' };
let opts;
try { ({ opts } = parseArgs(process.argv.slice(2), SPEC)); }
catch (e) { console.error(`${e.message}\nusage: node tools/smoke.mjs [--changed] [--only <text>] [--page <path>] [--json <file>] [--engine=chromium|webkit|firefox] [--reduced] [--no-axe] [--jobs n] [--list] [--record-a11y] [--registers] [--open] [--a11y] [--no-a11y|--no-tree|--no-contrast|--no-forced]`); process.exit(2); }

// tree, contrast and forced colours are on in every run (one load each, no more axe); registers and open cost six axe runs a page, so they are asked for
const off = !!opts['no-a11y'];
const a11y = {
  tree: !off && !opts['no-tree'], record: !!opts['record-a11y'] && !off, contrast: !off && !opts['no-contrast'], forced: !off && !opts['no-forced'],
  registers: !!(opts.a11y || opts.registers), open: !!(opts.a11y || opts.open),
};
if (a11y.record) a11y.tree = true;
const on = Object.entries(a11y).filter(([k, v]) => v && k !== 'record').map(([k]) => k);

const items = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'registry', 'registry.json'), 'utf8')).items;
let pages = opts.page.length
  ? opts.page.map(p => unmangleUrl(p)).map(p => ({ path: p, item: p, type: 'page' }))
  : discoverPages({ items, exists: p => fs.existsSync(path.join(REPO_ROOT, p)) });
const skipped = pages.filter(skipReason);
pages = pages.filter(p => !skipReason(p));
const total = pages.length;
let scope = `all ${total} pages`;

if (opts.changed) {
  const diff = changedFiles({ cwd: REPO_ROOT, base: opts.base });
  const hit = itemsForDiff({ files: diff.files, items });
  pages = pages.filter(p => hit.names.has(p.item));
  scope = hit.all ? `all ${pages.length} pages (${hit.reason})` : `${pages.length} of ${total} pages reached by ${diff.files.length} changed file(s) against ${diff.base}`;
}
if (opts.only.length) {
  pages = pages.filter(p => opts.only.some(t => p.path.includes(t)));
  scope += `, narrowed to ${pages.length} by --only`;
}

if (opts.list) { for (const p of pages) console.log(`${p.type.padEnd(10)} ${p.path}`); console.log(`${pages.length} pages`); process.exit(0); }
if (!pages.length) { console.log(`smoke: nothing to run (${scope})`); if (opts.json) writeFileSync(opts.json, JSON.stringify({ scope, pages: 0, ok: true, results: [] }, null, 2)); process.exit(0); }

const cpuTimes = () => os.cpus().reduce((a, c) => { const t = c.times; a.busy += t.user + t.nice + t.sys + t.irq; a.total += t.user + t.nice + t.sys + t.irq + t.idle; return a; }, { busy: 0, total: 0 });
const pct = (a, b) => Math.round((100 * (b.busy - a.busy)) / Math.max(1, b.total - a.total));
// the machine's own load before we start: a number taken under load is a guess, so say what the load was
const c0 = cpuTimes();
await new Promise(r => setTimeout(r, 1500));
const c1 = cpuTimes();
const before = pct(c0, c1);

for (const p of skipped) console.log(`skipped ${p.path}: ${skipReason(p)}`);
console.log(`smoke: ${scope}; ${opts.engine ?? process.env.SG_ENGINE ?? 'chromium'}, ${opts.jobs ?? 3} in parallel${on.length ? `; a11y: ${on.join(', ')}${a11y.record ? ' (recording baselines)' : ''}` : ''}; CPU ${before}% busy before the run`);
const run = await runSmoke({
  pages, jobs: opts.jobs ?? 3, reduced: opts.reduced, axe: !opts['no-axe'], engine: opts.engine, a11y,
  onResult: (r, done, n) => { if (!opts.quiet) console.log(`${String(done).padStart(String(n).length)}/${n} ${r.failures.length ? 'FAIL' : 'ok  '} ${r.path}`); },
});
const c2 = cpuTimes();
const during = pct(c1, c2);
const sum = summarise(run.results);

console.log('');
const table = formatFailures(run.results);
if (table) console.log(table + '\n');
const unchecked = run.results.filter(r => r.notChecked?.length);
for (const r of unchecked) console.log(`not checked: hidden  ${r.path}  (${r.notChecked.join(', ')})`);
if (unchecked.length) console.log('');
if (on.length) for (const line of a11ySummary(run.results, a11y)) console.log(line);
console.log(`smoke: ${sum.passed}/${sum.pages} pages clean${sum.failed ? `, ${sum.failed} failed (${Object.entries(sum.kinds).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}${unchecked.length ? `, ${unchecked.length} with scenes not checked (hidden)` : ''} in ${run.seconds.toFixed(0)} s on ${run.browser}; CPU ${during}% busy during the run (${before}% before it, ${os.cpus().length} cores)`);

if (opts.json) {
  try {
    writeFileSync(opts.json, JSON.stringify({ scope, skipped: skipped.map(p => ({ path: p.path, reason: skipReason(p) })), engine: run.engine, browser: run.browser, seconds: Math.round(run.seconds), cpuBusyBefore: before, cpuBusyDuring: during, cores: os.cpus().length, ...sum, results: run.results }, null, 2));
    console.log(`result written to ${opts.json}`);
  } catch (e) { console.error(`smoke: could not write ${opts.json}: ${e.code ?? e.message}`); process.exit(1); }
}
process.exit(sum.ok ? 0 : 1);
