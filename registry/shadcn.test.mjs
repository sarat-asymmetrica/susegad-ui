import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildRegistry } from './build.mjs';
import { shadcnItem, shadcnView, validateView, inlineText, SHADCN_TYPE, DEFAULT_BASE_URL } from './shadcn.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const buildScript = join(here, 'build.mjs');

function tree(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'susegad-shadcn-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), typeof content === 'string' || Buffer.isBuffer(content) ? content : JSON.stringify(content));
  }
  return root;
}
function fixture(t, name) {
  const root = mkdtempSync(join(tmpdir(), `susegad-shadcn-${name}-`));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(here, 'fixtures', name), root, { recursive: true });
  return root;
}
const manifest = (name, extra = {}) => ({ name, type: 'package', title: name, description: `The ${name}.`, version: '1.0.0', stability: 'experimental', files: ['index.js'], ...extra });

/** A repo with an engine whose files sit in src/, a scene on it, a font, and a pinned npm dependency. */
function shelf(t) {
  return tree(t, {
    'package.json': { dependencies: { three: '0.1.0' } },
    'packages/engine/registry.json': manifest('engine', { files: ['index.js', 'src/noise.js'] }),
    'packages/engine/index.js': "export * from './src/noise.js';\n",
    'packages/engine/src/noise.js': 'export const n = 1;\r\nexport const m = 2;\r\n',
    'packages/scenes/x/registry.json': manifest('scene-x', { type: 'scene', registers: ['quiet', 'warm', 'playful'], dependencies: ['engine'], npmDependencies: { three: '0.1.0' }, useFor: ['hero'], files: ['index.js', 'x.prompt.md', 'f.woff2'], prompt: 'x.prompt.md' }),
    'packages/scenes/x/index.js': "import '../../engine/index.js';\n",
    'packages/scenes/x/x.prompt.md': '# X\n',
    'packages/scenes/x/f.woff2': Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x00, 0xff, 0xfe]),
  });
}
const load = root => {
  const { index, errors } = buildRegistry({ root });
  assert.deepEqual(errors, []);
  return { root, index, view: shadcnView(index, { root }) };
};
const parse = (view, name) => JSON.parse(view.get(`${name}.json`));

test('every file is a registry:file whose target keeps the repo tree behind the project-root marker', t => {
  const { view } = load(shelf(t));
  const engine = parse(view, 'engine');
  assert.deepEqual(engine.files.map(f => f.target), ['~/susegad/engine/index.js', '~/susegad/engine/src/noise.js'],
    'a bare susegad/engine/src/noise.js has its "src/" stripped by shadcn (4.21), which breaks the relative import');
  for (const f of engine.files) assert.equal(f.type, 'registry:file');
});

test('types map to the nearest shadcn kind', t => {
  const { view } = load(shelf(t));
  assert.equal(parse(view, 'engine').type, 'registry:lib');
  assert.equal(parse(view, 'scene-x').type, 'registry:block');
  assert.deepEqual(SHADCN_TYPE, { component: 'registry:component', scene: 'registry:block', recipe: 'registry:block', package: 'registry:lib', surface: 'registry:theme', adapter: 'registry:item' });
});

test('dependencies become URLs under the base; npm pins stay out of dependencies (shadcn hangs on them) and live in meta and docs', t => {
  const { index, root } = load(shelf(t));
  const scene = index.items.find(i => i.name === 'scene-x');
  const item = shadcnItem(scene, { root, baseUrl: 'http://localhost:9/r/' });
  assert.deepEqual(item.registryDependencies, ['http://localhost:9/r/engine.json']);
  assert.equal(item.dependencies, undefined);
  assert.deepEqual(item.meta.npmDependencies, { three: '0.1.0' });
  assert.match(item.docs, /npm i three@0.1.0/);
  assert.deepEqual(item.categories, ['hero']);
  assert.equal(shadcnItem(scene, { root }).registryDependencies[0], `${DEFAULT_BASE_URL}/engine.json`);
  assert.equal(parse(shadcnView(index, { root }), 'engine').registryDependencies, undefined, 'no dependencies, no key');
});

test('text is inlined as LF, binary files are left out and said so', t => {
  const { view } = load(shelf(t));
  const engine = parse(view, 'engine');
  assert.equal(engine.files[1].content, 'export const n = 1;\nexport const m = 2;\n');
  const scene = parse(view, 'scene-x');
  assert.deepEqual(scene.files.map(f => f.path), ['packages/scenes/x/index.js', 'packages/scenes/x/x.prompt.md']);
  assert.deepEqual(scene.meta.binaryFiles, ['packages/scenes/x/f.woff2']);
  assert.match(scene.docs, /npx @susegad\/cli add scene-x/);
  assert.match(scene.docs, /susegad\/scenes\/x\/x\.prompt\.md/);
  assert.equal(inlineText('a.txt', Buffer.from([0x61, 0x00])), null, 'a NUL byte is binary whatever the extension');
  assert.equal(inlineText('a.txt', Buffer.from([0xc3, 0x28])), null, 'bytes that are not UTF-8 would not round-trip');
  assert.equal(inlineText('a.svg', Buffer.from('<svg>é</svg>')), '<svg>é</svg>');
});

