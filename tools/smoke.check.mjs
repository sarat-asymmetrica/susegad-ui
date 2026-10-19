// The smoke tier's red proof. Planted faults under tools/fixtures/smoke/ must each turn `tools/smoke.mjs`
// red, in its own kind, and the clean page must stay green (a check must be able to fail before it counts).
//
//   node tools/smoke.check.mjs        eight smoke runs through a machine browser slot, about 1 to 2 min
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
  // the first four sections are about the older passes; the accessibility ones are switched on in section 4 (SMOKE_A11Y), one at a time
  if (!env.SMOKE_A11Y) extra = ['--no-a11y', ...extra];
  const json = path.join(out, `r${Math.random().toString(36).slice(2)}.json`);
  const r = spawnSync(process.execPath, [smoke, ...pages.flatMap(p => ['--page', p.startsWith('/') ? p : `${FX}/${p}.html`]), '--quiet', '--json', json, ...extra], { encoding: 'utf8', timeout: 180000, env: { ...process.env, MSYS_NO_PATHCONV: '1', ...env } });
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
check('a scene that never fires sg-ready is red: not-ready', slow.status === 1 && slow.result?.results[0]?.failures.some(f => f.kind === 'not-ready' && /no sg-ready within 5.5 s of load from 1 visible scene[(]s[)]: never-defined/.test(f.message)), JSON.stringify(slow.result?.results[0]) + slow.stderr);
const late = run(['late'], [], { SG_SMOKE_SCENE_MS: '1500' });
check('a scene added after load that never paints is red: not-ready, naming it', late.status === 1 && late.result?.results[0]?.failures.some(f => f.kind === 'not-ready' && /added-late/.test(f.message)), JSON.stringify(late.result?.results[0]) + late.stderr);
for (const ms of [1500, 3000]) {
  const lateN = run([`late${ms}`], [], { SG_SMOKE_SCENE_MS: '1500' });
  check(`a scene added ${ms / 1000} s after load, beside a painted one, that never paints is red: not-ready, naming it`, lateN.status === 1 && lateN.result?.results[0]?.failures.some(f => f.kind === 'not-ready' && new RegExp(`added-at-${ms}`).test(f.message)), JSON.stringify(lateN.result?.results[0]) + lateN.stderr);
}
const det = run(['details'], [], { SG_SMOKE_SCENE_MS: '1500' });
check('a scene inside a closed <details> that never paints once opened is red: not-ready', det.status === 1 && det.result?.results[0]?.failures.some(f => f.kind === 'not-ready' && /in-details.*after opening <details>/.test(f.message)), JSON.stringify(det.result?.results[0]) + det.stderr);
const part = run(['partial'], [], { SG_SMOKE_SCENE_MS: '1500' });
check('one painted scene does not vouch for its blank neighbour: not-ready names only the blank one', part.status === 1 && part.result?.results[0]?.failures.some(f => f.kind === 'not-ready' && /1 visible scene[(]s[)]: blank$/.test(f.message)), JSON.stringify(part.result?.results[0]) + part.stderr);
const hid = run(['hidden'], [], { SG_SMOKE_SCENE_MS: '1500' });
check('a scene hidden by design passes, and is listed as not checked: hidden', hid.status === 0 && hid.result?.results[0]?.notChecked?.[0] === 'behind-hidden' && /not checked: hidden .*hidden.html.*behind-hidden/.test(hid.stdout), JSON.stringify(hid.result?.results[0]) + hid.stdout + hid.stderr);
const hang = run(['hangs'], [], { SG_SMOKE_PAGE_MS: '4000' });
check('a page that never finishes is red: timeout', hang.status === 1 && hang.result?.results[0]?.failures.some(f => f.kind === 'timeout' && /did not finish in 4 s/.test(f.message)), JSON.stringify(hang.result?.results[0]) + hang.stderr);

// 4. the accessibility passes (fixtures in tools/fixtures/a11y/). Each fixture carries one fault and is run with only the pass under
// test switched on, so a red names its own cause; each pass also gets a control page that must stay green, and a baseline folder of its own.
const base = path.join(out, 'baseline');
const A11Y = ['tree', 'contrast', 'forced'];
const only = (pass, ...more) => [...A11Y.filter(p => p !== pass).map(p => `--no-${p}`), ...more];
const A = (pages, pass, more = [], env = {}) => run(pages.map(p => `/tools/fixtures/a11y/${p}.html`), only(pass, ...more), { SG_A11Y_BASELINE_DIR: base, SMOKE_A11Y: '1', ...env });
const kinds = r => r.result?.results.flatMap(x => x.failures.map(f => `${f.kind}: ${f.message}`)).join(' | ') ?? `${r.stdout}${r.stderr}`;
const failsWith = (r, kind, re) => r.result?.results.some(x => x.failures.some(f => f.kind === kind && re.test(f.message)));

