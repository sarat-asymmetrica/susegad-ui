// The evidence pack: gather once, look at one picture (docs/requests/2026-10-02-lighter-gate.md, B).
//
//   node tools/review-pack.mjs <item...>        items by name (scene-kolam, drawer, enquiry)
//   node tools/review-pack.mjs --changed        the items gate-tier's diff names
//   node tools/review-pack.mjs scene-mithagar --out .shots/pack
//
// For each piece it writes .shots/pack/<slug>/:
//   matrix/            the 15-cell run (tools/matrix.mjs), every cell a PNG with its verdict
//   <slug>-sheet.png   all 15 cells tiled into ONE labelled image, each tagged with its verdict
//   <slug>-open.png    the open states, for interactive pieces (second sheet)
//   <slug>-warm-strip.png + <slug>-warm-facts.json   the warm strip with --facts, for anything that moves
//   axe.json, perf.json, tests.json
//   pack.json, pack.md the whole pack's summary: axe per register/theme, the perf ratio to
//                      Paus with CPU busy, budget measured/declared, the item's own tests,
//                      and the commit hash of the full-suite run
//
// It re-runs the real tools as subprocesses (matrix, strip, axe, perf), so the pack is the
// same evidence a review would gather by hand, minus the by-hand. Exits non-zero if any
// gathered piece failed its own verdict.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownerOf } from './gate-tier.core.js';
import { targetFrom } from './lib/target.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const changed = argv.includes('--changed');
const outFlag = argv.indexOf('--out');
const outRoot = (outFlag > 0 && argv[outFlag + 1]) || path.join('.shots', 'pack');
const items = argv.filter(a => !a.startsWith('--') && a !== outRoot);
if (argv.includes('--out')) items.splice(items.indexOf(outRoot), 1);

const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'registry', 'registry.json'), 'utf8'));
const regItems = registry.items;

if (changed) {
  const git = (...a) => spawnSync('git', a, { cwd: REPO, encoding: 'utf8' }).stdout.trim();
  const paths = git('diff', '--name-only', 'main...HEAD').split('\n').filter(Boolean);
  const seen = new Set();
  for (const p of paths) {
    const item = ownerOf(p, regItems);
    if (item && !seen.has(item.name)) { seen.add(item.name); items.push(item.name); }
  }
  console.log(`--changed: ${items.length} item(s) from the diff: ${items.join(', ') || '(none)'}`);
}
if (!items.length) { console.error('usage: node tools/review-pack.mjs <item...> | --changed'); process.exit(2); }

const INTERACTIVE_OPEN_STEPS = {
  drawer: { steps: ['click:a[data-sg-drawer=rooms]', 'wait-for:dialog[open]'], what: 'the rooms drawer, open' },
  dialog: { steps: ['click:[data-sg-dialog=confirm]', 'wait-for:dialog[open]'], what: 'the confirm dialog, open' },
};

const byName = new Map(regItems.map(i => [i.name, i]));
const results = [];
const run = (label, cmd, args) => {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [cmd, ...args], { cwd: REPO, encoding: 'utf8', timeout: 600000, env: { ...process.env } });
  const out = (r.stdout || '') + (r.stderr || '');
  console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'}  ${label}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return { label, cmd, args, status: r.status, out, seconds: (Date.now() - t0) / 1000 };
};

