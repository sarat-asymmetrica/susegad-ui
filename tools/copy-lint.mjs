// The copy rules, checked (docs/requests/2026-10-02-lighter-gate.md, C).
//
//   node tools/copy-lint.mjs [--all | paths...]
//
// Scans the words a reader meets: *.docs.md and *.prompt.md beside every piece, the demo
// pages' text, and the docs site's own HTML and Markdown. No em dashes; none of the
// hedges the copy kernel names (kathakar A3: never announce honesty).
//
//   node tools/copy-lint.mjs [paths...]     paths given: scan just those (a fixture run);
//                                           none: scan every file in scope
//
// Exit 1 when anything violates; every hit is printed with its line.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
    const text = abs.endsWith('.html') ? htmlText(fs.readFileSync(abs, 'utf8')) : fs.readFileSync(abs, 'utf8');
    for (const h of lintText(text)) findings.push({ file: p, ...h });
  }
  return findings;
}

const argv = process.argv.slice(2);
const paths = argv.filter(a => !a.startsWith('--'));
const targets = paths.length ? paths : scope();
const findings = lintFiles(targets);
for (const f of findings) console.log(`${f.file}:${f.line}  ${f.rule}  ${f.text}`);
console.log(`${targets.length} file(s) scanned, ${findings.length} finding(s)`);
process.exit(findings.length ? 1 : 0);
