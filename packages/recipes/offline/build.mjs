// Makes the worker file. Plain Node, no dependencies; the event template's pages.mjs calls it, and a site
// can call it from its own build:
//
//   import { swSource, writeSw } from './susegad/recipes/offline/build.mjs';
//   writeSw('sw.js', { version: '1', scope: '/', offlinePages: { '': 'offline.html', 'gom-deva': 'gom-deva/offline.html' } });
//
// The file is offline.core.js (its `export`s taken off, so it is a classic script) + the site's settings +
// the handlers in sw.template.js. Make it again when the settings change, and change `version` when the
// files it keeps change, so visitors' old copies are thrown away.

import { readFileSync, writeFileSync } from 'node:fs';

const here = name => new URL(name, import.meta.url);

/**
 * The text of the worker.
 * @param {{ version?: string, scope?: string, offlinePages: Record<string,string>, precache?: string[], max?: number }} config
 *   scope: the folder the worker covers, ending in "/"; offlinePages: folder name to offline page, "" for the default;
 *   precache: paths (from the scope) to keep at install, besides the offline pages; max: files kept from a page's list.
 */
export function swSource({ version = '1', scope = '/', offlinePages, precache = [], max = 120 }) {
  if (!offlinePages || typeof offlinePages[''] !== 'string') throw new TypeError('swSource: offlinePages needs a default page under the empty key, for example { "": "offline.html" }');
  if (!scope.startsWith('/') || !scope.endsWith('/')) throw new TypeError('swSource: scope starts and ends with a slash, for example "/"');
  const core = readFileSync(here('./offline.core.js'), 'utf8').replace(/^export /gm, '');
  const template = readFileSync(here('./sw.template.js'), 'utf8');
  const config = JSON.stringify({ version: String(version), scope, offlinePages, precache, max }, null, 2);
  return `// sw.js: made by susegad/recipes/offline/build.mjs. Change the settings in your build, not here.\n// What it keeps, and what it never will: docs/decisions/0028-offline-cache.md in the Susegad UI repo.\n\n${core}\nconst CONFIG = ${config};\n\n${template}`;
}

/** Write the worker to a file. @param {string} file @param {Parameters<typeof swSource>[0]} config */
export function writeSw(file, config) {
  writeFileSync(file, swSource(config));
}
