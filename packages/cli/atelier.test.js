import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { run } from './bin/susegad.mjs';
import { buildRegistry, serialise } from '../../registry/build.mjs';
import { remoteFileUrl } from './src/registry.js';
import { hashContent } from './src/hash.js';
import { HARNESSES } from './src/harnesses.js';
import { skill, skillDestination, harnessTable } from './src/skill.js';

const fixture = fileURLToPath(new URL('../../registry/fixtures/good', import.meta.url));

// remoteFileUrl: joining a repo-relative file path onto a base URL ---------------

test('remoteFileUrl joins a file path against the registry base', () => {
  const base = 'https://susegad.asymmetrica.ai/';
  assert.equal(remoteFileUrl(base, 'packages/scenes/kolam/render.js'),
    'https://susegad.asymmetrica.ai/packages/scenes/kolam/render.js');
  // the index's own base URL, however it is spelled
  assert.equal(remoteFileUrl('https://example.test/registry/', 'packages/a.js'),
    'https://example.test/registry/packages/a.js');
  assert.equal(remoteFileUrl('https://example.test/registry', 'packages/a.js'),
    'https://example.test/registry/packages/a.js');
  // spaces and other characters a URL cannot carry raw
  assert.equal(remoteFileUrl('https://example.test/', 'packages/a b/c.js'),
    'https://example.test/packages/a%20b/c.js');
});

test('remoteFileUrl refuses what escapes the registry, clamps what does not', () => {
  for (const bad of ['../outside.js', '/absolute.js', 'C:/x.js', 'packages/../../escape.js', '']) {
    assert.throws(() => remoteFileUrl('https://example.test/', bad), /registry/, bad);
  }
  // .. that resolves back inside is clamped, like any URL join
  assert.equal(remoteFileUrl('https://example.test/registry/', 'registry/../packages/a.js'),
    'https://example.test/registry/packages/a.js');
});

// hash checking: a tampered file is refused, naming the file ----------------------

