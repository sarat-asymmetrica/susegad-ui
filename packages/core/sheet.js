// Styles as one shared constructable sheet, so a strict CSP has nothing to block; an element
// root adopts onto its document, once. A <style> only where adoptedStyleSheets is missing.
const sheets = new Map();
export function adopt(root, css) {
  try {
    let s = sheets.get(css);
    if (!s) { s = new CSSStyleSheet(); s.replaceSync(css); sheets.set(css, s); }
    const target = 'adoptedStyleSheets' in root ? root : root.getRootNode();
    if (!target.adoptedStyleSheets.includes(s)) target.adoptedStyleSheets = [...target.adoptedStyleSheets, s];
  } catch {
    const el = document.createElement('style');
    el.textContent = css;
    root.head ? root.head.append(el) : root.prepend(el);
  }
}
