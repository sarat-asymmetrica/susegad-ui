// The pure core of llms.txt and llms-full.txt (llmstxt.org): registry.json,
// plus each item's already-read docs and prompt Markdown, in -> the two
// files' text. No disk access here (llms.build.mjs is the side-effecting
// edge that reads packages/**/*.docs.md and *.prompt.md and writes these);
// this module is what gallery.core.js is to the Components page.
//
// llms.txt links to each item's own docs/prompt file at its real repo path
// (already served under /packages/... once the docs build copies it, see
// llms.build.mjs); llms-full.txt inlines the same text instead of linking,
// so an agent with no follow-up fetch still gets everything in one file.

const TYPE_ORDER = ['component', 'recipe', 'scene', 'package'];
const TYPE_TITLE = { component: 'Components', recipe: 'Recipes', scene: 'Scenes', package: 'Packages' };

/**
 * @param {{ name: string, items: object[] }} index registry.json, parsed
 * @param {(item: object) => { docs?: string, prompt?: string }} readTexts
 *   already-read text for an item's docs/prompt file, keyed by item; called
 *   once per item so the disk (or a fixture) is only touched by the caller.
 * @param {{ summary?: string, siteUrl?: string }} [opts]
 */
export function buildLlms(index, readTexts, opts = {}) {
  const items = Array.isArray(index?.items) ? index.items : [];
  const summary = opts.summary
    ?? 'A front-end library for interfaces and documents that are beautiful and comfortable at the same time. Every component has three registers (quiet, warm, playful); each one ships with the prompt that could make it, and components copy into your project so you own the code, the way shadcn/ui works.';

  const groups = TYPE_ORDER
    .map(type => ({ type, title: TYPE_TITLE[type], items: items.filter(i => i.type === type).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter(g => g.items.length > 0);

  const linkFor = item => item.docs ?? item.prompt ?? null;
  const noteFor = item => item.description ? item.description.trim().replace(/\s+/g, ' ') : '';

  const txtLines = [`# ${index?.name === 'susegad-ui' || !index?.name ? 'Susegad UI' : index.name}`, '', `> ${summary}`, ''];
  for (const g of groups) {
    txtLines.push(`## ${g.title}`);
    for (const item of g.items) {
      const link = linkFor(item);
      const label = `${item.title || item.name} (${item.name}, ${item.stability || 'experimental'})`;
      const note = noteFor(item);
      txtLines.push(link ? `- [${label}](${link})${note ? `: ${note}` : ''}` : `- ${label}${note ? `: ${note}` : ''}`);
    }
    txtLines.push('');
  }
  const txt = txtLines.join('\n').replace(/\n+$/, '\n');

  const fullLines = [`# ${index?.name === 'susegad-ui' || !index?.name ? 'Susegad UI' : index.name}`, '', `> ${summary}`, ''];
  for (const g of groups) {
    fullLines.push(`## ${g.title}`, '');
    for (const item of g.items) {
      const label = `${item.title || item.name} (${item.name}, ${item.stability || 'experimental'})`;
      fullLines.push(`### ${label}`, '');
      const note = noteFor(item);
      if (note) fullLines.push(note, '');
      const { docs, prompt } = readTexts(item) || {};
      if (docs) fullLines.push(docs.trim(), '');
      else if (prompt) fullLines.push(prompt.trim(), '');
      else fullLines.push('*(no docs or prompt file yet)*', '');
    }
  }
  const full = fullLines.join('\n').replace(/\n+$/, '\n');

  return { txt, full };
}
