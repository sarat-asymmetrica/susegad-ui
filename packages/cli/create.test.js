import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { run } from './bin/susegad.mjs';
import { buildRegistry, serialise } from '../../registry/build.mjs';
import { targetPathFor, templateRefTarget } from './src/paths.js';

const fixture = fileURLToPath(new URL('../../registry/fixtures/good', import.meta.url));

/** The fixture repo plus a two-page template that refers to the library as susegad/..., as a real one does. */
function workspace(t, { page } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'susegad-create-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const repo = join(dir, 'repo');
  cpSync(fixture, repo, { recursive: true });
  const tpl = join(repo, 'packages/templates/mini');
  mkdirSync(join(tpl, 'gom-deva'), { recursive: true });
  writeFileSync(join(tpl, 'registry.json'), JSON.stringify({
    name: 'template-mini', type: 'template', stability: 'experimental', title: 'Mini', description: 'A fixture template.', version: '0.1.0',
    files: ['strings.js', 'pages.mjs', 'index.html', 'gom-deva/index.html', 'KONKANI-FOR-READER.md', 'README.md'], dependencies: ['tokens'],
  }));
  writeFileSync(join(tpl, 'strings.js'), [
    "export const SITE = 'https://mini.example';",
    "export const REGISTER = 'quiet';",
    'export const LANGS = [',
    "  { tag: 'en', folder: '' },",
    "  { tag: 'gom-Deva', folder: 'gom-deva' },",
    '];',
    "export const WORDS = { en: 'Hello', 'gom-Deva': '[TODO gom-Deva] hello' };",
    "export const unreviewed = () => ({ 'gom-Deva': ['hello'] });",
    '',
  ].join('\n'));
  writeFileSync(join(tpl, 'pages.mjs'), [
    "import { mkdirSync, writeFileSync } from 'node:fs';",
    "import { LANGS, REGISTER, SITE } from './strings.js';",
    'for (const l of LANGS) {',
    "  if (l.folder) mkdirSync(l.folder, { recursive: true });",
    "  writeFileSync((l.folder ? l.folder + '/' : '') + 'index.html', '<html lang=\"' + l.tag + '\" data-register=\"' + REGISTER + '\" data-site=\"' + SITE + '\">');",
    '}',
    '',
  ].join('\n'));
  writeFileSync(join(tpl, 'index.html'), page ?? '<link rel="stylesheet" href="susegad/tokens/tokens.css"><a href="gom-deva/index.html">k</a>');
  writeFileSync(join(tpl, 'KONKANI-FOR-READER.md'), '# For a reader\n');
  writeFileSync(join(tpl, 'README.md'), ['# Mini', '', '| `index.html` | English. |', '| `gom-deva/index.html`, `gom-latn/index.html` | Konkani. |', '| `KONKANI-FOR-READER.md` | For a reader. |', ''].join('\n'));
  writeFileSync(join(tpl, 'gom-deva/index.html'), '<link rel="stylesheet" href="../susegad/tokens/tokens.css"><a href="../index.html">e</a>');
  const rebuild = () => {
    const { index, errors } = buildRegistry({ root: repo });
    assert.deepEqual(errors, []);
    writeFileSync(join(repo, 'registry', 'registry.json'), serialise(index));
  };
  const project = join(dir, 'project');
  const cli = async (...argv) => {
    const out = [], err = [];
    const code = await run([...argv, '--registry', repo], { cwd: project, out: s => out.push(s ?? ''), err: s => err.push(s ?? '') });
    return { code, out: out.join('\n'), err: err.join('\n') };
  };
  return { repo, project, cli, rebuild };
}

