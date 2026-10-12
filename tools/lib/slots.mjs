// Machine-wide browser slots. A slot is a lock file made with the `wx` flag (create or fail) in a
// directory every process on the machine shares, holding the owner's pid, start time and label.
// A process that wants a browser takes a slot first and waits, politely and once-announced, when
// they are all taken. The decisions are pure and live in slots.core.js; this file does the files.
//
//   const release = await acquireSlot({ label: 'drawer.check' });
//   try { ...launch a browser... } finally { release(); }
//
//   SG_BROWSER_SLOTS=<n>   how many at once; default max(1, floor(cpus / 2)); 0 = no limit
//   SG_SLOTS_DIR=<dir>     the shared directory; default <tmp>/susegad-browser-slots
//   SG_SLOT_HELD=1         set by runCheck in a child's env: the parent already holds the slot
//                          for this process, so it must not take a second one (that would
//                          deadlock the suite at one slot)
//
// A slot whose pid is gone (and whose adopted child pid, if any, is gone) is stale and is reclaimed.
//
// First come, first served: before its first look a waiter drops a ticket (wait-<ms>-<seq>-<pid>-<rand>)
// in the same directory, touches it on every poll, and may take a free slot only when fewer live,
// older tickets exist than free slots. It removes the ticket when it claims and when it exits. A
// runner that releases a slot and asks again gets a newer ticket, so it queues behind the waiters.
// A ticket whose pid is gone, or that has not been touched for 15 s, is skipped and cleaned up.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { slotLimit, slotFileName, serializeRecord, parseRecord, planAcquire, waitMessage, ticketName, parseTicketName } from './slots.core.js';

export const defaultSlotsDir = (env = process.env) => env.SG_SLOTS_DIR || path.join(os.tmpdir(), 'susegad-browser-slots');

/** Is a process with this pid running? EPERM means it is, but not ours to signal. */
export function pidAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code === 'EPERM'; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const readEntry = file => {
  try {
    const stat = fs.statSync(file);
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch { /* gone between stat and read */ }
    return { record: parseRecord(text), mtimeMs: stat.mtimeMs };
  } catch { return undefined; }
};

// Every slot this process holds, so one exit handler (not one per acquire) frees them all.
const held = new Map(); // file -> token
const tickets = new Set(); // ticket files this process has waiting, removed on exit too
let hooked = false;
let ticketSeq = 0;
function freeSync(file, token) {
  try {
    const rec = parseRecord(fs.readFileSync(file, 'utf8'));
    if (rec && rec.token === token) fs.unlinkSync(file); // never free a slot that has since passed to someone else
  } catch { /* already gone */ }
}
function hookExit() {
  if (hooked) return;
  hooked = true;
  const freeAll = () => {
    for (const [file, token] of held) freeSync(file, token);
    held.clear();
    for (const file of tickets) try { fs.unlinkSync(file); } catch { /* already gone */ }
    tickets.clear();
  };
  process.on('exit', freeAll);
  // Best effort: free, then let the default SIGINT behaviour (exit) go on unless someone else listens.
  process.on('SIGINT', () => { freeAll(); if (process.listenerCount('SIGINT') <= 1) process.exit(130); });
}

/** Take down a stale slot file, but only if it still holds what we judged stale. */
function clearStale(file, judged) {
  const now = readEntry(file);
  if (!now) return;
  if ((now.record?.token ?? null) !== (judged?.record?.token ?? null)) return; // changed hands meanwhile
  const aside = `${file}.stale-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  try { fs.renameSync(file, aside); fs.unlinkSync(aside); } catch { /* someone else got there first */ }
}

function listTickets(dir) {
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  const out = [];
  for (const name of names) {
    if (!parseTicketName(name)) continue;
    try { out.push({ name, mtimeMs: fs.statSync(path.join(dir, name)).mtimeMs }); } catch { /* gone meanwhile */ }
  }
  return out;
}

const noop = Object.assign(() => {}, { adopt: () => {} });

/**
 * Wait for a free browser slot and take it.
 * @param {{ label?: string, env?: object, dir?: string, pollMs?: number, log?: (line: string) => void }} [opts]
 * @returns {Promise<(() => void) & { adopt: (childPid: number) => void }>} release; adopt(pid) records a child
 *   process as the one doing the work, so the slot stays held while it runs even if this process dies
 */
export async function acquireSlot({ label = path.basename(process.argv[1] ?? 'node'), env = process.env, dir, pollMs = 500, log = console.error } = {}) {
  if (env.SG_SLOT_HELD === '1') return noop;
  const limit = slotLimit(env, os.cpus().length);
  if (limit === Infinity) return noop;
  dir ??= defaultSlotsDir(env);
  fs.mkdirSync(dir, { recursive: true });
  const fileOf = i => path.join(dir, slotFileName(i));
  let told = false;
  // The ticket goes down before the first look; it is what puts a re-asking runner behind the waiters.
  const self = ticketName({ ms: Date.now(), seq: ticketSeq++, pid: process.pid, rand: crypto.randomBytes(3).toString('hex') });
  const ticketFile = path.join(dir, self);
  const ticketBody = JSON.stringify({ pid: process.pid, label });
  hookExit();
  tickets.add(ticketFile);
  const dropTicket = () => { tickets.delete(ticketFile); try { fs.unlinkSync(ticketFile); } catch { /* already gone */ } };
  try { fs.writeFileSync(ticketFile, ticketBody); } catch { /* a ticketless wait still works, it just queues last */ }
  try {
    for (;;) {
      // keep my place: touch the ticket, or put it back (same name, so the same turn) if someone cleared it
      try { const t = new Date(); fs.utimesSync(ticketFile, t, t); } catch { try { fs.writeFileSync(ticketFile, ticketBody); } catch { /* as above */ } }
      const entries = Array.from({ length: limit }, (_, i) => readEntry(fileOf(i)));
      const plan = planAcquire({ limit, entries, isAlive: pidAlive, now: Date.now(), tickets: listTickets(dir), self });
      for (const name of plan.staleTickets) try { fs.unlinkSync(path.join(dir, name)); } catch { /* someone else got there first */ }
      if (plan.claim !== null) {
        const file = fileOf(plan.claim);
        const token = crypto.randomBytes(8).toString('hex');
        const record = { pid: process.pid, label, startedAt: new Date().toISOString(), token };
        let fd;
        try { fd = fs.openSync(file, 'wx'); } catch (e) { if (e.code === 'EEXIST') continue; throw e; } // lost the race: look again
        try { fs.writeSync(fd, serializeRecord(record)); } finally { fs.closeSync(fd); }
        held.set(file, token);
        dropTicket();
        const release = () => { if (held.get(file) === token) { held.delete(file); freeSync(file, token); } };
        release.adopt = childPid => {
          if (held.get(file) !== token) return;
          try { fs.writeFileSync(file, serializeRecord({ ...record, childPid })); } catch { /* the slot stays ours by pid */ }
        };
        return release;
      }
      if (plan.reclaim.length) {
        for (const i of plan.reclaim) clearStale(fileOf(i), entries[i]);
        continue;
      }
      if (!told) { told = true; log(waitMessage(plan.holders, plan.ahead)); }
      await sleep(pollMs + Math.floor(Math.random() * pollMs * 0.2));
    }
  } finally { dropTicket(); }
}
