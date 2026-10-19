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
import { KINDS, KONKANI, slugOf, pathOf, sceneGroups, indexPage, scenePage, itemPage, pencilBoxPage, homeDoors, page, posterImg, sentences, SITE } from './site.core.js';
import { trim } from './gallery.core.js';
import { LANGS, HOME_PATH, tr, kokMain, kokFoot, kokNewest } from './konkani.core.js';
import { parseSummary, accessibilityPage, docPage, templatesExtras, newestItems, newestHtml } from './door.core.js';
import { headings } from './a11y.core.js';
import { rewriteLinks } from './links.core.js';
import { W } from './words.core.js';
import { showcasePage, teamsPage, developersPage, homeShowcase, homeScenes, showcaseGroups } from './audience.core.js';
import { joinedDates } from './joined.mjs';
import { SCENES as POSTCARD_SCENES, DEFAULT_SCENE as POSTCARD_SCENE } from '../../packages/recipes/picture-postcard/scenes.js';
import { GOA_OCT_2026 } from '../../packages/recipes/picture-postcard/events/goa-oct-2026.js';
import { NAME_MAX } from '../../packages/recipes/picture-postcard/postcard.core.js';
import { POSTCARD, postcardMain, postcardDescription, sceneCounts } from './postcard-page.core.js';
import { loadPrivateList } from './private-list.mjs';
// tools/publish/ is private: absent in the public tree (nothing there is private); present, it must load (private-list.mjs)
const { isPrivate } = await loadPrivateList();

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
  const shipped = new Set();
  for (const i of registry.items) {
    if (i.type === 'template') continue;
    for (const f of ['demo.html', 'index.html']) { const p = `${path.posix.dirname(i.manifest)}/${f}`; if (exists(p)) shipped.add(p); }
  }
  // every link in a rendered file goes where a reader can follow it (links.core.js)
  const siteLinks = (html, from, depth = 1) => rewriteLinks(html, posix(from), {
    pageOf: t => { const i = docsPage.get(t); return i ? pathOf(i) : null; },
    shipped, exists, isPrivate, depth,
  });
  const of = type => registry.items.filter(i => i.type === type);
  const pages = [];
  const put = (rel, html) => { const to = path.join(out, rel); write(to, html); pages.push(to); };
  const read = p => (p && exists(p) ? fs.readFileSync(path.join(root, p), 'utf8') : '');

  const summary = parseSummary(read('docs/reference/accessibility.md'));
  const { dates: joined, source: joinedSource } = joinedDates(root, registry);
  console.log(`newest: item dates from ${joinedSource}`);

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
  for (const type of ['component', 'recipe', 'template', 'package']) {
    const items = (type === 'package' ? [...of('package'), ...of('surface')] : of(type)).sort((a, b) => a.title.localeCompare(b.title));
    // foundations are mostly plumbing with nothing to show; one poster among them makes a ragged grid, so none
    const extras = type === 'template' ? { extra: templatesExtras({ eventSrc: 'templates/event/site/', konkani: KONKANI, createOnNpm: JSON.parse(read('apps/docs/npx-packages.json')).createOnNpm }), scripts: ['templates-page.js'], styles: ['packages/components/bloom/bloom.css'] } : {};
    put(`${KINDS[type].key}.html`, indexPage(type, { items, posters: type === 'package' ? {} : posters, ...extras }));
    items.forEach((item, index) => {
      const card = toCard(item, exists);
      put(`${pathOf(item)}.html`, itemPage(item, {
        list: items, index,
        poster: posters[item.name],
        // a template's source pages need the library beside them, so its "demo" is the site the build made from it
        demo: item.type === 'template' ? `/templates/${slugOf(item)}/site/` : card.demoUrl,
        docsHtml: item.docs ? siteLinks(mdToHtml(read(item.docs), { prefix: 'doc-' }), item.docs) : '',
        a11yTables: summary.tables,
        promptHtml: item.prompt ? mdToHtml(read(item.prompt), { shift: 1, prefix: 'prompt-' }) : '',
        deps: (item.dependencies || []).map(d => byName.get(d)).filter(Boolean),
      }));
    });
  }

  // ── the pencil box ────────────────────────────────────────────────
  put('pencil-box.html', pencilBoxPage(TECHNIQUES, ordered.map(({ item }) => ({ item, meta: metas.get(item.name) }))));

  // ── the trust door, the handoff and the browser matrix ─────────────
  put('accessibility.html', accessibilityPage(summary, new Set(of('component').map(i => i.name)), { withoutTable: of('component').map(i => i.name).filter(n => !summary.components.some(c => c.name === n)) }));
  for (const [key, file, copy] of [['handoff', 'docs/HANDOFF.md', W.handoff], ['browsers', 'docs/BROWSERS.md', W.browsers]]) {
    const html = siteLinks(mdToHtml(read(file), { prefix: 'doc-' }), file, 0);
    put(`${key}.html`, docPage({ copy, path: key, active: key === 'browsers' ? 'accessibility' : 'start', html, headings: headings(html) }));
  }

  // ── front door 4: the showcase, the page for teams and the developer's door ──
  const showInfo = item => ({
    poster: posters[item.name],
    // a template's "demo" is the site the build made from it; a recipe's is its own page
    demo: item.type === 'template' ? `/templates/${slugOf(item)}/site/` : toCard(item, exists).demoUrl,
    pageHref: pathOf(item),
  });
  put('showcase.html', showcasePage(registry.items, showInfo));
  put('for-teams.html', teamsPage(registry.items, showInfo));
  {
    const src0 = read('apps/docs/ideas.html');
    const j0 = src0.indexOf('<section class="ideas"');
    const ideasHtml = src0.slice(j0, src0.indexOf('</section>', j0) + '</section>'.length).replace(/^/gm, '    ').trimStart();
    put('developers.html', developersPage({
      scene: of('scene').length, component: of('component').length, recipe: of('recipe').length, template: of('template').length,
      package: of('package').length + of('surface').length, techniques: Object.keys(TECHNIQUES).length,
    }, `    ${ideasHtml}`));
  }
  // ── /postcard: the Conclave postcard maker (the recipe picture-postcard, and the page around it) ──
  put('postcard.html', page({
    title: POSTCARD.title, description: postcardDescription(GOA_OCT_2026), depth: 0, path: 'postcard', readyLater: true,
    main: postcardMain({ scenes: POSTCARD_SCENES, posters, counts: sceneCounts(registry.items), nameMax: NAME_MAX, defaultScene: POSTCARD_SCENE }),
    scripts: ['postcard-page.js'], styles: ['postcard.css'],
  }));
  const showTotal = showcaseGroups(registry.items).reduce((s, g) => s + g.items.length, 0);
  const showcaseHtml = homeShowcase(registry.items, showInfo, showTotal);
  const scenesHtml = homeScenes(registry.items, posters, of('scene').length);

  // ── the home page: a signature picture for each door, and what joined last ─
  const all = type => (type === 'package' ? [...of('package'), ...of('surface')] : of(type));
  const doors = ['scene', 'component', 'recipe', 'package'].map(type => ({ type, count: all(type).length }));
  const art = { scene: 'scene-kolam', component: 'sig-dialog', recipe: 'sig-ribbon', package: 'sig-bloom' };
  // the shelf sits under For developers now; the pencil box is one click on, on /developers
  const doorsHtml = homeDoors(doors, posters, Object.keys(TECHNIQUES).length, { art, pencil: false });
  // a template's own pieces (the event's agenda, speakers and venue) are one story, told by the template: Newest names the template
  const family = new Set(of('template').flatMap(t => t.dependencies || []).filter(n => byName.get(n)?.type === 'recipe'));
  const newest = newestHtml(newestItems(registry.items, joined, 6, family));
  // ── the home page in Konkani: /gom-deva/ and /gom-latn/, drafts for a native reader (konkani.core.js) ──
  const createOnNpm = JSON.parse(read('apps/docs/npx-packages.json')).createOnNpm;
  const src = read('apps/docs/ideas.html');
  const i0 = src.indexOf('<section class="ideas"');
  const ideas = src.slice(i0, src.indexOf('</section>', i0) + '</section>'.length).replace('<section class="ideas"', '<section class="ideas" lang="en-IN"');
  const newestKok = newestItems(registry.items, joined, 9, family).map(it => ({ ...it, href: `../${pathOf(it)}` }));
  for (const lang of LANGS) {
    const kokDoors = doors.map(d => ({ ...d, picture: posters[art[d.type]] ? posterImg(art[d.type], posters[art[d.type]], 1) : '' }));
    const main = kokMain({
      lang, up: '../', doors: kokDoors, techniques: Object.keys(TECHNIQUES).length,
      newest: kokNewest(newestKok, lang, t => trim(sentences(t, 120), 130)), ideas, englishNote: W.templates.draft,
      npmNote: createOnNpm ? '' : `
          <p class="npm-note" lang="en-IN"><code>create</code> arrives on npm with version 0.2.0. Until then, <a href="../start">Start here</a> shows how to run it from a clone.</p>`,
    });
    const lede = tr(lang, 'hero.lede');
    put(`${HOME_PATH[lang]}index.html`, page({
      title: 'Susegad UI', description: lede.slice(0, lede.indexOf('. ') + 1), depth: 1, path: HOME_PATH[lang], lang, alts: lang, main, scripts: ['docs.js'],
      footer: kokFoot({ lang, up: '../', github: 'https://github.com/sarat-asymmetrica/susegad-ui', englishLicence: 'MIT licensed code; documentation under CC BY 4.0.', englishPrivacy: '' }),
    }));
  }
  return { pages, doorsHtml, newestHtml: newest, showcaseHtml, scenesHtml };
}
