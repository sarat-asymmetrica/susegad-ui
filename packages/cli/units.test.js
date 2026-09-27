import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveManifestPath, targetPathFor } from './src/paths.js';
import { validate } from './src/validate.js';
import { hashContent } from './src/hash.js';
import { diffLines, formatPatch } from './src/linediff.js';
import { parseArgs } from './src/args.js';
import { suggest } from './src/registry.js';
import { untar, parsePax, safePath } from './src/tar.js';

const schema = JSON.parse(readFileSync(new URL('../../registry/schema.json', import.meta.url), 'utf8'));

// paths ----------------------------------------------------------------------

test('manifest paths are relative to the manifest folder', () => {
  const exists = p => p === 'packages/scenes/kolam/model.js';
  assert.deepEqual(resolveManifestPath('packages/scenes/kolam', 'model.js', exists), { path: 'packages/scenes/kolam/model.js', repoRooted: false });
  assert.deepEqual(resolveManifestPath('packages/scenes/kolam', './model.js', exists), { path: 'packages/scenes/kolam/model.js', repoRooted: false });
});

test('repo-rooted paths still work during the move', () => {
  const exists = p => p === 'packages/scenes/kolam/model.js';
  assert.deepEqual(resolveManifestPath('packages/scenes/kolam', 'packages/scenes/kolam/model.js', exists), { path: 'packages/scenes/kolam/model.js', repoRooted: true });
});

test('a real packages/ subfolder beside the manifest wins over the repo-rooted reading', () => {
  const exists = p => p === 'packages/core/packages/x.js' || p === 'packages/x.js';
  assert.equal(resolveManifestPath('packages/core', 'packages/x.js', exists).path, 'packages/core/packages/x.js');
});

test('a path that exists nowhere resolves relative, so the error names the right place', () => {
  assert.deepEqual(resolveManifestPath('packages/core', 'packages/gone.js', () => false), { path: 'packages/core/packages/gone.js', repoRooted: false });
});

test('copies keep the tree under susegad/', () => {
  assert.equal(targetPathFor('packages/scenes/paus/render.js'), 'susegad/scenes/paus/render.js');
  assert.equal(targetPathFor('packages/engine/src/noise.js'), 'susegad/engine/src/noise.js');
  assert.equal(targetPathFor('packages/tokens/tokens.css'), 'susegad/tokens/tokens.css');
  assert.throws(() => targetPathFor('tools/shot.mjs'), /outside packages/);
  assert.throws(() => targetPathFor('packages/../secrets.js'), /outside packages/);
});

test('relative imports between packages still resolve after copying', () => {
  const from = targetPathFor('packages/scenes/paus/render.js');
  const resolved = new URL('../../engine/index.js', 'file:///t/' + from).pathname;
  assert.equal(resolved, '/t/' + targetPathFor('packages/engine/index.js'));
});

// schema ---------------------------------------------------------------------

const good = {
  name: 'scene-kolam', type: 'scene', title: 'Kolam', description: 'A threshold drawing.',
  version: '0.1.0', files: ['model.js', 'render.js'], dependencies: ['core'],
  registers: ['quiet', 'warm', 'playful'], budget: { jsBytes: 40000, frameMs: 16.7 },
  prompt: 'kolam.prompt.md', docs: 'kolam.docs.md',
};

test('a complete manifest is valid, and so is a minimal one', () => {
  assert.deepEqual(validate(good, schema), []);
  assert.deepEqual(validate({ name: 'core', type: 'package', files: ['index.js'] }, schema), []);
});

test('the schema catches bad manifests', () => {
  const bad = (patch, expect) => {
    const errors = validate({ ...good, ...patch }, schema);
    assert.ok(errors.some(e => expect.test(e)), `expected ${expect} in ${JSON.stringify(errors)}`);
  };
  bad({ name: 'Scene_Kolam' }, /\$\.name: .*kebab-case/);
  bad({ name: 'scene--kolam' }, /\$\.name/);
  bad({ type: 'widget' }, /\$\.type: should be one of/);
  bad({ files: [] }, /\$\.files: should have at least 1 item/);
  bad({ files: 'model.js' }, /\$\.files: should be array/);
  bad({ files: ['/etc/passwd'] }, /\$\.files\[0\]/);
  bad({ files: ['../engine/index.js'] }, /\$\.files\[0\]/);
  bad({ files: ['C:/x.js'] }, /\$\.files\[0\]/);
  bad({ files: ['src\\model.js'] }, /\$\.files\[0\]/);
  bad({ files: ['a.js', 'a.js'] }, /more than once/);
  bad({ dependencies: ['Core'] }, /\$\.dependencies\[0\]/);
  bad({ registers: ['loud'] }, /\$\.registers\[0\]/);
  bad({ budget: { jsBytes: -1 } }, /\$\.budget\.jsBytes: should be at least 0/);
  bad({ budget: { jsBytes: 1.5 } }, /\$\.budget\.jsBytes: should be integer/);
  bad({ budget: { frameMs: 0 } }, /\$\.budget\.frameMs: should be more than 0/);
  bad({ budget: { kb: 3 } }, /\$\.budget\.kb: is not a known field/);
  assert.deepEqual(validate({ ...good, budget: { jsBytes: 61440, reason: 'The heavy baseline scene.' } }, schema), []);
  bad({ budget: { reason: '' } }, /\$\.budget\.reason: should not be empty/);
  bad({ version: 'v1' }, /\$\.version: .*like 0\.1\.0/);
  bad({ colour: 'red' }, /\$\.colour: is not a known field/);
  const { name, ...nameless } = good;
  assert.ok(validate(nameless, schema).includes('$: is missing "name"'));
});

