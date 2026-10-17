// The pure half of the rigour runner (tools/rigour.mjs): the debt register parsed, the plans for each scope,
// and the shape of a result. Nothing here touches git, a process or a clock except through its arguments.
//
// A step's status is one of five words and never anything else:
//   passed   it ran, succeeded, and did something
//   failed   it ran and did not succeed (or, in a whole-suite run, ran nothing)
//   not run  it did not run (a dry run, or an earlier step failed): never counted as passed
//   owed     it ran and found a debt it cannot settle itself: a slice's review is still to come
//   empty    it exited 0 but ran nothing ("No checks needed", "0 pages", or no summary to read): not a pass

export const STATUSES = ['passed', 'failed', 'not run', 'owed', 'empty'];
export const ENGINES = ['chromium', 'webkit', 'firefox'];
export const DEBT_CAP = 20;

// ---- The debt register (docs/DEBT.md) ----

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Rows of the register's table. A row is open when its status cell is exactly "open"; "~~open~~ closed ..." is closed. */
export function parseDebt(markdown) {
  const rows = [];
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replaceAll('\\|', '|'));
    if (cells.length < 7 || !/^\d+$/.test(cells[0])) continue;
    const [n, where, item, kind, since, source, ...rest] = cells;
    const status = rest.join(' | ');
    rows.push({ n: Number(n), where, item, kind, since, source, status, open: status.toLowerCase() === 'open' });
  }
  return rows;
}

/** "16 Oct" -> a Date; "Oct" -> the 1st of it; never later than `now` (a December row read in January is last year's). */
export function sinceDate(since, now = new Date()) {
  const m = /^(?:(\d{1,2})\s+)?([A-Za-z]{3})/.exec(since.trim());
  const mon = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  if (mon < 0) return new Date(0);
  let d = new Date(Date.UTC(now.getUTCFullYear(), mon, m[1] ? Number(m[1]) : 1));
  if (d.getTime() > now.getTime() + 86400000) d = new Date(Date.UTC(now.getUTCFullYear() - 1, mon, m[1] ? Number(m[1]) : 1));
  return d;
}

/** Open rows grouped by Where, then Kind, oldest first everywhere; counts; the cap verdict. */
export function summariseDebt(rows, { cap = DEBT_CAP, now = new Date() } = {}) {
  const open = rows.filter(r => r.open);
  const age = r => sinceDate(r.since, now).getTime();
  const oldestFirst = (a, b) => age(a) - age(b) || a.n - b.n;
  const sorted = [...open].sort(oldestFirst);
  const byWhere = new Map();
  for (const r of sorted) {
    if (!byWhere.has(r.where)) byWhere.set(r.where, new Map());
    const kinds = byWhere.get(r.where);
    if (!kinds.has(r.kind)) kinds.set(r.kind, []);
    kinds.get(r.kind).push(r);
  }
  const groups = [...byWhere].map(([where, kinds]) => ({
    where,
    open: [...kinds.values()].reduce((a, v) => a + v.length, 0),
    kinds: [...kinds].map(([kind, rs]) => ({ kind, rows: rs })),
    oldest: sorted.find(r => r.where === where),
  }));
  const byKind = {};
  for (const r of open) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
  return {
    total: rows.length, open: open.length, closed: rows.length - open.length, cap, overCap: open.length > cap,
    byKind, groups, oldest: sorted.slice(0, 5),
  };
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function formatDebt(s, file = 'docs/DEBT.md') {
  const out = [];
  out.push(`debt: ${s.open} open of ${s.total} rows in ${file} (${s.closed} closed)`);
  out.push(s.overCap
    ? `WARN  ${s.open} open is over the cap of ${s.cap} (by ${s.open - s.cap}). Cap rule: more than ${s.cap} open rows is over; close or schedule some before a goal defers more.`
    : `ok    ${s.open} open is within the cap of ${s.cap}.`);
  out.push(`by kind: ${Object.entries(s.byKind).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  out.push(`by where: ${s.groups.map(g => `${g.where} ${g.open}`).join(', ') || 'none'}`);
  if (s.oldest.length) out.push(`oldest: ${s.oldest.map(r => `#${r.n} (${r.since})`).join(', ')}`);
  for (const g of s.groups) {
    out.push('');
    out.push(`${g.where}: ${g.open} open`);
    for (const k of g.kinds) {
      out.push(`  ${k.kind} (${k.rows.length})`);
      for (const r of k.rows) out.push(`    #${String(r.n).padEnd(3)} ${r.since.padEnd(7)} ${clip(r.item, 84)}`);
    }
  }
  return out.join('\n');
}

// ---- Plans: the steps a scope runs, in order ----
//
// A step: { id, label, kind: 'spawn' | 'tier', cmd?, args?, soft?, scope? }
//   spawn  runs `cmd args` in the repo root and passes when it exits 0
//   tier   gate-tier over the diff (slice) or the merges since the base (rung); runs in-process
//   soft   a failure here does not stop the steps after it (they still run, and the result still says it failed)

