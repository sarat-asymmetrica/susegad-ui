// Which scenes the gallery shows, in plate order.
//
// In development `built` is null and the page asks the dev server which scene
// modules exist (a missing one is skipped, not fatal). build.mjs rewrites this
// file in out/docs with the list it actually copied, so static hosting never
// probes or 404s.

export const order = ['kolam', 'paus', 'tollem'];

export const built = null;