for (const name of items) {
  const item = byName.get(name);
  if (!item) { console.error(`I do not have anything called "${name}".`); process.exit(2); }
  const slug = item.name.replace(/^scene-/, '');
  const dir = path.join(outRoot, slug);
  fs.mkdirSync(path.join(REPO, dir), { recursive: true });
  const pack = { item: item.name, slug, dir, commit: null, matrix: null, open: null, strip: null, axe: null, perf: null, tests: null, notes: [] };

  // the target: a scene through the harness, everything else its own page
  let target;
  if (item.type === 'scene') target = `--scene ${slug}`;
  else {
    const candidates = { component: `packages/components/${slug}/demo.html`, recipe: `packages/recipes/${slug}/index.html`, surface: `packages/surfaces/${slug}/demo.html` };
    const page = candidates[item.type];
    if (!page || !fs.existsSync(path.join(REPO, page))) {
      pack.notes.push(`no demo page found for ${item.type} ${item.name}; visual cells skipped`);
      console.log(`note: no demo page for ${item.name}; writing the paper part of the pack only`);
    } else target = `--url ${page}`;
  }

  // 1. the matrix: 15 cells, one verdict each
  if (target) {
    const m = run(`matrix ${slug}`, 'tools/matrix.mjs', [...target.split(' '), '--out', path.join(dir, 'matrix')]);
    pack.matrix = { seconds: m.seconds, status: m.status };
    const indexFile = path.join(REPO, dir, 'matrix', 'index.json');
    if (fs.existsSync(indexFile)) {
      const cells = JSON.parse(fs.readFileSync(indexFile, 'utf8')).cells ?? JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      pack.matrix.cells = cells.length;
      pack.matrix.failed = cells.filter(c => !c.pass).map(c => c.id);
      pack.sheet = await tileSheet({ slug, dir, cells });
    } else pack.notes.push(`matrix wrote no index.json (${m.status})`);
  }

  // 2. the open states, for interactive pieces
  const open = INTERACTIVE_OPEN_STEPS[slug];
  if (target && open) {
    const cs = run(`open states ${slug}`, 'tools/contact-sheet.mjs', [
      ...target.split(' '), '--name', `${slug}-open`,
      ...open.steps.flatMap(s => ['--act', s]), '--at', '1',
      '--out', path.join(dir, 'open'),
    ]);
    pack.open = { seconds: cs.seconds, status: cs.status, what: open.what, sheet: `${dir}/open/${slug}-open-contact.png` };
  } else if (target && item.type === 'component') {
    pack.notes.push('no known open-state steps for this component; the second sheet was skipped');
  }

  // 3. the warm strip with facts, for anything that moves
  if (item.type === 'scene' || item.type === 'surface') {
    const st = run(`warm strip ${slug}`, 'tools/strip.mjs', [slug, '--register', 'warm', '--facts', '--out', dir]);
    pack.strip = { seconds: st.seconds, status: st.status };
    const facts = st.out.split('\n').filter(l => /frozen|jump|rest|facts/i.test(l)).slice(-8);
    pack.strip.facts = facts;
  } else pack.notes.push('not a scene or surface: no warm strip (one strip if it moves, the reviewer decides)');

  // 4. axe, per register and theme
  if (target) {
    const ax = run(`axe ${slug}`, 'tools/axe.mjs', [...target.split(' '), '--json']);
    pack.axe = { seconds: ax.seconds, status: ax.status };
    try {
      const j = JSON.parse(ax.out.slice(ax.out.indexOf('{'), ax.out.lastIndexOf('}') + 1));
      pack.axe.runs = (j.runs ?? j).map?.(r => ({ register: r.register, theme: r.theme, violations: r.violations.length, incomplete: r.incomplete.length, ids: r.violations.map(v => v.id) }))
        ?? { raw: 'see axe.json' };
      fs.writeFileSync(path.join(REPO, dir, 'axe.json'), JSON.stringify(j, null, 2));
    } catch { fs.writeFileSync(path.join(REPO, dir, 'axe.json'), ax.out); pack.axe.runs = 'axe output kept in axe.json (not parsed)'; }
  }

  // 5. perf, against Paus, with the CPU busy
  if (target) {
    const pf = run(`perf ${slug}`, 'tools/perf.mjs', [...target.split(' '), '--json']);
    pack.perf = { seconds: pf.seconds, status: pf.status };
    try {
      const j = JSON.parse(pf.out.slice(pf.out.indexOf('{'), pf.out.lastIndexOf('}') + 1));
      pack.perf.result = j;
      fs.writeFileSync(path.join(REPO, dir, 'perf.json'), JSON.stringify(j, null, 2));
    } catch { fs.writeFileSync(path.join(REPO, dir, 'perf.json'), pf.out); }
  }

  // 6. the item's own tests (found beside the piece on disk; the index lists only what the CLI copies),
  //    and the full-suite commit hash
  const itemDir = item.manifest ? path.dirname(item.manifest) : null;
  const testFiles = itemDir
    ? fs.readdirSync(path.join(REPO, itemDir), { withFileTypes: true })
        .filter(e => e.isFile() && /\.test\.[cm]?[jt]s$/.test(e.name)).map(e => `${itemDir}/${e.name}`)
    : [];
  if (testFiles.length) {
    const t0 = Date.now();
    const ts = spawnSync(process.execPath, ['--test', ...testFiles], { cwd: REPO, encoding: 'utf8', timeout: 300000 });
    const out = (ts.stdout || '') + (ts.stderr || '');
    const tail = out.trim().split('\n').slice(-6);
    pack.tests = { seconds: (Date.now() - t0) / 1000, status: ts.status, tail };
    console.log(`${ts.status === 0 ? 'ok  ' : 'FAIL'}  tests ${slug}  (${pack.tests.seconds.toFixed(1)}s)`);
    fs.writeFileSync(path.join(REPO, dir, 'tests.json'), JSON.stringify({ files: testFiles, status: ts.status, tail }, null, 2));
  } else pack.tests = { status: null, tail: ['no test files in the item'] };
  pack.commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim();

  writePackMd(pack);
  fs.writeFileSync(path.join(REPO, dir, 'pack.json'), JSON.stringify(pack, null, 2));
  results.push(pack);
  console.log(`\npack ${item.name}: ${dir}/`);
  console.log(pack.sheet ? `  sheet ${pack.sheet}` : '  (no sheet: see notes)');
}

