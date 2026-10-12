// loopcost's pure core: Claude Code transcript lines in, a run's agent cost out. It folds the harness review's
// scripts (docs/runs/2026-10-12-harness-review/scripts/: loopcost, drill, ctx, ttl, reads) into one pass per
// transcript. It reads only numbers, timestamps, tool names and shell commands (to tell a polling loop or a browser
// check from other calls); what it returns and prints is numbers. No message text leaves it.
//
// Two things differ from the review's scripts, on purpose:
//   - Claude Code writes one transcript line per content block, each repeating its API call's usage. A turn here is
//     one API call (one message id), and its tokens are counted once. The review's loopcost summed every line.
//   - A subagent's role comes from its .meta.json (the kernel it ran, `customAgentType`) before its name.

export const ROLES = ['karigar', 'rasika', 'kathakar', 'sutradhar', 'other'];
const ROLE_RE = /^(karigar|rasika|kathakar|sutradhar)/i;

/**
 * The role of one transcript. Main sessions (a transcript not under `subagents/`) are `sutradhar` (the main
 * session runs the Sutradhar kernel, or is the command center). A subagent is the kernel its meta names, else the
 * prefix of its name (`agent-akarigar-bloom-…`), else `other`.
 * @param {string} relPath the transcript's path under the project dir, forward slashes
 * @param {{customAgentType?: string, agentType?: string}|null} meta
 */
export function roleOf(relPath, meta) {
  if (!/(^|\/)subagents\//.test(relPath)) return 'sutradhar';
  for (const v of [meta?.customAgentType, meta?.spawnedAgentType, meta?.agentType]) { const m = ROLE_RE.exec(v ?? ''); if (m) return m[1].toLowerCase(); }
  const m = /agent-a?(karigar|rasika|kathakar|sutradhar)/i.exec(relPath.split('/').pop());
  return m ? m[1].toLowerCase() : 'other';
}

/**
 * What a shell command was for, by the review's signatures (drill.mjs), in its order: a polling sleep, a loop that
 * sleeps and reads output, one browser check, the browser suite, or anything else.
 * @returns {'poll'|'poll-loop'|'check'|'suite'|'other'}
 */
export function shellKind(cmd) {
  const c = String(cmd ?? '').replace(/\s+/g, ' ');
  if (/\bsleep (\d+)|Start-Sleep/.test(c) && !/check|test|gates/.test(c)) return 'poll';
  if (/sleep.*(tail|cat|grep|ls).*(output|\.out|\.log|tasks)/.test(c) || /until .*grep|while .*sleep/.test(c)) return 'poll-loop';
  if (/node .*\.check\.mjs/.test(c)) return 'check';
  if (/node \S*tools\/checks\.mjs|npm run check\b/.test(c) && !/--dry/.test(c)) return 'suite';
  return 'other';
}

const SHELL = new Set(['Bash', 'PowerShell']);
const GAP_5M = 5 * 60e3, GAP_60M = 60 * 60e3;

/**
 * One transcript's tally. Feed it every parsed line in file order; `result()` returns numbers only.
 * @param {{role: string, since?: number, until?: number}} o times in ms; lines outside [since, until) are ignored
 */
export function createAgent({ role, since = -Infinity, until = Infinity }) {
  const turns = new Map(); // message id -> { t, read, write, out, input }
  const pending = new Map(); // tool_use id -> { t, kind, name, bg }
  const calls = { poll: { n: 0, ms: 0 }, check: { n: 0, ms: 0 }, suite: { n: 0, ms: 0 } };
  let first = Infinity, last = -Infinity, images = 0;
  const line = j => {
    const t = Date.parse(j?.timestamp ?? '');
    if (!Number.isFinite(t) || t < since || t >= until) return;
    first = Math.min(first, t); last = Math.max(last, t);
    const msg = j.message;
    if (j.type === 'assistant' && msg) {
      const id = msg.id ?? j.uuid, u = msg.usage ?? {};
      const turn = turns.get(id) ?? { t, read: 0, write: 0, out: 0, input: 0 };
      turn.read = Math.max(turn.read, u.cache_read_input_tokens ?? 0);
      turn.write = Math.max(turn.write, u.cache_creation_input_tokens ?? 0);
      turn.out = Math.max(turn.out, u.output_tokens ?? 0);
      turn.input = Math.max(turn.input, u.input_tokens ?? 0);
      turns.set(id, turn);
      for (const c of Array.isArray(msg.content) ? msg.content : []) {
        if (c?.type !== 'tool_use') continue;
        const shell = SHELL.has(c.name);
        pending.set(c.id, { t, name: c.name, kind: shell ? shellKind(c.input?.command) : null, bg: !!c.input?.run_in_background });
      }
    } else if (j.type === 'user' && Array.isArray(msg?.content)) {
      for (const c of msg.content) {
        if (c?.type !== 'tool_result' || !pending.has(c.tool_use_id)) continue;
        const p = pending.get(c.tool_use_id); pending.delete(c.tool_use_id);
        const ms = Math.max(0, t - p.t);
        if (p.kind === 'poll' || p.kind === 'poll-loop') { calls.poll.n++; calls.poll.ms += ms; }
        else if ((p.kind === 'check' || p.kind === 'suite') && !p.bg) { calls[p.kind].n++; calls[p.kind].ms += ms; }
        if (p.name === 'Read' && Array.isArray(c.content)) images += c.content.filter(x => x?.type === 'image').length;
      }
    }
  };
  const result = () => {
    const list = [...turns.values()].sort((a, b) => a.t - b.t);
    let read = 0, write = 0, out = 0, input = 0, peak = 0, gapWrite5 = 0, gapWrite60 = 0, gapTurns5 = 0;
    list.forEach((u, k) => {
      read += u.read; write += u.write; out += u.out; input += u.input;
      peak = Math.max(peak, u.input + u.read + u.write);
      const gap = k ? u.t - list[k - 1].t : 0;
      if (k && gap > GAP_5M) { gapWrite5 += u.write; gapTurns5++; }
      if (k && gap > GAP_60M) gapWrite60 += u.write;
    });
    return { role, turns: list.length, ms: Number.isFinite(first) ? last - first : 0, read, write, out, input, peak, gapWrite5, gapWrite60, gapTurns5, calls, images };
  };
  return { line, result };
}

const quantile = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0);

