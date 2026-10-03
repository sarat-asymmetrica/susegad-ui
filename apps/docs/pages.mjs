// Writes the generated pages of the docs site into out/docs: the index pages,
// one page per registry item, the pencil box, and the home page's doors.
// The decisions (what each page says, where it lives) are site.core.js's; this
// is the edge that reads the disk (scene metas, docs and prompts in Markdown)
// and writes files.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { render } from '../../packages/folio/md/index.js';
import { toCard } from './gallery.core.js';
import { TECHNIQUES, techniqueName } from './techniques.js';
import { volumes } from './manifest.js';
import { KINDS, slugOf, pathOf, sceneGroups, indexPage, scenePage, itemPage, pencilBoxPage, homeDoors } from './site.core.js';

/**
 * Markdown to page markup: the file's own title goes (the page has its h1),
 * headings move down `shift` levels, and every id gets a prefix so a heading
 * called "Prompt" cannot collide with the page's own #prompt.
 */
export function mdToHtml(src, { shift = 0, prefix = 'doc-' } = {}) {
  let html = render(src).html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/, '');
  html = html.replace(/<(\/?)h([1-6])\b/g, (_, slash, n) => `<${slash}h${Math.min(6, Math.max(2, Number(n) + shift))}`);
  html = html.replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`).replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`);
  // an empty corner cell labels nothing, so it is a plain cell, not a header
  html = html.replace(/<th([^>]*)>\s*<\/th>/g, '<td$1></td>');
  // a wide table scrolls inside a region a keyboard can reach and a screen reader can name
  let n = 0;
  html = html.replace(/<table\b[\s\S]*?<\/table>/g, t => `<div class="table-wrap" tabindex="0" role="region" aria-label="Table ${++n}">${t}</div>`);
  return html;
}

/** The other pages that live beside a scene (Tinto's world, the veranda's walk), by their <title>. */
function sceneExtras(root, item) {
  const dir = path.join(root, path.dirname(item.manifest));
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html') && f !== 'demo.html')
    .sort()
    .map(f => {
      const t = /<title>([^<]*)<\/title>/.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
      return { href: `/${path.posix.join(path.dirname(item.manifest), f)}`, title: t ? t[1].trim() : f };
    });
}

/**
 * @param {{ root: string, out: string, registry: object, posters: Record<string, {w,h}>, write: (to: string, text: string) => void }} o
 * @returns {{ pages: string[], doorsHtml: string }} the files written (absolute) and the home page's doors
 */
export async function writePages({ root, out, registry, posters, write }) {
  const exists = p => fs.existsSync(path.join(root, p));
  const byName = new Map(registry.items.map(i => [i.name, i]));
  // A docs file that links to another piece's docs file (../../surfaces/carepa/carepa.docs.md)
  // means that piece's page on the site; item pages are one folder down, so ../<kind>/<name>.
  const posix = p => p.split('\\').join('/');
  const docsPage = new Map(registry.items.filter(i => i.docs).map(i => [posix(i.docs), i]));
  const siteLinks = (html, from) => html.replace(/href="([^"#]+\.docs\.md)(#[^"]*)?"/g, (m, href, hash = '') => {
    const target = docsPage.get(path.posix.normalize(path.posix.join(path.posix.dirname(posix(from)), href)));
    return target ? `href="../${pathOf(target)}${hash}"` : m;
  });
  const of = type => registry.items.filter(i => i.type === type);
  const pages = [];
  const put = (rel, html) => { const to = path.join(out, rel); write(to, html); pages.push(to); };
  const read = p => (p && exists(p) ? fs.readFileSync(path.join(root, p), 'utf8') : '');

  // ── scenes ────────────────────────────────────────────────────────
  const sceneItems = of('scene');
  const metas = new Map();
  for (const item of sceneItems) {
    const f = path.join(root, 'packages', 'scenes', slugOf(item), 'meta.js');
    metas.set(item.name, fs.existsSync(f) ? (await import(pathToFileURL(f).href)).meta : { title: item.title });
  }
  const groups = sceneGroups(volumes, sceneItems);
  const ordered = groups.flatMap(g => g.items.map(x => ({ ...x, group: g.title })));
  const lines = {};
  for (const { item } of ordered) {
    const m = metas.get(item.name);
    // the card's title is the scene's name (Paus); its line is what the plate is called
    lines[item.name] = m.title && m.title !== item.title ? m.title : '';
  }
  put('scenes.html', indexPage('scene', { groups, posters, lines }));
  ordered.forEach(({ item, plate, group }, index) => {
    const card = toCard(item, exists);
    put(`${pathOf(item)}.html`, scenePage(item, metas.get(item.name), {
      list: ordered.map(x => x.item), index, plate, group,
      poster: posters[item.name],
      extras: sceneExtras(root, item),
      demo: card.demoUrl && card.demoUrl.endsWith('demo.html') ? card.demoUrl : null,
      techniqueName,
    }));
  });

  // ── components, recipes, foundations ──────────────────────────────
  for (const type of ['component', 'recipe', 'package']) {
    const items = (type === 'package' ? [...of('package'), ...of('surface')] : of(type)).sort((a, b) => a.title.localeCompare(b.title));
    // foundations are mostly plumbing with nothing to show; one poster among them makes a ragged grid, so none
    put(`${KINDS[type].key}.html`, indexPage(type, { items, posters: type === 'package' ? {} : posters }));
    items.forEach((item, index) => {
      const card = toCard(item, exists);
      put(`${pathOf(item)}.html`, itemPage(item, {
        list: items, index,
        poster: posters[item.name],
        demo: card.demoUrl,
        docsHtml: item.docs ? siteLinks(mdToHtml(read(item.docs), { prefix: 'doc-' }), item.docs) : '',
        promptHtml: item.prompt ? mdToHtml(read(item.prompt), { shift: 1, prefix: 'prompt-' }) : '',
        deps: (item.dependencies || []).map(d => byName.get(d)).filter(Boolean),
      }));
    });
  }

  // ── the pencil box ────────────────────────────────────────────────
  put('pencil-box.html', pencilBoxPage(TECHNIQUES, ordered.map(({ item }) => ({ item, meta: metas.get(item.name) }))));

  // ── the home page's doors: a few pieces of each kind that have a still ─
  const prefer = { scene: ['paus', 'tinto', 'shet'], component: ['stamp', 'date-range', 'badge'], recipe: ['booking', 'storybook-spread', 'proposal'], package: [] };
  const doors = ['scene', 'component', 'recipe', 'package'].map(type => {
    const items = type === 'package' ? [...of('package'), ...of('surface')] : of(type);
    const wanted = prefer[type].map(n => items.find(i => slugOf(i) === n)).filter(Boolean);
    const rest = items.filter(i => !wanted.includes(i) && posters[i.name]);
    return { type, count: items.length, samples: [...wanted, ...rest].slice(0, 3) };
  });
  const doorsHtml = homeDoors(doors, posters, Object.keys(TECHNIQUES).length);
  return { pages, doorsHtml };
}
