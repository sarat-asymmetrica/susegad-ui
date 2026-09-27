// Viewer preferences for the docs site: register, theme and palette.
//
// A classic script loaded in <head> (not a module) so the attributes land on
// :root before first paint and the page never flashes the wrong theme.
// Storage can be missing or throw (private windows, blocked site data), so
// every read and write is guarded and the page renders the defaults without it.

(function () {
  var KEY = 'sg-docs-prefs';
  var ALLOWED = {
    register: ['quiet', 'warm', 'playful'],
    theme: ['auto', 'light', 'dark'],
    palette: ['susegad', 'casa'],
  };
  var DEFAULTS = { register: 'warm', theme: 'auto', palette: 'susegad' };

  function read() {
    var out = { register: DEFAULTS.register, theme: DEFAULTS.theme, palette: DEFAULTS.palette };
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      for (var k in ALLOWED) if (saved && ALLOWED[k].indexOf(saved[k]) >= 0) out[k] = saved[k];
    } catch (e) { /* no storage: defaults */ }
    return out;
  }

  function apply(prefs) {
    var root = document.documentElement;
    root.setAttribute('data-register', prefs.register);
    root.setAttribute('data-palette', prefs.palette);
    // auto means follow prefers-color-scheme, which the tokens do when data-theme is absent
    if (prefs.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', prefs.theme);
  }

  function save(prefs) {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* not persisted, still applied */ }
  }

  var prefs = read();
  apply(prefs);
  document.documentElement.classList.add('js');
  window.sgDocsPrefs = { KEY: KEY, ALLOWED: ALLOWED, DEFAULTS: DEFAULTS, read: read, apply: apply, save: save, current: prefs };
})();
