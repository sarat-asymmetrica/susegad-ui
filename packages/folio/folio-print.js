// Folio print: before printing, every scene draws its finished still (the
// reduced-motion frame), sized for the page; after printing, the ones that were
// moving carry on. Nothing else changes.
(() => {
  const was = new WeakMap();
  addEventListener('beforeprint', () => {
    for (const s of document.querySelectorAll('sg-scene')) {
      was.set(s, !!s.wanted);
      s.still?.();
    }
  });
  addEventListener('afterprint', () => {
    for (const s of document.querySelectorAll('sg-scene')) if (was.get(s)) s.play?.();
  });
})();
