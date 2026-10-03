// Gates for tools/strip.mjs and tools/onion.mjs (docs/requests/2026-09-29-strip-and-onion.md).
// Run by hand (it is not under packages/ or recipes/, so `npm run check` does not pick it up):
//
//   node tools/strip.check.mjs
//   GATE=2 node tools/strip.check.mjs      (one gate; GATE=1,4 for more)
//
// Each gate has a control that must go the other way, so the gate can fail:
//
// 1. determinism: two strips of the same fixture with the same seed are byte-identical, and so are
//    their JSON facts. Control: the same two runs on the real clock (--real) must differ.
// 2. truth: --facts finds the fixture's known frozen span (3 to 5 s) and known jump (7 s), each
//    close to where it was built. Controls: the fixture without either reports none, and each
//    fault alone reports only itself.
// 3. the instrument: a stepped frame at t is the frame the harness's own ?freeze=t draws, pixel for
//    pixel (the strip is not a different clock); and the frames really differ where the dot moves
//    and repeat exactly where it stalls (a strip of one cached frame would be identical everywhere).
// 4. onion: the blend shows the dot's path (ghosts at each of the sampled places, older fainter) and
//    the plain fixture without motion blends to a picture with no ghosts. --diff paints only changes.
// 5. --json is JSON alone on stdout, with one entry per cell.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { session, openTarget, waitReady, shoot } from './lib/browser.mjs';
import { captureFrames, openWork } from './lib/frames.mjs';
import { motionFacts } from './lib/strip.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'strip-check-'));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const want = n => !process.env.GATE || process.env.GATE.split(',').includes(n);
const sha = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 10);

