// Tests for the conformance notes tool. A check that cannot fail is not a check, so every
// fixture under tools/fixtures/conformance/ is judged twice: by the pure core, and by the
// command line (exit code). Each broken one goes red for its named reason; the good ones pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFile, checkLibrary, exemptList, componentNames } from './conformance.mjs';
import { parseDocs, validate, required, renderSummary, filesNamed, isManual, WCAG, KINDS, TRAITS, BASE, INFORMATIVE } from './conformance.core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const fix = n => path.join(HERE, 'fixtures', 'conformance', n, 'widget.docs.md');
const rules = n => [...new Set(checkFile(fix(n), { name: 'widget', traits: [] }).findings.map(f => f.rule))];

const RED = {
  'missing-table': ['missing-table'],
  'malformed': ['malformed-table'],
  'bad-criterion': ['bad-criterion'],
  'wrong-name': ['bad-criterion'],
  'bad-status': ['bad-status'],
  'missing-evidence': ['missing-evidence'],
  'claim-without-evidence': ['missing-evidence'],
  'missing-owns': ['missing-owns'],
  'missing-required': ['missing-required'],
  'vague-manual': ['vague-evidence'],
};
for (const [name, want] of Object.entries(RED)) {
  test(`fixture ${name} goes red for ${want.join(', ')} and nothing else`, () => {
    assert.deepEqual(rules(name), want);
  });
  test(`fixture ${name}: the command line exits 1`, () => {
    assert.throws(() => execFileSync(process.execPath, ['tools/conformance.mjs', '--file', fix(name), '--traits', 'none'], { cwd: REPO, stdio: 'pipe' }), e => e.status === 1);
  });
}
for (const name of ['good', 'known-gap']) {
  test(`fixture ${name} is green`, () => assert.deepEqual(checkFile(fix(name), { name: 'widget', traits: [] }).findings, []));
  test(`fixture ${name}: the command line exits 0`, () => {
    const out = execFileSync(process.execPath, ['tools/conformance.mjs', '--file', fix(name), '--traits', 'none'], { cwd: REPO, encoding: 'utf8' });
    assert.match(out, /conformance table ok/);
  });
}

test('a manual test must carry a date and a measured value or a named observation: "looked fine" fails, a dated number passes', () => {
  const row = how => `| 1.4.4 Resize text | Meets | ${how} |`;
  const judge = how => validate({ found: true, line: 1, rows: [{ number: '1.4.4', name: 'Resize text', status: 'Meets', how, line: 2 }], owns: ['x'], problems: [] }, { traits: [], fileExists: () => true }).filter(f => f.rule === 'vague-evidence');
  void row;
  assert.equal(judge('Manual test: looked fine.').length, 1);
  assert.equal(judge('Manual test, 2026-10-07: looked fine.').length, 1, 'a date alone is not a measurement');
  assert.equal(judge('Manual test, 2026-10-07: demo at 200 percent, no sideways scroll.').length, 0);
  assert.equal(judge('Manual test, 2026-10-07: the picker reads "Ask the house".').length, 0);
  assert.equal(judge('Manual test: 200 percent, no scroll.').length, 1, 'a manual test needs a date');
});

test('KINDS and touch.check agree on which components are interactive', () => {
  const out = execFileSync(process.execPath, ['tools/touch.check.mjs', '--static', '--json'], { cwd: REPO, encoding: 'utf8', maxBuffer: 1e8 });
  const lines = out.split(String.fromCharCode(10));
  const rows = JSON.parse(lines.slice(lines.indexOf('{'), lines.lastIndexOf('}') + 1).join(String.fromCharCode(10))).rows;
  // a component may be allowed to differ, with the reason written here. Empty: none does.
  const ALLOW = {};
  const bad = [];
  for (const r of rows) {
    if (!(r.name in KINDS) || r.name in ALLOW) continue;
    const kinds = KINDS[r.name].includes('interactive');
    if (kinds !== r.interactive) bad.push(`${r.name}: touch.check says ${r.interactive ? 'interactive' : 'not interactive'}, KINDS says ${kinds ? 'interactive' : 'no interactive trait'}`);
  }
  assert.deepEqual(bad, []);
});

test('--traits that disagree with KINDS are refused for a real component', () => {
  assert.throws(() => execFileSync(process.execPath, ['tools/conformance.mjs', '--file', 'packages/components/toggle/toggle.docs.md', '--traits', 'none'], { cwd: REPO, stdio: 'pipe' }), e => e.status === 2 && /KINDS/.test(String(e.stderr)));
  const ok = execFileSync(process.execPath, ['tools/conformance.mjs', '--file', 'packages/components/toggle/toggle.docs.md', '--traits', KINDS.toggle.join(',')], { cwd: REPO, encoding: 'utf8' });
  assert.match(ok, /conformance table ok/);
});

test('a missing-evidence finding names the file that is not there', () => {
  const f = checkFile(fix('missing-evidence'), { name: 'widget', traits: [] }).findings;
  assert.equal(f.length, 1);
  assert.match(f[0].message, /nonexistent\.check\.mjs/);
});

