// The oracle boundary (decision 0029) as an invariant, like the budget checks.
// Guarded files may use the geometry (layout.core.js) but must never REACH the
// oracle (measure.js) or Pretext, by any chain of relative imports, static or
// dynamic: a core that imports type/index.js reaches measure.js through it, and
// is as guilty as one that imports it directly. layout.core.js imports nothing,
// and measure.js is the one file outside vendor/ that imports Pretext.
//
// The image tier is the second oracle (decision 0030): image/measure.js is the one file that goes to the network or
// the decoder for a picture's size. Guarded files must never reach it either, by the same rules; image/layout.core.js
// and image/header.core.js are the pure halves they may import.
//
// Who is guarded, and why. 0029 lets only "the live render surface of a scene
// and measure.js itself" touch the oracle, so the rule is by role, not by folder:
//   - packages/core, engine, components, tokens: shared and pure by charter.
//   - any *.core.js anywhere (pure cores) and any model.js (a scene's or
//     surface's pure model, charter: model pure, renderer side-effecting).
// Not guarded by directory: scenes/ and surfaces/ (render.js, words.js and the
// element are the live surface, where the lazy type tier is loaded; surfaces/carepa
// draws a window and sets no words, but a future surface may), stage3d/ (stage3d.js
// is a live renderer; its stage3d.core.js is guarded as a core), and tools/apps.
// If a package becomes pure by rule, add it to GUARDED_DIRS.
//
// The one way a guarded file may use the oracle (0029, clarified by the Sutradhar's ruling of
// 9 October 2026, rung 3): a dynamic import() of a declared live surface, a file named
// *.live.js. A *.live.js file may import the type door (operators.js, index.js) statically;
// nothing may import a *.live.js file statically; a dynamic edge into one ends the walk as
// allowed, and *.live.js files are not themselves guarded. Every other path is as before.
//
// A guarded file whose dynamic import() has a specifier that is not a plain
// string literal fails with "can't verify": the guard cannot follow it. The two
// loaders that must do this today are allowlisted below, each with its reason.
// A scoped walk of packages/ (never node_modules or .worktrees).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURE = join(PACKAGES, 'type', 'measure.js');
const PRETEXT = join(PACKAGES, 'type', 'vendor', 'pretext.js');
const IMAGE_MEASURE = join(PACKAGES, 'image', 'measure.js');
/** Every file a guarded file must never reach: the text oracle, Pretext, and the image oracle. */
const ORACLES = [MEASURE, PRETEXT, IMAGE_MEASURE];
const VENDOR_DIR = join(PACKAGES, 'type', 'vendor') + sep;
const GUARDED_DIRS = /^(core|engine|components|tokens|stage3d)\//;
/**
 * Guarded dynamic import()s whose specifier is not a literal, and why that is allowed.
 * Each entry names the file and the exact source line, so if the line changes the
 * guard fails again and someone re-reads what it now loads.
 */
const NON_LITERAL_OK = [
  {
    rel: 'components/empty/skins/warm.js',
    line: 'await import(`../../../scenes/${name}/index.js`);',
    why: 'a runtime scene loader: it imports the scene the page names, and scenes are the live surface decision 0029 lets touch the oracle',
  },
  {
    rel: 'core/lazy.js',
    line: "await Promise.all([import('./index.js'), ...parseSrc(this.getAttribute('src'), document.baseURI).map(u => import(u))]);",
    why: "an author-supplied URL loader: it imports the scene module URLs written in the element's src attribute",
  },
];
const allowed = (relPath, line) => NON_LITERAL_OK.some(a => a.rel === relPath && a.line === line);

/** A declared live surface: the one kind of file a guarded file may reach the oracle through, and only by a dynamic import(). */
/** A pure core can never be a live surface: foo.core.live.js and model.live.js are refused (they stay guarded, and no dynamic edge into them is allowed). */
const PURE_CORE = rel => /\.core\.js$|\.core\.live\.js$|(^|\/)model(\.live)?\.js$/.test(rel);
const LIVE_SURFACE = { test: rel => /\.live\.js$/.test(rel) && !PURE_CORE(rel) };

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.m?js$/.test(e.name)) yield p;
  }
}

