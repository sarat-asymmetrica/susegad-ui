import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run } from './bin/susegad.mjs';
import { buildRegistry, serialise } from '../../registry/build.mjs';
import { hashContent } from './src/hash.js';

const fixture = fileURLToPath(new URL('../../registry/fixtures/good', import.meta.url));

/** A private copy of the fixture repo with a fresh index, and an empty project beside it. */
function workspace(t) {
  const dir = mkdtempSync(join(tmpdir(), 'susegad-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const repo = join(dir, 'repo');
  cpSync(fixture, repo, { recursive: true });
  const rebuild = () => {
    const { index, errors } = buildRegistry({ root: repo });
    assert.deepEqual(errors, []);
    writeFileSync(join(repo, 'registry', 'registry.json'), serialise(index));
  };
  rebuild();
  const project = join(dir, 'project');
  const cli = (...argv) => {
    const out = [], err = [];
    const code = run([...argv, '--registry', repo], { cwd: project, out: s => out.push(s ?? ''), err: s => err.push(s ?? '') });
    return { code, out: out.join('\n'), err: err.join('\n') };
  };
  return { repo, project, lib: join(project, 'src', 'lib'), cli, rebuild };
}

test('add copies the item and its dependencies, keeping the tree', t => {
  const { repo, project, lib, cli } = workspace(t);
  const r = cli('add', 'scene-dot');
  assert.equal(r.code, 0, r.err);
  for (const p of ['tokens/tokens.css', 'tokens/tokens.js', 'engine/index.js', 'engine/src/draw.js',
    'core/index.js', 'core/define-scene.js', 'core/scene-element.js', 'scenes/dot/index.js', 'scenes/dot/model.js', 'scenes/dot/dot.prompt.md']) {
    assert.ok(existsSync(join(lib, 'susegad', p)), `${p} was copied`);
  }
  assert.equal(readFileSync(join(lib, 'susegad/engine/src/draw.js'), 'utf8'),
    readFileSync(join(repo, 'packages/engine/src/draw.js'), 'utf8'));
  assert.match(r.out, /Adding scene-dot, with the 3 pieces it needs: engine, tokens and core\./);
  assert.match(r.out, /Copied 10 files into src\/lib\/susegad\. They are yours now/);
  assert.match(r.out, /import '\.\/src\/lib\/susegad\/scenes\/dot\/index\.js';/);
  assert.match(r.out, /<sg-scene name="dot"><\/sg-scene>/);
  assert.ok(!existsSync(join(project, 'susegad')), 'nothing lands outside --dir');
});

test('a recipe lands in susegad/recipes/ and its imports resolve inside the copy', t => {
  const { lib, cli } = workspace(t);
  const r = cli('add', 'hello');
  assert.equal(r.code, 0, r.err);
  const recipe = join(lib, 'susegad/recipes/hello/recipe.js');
  assert.ok(existsSync(recipe));
  for (const spec of ['../../core/index.js', '../../scenes/dot/index.js']) {
    assert.ok(existsSync(fileURLToPath(new URL(spec, pathToFileURL(recipe)))), `${spec} resolves from the copied recipe`);
  }
  assert.ok(existsSync(fileURLToPath(new URL('../../tokens/tokens.css', pathToFileURL(join(lib, 'susegad/recipes/hello/recipe.css'))))));
  assert.match(r.out, /<link rel="stylesheet" href="\.\/src\/lib\/susegad\/recipes\/hello\/recipe\.css">/);
  assert.match(r.out, /import '\.\/src\/lib\/susegad\/recipes\/hello\/recipe\.js';/);
  assert.match(r.out, /How to mount hello: \.\/src\/lib\/susegad\/recipes\/hello\/README\.md/);
  assert.match(r.out, /A working page to start from: \.\/src\/lib\/susegad\/recipes\/hello\/index\.html/);
});

test('the lockfile records names, versions, hashes and what was asked for', t => {
  const { lib, cli } = workspace(t);
  cli('add', 'scene-dot');
  const lock = JSON.parse(readFileSync(join(lib, 'susegad.json'), 'utf8'));
  assert.equal(lock.registry, 'susegad-ui');
  assert.deepEqual(Object.keys(lock.items), ['core', 'engine', 'scene-dot', 'tokens']);
  const dot = lock.items['scene-dot'];
  assert.equal(dot.version, '0.1.0');
  assert.equal(dot.type, 'scene');
  assert.equal(dot.requested, true);
  assert.equal(lock.items.core.requested, false);
  assert.match(dot.hash, /^sha256-[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(dot.files), ['susegad/scenes/dot/dot.prompt.md', 'susegad/scenes/dot/index.js', 'susegad/scenes/dot/model.js']);
  assert.equal(dot.files['susegad/scenes/dot/model.js'], hashContent(readFileSync(join(lib, 'susegad/scenes/dot/model.js'))));
});

test('adding twice changes nothing, and asking for a dependency later keeps it requested', t => {
  const { lib, cli } = workspace(t);
  cli('add', 'scene-dot');
  const before = readFileSync(join(lib, 'susegad.json'), 'utf8');
  const again = cli('add', 'scene-dot');
  assert.equal(again.code, 0);
  assert.match(again.out, /Everything was already here and up to date/);
  assert.equal(readFileSync(join(lib, 'susegad.json'), 'utf8'), before);

  cli('add', 'core');
  cli('add', 'scene-dot');
  assert.equal(JSON.parse(readFileSync(join(lib, 'susegad.json'), 'utf8')).items.core.requested, true);
});

test('--dir puts things elsewhere, and --dry-run writes nothing', t => {
  const { project, cli } = workspace(t);
  const dry = cli('add', 'engine', '--dir', 'vendor', '--dry-run');
  assert.equal(dry.code, 0);
  assert.match(dry.out, /new {5}vendor\/susegad\/engine\/src\/draw\.js/);
  assert.match(dry.out, /Dry run, so nothing was written\. Without --dry-run I would write 2 files/);
  assert.ok(!existsSync(join(project, 'vendor')));
  assert.equal(cli('add', 'engine', '--dir', 'vendor').code, 0);
  assert.ok(existsSync(join(project, 'vendor/susegad/engine/src/draw.js')));
  assert.ok(existsSync(join(project, 'vendor/susegad.json')));
});

test('a file the builder changed is never overwritten without --overwrite', t => {
  const { lib, cli } = workspace(t);
  cli('add', 'scene-dot');
  const mine = join(lib, 'susegad/scenes/dot/model.js');
  appendFileSync(mine, '// my tweak\n');
  const edited = readFileSync(mine, 'utf8');
  rmSync(join(lib, 'susegad/engine/index.js'));

  const r = cli('add', 'scene-dot');
  assert.equal(r.code, 1);
  assert.match(r.out, /You have changed 1 file that this would replace, so I have left everything as it was/);
  assert.match(r.out, /src\/lib\/susegad\/scenes\/dot\/model\.js/);
  assert.match(r.out, /susegad diff scene-dot/);
  assert.match(r.out, /susegad add scene-dot --overwrite/);
  assert.equal(readFileSync(mine, 'utf8'), edited, 'the edit survives');
  assert.ok(!existsSync(join(lib, 'susegad/engine/index.js')), 'nothing else was written either');

  const forced = cli('add', 'scene-dot', '--overwrite');
  assert.equal(forced.code, 0);
  assert.match(forced.out, /1 of yours replaced/);
  assert.doesNotMatch(readFileSync(mine, 'utf8'), /my tweak/);
  assert.ok(existsSync(join(lib, 'susegad/engine/index.js')));
});

test('a file the builder has not touched is updated when the registry moves on', t => {
  const { repo, lib, cli, rebuild } = workspace(t);
  cli('add', 'scene-dot');
  appendFileSync(join(repo, 'packages/engine/src/draw.js'), 'export const version = 2;\n');
  rebuild();
  const r = cli('add', 'scene-dot');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /engine\s+0\.1\.0\s+1 updated, 1 already here/);
  assert.match(readFileSync(join(lib, 'susegad/engine/src/draw.js'), 'utf8'), /version = 2/);
});

test('a file both sides changed is protected', t => {
  const { repo, lib, cli, rebuild } = workspace(t);
  cli('add', 'scene-dot');
  appendFileSync(join(repo, 'packages/engine/src/draw.js'), 'export const version = 2;\n');
  rebuild();
  appendFileSync(join(lib, 'susegad/engine/src/draw.js'), '// mine\n');
  assert.equal(cli('add', 'scene-dot').code, 1);
  assert.match(readFileSync(join(lib, 'susegad/engine/src/draw.js'), 'utf8'), /\/\/ mine/);
});

test('a file already there but never added by us is treated as the builder\'s', t => {
  const { lib, cli } = workspace(t);
  const tokens = join(lib, 'susegad/tokens/tokens.css');
  mkdirSync(dirname(tokens), { recursive: true });
  writeFileSync(tokens, ':root { --sg-ink: hotpink; }\n');
  assert.equal(cli('add', 'tokens').code, 1);
  assert.match(readFileSync(tokens, 'utf8'), /hotpink/);
});

test('a stale index is refused before anything is written', t => {
  const { repo, project, cli } = workspace(t);
  appendFileSync(join(repo, 'packages/scenes/dot/model.js'), '// newer\n');
  const r = cli('add', 'scene-dot');
  assert.equal(r.code, 1);
  assert.match(r.err, /is out of date:\n {2}packages\/scenes\/dot\/model\.js has changed since the index was built/);
  assert.match(r.err, /node registry\/build\.mjs/);
  assert.ok(!existsSync(join(project, 'src')));
});

test('unknown items get a suggestion; a missing registry says how to build one', t => {
  const { cli, project } = workspace(t);
  const r = cli('add', 'scene-dat');
  assert.equal(r.code, 1);
  assert.match(r.err, /I do not have anything called "scene-dat"\. Did you mean scene-dot\?/);
  const err = [];
  assert.equal(run(['list', '--registry', join(project, 'nowhere')], { cwd: project, out: () => {}, err: s => err.push(s) }), 1);
  assert.match(err.join('\n'), /could not find the registry index[\s\S]*node registry\/build\.mjs/);
});

test('--registry accepts a file URL to the index', t => {
  const { repo, project } = workspace(t);
  const out = [];
  const code = run(['list', '--registry', pathToFileURL(join(repo, 'registry', 'registry.json')).href], { cwd: project, out: s => out.push(s), err: s => out.push(s) });
  assert.equal(code, 0, out.join('\n'));
  assert.match(out.join('\n'), /scene-dot/);
});

test('list groups by type; info shows files, dependencies, budget and prompt', t => {
  const { cli } = workspace(t);
  const l = cli('list');
  assert.equal(l.code, 0);
  assert.match(l.out, /on the shelf \(5 items\)/);
  assert.ok(l.out.indexOf('Packages') < l.out.indexOf('Scenes'));
  assert.match(l.out, /scene-dot {2}Fixture scene/);

  const i = cli('info', 'scene-dot');
  assert.equal(i.code, 0);
  assert.match(i.out, /Depends on: {2}core, engine/);
  assert.match(i.out, /All it pulls in: {2}engine, tokens, core/);
  assert.match(i.out, /Budget: {6}\d+ of 4000 JS bytes \(\d+ without comments\), 16\.7 ms per frame/);
  assert.match(i.out, /Prompt: {6}packages\/scenes\/dot\/dot\.prompt\.md/);
  assert.match(i.out, /packages\/scenes\/dot\/model\.js\s+-> susegad\/scenes\/dot\/model\.js/);

  const j = JSON.parse(cli('info', 'scene-dot', '--json').out);
  assert.deepEqual(j.needs, ['engine', 'tokens', 'core']);
});

test('diff shows which copied files differ, and why', t => {
  const { repo, lib, cli, rebuild } = workspace(t);
  assert.match(cli('diff').out, /Nothing from Susegad UI has been added/);
  assert.match(cli('diff', 'scene-dot').out, /scene-dot has not been added/);
  cli('add', 'scene-dot');

  const clean = cli('diff', 'scene-dot');
  assert.equal(clean.code, 0);
  assert.match(clean.out, /All 3 files match the registry/);

  appendFileSync(join(lib, 'susegad/scenes/dot/model.js'), '// mine\n');
  rmSync(join(lib, 'susegad/scenes/dot/dot.prompt.md'));
  appendFileSync(join(repo, 'packages/engine/src/draw.js'), '// upstream\n');
  rebuild();

  const r = cli('diff', '--patch');
  assert.equal(r.code, 1);
  assert.match(r.out, /edited {3}susegad\/scenes\/dot\/model\.js\s+you changed this; \+1 -0 lines/);
  assert.match(r.out, /\+ \/\/ mine/);
  assert.match(r.out, /missing {2}susegad\/scenes\/dot\/dot\.prompt\.md/);
  assert.match(r.out, /older {4}susegad\/engine\/src\/draw\.js\s+the registry has moved on/);
  assert.match(r.out, /core 0\.1\.0\n {2}All 3 files match/);
});

// --ref: the fixture repo under git, with work in its tree that was never committed
function gitWorkspace(t) {
  const w = workspace(t);
  const git = (...a) => execFileSync('git', ['-C', w.repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...a], { stdio: 'pipe' }).toString().trim();
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', 'the committed registry');
  return { ...w, git };
}
let hasGit = true;
try { execFileSync('git', ['--version'], { stdio: 'ignore' }); } catch { hasGit = false; }

test('--ref installs what was committed, past a stale index and uncommitted work', { skip: !hasGit && 'git is not installed' }, t => {
  const { repo, lib, cli, git } = gitWorkspace(t);
  const committed = readFileSync(join(repo, 'packages/engine/src/draw.js'), 'utf8');
  appendFileSync(join(repo, 'packages/engine/src/draw.js'), '// work in progress, never committed\n');

  const plain = cli('add', 'scene-dot');
  assert.equal(plain.code, 1, 'the working tree index is stale');
  assert.match(plain.err, /is out of date/);

  const r = cli('add', 'scene-dot', '--ref', 'HEAD');
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, new RegExp(`Reading the registry at HEAD \\(${git('rev-parse', '--short=7', 'HEAD')}\\), as committed\\.`));
  const lf = s => s.replace(/\r\n/g, '\n'); // the working copy may have CRLF; hashes read both as LF
  assert.equal(lf(readFileSync(join(lib, 'susegad/engine/src/draw.js'), 'utf8')), lf(committed), 'the committed file, not the one in the tree');
  assert.ok(existsSync(join(lib, 'susegad/scenes/dot/index.js')));
  assert.ok(!readdirSync(tmpdir()).some(d => d.startsWith('susegad-ref-') && existsSync(join(tmpdir(), d, 'registry'))), 'the export is cleaned up');
});

test('--ref reads a branch or an older commit, and diff can use it too', { skip: !hasGit && 'git is not installed' }, t => {
  const { repo, lib, cli, git, rebuild } = gitWorkspace(t);
  const first = git('rev-parse', 'HEAD');
  appendFileSync(join(repo, 'packages/engine/src/draw.js'), 'export const version = 2;\n');
  rebuild();
  git('commit', '-q', '-am', 'engine v2');
  assert.equal(cli('add', 'scene-dot', '--ref', first).code, 0);
  assert.doesNotMatch(readFileSync(join(lib, 'susegad/engine/src/draw.js'), 'utf8'), /version = 2/);
  const d = cli('diff', 'engine', '--ref', 'HEAD');
  assert.equal(d.code, 1);
  assert.match(d.out, /older {4}susegad\/engine\/src\/draw\.js\s+the registry has moved on/);
  assert.equal(cli('add', 'scene-dot', '--ref', 'HEAD').code, 0);
  assert.match(readFileSync(join(lib, 'susegad/engine/src/draw.js'), 'utf8'), /version = 2/);
});

test('--ref says plainly when the ref or the repository is not there', { skip: !hasGit && 'git is not installed' }, t => {
  const { cli } = gitWorkspace(t);
  const r = cli('add', 'scene-dot', '--ref', 'no-such-branch');
  assert.equal(r.code, 1);
  assert.match(r.err, /I could not find no-such-branch in .+\. Give a commit, branch or tag that exists there\./);

  const plain = workspace(t), errs = [];
  const code = run(['add', 'scene-dot', '--ref', 'HEAD', '--registry', plain.repo], { cwd: plain.project, out: () => {}, err: s => errs.push(s) });
  assert.equal(code, 1);
  assert.match(errs.join('\n'), /--ref needs the registry to be a git repository/);
});
