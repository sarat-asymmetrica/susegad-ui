// The text gate on the real manifest, real fonts and the real vendored Pretext (about a second), and proof that it bites:
//   - the real copy is green;
//   - Kathakar's OVERFLOW (a Kannada board too long for the arch) is red, and the same use with the real copy is green;
//   - a mutant shape (the board's arch halved) is red;
//   - a shaper that is wrong is not silently accepted: one that halves every width changes the results, and one that lies
//     only to the layout (the gate's own re-measure stays honest) is caught as `escapes`.
// The broken shapers run in child processes: Pretext keeps the first canvas it finds, so one process holds one shaper.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { runTextGate, OVERFLOW, LANGS, VIEWPORTS, MANIFEST } from './text-gate.run.mjs';
import { formatTable } from './text-gate.core.js';
import { makeTintoBoard } from './text-gate.manifest.js';
import { slateOf } from '../../packages/scenes/tinto/model.js';

const t0 = performance.now();
const real = await runTextGate();
const realMs = performance.now() - t0;
const cell = (rows, id, lang, viewport) => rows.find(r => r.id === id && r.lang === lang && r.viewport === viewport);

test('the real copy, in all four languages, at every viewport: no failures, no escapes', () => {
  const bad = real.failed.map(r => `${r.id} ${r.lang} ${r.viewport}: ${r.result}; ${[...r.issues, ...r.notes].join('; ')}`);
  assert.deepEqual(bad, [], `the gate failed:\n${formatTable(real.rows)}`);
  assert.equal(real.rows.filter(r => r.result === 'escapes').length, 0);
  assert.equal(real.rows.length, MANIFEST.length * LANGS.length * VIEWPORTS.length);
  assert.ok(realMs < 10_000, `the whole manifest took ${Math.round(realMs)} ms (budget 10 s)`);
});

test('the manifest keeps its rule: no language is expected to do worse than English', () => {
  for (const use of MANIFEST) for (const vp of VIEWPORTS) {
    const en = cell(real.rows, use.id, 'en-IN', vp.name);
    if (en.result === 'not-gated') continue;
    // English's expectation is what English does today; a stale one (English now holds where the manifest allows a fall-back) is named here
    assert.equal(en.expected === 'holds', en.result === 'fits', `${use.id} at ${vp.name}: English ${en.result} but the manifest says ${en.expected}`);
    for (const lang of LANGS) {
      const c = cell(real.rows, use.id, lang, vp.name);
      if (en.expected === 'may-fall-back') assert.equal(c.expected, 'may-fall-back', `${use.id} ${lang} ${vp.name}`);
      // a language may be waived below English only with a written reason and a named cause
      if (en.expected === 'holds' && c.expected !== 'holds') assert.ok(c.waived, `${use.id} ${lang} ${vp.name} is expected to fall back where English holds, with no waiver`);
    }
  }
});

test('no cell is waived: the one finding the gate made (layIntoShape asked for a spare line) is fixed', () => {
  assert.deepEqual(real.rows.filter(r => r.waived).map(r => `${r.id} ${r.lang} ${r.viewport}`), []);
});

test('it bites: Kathakar\'s overflowing Kannada board fails, and the same use with the real copy is green', async () => {
  const bitten = await runTextGate({ overrides: { 'tinto.board': OVERFLOW['tinto.board'] }, langs: ['kn'], only: { id: 'tinto.board' } });
  const control = await runTextGate({ langs: ['kn'], only: { id: 'tinto.board' } });
  console.log(`\n--- OVERFLOW copy swapped into tinto.board (kn) ---\n${formatTable(bitten.rows)}\n--- the real copy, same use ---\n${formatTable(control.rows)}\n`);
  // desktop-1280: English holds, so Kannada must; the long notice cannot
  const c = cell(bitten.rows, 'tinto.board', 'kn', 'desktop-1280');
  assert.equal(c.expected, 'holds');
  assert.equal(c.result, 'falls-back');
  assert.equal(c.ok, false);
  assert.match(c.notes.join(), /room runs out: \d+ of 307 characters fit/);
  assert.ok(bitten.failed.length >= 2, 'it fails at desktop-1100 too, not only 1280');
  assert.deepEqual(control.failed, []);
  assert.equal(cell(control.rows, 'tinto.board', 'kn', 'desktop-1280').result, 'fits');
});

