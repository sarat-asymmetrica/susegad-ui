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
const item = (name, extra = {}) => ({ name, type: 'package', title: name, description: `The ${name}.`, version: '1.0.0', stability: 'experimental', files: ['index.js'], ...extra });

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
    'packages/x/registry.json: type: should be one of "package", "scene", "surface", "component", "recipe", "adapter", got "widget"',
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
    'packages/s/registry.json: has no title, description, version or stability (listed as 0.0.0 for now; listed as experimental for now)',
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

test('stability: a manifest with no stability builds but is flagged; beta or stable needs a one-line reason', t => {
  const bare = tree(t, {
    'packages/p/registry.json': { name: 'p', type: 'package', files: ['index.js'] }, // no stability at all
    'packages/p/index.js': '',
  });
  const bareResult = buildRegistry({ root: bare });
  assert.deepEqual(bareResult.errors, [], 'missing stability does not fail the build');
  assert.equal(bareResult.index.items[0].stability, 'experimental', 'it defaults to experimental');
  assert.match(bareResult.warnings.join('\n'), /has no .*stability.*\(listed as 0\.0\.0 for now; listed as experimental for now\)/);

  // This is the check that must fail first: declaring "beta" with no reason is an error.
  const noReason = tree(t, { 'packages/p/registry.json': item('p', { stability: 'beta' }), 'packages/p/index.js': '' });
  assert.match(buildRegistry({ root: noReason }).errors.join('\n'), /is "beta", which needs a one-line stabilityReason saying why/);

  const withReason = tree(t, {
    'packages/p/registry.json': item('p', { stability: 'beta', stabilityReason: 'Ported from Casa Exemplo, unchanged for two months.' }),
    'packages/p/index.js': '',
  });
  const ok = buildRegistry({ root: withReason });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.index.items[0].stability, 'beta');
  assert.equal(ok.index.items[0].stabilityReason, 'Ported from Casa Exemplo, unchanged for two months.');
});

test('useFor: optional, sorted, and left off the item entirely when absent', t => {
  const tagged = tree(t, { 'packages/s/registry.json': item('scene-s', { type: 'scene', useFor: ['hero', 'divider'] }), 'packages/s/index.js': '' });
  const withUse = buildRegistry({ root: tagged });
  assert.deepEqual(withUse.errors, []);
  assert.deepEqual(withUse.index.items[0].useFor, ['divider', 'hero'], 'sorted, not insertion order');

  const untagged = tree(t, { 'packages/s/registry.json': item('scene-s', { type: 'scene' }), 'packages/s/index.js': '' });
  const noUse = buildRegistry({ root: untagged });
  assert.deepEqual(noUse.errors, []);
  assert.ok(!('useFor' in noUse.index.items[0]), 'no useFor field at all, not an empty array');
});

test('motif: optional, carried to the index as written, and refused when it lacks a field', t => {
  const m = { origin: 'goa', tier: 'everyday', gloss: 'Azulejo: the painted tiles of Goa.' };
  const tagged = tree(t, { 'packages/c/registry.json': item('c', { type: 'component', motif: m }), 'packages/c/index.js': '' });
  const r = buildRegistry({ root: tagged });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.index.items[0].motif, m);
  const plain = buildRegistry({ root: tree(t, { 'packages/c/registry.json': item('c', { type: 'component' }), 'packages/c/index.js': '' }) });
  assert.ok(!('motif' in plain.index.items[0]), 'no motif field when absent');
  const bad = buildRegistry({ root: tree(t, { 'packages/c/registry.json': item('c', { type: 'component', motif: { origin: 'goa' } }), 'packages/c/index.js': '' }) });
  assert.ok(bad.errors.length > 0, 'a motif with no tier or gloss is an error');
});

