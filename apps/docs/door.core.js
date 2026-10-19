// The front door's own pages, as HTML strings: the accessibility page (the Trust door), the handoff and
// browsers pages, the live event template and the bloom toy on the templates page, and the Newest list.
// Pure, like site.core.js: pages.mjs reads the disk and the registry and hands the data in.

import { trim } from './gallery.core.js';
import { page, esc, up, KINDS, pathOf, sentences, head } from './site.core.js';
import { W, inline } from './words.core.js';

// ── the accessibility summary, read ─────────────────────────────────

/**
 * What docs/reference/accessibility.md says, as data: how many components have a table, the known gaps and each
 * component's counts. The page takes every number from here, so it cannot drift from the summary.
 * @param {string} md
 */
export function parseSummary(md) {
  const tables = Number(/(\d+) of (\d+) components have their conformance table written/.exec(md)?.[1] ?? 0);
  const section = title => {
    const m = new RegExp(`^## ${title}\\s*$`, 'm').exec(md);
    if (!m) return '';
    const rest = md.slice(m.index + m[0].length);
    const n = rest.search(/^## /m);
    return n < 0 ? rest : rest.slice(0, n);
  };
  const rowsOf = text => text.split('\n').filter(l => /^\|/.test(l)).slice(2).map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
  const list = s => (/^none$/i.test(s) ? [] : s.split(',').map(x => x.trim()).filter(Boolean));
  const gaps = rowsOf(section('Known gaps')).map(([component, criterion, what]) => ({ component: component.replace(/^\[([^\]]+)\].*$/, '$1'), criterion, what }));
  const components = rowsOf(section('Components')).map(([link, traits, meets, author, na, gap]) => ({
    name: /^\[([^\]]+)\]/.exec(link)?.[1] ?? link, traits, meets: list(meets), author: list(author), na: list(na), gap: list(gap),
  }));
  return { tables: tables || components.length, gaps, components };
}

/** "the tooltip without JavaScript (1.4.13)" style phrase for the known gaps, from the data. */
export const gapsPhrase = gaps => `${gaps.length}, ${gaps.map(g => `${g.component} (${g.criterion.split(' ')[0]})`).join(', ')}`;

// ── the side list every long page shares ────────────────────────────

/** An "On this page" list: links to the ids on the page. */
export const tocNav = items => items.length < 2 ? '' : `<nav class="toc" aria-labelledby="toc-title">
        <h2 class="toc-title" id="toc-title">${esc(W.item.tocTitle)}</h2>
        <ul>${items.map(i => `<li><a href="#${esc(i.id)}">${esc(i.text)}</a></li>`).join('')}</ul>
      </nav>`;

// ── the Trust door ──────────────────────────────────────────────────

/**
 * The accessibility and browsers page.
 * @param {ReturnType<typeof parseSummary>} summary
 * @param {Set<string>} pageNames component names that have a page on the site
 */
