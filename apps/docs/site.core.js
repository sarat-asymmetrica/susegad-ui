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

export const KINDS = {
  scene: { key: 'scenes', title: 'Scenes', one: 'scene', blurb: 'Drawings that do a job: they hold your words, show something real, or answer the person using them. Each runs in <sg-scene>, comes in three registers and ships with the prompt that made it.' },
  component: { key: 'components', title: 'Components', one: 'component', blurb: 'Headless behaviour that is boringly correct, with one skin per register on top. Each has a live demo, its docs and its prompt.' },
  recipe: { key: 'recipes', title: 'Recipes', one: 'recipe', blurb: 'Components put together for a real piece of work: a booking, an enquiry, a proposal a client can open offline. Take one whole and change it.' },
  package: { key: 'foundations', title: 'Foundations', one: 'foundation', blurb: 'What every piece stands on: the tokens, the engine, sound and narration, the type tier, the three.js tier and the kernels.' },
};
// A surface (decision 0016) is a drawn backdrop that components mount behind
// their own content; it lives with the foundations it stands on.
KINDS.surface = KINDS.package;

/** The top navigation, in order. The brand is the way home. */
export const NAV = [
  { key: 'scenes', label: 'Scenes' },
  { key: 'components', label: 'Components' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'foundations', label: 'Foundations' },
  { key: 'pencil-box', label: 'Pencil box' },
];

export const REGISTERS = ['quiet', 'warm', 'playful'];
export const THEMES = ['light', 'dark'];

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A scene's registry name is scene-<name>; its page and its <sg-scene name> use <name>. */
export const slugOf = item => (item.type === 'scene' ? item.name.replace(/^scene-/, '') : item.name);

/** Root-relative path of an item's page, without .html (Workers serves x.html at /x). */
export const pathOf = item => `${KINDS[item.type].key}/${slugOf(item)}`;

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

const PREFS = `
      <form class="prefs" id="prefs" aria-label="How this page looks">
        <fieldset class="seg seg-register" data-pref="register">
          <legend>Register</legend>
          <div class="seg-row">
            <label><input type="radio" name="register" value="quiet"><span>Quiet</span></label>
            <label><input type="radio" name="register" value="warm"><span>Warm</span></label>
            <label><input type="radio" name="register" value="playful"><span>Playful</span></label>
          </div>
        </fieldset>
        <fieldset class="seg" data-pref="theme">
          <legend>Theme</legend>
          <div class="seg-row">
            <label><input type="radio" name="theme" value="auto"><span>Auto</span></label>
            <label><input type="radio" name="theme" value="light"><span>Light</span></label>
            <label><input type="radio" name="theme" value="dark"><span>Dark</span></label>
          </div>
        </fieldset>
        <fieldset class="seg" data-pref="palette">
          <legend>Palette</legend>
          <div class="seg-row">
            <label><input type="radio" name="palette" value="susegad"><span>Susegad</span></label>
            <label><input type="radio" name="palette" value="casa"><span>Casa</span></label>
          </div>
        </fieldset>
      </form>`;

