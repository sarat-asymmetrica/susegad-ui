// The smoke tier's decisions, pure: which pages there are, which of them a diff reaches, what counts as a
// failure and how a result reads. The browser half is smoke.mjs; the command is tools/smoke.mjs.

import { itemDir, dependentsOf, sharedHits } from './changed.core.js';

const norm = p => p.replaceAll('\\', '/').replace(/^\.\//, '');
const under = (p, dir) => p === dir || p.startsWith(`${dir}/`);

/**
 * Every demo page the registry knows. An item's pages are the .html files in its listed files, plus its
 * demo.html and index.html when they sit in its folder (the rule apps/docs/build.mjs uses to ship demos).
 * @param {{ items: object[], exists: (repoPath: string) => boolean }} input
 * @returns {{ path: string, item: string, type: string }[]} sorted by item, then path; a path appears once
 */
export function discoverPages({ items, exists }) {
  const seen = new Set();
  const pages = [];
  for (const item of items) {
    const dir = itemDir(item);
    const paths = (item.files ?? []).map(f => norm(f.path)).filter(p => p.endsWith('.html'));
    for (const name of ['demo.html', 'index.html']) if (dir && exists(`${dir}/${name}`)) paths.push(`${dir}/${name}`);
    for (const p of paths) {
      if (seen.has(p)) continue;
      seen.add(p);
      pages.push({ path: `/${p}`, item: item.name, type: item.type });
    }
  }
  return pages.sort((a, b) => a.item.localeCompare(b.item) || a.path.localeCompare(b.path));
}

/**
 * Pages the dev server cannot show by design. A template's offline.html is written for the worker that
 * serves it at any depth of a made site: it loads "/look.js" and "/susegad/..." from the site root, which
 * exist only after `susegad create` (the registry build warns about each one, and apps/docs/build.mjs
 * leaves templates out of its verify for the same reason). Skipped and counted, never silently.
 * @returns {string|null} the reason, or null when the page is run
 */
export function skipReason(page) {
  if (page.type === 'template' && /\/offline\.html$/.test(page.path)) return "a made site's offline page: it loads from the site root, which the dev server does not have";
  return null;
}

/**
 * Which items a diff reaches: a shared primitive reaches all of them; otherwise the items whose folder or
 * listed files changed, and everything that depends on those. Prose changes reach nothing.
 * @param {{ files: string[], items: object[] }} input
 * @returns {{ all: boolean, reason: string|null, names: Set<string> }}
 */
export function itemsForDiff({ files, items }) {
  const code = [...new Set(files.map(norm))].filter(f => f && !f.endsWith('.md'));
  const { allReason } = sharedHits(code);
  if (allReason) return { all: true, reason: allReason, names: new Set(items.map(i => i.name)) };
  const touched = new Set();
  for (const it of items) {
    const dir = itemDir(it);
    const own = new Set((it.files ?? []).map(f => norm(f.path)));
    if (code.some(f => (dir && under(f, dir)) || own.has(f))) touched.add(it.name);
  }
  return { all: false, reason: null, names: new Set([...touched, ...dependentsOf(items, [...touched]).keys()]) };
}

/** Notices that are an engine's own report channel, not a page's fault (see engine.mjs dropBenignErrors). */
const BENIGN = [/^ResizeObserver loop completed with undelivered notifications\.$/];

/**
 * Should a failed request count? A page that closes while media or a fetch is still reading its header
 * cancels it (ERR_ABORTED): that is the page going away, not a broken file. A missing file still fails
 * through its 404 response.
 */
export function requestFailureCounts(errorText, resourceType) {
  return !((resourceType === 'media' || resourceType === 'fetch') && errorText === 'net::ERR_ABORTED');
}

/** Drop the known-benign notices from an error list. */
export const dropBenign = errors => errors.filter(e => !BENIGN.some(re => re.test(e)));

/** "rule (n: selector, selector)" for one axe violation as axe returns it. */
export function axeLine(v) {
  const sel = v.nodes.slice(0, 2).map(n => (Array.isArray(n.target) ? n.target.map(x => (Array.isArray(x) ? x.join(' >>> ') : x)).join(' ') : String(n.target))).join(', ');
  return `${v.id} (${v.nodes.length}: ${sel})`;
}

/**
 * Turn what one page's passes saw into its failures. Each failure is { kind, message }.
 * @param {{ desktop?: { errors: string[], axe?: string[], axeError?: string, notReady?: string }, phone?: { errors: string[], overflow?: number, clipped?: boolean }, reduced?: { errors: string[] } }} seen
 */
export function failuresOf(seen) {
  const out = [];
  const add = (kind, list) => { for (const message of list) out.push({ kind, message }); };
  if (seen.desktop) {
    add('error', dropBenign(seen.desktop.errors).map(e => `desktop: ${e}`));
    if (seen.desktop.notReady) add('not-ready', [seen.desktop.notReady]);
    if (seen.desktop.axeError) add('axe-failed', [seen.desktop.axeError]);
    add('axe', seen.desktop.axe ?? []);
  }
  if (seen.phone) {
    add('error', dropBenign(seen.phone.errors).map(e => `390 px: ${e}`));
    // without it a phone lays the page out at 980 px and zooms out: dialog's and drawer's no-JS pages shipped that way
    if (seen.phone.metaViewport === false) add('viewport', ['no width=device-width viewport meta']);
    if (seen.phone.overflow > 0) add('sideways', [`scrolls ${seen.phone.overflow} px sideways at 390 px${seen.phone.clipped ? ' (hidden by a clip on html or body)' : ''}`]);
  }
  if (seen.reduced) add('error', dropBenign(seen.reduced.errors).map(e => `reduced motion: ${e}`));
  return out;
}

/** The numbers and the verdict for a finished run. An empty run is not a pass. */
export function summarise(results) {
  const failed = results.filter(r => r.failures.length);
  const kinds = {};
  for (const r of failed) for (const f of r.failures) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
  return { pages: results.length, failed: failed.length, passed: results.length - failed.length, kinds, ok: results.length > 0 && failed.length === 0 };
}

/** A table of the failures, one block per page. Empty string when nothing failed. */
export function formatFailures(results) {
  const failed = results.filter(r => r.failures.length);
  if (!failed.length) return '';
  const lines = [];
  const w = Math.max(...failed.map(r => r.path.length));
  for (const r of failed) {
    lines.push(`FAIL ${r.path.padEnd(w)}  ${r.item} (${r.type})`);
    for (const f of r.failures) lines.push(`       ${f.kind.padEnd(10)} ${f.message}`);
  }
  return lines.join('\n');
}
