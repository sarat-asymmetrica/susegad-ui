// Every scene has one prompt and one words-to-code map. meta.js (shown on the
// docs site) and <name>.prompt.md (copied by the CLI) must carry the same text,
// and every phrase the map quotes must be in the prompt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { TECHNIQUES } from '../../apps/docs/techniques.js';

const here = new URL('./', import.meta.url);
const scenes = readdirSync(here, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(new URL(`${d.name}/meta.js`, here)))
  .map(d => d.name);

/** The text of a `## heading` section, up to the next `## `. */
function section(md, heading) {
  const start = md.indexOf(`\n## ${heading}\n`);
  assert.ok(start >= 0, `no "## ${heading}" section`);
  const body = md.slice(start + heading.length + 5);
  const end = body.indexOf('\n## ');
  return (end < 0 ? body : body.slice(0, end)).trim();
}

/** Rows of a Markdown table, header and rule dropped: [[cell, cell, ...], ...]. */
const tableRows = text => text.split('\n').filter(l => l.startsWith('|')).slice(2)
  .map(l => l.slice(1, -1).split('|').map(c => c.trim()));

test('there are scenes to check', () => assert.ok(scenes.length >= 3, scenes.join(', ')));

for (const name of scenes) {
  test(`${name}: meta and ${name}.prompt.md carry one prompt and one map`, async () => {
    const { meta } = await import(new URL(`${name}/meta.js`, here));
    const md = readFileSync(new URL(`${name}/${name}.prompt.md`, here), 'utf8').replace(/\r\n/g, '\n');

    assert.equal(section(md, 'The prompt'), meta.prompt, 'meta.prompt differs from the prompt in the .prompt.md');

    const rows = tableRows(section(md, 'Words to code'));
    assert.deepEqual(rows, meta.map.map(r => [...r]), 'the words-to-code table differs from meta.map');

    for (const [phrase, technique] of meta.map) {
      for (const part of phrase.split(' … ')) assert.ok(meta.prompt.includes(part), `map phrase not in the prompt: "${part}"`);
      assert.ok(TECHNIQUES[technique], `unknown technique "${technique}"; add it to apps/docs/techniques.js`);
    }
    for (const t of meta.techniques ?? []) assert.ok(TECHNIQUES[t], `unknown technique tag "${t}"`);

    for (const key of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit', 'prompt']) {
      if (meta[key]) assert.ok(!meta[key].includes('—'), `em dash in meta.${key}`);
    }
    for (const row of meta.map) assert.ok(!row.join(' ').includes('—'), `em dash in the map: "${row[0]}"`);
  });
}
