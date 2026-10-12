#!/usr/bin/env node
// A real-process race for tools/lib/slots.mjs: does a waiter starve behind a runner that releases its
// slot and asks again at once (what tools/checks.mjs does between checks)?
//
//   node tools/slots-race.mjs [--turns 60] [--hold 40] [--waiters 1] [--lib <path to a slots.mjs>]
//
// One slot, in a throwaway directory (never the real one). The runner takes the slot, holds it, releases
// it and takes it again, --turns times. Waiters arrive while it runs. Prints how long each waiter waited and how many runner
// turns went by after it asked. Exit 0 either way: it reports, the tests in slots.test.mjs assert.
//
//   --lib   import acquireSlot from another copy of slots.mjs (to replay the race on the old code)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const here = fileURLToPath(import.meta.url);
const libPath = path.resolve(opt('lib', path.join(path.dirname(here), 'lib', 'slots.mjs')));
const role = opt('role', 'main');

if (role !== 'main') {
  const { acquireSlot } = await import(pathToFileURL(libPath).href);
  const log = opt('log'), hold = Number(opt('hold', 40)), turns = Number(opt('turns', 60));
  const note = line => fs.appendFileSync(log, `${Date.now()} ${role} ${process.pid} ${line}\n`);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  if (role === 'runner') {
    for (let i = 1; i <= turns; i++) {
      const release = await acquireSlot({ label: 'runner', pollMs: 500, log: () => {} });
      note(`in ${i}`); await sleep(hold); note(`out ${i}`); release(); // and straight back round
    }
  } else {
    await sleep(Number(opt('arrive', 300)));
    note('asks');
    const release = await acquireSlot({ label: 'waiter', pollMs: 500, log: () => {} });
    note('in'); await sleep(hold); note('out'); release();
  }
  process.exit(0);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-slots-race-'));
const log = path.join(dir, 'log.txt');
fs.writeFileSync(log, '');
const waiters = Number(opt('waiters', 1)), turns = Number(opt('turns', 60)), hold = Number(opt('hold', 40));
const env = { ...process.env, SG_BROWSER_SLOTS: '1', SG_SLOTS_DIR: dir, SG_SLOT_HELD: '' };
const run = (r, extra = []) => new Promise((resolve, reject) => {
  const c = spawn(process.execPath, [here, '--role', r, '--log', log, '--turns', turns, '--hold', hold, '--lib', libPath, ...extra], { env, stdio: 'inherit' });
  c.on('exit', code => code === 0 ? resolve() : reject(new Error(`${r} exited ${code}`)));
});
const t0 = Date.now();
await Promise.all([run('runner'), ...Array.from({ length: waiters }, (_, i) => run('waiter', ['--arrive', String(300 + i * 200)]))]);
const rows = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => l.split(' '));
const runnerIn = rows.filter(r => r[1] === 'runner' && r[3] === 'in').map(r => ({ t: Number(r[0]), n: Number(r[4]) }));
console.log(`lib: ${path.relative(process.cwd(), libPath) || libPath}   (1 slot, runner ${turns} turns x ${hold} ms, ${waiters} waiter(s))`);
const order = [];
for (const r of rows.filter(r => r[1] === 'waiter' && r[3] === 'in')) {
  const asks = rows.find(a => a[1] === 'waiter' && a[2] === r[2] && a[3] === 'asks');
  const turnsBefore = runnerIn.filter(x => x.t > Number(asks[0]) && x.t < Number(r[0])).length;
  order.push(r[2]);
  console.log(`  waiter ${r[2]}: asked at +${Number(asks[0]) - t0} ms, got in after ${Number(r[0]) - Number(asks[0])} ms, ${turnsBefore} runner turns went by first`);
}
const got = order.length;
const askOrder = rows.filter(r => r[1] === 'waiter' && r[3] === 'asks').sort((a, b) => a[0] - b[0]).map(r => r[2]);
console.log(`  served in the order they asked: ${askOrder.join() === order.join() ? 'yes' : 'no'}`);
console.log(got === waiters ? `  all ${waiters} waiter(s) served` : `  ${waiters - got} waiter(s) never got in`);
fs.rmSync(dir, { recursive: true, force: true });
