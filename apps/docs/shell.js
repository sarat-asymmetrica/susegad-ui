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

// ── the switches ─────────────────────────────────────────────────────
const prefs = window.sgDocsPrefs;
const form = document.getElementById('prefs');
if (prefs && form) {
  for (const [key, value] of Object.entries(prefs.current)) {
    const input = form.querySelector(`input[name="${key}"][value="${value}"]`);
    if (input) input.checked = true;
  }
  form.addEventListener('change', e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !prefs.ALLOWED[input.name]) return;
    prefs.current = { ...prefs.current, [input.name]: input.value };
    prefs.apply(prefs.current);
    prefs.save(prefs.current);
    if (input.name === 'register') announce(`Register set to ${input.value}`);
  });
  form.addEventListener('submit', e => e.preventDefault());
}

// ── posters follow the register and the theme ───────────────────────
// Each poster was captured at build time in every register and theme
// (posters.mjs); the <img> names its base in data-poster.
const dark = matchMedia('(prefers-color-scheme: dark)');
const theme = () => root.dataset.theme || (dark.matches ? 'dark' : 'light');
export function syncPosters(scope = document) {
  const suffix = `.${root.dataset.register || 'warm'}.${theme()}.jpg`;
  for (const img of scope.querySelectorAll('img.poster[data-poster]')) {
    const src = img.dataset.poster + suffix;
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  }
}
syncPosters();
new MutationObserver(() => syncPosters()).observe(root, { attributes: true, attributeFilter: ['data-register', 'data-theme'] });
dark.addEventListener('change', () => syncPosters());

// ── copy buttons: data-copy names an element, data-copy-text is the text ─
document.addEventListener('click', e => {
  const btn = e.target instanceof Element && e.target.closest('button.copy');
  if (!btn) return;
  const el = btn.dataset.copy ? document.getElementById(btn.dataset.copy) : null;
  const text = btn.dataset.copyText ?? el?.innerText ?? '';
  const label = btn.textContent;
  const reset = () => setTimeout(() => (btn.textContent = label), 1600);
  const fallback = () => {
    if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    btn.textContent = 'Selected. Press Ctrl+C or Cmd+C';
    reset();
  };
  try {
    navigator.clipboard.writeText(text).then(() => { btn.textContent = 'Copied'; announce('Copied'); reset(); }, fallback);
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
