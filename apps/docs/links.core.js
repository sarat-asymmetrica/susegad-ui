// Where a link in a rendered Markdown file goes on the site.
//
// The docs are written for a repo reader, so they link to each other by file path. On the site a file the site
// renders is that page; a demo the build ships is that demo; any other public file of the repo is its page on
// GitHub; a private one is no link at all, because the reader could not open it. Pure: the edge says which
// files exist and which are private.

import path from 'node:path';

export const GITHUB = 'https://github.com/sarat-asymmetrica/susegad-ui';

/** The repo pages the site renders itself, so a link to one stays on the site. */
export const REPO_PAGES = { 'docs/HANDOFF.md': 'handoff', 'docs/BROWSERS.md': 'browsers', 'docs/reference/accessibility.md': 'accessibility' };

/**
 * @param {string} href the link as written, relative to `from`
 * @param {string} from the repo path of the Markdown file it is in
 * @param {{ pageOf: (target: string) => string | null, shipped: Set<string>, exists: (p: string) => boolean, isPrivate: (p: string) => boolean, depth: number }} ctx
 *   `pageOf` gives a repo file's site path when the site renders it as an item page ('components/dialog'), else null
 * @returns {string | false | null} the new href, false to drop the link and keep its words, null to leave it as written
 */
export function rewriteHref(href, from, { pageOf, shipped, exists, isPrivate, depth }) {
  if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) return null;
  const at = href.search(/[#?]/);
  const file = at < 0 ? href : href.slice(0, at);
  const hash = at < 0 ? '' : href.slice(at);
  if (!file) return null;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), file)).replace(/\/$/, '');
  if (target.startsWith('..')) return null;
  const up = '../'.repeat(depth);
  const frag = hash.startsWith('#') ? hash.slice(1) : '';
  const itemPath = pageOf(target);
  if (itemPath) return `${up}${itemPath}${frag ? (/^conformance-wcag/.test(frag) ? '#a11y' : `#doc-${frag}`) : ''}`;
  if (REPO_PAGES[target]) return `${up}${REPO_PAGES[target]}${frag ? `#doc-${frag}` : ''}`;
  if (shipped.has(target)) return `${up}${target}${hash}`;
  if (!exists(target)) return null;
  if (isPrivate(target)) return false;
  return `${GITHUB}/${/\.[a-z0-9]+$/i.test(target) ? 'blob' : 'tree'}/main/${target}${hash}`;
}

/** Apply rewriteHref to every `<a href>` of rendered HTML. */
export function rewriteLinks(html, from, ctx) {
  return html.replace(/<a href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (m, href, rest, text) => {
    const to = rewriteHref(href, from, ctx);
    return to === null ? m : to === false ? text : `<a href="${to}"${rest}>${text}</a>`;
  });
}
