// The pages for the site's first two readers (request front-door-4): someone who wants a page and
// someone who builds with an AI agent. Pure: registry items, posters and demo URLs in, HTML strings out.
//
//   showcasePage  /showcase    every recipe and template as a whole page, grouped by who would use it
//   teamsPage     /for-teams   what a business gets, what it costs, a note for its developer
//   developersPage /developers  the engineer's door: every index, the tools, the trust pages, the ideas
//   homeShowcase, homeScenes    the home page's two picture strips (index.html's site:showcase and site:scenes)
//
// Every string is Kathakar's, in words.core.js (W.audience); words/front-door-4.md is the source.

import { esc, page, head, posterImg, up, KINDS, SITE } from './site.core.js';
import { W } from './words.core.js';

const A = () => W.audience;

/**
 * The showcase's groups, in order, and what each recipe or template is in plain words. A piece the
 * table does not name still shows, in the last group: the showcase lists every recipe and template.
 */
export const SHOWCASE = [
  { key: 'stay', items: ['site-shell', 'booking', 'room-details', 'enquiry'] },
  { key: 'events', items: ['template-event', 'agenda', 'speakers', 'venue', 'member-directory', 'offline'] },
  { key: 'food', items: ['food-order'] },
  { key: 'work', items: ['studio-home', 'proposal', 'file-upload', 'saving-footer'] },
  { key: 'stories', items: ['greeting-card', 'storybook-spread'] },
];

/** The pieces the home page's strip leads with (each must be in SHOWCASE). */
export const HOME_SHOWCASE = ['template-event', 'booking', 'food-order', 'proposal', 'greeting-card', 'studio-home'];

/** The scenes the home page's strip shows: one of each kind of place. */
export const HOME_SCENES = ['scene-paus', 'scene-shet', 'scene-ferry', 'scene-kolam', 'scene-toran', 'scene-tollem'];

/** Group the showcase's pieces: SHOWCASE's order, then anything new in a group of its own. */
export function showcaseGroups(items) {
  const byName = new Map(items.filter(i => i.type === 'recipe' || i.type === 'template').map(i => [i.name, i]));
  const seen = new Set();
  const groups = SHOWCASE.map(g => ({ key: g.key, items: g.items.map(n => byName.get(n)).filter(Boolean) }))
    .map(g => { g.items.forEach(i => seen.add(i.name)); return g; })
    .filter(g => g.items.length);
  const rest = [...byName.values()].filter(i => !seen.has(i.name)).sort((a, b) => a.title.localeCompare(b.title));
  if (rest.length) groups.push({ key: 'more', items: rest });
  return groups;
}

/** What a piece is, in plain words: the showcase's own line, else the registry's first sentence. */
export function plain(item) {
  const own = A().pieces[item.name];
  if (own) return own;
  const first = String(item.description || '').split(/(?<=\.)\s/)[0];
  return { title: item.title, line: first.length > 140 ? `${first.slice(0, 137).replace(/\s+\S*$/, '')}…` : first, what: item.title.toLowerCase() };
}

/** The words a visitor pastes into their agent to make a piece of their own. */
export const agentPrompt = item => A().show.prompt.replace('{what}', plain(item).what).replace('{name}', item.name)
  .replace('{kind}', item.type === 'template' ? 'template' : 'recipe').replaceAll('{site}', SITE);

/** A copy button. `name`, when given, is its accessible name: the visible word first (WCAG 2.5.3), then which piece. */
const copyButton = (text, label, announce, cls = '', name = '') => `<button class="copy${cls ? ` ${cls}` : ''}" type="button" data-copy-text="${esc(text)}" data-announce="${esc(announce)}"${name ? ` aria-label="${esc(name)}"` : ''}>${esc(label)}</button>`;

/** One showcase card: the poster (a link to the running page), its plain name and line, and the two ways to take it. */
export function showCard(item, { depth, poster, demo, pageHref, level = 3 }) {
  const p = plain(item);
  const u = up(depth);
  const open = demo ? (demo.startsWith('/') ? `${u}${demo.slice(1)}` : demo) : `${u}${pageHref}`;
  return `<li class="show-card">
          <a class="show-poster${poster ? '' : ' show-poster-plain'}" href="${esc(open)}" tabindex="-1" aria-hidden="true">${poster ? posterImg(item.name, poster, depth) : ''}</a>
          <h${level} class="show-title"><a href="${esc(open)}">${esc(p.title)}</a></h${level}>
          <p class="show-line">${esc(p.line)}</p>
          <p class="show-acts">${copyButton(agentPrompt(item), A().show.agent, A().show.copied, 'show-agent', `${A().show.agent}: ${p.title}`)} <a class="show-how" href="${u}${esc(pageHref)}" aria-label="${esc(`${A().show.how}: ${p.title}`)}">${esc(A().show.how)}</a></p>
        </li>`;
}