// hashing, diffing, arguments -------------------------------------------------

test('hashes ignore CRLF versus LF, but not real changes', () => {
  assert.equal(hashContent('a\r\nb\r\n'), hashContent('a\nb\n'));
  assert.notEqual(hashContent('a\nb\n'), hashContent('a\nc\n'));
  assert.match(hashContent(''), /^sha256-[0-9a-f]{64}$/);
  const binary = Buffer.from([0, 13, 10, 1]);
  assert.notEqual(hashContent(binary), hashContent(Buffer.from([0, 10, 1])));
});

test('line diff counts and shows changes', () => {
  const d = diffLines('a\nb\nc\nd\n', 'a\nB\nc\nd\ne\n');
  assert.equal(d.added, 2);
  assert.equal(d.removed, 1);
  assert.deepEqual(d.ops, [[' ', 'a'], ['-', 'b'], ['+', 'B'], [' ', 'c'], [' ', 'd'], ['+', 'e']]);
  assert.deepEqual(formatPatch(d.ops, 0), ['@@ line 2 @@', '- b', '+ B', '@@ line 5 @@', '+ e']);
  assert.deepEqual(diffLines('same\n', 'same\r\n'), { added: 0, removed: 0, ops: [[' ', 'same']] });
});

test('arguments: items, flags and --flag=value', () => {
  assert.deepEqual(parseArgs(['add', 'scene-kolam', 'scene-paus', '--dir', 'app/lib', '--dry-run']),
    { command: 'add', items: ['scene-kolam', 'scene-paus'], dir: 'app/lib', dryRun: true });
  assert.deepEqual(parseArgs(['add', '--registry=file:///x/registry.json', 'core', '--overwrite']),
    { command: 'add', items: ['core'], registry: 'file:///x/registry.json', overwrite: true });
  assert.throws(() => parseArgs(['add', '--force']), /do not know the option --force/);
  assert.throws(() => parseArgs(['add', 'x', '--dir']), /--dir needs a value/);
  assert.throws(() => parseArgs(['add', '--dir', '--dry-run']), /--dir needs a value/);
});

test('suggestions catch typos and partial names', () => {
  const names = ['core', 'engine', 'scene-kolam', 'scene-paus', 'tokens'];
  assert.equal(suggest('scene-kolem', names), 'scene-kolam');
  assert.equal(suggest('kolam', names), 'scene-kolam');
  assert.equal(suggest('token', names), 'tokens');
  assert.equal(suggest('flibbertigibbet', names), null);
});

// A ustar header and body, as git archive writes them.
function tarEntry(name, content = '', type = '0', { prefix = '' } = {}) {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100, 'utf8');
  h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
  const body = Buffer.from(content);
  h.write(body.length.toString(8).padStart(11, '0') + '\0', 124);
  h.write('00000000000\0', 136);
  h.write(type, 156);
  h.write('ustar\0', 257); h.write('00', 263);
  if (prefix) h.write(prefix, 345, 155, 'utf8');
  let sum = 0; for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i];
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return Buffer.concat([h, body, Buffer.alloc((512 - (body.length % 512)) % 512)]);
}
// pax records are "<length> key=value\n", where the length counts itself
const pax = kv => Object.entries(kv).map(([k, v]) => {
  const rest = ` ${k}=${v}\n`;
  let n = rest.length + 1;
  while (String(n).length + rest.length !== n) n = String(n).length + rest.length;
  return `${n}${rest}`;
}).join('');

test('untar reads files, folders, prefixes and pax long paths, and skips the global header', () => {
  const long = `packages/${'deep/'.repeat(30)}file.js`;
  const buf = Buffer.concat([
    tarEntry('pax_global_header', pax({ comment: '1d337de' }), 'g'),
    tarEntry('packages/', '', '5'),
    tarEntry('packages/a.js', 'export const a = 1;\n'),
    tarEntry('b.css', 'p{}', '0', { prefix: 'packages/c' }),
    tarEntry('PaxHeader', pax({ path: long }), 'x'),
    tarEntry('trimmed-name', 'long'),
    Buffer.alloc(1024),
  ]);
  const got = untar(buf).map(e => [e.path, e.dir ? 'dir' : e.content.toString()]);
  assert.deepEqual(got, [['packages', 'dir'], ['packages/a.js', 'export const a = 1;\n'], ['packages/c/b.css', 'p{}'], [long, 'long']]);
});

test('untar refuses a damaged header and paths that leave the folder', () => {
  const bad = tarEntry('packages/a.js', 'x');
  bad[10] ^= 1;
  assert.throws(() => untar(bad), /damaged/);
  assert.throws(() => untar(tarEntry('../evil.js', 'x')), /outside its folder/);
  assert.equal(safePath('packages/./a.js'), 'packages/a.js');
  assert.equal(safePath('/etc/passwd'), null);
  assert.equal(safePath('C:/Windows/x'), null);
  assert.equal(safePath('a/../../b'), null);
});

test('pax records: length-prefixed key=value lines', () => {
  assert.deepEqual(parsePax(Buffer.from(pax({ path: 'a/b.js', comment: 'x y' }))), { path: 'a/b.js', comment: 'x y' });
});

test('--ref takes a value', () => {
  assert.equal(parseArgs(['add', 'x', '--ref', 'main']).ref, 'main');
  assert.equal(parseArgs(['add', 'x', '--ref=1d337de']).ref, '1d337de');
  assert.throws(() => parseArgs(['add', 'x', '--ref']), /--ref needs a value, for example --ref main/);
});
