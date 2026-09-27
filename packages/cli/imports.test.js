import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absoluteRefs, relativeRefs } from './src/imports.js';

const targets = (path, text) => relativeRefs(path, text).map(r => r.target).sort();

test('JS: static, bare side-effect, re-export, dynamic and new URL imports', () => {
  const src = [
    "import { a } from './a.js';",
    "import '../../engine/index.js';",
    "export { b } from './b.js';",
    "export * from './c.js';",
    "const d = await import('./d.js');",
    "const font = new URL('./font.woff2', import.meta.url);",
    "import x from 'playwright';",
    "const skin = await import(`./skins/${register}.js`);",
    "// import { gone } from './commented.js';",
    "const s = \"import './in-a-string.js'\";",
  ].join('\n');
  assert.deepEqual(targets('packages/recipes/r/recipe.js', src), [
    'packages/engine/index.js', 'packages/recipes/r/a.js', 'packages/recipes/r/b.js',
    'packages/recipes/r/c.js', 'packages/recipes/r/d.js', 'packages/recipes/r/font.woff2',
  ]);
});

test('CSS: url() and @import, relative with or without ./; data and absolute URLs skipped', () => {
  const css = [
    "@import '../../tokens/tokens.css';",
    "@font-face { src: url('fonts/mukta/m.woff2') format('woff2'); }",
    '.a { background: url(./paper.png); }',
    ".b { background: url('data:image/png;base64,xx'); }",
    '.c { background: url(https://example.com/x.png); }',
    '/* .d { background: url(./gone.png); } */',
  ].join('\n');
  assert.deepEqual(targets('packages/recipes/r/recipe.css', css), [
    'packages/recipes/r/fonts/mukta/m.woff2', 'packages/recipes/r/paper.png', 'packages/tokens/tokens.css',
  ]);
});

test('HTML: src and href, plus the imports inside module scripts', () => {
  const html = [
    '<script src="/tools/harness/demo.js"></script>',
    '<link rel="stylesheet" href="./recipe.css">',
    '<a href="#top">top</a>',
    '<!-- <img src="./gone.png"> -->',
    "<script type=\"module\">import { mount } from './recipe.js';</script>",
  ].join('\n');
  assert.deepEqual(targets('packages/recipes/r/index.html', html), ['packages/recipes/r/recipe.css', 'packages/recipes/r/recipe.js']);
});

test('other files have no references', () => {
  assert.deepEqual(relativeRefs('packages/x/README.md', "import './a.js'"), []);
});

test('root-absolute paths are found so the build can warn about them', () => {
  const html = '<script src="/tools/harness/demo.js"></script>\n<link href="//cdn.example/x.css">\n<script type="module">import "/packages/core/index.js";</script>';
  assert.deepEqual(absoluteRefs('packages/recipes/r/index.html', html), ['/packages/core/index.js', '/tools/harness/demo.js']);
  assert.deepEqual(absoluteRefs('packages/r/x.js', "import a from '/abs/a.js';\nconst s = 'from \"/in/prose.js\"';"), ['/abs/a.js']);
  assert.deepEqual(absoluteRefs('packages/r/x.css', '.a { background: url(/paper.png); }'), ['/paper.png']);
});