test('create starts a site: its own files at the root, the pieces under susegad/, and the lockfile agrees with diff', async t => {
  const w = workspace(t);
  w.rebuild();
  const r = await w.cli('create', '--template', 'mini', '--yes');
  assert.equal(r.code, 0, r.err);
  for (const p of ['index.html', 'gom-deva/index.html', 'strings.js', 'susegad/tokens/tokens.css', 'susegad.json']) assert.ok(existsSync(join(w.project, p)), `${p} exists`);
  assert.ok(!existsSync(join(w.project, 'susegad/templates')), 'the template is not copied as a library piece');
  assert.match(r.out, /Made 6 files of your own, and copied 2 files from 1 library piece/);
  assert.match(r.out, /What to do next[\s\S]*1\. Open it[\s\S]*2\. Change the words[\s\S]*3\. Read the docs/);
  assert.match(r.out, /1 Konkani entry in strings\.js still read \[TODO/);
  assert.match(r.out, /The Konkani is a first draft by a non-native writer\. Ask a Goan reader to check KONKANI-FOR-READER\.md before you publish\./);
  const lock = JSON.parse(readFileSync(join(w.project, 'susegad.json'), 'utf8'));
  assert.deepEqual(Object.keys(lock.items['template-mini'].files), ['gom-deva/index.html', 'index.html', 'KONKANI-FOR-READER.md', 'pages.mjs', 'README.md', 'strings.js']);
  assert.equal(lock.items['template-mini'].requested, true);
  assert.equal(lock.items.tokens.requested, false);
  assert.match(r.out, /KONKANI-FOR-READER\.md/, 'the file the next paragraph sends people to is in the list of what was made');
  const d = await w.cli('diff', '--dir', '.');
  assert.equal(d.code, 0, d.out);
  assert.match(d.out, /All 6 files match the registry/);
  // a bare diff, and a bare add, find the site's own lockfile in the folder they are run in
  const bare = await w.cli('diff');
  assert.equal(bare.code, 0, bare.out);
  assert.match(bare.out, /All 6 files match the registry/);
  const add = await w.cli('add', 'tokens', '--dry-run');
  assert.doesNotMatch(add.out, /src\/lib/);
  assert.match(add.out, /same\s+susegad\/tokens\/tokens\.css/, 'it found the tokens already in the site folder');
});

test('add refuses a template in plain words and list says how templates are started', async t => {
  const w = workspace(t);
  w.rebuild();
  const r = await w.cli('add', 'template-mini');
  assert.equal(r.code, 1);
  assert.match(r.err, /template-mini is a whole site, not a piece to copy into a project/);
  assert.match(r.err, /susegad create my-site --template mini/);
  assert.ok(!existsSync(w.project) || !readdirSync(w.project).length, 'nothing was written');
  const l = await w.cli('list');
  assert.match(l.out, /Templates\n\s+template-mini/);
  assert.match(l.out, /A template is a whole site: start it in an empty folder with susegad create/);
});

test('create refuses a folder with something in it, but not one that only holds .git', async t => {
  const w = workspace(t);
  w.rebuild();
  mkdirSync(w.project, { recursive: true });
  writeFileSync(join(w.project, 'mine.txt'), 'keep');
  const r = await w.cli('create', '--template', 'mini', '--yes');
  assert.equal(r.code, 1);
  assert.match(r.err, /already has 1 thing in it \(mine\.txt\)\. I only start a site in an empty folder, so nothing of yours can be replaced/);
  assert.deepEqual(readdirSync(w.project), ['mine.txt'], 'nothing was written');
  rmSync(join(w.project, 'mine.txt'));
  mkdirSync(join(w.project, '.git'));
  assert.equal((await w.cli('create', '--template', 'mini', '--yes')).code, 0);
});

test('create names the templates it has when asked for one it does not', async t => {
  const w = workspace(t);
  w.rebuild();
  const r = await w.cli('create', '--template', 'wedding', '--yes');
  assert.equal(r.code, 1);
  assert.match(r.err, /do not have a template called "wedding"\. The templates I have: mini\./);
  assert.ok(!existsSync(w.project));
});

test('create --register, --lang and --site write the pages again, and the lockfile keeps the registry hashes', async t => {
  const w = workspace(t);
  w.rebuild();
  const r = await w.cli('create', '--template', 'mini', '--register', 'warm', '--site', 'https://goa.example/', '--lang', 'en', '--yes');
  assert.equal(r.code, 0, r.err);
  assert.equal(readFileSync(join(w.project, 'index.html'), 'utf8'), '<html lang="en" data-register="warm" data-site="https://goa.example">');
  assert.ok(!existsSync(join(w.project, 'gom-deva')), 'the page that was not asked for is not made');
  assert.doesNotMatch(r.out, /first draft/, 'no Konkani page, so no draft to warn about');
  assert.ok(!existsSync(join(w.project, 'KONKANI-FOR-READER.md')), 'the reader note for pages that were not made is not written either');
  const readme = readFileSync(join(w.project, 'README.md'), 'utf8');
  assert.match(readme, /Made with `--lang en`: gom-Deva was not made/);
  assert.doesNotMatch(readme, /gom-deva|gom-latn|KONKANI/, 'the page table names only pages that exist, apart from the note');
  assert.match(r.out, /You asked for fewer pages, so gom-Deva was not made\. README\.md still describes all three/);
  // create's own choices are the baseline: diff shows nothing, and does not call the dropped pages new
  const d = await w.cli('diff', '--dir', '.');
  assert.equal(d.code, 0, d.out);
  assert.doesNotMatch(d.out, /gom-deva|KONKANI|added|edited/);
  // what the builder does afterwards still shows
  appendFileSync(join(w.project, 'strings.js'), '// mine\n');
  const d2 = await w.cli('diff', '--dir', '.');
  assert.equal(d2.code, 1);
  assert.match(d2.out, /edited\s+strings\.js\s+you changed this/);
  assert.doesNotMatch(d2.out, /index\.html/);
  const bad = await w.cli('create', 'other', '--template', 'mini', '--register', 'loud', '--yes');
  assert.match(bad.err, /loud is not a look I know\. The looks are quiet, warm and playful/);
  const order = await w.cli('create', 'other', '--template', 'mini', '--lang', 'gom-Deva,en', '--yes');
  assert.match(order.err, /The first page, at the front door, is en\. List it first/);
});

test('the registry build checks a template the way the project will see it, and goes red on a reference that would not be copied', t => {
  assert.deepEqual(buildRegistry({ root: workspace(t).repo }).errors, []);
  const bad = workspace(t, { page: '<script type="module" src="./susegad/tokens/missing.js"></script>' });
  const { errors } = buildRegistry({ root: bad.repo });
  assert.match(errors.join('\n'), /index\.html refers to "\.\/susegad\/tokens\/missing\.js", which/);
});

test('targetPathFor puts a template at the root and everything else under susegad/', () => {
  assert.equal(targetPathFor('packages/templates/event/gom-deva/index.html'), 'gom-deva/index.html');
  assert.equal(targetPathFor('packages/engine/src/noise.js'), 'susegad/engine/src/noise.js');
  assert.equal(templateRefTarget('packages/templates/event', 'susegad/core/lazy.js'), 'packages/core/lazy.js');
  assert.equal(templateRefTarget('packages/templates/event', 'posters/hero.jpg'), 'packages/templates/event/posters/hero.jpg');
});
