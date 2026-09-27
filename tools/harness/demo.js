// Shared bootstrap for component and recipe demo pages, so the tools can drive them.
//
//   <script src="/tools/harness/demo.js"></script>   (a classic script, first thing in <head>)
//
// Reads ?register, ?theme and ?palette and sets them on :root before first paint.
// Links fonts.css, tokens.css and demo.css (the demos' own buttons). Declares window.__ready = false; the page calls
// window.__demoReady() once its components are upgraded (or it happens on load +
// customElements settle, whichever the page prefers).
(() => {
  const q = new URLSearchParams(location.search);
  const root = document.documentElement;
  for (const k of ['register', 'theme', 'palette']) {
    const v = q.get(k);
    if (v) root.setAttribute(`data-${k}`, v);
  }
  if (!root.hasAttribute('lang')) root.setAttribute('lang', 'en');
  for (const href of ['/packages/tokens/fonts.css', '/packages/tokens/tokens.css', '/tools/harness/demo.css']) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.append(l);
  }
  window.__ready = false;
  window.__demoReady = () => { window.__ready = true; };
  // Fallback: ready after load, fonts and every sg-* element upgraded.
  addEventListener('load', async () => {
    try { await document.fonts.ready; } catch {}
    const tags = new Set([...document.querySelectorAll('*')].map(e => e.localName).filter(n => n.startsWith('sg-')));
    await Promise.all([...tags].map(t => customElements.whenDefined(t)));
    setTimeout(() => { window.__ready = true; }, 50);
  });
})();