test('the index lists every item without content, in the registry shape', t => {
  const { view, index } = load(shelf(t));
  const reg = JSON.parse(view.get('registry.json'));
  assert.equal(reg.$schema, 'https://ui.shadcn.com/schema/registry.json');
  assert.equal(reg.name, 'susegad-ui');
  assert.equal(reg.homepage, 'https://susegad.asymmetrica.ai');
  assert.deepEqual(reg.items.map(i => i.name), index.items.map(i => i.name));
  for (const i of reg.items) {
    assert.ok(i.type.startsWith('registry:'));
    assert.equal(i.$schema, undefined);
    for (const f of i.files) { assert.equal(f.content, undefined); assert.ok(f.target.startsWith('~/susegad/')); }
  }
  assert.deepEqual([...view.keys()], ['registry.json', 'engine.json', 'scene-x.json']);
});

test('the view is deterministic', t => {
  const root = shelf(t);
  assert.deepEqual([...load(root).view], [...load(root).view]);
});

test('validateView is green on a real view and goes red on each way a view can be broken (fail first)', t => {
  const { view } = load(shelf(t));
  assert.deepEqual(validateView(view), []);
  const broken = edit => { const v = new Map(view); edit(v); return validateView(v).join(' | '); };
  const patch = (v, name, fn) => { const o = JSON.parse(v.get(name + '.json')); fn(o); v.set(name + '.json', JSON.stringify(o)); };
  assert.match(broken(v => patch(v, 'scene-x', o => { o.registryDependencies = [`${DEFAULT_BASE_URL}/nothing.json`]; })), /names no item in the view/);
  assert.match(broken(v => patch(v, 'scene-x', o => { o.registryDependencies = ['https://elsewhere.test/engine.json']; })), /not a URL under/);
  assert.match(broken(v => patch(v, 'engine', o => { o.files[1].target = 'susegad/engine/src/noise.js'; })), /target must start with ~/);
  assert.match(broken(v => patch(v, 'engine', o => { delete o.files[0].content; })), /has no inlined content/);
  assert.match(broken(v => patch(v, 'engine', o => { o.type = 'component'; })), /not a shadcn registry type/);
  assert.match(broken(v => v.delete('engine.json')), /lists different items/);
});

test('--check builds the view in memory and validates it, writes nothing, and --no-shadcn skips it', t => {
  const good = fixture(t, 'good');
  const ok = spawnSync(process.execPath, [buildScript, '--root', good, '--check'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /The shadcn view builds and validates: 6 files/);
  assert.equal(existsSync(join(good, 'registry', 'shadcn')), false);
  const skipped = spawnSync(process.execPath, [buildScript, '--root', good, '--check', '--no-shadcn'], { encoding: 'utf8' });
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.doesNotMatch(skipped.stdout, /shadcn view/);
});

test('--shadcn-out and --base-url write a view elsewhere, with the URLs it was told', t => {
  const good = fixture(t, 'good');
  const out = join(good, 'elsewhere');
  const run = spawnSync(process.execPath, [buildScript, '--root', good, '--out', join(good, 'tmp-index.json'), '--shadcn-out', out, '--base-url', 'http://localhost:1234/r'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'scene-dot.json'), 'utf8')).registryDependencies,
    ['http://localhost:1234/r/core.json', 'http://localhost:1234/r/engine.json']);
});

test('a template is left out of the shadcn view, since its files land at a project root and would overwrite the project own files', t => {
  const root = shelf(t);
  mkdirSync(join(root, 'packages/templates/site'), { recursive: true });
  writeFileSync(join(root, 'packages/templates/site/registry.json'), JSON.stringify(manifest('template-site', { type: 'template', files: ['index.html', 'package.json'] })));
  writeFileSync(join(root, 'packages/templates/site/index.html'), '<p>hi</p>');
  writeFileSync(join(root, 'packages/templates/site/package.json'), '{}');
  const { view, index } = load(root);
  assert.ok(index.items.some(i => i.name === 'template-site'), 'the registry index still has it');
  assert.ok(!view.has('template-site.json'));
  assert.ok(!JSON.parse(view.get('registry.json')).items.some(i => i.name === 'template-site'));
  assert.deepEqual(validateView(view), []);
});