export function accessibilityPage(summary, pageNames, { withoutTable = [] } = {}) {
  const total = summary.tables + withoutTable.length;
  const t = W.trust;
  const n = summary.tables;
  const rows = summary.components.map(c => {
    const short = { 'Meets': 'Meets', "Meets with author's part": "Author's part", 'Not applicable': 'N/A', 'Does not meet': 'Gap' };
    const cell = (cls, v) => `<td class="num" data-label="${cls}" data-short="${short[cls]}">${v.length ? `<b>${v.length}</b>` : '<span class="none">none</span>'}</td>`;
    const link = pageNames.has(c.name) ? `<a href="components/${esc(c.name)}#a11y">${esc(c.name)}</a>` : esc(c.name);
    return `<tr><th scope="row">${link}</th><td data-label="Kind of component">${esc(c.traits)}</td>${cell('Meets', c.meets)}${cell("Meets with author's part", c.author)}${cell('Not applicable', c.na)}${cell('Does not meet', c.gap)}</tr>`;
  }).join('\n        ');
  const sections = [
    { id: 'tables', title: t.tablesTitle, body: `<p>${esc(t.tablesBody(n, total))}</p>
      ${withoutTable.length ? `<p>${esc(t.without(withoutTable.length, new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(withoutTable)))}</p>
      ` : ''}<p>${esc(t.statuses)}</p>
      <p>${esc(summary.gaps.length ? t.gaps(gapsPhrase(summary.gaps)) : t.gapsNone)}</p>
      <p><a href="#components">${esc(t.summaryLink)}</a></p>` },
    { id: 'claim', title: t.claimTitle, body: `<p>${esc(t.claimBody)}</p>` },
    { id: 'gigw', title: t.gigwTitle, body: `<p>${esc(t.gigwBody)}</p>` },
    { id: 'browsers', title: t.browsersTitle, body: `<p>${esc(t.browsersBody)}</p>
      <p><a href="browsers">${esc(t.browsersLink)}</a></p>` },
    { id: 'how', title: t.howTitle, body: `<p>${esc(t.howBody)}</p>` },
    { id: 'handoff', title: '', body: `<p>${esc(t.handoff)} <a href="handoff">${esc(t.handoffLink)}</a></p>` },
  ];
  const main = `${head(t.kicker, t.title, t.lede)}
    <div class="side-layout">
      <div class="side-main prose trust">
        ${sections.map(s => `<section id="${s.id}"${s.title ? ` aria-labelledby="${s.id}-h"` : ''}>${s.title ? `<h2 id="${s.id}-h">${esc(s.title)}</h2>` : ''}
      ${s.body}</section>`).join('\n      ')}
        <section id="components" aria-labelledby="components-h">
          <h2 id="components-h">${esc(t.listTitle)} <span class="count">${n}</span></h2>
          <details class="fold" id="components-list" open>
          <summary>${n} components, with their counts</summary>
          <div class="table-wrap a11y-table" tabindex="0" role="region" aria-label="Conformance counts, by component">
          <table class="summary">
            <thead><tr><th scope="col">Component</th><th scope="col">Kind</th><th scope="col">Meets</th><th scope="col">Meets with author's part</th><th scope="col">Not applicable</th><th scope="col">Does not meet</th></tr></thead>
            <tbody>
        ${rows}
            </tbody>
          </table></div>
          </details>
        </section>
      </div>
      <aside class="side-aside" aria-label="On this page">
        ${tocNav([{ id: 'tables', text: 'The tables' }, { id: 'claim', text: 'What they can say' }, { id: 'gigw', text: 'GIGW 3.0' }, { id: 'browsers', text: 'Browsers' }, { id: 'how', text: 'How we test' }, { id: 'components', text: t.listTitle }])}
      </aside>
    </div>`;
  return page({ title: t.title, description: t.description, depth: 0, path: 'accessibility', active: 'accessibility', main, scripts: ['trust-page.js'] });
}

// ── the handoff and the browser matrix, rendered from their Markdown ─

/**
 * A long Markdown page of the repo (HANDOFF, BROWSERS) as a site page, with its own head and a list of its sections.
 * @param {{ copy: { kicker: string, title: string, lede: string, description: string }, path: string, active: string, html: string }} p
 */
export function docPage({ copy, path, active, html, headings }) {
  const main = `${head(copy.kicker, copy.title, copy.lede)}
    <div class="side-layout">
      <div class="side-main prose">${html}</div>
      <aside class="side-aside" aria-label="On this page">${tocNav(headings)}</aside>
    </div>`;
  return page({ title: copy.title, description: copy.description, depth: 0, path, active, main });
}

// ── the templates page: the event template running, and the bloom toy ─

const REG_LABELS = [['quiet', 'Quiet'], ['warm', 'Warm'], ['playful', 'Playful']];

