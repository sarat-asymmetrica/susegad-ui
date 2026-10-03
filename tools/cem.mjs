#!/usr/bin/env node
// Generates custom-elements.json (the Custom Elements Manifest, schemaVersion
// 1.0.0: https://github.com/webcomponents/custom-elements-manifest) from
// registry/registry.json and the elements' own source: observed attributes,
// events they emit, slots, CSS parts and each element's own CSS custom
// properties. A small generator over a dependency, because the shapes we
// need (defineComponent(tag, Class), static observedAttributes, this.emit(),
// a handful of shadow-DOM elements) are a handful of regular expressions on
// code we already write in one style, not a general-purpose analyzer.
//
//   node tools/cem.mjs             write custom-elements.json
//   node tools/cem.mjs --check     fail if it is out of date
//
// Every sg-* custom element is found two ways: a component registry item's
// own <name>.js calls defineComponent('sg-<name>', ClassName), and core's
// index.js does the same for sg-scene (the one shadow-DOM element, so it
// alone gets slots and cssParts). Both are read directly, not assumed from
// the registry item's name, so a renamed tag is still caught correctly.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'custom-elements.json');

const DEFINE_COMPONENT = /defineComponent\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g;
const CUSTOM_ELEMENTS_DEFINE = /customElements\.define\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g;
const OBSERVED = /static\s+observedAttributes\s*=\s*\[([^\]]*)\]/;
const QUOTED = /['"]([^'"]+)['"]/g;
const EMIT = /\bthis\.emit\(\s*['"]([^'"]+)['"]/g;
const DISPATCH = /dispatchEvent\(\s*new\s+CustomEvent\(\s*['"]([^'"]+)['"]/g;
const SLOT = /<slot(?:\s+name=["']([^"']*)["'])?[^>]*>/g;
const PART_ATTR = /\bpart=["']([^"']+)["']/g;

const read = p => (existsSync(p) ? readFileSync(p, 'utf8') : '');

/** @returns {string[]} */
function attributesOf(src) {
  const m = src.match(OBSERVED);
  if (!m) return [];
  return [...m[1].matchAll(QUOTED)].map(x => x[1]);
}

/** @returns {string[]} */
function eventsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(EMIT)) names.add(m[1]);
  for (const m of src.matchAll(DISPATCH)) names.add(m[1]);
  return [...names];
}

/** Only shadow-DOM elements (attachShadow) can have real slots or CSS parts. */
function shadowPieces(src) {
  if (!/\.attachShadow\(/.test(src)) return { slots: [], cssParts: [] };
  const slots = new Set();
  for (const m of src.matchAll(SLOT)) slots.add(m[1] ?? '');
  const parts = new Set();
  for (const m of src.matchAll(PART_ATTR)) for (const p of m[1].split(/\s+/)) if (p) parts.add(p);
  return { slots: [...slots], cssParts: [...parts] };
}

/** This element's own styling hooks: --sg-<tag-without-sg->-* custom properties in its own CSS. */
function cssCustomPropertiesOf(cssSrc, tagName) {
  const stem = tagName.replace(/^sg-/, '');
  const re = new RegExp(`--sg-${stem}-[a-z0-9-]+`, 'g');
  return [...new Set(cssSrc.match(re) ?? [])].sort();
}

function declarationFor({ tagName, className, files, root, ownCss }) {
  const sources = files.map(f => read(join(root, f))).join('\n');
  const { slots, cssParts } = shadowPieces(sources);
  const decl = {
    kind: 'class',
    name: className,
    tagName,
    customElement: true,
    attributes: attributesOf(sources).map(name => ({ name })),
    events: eventsOf(sources).map(name => ({ name, type: { text: 'CustomEvent' } })),
  };
  if (slots.length) decl.slots = slots.map(name => (name ? { name } : { name: '', summary: 'the default slot' }));
  if (cssParts.length) decl.cssParts = cssParts.map(name => ({ name }));
  const props = cssCustomPropertiesOf(ownCss, tagName);
  if (props.length) decl.cssProperties = props.map(name => ({ name }));
  return decl;
}

export function buildManifest({ root = ROOT } = {}) {
  const index = JSON.parse(readFileSync(join(root, 'registry', 'registry.json'), 'utf8'));
  const modules = [];

  // sg-scene: the one shadow-DOM element, registered in core/index.js from core/scene-element.js.
  const coreIndexSrc = read(join(root, 'packages/core/index.js'));
  for (const m of coreIndexSrc.matchAll(CUSTOM_ELEMENTS_DEFINE)) {
    const [, tagName, className] = m;
    const elFile = 'packages/core/scene-element.js';
    if (!existsSync(join(root, elFile))) continue;
    modules.push({
      kind: 'javascript-module',
      path: elFile,
      declarations: [declarationFor({ tagName, className, files: [elFile], root, ownCss: '' })],
      exports: [{ kind: 'custom-element-definition', name: tagName, declaration: { name: className, module: elFile } }],
    });
  }

  // Every component registry item: its own <dir>/<item-name-stem>.js (or whichever file calls
  // defineComponent), plus its skins (events can be emitted from a skin) and its own CSS.
  for (const item of index.items) {
    if (item.type !== 'component') continue;
    const dir = item.manifest.slice(0, item.manifest.lastIndexOf('/'));
    const jsFiles = item.files.map(f => f.path).filter(p => p.startsWith(`${dir}/`) && /\.js$/.test(p) && !/\.(test|core)\.js$/.test(p));
    let found = null;
    for (const f of jsFiles) {
      const src = read(join(root, f));
      const m = [...src.matchAll(DEFINE_COMPONENT)][0];
      if (m) { found = { tagName: m[1], className: m[2], entry: f }; break; }
    }
    if (!found) continue; // a component with no defineComponent call yet (in progress) is skipped, not guessed
    const cssFile = item.files.map(f => f.path).find(p => p === `${dir}/${item.name}.css`);
    modules.push({
      kind: 'javascript-module',
      path: found.entry,
      declarations: [declarationFor({
        tagName: found.tagName, className: found.className, files: jsFiles, root,
        ownCss: cssFile ? read(join(root, cssFile)) : '',
      })],
      exports: [{ kind: 'custom-element-definition', name: found.tagName, declaration: { name: found.className, module: found.entry } }],
    });
  }

  modules.sort((a, b) => a.path.localeCompare(b.path));
  return { schemaVersion: '1.0.0', readme: '', modules };
}

export const serialise = manifest => JSON.stringify(manifest, null, 2) + '\n';

function main(argv) {
  const manifest = buildManifest({ root: ROOT });
  const text = serialise(manifest);
  const elementCount = manifest.modules.reduce((n, m) => n + m.declarations.length, 0);
  if (argv.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : null;
    if (current !== text) {
      console.error('custom-elements.json is out of date. Run node tools/cem.mjs to refresh it.');
      return 1;
    }
    console.log(`custom-elements.json is up to date with ${elementCount} element${elementCount === 1 ? '' : 's'}.`);
    return 0;
  }
  writeFileSync(OUT, text);
  console.log(`Wrote custom-elements.json: ${elementCount} element${elementCount === 1 ? '' : 's'} across ${manifest.modules.length} module${manifest.modules.length === 1 ? '' : 's'}.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
