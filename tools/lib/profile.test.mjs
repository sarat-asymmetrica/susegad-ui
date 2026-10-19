// The check profiler (profile.mjs): off it does nothing, on it keeps exclusive time per category.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const MOD = new URL('./profile.mjs', import.meta.url).href;
const run = (on, body) => spawnSync(process.execPath, ['--input-type=module', '-e',
  `import { span, profile, markClause } from '${MOD}'; const nap = ms => new Promise(r => setTimeout(r, ms)); ${body}`],
  { env: { ...process.env, SG_PROFILE: on ? '1' : '' }, encoding: 'utf8' });

test('off, span hands back what the function returns and keeps nothing', () => {
  const r = run(false, "console.log(JSON.stringify([await span('x', async () => 7), Object.keys(profile('t', 'chromium').cats)]));");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '[7,["node"]]');
});

test('on, time is exclusive: a weak span inside a strong one counts for the strong one', () => {
  const r = run(true, `
    await span('outer', async () => { await nap(80); await span('inner', () => nap(80), { weak: true }); });
    await span('strong', async () => { await span('nested', () => nap(80)); });
    const p = profile('t', 'chromium'); markClause('c', true);
    console.log(JSON.stringify(p.cats));`);
  assert.equal(r.status, 0, r.stderr);
  const cats = JSON.parse(r.stdout.trim());
  assert.ok(cats.outer.s >= 0.15 && !cats.inner, `outer should hold both naps, weak inner nothing: ${r.stdout}`);
  assert.ok(cats.nested.s >= 0.07 && cats.strong.s < 0.05, `a strong span inside another takes the time: ${r.stdout}`);
});