/** The event template in a frame, quiet first, and the marigold for a name. Appended to the templates index. */
export function templatesExtras({ eventSrc, konkani = [], createOnNpm = false }) {
  const w = W.templates, b = W.bloom;
  return `
    <section class="live" id="event" aria-labelledby="live-h">
      <h2 id="live-h" class="section-title">${esc(w.liveTitle)}</h2>
      <p class="section-intro">${inline(w.liveBody, esc)}</p>
      <div class="live-tools">
        <fieldset class="seg live-seg" id="live-reg">
          <legend>${esc(w.seeAs)}</legend>
          <div class="seg-row">${REG_LABELS.map(([v, l], i) => `<label><input type="radio" name="live-register" value="${v}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
        </fieldset>
        <a class="live-open" id="live-open" href="${esc(eventSrc)}?register=quiet" rel="noopener" target="_blank">${esc(w.open)}</a>
      </div>
      <div class="live-frame">
        <iframe id="live-frame" title="${esc(w.frame)}" src="${esc(eventSrc)}?register=quiet" loading="lazy" width="1200" height="760"></iframe>
      </div>
      <p class="live-note">${esc(w.madeup)} <span lang="en-IN">${esc(w.draft)}</span></p>
      <p class="live-konkani">${konkani.map(k => `<a href="${esc(k.href)}" lang="${k.tag}" hreflang="${k.tag}">${k.name}</a>`).join(' ')}</p>
      <p class="install"><code>${esc(W.hero.command)}</code> <button class="copy" type="button" data-copy-text="${esc(W.hero.command)}" aria-label="${esc(W.hero.copyName)}" data-announce="${esc(W.hero.copiedAnnounce)}">${esc(W.hero.copy)}</button></p>${createOnNpm ? '' : `
      <p class="npm-note">${inline(W.hero.npmNote, esc)}</p>`}
    </section>

    <section class="toy" id="bloom" aria-labelledby="bloom-h">
      <h2 id="bloom-h" class="section-title">${esc(b.title)}</h2>
      <p class="section-intro">${esc(b.body)}</p>
      <div class="toy-cols">
        <form class="toy-form" id="maker" action="#" method="get">
          <label for="name">${esc(b.field)}</label>
          <input id="name" name="name" type="text" value="Maria Fernandes" maxlength="40" autocomplete="off" spellcheck="false">
          <p class="toy-private">${esc(b.private)}</p>
          <div class="toy-buttons"><button type="button" id="save" class="btn btn-solid">${esc(b.save)}</button></div>
          <p id="status" class="toy-status" role="status"></p>
          <noscript><p>${esc(b.nojs)}</p></noscript>
        </form>
        <figure class="toy-card">
          <canvas id="card" width="1080" height="1350" role="img" aria-label="${esc(b.cardName('Maria Fernandes'))}"></canvas>
        </figure>
      </div>
    </section>`;
}

// ── Newest ──────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "7 October 2026" from an ISO date: day, month in full, year, no comma. */
export const longDate = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };

/**
 * The newest items by the date they joined, as the home page's list. `joined` maps registry name to an ISO date;
 * an item with no date is left out, so the list can only ever say what the data says.
 * @param {object[]} items registry items
 * @param {Record<string, string>} joined
 * @param {number} count
 */
export function newestItems(items, joined, count = 6, hide = new Set()) {
  return items
    .filter(it => !hide.has(it.name))
    .map((item, i) => ({ item, at: joined[item.name], i }))
    .filter(x => x.at)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.i - b.i))
    .slice(0, count)
    .map(x => ({ ...x.item, joined: x.at }));
}

/** The Newest list's markup (it replaces what sits between the site:newest markers on the home page). */
export function newestHtml(newest, depth = 0) {
  if (!newest.length) return `<p class="note">${esc(W.newest.empty)}</p>`;
  const kind = it => { const k = KINDS[it.type].one; return k[0].toUpperCase() + k.slice(1); };
  return `<ul class="new-list" role="list">
        ${newest.map(it => `<li class="new-item">
          <h3 class="new-title"><a href="${up(depth)}${pathOf(it)}">${esc(it.title)}</a></h3>
          <p class="new-meta">${esc(W.newest.meta(kind(it), longDate(it.joined)))}</p>
          <p>${esc(trim(sentences(it.description, 120), 130))}</p>
        </li>`).join('\n        ')}
      </ul>`;
}
