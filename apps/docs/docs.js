// The home page: old links sent on, and the masthead tiatr drawn live.
// Everything else on the page is HTML; shell.js runs the switches.
//
// Library code is imported by relative path from the repo tree
// (../../packages/...). build.mjs rewrites that prefix for the built copy, so
// keep every package path in that form.

import { order } from './manifest.js';

// ── old links ───────────────────────────────────────────────────────
// The home page used to hold every scene as a plate (#paus, #paus-prompt),
// the pencil box (#pencil-box, #t-wobble) and the scenes (#scenes). Those
// live on their own pages now; the rule is site.core.js's redirectFor, loaded
// only when there is a hash to read.
if (location.hash.length > 1) {
  const { redirectFor } = await import('./site.core.js');
  const to = redirectFor(location.hash, order);
  if (to) location.replace(new URL(to, location.href).href);
}

// ── masthead tiatr ──────────────────────────────────────────────────
const pkg = rel => new URL(`../../packages/${rel}`, import.meta.url).href;
const art = document.getElementById('mast-art');
try {
  await import(pkg('core/index.js'));
  await import(pkg('scenes/kantar/index.js'));
} catch (err) {
  console.warn('the masthead tiatr did not load', err?.message ?? err);
  art.hidden = true;
  document.querySelector('.mast').style.gridTemplateColumns = '1fr';
}
