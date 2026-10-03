import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BASELINE, headingsOf, missing } from './check-skill-coverage.mjs';

function tree(t, { skillMd, skillDir }) {
  const root = mkdtempSync(join(tmpdir(), 'susegad-skill-cov-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'SKILL.md'), skillMd);
  mkdirSync(join(root, 'references'), { recursive: true });
  for (const [name, text] of Object.entries(skillDir)) writeFileSync(join(root, 'references', name), text);
  return root;
}

test('headingsOf ignores fenced code blocks (comment lines starting with #)', () => {
  const text = '# Real heading\n\n```sh\n# not a heading\n```\n\n## Also real\n';
  assert.deepEqual(headingsOf(text), ['Real heading', 'Also real']);
});

// This is the check that must fail first: rewriting SKILL.md and forgetting
// to carry a section into references/ silently drops it. Reproduce that here with
// a tree that is missing exactly one of the real repo's headings.
test('a heading dropped from the real repo\'s reshape is reported by name', t => {
  const root = tree(t, {
    skillMd: '# Susegad UI\n\n## 1. Choose a register\n',
    skillDir: { 'components.md': '## 6. Use the components\n\nsee below\n' }, // "Badge" and the rest never made it here
  });
  const gone = missing(root);
  assert.ok(gone.includes('Badge'), 'a real heading missing from the new tree is named');
  assert.ok(gone.length > 1, 'everything else not carried over is named too, not just the first miss');
});

test('every baseline heading present, spread across SKILL.md and references/*.md, reports nothing missing', t => {
  const skillMd = BASELINE.slice(0, 3).map(h => `## ${h}`).join('\n\n');
  const skillDir = { rest: BASELINE.slice(3).map(h => `### ${h}`).join('\n\n') + '\n' };
  // the fixture's file needs a .md extension to be picked up
  const root = tree(t, { skillMd, skillDir: { 'rest.md': skillDir.rest } });
  assert.deepEqual(missing(root), []);
});