test('scapes are gated on first sight: decision 0020', t => {
  // first sight counts code (0020, amended), so pad with code, not comments
  const pad = n => 'void 0;\n'.repeat(Math.ceil(n / 8));
  // index.js imports still.js statically and year.js with a dynamic import(): year.js is past first sight
  const scape = ({ still = 30000, year = 50000, budget, extra = {}, staticYear = false } = {}) => tree(t, {
    'packages/s/registry.json': item('scene-s', {
      type: 'scene', registers: ['quiet', 'warm', 'playful'], files: ['index.js', 'still.js', 'year.js'], tier: 'scape', entry: ['index.js'],
      budget: budget ?? { jsBytes: 90000, firstSightBytes: 65536, reason: 'A year of a field; the still first.' }, ...extra,
    }),
    'packages/s/index.js': `import './still.js';\n${staticYear ? "import { year } from './year.js';\n" : "export const later = () => import('./year.js');\n"}`,
    'packages/s/still.js': 'export const still = 1;\n' + pad(still),
    'packages/s/year.js': 'export const year = 1;\n' + pad(year),
  });
  const run = root => buildRegistry({ root });

  const ok = run(scape());
  assert.deepEqual(ok.errors, [], 'a 90 KB scape whose first sight is about 30 KB builds');
  const s = ok.index.items[0];
  assert.equal(s.tier, 'scape');
  assert.deepEqual(s.entry, ['packages/s/index.js']);
  assert.ok(s.firstSightBytes > 30000 && s.firstSightBytes < 31000, `first sight ${s.firstSightBytes}: index and still, not year`);
  assert.ok(s.jsBytes > 80000);
  assert.deepEqual(validate(ok.index, schema.$defs.index, schema), []);

  assert.match(run(scape({ still: 70000 })).errors.join('\n'), /its first sight is \d+ bytes of code \(packages\/s\/index\.js, packages\/s\/still\.js\), over 65536/, 'a 70 KB first sight fails');
  assert.match(run(scape({ still: 1000, year: 70000, staticYear: true })).errors.join('\n'), /its first sight is \d+ bytes of code \(packages\/s\/index\.js, packages\/s\/still\.js, packages\/s\/year\.js\)/, 'a seam claimed but imported statically fails');
  assert.match(run(scape({ budget: { jsBytes: 90000, reason: 'x' } })).errors.join('\n'), /a scape declares budget\.firstSightBytes/);
  assert.match(run(scape({ budget: { jsBytes: 90000, firstSightBytes: 70000, reason: 'x' } })).errors.join('\n'), /declares a first sight of 70000 JS bytes, and a scape may declare at most 65536/);
  assert.match(run(scape({ budget: { jsBytes: 300000, firstSightBytes: 65536, reason: 'x' } })).errors.join('\n'), /a scape may declare at most 262144/);
  assert.match(run(scape({ budget: { jsBytes: 90000, firstSightBytes: 65536 } })).errors.join('\n'), /a scape needs a one-line budget\.reason/);
  assert.match(run(scape({ extra: { entry: [] } })).errors.join('\n'), /entry: should have at least 1 item/);
  assert.match(run(scape({ extra: { type: 'package' } })).errors.join('\n'), /only a scene can be a scape/);

  // a plain scene over 64 KB still fails (decision 0003), and entry alone does not make a scape
  const plain = tree(t, {
    'packages/p/registry.json': item('scene-p', { type: 'scene', registers: ['quiet', 'warm', 'playful'], budget: { jsBytes: 90000, reason: 'Too big.' } }),
    'packages/p/index.js': 'export const p = 1;\n' + pad(80000),
  });
  assert.match(run(plain).errors.join('\n'), /may declare at most 65536 \(decision 0003\)/);
  const half = tree(t, {
    'packages/h/registry.json': item('scene-h', { type: 'scene', registers: ['quiet', 'warm', 'playful'], entry: ['index.js'] }),
    'packages/h/index.js': 'export const h = 1;\n',
  });
  assert.match(run(half).errors.join('\n'), /entry and budget\.firstSightBytes belong to a scape/);
});

