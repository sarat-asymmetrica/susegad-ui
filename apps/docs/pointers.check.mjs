// No pointers a reader cannot follow: the texts the site renders must not send a reader
// to a private path (docs/briefs, docs/reviews, docs/requests, docs/LEDGER, docs/GOAL...)
// or to an agent's own report or review.
//
//   node apps/docs/pointers.check.mjs        exits 1 on any, printing file:line
//
// The build runs this too. What it reads: every Markdown file of every registry item (the
// docs, the prompts and the readmes the site shows or ships), the three reference pages
// the site renders (HANDOFF, BROWSERS, the accessibility summary), the site's own pages
// and each scene's words.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isPrivate } from '../../tools/publish/export.mjs';
import { unfollowable } from './pointers.core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
/** Source with its comments taken out: a whole-line comment and a block comment are notes to the maker, not words a reader meets. */
export const withoutComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

export const REFERENCE_PAGES = ['docs/HANDOFF.md', 'docs/BROWSERS.md', 'docs/reference/accessibility.md'];

/** Everything the site renders or ships as words, as { file, text } entries. */
export async function renderedTexts(root = ROOT, registry = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'registry.json'), 'utf8'))) {
  const seen = new Set();
  const entries = [];
  const add = rel => {
    if (!rel || seen.has(rel) || !fs.existsSync(path.join(root, rel))) return;
    seen.add(rel);
    entries.push({ file: rel, text: fs.readFileSync(path.join(root, rel), 'utf8') });
  };
  for (const item of registry.items) {
    add(item.docs); add(item.prompt);
    for (const f of item.files) if (/\.md$/i.test(f.path)) add(f.path);
    add(path.posix.join(path.posix.dirname(item.manifest), 'README.md')); // the readme beside the manifest
  }
  REFERENCE_PAGES.forEach(add);
  for (const f of fs.readdirSync(HERE)) if (/\.(html|md)$/.test(f) && f !== 'README.md') entries.push({ file: `apps/docs/${f}`, text: fs.readFileSync(path.join(HERE, f), 'utf8') });
  // the words of the pages are written in code (words.core.js, the page generators): their strings, not their comments
  for (const f of fs.readdirSync(HERE)) {
    if (!/\.m?js$/.test(f) || /\.(test|check)\.m?js$/.test(f) || /^(build|pages|posters|joined|door-shots)\.mjs$/.test(f)) continue;
    entries.push({ file: `apps/docs/${f}`, text: withoutComments(fs.readFileSync(path.join(HERE, f), 'utf8')) });
  }
  for (const item of registry.items.filter(i => i.type === 'scene')) {
    const f = path.join(root, 'packages', 'scenes', item.name.replace(/^scene-/, ''), 'meta.js');
    if (fs.existsSync(f)) entries.push({ file: path.relative(root, f).split(path.sep).join('/'), text: JSON.stringify((await import(pathToFileURL(f).href)).meta, null, 1) });
  }
  return entries;
}

export async function checkPointers(root = ROOT) {
  const entries = await renderedTexts(root);
  return { found: unfollowable(entries, isPrivate), read: entries.length };
}

/**
 * The same rule over what the build wrote: every page and text file of the site outside packages/ and registry/ (the
 * words of the new pages live in code, words.core.js and the page generators, so only the output shows them).
 */
export function checkBuiltPointers(dir) {
  const entries = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!['packages', 'registry', 'r', 'posters', 'tools'].includes(e.name) || d !== dir) walk(p); continue; }
      if (/\.(html|txt)$/i.test(e.name)) entries.push({ file: path.relative(dir, p).split(path.sep).join('/'), text: fs.readFileSync(p, 'utf8') });
    }
  })(dir);
  return { found: unfollowable(entries, isPrivate), read: entries.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { found, read } = process.argv.includes('--out') ? checkBuiltPointers(path.resolve(process.argv[process.argv.indexOf('--out') + 1])) : await checkPointers();
  for (const f of found) console.error(`  ${f.file}:${f.line}  ${f.what}  (${f.why})`);
  console.log(`${found.length ? 'FAIL' : 'pass'}  pointers a reader cannot follow: ${read} texts read, ${found.length} found`);
  process.exit(found.length ? 1 : 0);
}
