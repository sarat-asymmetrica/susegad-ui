// The slot files for real: the wx create, the wait, the stale reclaim, the held-in-env bypass.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireSlot } from './slots.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sg-slots-test-'));
const quiet = { log: () => {}, pollMs: 15 };
const lockFiles = dir => fs.readdirSync(dir).filter(f => f.endsWith('.lock'));
const never = ms => new Promise(r => setTimeout(() => r('still waiting'), ms));

test('two concurrent acquirers with one slot do not both hold it', async () => {
  const dir = tmp();
  const env = { SG_BROWSER_SLOTS: '1' };
  const a = await acquireSlot({ label: 'a', dir, env, ...quiet });
  let bGot = false;
  const bP = acquireSlot({ label: 'b', dir, env, ...quiet }).then(r => { bGot = true; return r; });
  assert.equal(await Promise.race([bP, never(200)]), 'still waiting');
  assert.equal(bGot, false);
  assert.equal(lockFiles(dir).length, 1);
  a();
  const b = await bP;
  assert.equal(lockFiles(dir).length, 1);
  b();
  assert.equal(lockFiles(dir).length, 0);
});

test('many racing acquirers never exceed the limit', async () => {
  const dir = tmp();
  const env = { SG_BROWSER_SLOTS: '2' };
  let inside = 0, peak = 0;
  await Promise.all(Array.from({ length: 8 }, async (_, i) => {
    const release = await acquireSlot({ label: `w${i}`, dir, env, ...quiet });
    inside++; peak = Math.max(peak, inside);
    await new Promise(r => setTimeout(r, 25));
    inside--; release();
  }));
  assert.equal(peak, 2);
  assert.equal(lockFiles(dir).length, 0);
});

test('a slot whose owner is gone is reclaimed', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'slot-0.lock'), JSON.stringify({ pid: 2 ** 22 - 3, label: 'ghost', startedAt: 'x', token: 'dead' }));
  const release = await Promise.race([acquireSlot({ label: 'live', dir, env: { SG_BROWSER_SLOTS: '1' }, ...quiet }), never(2000)]);
  assert.notEqual(release, 'still waiting');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'slot-0.lock'), 'utf8')).label, 'live');
  release();
});

test('waiting prints one line, once, naming the holder', async () => {
  const dir = tmp();
  const env = { SG_BROWSER_SLOTS: '1' };
  const lines = [];
  const a = await acquireSlot({ label: 'first-holder', dir, env, ...quiet });
  const bP = acquireSlot({ label: 'b', dir, env, pollMs: 15, log: l => lines.push(l) });
  await never(150);
  a();
  (await bP)();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /waiting for a browser slot \(held by: first-holder/);
});

test('a process that already holds a slot does not take another', async () => {
  const dir = tmp();
  const env = { SG_BROWSER_SLOTS: '1', SG_SLOT_HELD: '1' };
  const a = await acquireSlot({ label: 'a', dir, env, ...quiet });
  const b = await Promise.race([acquireSlot({ label: 'b', dir, env, ...quiet }), never(300)]);
  assert.notEqual(b, 'still waiting');
  assert.equal(lockFiles(dir).length, 0);
  a(); b();
});

test('SG_BROWSER_SLOTS=0 means no limit and no files', async () => {
  const dir = tmp();
  const env = { SG_BROWSER_SLOTS: '0' };
  const rs = await Promise.all([1, 2, 3, 4, 5].map(i => acquireSlot({ label: `n${i}`, dir, env, ...quiet })));
  assert.equal(lockFiles(dir).length, 0);
  rs.forEach(r => r());
});

test('release is idempotent and leaves a successor slot alone', async () => {
  const dir = tmp();
  const env = { SG_BROWSER_SLOTS: '1' };
  const a = await acquireSlot({ label: 'a', dir, env, ...quiet });
  a();
  const b = await acquireSlot({ label: 'b', dir, env, ...quiet });
  a(); // a second release of a must not free the slot b now holds
  assert.equal(lockFiles(dir).length, 1);
  b();
});

test('adopt records the child pid, which keeps the slot held', async () => {
  const dir = tmp();
  const env = { SG_BROWSER_SLOTS: '1' };
  const a = await acquireSlot({ label: 'a', dir, env, ...quiet });
  a.adopt(process.pid);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'slot-0.lock'), 'utf8')).childPid, process.pid);
  a();
});

test('separate processes racing for one slot never overlap', async () => {
  const { spawn } = await import('node:child_process');
  const dir = tmp();
  const log = path.join(dir, 'log.txt');
  fs.writeFileSync(log, '');
  const worker = fileURLToPath(new URL('../fixtures/slot-worker.mjs', import.meta.url));
  const env = { ...process.env, SG_BROWSER_SLOTS: '1', SG_SLOTS_DIR: dir, SG_SLOT_HELD: '' };
  await Promise.all(Array.from({ length: 8 }, () => new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [worker, log, '40'], { env, stdio: 'ignore' });
    c.on('exit', code => code === 0 ? resolve() : reject(new Error(`worker exited ${code}`)));
  })));
  const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
  assert.equal(lines.length, 16);
  lines.forEach((l, i) => assert.equal(l.split(' ')[0], i % 2 === 0 ? 'in' : 'out', `overlap at line ${i}: ${lines.join(' | ')}`));
});