const bad = results.filter(p => p.matrix?.failed?.length || p.tests?.status || p.axe?.status || p.perf?.status || p.matrix?.status);
if (bad.length) console.error(`packs with failures: ${bad.map(p => p.item).join(', ')}`);
process.exit(bad.length ? 1 : 0);

// --------------------------------------------------------------------------- helpers

/** One tiled PNG of the matrix cells, each cell labelled with its verdict. */
async function tileSheet({ slug, dir, cells }) {
  const { session, shoot } = await import('./lib/browser.mjs');
  const s = await session();
  const work = await s.browser.newContext();
  const wp = await work.newPage();
  await wp.goto(`${s.base}/tools/harness/blank.html`);
  const png = await wp.evaluate(async ({ cells, title, dir }) => {
    const COLS = 5, BOX = { w: 380, h: 280 }, GAP = 12, LABEL = 34, HEAD = 30;
    const rows = Math.ceil(cells.length / COLS);
    const W = GAP + COLS * (BOX.w + GAP) + GAP, H = HEAD + rows * (BOX.h + LABEL + GAP) + GAP;
    const c = new OffscreenCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#f4efe4'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'top'; g.font = '600 15px ui-monospace, Consolas, monospace';
    g.fillStyle = '#1d2742'; g.fillText(title, GAP, 8);
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const x0 = GAP + (i % COLS) * (BOX.w + GAP), y0 = HEAD + Math.floor(i / COLS) * (BOX.h + LABEL + GAP);
      const verdict = cellVerdict(cell);
      g.font = '400 12px ui-monospace, Consolas, monospace';
      g.fillStyle = verdict.ok ? '#5d6378' : '#b8412a';
      g.fillText(`${cell.id}  ${verdict.text}`.slice(0, 60), x0, y0 + 2);
      g.fillStyle = '#e6dfd0'; g.fillRect(x0, y0 + 18, BOX.w, BOX.h);
      if (verdict.png) {
        const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${verdict.png}`)).blob());
        const k = Math.min(1, BOX.w / bmp.width, BOX.h / bmp.height);
        g.drawImage(bmp, x0 + (BOX.w - bmp.width * k) / 2, y0 + 18 + (BOX.h - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
      }
      g.strokeStyle = verdict.ok ? '#d9d1c0' : '#b8412a'; g.strokeRect(x0 + 0.5, y0 + 18.5, BOX.w - 1, BOX.h - 1);
    }
    const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);

    function cellVerdict(cell) {
      const why = [];
      if (!cell.ready?.ok) why.push(`not ready: ${cell.ready?.reason ?? '?'}`);
      if (cell.errors?.count) why.push(`${cell.errors.count} errors`);
      if (cell.overflow && !cell.overflow.pass) why.push(`sideways scroll (${cell.overflow.scrollWidth} > ${cell.overflow.innerWidth})`);
      if (cell.pointer?.status === 'fail') why.push(`tap ${JSON.stringify(cell.pointer.expected)} landed ${JSON.stringify(cell.pointer.got)}`);
      if (cell.pointer?.status === 'not run') why.push('tap not run');
      const png = cell.shot ? cell.pngB64 : null;
      return { ok: why.length === 0, text: why.length ? why.join('; ') : 'ok', png };
    }
  }, { cells: cells.map(c => ({ ...c, pngB64: fs.existsSync(path.join(REPO, dir, 'matrix', c.shot)) ? fs.readFileSync(path.join(REPO, dir, 'matrix', c.shot)).toString('base64') : null })), title: `${slug}   the full matrix, one picture   ${new Date().toISOString().slice(0, 10)}`, dir });
  await work.close();
  const sheet = path.join(REPO, dir, `${slug}-sheet.png`);
  fs.writeFileSync(sheet, Buffer.from(png, 'base64'));
  console.log(`ok   sheet ${path.relative(REPO, sheet).replaceAll('\\', '/')}`);
  return `${dir}/${slug}-sheet.png`;
}

function writePackMd(pack) {
  const L = [];
  L.push(`# Pack: ${pack.item}`);
  L.push('');
  L.push(`Commit of the run: ${pack.commit.slice(0, 12)}. Gathered ${new Date().toISOString().replace('T', ' ').slice(0, 19)} by tools/review-pack.mjs.`);
  L.push('');
  if (pack.matrix) {
    L.push(`- Matrix: ${pack.matrix.cells} cells, ${pack.matrix.failed.length} failed${pack.matrix.failed.length ? `: ${pack.matrix.failed.join(', ')}` : ''}. One picture: ${pack.slug}-sheet.png.`);
  }
  if (pack.open) L.push(`- Open states: ${pack.open.what}: ${pack.open.sheet}`);
  if (pack.strip) L.push(`- Warm strip: ${pack.slug}-warm-strip.png${pack.strip.facts?.length ? `, facts: ${pack.strip.facts.join(' | ')}` : ''}`);
  if (pack.axe?.runs && Array.isArray(pack.axe.runs)) {
    const v = pack.axe.runs.filter(r => r.violations || r.incomplete);
    L.push(`- Axe: ${pack.axe.runs.length} register/theme runs${v.length ? `, violations in ${v.length}: ${v.map(r => `${r.register}/${r.theme} ${r.ids.join('+')}`).join('; ')}` : ', no violations'}`);
  }
  if (pack.perf?.result) {
    const r = pack.perf.result;
    const ratio = r.ratio?.mean?.ratio != null ? `${r.ratio.mean.ratio.toFixed(2)}x mean (${r.ratio.mean.within ? 'within' : 'OVER'} budget), p95 ${r.ratio.p95?.ratio}` : 'see perf.json';
    const busy = r.machine?.busyPercent != null ? `, CPU busy ${r.machine.busyPercent}%` : '';
    L.push(`- Perf: ratio to Paus ${ratio}${busy}, ${r.environment ?? ''}`);
  }
  if (pack.tests) L.push(`- Tests: ${pack.tests.status === 0 ? 'pass' : pack.tests.status == null ? 'none' : 'FAIL'} (${pack.tests.tail?.slice(-1)[0] ?? ''})`);
  for (const n of pack.notes) L.push(`- Note: ${n}`);
  L.push('');
  L.push('Open the contact sheet and look at it before you open a PR.');
  fs.writeFileSync(path.join(REPO, pack.dir, 'pack.md'), L.join('\n') + '\n');
}