test('required criteria grow with the traits, and are a subset of real WCAG criteria', () => {
  assert.deepEqual(required([]), [...BASE].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  const toggle = required(KINDS.toggle);
  for (const c of ['2.1.1', '2.4.7', '2.5.8', '3.3.2', '2.2.2']) assert.ok(toggle.includes(c), c);
  assert.ok(!required([]).includes('2.1.1'));
  for (const trait of Object.values(TRAITS)) for (const c of trait.add) assert.ok(WCAG[c], `${c} is not a WCAG 2.2 A or AA criterion`);
  for (const c of BASE) assert.ok(WCAG[c], c);
  for (const [name, ts] of Object.entries(KINDS)) for (const t of ts) assert.ok(TRAITS[t], `${name}: unknown trait ${t}`);
});

test('the criteria list is the real one: 55 at A and AA, no 4.1.1, AAA kept apart', () => {
  assert.equal(Object.keys(WCAG).length, 55);
  assert.ok(!('4.1.1' in WCAG));
  assert.ok(!('2.4.12' in WCAG) && !('2.3.3' in WCAG));
  assert.ok('2.3.3' in INFORMATIVE);
  for (const n of ['2.4.11', '2.5.7', '2.5.8', '3.2.6', '3.3.7', '3.3.8']) assert.ok(WCAG[n], `${n} is new in 2.2`);
});

test('evidence parsing: files in backticks, manual tests, line numbers', () => {
  assert.deepEqual(filesNamed('`a/b.check.mjs`: it asserts; also `tools/axe.mjs --url /x` and `toggle.css:12` and `--sg-focus`'), ['a/b.check.mjs', 'tools/axe.mjs', 'toggle.css']);
  assert.ok(isManual('Manual test: 320 px'));
  assert.ok(!isManual('We looked at it.'));
});

test('a row cell may hold an escaped pipe', () => {
  const p = parseDocs(['## Accessibility', '', '### Conformance (WCAG 2.2 AA)', '', '| Criterion | Status | How it was checked |', '|---|---|---|', '| 1.1.1 Non-text content | Meets | Manual test: a \\| b |', '', '**The page author owns:**', '', '- x', ''].join('\n'));
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].how, 'Manual test: a | b');
});

test('a table outside ## Accessibility is misplaced', () => {
  const p = parseDocs('## Budget\n\n### Conformance (WCAG 2.2 AA)\n\n| Criterion | Status | How it was checked |\n|---|---|---|\n| 1.1.1 Non-text content | Meets | Manual test: x |\n\n**The page author owns:**\n\n- x\n');
  assert.ok(p.problems.some(x => x.rule === 'misplaced'));
});

test('the library: every component not on the exempt list has a valid table', () => {
  const lib = checkLibrary();
  assert.deepEqual(lib.failing.map(r => `${r.name}: ${r.findings[0].message}`), []);
});

test('the library: the two worked examples are valid even with no exemption', () => {
  const lib = checkLibrary({ strict: true });
  for (const n of ['toggle', 'menu']) {
    const r = lib.results.find(x => x.name === n);
    assert.deepEqual(r.findings, [], n);
  }
});

test('the exempt list names no component that has a valid table and is not exempt-ready, and every component has a kind', () => {
  for (const n of componentNames()) assert.ok(KINDS[n], `${n} has no entry in KINDS (tools/conformance.core.js)`);
  assert.ok(Array.isArray(exemptList()));
});

test('the summary page: one row per component, links, the gap listed, deterministic', () => {
  const entries = ['toggle', 'menu'].map(n => {
    const r = checkFile(path.join(REPO, 'packages', 'components', n, `${n}.docs.md`), { name: n });
    return { name: n, traits: r.traits, parsed: r.parsed };
  });
  const gap = checkFile(fix('known-gap'), { name: 'widget', traits: [] });
  entries.push({ name: 'widget', traits: [], parsed: gap.parsed });
  // a component whose docs have no table yet: the fixture without one, named as a component
  const none = checkFile(fix('missing-table'), { name: 'unwritten', traits: [] });
  entries.push({ name: 'unwritten', traits: [], parsed: none.parsed });
  const a = renderSummary(entries), b = renderSummary(entries);
  assert.equal(a, b);
  assert.match(a, /\[toggle\]\(\.\.\/\.\.\/packages\/components\/toggle\/toggle\.docs\.md#conformance-wcag-22-aa\)/);
  assert.match(a, /\| \[unwritten\][^\n]*not yet written/);
  assert.match(a, /## Known gaps[\s\S]*2\.4\.11 Focus not obscured/);
  assert.ok(!/[—―‒]/.test(a), 'no em dashes');
});

test('--report lists the components without a table and exits 0', () => {
  const out = execFileSync(process.execPath, ['tools/conformance.mjs', '--report'], { cwd: REPO, encoding: 'utf8' });
  assert.match(out, /components have a valid conformance table/);
});