test('a scape\'s first sight counts code bytes, and its total counts raw source (0020, amended)', t => {
  const scape = (comment, code) => tree(t, {
    'packages/s/registry.json': item('scene-s', { type: 'scene', registers: ['quiet', 'warm', 'playful'], files: ['index.js'], tier: 'scape', entry: ['index.js'],
      budget: { jsBytes: 262144, firstSightBytes: 65536, reason: 'Heavily documented.' } }),
    'packages/s/index.js': '// a note\n'.repeat(Math.ceil(comment / 10)) + 'void 0;\n'.repeat(Math.ceil(code / 8)),
  });
  const documented = buildRegistry({ root: scape(40000, 40000) });
  assert.deepEqual(documented.errors, [], 'over 64 KB raw, under on code: builds');
  const s = documented.index.items[0];
  assert.ok(s.jsBytes > 65536 && s.firstSightBytes < 65536, `raw ${s.jsBytes}, first sight ${s.firstSightBytes}`);
  assert.equal(s.firstSightBytes, s.codeBytes, 'the same measure as codeBytes');
  assert.match(buildRegistry({ root: scape(100, 70000) }).errors.join('\n'), /its first sight is \d+ bytes of code/, 'over 64 KB of code: fails');
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

// Decision 0017: an item may need an npm package (three for stage3d). The CLI adds it to the
// consumer's package.json, so the pin in the manifest must be the pin the library itself runs on.
test('npmDependencies carry into the index, sorted, and change the hash', t => {
  const files = {
    'package.json': { dependencies: { three: '0.186.1', mediabunny: '1.60.0' } },
    'packages/a/registry.json': item('a', { npmDependencies: { three: '0.186.1', mediabunny: '1.60.0' } }),
    'packages/a/index.js': 'export const a = 1;\n',
  };
  const { index, errors } = buildRegistry({ root: tree(t, files) });
  assert.deepEqual(errors, []);
  const a = index.items[0];
  assert.deepEqual(Object.entries(a.npmDependencies), [['mediabunny', '1.60.0'], ['three', '0.186.1']]);
  assert.deepEqual(validate(index, schema.$defs.index, schema), []);
  const plain = buildRegistry({ root: tree(t, { ...files, 'packages/a/registry.json': item('a') }) }).index.items[0];
  assert.equal(plain.npmDependencies, undefined, 'items without npm packages keep their old shape');
  assert.notEqual(plain.hash, a.hash);
});

test('an npm pin must match the library package.json exactly', t => {
  const manifest = item('a', { npmDependencies: { three: '0.186.1' } });
  const drift = buildRegistry({ root: tree(t, {
    'package.json': { dependencies: { three: '0.185.0' } }, 'packages/a/registry.json': manifest, 'packages/a/index.js': '',
  }) });
  assert.deepEqual(drift.errors, ['packages/a/registry.json: npmDependencies: three is pinned at 0.186.1 here but the library runs 0.185.0 (package.json dependencies); make them agree']);
  const absent = buildRegistry({ root: tree(t, {
    'package.json': { dependencies: {} }, 'packages/a/registry.json': manifest, 'packages/a/index.js': '',
  }) });
  assert.deepEqual(absent.errors, ['packages/a/registry.json: npmDependencies: three is pinned at 0.186.1 here but the library runs none (package.json dependencies); make them agree']);
});

test('an npm pin is an exact version, not a range', t => {
  const { errors } = buildRegistry({ root: tree(t, {
    'package.json': { dependencies: { three: '^0.186.1' } },
    'packages/a/registry.json': item('a', { npmDependencies: { three: '^0.186.1' } }), 'packages/a/index.js': '',
  }) });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^packages\/a\/registry\.json: npmDependencies\.three: "\^0\.186\.1" should be a version like 0\.1\.0/);
});
