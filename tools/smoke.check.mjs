// The smoke tier's red proof. Planted faults under tools/fixtures/smoke/ must each turn `tools/smoke.mjs`
// red, in its own kind, and the clean page must stay green (a check must be able to fail before it counts).
//
//   node tools/smoke.check.mjs        four smoke runs through a machine browser slot, about 1 to 2 min
//
// By hand, not in `npm test` (it launches Chromium) and not in the suite: it checks the tier itself.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const smoke = path.join(path.dirname(fileURLToPath(import.meta.url)), 'smoke.mjs');
const FX = '/tools/fixtures/smoke';
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-check-'));
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `\n       ${detail}`}`); if (!ok) failed++; };

function run(pages, extra = [], env = {}) {
  const json = path.join(out, `r${Math.random().toString(36).slice(2)}.json`);
  const r = spawnSync(process.execPath, [smoke, ...pages.flatMap(p => ['--page', `${FX}/${p}.html`]), '--quiet', '--json', json, ...extra], { encoding: 'utf8', timeout: 180000, env: { ...process.env, MSYS_NO_PATHCONV: '1', ...env } });
  let result = null;
  try { result = JSON.parse(fs.readFileSync(json, 'utf8')); } catch { /* reported by the caller */ }
  return { status: r.status, result, stdout: r.stdout, stderr: r.stderr };
}

// 1. the clean page alone: green, exit 0
const clean = run(['clean']);
check('a clean page passes and exits 0', clean.status === 0 && clean.result?.ok === true && clean.result.pages === 1, `${clean.stdout}${clean.stderr}`);

// 2. every planted fault together: red, exit 1, each in its own kind, the clean page untouched
const all = run(['clean', 'throws', 'axe', 'wide', 'missing', 'nometa']);
const by = name => all.result?.results.find(r => r.path.endsWith(`/${name}.html`));
const has = (name, kind, re) => by(name)?.failures.some(f => f.kind === kind && re.test(f.message));
check('the run with faults exits 1', all.status === 1 && all.result?.ok === false, `${all.stdout}${all.stderr}`);
check('a page that throws is red: error, with the thrown message', has('throws', 'error', /planted smoke fault/), JSON.stringify(by('throws')));
check('a page with an axe violation is red: axe, naming image-alt', has('axe', 'axe', /^image-alt/), JSON.stringify(by('axe')));
check('a 420 px element is red at 390 px: sideways, with the overflow', has('wide', 'sideways', /scrolls \d+ px sideways at 390 px/) && by('wide').failures.every(f => f.kind === 'sideways'), JSON.stringify(by('wide')));
check('a missing script is red: error, with the 404', has('missing', 'error', /404 .*no-such-file\.js/), JSON.stringify(by('missing')));
check('a page without the viewport meta is red: viewport (a phone then lays out at 980 px, so sideways comes with it)', has('nometa', 'viewport', /no width=device-width viewport meta/) && by('nometa').failures.every(f => f.kind === 'viewport' || f.kind === 'sideways'), JSON.stringify(by('nometa')));
check('the clean page stays green beside them', by('clean')?.failures.length === 0, JSON.stringify(by('clean')));
check('the fault kinds are counted', ['error', 'axe', 'sideways', 'viewport'].every(k => all.result?.kinds[k] > 0), JSON.stringify(all.result?.kinds));

// 3. the two waits, shortened through the environment so the proof does not sit through 15 s and 60 s
const slow = run(['notready'], [], { SG_SMOKE_SCENE_MS: '1500' });
check('a scene that never fires sg-ready is red: not-ready', slow.status === 1 && slow.result?.results[0]?.failures.some(f => f.kind === 'not-ready' && /no scene fired sg-ready within 1.5 s/.test(f.message)), JSON.stringify(slow.result?.results[0]) + slow.stderr);
const hang = run(['hangs'], [], { SG_SMOKE_PAGE_MS: '4000' });
check('a page that never finishes is red: timeout', hang.status === 1 && hang.result?.results[0]?.failures.some(f => f.kind === 'timeout' && /did not finish in 4 s/.test(f.message)), JSON.stringify(hang.result?.results[0]) + hang.stderr);

fs.rmSync(out, { recursive: true, force: true });
console.log(failed ? `\n${failed} check(s) failed` : '\nsmoke red proof: all checks passed');
process.exit(failed ? 1 : 0);
