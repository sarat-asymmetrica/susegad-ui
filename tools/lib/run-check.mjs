// Run one check script as a child and give up on it after a timeout, killing the whole
// process tree (a check's browser outlives it on Windows otherwise). One hung check must
// not stall the whole gate (tools/checks.mjs).
//
// Each check also holds one machine-wide browser slot for the life of its process (slots.mjs), so a
// dozen agents running suites at once do not starve each other. The child gets SG_SLOT_HELD=1 so the
// browser helpers it calls do not take a second slot. The timeout starts once the slot is held.

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { acquireSlot } from './slots.mjs';

/** The default per-check limit in seconds: SG_CHECK_TIMEOUT_S, else 15 minutes. */
export const defaultTimeoutS = (env = process.env) => {
  const n = Number(env.SG_CHECK_TIMEOUT_S);
  return Number.isFinite(n) && n > 0 ? n : 900;
};

// POSIX: the check runs as the leader of its own process group (detached in runCheck), and the whole
// group is killed. Killing the check alone left its browser alive with the stdout pipe open, so 'close'
// never fired and the run waited forever (check (firefox) on CI, 6 Oct 2026). Windows: unchanged,
// taskkill /T walks the tree from the check's pid; detached is not used there (it would open a console).
const POSIX = process.platform !== 'win32';

function killTree(child) {
  try {
    if (!POSIX) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGKILL');
  } catch { /* already gone */ }
}

// A detached group no longer hears the terminal's Ctrl+C, so the runner passes it on: interrupted,
// it kills every check still running with its browser, then exits as the signal would have.
const running = new Set();
let forwarding = false;
function forwardSignals() {
  if (!POSIX || forwarding) return;
  forwarding = true;
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
    process.once(sig, () => { for (const c of running) killTree(c); process.exit(code); });
  }
}

/**
 * @param {string} file a .mjs check
 * @returns {Promise<{ status: number|null, out: string, timedOut: boolean }>}
 */
export async function runCheck(file, { cwd, env = process.env, timeoutS = defaultTimeoutS(), log } = {}) {
  const release = await acquireSlot({ label: path.basename(file), env, ...(log ? { log } : {}) });
  return new Promise(resolve => {
    const done = r => { release(); resolve(r); };
    const child = spawn(process.execPath, [file], { cwd, env: { ...env, SG_SLOT_HELD: '1' }, windowsHide: true, detached: POSIX });
    release.adopt(child.pid);
    running.add(child);
    forwardSignals();
    let out = '', timedOut = false;
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeoutS * 1000);
    child.on('close', status => { clearTimeout(timer); running.delete(child); done({ status: timedOut ? null : status, out, timedOut }); });
    child.on('error', e => { clearTimeout(timer); running.delete(child); done({ status: 1, out: out + String(e), timedOut }); });
  });
}
