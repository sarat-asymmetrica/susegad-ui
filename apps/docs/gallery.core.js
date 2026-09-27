// The Components gallery's pure core: registry.json -> groups and cards.
//
// Runs in Node (tested by gallery.core.test.js) and in the browser (gallery.js
// imports it to filter and re-render). Takes no DOM, no fetch, no fs: whatever
// needs a disk read (does a demo file exist?) is passed in as `fileExists`,
// so the same code is tested against a fixture and run against the real tree.

/** Reading order for the page; a type with no items is left out. */
export const TYPE_ORDER = ['component', 'recipe', 'scene', 'package'];

export const TYPE_META = {
  component: {
    title: 'Components',
    blurb: 'Headless behaviour with one skin per register. Most carry a live demo below.',
  },
  recipe: {
    title: 'Recipes',
    blurb: 'Compositions of the components above, built for a real business flow.',
  },
  scene: {
    title: 'Scenes',
    blurb: 'A model plus a renderer, run by <sg-scene>. The masthead kolam is one of these.',
  },
  package: {
    title: 'Packages',
    blurb: 'Tokens, the engine and the other plumbing every piece above is built on.',
  },
};

/** Cut a description to about `max` characters, on a word, and mark the cut. */
export function trim(text, max = 220) {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const clean = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${clean.trim()}…`;
}

function dirOf(path) {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

/** A scene's registry name is "scene-<name>"; the front door plate uses <name>. */
function plateName(name) {
  return name.startsWith('scene-') ? name.slice('scene-'.length) : name;
}

/**
 * One item's card. `fileExists(repoRelativePath)` answers whether a file is
 * really on disk, so a component with no demo yet gets no dead "See it" link.
 * @param {object} item one entry of registry.json's `items`
 * @param {(path: string) => boolean} fileExists
 * @param {(name: string) => boolean} [isPlated] does a scene with this bare
 *   name (no "scene-" prefix) actually appear as a plate on the front door?
 *   Only scene-paus and scene-rampon lack a demo.html today, and of those
 *   only paus is in apps/docs/manifest.js's plate order; rampon is a real
 *   registry item with no page anywhere yet, so it gets no link at all
 *   rather than one to a fragment that doesn't exist.
 */
export function toCard(item, fileExists, isPlated = () => false) {
  const base = dirOf(item.manifest);
  const demoFile = ['demo.html', 'index.html'].find(f => fileExists(`${base}/${f}`));
  let demoUrl = demoFile ? `/${base}/${demoFile}` : null;
  let previewKind = null;
  let sceneName = null;

  if (demoUrl && demoFile === 'demo.html') {
    previewKind = 'iframe';
  } else if (!demoUrl && item.type === 'scene' && isPlated(plateName(item.name))) {
    // This scene has no demo.html of its own, but it does play as a plate on
    // the front door, so link and preview there. A root-absolute /index.html
    // would be right once deployed (apps/docs/* is promoted to the site's
    // own root) but 404s in dev, where apps/docs still sits under its own
    // folder. components.html and index.html are always siblings either
    // way, so a same-directory relative link, the convention index.html's
    // own footer already uses for for-rafe.html, resolves correctly in both.
    sceneName = plateName(item.name);
    demoUrl = `./index.html#${sceneName}`;
    previewKind = 'scene';
  }

  return {
    name: item.name,
    type: item.type,
    title: item.title || item.name,
    description: trim(item.description),
    registers: (item.registers || []).slice(),
    demoUrl,
    docsUrl: item.docs ? `/${item.docs}` : null,
    promptUrl: item.prompt ? `/${item.prompt}` : null,
    previewKind,
    sceneName,
  };
}

/**
 * @param {{ items: object[] }} index parsed registry.json
 * @param {(path: string) => boolean} fileExists
 * @param {(name: string) => boolean} [isPlated] see toCard
 * @returns {{ groups: Array<{ type: string, title: string, blurb: string, items: object[] }>, count: number }}
 */
export function buildGallery(index, fileExists, isPlated = () => false) {
  const items = index && Array.isArray(index.items) ? index.items : [];
  const cards = items
    .map(item => toCard(item, fileExists, isPlated))
    .sort((a, b) => a.title.localeCompare(b.title));
  const groups = TYPE_ORDER
    .map(type => ({ type, ...TYPE_META[type], items: cards.filter(c => c.type === type) }))
    .filter(g => g.items.length > 0);
  return { groups, count: cards.length };
}

/** A card matches a search term against its title, name and description. */
export function matches(card, term) {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return card.title.toLowerCase().includes(q)
    || card.name.toLowerCase().includes(q)
    || card.description.toLowerCase().includes(q);
}

/** Filter a built gallery's groups by a search term, dropping empty groups. */
export function filterGallery(groups, term) {
  if (!term || !term.trim()) return groups;
  return groups
    .map(g => ({ ...g, items: g.items.filter(c => matches(c, term)) }))
    .filter(g => g.items.length > 0);
}
