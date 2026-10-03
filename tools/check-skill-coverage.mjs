#!/usr/bin/env node
// Rung 7 of docs/requests/2026-09-28-open-the-door.md: "Nothing currently in
// SKILL.md may be lost: add a check that every heading of the old file is
// reachable from the new tree." BASELINE is every heading (outside a fenced
// code block) from SKILL.md as it stood before that reshape (commit 4d94868,
// the request's own starting point) -- fixed on purpose, since it describes
// a moment in history, not something to regenerate from a file that no
// longer has that shape. This script checks each one is still a real
// heading somewhere under SKILL.md or references/*.md.
//
//   node tools/check-skill-coverage.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

export const BASELINE = [
  'Susegad UI',
  '1. Choose a register',
  '2. Install pieces with the CLI',
  '3. Load tokens, fonts and core',
  '4. Use tokens, never raw colours',
  'Type, including Devanagari and Kannada',
  '5. Use `<sg-scene>`',
  'Attributes',
  'Slotted content and the scrim',
  '`progress` is real state',
  'Methods, properties and events',
  'Kolam: the threshold at dawn',
  'Paus: monsoon, through the glass',
  'Tollem: the pool at noon',
  '6. Use the components',
  'Which one to use',
  'Which form part to use',
  'What every form part does',
  'What every component does',
  'Progress that follows the work',
  'Progress',
  'Loader',
  'Skeleton',
  'Toast',
  'Stamp',
  'Empty state',
  'Badge',
  'Field note',
  'Connecting',
  'Form',
  'Field',
  'Select',
  'Combobox',
  'Check',
  'Radio group',
  'Toggle',
  'Date range',
  'Stepper',
  'File drop',
  'Signature',
  'One-time code',
  '7. Recipes',
  '8. Write a Folio document',
  'Markdown with directives',
  "The diagram's line grammar",
  'The timeline, in two forms',
  'Footnotes',
  'Build, seal and verify',
  'Print',
  'The proposal recipe',
  '9. Add sound, narration and video',
  'The switch and the vocabulary (`sound`)',
  'Soundscapes',
  'Narration (`narration`)',
  'The player (`player`) and export (`export`)',
  '10. Build a new piece',
  '11. Copy standards',
  '12. Before you say "done"',
  '13. Gates and tools',
];

/** Headings (outside fenced code blocks) from one Markdown file's text. */
export function headingsOf(text) {
  const out = [];
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^(#{1,4})\s+(.+)$/);
    if (m) out.push(m[2].trim());
  }
  return out;
}

/** SKILL.md plus every references/*.md file's headings, from disk, as one set. */
export function newTreeHeadings(root = ROOT) {
  const referencesDir = join(root, 'references');
  const files = [join(root, 'SKILL.md'), ...readdirSync(referencesDir).filter(f => f.endsWith('.md')).map(f => join(referencesDir, f))];
  const found = new Set();
  for (const f of files) for (const h of headingsOf(readFileSync(f, 'utf8'))) found.add(h);
  return found;
}

/** @returns {string[]} baseline headings with no matching heading in the new tree */
export function missing(root = ROOT) {
  const found = newTreeHeadings(root);
  return BASELINE.filter(h => !found.has(h));
}

function main() {
  const gone = missing(ROOT);
  if (gone.length) {
    console.error(`${gone.length} heading(s) from the old SKILL.md are not reachable from SKILL.md or references/*.md:`);
    for (const h of gone) console.error(`  - ${h}`);
    return 1;
  }
  console.log(`All ${BASELINE.length} headings from the old SKILL.md are reachable from the new tree.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
