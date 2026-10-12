import { posix } from 'node:path';

// Every registry path is forward-slash and rooted at the repo, for example
// packages/scenes/kolam/model.js. The CLI copies it to <target>/susegad/scenes/kolam/model.js,
// keeping the tree so relative imports between packages still resolve after copying.

export const toPosix = p => p.replace(/\\/g, '/');

/**
 * Turn a path from a manifest into a repo-rooted path.
 * Manifest paths are relative to the manifest's folder. During the move to that rule a
 * path that starts with "packages/" and exists from the repo root is read as repo-rooted.
 * @param {string} manifestDir repo-rooted folder of the manifest, e.g. "packages/scenes/kolam"
 * @param {string} p the path as written
 * @param {(repoPath: string) => boolean} exists
 * @returns {{ path: string, repoRooted: boolean }}
 */
export function resolveManifestPath(manifestDir, p, exists) {
  const rel = posix.normalize(posix.join(manifestDir, p));
  if (p.startsWith('packages/') && !exists(rel)) {
    const rooted = posix.normalize(p);
    if (exists(rooted)) return { path: rooted, repoRooted: true };
  }
  return { path: rel, repoRooted: false };
}

/** True when a normalised repo path stays inside packages/. */
export const insidePackages = p => p.startsWith('packages/') && !p.split('/').includes('..');

/** A template's own files: packages/templates/<name>/... */
export const TEMPLATE_FILE = /^packages\/templates\/[^/]+\/(.+)$/;

/**
 * Where a repo file lands in a builder's project, relative to the target folder.
 * packages/engine/src/noise.js -> susegad/engine/src/noise.js
 * A template is a whole site, so its files land at the folder's root:
 * packages/templates/event/gom-deva/index.html -> gom-deva/index.html
 */
export function targetPathFor(repoPath) {
  if (!insidePackages(repoPath)) throw new Error(`${repoPath} is outside packages/, so the CLI has nowhere to put it`);
  const own = repoPath.match(TEMPLATE_FILE);
  if (own) return own[1];
  return 'susegad/' + repoPath.slice('packages/'.length);
}

/**
 * The repo path a template's reference points at once its files are copied. A page copied to
 * the project root says susegad/components/lang/lang.js, which is packages/components/lang/lang.js
 * in the repo; anything else it names (site.css, posters/hero.jpg) is the template's own.
 * @param {string} templateDir repo-rooted folder, e.g. packages/templates/event
 * @param {string} target the reference as the project sees it, normalised and relative to the project root
 */
export function templateRefTarget(templateDir, target) {
  if (target.startsWith('susegad/')) return 'packages/' + target.slice('susegad/'.length);
  return posix.join(templateDir, target);
}