const SAFE_ARG = /^[A-Za-z0-9_.\/@^~=,:+-]+$/;
export function checkArg(name, value) {
  if (!SAFE_ARG.test(value)) throw new Error(`--${name} "${value}" has characters a git ref or an engine name does not`);
  return value;
}

export function parseEngines(list, fallback) {
  const names = (list ? list.split(',') : fallback).map(s => s.trim().toLowerCase()).filter(Boolean);
  const bad = names.filter(n => !ENGINES.includes(n));
  if (bad.length || !names.length) throw new Error(`--engines takes ${ENGINES.join(', ')} (comma-separated), got "${list}"`);
  return [...new Set(names)];
}

const npm = (...args) => ({ cmd: 'npm', args });

export function planSlice({ base, engines = ['chromium'] } = {}) {
  const steps = [{ id: 'gates:slice', label: 'unit tests and the repo checks (tool tests only when tools changed)', kind: 'spawn', ...npm('run', 'gates:slice') }];
  for (const e of engines) {
    steps.push({ id: `check:changed:${e}`, label: `the checks the diff reaches, in ${e}`, kind: 'spawn', ...npm('run', 'check', '--', base ? `--changed=${base}` : '--changed', `--engine=${e}`) });
  }
  for (const e of engines) {
    steps.push({ id: `smoke:changed:${e}`, label: `the demo pages the diff reaches (load, axe, 390 px), in ${e}`, kind: 'spawn', ...npm('run', 'smoke', '--', '--changed', ...(base ? ['--base', base] : []), `--engine=${e}`) });
  }
  steps.push({ id: 'tier', label: 'gate-tier over the diff: the review it owes', kind: 'tier', scope: 'slice', soft: true });
  return steps.map(st => ({ scope: 'slice', ...st }));
}

export function planRung({ base = 'main', engines = ['chromium', 'webkit'] } = {}) {
  const steps = [
    { id: 'gates', label: 'unit tests, tool tests and the repo checks', kind: 'spawn', ...npm('run', 'gates') },
    { id: 'tier', label: `gate-tier over the merges since ${base}: each slice's tier, and the review it owes`, kind: 'tier', scope: 'rung', soft: true },
  ];
  for (const e of engines) steps.push({ id: `smoke:${e}`, label: `every demo page, in ${e}`, kind: 'spawn', ...npm('run', 'smoke', '--', `--engine=${e}`) });
  for (const e of engines) steps.push({ id: `check:${e}`, label: `the whole check suite, in ${e}`, kind: 'spawn', ...npm('run', 'check', '--', `--engine=${e}`) });
  return steps.map(st => ({ scope: 'rung', ...st }));
}

