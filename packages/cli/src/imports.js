import { posix } from 'node:path';
import { stripComments } from './strip.js';

// Relative references inside a file the CLI copies: JS imports, CSS url() and @import,
// and HTML src/href. Used by the build to prove that a copied item only points at files
// that are copied with it. Only literal specifiers starting with ./ or ../ count; bare
// names, absolute paths, URLs and template-built paths (lazy skins) are left alone.

const JS = [
  /\b(?:import|export)\s[^'"`;]*?\bfrom\s*(['"])(\.{1,2}\/[^'"]+)\1/g,
  /\bimport\s*(['"])(\.{1,2}\/[^'"]+)\1/g,
  /\bimport\s*\(\s*(['"])(\.{1,2}\/[^'"]+)\1\s*\)/g,
  /\bnew\s+URL\(\s*(['"])(\.{1,2}\/[^'"]+)\1\s*,\s*import\.meta\.url/g,
];
const CSS = [
  /url\(\s*(['"]?)(\.{0,2}\/?[^'")\s:]+)\1\s*\)/g,
  /@import\s+(['"])(\.{1,2}\/[^'"]+)\1/g,
];
const HTML = [/\b(?:src|href)\s*=\s*(['"])(\.{1,2}\/[^'"#?]+)\1/g];

/**
 * Root-absolute paths ("/tools/harness/demo.js") in a copied file. They work on the repo's
 * dev server and 404 in a builder's project, so the build warns about them.
 * @returns {string[]}
 */
export function absoluteRefs(path, text) {
  const ext = posix.extname(path);
  let body;
  if (ext === '.js' || ext === '.mjs') body = quietStrings(stripComments(text));
  else if (ext === '.css') body = text.replace(/\/\*[\s\S]*?\*\//g, '');
  else if (ext === '.html') body = text.replace(/<!--[\s\S]*?-->/g, '');
  else return [];
  const found = new Set();
  const res = [
    /\b(?:src|href)\s*=\s*(['"])(\/(?!\/)[^'"]*)\1/g,
    /\bfrom\s*(['"])(\/(?!\/)[^'"]*)\1/g,
    /\bimport\s*\(?\s*(['"])(\/(?!\/)[^'"]*)\1/g,
    /url\(\s*(['"]?)(\/(?!\/)[^'")\s]*)\1\s*\)/g,
  ];
  for (const re of res) for (const m of body.matchAll(re)) found.add(m[2]);
  return [...found].sort();
}

/** Empty every quoted string that is not a module specifier, so prose like "import './x.js'" is not read as code. */
const quietStrings = js => js.replace(
  /(\bfrom\s*|\bimport\s*\(?\s*|\bURL\(\s*)?(['"])((?:\\.|(?!\2)[^\\\n])*)\2/g,
  (all, lead, q) => lead ? all : q + q);

/**
 * @param {string} path repo path of the file, e.g. packages/recipes/x/recipe.js
 * @param {string} text its content
 * @returns {Array<{ spec: string, target: string }>} targets as normalised repo paths
 */
export function relativeRefs(path, text) {
  const ext = posix.extname(path);
  let patterns, body = text;
  if (ext === '.js' || ext === '.mjs') { patterns = JS; body = quietStrings(stripComments(text)); }
  else if (ext === '.css') { patterns = CSS; body = text.replace(/\/\*[\s\S]*?\*\//g, ''); }
  else if (ext === '.html') {
    patterns = HTML;
    body = text.replace(/<!--[\s\S]*?-->/g, '');
    // module scripts inside the page are JS too
    for (const m of body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) body += '\n' + quietStrings(stripComments(m[1]));
    patterns = [...HTML, ...JS];
  } else return [];

  const dir = posix.dirname(path);
  const refs = new Map();
  for (const re of patterns) {
    for (const m of body.matchAll(re)) {
      const spec = m[2];
      if (!spec || /^(data:|[a-z]+:|\/|#)/i.test(spec)) continue;
      if (patterns === CSS && !spec.startsWith('.') && !/\.[a-z0-9]+$/i.test(spec)) continue;
      refs.set(spec, posix.normalize(posix.join(dir, spec.split(/[?#]/)[0])));
    }
  }
  return [...refs].map(([spec, target]) => ({ spec, target }));
}
