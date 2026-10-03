// npmdeps.js: the npm packages an added item needs (decision 0017: three for
// stage3d, mediabunny for video export), merged into the consumer's
// package.json. Pure. The CLI copies our code, but a dependency like three is
// theirs to install: we write the pin and tell them to run their install; we
// never run it, and never overwrite a version they chose.

import { CliError } from './registry.js';

const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

/**
 * Every pin the items carry, with the items that asked for it.
 * @param {{ name: string, npmDependencies?: Record<string, string> }[]} items
 * @returns {Record<string, { version: string, by: string[] }>} sorted by package name
 */
export function collectNpmDeps(items) {
  const wanted = {};
  for (const item of items) {
    for (const [name, version] of Object.entries(item.npmDependencies ?? {})) {
      const w = wanted[name];
      if (!w) wanted[name] = { version, by: [item.name] };
      else if (w.version === version) w.by.push(item.name);
      else throw new CliError(`The registry is inconsistent: ${name} is pinned at ${w.version} by ${w.by.join(', ')} and ${version} by ${item.name}. Rebuild it with node registry/build.mjs, which checks every pin against the library's own.`);
    }
  }
  return Object.fromEntries(Object.entries(wanted).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Merge `wanted` into a package.json object. A package missing from every
 * dependency field is added to `dependencies`; one already there at the same
 * version is left alone; one at a different version is kept as theirs and
 * reported. Returns a new object; the input is not changed.
 */
export function mergeNpmDeps(pkg, wanted) {
  const next = structuredClone(pkg);
  const added = [], same = [], kept = [];
  for (const [name, { version, by }] of Object.entries(wanted).sort(([a], [b]) => a.localeCompare(b))) {
    const field = FIELDS.find(f => pkg[f] && name in pkg[f]);
    if (!field) { (next.dependencies ??= {})[name] = version; added.push({ name, version, by }); }
    else if (pkg[field][name] === version) same.push({ name, version, field });
    else kept.push({ name, theirs: pkg[field][name], field, ours: version, by });
  }
  if (added.length) next.dependencies = Object.fromEntries(Object.entries(next.dependencies).sort(([a], [b]) => a.localeCompare(b)));
  return { pkg: next, added, same, kept, changed: added.length > 0 };
}

/** Serialise `obj` the way `original` was written: its indent and its line endings. */
export function writePackageJson(original, obj) {
  const indent = /^\{\r?\n([ \t]+)"/.exec(original)?.[1] ?? '  ';
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  return JSON.stringify(obj, null, indent).replace(/\n/g, eol) + eol;
}
