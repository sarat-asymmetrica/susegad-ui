import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLlms } from './llms.core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const index = {
  name: 'susegad-ui',
  items: [
    { name: 'badge', type: 'component', title: 'Badge', description: 'A word or two of status.', stability: 'experimental', docs: 'packages/components/badge/badge.docs.md', prompt: 'packages/components/badge/badge.prompt.md' },
    { name: 'tokens', type: 'package', title: 'Tokens', description: 'Colour, type and the register.', stability: 'beta', prompt: 'packages/tokens/tokens.prompt.md' },
    { name: 'kolam', type: 'scene', title: 'Kolam', description: 'A threshold drawing.', stability: 'experimental' },
  ],
};
const texts = item => ({
  badge: { docs: '## Badge\n\nUsage notes.', prompt: 'Make a badge.' },
  tokens: { prompt: 'Ship the tokens.' },
}[item.name]);

test('llms.txt groups by type, in a fixed order, and links to docs (or prompt as a fallback)', () => {
  const { txt } = buildLlms(index, texts);
  assert.match(txt, /^# Susegad UI\n\n> /);
  const componentsAt = txt.indexOf('## Components');
  const scenesAt = txt.indexOf('## Scenes');
  const packagesAt = txt.indexOf('## Packages');
  assert.ok(componentsAt >= 0 && scenesAt > componentsAt && packagesAt > scenesAt, 'components, then scenes, then packages (no recipes here)');
  assert.match(txt, /- \[Badge \(badge, experimental\)\]\(packages\/components\/badge\/badge\.docs\.md\): A word or two of status\./);
  assert.match(txt, /- \[Tokens \(tokens, beta\)\]\(packages\/tokens\/tokens\.prompt\.md\): Colour, type and the register\./, 'no docs file: falls back to the prompt link');
  assert.match(txt, /- Kolam \(kolam, experimental\): A threshold drawing\.\n/, 'neither docs nor prompt: no link, just the entry');
});

test('llms-full.txt inlines the docs text, or the prompt text when there is no docs file', () => {
  const { full } = buildLlms(index, texts);
  assert.match(full, /### Badge \(badge, experimental\)\n\nA word or two of status\.\n\n## Badge\n\nUsage notes\./);
  assert.match(full, /### Tokens \(tokens, beta\)\n\nColour, type and the register\.\n\nShip the tokens\./);
  assert.match(full, /### Kolam \(kolam, experimental\)\n\nA threshold drawing\.\n\n\*\(no docs or prompt file yet\)\*/);
});

test('an empty registry still produces a well-formed llms.txt', () => {
  const { txt, full } = buildLlms({ name: 'susegad-ui', items: [] }, () => ({}));
  assert.equal(txt, '# Susegad UI\n\n> A front-end library for interfaces and documents that are beautiful and comfortable at the same time. Every component has three registers (quiet, warm, playful); each one ships with the prompt that could make it, and components copy into your project so you own the code, the way shadcn/ui works.\n');
  assert.equal(full, txt);
});

test('a custom summary is used verbatim', () => {
  const { txt } = buildLlms({ name: 'susegad-ui', items: [] }, () => ({}), { summary: 'Short.' });
  assert.match(txt, /> Short\.\n/);
});

test('machineFiles get their own section at the end of llms.txt', () => {
  const { txt, full } = buildLlms(index, texts, {
    machineFiles: [
      { href: '/custom-elements.json', note: 'every sg- element' },
      { href: '/registry/registry.json' },
    ],
  });
  const at = txt.indexOf('## Machine-readable files');
  assert.ok(at > 0 && at > txt.indexOf('## Packages'), 'after the groups');
  assert.match(txt, /## Machine-readable files\n\n- \[custom-elements\.json\]\(\/custom-elements\.json\): every sg- element\n- \[registry\/registry\.json\]\(\/registry\/registry\.json\)\n/);
  assert.doesNotMatch(full, /Machine-readable/, 'llms-full.txt inlines the text itself, so it needs no link list');
});

test('no machineFiles, no section: the plain llms.txt is unchanged', () => {
  const { txt } = buildLlms(index, texts);
  assert.doesNotMatch(txt, /Machine-readable/);
});

test('the built site ships custom-elements.json, and its llms.txt points at it', () => {
  const out = path.join(HERE, '../../out/docs');
  const cemPath = path.join(out, 'custom-elements.json');
  if (!fs.existsSync(out)) return; // a fresh checkout: run node apps/docs/build.mjs first
  assert.ok(fs.existsSync(cemPath), 'custom-elements.json at the site root');
  const cem = JSON.parse(fs.readFileSync(cemPath, 'utf8'));
  assert.ok(cem.modules.some(m => m.exports?.some(e => e.name === 'sg-scene')), 'the manifest names sg-scene');
  const llms = fs.readFileSync(path.join(out, 'llms.txt'), 'utf8');
  assert.match(llms, /## Machine-readable files\n\n- \[custom-elements\.json\]\(\/custom-elements\.json\)/);
  const headers = fs.readFileSync(path.join(out, '_headers'), 'utf8');
  assert.match(headers, /^\/packages\/\*\n  Access-Control-Allow-Origin: \*$/m);
});
