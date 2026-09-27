// The Components gallery page: renders every registry item as a card, with a
// live preview where one is cheap, and wires the register/theme/palette
// switches and the search box.
//
// Library code is imported by relative path from the repo tree
// (../../packages/...). build.mjs rewrites that prefix for the built copy, so
// keep every package path in that form.

import { gallery } from './components.data.js';
import { filterGallery } from './gallery.core.js';

const STRINGS = {
  count: n => `${n} item${n === 1 ? '' : 's'} shown`,
  none: 'Nothing matches that search.',
  seeIt: 'See it',
  docs: 'Docs',
  prompt: 'Prompt',
  waiting: 'loading the preview…',
  noPreview: 'no live preview here; too heavy for a small stage',
  registerAnnounce: r => `Register set to ${r}`,
};

const root = document.documentElement;
const announce = text => { const el = document.getElementById('announce'); el.textContent = ''; requestAnimationFrame(() => (el.textContent = text)); };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k.includes('-') || k === 'role') el.setAttribute(k, v);
    else el[k] = v;
  }
  kids.flat(Infinity).forEach(k => k != null && k !== false && el.append(k));
  return el;
};

// ── the switches: register and theme are already in the page; the palette
// list comes from the tokens, never hard-coded, so a renamed or added
// palette shows up here without touching this file ─────────────────────
const prefs = window.sgDocsPrefs;
const form = document.getElementById('prefs');
const paletteRow = document.getElementById('palette-row');

async function wirePalette() {
  if (!paletteRow) return;
  let names = ['susegad'];
  try {
    const mod = await import('../../packages/tokens/tokens.js');
    if (mod.palettes) names = Object.keys(mod.palettes);
  } catch { /* tokens not reachable: keep the one safe default */ }
  const label = n => n.charAt(0).toUpperCase() + n.slice(1);
  paletteRow.replaceChildren(...names.map(name =>
    h('label', {}, h('input', { type: 'radio', name: 'palette', value: name }), h('span', { textContent: label(name) }))));

  // A shared link's ?palette= wins once it is known to be a real palette
  // (register and theme are handled before first paint in components.html,
  // since those two are a fixed enum prefs.js already knows; a palette name
  // is only known once the tokens have answered, here). A click, not just a
  // checked radio, so it goes through prefs.apply and prefs.save like any
  // other change and the previews pick it up too.
  const urlPalette = new URLSearchParams(location.search).get('palette');
  const wanted = (urlPalette && names.includes(urlPalette)) ? urlPalette : prefs?.current?.palette;
  const input = wanted && paletteRow.querySelector(`input[value="${wanted}"]`);
  if (input) input.click();
  else paletteRow.querySelector('input')?.click();
}

if (prefs && form) {
  for (const [key, value] of Object.entries(prefs.current)) {
    if (key === 'palette') continue; // filled once wirePalette() knows the real names
    const input = form.querySelector(`input[name="${key}"][value="${value}"]`);
    if (input) input.checked = true;
  }
  form.addEventListener('change', e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !prefs.ALLOWED[input.name]) return;
    prefs.current = { ...prefs.current, [input.name]: input.value };
    prefs.apply(prefs.current);
    prefs.save(prefs.current);
    if (input.name === 'register') announce(STRINGS.registerAnnounce(input.value));
    syncPreviews();
  });
  form.addEventListener('submit', e => e.preventDefault());
}

// ── previewing: a small stage per card, loaded only when it is on screen,
// and capped so at most a few live pieces run at once ───────────────────
const MAX_LIVE = 2;
// A batch of cards that are all visible the moment the page paints (a wide
// grid shows several in the first screenful) would otherwise start mounting
// in the same tick: several iframes each pulling a dozen files at once, all
// hitting the one small dev server together. A short stagger between starts
// keeps first paint instant while smoothing that burst out.
const MOUNT_STAGGER_MS = 120;
const live = new Set(); // stage elements currently holding an iframe or <sg-scene>
let hasCore = null; // null = not checked yet; a promise once it is

