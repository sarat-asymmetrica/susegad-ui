// The phone sweep: every component, recipe, scene and template page at 390 px, in each register,
// measured with the honest yardstick (lib/overflow.mjs) and, when a page does scroll sideways, the
// elements that stick out past the screen.
//
//   node tools/viewport-sweep.mjs                     all pieces, all registers (a few minutes)
//   node tools/viewport-sweep.mjs --only kolam,badge  just these (a scene or a folder name)
//   node tools/viewport-sweep.mjs --width 320         another phone width
//   node tools/viewport-sweep.mjs --theme dark        dark theme (default light)
//   node tools/viewport-sweep.mjs --out sweep.json    where to write the rows (default .shots/viewport-sweep/rows.json)
//
// Prints one table, non-zero rows first, and exits non-zero if any cell overflows. One browser, one
// context per cell, one cell at a time.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { REGISTERS } from './lib/target.mjs';
import { session, openTarget, waitReady, PHONE } from './lib/browser.mjs';
import os from 'node:os';
import { sidewaysScroll } from './lib/overflow.mjs';
import { startServer } from './serve.mjs';
import { run as susegad } from '../packages/cli/bin/susegad.mjs';

const { opts } = parseArgs(process.argv.slice(2), { only: 'string', width: 'number', out: 'string', theme: 'string' }, { width: PHONE.width, theme: 'light' });
const only = opts.only ? new Set(opts.only.split(',')) : null;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

/** @returns {{ kind: string, name: string, target: object }[]} */
function pieces() {
  const out = [];
  const dirs = d => fs.existsSync(path.join(root, d)) ? fs.readdirSync(path.join(root, d), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort() : [];
  const page = (kind, dir, name) => {
    for (const file of ['demo.html', 'index.html']) {
      if (fs.existsSync(path.join(root, dir, name, file))) { out.push({ kind, name, target: { url: `/${dir}/${name}/${file}` } }); return; }
    }
  };
  for (const n of dirs('packages/components')) page('component', 'packages/components', n);
  for (const n of dirs('packages/recipes')) page('recipe', 'packages/recipes', n);
  for (const n of dirs('packages/scenes')) if (fs.existsSync(path.join(root, 'packages/scenes', n, 'index.js'))) out.push({ kind: 'scene', name: n, target: { scene: n } });
  for (const n of dirs('templates')) page('template', 'templates', n);
  for (const n of dirs('packages/templates')) page('template', 'packages/templates', n);
  page('stage3d', 'packages/stage3d', 'depth-photo');
  page('folio', 'packages/folio', 'diagram');
  return out.filter(p => !only || only.has(p.name));
}

/** Runs in the page: the elements that stick out past the right edge and are not clipped by a scroller of their own. */
function offenders(vw) {
  const clipped = el => {
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      if (o !== 'visible' && a !== document.body) return true;
    }
    return false;
  };
  const name = el => el.localName + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
  const found = [];
  const walk = root => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      const r = el.getBoundingClientRect();
      if (r.width && r.right > vw + 0.5 && !clipped(el)) found.push({ el: name(el), right: Math.round(r.right), w: Math.round(r.width) });
    }
  };
  walk(document);
  return found.sort((a, b) => b.right - a.right).slice(0, 3);
}

// The event template's source pages point at susegad/... paths that only exist once `susegad create` has copied the
// library beside them, so in the repo they load unstyled (and a poster with no stylesheet is wider than any phone).
// Sweep the site create makes, served on its own, as the pages a visitor meets.
const scaffolded = [];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'susegad-sweep-'));
const siteDir = path.join(scratch, 'site');
let siteServer = null;
if (!only || only.has('event')) {
  const code = await susegad(['create', 'site', '--yes'], { cwd: scratch, out: () => {}, err: e => console.error(e) });
  if (code === 0) {
    siteServer = await startServer({ root: siteDir, quiet: true });
    for (const [name, file] of [['event (en-IN)', '/index.html'], ['event (gom-Deva)', '/gom-deva/index.html'], ['event (gom-Latn)', '/gom-latn/index.html']]) scaffolded.push({ kind: 'template*', name, target: { url: file }, base: siteServer.url });
  }
}

