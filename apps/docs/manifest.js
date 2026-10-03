// Which scenes the site shows, in reading order: the Susegad sketchbook's
// volumes (numbered plates), then the groups drawn since (no plate numbers).
// A scene in no group still gets a page, under "More scenes" (site.core.js).
//
// In development `built` is null and the page asks the dev server which scene
// modules exist (a missing one is skipped, not fatal). build.mjs rewrites this
// file in out/docs with the list it actually copied, so static hosting never
// probes or 404s.

export const volumes = [
  { title: 'Volume I', note: 'noise, ink and emergence', ids: ['paus', 'kolam', 'rampon', 'khazan', 'mankurad', 'vad', 'neel', 'chai'] },
  { title: 'Volume II', note: 'physics, fields, grammars and the GPU', ids: ['tollem', 'saanj', 'toran', 'shet', 'ghat', 'chiro', 'abri', 'kairi', 'mosaico', 'vel', 'themb'] },
  { title: 'Volume III', note: 'after the people and practices of Goa', ids: ['tinto', 'prahar', 'maun'] },
  // not sketchbook plates, so no plate numbers: drawn for a working studio's own pages
  { title: 'The studio', note: 'progress, approval, a ledger, a house front, the desk at dawn', ids: ['ferry', 'nod', 'vahi', 'dar', 'pahat'], plates: false },
  { title: 'The town and the coast', note: 'the tiatr stage, the post office, the salt pans, and the taverna', ids: ['kantar', 'posta', 'mithagar', 'taverna'], plates: false },
  { title: 'In depth', note: 'drawn with exact depth, for the three.js tier', ids: ['veranda'], plates: false },
];

export const order = volumes.flatMap(v => v.ids);

export const built = null;
