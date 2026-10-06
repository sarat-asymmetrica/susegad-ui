// A deliberately flaky command, for tools/until-fail.mjs's test. It fails when the run
// count (kept in a scratch file, never committed) is odd: green, red, green, red...
//
//   node tools/fixtures/until-fail/flaky.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const state = path.join(os.tmpdir(), 'until-fail-flaky.json');
const n = (fs.existsSync(state) ? JSON.parse(fs.readFileSync(state, 'utf8')).n : 0) + 1;
fs.writeFileSync(state, JSON.stringify({ n }));
console.log(`flaky run ${n}`);
if (n % 2 === 0) {
  console.log('the flake failed, as arranged');
  console.log('    at the long stack line the flake prints');
  process.exit(1);
}
