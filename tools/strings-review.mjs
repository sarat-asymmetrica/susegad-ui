// Which of the library's Konkani words has a native reader not yet checked (decision 0025).
//
//   node tools/strings-review.mjs            prints the count per language and the keys; always exits 0 (a warning)
//   node tools/strings-review.mjs --strict   exits 1 while any key is unchecked (for a release that waits for a reader)
//   node tools/strings-review.mjs --json
//
// A key is checked when '<tag>:<key>' is in REVIEWED (packages/core/strings.table.js), which a native reader's
// sign-off adds. Until then Konkani ships as a flagged draft, and `npm run check` prints this report.

import { pathToFileURL } from 'node:url';
import { BY_LANG, REVIEWED } from '../packages/core/strings.table.js';
import { unreviewed } from '../packages/core/strings.js';

/** One row per non-English language: its tag, how many keys are written, and which are unchecked or missing. */
export function report(byLang = BY_LANG, reviewed = REVIEWED) {
  return Object.keys(byLang).filter(t => t !== 'en').map(tag => {
    const { unchecked, missing } = unreviewed(byLang, tag, reviewed);
    return { tag, written: Object.keys(byLang[tag]).length, unchecked, missing };
  });
}

export function format(rows) {
  const lines = [];
  for (const r of rows) {
    lines.push(`${r.tag}: ${r.unchecked.length} of ${r.written} written keys not yet checked by a native reader${r.missing.length ? `; ${r.missing.length} English keys have no draft (${r.missing.join(', ')})` : ''}`);
    if (r.unchecked.length) lines.push(`  ${r.unchecked.join(', ')}`);
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = report();
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else console.log(`Konkani strings awaiting a native reader (decision 0025, warn only)\n${format(rows)}`);
  const open = rows.reduce((n, r) => n + r.unchecked.length + r.missing.length, 0);
  process.exit(process.argv.includes('--strict') && open ? 1 : 0);
}
