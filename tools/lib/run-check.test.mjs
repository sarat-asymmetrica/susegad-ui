import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck } from './run-check.mjs';

const fixture = name => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sg-runcheck-test-'));

test('a check holds one slot, its own helpers do not take a second, and the slot is freed after (SG_BROWSER_SLOTS=1: no deadlock)', async () => {
  const dir = tmp();
  const env = { ...process.env, SG_BROWSER_SLOTS: '1', SG_SLOTS_DIR: dir, SG_SLOT_HELD: '' };
  const r = await Promise.race([runCheck(fixture('slot-child.mjs'), { env, timeoutS: 20 }), new Promise(res => setTimeout(() => res('deadlock'), 15000).unref())]);
  assert.notEqual(r, 'deadlock');
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /held=1 locks=1 label=slot-child\.mjs childPid=true/);
  assert.deepEqual(fs.readdirSync(dir).filter(f => f.endsWith('.lock')), []);
});

test('a failing check still frees its slot', async () => {
  const dir = tmp();
  const env = { ...process.env, SG_BROWSER_SLOTS: '1', SG_SLOTS_DIR: dir, SG_SLOT_HELD: '' };
  const r = await runCheck(fixture('no-such-check.mjs'), { env, timeoutS: 20 });
  assert.equal(r.status, 1);
  assert.deepEqual(fs.readdirSync(dir).filter(f => f.endsWith('.lock')), []);
});

// On Linux the old killTree sent SIGKILL to the check alone: its browser lived on with the stdout pipe
// open, 'close' never fired, and the whole run waited forever (check (firefox) on CI, 6 Oct 2026, silent
// for five hours). The fixture's grandchild stands in for the browser.
test('a check that times out is killed with its grandchildren, and the runner moves on', { timeout: 60000 }, async () => {
  const dir = tmp();
  const env = { ...process.env, SG_BROWSER_SLOTS: '1', SG_SLOTS_DIR: dir, SG_SLOT_HELD: '' };
  const r = await Promise.race([runCheck(fixture('grandchild-hang.mjs'), { env, timeoutS: 2 }), new Promise(res => setTimeout(() => res('still waiting'), 20000).unref())]);
  assert.notEqual(r, 'still waiting', 'runCheck never returned after the timeout');
  assert.equal(r.timedOut, true);
  const pid = Number(r.out.match(/grandchild=(\d+)/)?.[1]);
  assert.ok(pid > 0, r.out);
  let alive = true;
  for (let i = 0; i < 50 && alive; i++) {
    try { process.kill(pid, 0); await new Promise(res => setTimeout(res, 100)); } catch { alive = false; }
  }
  assert.equal(alive, false, `grandchild ${pid} outlived the kill`);
  assert.deepEqual(fs.readdirSync(dir).filter(f => f.endsWith('.lock')), []);
});
