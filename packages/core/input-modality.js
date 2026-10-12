// data-sg-input on <html>: "key" while a moving key (arrow, Home, End, Page) is
// held, "pointer" otherwise. CSS drops motion on "key" (touch-contract.md).

export const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

/** Update the held set for an event; returns the attribute's next value, or null to leave it. */
export function track(held, type, key) {
  if (type === 'keydown' && MOVE_KEYS.has(key)) { held.add(key); return 'key'; }
  if (type === 'keyup' && MOVE_KEYS.has(key)) { held.delete(key); return held.size ? 'key' : 'pointer'; }
  if (type === 'pointerdown' || type === 'blur') { held.clear(); return 'pointer'; }
  return null;
}

let installed = false;

/** Install once; false where there is no document (Node). */
export function installInputModality(doc = globalThis.document) {
  if (installed || !doc?.documentElement) return false;
  installed = true;
  const held = new Set();
  const set = e => {
    const v = track(held, e.type, e.key);
    if (v && doc.documentElement.dataset.sgInput !== v) doc.documentElement.dataset.sgInput = v;
  };
  for (const t of ['keydown', 'keyup', 'pointerdown']) doc.addEventListener(t, set, { capture: true, passive: true });
  doc.defaultView?.addEventListener('blur', set, { passive: true });
  return true;
}

installInputModality();
