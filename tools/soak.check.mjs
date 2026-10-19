// The soak's red proof. A planted leak must fail `tools/soak.mjs` on the things it leaks, and the steady page must pass
// (a check must be able to fail before it counts).
//
//   node tools/soak.check.mjs        about ten 30 s soak runs (and one of 5 s), one after the other, each through a machine browser slot
//
// By hand, not in `npm test` (it launches Chromium and waits for a slot) and not in the suite: it checks the instrument itself.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const soak = path.join(path.dirname(fileURLToPath(import.meta.url)), 'soak.mjs');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'soak-check-'));
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `\n       ${detail}`}`); if (!ok) failed++; };

const T = '/tools/fixtures/soak/';
const SHORT = ['--duration', '30', '--interval', '2', '--warmup', '8'];

function run(args, name, timing = SHORT) {
  const json = path.join(out, `${name}.json`);
  const r = spawnSync(process.execPath, [soak, ...args, ...timing, '--json', json],
    { encoding: 'utf8', timeout: 30 * 60 * 1000, env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  let result = null;
  try { result = JSON.parse(fs.readFileSync(json, 'utf8')); } catch { /* reported by the caller */ }
  return { status: r.status, result, failed: result?.verdict.failed ?? [], text: `${r.stdout}${r.stderr}` };
}
/** A planted fault must exit 1 and be red on the named budgets. */
function red(label, r, kinds) {
  check(`${label} fails and exits 1`, r.status === 1 && r.result?.verdict.overall === 'fail', r.text);
  for (const k of kinds) check(`${label}: caught on ${k}`, r.failed.includes(k), `failed: ${r.failed}\n${r.text}`);
}

const leak = run([T + 'leak.html'], 'leak');
red('the leaking page', leak, ['heap', 'nodes', 'listeners', 'canvasMpx']);

const steady = run([T + 'steady.html'], 'steady');
check('the steady page passes and exits 0', steady.status === 0 && steady.result?.verdict.overall === 'pass' && steady.failed.length === 0, steady.text);

red('the documents leak', run([T + 'docs.html'], 'docs'), ['documents']);
red('the page with a console error', run([T + 'errors.html'], 'errors'), ['errors']);
// 35 ms of script per frame from 16 s on: p95 x3, over the load allowance (x2), so it is red on a busy machine too.
red('the frame-time drift', run([T + 'drift.html'], 'drift'), ['p95']);
// Every mount of leak-mount.html leaves its document and some heap in the host; the steady page beside it leaks nothing.
const list = run(['--playlist', `${T}leak-mount.html,${T}steady.html`, '--dwell', '3'], 'playlist-leak');
red('the playlist whose scene leaks on mount', list, ['documents']);
check('the playlist run counted its mounts', (list.result?.mounts ?? 0) >= 6, `mounts: ${list.result?.mounts}\n${list.text}`);
const listOk = run(['--playlist', `${T}steady.html,${T}steady.html`, '--dwell', '3'], 'playlist-steady');
check('a playlist of steady pages passes and exits 0', listOk.status === 0 && listOk.result?.verdict.overall === 'pass', listOk.text);

// Too few samples after warm-up: neither pass nor fail. Exit 3, no row says ok, no slope is printed.
const few = run([T + 'steady.html'], 'few', ['--duration', '5', '--interval', '2', '--warmup', '1']);
check('a run with too few samples is NOT-JUDGED and exits 3', few.status === 3 && few.result?.verdict.overall === 'not-judged', few.text);
check('its judged-nothing rows print n/j (only errors, which is always judged, says ok), and no slope', /n\/j\s+heap/.test(few.text) && !/^ +ok\s+(?!errors)\S/m.test(few.text) && !/slope\s+-?\d/.test(few.text), few.text);

fs.rmSync(out, { recursive: true, force: true });
console.log(failed ? `\n${failed} failed` : '\nsoak check: each budget and the playlist path are red on a planted fault, the steady pages are green, and a run that judged nothing says so');
process.exitCode = failed ? 1 : 0;
