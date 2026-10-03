// The command line shared by tools/strip.mjs and tools/onion.mjs: parse, capture, analyse, write.
// Options are shot.mjs's (target, --register, --theme, --seed, --param, --content, --width, --height,
// --dpr, --reduced, --selector, --out, --allow-errors) plus the ones each tool's header documents.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './args.mjs';
import { TARGET_SPEC, targetFrom, targetSlug } from './target.mjs';
import { session, printLog } from './browser.mjs';
import { captureFrames, openWork } from './frames.mjs';
import {
  shortFlags, evenTimes, layoutStrip, layoutOnion, headerLines, cellLabel, motionFacts, factsText, FACT_DEFAULTS,
} from './strip.mjs';

const COMMON = {
  ...TARGET_SPEC, out: 'string', n: 'number', from: 'number', to: 'number', width: 'number', height: 'number', dpr: 'number',
  reduced: 'bool', selector: 'string', json: 'bool', facts: 'bool', real: 'bool', still: 'number', threshold: 'number',
  frames: 'bool', 'allow-errors': 'bool',
};
const SPECS = {
  strip: { ...COMMON, cols: 'number', 'cell-width': 'number' },
  onion: { ...COMMON, diff: 'bool' },
};

/** printLog writes to stdout; with --json stdout is for the JSON alone, so route it to stderr. */
function logProblems(log) {
  const was = console.log;
  console.log = console.error;
  try { return printLog(log); } finally { console.log = was; }
}

/**
 * @param {'strip'|'onion'} kind
 * @param {string[]} argv
 * @returns {Promise<number>} the exit code
 */
export async function run(kind, argv) {
  let parsed;
  try {
    parsed = parseArgs(shortFlags(argv), SPECS[kind], {
      out: `.shots/${kind}`, n: kind === 'strip' ? 12 : 6, from: 0, to: 8, width: 1280, height: 900, dpr: 1,
      still: FACT_DEFAULTS.still, threshold: 0.02, 'cell-width': 320,
    });
  } catch (e) { console.error(e.message); return 2; }
  const { opts, positional } = parsed;
  let t, times;
  try { t = targetFrom(opts, positional); times = evenTimes(opts.from, opts.to, opts.n); } catch (e) { console.error(e.message); return 2; }
  if (!t.scene && !t.url) {
    console.error(`usage: node tools/${kind}.mjs <scene> [-n ${opts.n}] [--from s] [--to s] [options]   (see the top of tools/${kind}.mjs)`);
    return 2;
  }
  if (kind === 'onion' && opts.n < 2) { console.error('an onion needs -n 2 or more'); return 2; }
  const real = !!opts.real || !!t.url;
  // stdout carries only the JSON with --json; everything else goes to stderr then
  const say = (...a) => (opts.json ? console.error(...a) : console.log(...a));
  const s = await session();
  let failed = 0;
  try {
    const view = { width: opts.width, height: opts.height, dpr: opts.dpr, reduced: opts.reduced };
    const cap = await captureFrames(s, t, view, times, { real, ...(opts.selector ? { selector: opts.selector } : {}) });
    say(`open ${cap.url}${cap.clock === 'real' ? ' (real clock)' : ''}`);
    const errors = logProblems(cap.log);
    if (!cap.ok) { say(`not ready: ${cap.reason}`); return 1; }
    if (errors) say(`${errors} error(s)${opts['allow-errors'] ? ' (allowed)' : ''}`);
    if (!opts['allow-errors']) failed += errors;
    for (const n of cap.notes) say(`note: ${n}`);

    const work = await openWork(s);
    const loaded = await work.load(cap.cells.map(c => c.png), opts.threshold);
    if (loaded.error) { say(loaded.error); return 1; }
    const size = { w: loaded.width, h: loaded.height };
    const cells = cap.cells.map((c, i) => ({
      i, at: c.at, t: c.t, frame: c.frame, playing: c.playing,
      luminance: +loaded.cells[i].luminance.toFixed(4), changed: loaded.cells[i].changed,
      changedPixels: loaded.cells[i].changedPixels, bbox: loaded.cells[i].bbox,
    }));
    const facts = motionFacts(cells, { still: opts.still });

    fs.mkdirSync(opts.out, { recursive: true });
    const tag = [targetSlug(t), t.register, t.theme].filter(Boolean).join('-');
    const meta = {
      scene: t.scene, url: t.url, register: t.register, theme: t.theme, seed: t.seed, params: t.params,
      clock: cap.clock, from: opts.from, to: opts.to, n: opts.n, size,
    };
    let png, file;
    if (kind === 'strip') {
      const layout = layoutStrip({ n: cells.length, frameW: size.w, frameH: size.h, cellW: opts['cell-width'], cols: opts.cols });
      const marks = cells.map(c => {
        if (!opts.facts) return null;
        if (facts.jumps.some(j => j.to === c.t)) return 'JUMP';
        if (facts.frozen.some(f => c.t >= f.from && c.t <= f.to)) return 'FROZEN';
        return null;
      });
      png = await work.strip({ layout, header: headerLines(meta), labels: cells.map(cellLabel), marks });
      file = path.join(opts.out, `${tag}-strip.png`);
    } else {
      const layout = layoutOnion({ frameW: size.w, frameH: size.h });
      const header = headerLines({ ...meta, kind: 'onion', times: cells.map(c => c.t), diff: !!opts.diff });
      png = await work.onion({ layout, header, diff: !!opts.diff, threshold: opts.threshold });
      file = path.join(opts.out, `${tag}-onion${opts.diff ? '-diff' : ''}.png`);
    }
    await work.close();
    fs.writeFileSync(file, png);
    if (opts.frames) {
      const dir = file.replace(/\.png$/, '-frames');
      fs.mkdirSync(dir, { recursive: true });
      cap.cells.forEach((c, i) => fs.writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}-${c.t.toFixed(2)}s.png`), c.png));
      say(`frames ${dir}`);
    }

    if (opts.json) {
      const out = {
        tool: kind, png: file, clock: cap.clock, size,
        target: { scene: t.scene ?? null, url: t.url ?? null, register: t.register ?? null, theme: t.theme ?? null, seed: t.seed ?? null, params: t.params },
        from: opts.from, to: opts.to, n: opts.n, threshold: opts.threshold, cells,
        ...(kind === 'onion' ? { diff: !!opts.diff } : {}),
        ...(opts.facts ? { facts } : {}),
        notes: cap.notes,
      };
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(`saved ${file}`);
      if (opts.facts) for (const l of factsText(facts, size)) console.log(l);
    }
  } finally {
    await s.done();
  }
  return failed ? 1 : 0;
}