export function formatPlan(scope, steps, info = {}) {
  const head = Object.entries(info).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(',') : v}`).join(', ');
  const out = [`rigour --scope=${scope}${head ? ` (${head})` : ''}: ${steps.length} step${steps.length === 1 ? '' : 's'}, in order`];
  steps.forEach((s, i) => {
    const how = s.kind === 'spawn' ? `${s.cmd} ${s.args.join(' ')}` : `gate-tier (in process)`;
    out.push(`  ${i + 1}. ${s.id.padEnd(24)} ${how}${s.soft ? '   [soft: a failure does not stop the rest]' : ''}`);
    out.push(`     ${s.label}`);
  });
  return out.join('\n');
}

// ---- Results ----

/** Busy percentage between two cpuTimes() samples ({ busy, total }). */
export function cpuPct(a, b) {
  return Math.round((100 * (b.busy - a.busy)) / Math.max(1, b.total - a.total));
}

export function stepResult(step, status, extra = {}) {
  if (!STATUSES.includes(status)) throw new Error(`unknown status ${status}`);
  return { id: step.id, label: step.label, command: step.kind === 'spawn' ? `${step.cmd} ${step.args.join(' ')}` : 'gate-tier', status, exitCode: null, durationMs: 0, cpuBusyPct: null, ...extra };
}

/**
 * What a check or smoke step printed, read for what it did (their exit code says only that nothing went red). Only
 * the steps whose id starts with check or smoke are read; anything else gives null.
 *   { kind, ran, knownFlakes, skipped, empty, unread, note }
 * empty: nothing ran. unread: no summary line was found, so nothing is confirmed. checks.mjs has no JSON output, so
 * this reads its summary lines ("N of M checks pass", "Known flakes that went red: N", "Skipped, no GPU: N clause");
 * smoke prints "smoke: P/N pages clean" or "smoke: nothing to run", and a "skipped <page>:" line per skipped page.
 */
export function readRunSummary(stepId, text) {
  const kind = /^check/.test(stepId) ? 'check' : /^smoke/.test(stepId) ? 'smoke' : null;
  if (!kind) return null;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (kind === 'check') {
    if (/No checks needed for this diff/.test(text)) return { kind, ran: 0, knownFlakes: 0, skipped: 0, empty: true, unread: false, note: 'no checks ran: none selected for this diff' };
    const m = /(\d+) of (\d+) checks pass/.exec(text);
    if (!m) return { kind, ran: 0, knownFlakes: 0, skipped: 0, empty: true, unread: true, note: 'exit 0 but no "N of M checks pass" line: nothing confirmed' };
    const ran = Number(m[2]);
    const flakes = Number((/Known flakes that went red: (\d+)/.exec(text) ?? [])[1] ?? 0);
    const skipped = Number((/Skipped, no GPU: (\d+) clause/.exec(text) ?? [])[1] ?? 0);
    const parts = [`${m[1]} of ${m[2]} checks pass`];
    if (flakes) parts.push(`${plural(flakes, 'known flake')} red, recorded not counted`);
    if (skipped) parts.push(`${plural(skipped, 'clause')} skipped`);
    return { kind, ran, knownFlakes: flakes, skipped, empty: ran === 0, unread: false, note: ran === 0 ? 'no checks ran: 0 of 0' : parts.join('; ') };
  }
  const skippedPages = (text.match(/^skipped \S+:/gm) ?? []).length;
  if (/smoke: nothing to run/.test(text)) return { kind, ran: 0, knownFlakes: 0, skipped: skippedPages, empty: true, unread: false, note: 'no pages ran: nothing reached by this diff' };
  const m = /smoke: (\d+)\/(\d+) pages clean/.exec(text);
  if (!m) return { kind, ran: 0, knownFlakes: 0, skipped: skippedPages, empty: true, unread: true, note: 'exit 0 but no "smoke: P/N pages clean" line: nothing confirmed' };
  const ran = Number(m[2]);
  const parts = [`${m[1]} of ${m[2]} pages clean`];
  if (skippedPages) parts.push(`${plural(skippedPages, 'page')} skipped`);
  return { kind, ran, knownFlakes: 0, skipped: skippedPages, empty: ran === 0, unread: false, note: ran === 0 ? 'no pages ran: 0 of 0' : parts.join('; ') };
}

/**
 * The status and extra fields of a spawned step that exited with `code`. Exit 0 is a pass only if the output shows
 * something ran; a run that ran nothing is 'empty' in a slice (a diff may reach no checks) and 'failed' in a rung
 * (a whole-suite run of 0 is a broken run). An exit 0 whose summary could not be read is 'failed' in every scope: a
 * tool whose output drifted must not read as "ran nothing".
 */
export function judgeSpawn(step, code, output) {
  if (code !== 0) return { status: 'failed', extra: { exitCode: code } };
  const sum = readRunSummary(step.id, output ?? '');
  if (!sum) return { status: 'passed', extra: { exitCode: code } };
  const counts = { ran: sum.ran, knownFlakes: sum.knownFlakes, skipped: sum.skipped };
  const status = sum.unread ? 'failed' : !sum.empty ? 'passed' : step.scope === 'rung' ? 'failed' : 'empty';
  return { status, extra: { exitCode: code, note: sum.note, counts } };
}

/**
 * The verdict over a list of step results. ok: nothing failed and nothing was left unrun. complete: every step
 * passed outright; an owed review or an empty run keeps it false. A step that did not run is not a pass.
 */
export function summarise(steps) {
  const count = s => steps.filter(x => x.status === s).length;
  const failed = count('failed'), notRun = count('not run');
  return {
    passed: count('passed'), failed, notRun, owed: count('owed'), empty: count('empty'),
    ok: steps.length > 0 && failed === 0 && notRun === 0,
    complete: steps.length > 0 && count('passed') === steps.length,
  };
}

/** A load number is only a number: say what to make of it. */
export function loadNote(pct, quietBelow = 30) {
  return pct <= quietBelow ? `quiet (${pct}% busy)` : `under load (${pct}% busy): timings and perf from this run are a guess`;
}

export function formatSummary(steps, load) {
  const s = summarise(steps);
  const out = ['', 'step                    status    time      cpu busy'];
  for (const x of steps) {
    const t = x.status === 'not run' ? '-' : `${(x.durationMs / 1000).toFixed(1)} s`;
    const c = x.cpuBusyPct == null ? '-' : `${x.cpuBusyPct}%`;
    out.push(`${x.id.padEnd(23)} ${x.status.padEnd(9)} ${t.padEnd(9)} ${c}${x.note ? `   ${x.note}` : ''}`);
  }
  out.push(`${s.passed} passed, ${s.failed} failed, ${s.notRun} not run${s.owed || s.empty ? `, ${s.owed} owed, ${s.empty} empty` : ''}. Machine: ${load}.`);
  if (s.ok && !s.complete) out.push(`Not complete: ${[s.owed && `${s.owed} step${s.owed === 1 ? '' : 's'} owe a review that is still to come`, s.empty && `${s.empty} ran nothing`].filter(Boolean).join('; ')}.`);
  return out.join('\n');
}