/** /showcase. `info(item)` gives each piece's { poster, demo, pageHref }. */
export function showcasePage(items, info) {
  const groups = showcaseGroups(items);
  const n = groups.reduce((s, g) => s + g.items.length, 0);
  const a = A();
  const sections = groups.map(g => `    <section class="show-group" aria-labelledby="g-${g.key}">
      <h2 class="show-group-title" id="g-${g.key}">${esc(a.show.groups[g.key])}</h2>
      <ul class="show-grid" role="list">
        ${g.items.map(i => showCard(i, { depth: 0, ...info(i) })).join('\n        ')}
      </ul>
    </section>`).join('\n');
  const main = `${head(a.show.kicker.replace('{n}', n), a.show.title, a.show.lede)}
    <p class="show-help">${esc(a.show.help)}</p>
${sections}
    <aside class="show-next" aria-labelledby="show-next-title">
      <h2 id="show-next-title">${esc(a.show.nextTitle)}</h2>
      <p>${esc(a.show.nextBody)}</p>
      <p class="cta"><a class="btn btn-solid" href="start#path-agent">${esc(a.home.ctaAgent)}</a> <a class="btn" href="for-teams#developer">${esc(a.ways.devLink)}</a></p>
    </aside>`;
  return page({ title: a.show.title, description: a.show.lede, depth: 0, active: 'showcase', path: 'showcase', main });
}

/** The home page's showcase strip. */
export function homeShowcase(items, info, total) {
  const byName = new Map(items.map(i => [i.name, i]));
  const picks = HOME_SHOWCASE.map(n => byName.get(n)).filter(Boolean);
  return `<ul class="show-grid show-grid-home" role="list">
        ${picks.map(i => showCard(i, { depth: 0, ...info(i) })).join('\n        ')}
      </ul>
      <p class="more-link"><a href="showcase">${esc(A().home.showAll.replace('{n}', total))}</a></p>`;
}

/** The home page's strip of scenes: posters that open each scene's page. */
export function homeScenes(items, posters, total) {
  const byName = new Map(items.map(i => [i.name, i]));
  const picks = HOME_SCENES.map(n => byName.get(n)).filter(i => i && posters[i.name]);
  return `<ul class="goa-strip" role="list">
        ${picks.map(i => `<li><a href="scenes/${esc(i.name.replace(/^scene-/, ''))}"><span class="goa-pic">${posterImg(i.name, posters[i.name], 0)}</span><span class="goa-name">${esc(i.title)}</span></a></li>`).join('\n        ')}
      </ul>
      <p class="more-link"><a href="scenes">${esc(A().home.goaAll.replace('{n}', total))}</a></p>`;
}

/** The pages the page for teams shows beside its words (each must be in SHOWCASE). */
export const TEAMS_PICTURES = ['booking', 'food-order', 'studio-home'];

/**
 * /for-teams: for a business or a team that wants a site. With `items` and `info` (as for the showcase), a column of
 * pages from the showcase stands beside the words, each a link to the page running.
 */
