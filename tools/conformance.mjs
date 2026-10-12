// The conformance notes, kept (docs/contributing/conformance.md).
//
//   node tools/conformance.mjs                 check every component's docs; exempt ones may still be pending
//   node tools/conformance.mjs --strict        ignore the exempt list: every component must pass
//   node tools/conformance.mjs --report        which components still lack a valid table (always exits 0)
//   node tools/conformance.mjs --summary       write docs/reference/accessibility.md from the tables
//   node tools/conformance.mjs --summary --check   fail if that page is out of date
//   node tools/conformance.mjs --file F.docs.md [--traits interactive,field | --traits none]
//                                              judge one file (the fixtures use this)
//
// The exempt list is tools/conformance.exempt.json, one component name per entry. A component on
// it may fail without failing the check; one that passes while still listed is reported so its
// name can come off. Empty the list (or pass --strict) and every component must have the table.
// Exits 1 when a component not on the list has no valid table, a criterion that is not real, a
// status that is not one of the three, evidence that names a missing file, no author-owns list,
// or a required criterion with no row.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocs, validate, renderSummary, KINDS, TRAITS } from './conformance.core.js';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = path.join(REPO, 'packages', 'components');
export const SUMMARY = path.join(REPO, 'docs', 'reference', 'accessibility.md');
const EXEMPT_FILE = path.join(REPO, 'tools', 'conformance.exempt.json');

/** A file named in a table exists if it is repo-relative or beside the docs file. */
export const existsFrom = docsDir => f => {
  const clean = f.replace(/^\.\//, '').replaceAll('\\', '/');
  return fs.existsSync(path.join(REPO, clean)) || fs.existsSync(path.join(docsDir, clean));
};

export function exemptList() {
  try { return JSON.parse(fs.readFileSync(EXEMPT_FILE, 'utf8')); } catch { return []; }
}

export function componentNames(root = COMPONENTS) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(path.join(root, e.name, `${e.name}.docs.md`)))
    .map(e => e.name).sort();
}

/** Judge one docs file. `traits` null means look the component up in KINDS. */
export function checkFile(file, { name = path.basename(file).replace(/\.docs\.md$/, ''), traits = null } = {}) {
  const parsed = parseDocs(fs.readFileSync(file, 'utf8'));
  const t = traits ?? KINDS[name];
  const findings = t ? validate(parsed, { traits: t, fileExists: existsFrom(path.dirname(file)) })
    : [...parsed.problems, { rule: 'no-kind', message: `"${name}" has no entry in KINDS (tools/conformance.core.js): decide its traits first`, line: 0 }];
  return { name, file, parsed, traits: t ?? [], findings };
}

/** Every component, judged. */
export function checkLibrary({ strict = false, root = COMPONENTS } = {}) {
  const exempt = strict ? [] : exemptList();
  const results = componentNames(root).map(n => {
    const r = checkFile(path.join(root, n, `${n}.docs.md`), { name: n });
    return { ...r, exempt: exempt.includes(n) };
  });
  return {
    results,
    failing: results.filter(r => r.findings.length && !r.exempt),
    pending: results.filter(r => r.findings.length && r.exempt),
    readyToUnexempt: results.filter(r => !r.findings.length && r.exempt),
  };
}

const rel = f => path.relative(REPO, f).replaceAll('\\', '/');
const show = r => r.findings.forEach(f => console.log(`  ${rel(r.file)}${f.line ? `:${f.line}` : ''}  [${f.rule}] ${f.message}`));

function main(argv) {
  const flag = n => argv.includes(`--${n}`);
  const val = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };

  if (val('file')) {
    const tv = val('traits');
    const traits = tv == null ? null : tv === 'none' ? [] : tv.split(',');
    for (const t of traits ?? []) if (!TRAITS[t]) { console.error(`unknown trait "${t}"; one of ${Object.keys(TRAITS).join(', ')}`); return 2; }
    const nm = path.basename(val('file')).replace(/\.docs\.md$/, '');
    if (traits && KINDS[nm] && [...traits].sort().join() !== [...KINDS[nm]].sort().join()) {
      console.error(`--traits ${traits.join(',') || 'none'} disagrees with KINDS for ${nm} (${KINDS[nm].join(', ') || 'none'}): drop --traits, or change KINDS in tools/conformance.core.js`);
      return 2;
    }
    const r = checkFile(path.resolve(val('file')), { traits });
    show(r);
    console.log(r.findings.length ? `${r.findings.length} finding(s)` : 'conformance table ok');
    return r.findings.length ? 1 : 0;
  }

  const lib = checkLibrary({ strict: flag('strict') });

  if (flag('summary')) {
    const text = renderSummary(lib.results.map(r => ({ name: r.name, traits: r.traits, parsed: r.parsed })));
    if (flag('check')) {
      const have = fs.existsSync(SUMMARY) ? fs.readFileSync(SUMMARY, 'utf8') : '';
      if (have !== text) { console.error('docs/reference/accessibility.md is out of date: run node tools/conformance.mjs --summary'); return 1; }
      console.log('docs/reference/accessibility.md is up to date');
      return 0;
    }
    fs.mkdirSync(path.dirname(SUMMARY), { recursive: true });
    fs.writeFileSync(SUMMARY, text);
    console.log(`wrote ${rel(SUMMARY)} (${lib.results.filter(r => r.parsed.found).length} of ${lib.results.length} components have a table)`);
    return 0;
  }

  if (flag('report')) {
    const lacking = lib.results.filter(r => !r.parsed.found);
    const invalid = lib.results.filter(r => r.parsed.found && r.findings.length);
    console.log(`${lib.results.length - lacking.length - invalid.length} of ${lib.results.length} components have a valid conformance table.`);
    if (lacking.length) console.log(`\nNo table yet (${lacking.length}):\n  ${lacking.map(r => r.name).join(', ')}`);
    if (invalid.length) { console.log(`\nA table with findings (${invalid.length}):`); invalid.forEach(show); }
    const exempt = exemptList();
    console.log(`\nExempt list: ${exempt.length} name(s) in tools/conformance.exempt.json. ${lib.readyToUnexempt.length ? `Ready to come off: ${lib.readyToUnexempt.map(r => r.name).join(', ')}.` : ''}`);
    return 0;
  }

  for (const r of lib.failing) { console.log(`FAIL  ${r.name}`); show(r); }
  if (lib.readyToUnexempt.length) console.log(`note  ready to come off tools/conformance.exempt.json: ${lib.readyToUnexempt.map(r => r.name).join(', ')}`);
  const passing = lib.results.filter(r => !r.findings.length).length;
  console.log(`${passing} of ${lib.results.length} components have a valid table; ${lib.pending.length} pending (exempt); ${lib.failing.length} failing`);
  return lib.failing.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