/** Run a tool as a person would, and return its stdout, stderr and the files it wrote. */
function tool(name, args, out) {
  const r = spawnSync(process.execPath, [path.join(REPO, 'tools', `${name}.mjs`), ...args, '--out', out], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const FAULTS = ['--param', 'stall=3-5', '--param', 'cut=7'];
const strip = (extra, out, name = 'motion') => tool('strip', [name, '-n', '9', '--from', '0', '--to', '8', ...extra], out);
const file = (dir, name) => fs.readFileSync(path.join(dir, name));
const view = { width: 1280, height: 900 };
const times9 = Array.from({ length: 9 }, (_, i) => i);

// ── 1. determinism ───────────────────────────────────────────────────────────
if (want('1')) {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(k => path.join(TMP, `det-${k}`));
  const ra = strip([...FAULTS, '--facts', '--json'], a), rb = strip([...FAULTS, '--facts', '--json'], b);
  check('frozen: the two runs exit clean', ra.code === 0 && rb.code === 0, `exit ${ra.code}, ${rb.code}${ra.code ? `: ${ra.stderr.slice(-300)}` : ''}`);
  const fa = file(a, 'motion-strip.png'), fb = file(b, 'motion-strip.png');
  check('frozen: two strips of the same fixture and seed are byte-identical', Buffer.compare(fa, fb) === 0, `${fa.length} B, sha ${sha(fa)} and ${sha(fb)}`);
  // the JSON names the PNG it wrote, and the two runs wrote to different folders; everything else must match
  const bare = out => { const j = JSON.parse(out); delete j.png; return JSON.stringify(j); };
  check('frozen: their JSON (cells and facts) is identical too, apart from the folder it names', bare(ra.stdout) === bare(rb.stdout) && ra.stdout.length > 200, `${ra.stdout.length} chars`);
  // control: the real clock cannot repeat itself
  const rc = strip([...FAULTS, '--real'], c), rd = strip([...FAULTS, '--real'], d);
  const fc = file(c, 'motion-strip.png'), fd = file(d, 'motion-strip.png');
  check('control: two strips on the real clock differ (an unfrozen clock fails the determinism probe)', rc.code === 0 && rd.code === 0 && Buffer.compare(fc, fd) !== 0, `sha ${sha(fc)} and ${sha(fd)}`);
}

// ── 2. truth: facts against a fixture built to have a stall and a cut ─────────
const s = await session();
try {
  if (want('2') || want('3')) await gates23();
} finally {
  await s.done();
}

async function gates23() {
  const measure = async params => {
    const cap = await captureFrames(s, { scene: 'motion', params, seed: undefined }, view, times9);
    if (!cap.ok) throw new Error(`capture failed: ${cap.reason}`);
    return cap;
  };
  const factsOf = async (cap, opts) => {
    // the same analysis the tool does, through the tool's own workspace page
    const work = await openWork(s);
    const loaded = await work.load(cap.cells.map(c => c.png), 0.02);
    await work.close();
    return motionFacts(cap.cells.map((c, i) => ({ t: c.t, playing: c.playing, ...loaded.cells[i] })), opts);
  };
  const both = await measure({ stall: '3-5', cut: '7' });
  const fBoth = await factsOf(both);
  const frozen = fBoth.frozen[0], jump = fBoth.jumps[0];
  check('truth: the stall is found as one frozen span from 3 to 5 s', fBoth.frozen.length === 1 && Math.abs(frozen.from - 3) <= 1 && Math.abs(frozen.to - 5) <= 1, JSON.stringify(fBoth.frozen));
  check('truth: the cut is found as one jump ending at 7 s or the cell after', fBoth.jumps.length === 1 && jump.from >= 6 && jump.to <= 8 && jump.changed > 0.9, JSON.stringify(fBoth.jumps.map(j => [j.from, j.to, +j.changed.toFixed(3)])));
  check('truth: both were sampled while playing (so the stall counts as frozen, not at rest)', both.cells.every(c => c.playing === true));

  const plain = await factsOf(await measure({}));
  check('control: the same fixture without a stall or a cut reports no frozen span and no jump', plain.frozen.length === 0 && plain.jumps.length === 0 && plain.rests.length === 0, `${plain.steps.map(x => (x.changed * 100).toFixed(2)).join(', ')}% per step`);
  const stallOnly = await factsOf(await measure({ stall: '3-5' }));
  check('control: with only the stall, a frozen span and no jump', stallOnly.frozen.length === 1 && stallOnly.jumps.length === 0);
  const cutOnly = await factsOf(await measure({ cut: '7' }));
  check('control: with only the cut, a jump and no frozen span', cutOnly.jumps.length === 1 && cutOnly.frozen.length === 0);
  const paused = await factsOf({ cells: both.cells.map(c => ({ ...c, playing: false })) });
  check('control: the same stall while not playing is listed at rest, not flagged frozen', paused.frozen.length === 0 && paused.rests.length === 1);
  const strict = await factsOf(both, { still: 2.5 });
  check('control: a stated time longer than the stall (2.5 s) flags nothing', strict.frozen.length === 0);

  // ── 3. the instrument ────────────────────────────────────────────────────────
  // the frames really move where the dot moves and repeat where it stalls
  const hashes = both.cells.map(c => sha(c.png));
  check('instrument: consecutive frames differ where the dot moves (0 to 3 s and 5 to 7 s)', [0, 1, 2, 5, 6, 7].every(i => hashes[i] !== hashes[i + 1]), hashes.join(' '));
  check('instrument: frames 3, 4 and 5 (3 to 5 s) are the same picture', hashes[3] === hashes[4] && hashes[4] === hashes[5], `${hashes[3]} ${hashes[4]} ${hashes[5]}`);
  check('instrument: 9 cells came from 9 different clock frames', new Set(both.cells.map(c => c.frame)).size === 9, both.cells.map(c => c.frame).join(', '));

  // a stepped frame is the frame the harness's own ?freeze draws
  for (const at of [2, 6]) {
    const r = await againstFreeze({ scene: 'motion', params: { stall: '3-5', cut: '7' } }, at, both.cells[at].png);
    check(`instrument: the stepped frame at ${at} s equals the harness's ?freeze=${at} frame`, r.differ === 0, r.size ?? `${r.differ} of ${r.total} pixels differ`);
  }

  // a real scene with a lazily imported add-on (Tinto with the movable glass words), where the order of
  // real events and frame callbacks matters: holding rAF from the first script made the pane settle a
  // few pixels apart from load to load, so stepped strips of it must repeat and match the harness
  const tinto = { scene: 'tinto', register: 'warm', content: true, params: { movable: '', 'words-at': '0.95 0.05' } };
  const runs = [];
  for (let i = 0; i < 4; i++) runs.push((await captureFrames(s, tinto, view, [1, 2])).cells.map(c => sha(c.png)).join(' '));
  check('instrument: Tinto with the movable glass words, four stepped captures agree', new Set(runs).size === 1, runs.join(' | '));
  const cap = await captureFrames(s, tinto, view, [2]);
  const rt = await againstFreeze(tinto, 2, cap.cells[0].png);
  check("instrument: Tinto (glass words) at 2 s equals the harness's ?freeze=2 frame", rt.differ === 0, rt.size ?? `${rt.differ} of ${rt.total} pixels differ`);
}

/** Draw the harness's own frozen frame (?freeze=at) and count the pixels that differ from `mine`. */
async function againstFreeze(base, at, mine) {
  const t = { ...base, freeze: at };
  const { context, page } = await openTarget(s, t, view);
  await waitReady(page, t, { timeout: 15000 + at * 3000 });
  const png = await shoot(page, '#box');
  await context.close();
  const work = await s.browser.newContext();
  const wp = await work.newPage();
  await wp.goto(`${s.base}/tools/harness/blank.html`);
  const r = await wp.evaluate(async ([x, y]) => {
    const dec = async b => { const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b}`)).blob()); const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d'); g.drawImage(bmp, 0, 0); return { w: bmp.width, h: bmp.height, d: g.getImageData(0, 0, bmp.width, bmp.height).data }; };
    const A = await dec(x), B = await dec(y);
    if (A.w !== B.w || A.h !== B.h) return { size: `${A.w}x${A.h} vs ${B.w}x${B.h}` };
    let n = 0; for (let i = 0; i < A.d.length; i += 4) if (A.d[i] !== B.d[i] || A.d[i + 1] !== B.d[i + 1] || A.d[i + 2] !== B.d[i + 2]) n++;
    return { differ: n, total: A.w * A.h };
  }, [mine.toString('base64'), png.toString('base64')]);
  await work.close();
  return r;
}

// ── 4. onion ────────────────────────────────────────────────────────────────
if (want('4')) {
  const dir = path.join(TMP, 'onion');
  const r = tool('onion', ['motion', '-n', '5', '--from', '0', '--to', '2', '--json'], dir);
  check('onion: exits clean and writes its PNG', r.code === 0 && fs.existsSync(path.join(dir, 'motion-onion.png')), `exit ${r.code}${r.code ? `: ${r.stderr.slice(-300)}` : ''}`);
  const j = JSON.parse(r.stdout);
  check('onion: --json has one entry per frame, the first with no change against a previous one', j.cells.length === 5 && j.cells[0].changed === null && j.cells.slice(1).every(c => c.changed > 0.02));
  const d = tool('onion', ['motion', '-n', '5', '--from', '0', '--to', '2', '--diff'], dir);
  check('onion --diff: exits clean and writes a second, different PNG', d.code === 0 && fs.existsSync(path.join(dir, 'motion-onion-diff.png')) && Buffer.compare(file(dir, 'motion-onion.png'), file(dir, 'motion-onion-diff.png')) !== 0);
  // pixel read of the onion: ghosts at the sampled dot places, older fainter
  const sess = await session();
  try {
    const page = await (await sess.browser.newContext()).newPage();
    await page.goto(`${sess.base}/tools/harness/blank.html`);
    const probe = await page.evaluate(async b64 => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
      g.drawImage(bmp, 0, 0);
      // dot centres in the 1100 x 688 frame under a header: the dot orbits (400,250) of an 800 x 500 canvas at radius 160
      const frameTop = bmp.height - 688 - 16, k = 1100 / 800, at = tSec => { const a = tSec * 0.9; return [16 + (400 + 160 * Math.cos(a)) * k, frameTop + (250 + 160 * Math.sin(a)) * k]; };
      // luminance of the dot centre: the vermilion dot is darker than the paper, and fainter when older
      return [0, 0.5, 1, 1.5, 2].map(t => { const [x, y] = at(t), p = g.getImageData(Math.round(x), Math.round(y), 1, 1).data; return [t, p[0], p[1], p[2]]; });
    }, file(dir, 'motion-onion.png').toString('base64'));
    const blue = probe.map(p => p[3]); // each entry is [t, r, g, b]; paper's blue is 223 and the dot's is 42, so lower is more dot
    check('onion: the dot is drawn at each of the five sampled places, older fainter, the newest solid', blue.every((v, i) => i === 0 ? v < 223 : v < blue[i - 1]) && blue[4] < 60, `blue at each dot centre, oldest first: ${blue.join(', ')}`);
  } finally { await sess.done(); }
}

// ── 5. --json is JSON alone ───────────────────────────────────────────────────
if (want('5')) {
  const r = strip(['--json'], path.join(TMP, 'json'));
  let ok = false, n = 0;
  try { const j = JSON.parse(r.stdout); n = j.cells.length; ok = j.tool === 'strip' && n === 9 && j.clock === 'frozen' && j.cells.every(c => typeof c.luminance === 'number' && 't' in c && 'changed' in c); } catch {}
  check('--json prints JSON alone on stdout, with time, luminance and changed share for each of 9 cells', ok && r.code === 0, `${n} cells`);
  const bad = tool('strip', ['motion', '-n', '9', '--from', '0', '--to', '0.05'], path.join(TMP, 'bad'));
  check('a span too tight for the clock is refused, not drawn', bad.code === 2 && /closer than one clock frame/.test(bad.stderr), bad.stderr.trim().split('\n').pop());
}

fs.rmSync(TMP, { recursive: true, force: true });
const failed = results.filter(x => !x).length;
console.log(failed ? `${failed} of ${results.length} checks failed` : `all ${results.length} checks pass`);
process.exit(failed ? 1 : 0);