function effectiveTheme() {
  const t = root.getAttribute('data-theme');
  if (t === 'light' || t === 'dark') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function previewQuery() {
  const p = new URLSearchParams();
  p.set('register', root.getAttribute('data-register') || 'warm');
  p.set('theme', effectiveTheme());
  const palette = root.getAttribute('data-palette');
  if (palette) p.set('palette', palette);
  return p.toString();
}

async function loadSceneCore() {
  hasCore ??= (async () => {
    try { await import('../../packages/core/index.js'); return true; }
    catch { return false; }
  })();
  return hasCore;
}

// MAX_LIVE caps how many previews may be *loading* at once, not how many stay
// mounted. A mounted preview is never torn down again: pulling its iframe or
// <sg-scene> out of the DOM mid-load cancels its own in-flight requests, which
// the browser reports as a failed request for no real problem. Each demo
// already pauses its own motion off screen (packages/core/component.js's
// shared IntersectionObserver), so a settled preview costs nothing to keep.
let loading = 0;
const queue = [];
const settle = () => { loading = Math.max(0, loading - 1); pump(); };

// A demo page opens with its own <h1> and, most of the time, an intro
// paragraph, the same words the card already shows underneath, then the
// actual examples. Zooming the iframe out a little and scrolling it past its
// own heading spends the small stage on the live element instead of a
// second copy of the title.
//
// Every demo shares the same shape (<main><h1>…</h1><p>…</p>…examples…),
// but not the same markup for "examples": a heading, a form, a fieldset, a
// section, a div, whatever the piece needed. So this walks main's own
// children rather than guessing a selector for "the first example": skip
// the <h1> and every <p> straight after it (however many there are, classed
// "lede" or not), and land at the top of whatever comes next. That element
// is always a clean edge, never a scrap of the section before it, because
// nothing before it is skipped by halves.
const STAGE_SCALE = 0.62;
function scrollPastHeading(iframe) {
  try {
    const main = iframe.contentDocument?.querySelector('main');
    const h1 = main?.querySelector(':scope > h1');
    if (!h1) return;
    // The bottom edge is the furthest any skipped element reaches, not just the
    // last one's own: a status paragraph right after the lede (stepper's #sent,
    // empty and display: none until a step is sent) has a zero box of its own,
    // and taking only its edge collapsed the scroll back to the very top.
    let last = h1, bottom = h1.offsetTop + h1.offsetHeight;
    while (last.nextElementSibling?.tagName === 'P') {
      last = last.nextElementSibling;
      bottom = Math.max(bottom, last.offsetTop + last.offsetHeight);
    }
    iframe.contentWindow.scrollTo(0, Math.max(0, bottom));
  } catch { /* a demo that redirects cross-origin would throw here; leave it at the top */ }
}

function mountIframe(stage, url) {
  loading++;
  const iframe = h('iframe', {
    src: `${url}?${previewQuery()}`,
    loading: 'lazy',
    title: stage.dataset.title,
    tabIndex: -1,
  });
  iframe.style.width = `${100 / STAGE_SCALE}%`;
  iframe.style.height = `${100 / STAGE_SCALE}%`;
  iframe.style.transform = `scale(${STAGE_SCALE})`;
  // every navigation (including a later register/theme reload) gets scrolled past its
  // heading again; only the first load counts against the mount-throttle budget
  iframe.addEventListener('load', () => scrollPastHeading(iframe));
  iframe.addEventListener('load', settle, { once: true });
  iframe.addEventListener('error', settle, { once: true });
  stage.replaceChildren(iframe);
  live.add(stage);
}

async function mountScene(stage, name) {
  const ok = await loadSceneCore();
  if (!ok) { stage.replaceChildren(h('div', { className: 'g-stage-none', textContent: STRINGS.noPreview })); settle(); return; }
  const el = h('sg-scene');
  el.setAttribute('name', name);
  el.setAttribute('seed', '3');
  el.setAttribute('label', stage.dataset.title || name);
  el.addEventListener('sg-ready', settle, { once: true });
  stage.replaceChildren(el);
  live.add(stage);
}

function want(stage) {
  const { previewKind, demoUrl, sceneName } = stage.dataset;
  if (previewKind === 'iframe') mountIframe(stage, demoUrl);
  else if (previewKind === 'scene') { loading++; mountScene(stage, sceneName); }
}

let staggering = false;
function pump() {
  if (staggering || !queue.length || loading >= MAX_LIVE) return;
  staggering = true;
  setTimeout(() => { staggering = false; const next = queue.shift(); if (next) next(); pump(); }, MOUNT_STAGGER_MS);
}

const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const e of entries) {
    const stage = e.target;
    if (!e.isIntersecting || live.has(stage)) continue;
    queue.push(() => { if (!live.has(stage)) want(stage); });
  }
  pump();
}, { rootMargin: '160px 0px' }) : null;