// ---- first come, first served, with real files ----
const tickets = dir => fs.readdirSync(dir).filter(f => f.startsWith('wait-'));

test('starvation: a runner that releases and asks again at once cannot jump the waiter', async () => {
  const dir = tmp();
  const env = { SG_BROWSER_SLOTS: '1' };
  let runnerTurns = 0, waiterIn = false, turnsAfterWaiterAsked = 0;
  let waiterAsked = false;
  const runner = (async () => {
    while (!waiterIn && runnerTurns < 200) {
      const release = await acquireSlot({ label: 'runner', dir, env, ...quiet });
      runnerTurns++; if (waiterAsked) turnsAfterWaiterAsked++;
      await new Promise(r => setTimeout(r, 10));
      release(); // and straight round again, as checks.mjs does
    }
  })();
  await new Promise(r => setTimeout(r, 60));
  waiterAsked = true;
  const release = await acquireSlot({ label: 'waiter', dir, env, ...quiet });
  waiterIn = true;
  release();
  await runner;
  assert.ok(turnsAfterWaiterAsked <= 2, `the runner took ${turnsAfterWaiterAsked} more turns after the waiter asked`);
  assert.deepEqual(tickets(dir), []);
});

test('three waiters behind a holder are served in the order they asked', async () => {
  const dir = tmp();
  const env = { SG_BROWSER_SLOTS: '1' };
  const holder = await acquireSlot({ label: 'holder', dir, env, ...quiet });
  const order = [];
  const asks = [];
  for (const name of ['a', 'b', 'c']) {
    asks.push(acquireSlot({ label: name, dir, env, ...quiet }).then(r => { order.push(name); return new Promise(res => setTimeout(() => { r(); res(); }, 20)); }));
    await new Promise(r => setTimeout(r, 12)); // distinct tickets, in order
  }
  assert.equal(tickets(dir).length, 3);
  holder();
  await Promise.all(asks);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.deepEqual(tickets(dir), []);
});

test('a ticket of a dead pid, and one that went quiet, do not hold anyone back and are cleared', async () => {
  const dir = tmp();
  const ms = Date.now() - 1000;
  const dead = `wait-${String(ms).padStart(14, '0')}-000000-${2 ** 22 - 3}-aaaaaa`;
  const quietOne = `wait-${String(ms + 1).padStart(14, '0')}-000000-${process.pid}-bbbbbb`; // a live pid that never polls again
  fs.writeFileSync(path.join(dir, dead), '');
  fs.writeFileSync(path.join(dir, quietOne), '');
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(path.join(dir, quietOne), old, old);
  const release = await Promise.race([acquireSlot({ label: 'live', dir, env: { SG_BROWSER_SLOTS: '1' }, ...quiet }), never(2000)]);
  assert.notEqual(release, 'still waiting');
  assert.deepEqual(tickets(dir), []);
  release();
});

test('a waiter keeps its ticket fresh while it waits, and removes it when it takes the slot', async () => {
  const dir = tmp();
  const env = { SG_BROWSER_SLOTS: '1' };
  const a = await acquireSlot({ label: 'a', dir, env, ...quiet });
  const bP = acquireSlot({ label: 'b', dir, env, ...quiet });
  await never(60);
  const [t] = tickets(dir);
  assert.ok(t, 'b has a ticket while it waits');
  const first = fs.statSync(path.join(dir, t)).mtimeMs;
  await never(80);
  assert.ok(fs.statSync(path.join(dir, t)).mtimeMs > first, 'touched on each poll');
  a();
  (await bP)();
  assert.deepEqual(tickets(dir), []);
});

test('a waiter whose ticket is cleared away puts it back and keeps its turn', async () => {
  const dir = tmp();
  const env = { SG_BROWSER_SLOTS: '1' };
  const a = await acquireSlot({ label: 'a', dir, env, ...quiet });
  const bP = acquireSlot({ label: 'b', dir, env, ...quiet });
  await never(40);
  const [t] = tickets(dir);
  fs.unlinkSync(path.join(dir, t));
  await never(60);
  assert.deepEqual(tickets(dir), [t], 'same name, so the same place in the queue');
  a();
  (await bP)();
});

test('no-limit and already-held paths leave no tickets', async () => {
  const dir = tmp();
  (await acquireSlot({ dir, env: { SG_BROWSER_SLOTS: '0' }, ...quiet }))();
  (await acquireSlot({ dir, env: { SG_BROWSER_SLOTS: '1', SG_SLOT_HELD: '1' }, ...quiet }))();
  assert.deepEqual(fs.readdirSync(dir), []);
});