test('it bites: a mutant board (the arch halved) fails where English held', async () => {
  const slate = slateOf();
  const mutant = { ...makeTintoBoard({ slate: { ...slate, w: slate.w / 2, x: slate.x + slate.w / 4 } }) };
  const r = await runTextGate({ manifest: [mutant], langs: ['en-IN'] });
  console.log(`\n--- mutant board, en-IN ---\n${formatTable(r.rows.filter(x => x.viewport.startsWith('desktop')))}\n`);
  assert.equal(cell(r.rows, 'tinto.board', 'en-IN', 'desktop-1280').result, 'falls-back');
  assert.ok(r.failed.some(x => x.viewport === 'desktop-1280' && x.lang === 'en-IN'));
});

/** Run the gate in a fresh process with a broken shaper and return its rows. */
function child(options) {
  const url = pathToFileURL(new URL('./text-gate.run.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')).href;
  const code = `import { runTextGate } from ${JSON.stringify(url)}; const r = await runTextGate(${JSON.stringify(options)}); console.log(JSON.stringify(r.rows));`;
  const out = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(out.status, 0, out.stderr);
  return JSON.parse(out.stdout.trim().split('\n').pop());
}
const summary = rows => rows.map(r => `${r.id}|${r.lang}|${r.viewport}|${r.result}|${r.px}|${r.lines}`);

test('it bites: a shaper that halves every width changes the results', () => {
  const rows = child({ widthScale: 0.5 });
  const changed = summary(rows).filter((s, i) => s !== summary(real.rows)[i]).length;
  console.log(`\n--- every width x 0.5: ${changed} of ${rows.length} cells differ from the real run ---`);
  assert.ok(changed > rows.length / 4, `only ${changed} cells changed`);
});

test('it bites: a layout that under-measures while the gate re-measures honestly is caught as an escape', () => {
  const rows = child({ layoutScale: 0.7 });
  const esc = rows.filter(r => r.result === 'escapes');
  console.log(`\n--- Pretext sees widths x 0.7, the gate re-measures honestly: ${esc.length} escapes; first: ${esc[0]?.id} ${esc[0]?.lang} ${esc[0]?.viewport}: ${esc[0]?.issues[0]} ---`);
  assert.ok(esc.length > 0, 'a lying oracle must produce escapes');
  assert.ok(esc.every(r => !r.ok));
});

test('the boot guard: a second boot with other options in one process is refused, not silently wrong', async () => {
  await assert.rejects(runTextGate({ widthScale: 0.5 }), /boots once per process/);
});

test('the scenes the gate models pass the token stack, not one family name (so the canvas and the gate measure the same faces)', async () => {
  const fs = await import('node:fs'), root = new URL('../../', import.meta.url);
  for (const f of ['packages/scenes/tinto/words.js', 'packages/scenes/vad/render.js']) {
    const src = fs.readFileSync(new URL(f, root), 'utf8');
    assert.match(src, /stackOf\(host, 'hand'\)/, `${f} reads the hand stack`);
    assert.doesNotMatch(src, /family: 'Kalam'|const HAND = 'Kalam'/, `${f} still names Kalam alone`);
  }
  assert.match(fs.readFileSync(new URL('packages/scenes/tinto/words.js', root), 'utf8'), /stackOf\(host, 'body'\)/);
});

test('it bites: a stack that lost its Kannada face fails the gate, read from tokens.css (not from the scenes\' mirror)', async () => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-gate-fault-'));
  try {
    fs.cpSync(new URL('../../packages/tokens', import.meta.url), path.join(root, 'packages', 'tokens'), { recursive: true });
    const css = path.join(root, 'packages', 'tokens', 'tokens.css');
    const text = fs.readFileSync(css, 'utf8');
    assert.ok(text.includes("'Noto Sans Kannada', "), 'the fault is planted where the Kannada face is');
    fs.writeFileSync(css, text.replaceAll("'Noto Sans Kannada', ", ''));
    const url = new URL('./text-gate.run.mjs', import.meta.url).href;
    const code = `import { runTextGate } from ${JSON.stringify(url)}; const r = await runTextGate({ root: ${JSON.stringify(root)} }); console.log(JSON.stringify(r.rows));`;
    const out = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    assert.equal(out.status, 0, out.stderr);
    const rows = JSON.parse(out.stdout.trim().split('\n').pop());
    const bad = rows.filter(r => !r.ok);
    console.log(`\n--- tokens.css without Noto Sans Kannada: ${bad.length} failing cells; first: ${bad[0]?.id} ${bad[0]?.lang} ${bad[0]?.viewport}: ${bad[0]?.issues[0]} ---`);
    assert.ok(bad.length > 0);
    assert.ok(bad.every(r => r.lang === 'kn'), 'only the Kannada copy loses its face');
    assert.match(bad[0].issues.join(), /no face in the sg-font-(hand|body) stack covers \d+ characters of the kn copy/);
    // the real tokens, same code: green
    assert.deepEqual(real.failed, []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