const strip = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Every module specifier a source imports: static, `export … from`, side-effect and dynamic. */
export function specifiers(source) {
  const out = [];
  const re = /(?:\bimport\s*(?:[\w*${},\s]+?\s*from\s*)?|\bexport\s+(?:\*|\{[^}]*\})(?:\s+as\s+\w+)?\s*from\s*|\bimport\s*\(\s*)(['"`])([^'"`]+)\1/g;
  for (let m; (m = re.exec(strip(source)));) if (!m[2].includes('${')) out.push(m[2]);
  return out;
}

/** The relative literal imports of a source as edges: { to, dynamic }. */
export function edgesOf(source) {
  const code = strip(source), out = [];
  const dyn = /\bimport\s*\(\s*(['"`])([^'"`$]+)\1/g, all = specifiers(source);
  const dynamic = []; for (let m; (m = dyn.exec(code));) dynamic.push(m[2]);
  for (const sp of all) { const i = dynamic.indexOf(sp); if (i >= 0) { dynamic.splice(i, 1); out.push({ to: sp, dynamic: true }); } else out.push({ to: sp, dynamic: false }); }
  return out.filter(e => e.to.startsWith('.'));
}

/** The edges the walk follows: a dynamic import() of a *.live.js ends the chain as allowed; every other edge is followed. */
export const followed = edges => edges.filter(e => !(e.dynamic && LIVE_SURFACE.test(e.to)));

/** Dynamic import()s the guard cannot follow (a specifier that is not a plain string literal), as the source line each sits on. */
export function nonLiteralImports(source) {
  const code = strip(source), out = [];
  const re = /\bimport\s*\(\s*(?!(['"])[^'"`$]*\1\s*\)|`[^`$]*`\s*\))/g;
  for (let m; (m = re.exec(code));) {
    const start = code.lastIndexOf('\n', m.index) + 1, end = code.indexOf('\n', m.index);
    out.push(code.slice(start, end < 0 ? undefined : end).trim());
  }
  return out;
}

const files = [...walk(PACKAGES)].map(path => ({ path, rel: relative(PACKAGES, path).split(sep).join('/') }));
const byPath = new Map(files.map(f => [f.path, f]));
const rel = p => relative(PACKAGES, p).split(sep).join('/');
const isTest = f => /\.(test\.js|check\.mjs|test\.mjs)$/.test(f.rel);
const isGuarded = f => !isTest(f) && !LIVE_SURFACE.test(f.rel) && !f.path.startsWith(VENDOR_DIR) && (GUARDED_DIRS.test(f.rel) || PURE_CORE(f.rel));

const edges = new Map();
/** The files a file imports by a relative path that exists, less the allowed dynamic edges into a *.live.js. */
function importsOf(path) {
  if (!edges.has(path)) {
    const out = [];
    for (const e of followed(edgesOf(readFileSync(path, 'utf8')))) {
      const to = resolve(dirname(path), e.to);
      if (byPath.has(to)) out.push(to);
    }
    edges.set(path, out);
  }
  return edges.get(path);
}

/** The shortest chain from `from` to a target through `next(at)`, or null. The walk itself, apart from the file system. */
export function chainThrough(from, targets, next, name = x => x) {
  const prev = new Map([[from, null]]);
  for (const q = [from]; q.length;) {
    const at = q.shift();
    if (targets.includes(at) && at !== from) {
      const chain = [];
      for (let p = at; p; p = prev.get(p)) chain.unshift(name(p));
      return chain;
    }
    for (const to of next(at)) if (!prev.has(to)) { prev.set(to, at); q.push(to); }
  }
  return null;
}

/** The shortest chain of imports from `from` to an oracle (the type tier's, Pretext or the image tier's), or null. */
export const chainToOracle = (from, targets = ORACLES) => chainThrough(from, targets, importsOf, rel);

test('the walk sees the packages it guards', () => {
  assert.ok(files.some(f => f.rel === 'type/layout.core.js'));
  assert.ok(files.filter(isGuarded).length > 50, `${files.filter(isGuarded).length} guarded files in the walk`);
  assert.ok(files.some(f => isGuarded(f) && f.rel.startsWith('components/')));
  assert.ok(!files.some(f => f.rel.includes('node_modules')));
});

test('no guarded file reaches the oracle or Pretext, by any chain of imports', () => {
  const bad = [];
  for (const f of files.filter(isGuarded)) {
    const chain = chainToOracle(f.path);
    if (chain) bad.push(chain.join(' → '));
  }
  assert.deepEqual(bad, [], `guarded files must import layout.core.js, never the oracle, directly or through another module. To measure text, do it in a *.live.js file that the guarded file loads with a dynamic import() (decision 0029):\n  ${bad.join('\n  ')}`);
});
test('a guarded dynamic import() with a non-literal specifier can\'t be verified', () => {
  const bad = [];
  for (const f of files.filter(isGuarded)) {
    for (const line of nonLiteralImports(readFileSync(f.path, 'utf8'))) {
      if (!allowed(f.rel, line)) bad.push(`${f.rel}: ${line}\n    can't verify what this loads: use a literal, or allowlist this exact line with a reason`);
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
  for (const a of NON_LITERAL_OK) {
    const f = files.find(x => x.rel === a.rel);
    assert.ok(f && nonLiteralImports(readFileSync(f.path, 'utf8')).includes(a.line), `${a.rel}: the allowlisted line is gone or changed; re-read it and update the entry`);
  }
});

test('the allowlist is exact: a third non-literal import, or a changed allowed line, fails', () => {
  const a = NON_LITERAL_OK[0];
  assert.ok(allowed(a.rel, a.line));
  assert.equal(allowed(a.rel, a.line.replace('scenes', 'engine')), false, 'a changed line is no longer allowed');
  assert.equal(allowed('components/accordion/accordion.core.js', a.line), false, 'the same line in another file is not allowed');
  const third = nonLiteralImports('const x = await import(`./skins/${n}.js`);');
  assert.equal(third.length, 1);
  assert.equal(allowed('components/accordion/accordion.core.js', third[0]), false, 'a new one fails');
});

test('layout.core.js imports nothing', () => {
  const src = readFileSync(join(PACKAGES, 'type', 'layout.core.js'), 'utf8');
  assert.deepEqual(specifiers(src), []);
  assert.deepEqual(nonLiteralImports(src), []);
});

test('measure.js is the only file outside vendor/ that imports Pretext', () => {
  const importers = files
    .filter(f => !f.path.startsWith(VENDOR_DIR) && importsOf(f.path).includes(PRETEXT))
    .map(f => f.rel);
  assert.deepEqual(importers, ['type/measure.js']);
});

test('the scanners can see each kind of import (a guard that can fail)', () => {
  const src = `
    import a from './a.js'; import { b } from "./b.js"; import './c.js';
    export * from './d.js'; export { e } from './e.js';
    const f = await import('./f.js');
    const g = await import(\`./g/\${x}.js\`);
    const h = await import(url);
    const i = await import(new URL('./i.js', base));
    const j = await import(\`./j.js\`);
    // import x from './comment.js'
  `;
  assert.deepEqual(specifiers(src), ['./a.js', './b.js', './c.js', './d.js', './e.js', './f.js', './j.js']);
  assert.equal(nonLiteralImports(src).length, 3);
});

test('the chain finder sees through index.js and reports the whole path', () => {
  const chain = chainToOracle(join(PACKAGES, 'type', 'index.js'));
  assert.deepEqual(chain, ['type/index.js', 'type/measure.js']);
  assert.ok(existsSync(MEASURE) && statSync(MEASURE).isFile());
});

test('layout.operators.js is pure: it imports at most layout.core.js, and touches no DOM, canvas or Pretext', () => {
  const src = readFileSync(join(PACKAGES, 'type', 'layout.operators.js'), 'utf8');
  assert.deepEqual(specifiers(src).filter(s => s !== './layout.core.js'), []);
  assert.deepEqual(forbiddenGlobals(src), []);
});

/** DOM and canvas globals a pure file must not touch (comments stripped, as for imports). */
export function forbiddenGlobals(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return [...code.matchAll(/\b(document|window|OffscreenCanvas|HTMLCanvasElement|getContext|requestAnimationFrame|navigator)\b/g)].map(m => m[1]);
}

test('the global scanner can see a DOM touch (a guard that can fail)', () => {
  assert.deepEqual(forbiddenGlobals('const c = new OffscreenCanvas(1, 1).getContext("2d"); document.fonts'), ['OffscreenCanvas', 'getContext', 'document']);
  assert.deepEqual(forbiddenGlobals('// document is not touched\nconst x = 1'), []);
});

test('the live door operators.js reaches measure.js, so no core imports it, and index.js stays lean', () => {
  const LIVE = [join(PACKAGES, 'type', 'operators.js'), join(PACKAGES, 'type', 'index.js')];
  const bad = [];
  for (const f of files.filter(isGuarded)) {
    for (const target of importsOf(f.path)) if (LIVE.includes(target)) bad.push(`${f.rel} imports ${relative(PACKAGES, target).split(sep).join('/')}`);
  }
  assert.deepEqual(bad, [], `cores import layout.core.js or layout.operators.js, never the live door (operators.js, index.js). Take the layout as an argument instead, as components/bubble/bubble.core.js does:\n  ${bad.join('\n  ')}`);
  const index = readFileSync(join(PACKAGES, 'type', 'index.js'), 'utf8');
  assert.ok(!specifiers(index).some(s => /operators/.test(s)), 'index.js must not import the operators, which would load them in every scene; load them with import("../../type/operators.js") where a scene needs them');
});

test('nothing imports a *.live.js statically, and every one is reached only by a dynamic import()', () => {
  const bad = [];
  for (const f of files.filter(x => !isTest(x))) {
    for (const e of edgesOf(readFileSync(f.path, 'utf8'))) {
      if (!e.dynamic && LIVE_SURFACE.test(e.to)) bad.push(`${f.rel} imports ${e.to} statically: change it to a dynamic import(), because a live surface loads by import() only`);
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
  assert.ok(files.some(f => LIVE_SURFACE.test(f.rel)), 'the walk sees a live surface (components/bubble/skins/bubble.live.js)');
});

test('the walk bites: a dynamic import of a live surface is allowed; a static one, or a dynamic one of anything else, fails', () => {
  const G = {
    'comp.js': [{ to: 'x.live.js', dynamic: true }],
    'x.live.js': [{ to: 'operators.js', dynamic: false }], 'operators.js': [{ to: 'measure.js', dynamic: false }], 'measure.js': [],
    'static.js': [{ to: 'x.live.js', dynamic: false }],
    'lazy.js': [{ to: 'y.js', dynamic: true }], 'y.js': [{ to: 'operators.js', dynamic: false }],
  };
  const next = n => followed(G[n] ?? []).map(e => e.to);
  assert.equal(chainThrough('comp.js', ['measure.js'], next), null, 'dynamic into x.live.js: allowed');
  assert.deepEqual(chainThrough('static.js', ['measure.js'], next), ['static.js', 'x.live.js', 'operators.js', 'measure.js'], 'static into x.live.js: fails with its chain');
  assert.deepEqual(chainThrough('lazy.js', ['measure.js'], next), ['lazy.js', 'y.js', 'operators.js', 'measure.js'], 'dynamic into a file that is not .live.js: still fails');
  assert.equal(followed([{ to: './a.live.js', dynamic: true }]).length, 0);
  assert.equal(followed([{ to: './a.live.js', dynamic: false }]).length, 1);
  assert.deepEqual(edgesOf("import a from './a.js'; const b = await import('./b.live.js'); export * from './c.js'; import('pkg');").map(e => [e.to, e.dynamic]), [['./a.js', false], ['./b.live.js', true], ['./c.js', false]]);
  // a *.live.js is the live surface itself, so it is not a guarded file, wherever it stands
  for (const rel of ['components/bubble/skins/bubble.live.js', 'scenes/x/render.live.js', 'stage3d/text.live.js']) assert.equal(isGuarded({ rel, path: join(PACKAGES, rel) }), false, rel);
  // a pure core can never be a live surface: foo.core.live.js and model.live.js stay guarded, and a dynamic edge into one is followed
  for (const rel of ['components/bubble/foo.core.live.js', 'scenes/x/model.live.js']) {
    assert.equal(LIVE_SURFACE.test(rel), false, `${rel} is refused as a live surface`);
    assert.equal(isGuarded({ rel, path: join(PACKAGES, rel) }), true, `${rel} stays guarded`);
    assert.equal(followed([{ to: rel, dynamic: true }]).length, 1, `a dynamic import of ${rel} is followed`);
  }
  // the real edge: bubble's skin loads its live surface dynamically, and the walk from the skin ends there
  const skin = join(PACKAGES, 'components/bubble/skins/body.js');
  assert.ok(edgesOf(readFileSync(skin, 'utf8')).some(e => e.dynamic && e.to === './bubble.live.js'), 'body.js imports bubble.live.js dynamically');
  assert.equal(chainToOracle(skin), null, 'and the oracle is not reached through it');
  assert.ok(chainToOracle(join(PACKAGES, 'components/bubble/skins/bubble.live.js')), 'while the live surface itself does reach it');
  assert.equal(isGuarded({ rel: 'components/bubble/skins/body.js', path: join(PACKAGES, 'components/bubble/skins/body.js') }), true);
});

// ── The image oracle (decision 0030) ───────────────────────────────────────

test("the image tier's pure halves import nothing, and only the live surface reaches its oracle", () => {
  for (const f of ['layout.core.js', 'header.core.js']) {
    const src = readFileSync(join(PACKAGES, 'image', f), 'utf8');
    assert.deepEqual(specifiers(src), [], `image/${f} imports nothing`);
    assert.deepEqual(nonLiteralImports(src), []);
    assert.deepEqual(forbiddenGlobals(src), [], `image/${f} touches no DOM`);
    assert.equal(isGuarded({ rel: `image/${f}`, path: join(PACKAGES, 'image', f) }), true, `image/${f} is a pure core: guarded by role`);
    assert.equal(chainToOracle(join(PACKAGES, 'image', f)), null, `image/${f} reaches no oracle`);
  }
  const measure = readFileSync(IMAGE_MEASURE, 'utf8');
  assert.deepEqual(specifiers(measure), ['./header.core.js'], 'the oracle imports only the pure header parser');
  assert.ok(chainToOracle(join(PACKAGES, 'image', 'flow.live.js')), 'the live surface does reach the oracle');
});

/** A graph walk over planted sources (a path relative to packages/ to its text) falling back to the real files, so a fault can be planted without touching the tree. */
function plantedChain(planted, from, targets = ORACLES.map(rel)) {
  const srcOf = n => planted[n] ?? (existsSync(join(PACKAGES, n)) ? readFileSync(join(PACKAGES, n), 'utf8') : '');
  const next = n => followed(edgesOf(srcOf(n))).map(e => rel(resolve(PACKAGES, dirname(n), e.to)));
  return chainThrough(from, targets, next);
}

test('the guard bites on a planted import of the image oracle, direct or through another module, and lets the allowed paths through', () => {
  const P = {
    'components/x/x.core.js': "import { imageOracle } from '../../image/measure.js';",
    'components/y/y.core.js': "import { go } from './helper.js';",
    'components/y/helper.js': "import '../../image/flow.live.js';",
    'components/z/z.core.js': "const m = await import('../../image/flow.live.js');",
    'components/w/w.core.js': "import { fitRect, flowColumn } from '../../image/layout.core.js'; import { readHeader } from '../../image/header.core.js';",
    'components/v/v.core.js': "const m = await import('../../image/measure.js');",
    'components/u/u.core.js': "import { dims } from '../../image/measure.js'; // a comment about image/measure.js",
  };
  assert.deepEqual(plantedChain(P, 'components/x/x.core.js'), ['components/x/x.core.js', 'image/measure.js'], 'direct: fails with its chain');
  assert.deepEqual(plantedChain(P, 'components/y/y.core.js'), ['components/y/y.core.js', 'components/y/helper.js', 'image/flow.live.js', 'image/measure.js'], 'through a static import of the live surface: fails with its chain');
  assert.equal(plantedChain(P, 'components/z/z.core.js'), null, 'a dynamic import of the live surface is the allowed way');
  assert.equal(plantedChain(P, 'components/w/w.core.js'), null, 'the pure halves are free to import');
  assert.deepEqual(plantedChain(P, 'components/v/v.core.js'), ['components/v/v.core.js', 'image/measure.js'], 'a dynamic import of the oracle itself is still a fault');
  assert.ok(plantedChain(P, 'components/u/u.core.js'), 'a comment does not hide an import');
  // and the real chain finder, given the planted file in the real graph, would say the same: the image oracle is a target
  assert.ok(ORACLES.includes(IMAGE_MEASURE) && chainToOracle(IMAGE_MEASURE, [IMAGE_MEASURE]) === null, "the finder's targets include the image oracle (a file is not its own chain)");
  assert.deepEqual(chainToOracle(join(PACKAGES, 'image', 'flow.live.js'), [IMAGE_MEASURE]), ['image/flow.live.js', 'image/measure.js']);
});
