// What every page of the docs site shares: the register, theme and palette
// switches, posters that follow them, and copy buttons.
//
// prefs.js (a classic script in <head>) has already put the saved choices on
// :root before first paint; this module wires the switches to it.

const root = document.documentElement;
const announce = text => {
  const el = document.getElementById('announce');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => (el.textContent = text));
};

// ── the View control: register, theme, (palette on a page that offers it) ──
// The button and its panel are an sg-popover, which works as a native popover with no script at all;
// the element only places the panel. Here the radios are wired to the saved preferences.
import { W } from './words.core.js';
import { shellStrings } from './konkani.core.js';
import('../../packages/components/popover/popover.js').catch(() => {});
import('../../packages/components/lang/lang.js').catch(() => {});

const prefs = window.sgDocsPrefs;
const form = document.getElementById('prefs');
const viewBtn = document.getElementById('view-btn');
const viewStore = document.getElementById('view-store');
// a Konkani page (decision 0025) says its View button and its announcements in Konkani, with the deck's draft words
const kok = root.lang === 'gom-Deva' || root.lang === 'gom-Latn' ? shellStrings(root.lang) : null;
const nameView = () => viewBtn?.setAttribute('aria-label', kok ? `${kok.button}: ${kok.registers[prefs.current.register]}, ${kok.themes[prefs.current.theme]}` : W.view.name(prefs.current.register, prefs.current.theme));
if (prefs && form) {
  for (const [key, value] of Object.entries(prefs.current)) {
    const input = form.querySelector(`input[name="${key}"][value="${value}"]`);
    if (input) input.checked = true;
  }
  nameView();
  form.addEventListener('change', e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !prefs.ALLOWED[input.name]) return;
    prefs.current = { ...prefs.current, [input.name]: input.value };
    prefs.apply(prefs.current);
    const kept = prefs.save(prefs.current);
    if (viewStore) viewStore.hidden = kept;
    nameView();
    if (input.name === 'register') announce(kok ? kok.announceRegister(kok.registers[input.value]) : W.view.announceRegister(input.value));
    if (input.name === 'theme') announce(kok ? kok.announceTheme(input.value, kok.themes[input.value]) : W.view.announceTheme(input.value));
  });
  form.addEventListener('submit', e => e.preventDefault());
}

// Escape or a tap outside closes the panel and the platform hands the focus back to the button; WebKit leaves it on the
// page when the focus was inside the panel, so a keyboard user would lose their place. If nothing has the focus once
// the panel is closed, the button does. (A tap on another control keeps its own focus.)
// Tabbing out of the open panel closes it, so the focus never walks on behind a panel that stays up.
document.getElementById('view-panel')?.addEventListener('focusout', e => {
  const panel = e.currentTarget;
  if (e.relatedTarget && !panel.contains(e.relatedTarget) && e.relatedTarget !== viewBtn) panel.hidePopover?.();
});

document.getElementById('view-panel')?.addEventListener('toggle', e => {
  if (e.newState !== 'closed') return;
  // WebKit hands the focus back (to a control that is now hidden) a moment after the event, so look again
  const give = () => { if (!document.activeElement || document.activeElement === document.body) viewBtn?.focus(); };
  requestAnimationFrame(give);
  setTimeout(give, 120);
});

// ── posters follow the register and the theme ───────────────────────
// Each poster was captured at build time in every register and theme
// (posters.mjs) in three formats; the <img> names its base in data-poster, and the
// <source>s of its <picture> follow it, so a swap changes the format the browser picks from too.
const dark = matchMedia('(prefers-color-scheme: dark)');
const theme = () => root.dataset.theme || (dark.matches ? 'dark' : 'light');
export function syncPosters(scope = document) {
  const suffix = `.${root.dataset.register || 'warm'}.${theme()}`;
  for (const img of scope.querySelectorAll('img.poster[data-poster]')) {
    const src = `${img.dataset.poster}${suffix}.jpg`;
    if (img.getAttribute('src') === src) continue;
    for (const source of img.parentElement.querySelectorAll('source[type^="image/"]')) source.srcset = `${img.dataset.poster}${suffix}.${source.type.slice(6)}`;
    img.setAttribute('src', src);
  }
}
syncPosters();
new MutationObserver(() => syncPosters()).observe(root, { attributes: true, attributeFilter: ['data-register', 'data-theme'] });
dark.addEventListener('change', () => syncPosters());

// ── copy buttons: data-copy names an element, data-copy-text is the text ─
document.addEventListener('click', e => {
  const btn = e.target instanceof Element && e.target.closest('button.copy');
  if (!btn) return;
  // the text to select if the clipboard is refused: the element named, or the command beside the button
  const el = btn.dataset.copy ? document.getElementById(btn.dataset.copy) : btn.closest('.install')?.querySelector('code') ?? null;
  const text = btn.dataset.copyText ?? el?.innerText ?? '';
  // the button's own word, kept from the first tap: a second tap while an instruction shows must not take the instruction for the label
  btn.dataset.label ??= btn.textContent;
  const label = btn.dataset.label;
  clearTimeout(Number(btn.dataset.timer));
  // a copy says "Copied" for a moment; a refusal is an instruction, so it stays long enough to read
  const reset = ms => btn.dataset.timer = String(setTimeout(() => { btn.textContent = label; btn.removeAttribute('title'); btn.removeAttribute('lang'); live?.removeAttribute('lang'); }, ms));
  const live = document.getElementById('announce');
  const fallback = () => {
    if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    // what to say: a phone has no Ctrl+C, and a button with nothing beside it selected nothing
    const touch = matchMedia('(pointer: coarse)').matches;
    const [word, said] = !el ? [W.copy.failedNone, W.copy.failedNoneAnnounce] : touch ? [W.copy.failedTouch, W.copy.failedTouchAnnounce] : [W.copy.failed, W.copy.failedAnnounce];
    btn.textContent = word;
    btn.title = said;
    // these words are English on every page (the Konkani deck keeps the rare fallbacks in English), so they are read in English
    btn.lang = 'en-IN';
    if (live) live.lang = 'en-IN';
    announce(said);
    reset(5000);
  };
  try {
    navigator.clipboard.writeText(text).then(() => { btn.textContent = kok?.copied ?? W.copy.copied; announce(btn.dataset.announce || (kok?.copied ?? W.copy.copied)); reset(1600); }, fallback);
  } catch { fallback(); }
});

// ── a hash that names a fold opens it ───────────────────────────────
function openFold() {
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (el instanceof HTMLDetailsElement) { el.open = true; el.scrollIntoView(); }
}
openFold();
addEventListener('hashchange', openFold);

// a page that finishes later (a scene page, waiting for its drawing) says so on <body>
// (hasAttribute, not dataset: a bare attribute reads as "", which is falsy)
if (!document.body.hasAttribute('data-ready-later')) window.__ready = true;

export { announce };
