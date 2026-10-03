// Site nav: the pure core. Runs in Node.
//
// Which link is the current page, when the server hasn't said; the warm
// register's pencil underline; the playful register's stamped tabs.

import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';

export const STRINGS = { label: 'Main' };

/** A path as the site means it: no index.html, no trailing slash (except the root), no query or hash. */
export function normalizePath(p) {
  let s = String(p || '/').replace(/[?#].*$/, '').replace(/\/index\.html?$/, '/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s || '/';
}

/**
 * Which link is the current page: an exact match wins ('page'); otherwise the
 * longest link that is a folder above the page marks its section ('true').
 * The home link never marks a section, or it would be current everywhere.
 * @param {string[]} hrefs link pathnames, in order
 * @param {string} here the page's pathname
 * @returns {{ index: number, kind: 'page'|'true' } | null}
 */
export function current(hrefs, here) {
  const h = normalizePath(here);
  const paths = hrefs.map(normalizePath);
  const exact = paths.indexOf(h);
  if (exact >= 0) return { index: exact, kind: 'page' };
  let best = -1;
  paths.forEach((p, i) => { if (p !== '/' && h.startsWith(`${p}/`) && (best < 0 || p.length > paths[best].length)) best = i; });
  return best >= 0 ? { index: best, kind: 'true' } : null;
}

/**
 * The warm underline: a pencil line under the current link, `w` wide, rising
 * a little to the right as a hand does, with seeded wander, drawn twice.
 * @param {number} w
 * @param {string|number} seed
 * @param {number} [wobble]
 * @returns {string[]}
 */
export function pencilLine(w, seed, wobble = 0.6) {
  const out = [];
  for (let pass = 0; pass < 2; pass++) {
    const n = makeNoise(`nav-pencil:${seed}:${pass}`), r = rng(`nav-pencil:${seed}:${pass}`);
    const x0 = r.range(-3, 0), x1 = w + r.range(0, 4), rise = r.range(0.6, 1.8);
    const pts = [];
    for (let x = x0; x <= x1; x += 4) pts.push([x, 4 - ((x - x0) / (x1 - x0)) * rise + n(x * 0.05, pass * 2) * wobble * 1.6 + pass * 0.7]);
    out.push(`M${pts.map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join('L')}`);
  }
  return out;
}

/** The playful tabs: a small seeded tilt per tab, as if each were stamped by hand. */
export function tabTilt(seed, i) {
  const r = rng(`nav-tab:${seed}:${i}`);
  return +((r.chance(0.5) ? 1 : -1) * r.range(0.6, 2.4)).toFixed(2);
}
