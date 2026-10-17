// Every browser session() takes a machine-wide slot (tools/lib/slots.mjs) and only done() gives it back.
// A file that opens more sessions than it closes holds a slot until its process exits, and with two slots
// a tool that then waits for another one deadlocks on itself (review-pack's tileSheet, 8 October 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.worktrees', '.shots', 'out']);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.m?js$/.test(e.name)) yield p;
  }
}

export function unreleased(src) {
  const opened = (src.match(/await session\(/g) ?? []).length;
  const closed = (src.match(/\.done\(\)/g) ?? []).length;
  return closed < opened ? { opened, closed } : null;
}

test('unreleased() reads red on a session without done()', () => {
  assert.deepEqual(unreleased('const s = await session(); await s.browser.newPage();'), { opened: 1, closed: 0 });
  assert.equal(unreleased('const s = await session(); try { } finally { await s.done(); }'), null);
});

test('every file closes as many browser sessions as it opens', () => {
  const bad = [];
  for (const root of ['tools', 'packages', 'apps']) {
    for (const f of walk(path.join(REPO, root))) {
      if (f === fileURLToPath(import.meta.url)) continue; // its own red sample
      const u = unreleased(fs.readFileSync(f, 'utf8'));
      if (u) bad.push(`${path.relative(REPO, f).split(path.sep).join('/')}: ${u.opened} session(), ${u.closed} done()`);
    }
  }
  assert.deepEqual(bad, []);
});

// A unit test that launches a browser runs inside `npm test`, beside the checks: it takes a slot too, or it
// thrashes a loaded machine and times out (saving-footer's browser test, 8 October 2026).
// String literals are left out first: a test of a source scanner (tools/lib/chromium-only.core.test.mjs) quotes
// "chromium.launch()" as a fixture and launches nothing.
const withoutStrings = src => src.replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
export const launchesWithoutSlot = src => /\.launch\(/.test(withoutStrings(src)) && !/acquireSlot|await session\(/.test(src);

test('launchesWithoutSlot() reads red on a bare launch', () => {
  assert.equal(launchesWithoutSlot('const b = await chromium.launch();'), true);
  assert.equal(launchesWithoutSlot("import { acquireSlot } from 'x'; await chromium.launch();"), false);
});

test('launchesWithoutSlot() does not count a launch quoted in a string', () => {
  assert.equal(launchesWithoutSlot(`assert.equal(scan("const b = await chromium.launch({ args: [] });"), true);`), false);
  assert.equal(launchesWithoutSlot("const s = 'chromium.launch()'; const b = await webkit.launch();"), true, 'a real launch beside a quoted one still counts');
});

test('every unit test that launches a browser takes a slot', () => {
  const bad = [];
  for (const root of ['tools', 'packages', 'apps', 'registry']) {
    for (const f of walk(path.join(REPO, root))) {
      if (!/\.test\.m?js$/.test(f) || f === fileURLToPath(import.meta.url)) continue;
      if (launchesWithoutSlot(fs.readFileSync(f, 'utf8'))) bad.push(path.relative(REPO, f).split(path.sep).join('/'));
    }
  }
  assert.deepEqual(bad, []);
});
