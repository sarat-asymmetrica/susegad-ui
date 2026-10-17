// sitemap.xml for the docs site (sitemaps.org): the site's own pages, never the library's files under /packages.
// Pure: site-relative page files in, the XML out. build.mjs lists the files and writes the result.

import { SITE } from './site.core.js';

/** A site-relative page file ("components/badge.html", "gom-deva/index.html") as the URL it is served at. */
export function pageUrl(rel) {
  const p = rel.replaceAll('\\', '/').replace(/^\/+/, '');
  if (p === 'index.html') return `${SITE}/`;
  if (p.endsWith('/index.html')) return `${SITE}/${p.slice(0, -'index.html'.length)}`;
  return `${SITE}/${p.replace(/\.html$/, '')}`;
}

/** Pages a crawler should not be sent to: the 404 page, the made event site's offline pages, and library files (the
 *  site's /packages, and the copy a made site keeps under susegad/). */
const LEAVE_OUT = [/(^|\/)404\.html$/, /(^|\/)offline\.html$/, /^packages\//, /(^|\/)susegad\//];

/** @param {string[]} files site-relative .html files @returns {string} */
export function sitemapXml(files) {
  const urls = [...new Set(files.map(f => f.replaceAll('\\', '/')).filter(f => f.endsWith('.html') && !LEAVE_OUT.some(r => r.test(f))).map(pageUrl))].sort();
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}
</urlset>
`;
}
