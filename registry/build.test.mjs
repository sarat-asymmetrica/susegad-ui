import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildRegistry, findManifests, schema, serialise } from './build.mjs';
import { validate } from '../packages/cli/src/validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');
const buildScript = join(here, 'build.mjs');

/** Write a throwaway repo: { 'packages/a/registry.json': {...}, 'packages/a/a.js': '...' } */
function tree(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'susegad-registry-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return root;
}
/** A private copy of a fixture repo, so no test reads files another test or agent is writing. */
function fixture(t, name) {
  const root = mkdtempSync(join(tmpdir(), `susegad-fixture-${name}-`));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(fixtures, name), root, { recursive: true });
  return root;
}
const item = (name, extra = {}) => ({ name, type: 'package', title: name, description: `The ${name}.`, version: '1.0.0', files: ['index.js'], ...extra });

test('the good fixture builds, and the committed index matches it byte for byte', t => {
  const good = fixture(t, 'good');
  const { index, errors, notes } = buildRegistry({ root: good });
  assert.deepEqual(errors, []);
  assert.deepEqual(index.items.map(i => i.name), ['core', 'engine', 'hello', 'scene-dot', 'tokens']);
  assert.equal(index.base, '..');
  assert.deepEqual(validate(index, schema.$defs.index, schema), []);
  assert.equal(serialise(index), readFileSync(join(good, 'registry', 'registry.json'), 'utf8').replace(/\r\n/g, '\n'),
    'registry/fixtures/good/registry/registry.json is stale: run node registry/build.mjs --root registry/fixtures/good');
  assert.equal(notes.length, 1, 'one repo-rooted path is flagged');
});

test('the build is deterministic', t => {
  const good = fixture(t, 'good');
  assert.equal(serialise(buildRegistry({ root: good }).index), serialise(buildRegistry({ root: good }).index));
});

test('both relative and repo-rooted paths land on the same repo path', t => {
  const dot = buildRegistry({ root: fixture(t, 'good') }).index.items.find(i => i.name === 'scene-dot');
  assert.deepEqual(dot.files.map(f => f.path), [
    'packages/scenes/dot/dot.prompt.md', 'packages/scenes/dot/index.js', 'packages/scenes/dot/model.js']);
  assert.equal(dot.prompt, 'packages/scenes/dot/dot.prompt.md');
});

test('each item gets bytes, JS bytes and a content hash that follows its files', t => {
  const root = tree(t, {
    'packages/a/registry.json': item('a', { files: ['index.js', 'notes.md'] }),
    'packages/a/index.js': 'export const a = 1;\n',
    'packages/a/notes.md': '# A\n',
  });
  const first = buildRegistry({ root }).index.items[0];
  assert.equal(first.bytes, 24);
  assert.equal(first.jsBytes, 20);
  writeFileSync(join(root, 'packages/a/index.js'), 'export const a = 2;\n');
  assert.notEqual(buildRegistry({ root }).index.items[0].hash, first.hash);
  writeFileSync(join(root, 'packages/a/index.js'), 'export const a = 1;\r\n');
  assert.equal(buildRegistry({ root }).index.items[0].files[0].hash, first.files[0].hash, 'CRLF hashes like LF');
});

test('schema problems are reported per manifest', t => {
  const root = tree(t, { 'packages/x/registry.json': { name: 'X', type: 'widget', files: [] } });
  const { index, errors } = buildRegistry({ root });
  assert.equal(index, null);
  assert.deepEqual(errors, [
    'packages/x/registry.json: name: "X" should be lowercase kebab-case, like scene-kolam',
    'packages/x/registry.json: type: should be one of "package", "scene", "component", "recipe", "adapter", got "widget"',
    'packages/x/registry.json: files: should have at least 1 item',
  ]);
});

