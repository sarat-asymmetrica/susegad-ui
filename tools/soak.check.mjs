// The soak's red proof. A planted leak must fail `tools/soak.mjs` on the things it leaks, and the steady page must pass
// (a check must be able to fail before it counts).
//
//   node tools/soak.check.mjs        two 30 s soak runs, one after the other, each through a machine browser slot
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

function run(page, name) {
  const json = path.join(out, `${name}.json`);
  const r = spawnSync(process.execPath, [soak, page, '--duration', '30', '--interval', '2', '--warmup', '8', '--json', json],
    { encoding: 'utf8', timeout: 30 * 60 * 1000, env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  let result = null;
  try { result = JSON.parse(fs.readFileSync(json, 'utf8')); } catch { /* reported by the caller */ }
  return { status: r.status, result, text: `${r.stdout}${r.stderr}` };
}

const leak = run('/tools/fixtures/soak/leak.html', 'leak');
const failedSet = leak.result?.verdict.failed ?? [];
check('the leaking page fails and exits 1', leak.status === 1 && leak.result?.verdict.overall === 'fail', leak.text);
for (const k of ['heap', 'nodes', 'listeners', 'canvasMpx']) check(`the leak is caught on ${k}`, failedSet.includes(k), `failed: ${failedSet}\n${leak.text}`);

const steady = run('/tools/fixtures/soak/steady.html', 'steady');
check('the steady page passes and exits 0', steady.status === 0 && steady.result?.verdict.overall === 'pass' && steady.result.verdict.failed.length === 0, steady.text);

fs.rmSync(out, { recursive: true, force: true });
console.log(failed ? `\n${failed} failed` : '\nsoak check: the leak is red on all four of its kinds and the steady page is green');
process.exitCode = failed ? 1 : 0;
