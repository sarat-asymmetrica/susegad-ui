// Old home-page anchors -> where that thing lives now. Kept in a module of its own so the home page loads only this
// (a visitor arriving on an old #anchor is sent on before the rest of the site map has loaded).

/** Old home-page anchors -> where that thing lives now (index.html's redirect script uses the same rule). */
export function redirectFor(hash, sceneSlugs) {
  const h = decodeURIComponent(String(hash || '').replace(/^#/, ''));
  if (!h) return null;
  if (sceneSlugs.includes(h)) return `scenes/${h}`;
  if (h === 'pencil-box') return 'pencil-box';
  if (h === 'scenes') return 'scenes';
  if (h === 'ideas') return 'developers#ideas';
  if (h.startsWith('t-')) return `pencil-box#${h}`;
  const m = /^(.+)-(prompt|map)$/.exec(h);
  if (m && sceneSlugs.includes(m[1])) return `scenes/${m[1]}#${m[2]}`;
  return null;
}