test('bad JSON, missing files, duplicate names, missing dependencies and cycles all fail', t => {
  const cases = {
    json: [{ 'packages/a/registry.json': '{ "name": ' }, /packages\/a\/registry\.json: is not valid JSON/],
    file: [{ 'packages/a/registry.json': item('a', { files: ['gone.js'] }) }, /file "gone\.js" does not exist \(looked for packages\/a\/gone\.js\)/],
    outside: [{ 'packages/a/registry.json': item('a', { files: ['x/../../../tools/x.js'] }) }, /files\[0\]/],
    prompt: [{ 'packages/a/registry.json': item('a', { prompt: 'a.prompt.md' }), 'packages/a/index.js': '' }, /prompt "a\.prompt\.md" does not exist/],
    duplicate: [{
      'packages/a/registry.json': item('same'), 'packages/a/index.js': '',
      'packages/b/registry.json': item('same'), 'packages/b/index.js': '',
    }, /packages\/b\/registry\.json: the name "same" is already used by packages\/a\/registry\.json/],
    missing: [{ 'packages/a/registry.json': item('a', { dependencies: ['ghost'] }), 'packages/a/index.js': '' }, /depends on "ghost", and no manifest has that name/],
    cycle: [{
      'packages/a/registry.json': item('a', { dependencies: ['b'] }), 'packages/a/index.js': '',
      'packages/b/registry.json': item('b', { dependencies: ['c'] }), 'packages/b/index.js': '',
      'packages/c/registry.json': item('c', { dependencies: ['a'] }), 'packages/c/index.js': '',
    }, /^dependency loop: a -> b -> c -> a$/],
  };
  for (const [name, [files, expect]] of Object.entries(cases)) {
    const { index, errors } = buildRegistry({ root: tree(t, files) });
    assert.equal(index, null, name);
    assert.ok(errors.some(e => expect.test(e)), `${name}: expected ${expect} in ${JSON.stringify(errors)}`);
  }
});

test('thin manifests warn, and fail under --strict', t => {
  const root = tree(t, {
    'packages/s/registry.json': { name: 'scene-s', type: 'scene', files: ['index.js'], registers: ['warm'] },
    'packages/s/index.js': 'export const s = true;\n',
  });
  const loose = buildRegistry({ root });
  assert.deepEqual(loose.errors, []);
  assert.equal(loose.index.items[0].version, '0.0.0');
  assert.deepEqual(loose.warnings, [
    'packages/s/registry.json: has no title, description or version (listed as 0.0.0 for now)',
    'packages/s/registry.json: a scene should list all three registers, this one lists warm',
  ]);
  assert.equal(buildRegistry({ root, strict: true }).errors.length, 2);
});

test('budgets are a gate: decisions 0002 to 0004', t => {
  const big = n => 'export const x = 1;\n' + '// padding\n'.repeat(Math.ceil(n / 11));
  const scene = (budget, bytes) => tree(t, {
    'packages/s/registry.json': item('scene-s', { type: 'scene', registers: ['quiet', 'warm', 'playful'], ...(budget && { budget }) }),
    'packages/s/index.js': big(bytes),
  });
  const run = root => buildRegistry({ root });

  const plain = run(scene(null, 1000));
  assert.deepEqual(plain.errors, []);
  assert.deepEqual(plain.index.items[0].budget, { jsBytes: 40960 }, 'a scene with no budget gets the 40 KB default');
  assert.equal(plain.index.items[0].codeBytes, 20, 'comments are not code');

  assert.match(run(scene(null, 41000)).errors.join('\n'), /is over its budget of 40960 \(the scene default\)\. Trim it/);
  assert.match(run(scene({ jsBytes: 50000 }, 1000)).errors.join('\n'), /over the 40960 default, so it needs a one-line budget\.reason/);
  assert.deepEqual(run(scene({ jsBytes: 61440, reason: 'The heavy baseline.' }, 57000)).errors, []);
  assert.match(run(scene({ jsBytes: 70000, reason: 'Too much.' }, 1000)).errors.join('\n'), /may declare at most 65536/);
  assert.match(run(scene({ jsBytes: 61440, reason: 'The heavy baseline.' }, 62000)).errors.join('\n'), /over its budget of 61440\. Trim it/);

  const pkg = tree(t, { 'packages/core/registry.json': item('core', { budget: { jsBytes: 10 } }), 'packages/core/index.js': 'export const core = 1;\n' });
  assert.match(run(pkg).errors.join('\n'), /23 JS bytes is over its budget of 10\./, 'packages are held to their declared budget too');
  const unbudgeted = tree(t, { 'packages/p/registry.json': item('p'), 'packages/p/index.js': big(90000) });
  assert.deepEqual(run(unbudgeted).errors, [], 'packages without a budget are not given one');
});

test('fixtures and node_modules are not walked', t => {
  const root = tree(t, {
    'packages/a/registry.json': item('a'), 'packages/a/index.js': '',
    'packages/a/fixtures/packages/z/registry.json': item('z'),
    'packages/node_modules/q/registry.json': item('q'),
  });
  assert.deepEqual(findManifests(root), ['packages/a/registry.json']);
});