/** The top navigation's links, `active` marked as the current page. */
export function navLinks(active, depth) {
  return NAV.map(n => `<a href="${up(depth)}${n.key}"${n.key === active ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('\n        ');
}

export function bar(active, depth) {
  return `  <header class="bar">
    <div class="bar-in">
      <a class="brand" href="${up(depth) || './'}" aria-label="Susegad UI, home">Susegad <span>UI</span></a>
      <nav class="nav" aria-label="Sections">
        ${navLinks(active, depth)}
      </nav>
      <a class="src" href="https://github.com/sarat-asymmetrica/susegad-ui" rel="noopener">GitHub <span aria-hidden="true">↗</span></a>${PREFS}
    </div>
    <div class="toran" aria-hidden="true"></div>
  </header>`;
}

export function foot(depth) {
  return `  <footer class="foot wrap">
    <p class="sig">made by Claude with Sarat, Asymmetrica, Goa, 2026</p>
    <p class="for"><a href="${up(depth)}for-rafe">For Rafe</a>, who lent us his Activa and went fishing.</p>
    <p class="src-line">The code, the prompts and the drawings are open on <a href="https://github.com/sarat-asymmetrica/susegad-ui" rel="noopener">GitHub</a>. Take what you like.</p>
    <p>MIT licensed code; documentation under CC BY 4.0. This page makes no requests to anyone else's servers and keeps your settings only in your own browser.</p>
  </footer>`;
}

/**
 * A whole page.
 * @param {{ title: string, description: string, depth: number, active?: string, main: string, scripts?: string[], after?: string }} p
 *   `scripts` are module paths relative to the site root.
 */
export function page({ title, description, depth, active = '', main, scripts = [], after = '', readyLater = false }) {
  const u = up(depth);
  return `<!doctype html>
<html lang="en" data-register="warm" data-palette="susegad">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} · Susegad UI</title>
  <meta name="description" content="${esc(description)}">
  <meta name="color-scheme" content="light dark">
  <script src="${u}prefs.js"></script>
  <link rel="stylesheet" href="${u}packages/tokens/fonts.css">
  <link rel="stylesheet" href="${u}packages/tokens/tokens.css">
  <link rel="stylesheet" href="${u}docs.css">
  <link rel="stylesheet" href="${u}site.css">
  <script type="module" src="${u}shell.js"></script>
${scripts.map(s => `  <script type="module" src="${u}${s}"></script>`).join('\n')}
</head>
<body${readyLater ? ' data-ready-later' : ''}>
  <a class="skip" href="#main">Skip to main content</a>

${bar(active, depth)}

  <main class="wrap" id="main" tabindex="-1">
${main}
  </main>

${foot(depth)}
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
  return `<img class="poster" src="${base}.warm.light.jpg" data-poster="${base}" width="${poster.w}" height="${poster.h}" alt="${esc(alt)}"${eager ? '' : ' loading="lazy"'} decoding="async">`;
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

const head = (kicker, title, lede, extra = '') => `    <section class="s-head" aria-labelledby="s-title">
      <p class="kicker">${esc(kicker)}</p>
      <h1 id="s-title" class="s-title">${esc(title)}</h1>
      <p class="lede">${esc(lede)}</p>${extra}
    </section>`;

/**
 * An index page for one kind. Scenes come grouped (see sceneGroups); other
 * kinds come as one alphabetical grid with a search box.
 */
export function indexPage(type, { items, groups, posters, lines = {} }) {
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
    active: k.key,
    main: `${head(`${count} ${count === 1 ? k.one : k.key}`, k.title, k.blurb, groups ? '' : searchBox(type, count))}
${body}`,
    scripts: groups ? [] : ['index-page.js'],
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
          <sg-scene class="stage" name="${esc(name)}" seed="1" label="${esc(meta.alt || meta.title)}" style="aspect-ratio: ${ar}"></sg-scene>
          ${posterImg(item.name, ctx.poster, depth, { alt: meta.alt || meta.title, eager: true }).replace('class="poster"', 'class="poster scene-still"')}
        </div>
        <div class="controls" hidden>
          <button class="btn" type="button" data-act="replay">Replay</button>
          <button class="btn" type="button" data-act="reseed">New seed</button>
          <button class="btn" type="button" data-act="pause">Pause</button>
          <button class="btn" type="button" data-act="closer" aria-haspopup="dialog" aria-describedby="scene-title">Look closer</button>
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
        <p class="install"><code>npx susegad add ${esc(item.name)}</code> <button class="copy" type="button" data-copy-text="npx susegad add ${esc(item.name)}">Copy</button></p>
      </div>
    </article>
${prevNext(ctx.list, ctx.index, depth, 'More scenes')}`;
  return page({
    title: meta.title || item.title,
    description: trim(item.description, 160),
    depth,
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
  const main = `    <article class="item-page" aria-labelledby="item-title">
      <header class="item-head">
        <div class="item-intro">
          ${crumbs(k, '', depth)}
          <h1 id="item-title" class="item-title">${esc(item.title)}</h1>
          <p class="lede">${esc(sentences(item.description, 320))}</p>
          ${facts ? `<p class="facts">${facts}</p>` : ''}
          <p class="item-actions">${ctx.demo ? `<a class="btn btn-solid" href="${esc(ctx.demo)}">Open the live demo</a>` : ''}
            <span class="install"><code>npx susegad add ${esc(item.name)}</code> <button class="copy" type="button" data-copy-text="npx susegad add ${esc(item.name)}">Copy</button></span></p>
          ${deps}
        </div>
        ${ctx.poster ? `<a class="item-poster" href="${esc(ctx.demo || '#')}" tabindex="-1" aria-hidden="true">${posterImg(item.name, ctx.poster, depth, { eager: true })}</a>` : ''}
      </header>
      ${ctx.promptHtml ? letter('prompt', ctx.promptHtml) : ''}
      ${ctx.docsHtml ? `<div class="item-docs prose">${ctx.docsHtml}</div>` : `<p class="note">This piece has no written docs yet. Its demo and its source are the reference for now.</p>`}
    </article>
${prevNext(ctx.list, ctx.index, depth, `More ${k.key}`)}`;
  return page({ title: item.title, description: trim(item.description, 160), depth, active: k.key, main });
}

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
 * The doors into each kind, for the home page. `samples` are a few items of
 * the kind whose posters show on the door.
 * @param {Array<{ type: string, count: number, samples: object[] }>} doors
 */
export function homeDoors(doors, posters, techniqueCount) {
  const door = d => {
    const k = KINDS[d.type];
    const imgs = d.samples.filter(s => posters[s.name]).slice(0, 3);
    return `<li class="door">
          <div class="door-art${imgs.length ? '' : ' door-art-plain'}" aria-hidden="true">${imgs.map(s => posterImg(s.name, posters[s.name], 0)).join('')}</div>
          <h3 class="door-title"><a href="${k.key}">${esc(k.title)}</a> <span class="door-count">${d.count}</span></h3>
          <p class="door-line">${esc(sentences(k.blurb, 90))}</p>
        </li>`;
  };
  return `<ul class="doors" role="list">
        ${doors.map(door).join('\n        ')}
        <li class="door door-small">
          <div class="door-art door-art-plain" aria-hidden="true"></div>
          <h3 class="door-title"><a href="pencil-box">The pencil box</a> <span class="door-count">${techniqueCount}</span></h3>
          <p class="door-line">The handful of techniques that do nearly all the work, each with the scenes that use it.</p>
        </li>
      </ul>`;
}

/** Old home-page anchors -> where that thing lives now (index.html's redirect script uses the same rule). */
export function redirectFor(hash, sceneSlugs) {
  const h = decodeURIComponent(String(hash || '').replace(/^#/, ''));
  if (!h) return null;
  if (sceneSlugs.includes(h)) return `scenes/${h}`;
  if (h === 'pencil-box') return 'pencil-box';
  if (h === 'scenes') return 'scenes';
  if (h.startsWith('t-')) return `pencil-box#${h}`;
  const m = /^(.+)-(prompt|map)$/.exec(h);
  if (m && sceneSlugs.includes(m[1])) return `scenes/${m[1]}#${m[2]}`;
  return null;
}
