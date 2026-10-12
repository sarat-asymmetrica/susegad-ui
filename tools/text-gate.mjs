// The text gate: does the library's text fit the shapes it is laid into, in every language, without a browser?
//
//   node tools/text-gate.mjs                 the whole manifest, every language and viewport; exits 1 on any failure
//   node tools/text-gate.mjs --use tinto.board --lang kn
//   node tools/text-gate.mjs --json          the rows as JSON
//
// It lays each use's real copy (packages/type/fixtures/gate-copy.js) into the real shape, from the scene's pure model,
// through the real setBlocks / layIntoShape / labelBox on the real vendored Pretext, which measures with HarfBuzz and
// the library's own font files (tools/lib/hb-canvas.mjs). Node only: it never takes a browser slot. See
// packages/type/README.md ("The text gate") and lib/text-gate.core.js for what each result means.
import { runTextGate, LANGS } from './lib/text-gate.run.mjs';
import { formatTable } from './lib/text-gate.core.js';

const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null; };
const t0 = performance.now();
const lang = arg('lang'), id = arg('use');
if (lang && !LANGS.includes(lang)) { console.error(`--lang must be one of ${LANGS.join(', ')}`); process.exit(2); }
const { rows, failed, epsilon, calibration, shaper } = await runTextGate({ langs: lang ? [lang] : LANGS, only: id ? { id } : undefined });
if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); process.exit(failed.length ? 1 : 0); }

console.log(formatTable(rows));
console.log(`\nepsilon ${epsilon} px (HarfBuzz vs Chromium ${calibration.chromium}, calibrated ${calibration.date}); ${((performance.now() - t0) / 1000).toFixed(1)} s`);
const here = `${process.platform} ${process.arch}`;
if (calibration.platform !== here) console.log(`WARNING: the calibration was made on ${calibration.platform}; this is ${here}. Run node tools/text-gate.calibrate.mjs here once: another platform's Chromium may round or hint advances differently.`);
if (shaper.unmodelled.size) console.log(`WARNING: no declared face covers ${[...shaper.unmodelled.keys()].join(' ')}: a browser draws these from a system font, so their widths are a stand-in`);
const n = r => rows.filter(x => x.result === r).length;
const warned = rows.reduce((a, r) => a + (r.warnings?.length ?? 0), 0);
console.log(`${rows.length} cells: ${n('fits')} fit, ${n('falls-back')} fall back, ${n('escapes')} escape, ${n('not-gated')} not gated; ${failed.length} failing; ${warned} warning${warned === 1 ? '' : 's'}${warned ? ' (see warn: lines)' : ''}`);
if (failed.length) console.log('Each failing cell is marked FAIL in the table, with its reason under it on a line that starts with !.');
process.exit(failed.length ? 1 : 0);