test('a folder can hold a second item as <name>.registry.json, with paths relative to the folder', t => {
  const root = tree(t, {
    'packages/core/registry.json': item('core'),
    'packages/core/index.js': 'export const core = 1;\n',
    'packages/core/component.registry.json': item('core-component', { files: ['component.js'], dependencies: ['core'] }),
    'packages/core/component.js': 'export const component = 1;\n',
    'packages/core/notes.json': '{}',
    'packages/core/registry.json.bak': '{}',
  });
  assert.deepEqual(findManifests(root), ['packages/core/component.registry.json', 'packages/core/registry.json']);
  const { index, errors } = buildRegistry({ root });
  assert.deepEqual(errors, []);
  const comp = index.items.find(i => i.name === 'core-component');
  assert.equal(comp.manifest, 'packages/core/component.registry.json');
  assert.deepEqual(comp.files.map(f => f.path), ['packages/core/component.js']);
  assert.deepEqual(comp.dependencies, ['core']);
});

test('the command fails loudly on the broken fixture and --check spots a stale index', t => {
  const bad = spawnSync(process.execPath, [buildScript, '--root', fixture(t, 'broken')], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /The registry did not build\. 6 problems to fix:/);
  assert.match(bad.stderr, /dependency loop: loop-a -> loop-b -> loop-a/);

  const good = fixture(t, 'good');
  const ok = spawnSync(process.execPath, [buildScript, '--root', good, '--check'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /is up to date with 5 items/);

  const copy = fixture(t, 'good');
  writeFileSync(join(copy, 'packages/engine/index.js'), 'export {};\n');
  const stale = spawnSync(process.execPath, [buildScript, '--root', copy, '--check'], { encoding: 'utf8' });
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /is out of date\. Run node registry\/build\.mjs/);
});

test('every relative reference in a copied file must be copied too', t => {
  const base = {
    'packages/engine/registry.json': item('engine'), 'packages/engine/index.js': 'export const e = 1;\n',
    'packages/stray/lonely.js': 'export {};\n',
  };
  const recipe = (deps, code) => tree(t, {
    ...base,
    'packages/recipes/r/registry.json': item('r', { type: 'recipe', files: ['recipe.js'], dependencies: deps }),
    'packages/recipes/r/recipe.js': code,
  });
  assert.deepEqual(buildRegistry({ root: recipe(['engine'], "import '../../engine/index.js';\n") }).errors, []);
  assert.deepEqual(buildRegistry({ root: recipe([], "import '../../engine/index.js';\n") }).errors,
    ['packages/recipes/r/registry.json: packages/recipes/r/recipe.js refers to "../../engine/index.js", which belongs to engine; add "engine" to dependencies']);
  assert.match(buildRegistry({ root: recipe([], "import '../../stray/lonely.js';\n") }).errors[0],
    /refers to "\.\.\/\.\.\/stray\/lonely\.js", which no manifest lists \(packages\/stray\/lonely\.js\); add it to files/);
  assert.match(buildRegistry({ root: recipe([], "import '../../../tools/serve.mjs';\n") }).errors[0],
    /would not be copied \(tools\/serve\.mjs\), because it is outside packages\//);
  assert.match(buildRegistry({ root: recipe([], "import './missing.js';\n") }).errors[0],
    /refers to "\.\/missing\.js", which would not be copied \(packages\/recipes\/r\/missing\.js\)/);
  // A folder reference is copied when a file inside it is; an empty or unlisted folder still fails.
  const folder = listed => tree(t, {
    'packages/cache/registry.json': item('cache', { files: listed }),
    'packages/cache/index.js': "export const dir = new URL('./fixtures/', import.meta.url);\n",
    'packages/cache/fixtures/README.md': 'The cache lives here.\n',
  });
  assert.deepEqual(buildRegistry({ root: folder(['index.js', 'fixtures/README.md']) }).errors, []);
  assert.match(buildRegistry({ root: folder(['index.js']) }).errors[0], /refers to "\.\/fixtures\/", which would not be copied/);
});

test('a recipe outside packages/ gets a note on how to move it, and is not copied', t => {
  const root = tree(t, {
    'packages/a/registry.json': item('a'), 'packages/a/index.js': '',
    'recipes/old/registry.json': item('old', { type: 'recipe' }),
  });
  const { errors, warnings, index } = buildRegistry({ root });
  assert.deepEqual(errors, []);
  assert.deepEqual(index.items.map(i => i.name), ['a']);
  assert.deepEqual(warnings, ['recipes/old/registry.json is outside packages/, so the CLI cannot copy it. Move its folder to packages/recipes/old/ and change "../../packages/" to "../../" in its imports']);
});

// Deliberately not hermetic: this is the live gate on the repo's own manifests and budgets.
test('the real repo builds from whatever manifests exist today', () => {
  const { errors } = buildRegistry({ root: join(here, '..') });
  assert.deepEqual(errors, []);
});
