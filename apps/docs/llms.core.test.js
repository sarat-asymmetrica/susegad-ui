import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLlms } from './llms.core.js';

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
