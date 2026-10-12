// Machine-wide browser slots: the pure half (tools/lib/slots.mjs does the files).
// This machine has 4 cores; a dozen agents running browser checks at once made every
// timing check lie. A slot is a lock file; how many exist, which one to take, whether
// a holder is still alive and what to say while waiting are decided here, in Node,
// with the clock and the "is this pid alive" question passed in.

/** Half the cores, never below one. */
export const defaultSlotCount = cpuCount => Math.max(1, Math.floor((Number(cpuCount) || 0) / 2));

/**
 * How many browsers may run at once. SG_BROWSER_SLOTS=<n>; 0 means no limit (Infinity);
 * anything that is not a whole number >= 0 falls back to the default.
 */
export function slotLimit(env, cpuCount) {
  const raw = env?.SG_BROWSER_SLOTS;
  if (raw === undefined || raw === null || String(raw).trim() === '') return defaultSlotCount(cpuCount);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return defaultSlotCount(cpuCount);
  return n === 0 ? Infinity : n;
}

export const slotFileName = i => `slot-${i}.lock`;

/** @typedef {{ pid: number, label: string, startedAt: string, token: string, childPid?: number }} SlotRecord */

export const serializeRecord = r => JSON.stringify(r);

/** @returns {SlotRecord|null} null for anything that is not a slot record (empty, half-written, junk). */
export function parseRecord(text) {
  try {
    const r = JSON.parse(text);
    return r && Number.isInteger(r.pid) ? r : null;
  } catch { return null; }
}

/**
 * Is this slot free, held by someone alive, or stale (its holder is gone)?
 * `entry` is undefined when there is no file, else { record: SlotRecord|null, mtimeMs }.
 * A file with no readable record was created a moment ago by a taker who has not written
 * into it yet: held while young (graceMs), stale once old.
 * @returns {'free'|'held'|'stale'}
 */
export function judgeSlot(entry, { isAlive, now, graceMs = 5000 }) {
  if (!entry) return 'free';
  const { record, mtimeMs } = entry;
  if (!record) return now - mtimeMs < graceMs ? 'held' : 'stale';
  if (isAlive(record.pid)) return 'held';
  if (record.childPid && isAlive(record.childPid)) return 'held'; // the owner died, its check still runs
  return 'stale';
}

const holderName = r => (r ? `${r.label || 'unnamed'} (pid ${r.pid})` : null);

// ---- first come, first served ----
// A waiter registers a ticket (a file named wait-<ms>-<seq>-<pid>-<rand>) before its first look and
// may claim a free slot only when fewer live, older tickets exist than there are free slots. A runner
// that releases and asks again gets a newer ticket, so it queues behind everyone already waiting.
// The owner touches its ticket's mtime on every poll; a ticket whose pid is dead, or whose mtime has
// gone quiet for ticketGraceMs, is skipped and cleaned up, like a stale slot.

export const TICKET_GRACE_MS = 15000;
const pad = (n, w) => String(n).padStart(w, '0');

export const ticketName = ({ ms, seq = 0, pid, rand }) => `wait-${pad(ms, 14)}-${pad(seq, 6)}-${pid}-${rand}`;

/** @returns {{ ms: number, seq: number, pid: number, rand: string }|null} null for any name that is not a ticket. */
export function parseTicketName(name) {
  const m = /^wait-(\d+)-(\d+)-(\d+)-([0-9a-z]+)$/.exec(name ?? '');
  return m ? { ms: Number(m[1]), seq: Number(m[2]), pid: Number(m[3]), rand: m[4] } : null;
}

/** Order of arrival: time, then sequence within a process, then pid, then the random tail. */
export function compareTickets(a, b) {
  const x = parseTicketName(a), y = parseTicketName(b);
  if (!x || !y) return String(a).localeCompare(String(b));
  return (x.ms - y.ms) || (x.seq - y.seq) || (x.pid - y.pid) || (x.rand < y.rand ? -1 : x.rand > y.rand ? 1 : 0);
}

/**
 * One look at the slot directory. `entries[i]` is slot i's file (or undefined).
 * Returns the free slot to take (claim), else the stale ones to clear first (reclaim),
 * and who is holding (holders), for the waiting message.
 * With `tickets` ({ name, mtimeMs }[], all the wait files) and `self` (my ticket's name) the queue
 * applies: claim only when fewer live older tickets than free slots. Also returns `ahead` (how many
 * live tickets are older than mine) and `staleTickets` (names to remove). Without them, the old plan.
 */
export function planAcquire({ limit, entries, isAlive, now, graceMs, tickets, self, ticketGraceMs = TICKET_GRACE_MS }) {
  const free = [], reclaim = [], holders = [];
  for (let i = 0; i < limit; i++) {
    const entry = entries[i];
    const verdict = judgeSlot(entry, { isAlive, now, graceMs });
    if (verdict === 'free') free.push(i);
    else if (verdict === 'stale') reclaim.push(i);
    else holders.push(holderName(entry.record) ?? 'someone starting up');
  }
  let ahead = 0;
  const staleTickets = [];
  if (tickets && self) {
    for (const t of tickets) {
      if (t.name === self) continue;
      const info = parseTicketName(t.name);
      if (!info || !isAlive(info.pid) || now - t.mtimeMs > ticketGraceMs) { staleTickets.push(t.name); continue; }
      if (compareTickets(t.name, self) < 0) ahead++;
    }
  }
  const mayClaim = free.length > 0 && ahead < free.length;
  return { claim: mayClaim ? free[0] : null, reclaim: free.length ? [] : reclaim, holders, ahead, staleTickets };
}

export const waitMessage = (holders, ahead = 0) =>
  `waiting for a browser slot (held by: ${holders.length ? holders.join(', ') : 'someone starting up'})${ahead ? `; ${ahead} waiting ahead of you` : ''}`;
