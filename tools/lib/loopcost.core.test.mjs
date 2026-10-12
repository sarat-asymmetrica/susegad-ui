// loopcost on small synthetic transcripts (no real transcript content is committed): one turn split over several
// lines counts once, roles come from the meta then the name, a gap before a turn is caught, polling and foreground
// checks are told apart, and the CLI prints numbers, never a message's words.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createAgent, roleOf, shellKind, summarise, format, projectSlug } from './loopcost.core.js';

const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../loopcost.mjs');
const SECRET = 'the owner said something private here';

// A tiny transcript writer: minutes from 10:00 UTC on 2 October.
const at = min => new Date(Date.UTC(2026, 9, 2, 10, 0) + min * 60e3).toISOString();
const usage = (read, write, out = 10, input = 1) => ({ input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: write, output_tokens: out });
const asst = (min, id, content, u) => ({ type: 'assistant', timestamp: at(min), message: { id, model: 'claude-sonnet-5-5', content, usage: u } });
const result = (min, id, content = 'ok') => ({ type: 'user', timestamp: at(min), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] } });
const bash = (id, command, bg = false) => ({ type: 'tool_use', id, name: 'Bash', input: { command, ...(bg ? { run_in_background: true } : {}) } });

/** A builder's transcript: a split turn, a foreground check, a background check, a polling sleep, a screenshot read, and a turn after a 12-minute gap. */
const BUILDER = [
  { type: 'user', timestamp: at(0), message: { role: 'user', content: SECRET } },
  asst(0.1, 'm1', [{ type: 'thinking', thinking: SECRET }], usage(20000, 30000, 5)),
  asst(0.1, 'm1', [bash('t1', 'node packages/x/x.check.mjs')], usage(20000, 30000, 5)),
  asst(0.1, 'm1', [bash('t2', 'node packages/y/y.check.mjs', true)], usage(20000, 30000, 40)), // the last line carries the final output count
  result(3.1, 't1'), result(0.2, 't2'),
  asst(3.2, 'm2', [bash('t3', 'sleep 120; tail -5 out.log')], usage(50000, 2000)),
  result(5.2, 't3'),
  asst(5.3, 'm3', [{ type: 'tool_use', id: 't4', name: 'Read', input: { file_path: 'shot.png' } }], usage(52000, 1000)),
  result(5.4, 't4', [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }]),
  asst(17.4, 'm4', [{ type: 'text', text: SECRET }], usage(0, 60000, 300)),
];
const feed = (lines, o) => { const a = createAgent(o); lines.forEach(a.line); return a.result(); };

test('a turn written over several lines counts once, at its largest usage; tokens, hours and peak follow', () => {
  const r = feed(BUILDER, { role: 'karigar' });
  assert.equal(r.turns, 4);
  assert.equal(r.read, 20000 + 50000 + 52000 + 0);
  assert.equal(r.write, 30000 + 2000 + 1000 + 60000);
  assert.equal(r.out, 40 + 10 + 10 + 300);
  assert.equal(r.peak, 60001, 'the largest input + cache read + cache write of any one turn');
  assert.equal(Math.round(r.ms / 60e3 * 10) / 10, 17.4);
});

test('cache writes after a gap: the turn 12 minutes after the last one is counted, the others are not', () => {
  const r = feed(BUILDER, { role: 'karigar' });
  assert.equal(r.gapTurns5, 1);
  assert.equal(r.gapWrite5, 60000);
  assert.equal(r.gapWrite60, 0);
});

test('polling, foreground checks and background checks are told apart; a screenshot read is counted', () => {
  const r = feed(BUILDER, { role: 'karigar' });
  assert.deepEqual([r.calls.poll.n, r.calls.poll.ms], [1, 120e3]);
  assert.deepEqual([r.calls.check.n, r.calls.check.ms], [1, 180e3], 'the background check is not foreground time');
  assert.equal(r.images, 1);
  assert.equal(shellKind('until grep -qE "checks (pass|failed)" run.log; do sleep 5; done'), 'poll-loop', 'a wait on a check log');
  assert.equal(shellKind('sleep 30'), 'poll');
  assert.equal(shellKind('npm test && sleep 1'), 'other', 'a sleep beside a test run is not a poll (the review\'s rule)');
  assert.equal(shellKind('node tools/checks.mjs --changed'), 'suite');
  assert.equal(shellKind('node tools/checks.mjs --changed --dry'), 'other');
});

