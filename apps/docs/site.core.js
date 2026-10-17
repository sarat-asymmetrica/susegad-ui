// The site map's pure core: registry items and scene metas -> every generated
// page of the docs site, as HTML strings.
//
// No fs, no DOM, no fetch: apps/docs/pages.mjs reads the disk and writes the
// files; this module only decides what each page says and where it lives, so
// it is tested against fixtures (site.core.test.js).
//
// Where things live (out/docs, served at the root; Workers serves x.html at /x):
//   /                    index.html, the home page (hand-written, doors filled in here)
//   /scenes              scenes.html, the scenes by volume, as posters
//   /scenes/<name>       one scene: the drawing live, its words, its prompt folded away
//   /components, /recipes, /foundations   the other kinds, as posters
//   /<kind>/<name>       one piece: its docs, its prompt, its install line
//   /pencil-box          the techniques, each with the scenes that use it

import { trim } from './gallery.core.js';
import { posterPicture } from '../../packages/core/lazy.core.js';
import { W, inline } from './words.core.js';
import { tr, LANG_NAME, HOME_PATH } from './konkani.core.js';
import { accessibilitySection, headings } from './a11y.core.js';

export const KINDS = {
  scene: { key: 'scenes', title: 'Scenes', one: 'scene', blurb: 'Drawings that do a job: they hold your words, show something real, or answer the person using them. Each runs in <sg-scene>, comes in three registers and ships with the prompt that made it.' },
  component: { key: 'components', title: 'Components', one: 'component', blurb: 'Headless behaviour that is boringly correct, with one skin per register on top. Each has a live demo, its docs and its prompt.' },
  recipe: { key: 'recipes', title: 'Recipes', one: 'recipe', blurb: 'Components put together for a real piece of work: a booking, an enquiry, a proposal a client can open offline. Take one whole and change it.' },
  template: { key: 'templates', title: 'Templates', one: 'template', blurb: 'Whole starter sites, not pieces: one command makes the folder, with the pages written and the pieces they use copied beside them.' },
  package: { key: 'foundations', title: 'Foundations', one: 'foundation', blurb: 'What every piece stands on: the tokens, the engine, sound and narration, the type tier, the three.js tier and the kernels.' },
};
// A surface (decision 0016) is a drawn backdrop that components mount behind
// their own content; it lives with the foundations it stands on.
KINDS.surface = KINDS.package;

/** The top navigation, in order, for the site's three readers (front door 4): someone who wants a page, someone with an agent, an engineer. The brand is the way home; the other indexes are one click on, from /developers. */
export const NAV = [
  { key: 'showcase', label: W.audience.nav.showcase },
  { key: 'scenes', label: 'Scenes' },
  { key: 'start', label: W.audience.nav.start },
  { key: 'for-teams', label: W.audience.nav.teams },
  { key: 'developers', label: W.audience.nav.developers },
  { key: 'accessibility', label: 'Accessibility' },
];

export const REGISTERS = ['quiet', 'warm', 'playful'];
export const THEMES = ['light', 'dark'];

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A scene's registry name is scene-<name>; its page and its <sg-scene name> use <name>. */
export const slugOf = item => (item.type === 'scene' ? item.name.replace(/^scene-/, '') : item.type === 'template' ? item.name.replace(/^template-/, '') : item.name);

/** Root-relative path of an item's page, without .html (Workers serves x.html at /x). */
/** The command that takes a piece: add for a piece, create for a template (a whole site in an empty folder). */
export const installCommand = item => item.type === 'template' ? `npx @susegad/cli create my-site --template ${item.name.replace(/^template-/, '')}` : `npx @susegad/cli add ${item.name}`;

export const pathOf = item => `${KINDS[item.type].key}/${slugOf(item)}`;

/** Where the site lives; link previews need absolute URLs. */
export const SITE = 'https://susegad.asymmetrica.ai';

/** The default link-preview card (apps/docs/og.jpg, made by tools/readme-art.mjs). */
export const OG_DEFAULT = { src: 'og.jpg?v=2', w: 1200, h: 630, alt: 'Susegad UI: the title above a tiatr stage drawn in code, its curtain risen on a Goan church square, between a banyan and a tiled pool.' };

/**
 * The link preview (Open Graph and Twitter card) for a page at `path`
 * ('' for the home page), with `image` relative to the site root.
 */
