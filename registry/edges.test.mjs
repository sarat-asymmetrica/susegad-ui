// registry/edges.mjs: a demo, page or check that loads another item's files is an edge the checks need and an install does not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildRegistry, schema } from './build.mjs';
import { validate } from '../packages/cli/src/validate.js';
import { loadedPaths } from './edges.mjs';

const buildScript = join(dirname(fileURLToPath(import.meta.url)), 'build.mjs');
const item = (name, extra = {}) => ({ name, type: 'package', title: name, description: `The ${name}.`, version: '1.0.0', stability: 'experimental', files: ['index.js'], ...extra });

function tree(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'susegad-edges-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return root;
}
// a and b are unrelated; c installs b
const base = (t, extra = {}) => tree(t, {
  'packages/a/registry.json': item('a'),
  'packages/a/index.js': 'export const a = 1;\n',
  'packages/b/registry.json': item('b'),
  'packages/b/index.js': 'export const b = 1;\n',
  'packages/b/b.css': 'b { color: red }\n',
  'packages/c/registry.json': item('c', { dependencies: ['b'] }),
  'packages/c/index.js': "import '../b/index.js';\n",
  ...extra,
});
const checkDepsOf = (root, name) => buildRegistry({ root }).index.items.find(i => i.name === name).checkDeps;

test('a demo, a page module and a stylesheet that load another item land in checkDeps, not dependencies', t => {
  const root = base(t, {
    'packages/a/demo.html': '<link rel="stylesheet" href="../b/b.css">\n',
    'packages/a/page.js': "import { b } from '../b/index.js';\n",
  });
  const { index, errors } = buildRegistry({ root });
  assert.deepEqual(errors, []);
  const a = index.items.find(i => i.name === 'a');
  assert.deepEqual(a.checkDeps, ['b']);
  assert.deepEqual(a.dependencies, [], 'an install of a still does not bring b');
  assert.equal(index.items.find(i => i.name === 'b').checkDeps, undefined);
  assert.deepEqual(validate(index, schema.$defs.index, schema), []);
});

test('a root-absolute path in a demo is an edge too', t => {
  assert.deepEqual(checkDepsOf(base(t, { 'packages/a/demo.html': '<script type="module" src="/packages/b/index.js?v=1"></script>\n' }), 'a'), ['b']);
});

test('a check that imports another item counts, and a unit test does not', t => {
  assert.deepEqual(checkDepsOf(base(t, { 'packages/a/a.check.mjs': "import '../b/index.js';\n" }), 'a'), ['b']);
  assert.equal(checkDepsOf(base(t, { 'packages/a/a.test.js': "import '../b/index.js';\n" }), 'a'), undefined);
});

test('an edge the item already reaches through its dependencies is not repeated', t => {
  const root = base(t, { 'packages/a/registry.json': item('a', { dependencies: ['c'] }), 'packages/a/demo.html': '<script type="module" src="../b/index.js"></script>\n' });
  assert.equal(checkDepsOf(root, 'a'), undefined, 'a reaches b through c');
});

test('the shared folders are left out: a change there already selects every check', t => {
  const root = base(t, {
    'packages/core/registry.json': item('core'), 'packages/core/index.js': 'export {};\n',
    'packages/a/demo.html': '<script type="module" src="../core/index.js"></script>\n',
  });
  assert.equal(checkDepsOf(root, 'a'), undefined);
});

test('checkDeps leave the hash alone, and a file the item installs still needs a declared dependency', t => {
  const plain = buildRegistry({ root: base(t) }).index.items.find(i => i.name === 'a');
  const planted = buildRegistry({ root: base(t, { 'packages/a/demo.html': '<img src="../b/b.css">\n' }) }).index.items.find(i => i.name === 'a');
  assert.equal(planted.hash, plain.hash);
  const listed = buildRegistry({ root: base(t, { 'packages/a/registry.json': item('a', { files: ['index.js', 'demo.html'] }), 'packages/a/demo.html': '<script type="module" src="../b/index.js"></script>\n' }) });
  assert.match(listed.errors.join('\n'), /demo\.html refers to "\.\.\/b\/index\.js", which belongs to b; add "b" to dependencies/);
});

test('loadedPaths reads src, href, import and url(), relative and root-absolute', () => {
  assert.deepEqual(loadedPaths('packages/a/x.css', '@import "../b/b.css"; i { background: url(../b/i.png) }').sort(), ['packages/b/b.css', 'packages/b/i.png']);
  assert.deepEqual(loadedPaths('packages/a/x.html', '<script src="/packages/b/s.js?v=2"></script>'), ['packages/b/s.js']);
});

// The rung's exit: a planted undeclared edge turns the registry check red. The edge is derived, so the build never calls it
// "undeclared"; what goes red is `--check`, because the committed index no longer says what the files say.
test('a planted edge turns --check red until the index is rebuilt', t => {
  const root = base(t);
  const build = (...args) => spawnSync(process.execPath, [buildScript, '--root', root, '--no-shadcn', ...args], { encoding: 'utf8' });
  assert.equal(build().status, 0);
  assert.equal(build('--check').status, 0, 'the index matches the files');
  writeFileSync(join(root, 'packages/a/demo.html'), '<script type="module" src="../b/index.js"></script>\n');
  const red = build('--check');
  assert.equal(red.status, 1, `the planted edge: ${red.stdout}${red.stderr}`);
  assert.match(red.stderr, /out of date/);
  assert.equal(build().status, 0);
  assert.equal(build('--check').status, 0);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'registry', 'registry.json'), 'utf8')).items.find(i => i.name === 'a').checkDeps, ['b']);
});