function httpWorkspace(t) {
  const dir = mkdtempSync(join(tmpdir(), 'susegad-http-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const repo = join(dir, 'repo');
  cpSync(fixture, repo, { recursive: true });
  const { index, errors } = buildRegistry({ root: repo });
  assert.deepEqual(errors, []);
  writeFileSync(join(repo, 'registry', 'registry.json'), serialise(index));
  const project = join(dir, 'project');
  const cli = async (...argv) => {
    const out = [], err = [];
    const code = await run(argv, { cwd: project, out: s => out.push(s ?? ''), err: s => err.push(s ?? '') });
    return { code, out: out.join('\n'), err: err.join('\n') };
  };
  return { dir, repo, project, lib: join(project, 'src', 'lib'), cli };
}

async function served(t, repo) {
  const { startServer } = await import('../../tools/serve.mjs');
  const server = await startServer({ root: repo, quiet: true });
  t.after(() => server.close());
  return `${server.url}/registry/registry.json`;
}

test('add copies files over HTTP, with the same plan as a local registry', async t => {
  const { repo, lib, cli } = httpWorkspace(t);
  const r = await cli('add', 'scene-dot', '--registry', await served(t, repo));
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /Adding scene-dot, with the 3 pieces it needs: engine, tokens and core\./);
  assert.match(r.out, /Copied 10 files into src\/lib\/susegad\. They are yours now/);
  for (const p of ['tokens/tokens.css', 'engine/src/draw.js', 'core/scene-element.js', 'scenes/dot/model.js']) {
    assert.ok(existsSync(join(lib, 'susegad', p)), `${p} was copied`);
  }
  assert.equal(readFileSync(join(lib, 'susegad/engine/src/draw.js'), 'utf8'),
    readFileSync(join(repo, 'packages/engine/src/draw.js'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(lib, 'susegad.json'), 'utf8'));
  assert.equal(lock.items['scene-dot'].files['susegad/scenes/dot/model.js'],
    hashContent(readFileSync(join(lib, 'susegad/scenes/dot/model.js'))));
});

test('diff works over HTTP, and fetches only when something differs', async t => {
  const { repo, lib, cli } = httpWorkspace(t);
  await cli('add', 'scene-dot', '--registry', await served(t, repo));
  const clean = await cli('diff', 'scene-dot', '--registry', `${await served(t, repo)}`);
  assert.equal(clean.code, 0, clean.out);
  assert.match(clean.out, /All 3 files match the registry/);

  appendFileSync(join(lib, 'susegad/scenes/dot/model.js'), '// mine\n');
  const edited = await cli('diff', 'scene-dot', '--patch', '--registry', await served(t, repo));
  assert.equal(edited.code, 1);
  assert.match(edited.out, /edited {3}susegad\/scenes\/dot\/model\.js\s+you changed this; \+1 -0 lines/);
  assert.match(edited.out, /\+ \/\/ mine/);
});

test('add refuses a file whose bytes do not match the recorded hash, naming it', async t => {
  const { repo, project, lib, cli } = httpWorkspace(t);
  const url = await served(t, repo);
  // fail first: prove the check bites by serving a tampered file
  appendFileSync(join(repo, 'packages/engine/src/draw.js'), '\n// someone changed this on the server\n');
  const r = await cli('add', 'scene-dot', '--registry', url);
  assert.equal(r.code, 1);
  assert.match(r.err, /packages\/engine\/src\/draw\.js arrived with bytes the registry did not record/);
  assert.match(r.err, /refuse to copy/);
  assert.ok(!existsSync(lib), 'nothing was written');
  assert.ok(!existsSync(join(project, 'susegad.json')), 'no lockfile either');
});

test('add over HTTP still honours --dry-run and your edits', async t => {
  const { repo, project, lib, cli } = httpWorkspace(t);
  const url = await served(t, repo);
  const dry = await cli('add', 'tokens', '--registry', url, '--dry-run');
  assert.equal(dry.code, 0, dry.out + dry.err);
  assert.match(dry.out, /Dry run, so nothing was written/);
  assert.ok(!existsSync(join(project, 'src')));
  await cli('add', 'tokens', '--registry', url);
  appendFileSync(join(lib, 'susegad/tokens/tokens.css'), '/* mine */\n');
  const guard = await cli('add', 'tokens', '--registry', url);
  assert.equal(guard.code, 1);
  assert.match(guard.out, /You have changed 1 file that this would replace/);
  assert.match(readFileSync(join(lib, 'susegad/tokens/tokens.css'), 'utf8'), /mine/);
});

// the skill command ----------------------------------------------------------------

test('every harness entry carries a source and an honest verdict', () => {
  for (const [name, h] of Object.entries(harnessTable())) {
    for (const slot of [h.global, h.project]) {
      if (!slot) continue;
      assert.equal(typeof slot.verified, 'boolean', `${name} verdict is a boolean`);
      assert.match(slot.source, /^https:\/\//, `${name} cites an official page`);
      if (slot.verified) assert.match(slot.path, /^(~|\.)/, `${name} verified path is stated`);
      else assert.equal(slot.path, null, `${name} unverified path is null, never a guess`);
    }
  }
  // the verdicts as verified against the official pages, 3 October 2026
  assert.equal(HARNESSES.claude.global.verified, true);
  assert.equal(HARNESSES.claude.project.path, '.claude/skills');
  assert.equal(HARNESSES.opencode.global.path, '~/.config/opencode/skills');
  assert.equal(HARNESSES.hermes.global.path, '~/.hermes/skills');
  assert.equal(HARNESSES.hermes.project.path, '.hermes/skills');
  assert.equal(HARNESSES.codex.global.verified, false, 'Codex reads AGENTS.md, not a skills folder');
});

test('skill copies SKILL.md and references/ into the asked-for folder', t => {
  const dir = mkdtempSync(join(tmpdir(), 'susegad-skill-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const project = join(dir, 'project');
  const out = [];
  return skill({ harness: 'claude', dir: join(dir, 'skills'), global: false, overwrite: false },
    { cwd: project, out: s => out.push(s ?? '') }).then(code => {
    assert.equal(code, 0);
    const target = join(dir, 'skills', 'susegad-ui');
    assert.ok(existsSync(join(target, 'SKILL.md')));
    assert.ok(existsSync(join(target, 'references', 'scenes.md')));
    assert.match(out.join('\n'), /Installed the susegad-ui skill into/);
  });
});

test('skill refuses an unverified harness instead of guessing, and asks for --dir', async t => {
  const errs = [];
  const code = await run(['skill', '--harness', 'codex', '--global'], { cwd: '.', out: () => {}, err: s => errs.push(s ?? '') });
  assert.equal(code, 1);
  assert.match(errs.join('\n'), /Codex's documentation .* describes no skills folder/);
  assert.match(errs.join('\n'), /AGENTS\.md/);
  assert.match(errs.join('\n'), /--dir/);
});

test('skill sets up a project destination where the docs say it goes', t => {
  const dir = mkdtempSync(join(tmpdir(), 'susegad-skill-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const project = join(dir, 'project');
  const out = [];
  return skill({ harness: 'opencode', dir: undefined, global: false, overwrite: false },
    { cwd: project, out: s => out.push(s ?? '') }).then(code => {
    assert.equal(code, 0);
    assert.ok(existsSync(join(project, '.opencode', 'skills', 'susegad-ui', 'SKILL.md')));
  });
});

test('skill leaves an existing install alone unless --overwrite', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'susegad-skill-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dest = join(dir, 'skills');
  const first = [];
  await skill({ harness: 'claude', dir: dest, global: false, overwrite: false }, { cwd: dir, out: s => first.push(s ?? '') });
  const skillFile = join(dest, 'susegad-ui', 'SKILL.md');
  appendFileSync(skillFile, '\n<!-- mine -->\n');
  const second = [];
  const code = await skill({ harness: 'claude', dir: dest, global: false, overwrite: false }, { cwd: dir, out: s => second.push(s ?? '') });
  assert.equal(code, 0);
  assert.match(second.join('\n'), /left it alone/);
  assert.match(readFileSync(skillFile, 'utf8'), /mine/, 'the existing skill survives');
  const forced = [];
  await skill({ harness: 'claude', dir: dest, global: false, overwrite: true }, { cwd: dir, out: s => forced.push(s ?? '') });
  assert.doesNotMatch(readFileSync(skillFile, 'utf8'), /mine/, '--overwrite replaces it');
});

test('skillDestination: --dir wins, --global picks the user folder, project default', () => {
  const byDir = skillDestination({ dir: 'x', harness: undefined, global: false }, '/tmp/proj');
  assert.equal(byDir.verified, true);
  const project = skillDestination({ dir: undefined, harness: 'claude', global: false }, '/tmp/proj');
  assert.ok(project.dest.includes('.claude') && project.dest.includes('skills'));
  assert.equal(skillDestination({ dir: undefined, harness: 'codex', global: true }, '/tmp/proj'), null);
});