const s = await session();
const rows = [];
try {
  for (const p of [...pieces().filter(x => !(x.kind === 'template' && x.name === 'event')), ...scaffolded]) {
    for (const register of REGISTERS) {
      const t = { ...p.target, register, theme: opts.theme };
      const row = { piece: p.name, kind: p.kind, cell: `${register} ${opts.width}`, clipped: false, overflow: null, scrollWidth: null, metaViewport: null, elements: [], note: '' };
      let ctx, log;
      try {
        const o = await openTarget(p.base ? { ...s, base: p.base } : s, t, { ...PHONE, width: opts.width });
        log = o.log;
        // from the first moment we can reach the page: the widest scrollWidth on any frame, so a stagger or a stamp that
        // pushes past the edge for a few frames and settles back is caught too (a phone widens its layout for good)
        await o.page.evaluate(() => { window.__peak = 0; const tick = () => { window.__peak = Math.max(window.__peak, document.documentElement.scrollWidth); requestAnimationFrame(tick); }; tick(); });
        ctx = o.context;
        const ready = await waitReady(o.page, t);
        if (!ready.ok) row.note = `not ready: ${ready.reason}`;
        await o.page.waitForTimeout(p.kind === 'scene' ? 800 : 300);
        let m = await sidewaysScroll(o.page, opts.width);
        if (m.overflow > 0) { await o.page.waitForTimeout(700); m = await sidewaysScroll(o.page, opts.width); } // late content has had its turn
        const peak = Math.max(0, (await o.page.evaluate(() => window.__peak)) - opts.width);
        if (peak > m.overflow) { row.note = `${row.note ? row.note + '; ' : ''}transient: ${peak} px at its widest, ${m.overflow} px at rest`; m = { ...m, overflow: peak }; }
        row.clipped = m.clipped; if (m.clipped) row.note = `${row.note ? row.note + '; ' : ''}clipped: html/body hide ${m.overflow} px behind overflow-x`;
        row.overflow = m.overflow; row.scrollWidth = m.scrollWidth; row.metaViewport = m.metaViewport;
        const lost = log.failedRequests.filter(f => !/\.(wav|mp3|m4a|ogg|mp4|webm)$/.test(f)); // an aborted media preload is not a missing stylesheet
        if (lost.length) row.note = `${row.note ? row.note + '; ' : ''}${lost.length} failed request(s), the page may be unstyled: ${lost[0]}`;
        if (m.overflow > 0) row.elements = await o.page.evaluate(offenders, opts.width);
      } catch (e) {
        row.note = `error: ${String(e.message).split('\n')[0]}`;
      } finally {
        await ctx?.close().catch(() => {});
      }
      rows.push(row);
      process.stdout.write(`${row.overflow ? 'OVER' : row.overflow === null ? 'ERR ' : 'ok  '} ${p.kind.padEnd(9)} ${p.name.padEnd(22)} ${row.cell.padEnd(10)} ${row.overflow ?? '?'}${row.note ? '  ' + row.note : ''}${row.elements.length ? '  ' + row.elements.map(e => `${e.el} (right ${e.right})`).join(', ') : ''}\n`);
    }
  }
} finally {
  await s.done();
  await siteServer?.close();
  fs.rmSync(scratch, { recursive: true, force: true });
}

const outFile = opts.out || path.join(root, '.shots', 'viewport-sweep', 'rows.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ width: opts.width, engine: s.engine, version: s.version, rows }, null, 2) + '\n');
const bad = rows.filter(r => r.overflow !== 0);
console.log(`\n${rows.length} cells, ${rows.filter(r => r.overflow === 0).length} at 0, ${rows.filter(r => r.overflow > 0).length} overflow, ${rows.filter(r => r.overflow === null).length} not measured. Rows: ${outFile}`);
process.exit(bad.length ? 1 : 0);
