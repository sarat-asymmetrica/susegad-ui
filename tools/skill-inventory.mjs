#!/usr/bin/env node
// Rewrites the generated inventory blocks in references/components.md and
// references/scenes.md from registry/registry.json, so SKILL.md's reference
// files never hand-write a list of items that goes stale as new pieces
// ship (audition round 1, 2026-09-28: SKILL.md named only three scenes
// while the shelf held 27). Each block sits between a pair of HTML comment
// markers (<!-- inventory:<type>:start/end -->, the same convention
// index.html uses for its site:doors block) and is rebuilt
// whole, never edited by hand inside the markers.
//
//   node tools/skill-inventory.mjs             write both files
//   node tools/skill-inventory.mjs --check     fail if either is stale

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/** One item's line: name (bold title), its useFor tags in braces, then a trimmed description. */
function lineFor(item, { stripPrefix } = {}) {
  const name = stripPrefix && item.name.startsWith(stripPrefix) ? item.name.slice(stripPrefix.length) : item.name;
  const use = item.useFor?.length ? ` {${item.useFor.join(', ')}}` : '';
  const desc = (item.description || '').trim().replace(/\s+/g, ' ');
  return `- **${name}**${use} -- ${desc}`;
}

/** @param {{ items: object[] }} index registry.json, parsed */
export function componentBlock(index) {
  const items = index.items.filter(i => i.type === 'component').sort((a, b) => a.name.localeCompare(b.name));
  return items.map(i => lineFor(i)).join('\n') + '\n';
}

/** @param {{ items: object[] }} index registry.json, parsed */
export function sceneBlock(index) {
  const items = index.items.filter(i => i.type === 'scene').sort((a, b) => a.name.localeCompare(b.name));
  return items.map(i => lineFor(i, { stripPrefix: 'scene-' })).join('\n') + '\n';
}

/** Replace the text between a pair of markers in `text`, keeping the markers themselves. */
export function withBlock(text, kind, block) {
  const start = `<!-- inventory:${kind}:start -->`, end = `<!-- inventory:${kind}:end -->`;
  const startAt = text.indexOf(start), endAt = text.indexOf(end);
  if (startAt === -1 || endAt === -1 || endAt < startAt) {
    throw new Error(`missing ${start} / ${end} markers`);
  }
  return text.slice(0, startAt + start.length) + '\n' + block + text.slice(endAt);
}

function main(argv) {
  const root = resolve(argv.find(a => a.startsWith('--root='))?.slice('--root='.length) ?? ROOT);
  const check = argv.includes('--check');
  const index = JSON.parse(readFileSync(join(root, 'registry', 'registry.json'), 'utf8'));

  const targets = [
    { file: join(root, 'references', 'components.md'), kind: 'component', block: componentBlock(index) },
    { file: join(root, 'references', 'scenes.md'), kind: 'scene', block: sceneBlock(index) },
  ];

  let stale = false;
  for (const { file, kind, block } of targets) {
    if (!existsSync(file)) { console.error(`${file} does not exist`); return 1; }
    const current = readFileSync(file, 'utf8');
    let next;
    try {
      next = withBlock(current, kind, block);
    } catch (err) {
      console.error(`${file}: ${err.message}`);
      return 1;
    }
    const rel = file.replace(root + (root.endsWith('\\') || root.endsWith('/') ? '' : '/'), '').replaceAll('\\', '/');
    if (check) {
      if (current.replace(/\r\n/g, '\n') !== next.replace(/\r\n/g, '\n')) {
        console.error(`${rel} is out of date. Run node tools/skill-inventory.mjs to refresh it.`);
        stale = true;
      } else {
        console.log(`${rel} is up to date.`);
      }
      continue;
    }
    writeFileSync(file, next);
    console.log(`Wrote ${rel}.`);
  }
  return stale ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
