import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { npxNames, packageOf, codeText, unknownNpx } from './npx.core.js';

const known = JSON.parse(fs.readFileSync(new URL('./npx-packages.json', import.meta.url), 'utf8')).packages;

test('a version or tag is not part of the package name', () => {
  assert.equal(packageOf('@susegad/cli@1.2.3'), '@susegad/cli');
  assert.equal(packageOf('esbuild@latest'), 'esbuild');
  assert.equal(packageOf('serve'), 'serve');
});

test('the name is the first word after npx and its flags', () => {
  assert.deepEqual(npxNames('npx @susegad/cli create my-site').map(n => n.name), ['@susegad/cli']);
  assert.deepEqual(npxNames('npx -y --quiet serve .').map(n => n.name), ['serve']);
  assert.deepEqual(npxNames('npx shadcn@latest add https://x.in/r/dialog.json').map(n => n.name), ['shadcn']);
  assert.deepEqual(npxNames('run it with pnpx susegad').map(n => n.name), []);
});

test('only code is read in HTML, and entities are decoded', () => {
  const html = '<p>We say npx in prose, and npx wonders.</p><pre><code>npx @susegad/cli add dialog &amp;&amp; npx serve</code></pre>';
  assert.deepEqual(npxNames(codeText(html)).map(n => n.name), ['@susegad/cli', 'serve']);
});

test('the bare command name is red: susegad is a bin, not a package', () => {
  const bad = unknownNpx([{ file: 'start.html', html: true, text: '<code>npx susegad create my-site</code>' }], known);
  assert.equal(bad.length, 1);
  assert.equal(bad[0].name, 'susegad');
});

test('the names the site uses today are all pinned, so the control can pass too', () => {
  const good = unknownNpx([{ file: 'x.html', html: true, text: '<code>npx @susegad/cli create my-site</code> <code>npx @susegad/mcp</code> <code>npx esbuild a.js</code>' }], known);
  assert.deepEqual(good, []);
});

test('the pinned list holds the names of the packages this repo publishes', () => {
  for (const dir of ['cli', 'mcp']) {
    const pkg = JSON.parse(fs.readFileSync(new URL(`../../packages/${dir}/package.json`, import.meta.url), 'utf8'));
    assert.ok(known.includes(pkg.name), `${pkg.name} is missing from apps/docs/npx-packages.json`);
  }
});

test('two code spans side by side are not one command', () => {
  assert.deepEqual(npxNames(codeText('<p>run <code>npx</code> <code>create</code></p>')), []);
});

test('an add command names items the registry has: sg-badge is red, badge is green', async () => {
  const { addNames, unknownAddItems } = await import('./npx.core.js');
  const registry = ['scene-paus', 'badge', 'dialog'];
  assert.deepEqual(addNames('npx @susegad/cli add scene-paus badge --dir src/lib').map(n => n.name), ['scene-paus', 'badge']);
  const bad = unknownAddItems([{ file: 'start.html', html: true, text: '<pre><code>npx @susegad/cli add scene-paus sg-badge --dir src/lib</code></pre>' }], registry);
  assert.deepEqual(bad.map(b => b.name), ['sg-badge']);
  assert.deepEqual(unknownAddItems([{ file: 'x', html: true, text: '<code>npx @susegad/cli add scene-paus badge</code> <code>npx @susegad/cli add dialog</code>' }], registry), []);
  assert.deepEqual(addNames('npx @susegad/cli list'), []);
});