export function teamsPage(items = [], info = () => ({})) {
  const t = A().teams;
  const note = t.note.replaceAll('{site}', SITE);
  const byName = new Map(items.map(i => [i.name, i]));
  const pics = TEAMS_PICTURES.map(n => byName.get(n)).filter(Boolean).map(i => ({ i, ...info(i) })).filter(x => x.poster);
  const aside = pics.length ? `
    <aside class="teams-pics" aria-labelledby="pics-title">
      <h2 class="teams-pics-title" id="pics-title">${esc(t.picsTitle)}</h2>
      <ul role="list">
        ${pics.map(({ i, poster, demo, pageHref }) => `<li><a href="${esc(demo ? demo.replace(/^\//, '') : pageHref)}"><span class="show-poster">${posterImg(i.name, poster, 0)}</span><span class="teams-pic-name">${esc(plain(i).title)}</span></a></li>`).join('\n        ')}
      </ul>
      <p class="more-link"><a href="showcase">${esc(t.picsMore)}</a></p>
    </aside>` : '';
  const main = `${head(t.kicker, t.title, t.lede)}
    <div class="teams-layout">${aside}
    <div class="teams-main">
    <section class="teams-get" aria-labelledby="get-title">
      <h2 id="get-title">${esc(t.getTitle)}</h2>
      <ul class="facts" role="list">
        ${t.get.map(([b, rest]) => `<li><strong>${esc(b)}</strong> ${esc(rest)}</li>`).join('\n        ')}
      </ul>
      <p class="cta"><a class="btn btn-solid" href="showcase">${esc(A().home.ctaShow)}</a></p>
    </section>
    <section class="teams-cost" aria-labelledby="cost-title">
      <h2 id="cost-title">${esc(t.costTitle)}</h2>
      <p>${esc(t.cost)}</p>
    </section>
    <section class="teams-dev" id="developer" aria-labelledby="dev-title">
      <h2 id="dev-title">${esc(t.devTitle)}</h2>
      <p>${esc(t.devIntro)}</p>
      <div class="note-card">
        <p class="note-text" id="dev-note">${esc(note)}</p>
        <p class="note-acts">${copyButton(note, t.copy, t.copied).replace('<button class="copy"', '<button class="copy btn" data-copy="dev-note"')}</p>
      </div>
      <p class="teams-agent">${esc(t.agentLine)} <a href="start#path-agent">${esc(A().home.ctaAgent)}</a></p>
    </section>
    <section class="teams-faq" aria-labelledby="faq-title">
      <h2 id="faq-title">${esc(t.faqTitle)}</h2>
      ${t.faq.map(([q, ans]) => `<details class="fold faq">
        <summary>${esc(q)}</summary>
        <p>${esc(ans)}</p>
      </details>`).join('\n      ')}
    </section>
    <p class="teams-contact">${esc(t.contact)} <a href="https://asymmetrica.ai" rel="noopener">asymmetrica.ai</a></p>
    </div>
    </div>`;
  return page({ title: t.navTitle, description: t.lede, depth: 0, active: 'for-teams', path: 'for-teams', main });
}

/** /developers: the engineer's door. `counts` is { scene, component, recipe, template, package }. */
export function developersPage(counts, ideasHtml) {
  const d = A().devs;
  const shelf = [['components', 'component'], ['recipes', 'recipe'], ['templates', 'template'], ['scenes', 'scene'], ['foundations', 'package']]
    .map(([key, type]) => `<li><h3><a href="${key}">${esc(KINDS[type].title)}</a> <span class="door-count">${counts[type] ?? 0}</span></h3><p>${esc(d.shelf[key])}</p></li>`);
  shelf.push(`<li><h3><a href="pencil-box">${esc(d.pencilTitle)}</a> <span class="door-count">${counts.techniques ?? 0}</span></h3><p>${esc(d.shelf['pencil-box'])}</p></li>`);
  const tools = d.tools.map(([label, href, line]) => `<li><a href="${esc(href)}"${href.startsWith('http') ? ' rel="noopener"' : ''}>${esc(label)}</a> <span>${esc(line)}</span></li>`);
  const trust = d.trust.map(([label, href, line]) => `<li><a href="${esc(href)}">${esc(label)}</a> <span>${esc(line)}</span></li>`);
  const main = `${head(d.kicker, d.title, d.lede, `
      <p class="cta"><a class="btn btn-solid" href="start">${esc(d.start)}</a> <a class="btn" href="https://github.com/sarat-asymmetrica/susegad-ui" rel="noopener">GitHub <span aria-hidden="true">↗</span></a></p>`)}
    <section class="devs-shelf" aria-labelledby="shelf-title">
      <h2 id="shelf-title">${esc(d.shelfTitle)}</h2>
      <ul class="devs-grid" role="list">
        ${shelf.join('\n        ')}
      </ul>
    </section>
    <div class="devs-two">
      <section aria-labelledby="tools-title">
        <h2 id="tools-title">${esc(d.toolsTitle)}</h2>
        <ul class="devs-list" role="list">
          ${tools.join('\n          ')}
        </ul>
      </section>
      <section aria-labelledby="trust-title">
        <h2 id="trust-title">${esc(d.trustTitle)}</h2>
        <ul class="devs-list" role="list">
          ${trust.join('\n          ')}
        </ul>
      </section>
    </div>
${ideasHtml}`;
  return page({ title: d.title, description: d.lede, depth: 0, active: 'developers', path: 'developers', main });
}