function syncPreviews() {
  for (const stage of live) {
    const src = stage.querySelector('iframe');
    if (src) src.src = `${stage.dataset.demoUrl}?${previewQuery()}`;
    // a mounted <sg-scene> reads data-register from the cascade itself; no work needed here
  }
}
new MutationObserver(() => requestAnimationFrame(syncPreviews))
  .observe(root, { attributes: true, attributeFilter: ['data-register', 'data-theme', 'data-palette'] });
reduceMotion.addEventListener('change', syncPreviews);

// ── cards and groups ─────────────────────────────────────────────────────
function stageFor(card) {
  if (!card.previewKind) {
    return h('div', { className: 'g-stage' }, h('div', { className: 'g-stage-none', textContent: STRINGS.noPreview }));
  }
  const stage = h('div', {
    className: 'g-stage',
    'data-preview-kind': card.previewKind,
    'data-demo-url': card.demoUrl,
    'data-scene-name': card.sceneName || '',
    'data-title': card.title,
  }, h('div', { className: 'g-stage-wait', textContent: STRINGS.waiting }));
  io?.observe(stage);
  if (!io) { // no IntersectionObserver: load once, up front, and accept the cost
    if (card.previewKind === 'iframe') mountIframe(stage, card.demoUrl);
    else mountScene(stage, card.sceneName);
  }
  return stage;
}

function regList(card) {
  const all = ['quiet', 'warm', 'playful'];
  if (!card.registers.length) return null;
  return h('ul', { className: 'g-regs', 'aria-label': 'Registers it ships in' },
    all.map(r => h('li', { 'data-on': card.registers.includes(r) ? '1' : '0', textContent: r })));
}

function card(c) {
  const links = [
    c.demoUrl && h('a', { href: c.demoUrl, textContent: STRINGS.seeIt }),
    c.docsUrl && h('a', { href: c.docsUrl, textContent: STRINGS.docs }),
    c.promptUrl && h('a', { href: c.promptUrl, textContent: STRINGS.prompt }),
  ].filter(Boolean);
  return h('article', { className: 'g-card' },
    stageFor(c),
    h('h3', { className: 'g-card-title', textContent: c.title }),
    h('p', { className: 'g-card-type', textContent: c.type }),
    h('p', { className: 'g-card-desc', textContent: c.description }),
    regList(c),
    links.length && h('div', { className: 'g-card-links' }, links));
}

function group(g) {
  return h('section', { className: 'g-group', 'aria-labelledby': `g-${g.type}` },
    h('div', { className: 'g-group-head' },
      h('h2', { id: `g-${g.type}`, className: 'g-group-title', textContent: g.title }),
      h('p', { className: 'g-group-blurb', textContent: g.blurb })),
    h('div', { className: 'g-grid' }, g.items.map(card)));
}

const galleryEl = document.getElementById('gallery');
const countEl = document.getElementById('g-count');
const searchInput = document.getElementById('g-q');

function render(term) {
  const groups = filterGallery(gallery.groups, term || '');
  const shown = groups.reduce((n, g) => n + g.items.length, 0);
  galleryEl.replaceChildren(...(groups.length ? groups.map(group) : [h('p', { className: 'g-empty', textContent: STRINGS.none })]));
  countEl.textContent = STRINGS.count(shown);
}

let debounceTimer;
searchInput?.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => render(searchInput.value), 120);
});

render('');
// wirePalette() clicks a radio to apply the starting palette, which fires the
// form's change handler and, through it, syncPreviews(): run it only once
// `live`, `syncPreviews` and everything else that handler touches exist.
await wirePalette();
window.__ready = true;