test('the window: lines before --since and from --until on are left out', () => {
  const r = feed(BUILDER, { role: 'karigar', since: Date.parse(at(1)), until: Date.parse(at(10)) });
  assert.equal(r.turns, 2, 'm2 and m3 only');
  assert.equal(r.write, 3000);
  assert.equal(r.calls.poll.n, 1);
  assert.equal(r.calls.check.n, 0, 'its tool_use was before the window');
});

test('roles: a main session is the sutradhar; a subagent is its kernel from the meta, then its name, then other', () => {
  assert.equal(roleOf('abc.jsonl', null), 'sutradhar');
  assert.equal(roleOf('abc/subagents/agent-aconf-a-12.jsonl', { agentType: 'conf-a', customAgentType: 'karigar' }), 'karigar');
  assert.equal(roleOf('abc/subagents/agent-a1f2.jsonl', { agentType: 'rasika' }), 'rasika');
  assert.equal(roleOf('abc/subagents/agent-akathakar-w0-12.jsonl', null), 'kathakar');
  assert.equal(roleOf('abc/subagents/agent-a99.jsonl', { agentType: 'Explore' }), 'other');
});

test('summarise and format: per-role rows, the gap share over subagents only, quantiles of builder peaks', () => {
  const builder = feed(BUILDER, { role: 'karigar' });
  const main = feed([asst(0, 'x1', [], usage(1000, 500000)), asst(30, 'x2', [], usage(1000, 500000))], { role: 'sutradhar' });
  const s = summarise([builder, main, { ...builder, turns: 0 }]);
  assert.equal(s.byRole.karigar.agents, 1, 'an agent with no turn in the window is left out');
  assert.equal(s.byRole.sutradhar.write, 1e6);
  assert.equal(s.gapShare5, 60000 / 93000, 'the main session\'s gap is not a subagent cache miss');
  assert.equal(s.peak.median, 60001);
  const text = format(s, { since: '2026-10-02', until: undefined, files: 2 });
  assert.match(text, /\| karigar \| 1 \| 0\.3 \| 4 \| 122k \| 93k \| 360 \|/);
  assert.match(text, /after a gap over 5 min: 65% of 93k \(1 turns\)/);
  assert.match(text, /Polling calls .*: 1, 0\.0 h/);
});

test('the project folder: every character that is not a letter or digit becomes a dash', () => {
  assert.equal(projectSlug('C:\\Projects\\susegad-ui'), 'C--Projects-susegad-ui');
  assert.equal(projectSlug('/home/me/susegad.ui'), '-home-me-susegad-ui');
});

test('the CLI over a synthetic project folder prints the block, and never a word of any message', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loopcost-'));
  try {
    const sub = path.join(dir, 'sess', 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const jsonl = lines => lines.map(l => JSON.stringify(l)).join('\n') + '\n{not json\n';
    fs.writeFileSync(path.join(sub, 'agent-aconf-a-1.jsonl'), jsonl(BUILDER));
    fs.writeFileSync(path.join(sub, 'agent-aconf-a-1.meta.json'), JSON.stringify({ agentType: 'conf-a', customAgentType: 'karigar', description: SECRET }));
    fs.writeFileSync(path.join(dir, 'sess.jsonl'), jsonl([{ type: 'user', timestamp: at(0), message: { content: SECRET } }, asst(1, 'z', [{ type: 'text', text: SECRET }], usage(10, 10))]));
    const run = (...a) => spawnSync(process.execPath, [TOOL, '--project', dir, ...a], { encoding: 'utf8' });
    const out = run('--since', '2026-10-01');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /\| karigar \| 1 \|/);
    assert.match(out.stdout, /\| sutradhar \| 1 \|/);
    assert.ok(!out.stdout.includes('owner said') && !out.stdout.includes('private'), 'no message text in the output');
    const js = JSON.parse(run('--json').stdout);
    assert.equal(js.byRole.karigar.turns, 4);
    assert.ok(!JSON.stringify(js).includes('private'));
    assert.equal(run('--since', 'yesterday-ish').status, 2, 'a bad date is refused, not read as no window');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
