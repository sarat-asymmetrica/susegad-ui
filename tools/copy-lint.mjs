// The copy rules, checked (docs/requests/2026-10-02-lighter-gate.md, C).
//
//   node tools/copy-lint.mjs [--all | paths...]
//
// Scans the words a reader meets: *.docs.md and *.prompt.md beside every piece, the demo
// pages' text, the docs site's own HTML and Markdown, and the strings in code: each scene's
// meta.js, every *strings*.js under packages/ (agenda and speakers keep their BY_LANG in *.strings.js, the event template its COPY in strings.js), core/strings.table.js
// and every file that exports STRINGS (only its string literals; comments are code talk and are left
// alone). No em dashes (the charter names the em dash only: an en dash in a range such as 9–5 is
// legitimate, so U+2013 is not linted); none of the hedges the copy kernel names
// (kathakar A3: never announce honesty).
//
//   node tools/copy-lint.mjs [paths...]     paths given: scan just those (a fixture run);
//                                           none: scan every file in scope
//
// Exit 1 when anything violates; every hit is printed with its line.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lex } from './lib/mutants.core.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The hedges the copy kernel names: never announce honesty or transparency; be accurate.
 * These are the announcing forms only. "Lay it transparently over a row of boxes" (visual
 * opacity) or "honestly held open" (a mechanism described) are not announcements, and a
 * word list cannot tell every case, so the announcing phrases are what is linted and the
 * finer judgement stays with the reviewer. */
export const HEDGES = [
  ['to be honest', 'announce honesty'],
  ['honestly,', 'announce honesty'],
  ['to be clear', 'announce clarity'],
  ['frankly', 'announce honesty'],
  ['transparency', 'announce transparency'],
];

/** The one rule per line: find it in a file's text, return its violations. */
export function lintText(text) {
  const hits = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const n = i + 1;
    for (const dash of ['—', '―', '‒']) {
      if (line.includes(dash)) hits.push({ line: n, rule: 'no em dashes', text: line.trim().slice(0, 100) });
    }
    const lower = line.toLowerCase();
    for (const [phrase, why] of HEDGES) {
      if (lower.includes(phrase)) hits.push({ line: n, rule: `hedge: ${why} ("${phrase}")`, text: line.trim().slice(0, 100) });
    }
  });
  return hits;
}

/**
 * The words in a JS module: its string and template literals, found by the mutant guard's lexer so a comment,
 * a regex or an identifier never counts. Line numbers are the file's own.
 */
export function lintJsStrings(src) {
  const hits = [];
  for (const t of lex(src)) {
    if (t.t !== 'str' && t.t !== 'tpl') continue;
    const text = t.v ?? src.slice(t.start, t.end); // a template with ${} is read as written
    for (const h of lintText(text)) hits.push({ ...h, line: t.line + h.line - 1 });
  }
  return hits;
}

/** Files that hold copy by name: any strings.js, *.strings.js (BY_LANG tables, the event template's COPY) or strings.table.js under packages/, whatever the export is called. */
export const isStringsFile = name => /(^|\.)strings(\.table)?\.js$/.test(name);

/** Does this source export STRINGS (the words a component adds)? */
export const exportsStrings = src => /export\s+(?:const|let|var)\s+STRINGS\b|export\s*\{[^}]*\bSTRINGS\b/.test(src);

/** An HTML page's words: tags out, entities decoded enough for the lint to read. */
export function htmlText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–');
}

/** Every file in the lint's scope, repo-rooted. */
export function scope() {
  const out = [];
  const walk = dir => {
    for (const e of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.(docs|prompt)\.md$/.test(e.name) || e.name === 'demo.html' || (dir.startsWith('apps/docs') && /\.(html|md)$/.test(e.name))) out.push(p);
      else if (e.name === 'meta.js' || (dir.startsWith('packages') && isStringsFile(e.name)) || (/\.js$/.test(e.name) && !/\.(test|check)\.js$/.test(e.name) && dir.startsWith('packages') && exportsStrings(fs.readFileSync(path.join(REPO, p), 'utf8')))) out.push(p);
    }
  };
  if (fs.existsSync(path.join(REPO, 'packages'))) walk('packages');
  if (fs.existsSync(path.join(REPO, 'apps/docs'))) walk('apps/docs');
  return out;
}

export function lintFiles(paths) {
  const findings = [];
  for (const p of paths) {
    const abs = path.join(REPO, p);
    if (!fs.existsSync(abs)) { findings.push({ file: p, line: 0, rule: 'file not found', text: '' }); continue; }
    const raw = fs.readFileSync(abs, 'utf8');
    const hits = abs.endsWith('.js') ? lintJsStrings(raw) : lintText(abs.endsWith('.html') ? htmlText(raw) : raw);
    for (const h of hits) findings.push({ file: p, ...h });
  }
  return findings;
}

// Only when run as a script: a test importing lintFiles used to run the whole lint and exit before it registered a single test.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const paths = argv.filter(a => !a.startsWith('--'));
  const targets = paths.length ? paths : scope();
  const findings = lintFiles(targets);
  for (const f of findings) console.log(`${f.file}:${f.line}  ${f.rule}  ${f.text}`);
  console.log(`${targets.length} file(s) scanned, ${findings.length} finding(s)`);
  process.exit(findings.length ? 1 : 0);
}
