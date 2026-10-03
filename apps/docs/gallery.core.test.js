import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGallery, filterGallery, matches, toCard, trim, TYPE_ORDER } from './gallery.core.js';

const FILES = new Set([
  'packages/components/badge/demo.html',
  'packages/recipes/booking/index.html',
  'packages/scenes/tollem/demo.html',
]);
const fileExists = p => FILES.has(p);

const badge = {
  name: 'badge', type: 'component', title: 'Badge', description: 'A word or two of status.',
  manifest: 'packages/components/badge/registry.json',
  docs: 'packages/components/badge/badge.docs.md', prompt: 'packages/components/badge/badge.prompt.md',
  registers: ['quiet', 'warm', 'playful'],
};
const booking = {
  name: 'booking', type: 'recipe', title: 'Booking', description: 'Book the whole house.',
  manifest: 'packages/recipes/booking/registry.json', registers: ['quiet', 'warm', 'playful'],
};
const tokens = {
  name: 'tokens', type: 'package', title: 'Tokens', description: 'Colour, type, motion.',
  manifest: 'packages/tokens/registry.json', registers: [],
};
const tollem = {
  name: 'scene-tollem', type: 'scene', title: 'Tollem', description: 'A WebGL scene.',
  manifest: 'packages/scenes/tollem/registry.json', registers: ['quiet', 'warm', 'playful'],
};
const paus = {
  name: 'scene-paus', type: 'scene', title: 'Paus', description: 'Rain on a window.',
  manifest: 'packages/scenes/paus/registry.json', registers: ['quiet', 'warm', 'playful'],
};
const rampon = {
  name: 'scene-rampon', type: 'scene', title: 'Rampon', description: 'A koel calling.',
  manifest: 'packages/scenes/rampon/registry.json', registers: ['quiet', 'warm', 'playful'],
};
// only paus is on the front door's plate order in this fixture, matching
// apps/docs/manifest.js today: rampon has a registry entry but no page yet
const isPlated = name => name === 'paus';

test('trim keeps short text and cuts long text on a word, with a mark', () => {
  assert.equal(trim('short'), 'short');
  assert.equal(trim('', 10), '');
  const long = 'one two three four five six seven eight nine ten';
  const cut = trim(long, 20);
  assert.ok(cut.length <= 21, `expected about 20 chars, got ${cut.length}`);
  assert.ok(cut.endsWith('…'));
  assert.ok(!cut.slice(0, -1).endsWith(' '));
});

test('toCard finds demo.html and builds a root-absolute URL', () => {
  const card = toCard(badge, fileExists);
  assert.equal(card.demoUrl, '/packages/components/badge/demo.html');
  assert.equal(card.previewKind, 'iframe');
  assert.equal(card.docsUrl, '/packages/components/badge/badge.docs.md');
  assert.equal(card.promptUrl, '/packages/components/badge/badge.prompt.md');
});

test('toCard finds a recipe\'s index.html but does not offer a live preview', () => {
  const card = toCard(booking, fileExists);
  assert.equal(card.demoUrl, '/packages/recipes/booking/index.html');
  assert.equal(card.previewKind, null);
});

test('toCard gives a package with no demo file no link and no preview', () => {
  const card = toCard(tokens, fileExists);
  assert.equal(card.demoUrl, null);
  assert.equal(card.previewKind, null);
  assert.equal(card.docsUrl, null);
});

test('toCard falls back to the front door plate for a scene with no demo.html but a real plate, as a relative link', () => {
  const card = toCard(paus, fileExists, isPlated);
  // relative, not root-absolute: components.html and index.html are always
  // siblings, in dev (apps/docs/) and in the built copy (promoted to root)
  // alike, so a root-absolute /index.html would 404 in dev.
  assert.equal(card.demoUrl, './index.html#paus');
  assert.equal(card.previewKind, 'scene');
  assert.equal(card.sceneName, 'paus');
});

test('toCard gives a scene with no demo.html and no plate no link at all, not a dead one', () => {
  const card = toCard(rampon, fileExists, isPlated);
  assert.equal(card.demoUrl, null);
  assert.equal(card.previewKind, null);
  assert.equal(card.sceneName, null);
});

test('toCard without isPlated (the default) never guesses a plate link', () => {
  const card = toCard(paus, fileExists);
  assert.equal(card.demoUrl, null);
  assert.equal(card.previewKind, null);
});

test('toCard prefers a scene\'s own demo.html when it has one', () => {
  const card = toCard(tollem, fileExists);
  assert.equal(card.demoUrl, '/packages/scenes/tollem/demo.html');
  assert.equal(card.previewKind, 'iframe');
});

test('no card ever carries a Windows path or a backslash; every URL is root-absolute or a same-directory relative link', () => {
  for (const item of [badge, booking, tokens, tollem, paus, rampon]) {
    const card = toCard(item, fileExists, isPlated);
    for (const url of [card.demoUrl, card.docsUrl, card.promptUrl]) {
      if (url == null) continue;
      assert.ok(url.startsWith('/') || url.startsWith('./'), `${item.name}: ${url} is neither root-absolute nor a same-directory relative link`);
      assert.ok(!/^[a-zA-Z]:/.test(url), `${item.name}: ${url} looks like a Windows path`);
      assert.ok(!url.includes('\\'), `${item.name}: ${url} has a backslash`);
    }
  }
});

test('buildGallery groups by type, in the fixed reading order, sorted by title', () => {
  const { groups, count } = buildGallery({ items: [tokens, booking, badge, tollem] }, fileExists);
  assert.equal(count, 4);
  assert.deepEqual(groups.map(g => g.type), TYPE_ORDER);
  const components = groups.find(g => g.type === 'component');
  assert.deepEqual(components.items.map(c => c.name), ['badge']);
});

test('buildGallery drops a type with no items instead of an empty group', () => {
  const { groups } = buildGallery({ items: [badge] }, fileExists);
  assert.deepEqual(groups.map(g => g.type), ['component']);
});

test('buildGallery on an empty or malformed index gives no groups, not a throw', () => {
  assert.deepEqual(buildGallery({}, fileExists).groups, []);
  assert.deepEqual(buildGallery({ items: [] }, fileExists).groups, []);
});

test('matches checks title, name and description, case-insensitively', () => {
  const card = toCard(badge, fileExists);
  assert.ok(matches(card, ''));
  assert.ok(matches(card, 'BADGE'));
  assert.ok(matches(card, 'status'));
  assert.ok(!matches(card, 'kolam'));
});

test('filterGallery drops groups left with nothing, and an empty term is a no-op', () => {
  const { groups } = buildGallery({ items: [badge, booking] }, fileExists);
  assert.deepEqual(filterGallery(groups, ''), groups);
  const found = filterGallery(groups, 'status');
  assert.equal(found.length, 1);
  assert.equal(found[0].type, 'component');
  assert.deepEqual(filterGallery(groups, 'no such thing anywhere'), []);
});

test('a scape card carries both figures; other cards carry none', () => {
  const shet = { ...tollem, name: 'scene-shet', title: 'Shet', tier: 'scape', firstSightBytes: 61440, jsBytes: 92160 };
  assert.equal(toCard(shet, fileExists).tierNote, 'scape: 60 KB at first sight, 90 KB in all');
  assert.equal(toCard(tollem, fileExists).tierNote, null);
});