// the tree: names, landmarks, headings
const tUn = A(['tree-unnamed'], 'tree', ['--record-a11y']);
check('the tree: an unnamed button, link and image are red: tree, each by role', ['1 button with no accessible name', '1 link with no accessible name', '1 img with no accessible name'].every(m => failsWith(tUn, 'tree', new RegExp(m.replace(/[()]/g, '')))), kinds(tUn));
const tBare = A(['tree-bare'], 'tree', ['--record-a11y']);
check('the tree: a page with no main landmark and no heading is red: tree, both', failsWith(tBare, 'tree', /^no main landmark$/) && failsWith(tBare, 'tree', /^no heading$/), kinds(tBare));
const tClean = A(['tree-clean'], 'tree', ['--record-a11y']);
check('the tree: a clean page records a baseline and is green', tClean.status === 0 && fs.readdirSync(base).some(f => /tree-clean/.test(f)), kinds(tClean));
const tSame = A(['tree-clean'], 'tree');
check('the tree: the same page against its baseline is green', tSame.status === 0 && tSame.result?.results[0].failures.length === 0, kinds(tSame));
const baseFile = path.join(base, fs.readdirSync(base).find(f => /tree-clean/.test(f)));
fs.appendFileSync(baseFile, '  - button "Store"\n'); // the recorded tree now holds a button the page does not have
const tDrift = A(['tree-clean'], 'tree');
check('the tree: a baseline that no longer matches is red: tree-changed, naming the line', failsWith(tDrift, 'tree-changed', /^the accessibility tree changed: - - button "Store"/), kinds(tDrift));
fs.rmSync(baseFile);
const tNone = A(['tree-clean'], 'tree');
check('the tree: a page with no baseline is red: tree-missing, asking for --record-a11y', failsWith(tNone, 'tree-missing', /--record-a11y/), kinds(tNone));

// contrast over a canvas
const cLow = A(['canvas-low'], 'contrast');
check('contrast: grey words on a grey canvas are red: contrast, with the ratio', failsWith(cLow, 'contrast', /"A caption that is hard to read" is 1\.3:1 over the canvas, needs 4\.5:1/), kinds(cLow));
const cMany = A(['canvas-many'], 'contrast');
const mc = cMany.result?.results[0].a11y?.contrast;
check('contrast: the hundredth of a hundred words is the unreadable one, and the pass reaches it: contrast, 100 of 100 measured (an early cut stays green)', failsWith(cMany, 'contrast', /"word 100" is 1\.\d+:1 over the canvas/) && mc?.boxes === 100 && mc?.found === 100, kinds(cMany) + JSON.stringify(mc));
const cGood = A(['canvas-good', 'canvas-scrim'], 'contrast');
check('contrast: white on a dark canvas, and white on a dark panel over a pale canvas, are green (the panel is seen, not the canvas under it)', cGood.status === 0 && cGood.result?.results.every(r => r.a11y?.contrast?.boxes === 1), kinds(cGood) + JSON.stringify(cGood.result?.results.map(r => r.a11y)));

// forced colours
const fV = A(['forced-vanish'], 'forced');
check('forced colours: an icon button with nothing but a gradient left, and white words kept white on a white ground, are red: forced, each', failsWith(fV, 'forced', /1 focusable control[(]s[)] with no text, border or graphic left: button\.icon/) && failsWith(fV, 'forced', /same colour as their ground: "White words on a white ground" [(]1\.00:1[)]/), kinds(fV));
const fOk = A(['forced-ok'], 'forced');
check('forced colours: a button with text, an svg icon button and a link are green', fOk.status === 0 && fOk.result?.results[0].a11y?.forced?.controls === 3, kinds(fOk) + JSON.stringify(fOk.result?.results[0].a11y));

// registers: a fault that shows only in one register
const rDefault = A(['register-axe'], 'none');
check('registers: the page whose playful register is pale is green in the default run (the gap row 48 named)', rDefault.status === 0, kinds(rDefault));
const rAll = A(['register-axe'], 'none', ['--registers']);
check('registers: --registers turns it red: axe-cell, in playful and only in playful', failsWith(rAll, 'axe-cell', /^playful\/light: color-contrast/) && failsWith(rAll, 'axe-cell', /^playful\/dark: color-contrast/) && !rAll.result?.results[0].failures.some(f => /^(quiet|warm)\//.test(f.message)), kinds(rAll));

// open states
const oDefault = A(['open-axe'], 'none');
check('open states: the page whose open dialog has an unlabelled image is green in the default run', oDefault.status === 0, kinds(oDefault));
const oOpen = A(['open-axe'], 'none', ['--open']);
check('open states: --open turns it red: axe-open, naming the dialog and image-alt', failsWith(oOpen, 'axe-open', /^the dialog: image-alt/), kinds(oOpen));
const oMiss = A(['open-missing'], 'none', ['--open']);
check('open states: an open action whose trigger is not there is red: open-failed (a list that rots does not pass)', failsWith(oMiss, 'open-failed', /^the vanished dialog: could not reach the open state/), kinds(oMiss));

fs.rmSync(out, { recursive: true, force: true });
console.log(failed ? `\n${failed} check(s) failed` : '\nsmoke red proof: all checks passed');
process.exit(failed ? 1 : 0);