export function social({ title, description, path = '', image = OG_DEFAULT }) {
  const url = `${SITE}/${path}`;
  const img = `${SITE}/${image.src}`;
  return [
    `<link rel="canonical" href="${esc(url)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Susegad UI">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta property="og:image:width" content="${image.w}">`,
    `<meta property="og:image:height" content="${image.h}">`,
    `<meta property="og:image:alt" content="${esc(image.alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ].map(l => `  ${l}`).join('\n');
}

/** An item's poster as a link-preview image, or the default card. */
export const posterImage = (item, poster) => poster
  ? { src: `posters/${item.name}.warm.light.jpg`, w: poster.w, h: poster.h, alt: item.title }
  : OG_DEFAULT;

/** The prefix from a page at `depth` folders down back to the site root. */
export const up = depth => '../'.repeat(depth);

export function roman(n) {
  const table = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

/**
 * The scenes in reading order, grouped: the sketchbook volumes first (their
 * plates numbered), then any group without numbers, then whatever scene is in
 * no group, so a new scene is never lost from the site.
 * @param {Array<{title: string, note?: string, ids: string[], plates?: boolean}>} volumes
 * @param {object[]} sceneItems registry items of type scene
 */
export function sceneGroups(volumes, sceneItems) {
  const bySlug = new Map(sceneItems.map(i => [slugOf(i), i]));
  const used = new Set();
  let plate = 0;
  const groups = volumes.map(v => ({
    title: v.title,
    note: v.note || '',
    items: v.ids.filter(id => bySlug.has(id) && !used.has(id)).map(id => {
      used.add(id);
      return { item: bySlug.get(id), plate: v.plates === false ? null : roman(++plate) };
    }),
  }));
  const rest = sceneItems.filter(i => !used.has(slugOf(i))).sort((a, b) => a.title.localeCompare(b.title));
  if (rest.length) groups.push({ title: 'More scenes', note: '', items: rest.map(item => ({ item, plate: null })) });
  return groups.filter(g => g.items.length);
}

/** The whole sentences of `text` that fit in about `max` characters (at least the first one, trimmed if it alone is longer). */
export function sentences(text, max) {
  // a sentence ends at . ! or ? followed by a space, so 0.186.1 or e.g. inside a word is not an end
  const all = String(text || '').trim().split(/(?<=[.!?])\s+/).map(x => `${x} `);
  let out = '';
  for (const s of all) {
    if (out && (out + s).trim().length > max) break;
    out += s;
  }
  out = out.trim();
  return out.length > max * 1.4 ? trim(out, max) : out;
}

/** Prev and next within an ordered list, as { prev, next } items or null at the ends. */
export function neighbours(list, i) {
  return { prev: i > 0 ? list[i - 1] : null, next: i < list.length - 1 ? list[i + 1] : null };
}

// ── the shell every page shares ─────────────────────────────────────

/** Where the Konkani pages a visitor can see live: the event template's, made at build time under /templates/event/site/. */
export const KONKANI = [
  { tag: 'gom-Deva', name: 'कोंकणी', href: 'templates/event/site/gom-deva/' },
  { tag: 'gom-Latn', name: 'Konknni', href: 'templates/event/site/gom-latn/' },
];

const optionRows = (name, rows) => rows.map(([value, label, hint]) => `
            <label class="view-opt"><input type="radio" name="${name}" value="${value}"><span class="view-opt-name">${esc(label)}</span>${hint ? `<span class="view-opt-hint">${esc(hint)}</span>` : ''}</label>`).join('');

/** The View control's words in `lang` (English when none). Konkani is the deck's draft; the no-script and storage lines stay English. */
export function viewStrings(lang) {
  if (!lang) return { ...W.view, registerNames: Object.fromEntries(REGISTERS.map(r => [r, W.view.registers[r][0]])), themeNames: W.view.themes };
  const registerNames = { quiet: tr(lang, 'view.quiet'), warm: tr(lang, 'view.warm'), playful: tr(lang, 'view.playful') };
  const themeNames = { auto: tr(lang, 'view.auto'), light: tr(lang, 'view.light'), dark: tr(lang, 'view.dark') };
  return {
    ...W.view,
    button: tr(lang, 'view.button'), title: tr(lang, 'view.title'), registerLegend: tr(lang, 'view.register'), registerIntro: tr(lang, 'view.intro'),
    registers: { quiet: [registerNames.quiet, tr(lang, 'view.quiet.hint')], warm: [registerNames.warm, tr(lang, 'view.warm.hint')], playful: [registerNames.playful, tr(lang, 'view.playful.hint')] },
    registerNames, themeNames, themes: themeNames, themeLegend: tr(lang, 'view.theme'), close: tr(lang, 'view.close'),
    langLegend: tr(lang, 'lang.label'), langDraft: tr(lang, 'draft.short'),
    name: (register, theme) => `${tr(lang, 'view.name')}: ${registerNames[register]}, ${themeNames[theme]}`,
  };
}

/** The language links of a page that has alternates: the page's own language is `aria-current`. Each language is named in its own script. */
export function altLinks(depth, current) {
  const u = up(depth);
  return ['en-IN', 'gom-Deva', 'gom-Latn'].map(tag => {
    const href = tag === current ? './' : (`${u}${HOME_PATH[tag]}` || './');
    return `<li><a href="${esc(href)}" hreflang="${tag}" lang="${tag}"${tag === current ? ' aria-current="page"' : ''}>${LANG_NAME[tag]}</a></li>`;
  }).join('\n                  ');
}

/**
 * The View control: one button in the header that opens our own sg-popover, holding the register, the theme
 * and (on a page that asks for it) the palette, and, on a page that has other languages, the language links.
 * Without JavaScript the panel says the settings need it; the pages read well without them.
 * @param {{ depth: number, palette?: boolean, lang?: string, alts?: string }} o
 *   `lang` is the page's Konkani language, if it is one; `alts` is the page's own language tag when the page has
 *   alternates (only then is the language group shown: a page with no Konkani twin offers none)
 */
export function viewControl({ depth, palette = false, lang, alts }) {
  const v = viewStrings(lang);
  const reg = optionRows('register', REGISTERS.map(r => [r, v.registers[r][0], v.registers[r][1]]));
  const theme = optionRows('theme', ['auto', 'light', 'dark'].map(t => [t, v.themes[t]]));
  const en = lang ? ' lang="en-IN"' : '';
  return `<sg-popover class="view">
        <button type="button" class="view-btn" id="view-btn" popovertarget="view-panel" aria-label="${esc(v.name('warm', 'auto'))}">${esc(v.button)}</button>
        <div id="view-panel" class="view-panel" popover aria-labelledby="view-title">
          <div class="view-head">
            <h2 id="view-title" class="view-title">${esc(v.title)}</h2>
            <button type="button" class="view-close" popovertarget="view-panel" popovertargetaction="hide">${esc(v.close)}</button>
          </div>
          <p class="view-nojs"${en}>${esc(W.view.nojs)}</p>
          <form class="prefs" id="prefs" aria-label="${esc(v.title)}">
            <fieldset class="view-group" data-pref="register">
              <legend>${esc(v.registerLegend)}</legend>
              <p class="view-intro">${esc(v.registerIntro)}</p>${reg}
            </fieldset>
            <fieldset class="view-group" data-pref="theme">
              <legend>${esc(v.themeLegend)}</legend>${theme}
            </fieldset>${palette ? `
            <fieldset class="view-group" data-pref="palette">
              <legend>${esc(v.paletteLegend)}</legend>${optionRows('palette', [['susegad', 'Susegad'], ['casa', 'Casa']])}
            </fieldset>` : ''}
          </form>
          <p class="view-store" id="view-store" role="status" hidden${en}>${esc(W.view.storageOff)}</p>${alts ? `
          <div class="view-group view-lang">
            <h3 class="view-legend" id="view-lang-h">${esc(v.langLegend)}</h3>
            <sg-lang>
              <nav aria-labelledby="view-lang-h">
                <ul>
                  ${altLinks(depth, alts)}
                </ul>
              </nav>
            </sg-lang>
            <p class="view-draft">${esc(v.langDraft)}</p>
          </div>` : ''}
        </div>
      </sg-popover>`;
}

/** The top navigation's links, `active` marked as the current page. On a Konkani page the words are Konkani and each link says the page it opens is English. */
export function navLinks(active, depth, lang) {
  // the indexes the nav does not name (components, recipes, foundations, the pencil box) are the developer's door
  const section = active && !NAV.some(n => n.key === active) && DEVELOPER_SECTIONS.has(active) ? 'developers' : null;
  return NAV.map(n => {
    const label = lang ? tr(lang, `nav.${n.key}`) : n.label;
    const current = n.key === active ? ' aria-current="page"' : n.key === section ? ' aria-current="true"' : '';
    return `<a href="${up(depth)}${n.key}"${lang ? ' hreflang="en"' : ''}${current}>${esc(label)}</a>`;
  }).join('\n        ');
}

/** The pages that sit behind /developers, so the nav marks Developers while one is open. */
export const DEVELOPER_SECTIONS = new Set(['components', 'recipes', 'templates', 'foundations', 'pencil-box', 'handoff', 'browsers']);

export function bar(active, depth, { path = '', palette = false, lang, alts } = {}) {
  const home = lang ? './' : (up(depth) || './');
  return `  <header class="bar">
    <div class="bar-in">
      <a class="brand" href="${home}" aria-label="${lang ? esc(tr(lang, 'brand')) : 'Susegad UI, home'}">Susegad <span>UI</span></a>
      <nav class="nav" aria-label="${lang ? esc(tr(lang, 'navLabel')) : 'Sections'}">
        ${navLinks(active, depth, lang)}
      </nav>
      <a class="bar-trust" href="${up(depth)}accessibility"${lang ? ' hreflang="en"' : ''}>${lang ? esc(tr(lang, 'nav.accessibility')) : esc(W.trust.nav)}</a>
      <a class="src" href="https://github.com/sarat-asymmetrica/susegad-ui" rel="noopener">GitHub <span aria-hidden="true">↗</span></a>
      ${viewControl({ depth, palette, lang, alts })}
    </div>
    <div class="toran" aria-hidden="true"></div>
  </header>`;
}

export function foot(depth) {
  return `  <footer class="foot wrap">
    <p class="sig">made by Claude with Sarat, Asymmetrica, Goa, 2026</p>
    <p class="for"><a href="${up(depth)}for-rafe">For Rafe</a>, who lent us his Activa and went fishing.</p>
    <p class="src-line">The code, the prompts and the drawings are open on <a href="https://github.com/sarat-asymmetrica/susegad-ui" rel="noopener">GitHub</a>. Take what you like.</p>
    <p class="foot-links"><a href="${up(depth)}accessibility">${esc(W.trust.foot)}</a> <span aria-hidden="true">·</span> <a href="${up(depth)}handoff">Handoff</a></p>
    <p>MIT licensed code; documentation under CC BY 4.0. This page makes no requests to anyone else's servers and keeps your settings only in your own browser.</p>
  </footer>`;
}

/** The other languages of a page that has them, in the head (decision 0025): each one, itself included, and x-default for a visitor whose language matches none. */
export const hreflangLinks = () => ['en-IN', 'gom-Deva', 'gom-Latn'].map(t => `  <link rel="alternate" hreflang="${t}" href="${SITE}/${HOME_PATH[t]}">`).concat(`  <link rel="alternate" hreflang="x-default" href="${SITE}/">`).join('\n');

/**
 * A whole page.
 * @param {{ title: string, description: string, depth: number, active?: string, main: string, scripts?: string[], after?: string }} p
 *   `scripts` are module paths relative to the site root.
 */
export function page({ title, description, depth, active = '', main, scripts = [], after = '', readyLater = false, path = '', image, palette = false, styles = [], lang, alts, footer }) {
  const u = up(depth);
  const docTitle = title === 'Susegad UI' ? title : `${title} · Susegad UI`;
  return `<!doctype html>
<html lang="${lang || 'en'}" data-register="warm" data-palette="susegad"${palette ? ' data-palette-choice' : ''}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(docTitle)}</title>
  <meta name="description" content="${esc(description)}">
${social({ title: docTitle, description, path, image })}${alts ? `
${hreflangLinks()}` : ''}
  <meta name="color-scheme" content="light dark">
  <script src="${u}prefs.js"></script>
  <link rel="stylesheet" href="${u}packages/tokens/fonts.css">
  <link rel="stylesheet" href="${u}packages/tokens/tokens.css">
  <link rel="stylesheet" href="${u}docs.css">
  <link rel="stylesheet" href="${u}site.css">
  <link rel="stylesheet" href="${u}door.css">
  <link rel="stylesheet" href="${u}audience.css">
  <link rel="stylesheet" href="${u}packages/components/popover/popover.css">
  <link rel="stylesheet" href="${u}packages/components/lang/lang.css">
${styles.map(s => `  <link rel="stylesheet" href="${u}${s}">
`).join('')}  <script type="module" src="${u}shell.js"></script>
${scripts.map(s => `  <script type="module" src="${u}${s}"></script>`).join('\n')}
</head>
<body${readyLater ? ' data-ready-later' : ''}>
  <a class="skip" href="#main">${lang ? esc(tr(lang, 'skip')) : 'Skip to main content'}</a>

${bar(active, depth, { path, palette, lang, alts })}

  <main class="wrap" id="main" tabindex="-1">
${main}
  </main>

${footer ?? foot(depth)}
${after}
  <p class="sr-only" id="announce" aria-live="polite"></p>
</body>
</html>
`;
}

// ── posters and cards ───────────────────────────────────────────────

/**
 * An <img> for an item's poster in the default register and theme; shell.js
 * swaps the file when the register or theme changes. Null if it has none.
 * @param {string} name registry name
 * @param {{ w: number, h: number } | undefined} poster
 */
export function posterImg(name, poster, depth, { alt = '', eager = false } = {}) {
  if (!poster) return '';
  const base = `${up(depth)}posters/${name}`;
  return posterPicture({ stem: `${base}.warm.light`, alt, width: poster.w, height: poster.h, eager, cls: 'poster', data: `data-poster="${base}"` });
}

/** One card on an index page: poster, title (the link), a line. */
export function card(item, { depth, poster, plate = null, line, level = 3 }) {
  const text = line ?? trim(item.description, 120);
  const search = `${item.title} ${item.name} ${item.description}`.toLowerCase();
  return `<li class="s-card${poster ? '' : ' s-card-plain'}" data-search="${esc(search)}">
          ${poster ? `<div class="s-poster">${posterImg(item.name, poster, depth)}</div>` : ''}
          ${plate ? `<p class="s-card-no">Plate ${plate}</p>` : ''}
          <h${level} class="s-card-title"><a href="${up(depth)}${pathOf(item)}">${esc(item.title)}</a></h${level}>
          <p class="s-card-line">${esc(text)}</p>
        </li>`;
}

const searchBox = (kind, count) => `
    <div class="s-tools">
      <label class="g-search"><span>Search</span>
        <input type="search" id="s-q" placeholder="a name, or a word from what it does" autocomplete="off" data-kind="${esc(kind)}">
      </label>
      <p class="g-count" id="s-count" role="status">${count} ${count === 1 ? 'piece' : 'pieces'}</p>
    </div>`;

export const head = (kicker, title, lede, extra = '') => `    <section class="s-head" aria-labelledby="s-title">
      <p class="kicker">${esc(kicker)}</p>
      <h1 id="s-title" class="s-title">${esc(title)}</h1>
      <p class="lede">${esc(lede)}</p>${extra}
    </section>`;

/**
 * An index page for one kind. Scenes come grouped (see sceneGroups); other
 * kinds come as one alphabetical grid with a search box.
 */
export function indexPage(type, { items, groups, posters, lines = {}, extra = '', scripts = [], styles = [] }) {
  const k = KINDS[type];
  const depth = 0;
  let body;
  if (groups) {
    body = groups.map((g, i) => `    <section class="s-group" aria-labelledby="s-g${i}">
      <h2 class="s-group-title" id="s-g${i}">${esc(g.title)}${g.note ? ` <span class="s-group-note">${esc(g.note)}</span>` : ''}</h2>
      <ul class="s-grid" role="list">
        ${g.items.map(({ item, plate }) => card(item, { depth, poster: posters[item.name], plate, line: lines[item.name] })).join('\n        ')}
      </ul>
    </section>`).join('\n');
  } else {
    const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));
    body = `    <ul class="s-grid" role="list" id="s-list">
        ${sorted.map(item => card(item, { depth, poster: posters[item.name], line: lines[item.name], level: 2 })).join('\n        ')}
      </ul>
    <p class="g-empty" id="s-none" hidden>Nothing here matches. Try a shorter word.</p>`;
  }
  const count = groups ? groups.reduce((n, g) => n + g.items.length, 0) : items.length;
  return page({
    title: k.title,
    description: k.blurb,
    depth,
    path: k.key,
    active: k.key,
    main: `${head(`${count} ${count === 1 ? k.one : k.key}`, k.title, k.blurb, groups || type === 'template' ? '' : searchBox(type, count))}
${body}${extra}`,
    scripts: groups ? [] : [...(type === 'template' ? [] : ['index-page.js']), ...scripts],
    styles,
  });
}

// ── one piece's page ────────────────────────────────────────────────

const prevNext = (list, i, depth, label) => {
  const { prev, next } = neighbours(list, i);
  if (!prev && !next) return '';
  const a = (it, rel, word) => `<a class="pn-${rel}" href="${up(depth)}${pathOf(it)}" rel="${rel}"><span class="pn-word">${word}</span> <span class="pn-title">${esc(it.title)}</span></a>`;
  return `    <nav class="pn" aria-label="${esc(label)}">
      ${prev ? a(prev, 'prev', 'Previous') : '<span></span>'}
      ${next ? a(next, 'next', 'Next') : '<span></span>'}
    </nav>`;
};

const crumbs = (k, extra, depth) => `<p class="crumbs"><a href="${up(depth)}${k.key}">${esc(k.title)}</a>${extra ? ` <span aria-hidden="true">/</span> ${esc(extra)}` : ''}</p>`;

/** The inland letter: a prompt someone can copy. `html` is already safe markup. */
export const letter = (id, html, open = false) => `<details class="fold"${open ? ' open' : ''} id="${esc(id)}">
        <summary>The prompt</summary>
        <div class="letter">
          <div class="letter-head"><h2 class="letter-title">the prompt</h2><button class="copy" type="button" data-copy="${esc(id)}-text">Copy</button></div>
          <div class="letter-body" id="${esc(id)}-text">${html}</div>
        </div>
      </details>`;

/** Where the built site is served, for the snippets an embedder copies. */
export const SITE_URL = SITE;

/**
 * The use-this-scene box: the three lines another site needs, copyable with
 * the shell's button.copy. The stylesheet brings the tokens the scene's
 * colours and type stand on; the module script registers the scene (its own
 * relative imports resolve against our origin, so this is the only line that
 * names us); the tag draws it.
 */
export function sceneUseBox(item) {
  const name = slugOf(item);
  const code = `<link rel="stylesheet" href="${SITE_URL}/packages/tokens/tokens.css">
<script type="module" src="${SITE_URL}/packages/scenes/${name}/index.js"></script>
<sg-scene name="${name}" register="warm"></sg-scene>`;
  return `<div class="scene-use">
        <h2 class="use-title">Use this scene</h2>
        <p class="use-note">Copy these three lines into your page. The scene draws itself, and rests when it leaves the screen.</p>
        <pre class="use-code" id="use-${esc(name)}-text" tabindex="0" role="region" aria-label="Snippet to copy"><code>${esc(code)}</code></pre>
        <button class="copy" type="button" data-copy="use-${esc(name)}-text">Copy</button>
      </div>`;
}

/**
 * A scene's page. The words are all here as HTML (they read without
 * JavaScript); scene-page.js puts the live drawing into the stage.
 * @param {object} item registry item
 * @param {object} meta the scene's meta.js
 * @param {{ list: object[], index: number, plate: string|null, group: string, poster?: {w,h}, extras: Array<{href: string, title: string}>, demo: string|null, techniqueName: (id: string) => string }} ctx
 */
export function scenePage(item, meta, ctx) {
  const depth = 1;
  const name = slugOf(item);
  const k = KINDS.scene;
  const map = (meta.map || []).map(e => (Array.isArray(e) ? e : [e.phrase ?? e.words, e.technique ?? e.tech, e.why ?? e.note]));
  const ar = meta.W && meta.H ? `${meta.W} / ${meta.H}` : '3 / 2';
  const u = up(depth);
  const main = `    <article class="scene-page" aria-labelledby="scene-title">
      <div class="scene-art">
        <div class="scene-mount" style="aspect-ratio: ${ar}">
          <sg-lazy src="${u}packages/scenes/${esc(name)}/index.js" style="aspect-ratio: ${ar}; --ar: ${ar}">
            ${posterImg(item.name, ctx.poster, depth, { alt: meta.alt || meta.title, eager: true })}
            <sg-scene class="stage" name="${esc(name)}" seed="1" label="${esc(meta.alt || meta.title)}" style="aspect-ratio: ${ar}" hidden></sg-scene>
          </sg-lazy>
        </div>
        <div class="controls">
          <button class="btn is-off" type="button" data-act="pause">Play</button>
          <button class="btn is-off" type="button" data-act="closer" aria-haspopup="dialog" aria-describedby="scene-title">Look closer</button>
          <button class="btn is-off" type="button" data-act="replay">Replay</button>
          <button class="btn is-off" type="button" data-act="reseed">New seed</button>
          <span class="live" aria-hidden="true"></span>
        </div>
      </div>
      <div class="scene-text">
        ${crumbs(k, ctx.group, depth)}
        ${ctx.plate ? `<p class="plate-no">Plate ${ctx.plate}</p>` : ''}
        <h1 id="scene-title" class="plate-title">${esc(meta.title || item.title)}</h1>
        ${meta.word || meta.gloss ? `<p class="word">${meta.word ? `<b>${esc(meta.word)}</b>` : ''}${meta.gloss ? `${meta.word ? ' · ' : ''}${esc(meta.gloss)}` : ''}</p>` : ''}
        ${meta.caption ? `<p class="caption">${esc(meta.caption)}</p>` : ''}
        ${meta.after ? `<p class="after"><b>After </b>${esc(meta.after.who)}. Taken: ${esc(meta.after.took)}. Left: ${esc(meta.after.left)}.</p>` : ''}
        ${meta.credit ? `<p class="credit">${esc(meta.credit)}</p>` : ''}
        ${(meta.techniques || []).length ? `<ul class="tags" aria-label="Techniques">${meta.techniques.map(t => `<li><a href="${u}pencil-box#t-${esc(t)}">${esc(ctx.techniqueName(t))}</a></li>`).join('')}</ul>` : ''}
        ${meta.prompt ? letter('prompt', `<p>${esc(meta.prompt)}</p>`) : ''}
        ${map.length ? `<details class="fold" id="map">
        <summary>How the words become code</summary>
        <dl class="map">${map.map(([phrase, tech, why]) => `<dt>${esc(phrase)}</dt><dd>${tech ? `<span class="term">${esc(ctx.techniqueName(tech))}</span>` : ''}${esc(why)}</dd>`).join('')}</dl>
      </details>` : ''}
        ${ctx.extras.length || ctx.demo ? `<div class="scene-more">
          <h2 class="more-title">More of it</h2>
          <ul>${ctx.demo ? `<li><a href="${esc(ctx.demo)}">Its demo page: every register and param</a></li>` : ''}${ctx.extras.map(x => `<li><a href="${esc(x.href)}">${esc(x.title)}</a></li>`).join('')}</ul>
        </div>` : ''}
        ${sceneUseBox(item)}
        <p class="install"><code>npx @susegad/cli add ${esc(item.name)}</code> <button class="copy" type="button" data-copy-text="npx @susegad/cli add ${esc(item.name)}">Copy</button></p>
      </div>
    </article>
${prevNext(ctx.list, ctx.index, depth, 'More scenes')}`;
  return page({
    title: meta.title || item.title,
    description: trim(item.description, 160),
    depth,
    path: pathOf(item),
    image: posterImage(item, ctx.poster),
    active: k.key,
    main,
    scripts: ['scene-page.js'],
    readyLater: true,
    after: `
  <dialog class="closer" id="closer" aria-labelledby="closer-title">
    <div class="closer-head">
      <h2 id="closer-title"></h2>
      <p class="word" id="closer-word"></p>
      <button class="btn" type="button" id="closer-close" autofocus>Close</button>
    </div>
    <div class="closer-slot" id="closer-slot"></div>
  </dialog>`,
  });
}

/**
 * A component's, recipe's or foundation's page.
 * @param {object} item registry item
 * @param {{ list: object[], index: number, poster?: {w,h}, demo: string|null, docsHtml: string, promptHtml: string, deps: object[] }} ctx
 *   docsHtml and promptHtml are rendered, safe markup (Folio Markdown escapes its text).
 */
export function itemPage(item, ctx) {
  const depth = 1;
  const k = KINDS[item.type];
  const u = up(depth);
  const facts = [
    item.stability && item.stability !== 'experimental' ? `<span class="fact">${esc(item.stability)}</span>` : '',
    ...(item.registers || []).map(r => `<span class="fact fact-reg">${esc(r)}</span>`),
    ...(item.useFor || []).length ? [`<span class="fact">for ${esc(item.useFor.join(', '))}</span>`] : [],
  ].filter(Boolean).join(' ');
  const deps = ctx.deps.length
    ? `<p class="deps"><b>Stands on:</b> ${ctx.deps.map(d => `<a href="${u}${pathOf(d)}">${esc(d.title)}</a>`).join(', ')}</p>`
    : '';
  const a11y = accessibilitySection(ctx.docsHtml || '', { tables: ctx.a11yTables ?? 0, depth });
  const docs = a11y.html;
  const toc = [...(ctx.promptHtml ? [{ id: 'prompt', text: W.item.prompt }] : []), ...headings(docs)];
  const demoWord = item.type === 'template' ? W.item.demoTemplate : W.item.demo;
  const main = `    <article class="item-page" aria-labelledby="item-title">
      <div class="item-grid">
        <header class="item-head">
          ${crumbs(k, '', depth)}
          <h1 id="item-title" class="item-title">${esc(item.title)}</h1>
          <p class="lede">${esc(sentences(item.description, 320))}</p>
          ${facts ? `<p class="facts">${facts}</p>` : ''}
          <p class="item-actions">${ctx.demo ? `<a class="btn btn-solid" href="${esc(ctx.demo)}">${esc(demoWord)}</a>` : ''}
            <span class="install"><code>${esc(installCommand(item))}</code> <button class="copy" type="button" data-copy-text="${esc(installCommand(item))}">Copy</button></span></p>
          ${deps}
        </header>
        <aside class="item-side" aria-label="${esc(item.title)}, at a glance">
          <div class="item-side-in">
            ${ctx.poster ? `<a class="item-poster" href="${esc(ctx.demo || '#')}" tabindex="-1" aria-hidden="true">${posterImg(item.name, ctx.poster, depth, { eager: true })}</a>` : ''}
            ${tocNavHtml(toc)}
          </div>
        </aside>
        <div class="item-body">
          ${ctx.promptHtml ? letter('prompt', ctx.promptHtml) : ''}
          ${docs ? `<div class="item-docs prose">${docs}</div>` : `<p class="note">This piece has no written docs yet. Its demo and its source are the reference for now.</p>`}
        </div>
      </div>
    </article>
${prevNext(ctx.list, ctx.index, depth, `More ${k.key}`)}`;
  return page({ title: item.title, description: trim(item.description, 160), depth, active: k.key, main, path: pathOf(item), image: posterImage(item, ctx.poster) });
}

/** An "On this page" list: links to the ids on the page (none when there is nothing to jump between). */
export const tocNavHtml = items => items.length < 2 ? '' : `<nav class="toc" aria-labelledby="toc-title">
              <h2 class="toc-title" id="toc-title">${esc(W.item.tocTitle)}</h2>
              <ul>${items.map(i => `<li><a href="#${esc(i.id)}">${esc(i.text)}</a></li>`).join('')}</ul>
            </nav>`;

// ── the pencil box ──────────────────────────────────────────────────

/**
 * @param {Record<string, [string, string]>} techniques id -> [name, description]
 * @param {Array<{ item: object, meta: object }>} scenes
 */
export function pencilBoxPage(techniques, scenes) {
  const depth = 0;
  const usedBy = {};
  for (const { item, meta } of scenes) for (const t of meta.techniques || []) (usedBy[t] ||= []).push({ item, meta });
  const rows = Object.entries(techniques).map(([id, [name, desc]]) => {
    const users = usedBy[id] || [];
    return `<div class="tool" id="t-${esc(id)}"><dt>${esc(name)}</dt><dd>${esc(desc)}${users.length
      ? ` <span class="used">in ${users.map(({ item, meta }) => `<a href="${pathOf(item)}">${esc(meta.word || meta.title)}</a>`).join(', ')}</span>` : ''}</dd></div>`;
  }).join('\n      ');
  return page({
    title: 'The pencil box',
    path: 'pencil-box',
    description: 'A handful of techniques do nearly all the work in Susegad UI. Each is listed with the scenes that use it.',
    depth,
    active: 'pencil-box',
    main: `${head(`${Object.keys(techniques).length} techniques`, 'The pencil box', 'A handful of techniques do nearly all the work. Every scene lists the ones it uses, and each one here lists the scenes it is in.')}
    <dl class="tools" id="tools">
      ${rows}
    </dl>`,
  });
}

// ── the home page's doors ───────────────────────────────────────────

/**
 * The doors into each kind, for the home page: one signature picture each, big enough to read as a picture, a title
 * that is the link, the count, and a line. `art` names the poster each door shows (a scene's own still, or a
 * signature the poster step took); a door whose picture is missing shows its words alone.
 * @param {Array<{ type: string, count: number }>} doors
 * @param {Record<string, {w: number, h: number}>} posters
 * @param {{ art: Record<string, string>, toy?: boolean }} o
 */
export function homeDoors(doors, posters, techniqueCount, { art = {}, toy = true, pencil = true } = {}) {
  const line = { scene: W.inside.scenes, component: W.inside.components, recipe: W.inside.recipes, package: W.inside.foundations };
  const door = d => {
    const k = KINDS[d.type];
    const pic = art[d.type];
    const has = pic && posters[pic];
    return `<li class="door door-${d.type}">
          <div class="door-art${has ? '' : ' door-art-plain'}" aria-hidden="true">${has ? posterImg(pic, posters[pic], 0) : ''}</div>
          <h3 class="door-title"><a href="${k.key}">${esc(k.title)}</a> <span class="door-count">${d.count}</span></h3>
          <p class="door-line">${esc(line[d.type] ?? sentences(k.blurb, 90))}</p>${d.type === 'package' && toy ? `
          <p class="door-toy"><a href="templates#bloom">${esc(W.inside.toy)}</a></p>` : ''}
        </li>`;
  };
  return `<ul class="doors" role="list">
        ${doors.map(door).join('\n        ')}${pencil ? `
        <li class="door door-small">
          <div class="door-art door-art-plain" aria-hidden="true"></div>
          <h3 class="door-title"><a href="pencil-box">The pencil box</a> <span class="door-count">${techniqueCount}</span></h3>
          <p class="door-line">The handful of techniques that do nearly all the work, each with the scenes that use it.</p>
        </li>` : ''}
      </ul>`;
}

export { redirectFor } from './redirect.core.js';
