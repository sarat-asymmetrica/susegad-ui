// Fold the JSON files that SG_PROFILE=1 checks write (tools/lib/profile.mjs) into one markdown table.
//
//   SG_PROFILE=1 node packages/scenes/chiro/chiro.check.mjs
//   node tools/profile.mjs [.shots/profile]

import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? '.shots/profile');
const rows = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const CATS = ['launch', 'ctx-new', 'nav', 'step-ready', 'wait-ready', 'step', 'wait-real', 'wait-fn', 'grab', 'shot', 'axe', 'eval', 'pw-input', 'node', 'ctx-close', 'close'];
const cell = (r, c) => (r.cats[c]?.s ?? 0).toFixed(1);
console.log(`| check | total s | CPU % | ${CATS.join(' | ')} |`);
console.log(`|${' --- |'.repeat(CATS.length + 3)}`);
for (const r of rows) console.log(`| ${r.check} | ${r.total_s} | ${r.cpu_busy} | ${CATS.map(c => cell(r, c)).join(' | ')} |`);
console.log('');
console.log('| check | contexts | navigations | matrix cells | frames | to ready | approach to first read | between first and last read | after last read | ms/frame | sleeps (n, s) |');
console.log(`|${' --- |'.repeat(11)}`);
for (const r of rows) console.log(`| ${r.check} | ${r.contexts} | ${r.navigations} | ${r.matrix_cells} | ${r.frames.total} | ${r.frames.to_ready} | ${r.frames.approach_to_first_read} | ${r.frames.between_first_and_last_read} | ${r.frames.tail_after_last_read} | ${r.frames.ms_per_frame ?? '-'} | ${r.waits.windows}, ${(r.waits.ms_total / 1000).toFixed(1)} |`);