/** Fold agents' results into the run's numbers. Agents with no turn in the window are left out. */
export function summarise(agents) {
  const live = agents.filter(a => a.turns > 0);
  const byRole = {};
  for (const r of ROLES) byRole[r] = { agents: 0, hours: 0, turns: 0, read: 0, write: 0, out: 0 };
  for (const a of live) {
    const r = byRole[a.role] ?? byRole.other;
    r.agents++; r.hours += a.ms / 3.6e6; r.turns += a.turns; r.read += a.read; r.write += a.write; r.out += a.out;
  }
  const subs = live.filter(a => a.role !== 'sutradhar');
  const subWrite = subs.reduce((s, a) => s + a.write, 0);
  const sum = (k, sub) => live.reduce((s, a) => s + a.calls[k][sub], 0);
  const peaks = live.filter(a => a.role === 'karigar' || a.role === 'rasika').map(a => a.peak).sort((x, y) => x - y);
  return {
    byRole,
    subagentWrite: subWrite,
    gapShare5: subWrite ? subs.reduce((s, a) => s + a.gapWrite5, 0) / subWrite : 0,
    gapShare60: subWrite ? subs.reduce((s, a) => s + a.gapWrite60, 0) / subWrite : 0,
    gapTurns5: subs.reduce((s, a) => s + a.gapTurns5, 0),
    poll: { n: sum('poll', 'n'), hours: sum('poll', 'ms') / 3.6e6 },
    check: { n: sum('check', 'n'), hours: sum('check', 'ms') / 3.6e6 },
    suite: { n: sum('suite', 'n'), hours: sum('suite', 'ms') / 3.6e6 },
    peak: { agents: peaks.length, median: quantile(peaks, 0.5), p90: quantile(peaks, 0.9), max: peaks.at(-1) ?? 0 },
    images: { all: live.reduce((s, a) => s + a.images, 0), builders: live.filter(a => a.role === 'karigar' || a.role === 'rasika').reduce((s, a) => s + a.images, 0) },
  };
}

const M = x => (x >= 1e6 ? `${(x / 1e6).toFixed(x >= 1e8 ? 0 : 1)}M` : x >= 1e3 ? `${Math.round(x / 1e3)}k` : String(x));
const H = x => x.toFixed(1);
const pct = x => `${Math.round(x * 100)}%`;

/** The block a ledger entry carries. */
export function format(s, { since, until, files }) {
  const rows = ROLES.filter(r => s.byRole[r].agents).map(r => {
    const v = s.byRole[r];
    return `| ${r} | ${v.agents} | ${H(v.hours)} | ${v.turns.toLocaleString('en-GB')} | ${M(v.read)} | ${M(v.write)} | ${M(v.out)} |`;
  });
  return [
    `loopcost ${since ?? 'start'} to ${until ?? 'now'} (${files} transcripts)`,
    '',
    '| Role | Agents | Agent-hours | Turns | Cache read | Cache write | Output |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `- Subagent cache writes after a gap over 5 min: ${pct(s.gapShare5)} of ${M(s.subagentWrite)} (${s.gapTurns5} turns); over 60 min: ${pct(s.gapShare60)}.`,
    `- Polling calls (sleep, or a loop reading output): ${s.poll.n}, ${H(s.poll.hours)} h.`,
    `- Foreground browser checks: ${s.check.n} single checks, ${H(s.check.hours)} h; ${s.suite.n} suite runs, ${H(s.suite.hours)} h.`,
    `- Peak context, karigar and rasika (${s.peak.agents} agents): median ${M(s.peak.median)}, p90 ${M(s.peak.p90)}, max ${M(s.peak.max)}.`,
    `- Images read: ${s.images.all} (karigar and rasika ${s.images.builders}).`,
  ].join('\n');
}

/**
 * The Claude Code projects folder name for a working directory: every character that isn't a letter or a digit
 * becomes `-` (`C:\Projects\susegad-ui` → `C--Projects-susegad-ui`).
 */
export const projectSlug = cwd => cwd.replace(/[^A-Za-z0-9]/g, '-');
