// A fake dimension source for Node: the same shape as the image oracle (dims / peek / record), answering from a table
// of { src: { w, h } } and nothing else. No fetch, no <img>, no clock: an entry that is missing is null, an entry listed
// in `late` answers only after `arrive()`. Tests only: it does not ship (not in the registry's files).

export function createFakeDims(table = {}, { late = [] } = {}) {
  const known = new Map(Object.entries(table).filter(([k]) => !late.includes(k)));
  const waiting = new Map(Object.entries(table).filter(([k]) => late.includes(k)));
  const asked = [];
  const waits = [];
  return {
    asked,
    peek: src => known.get(src) ?? null,
    record(src, d) { known.set(src, { ...d, source: 'known' }); return known.get(src); },
    dims(src) {
      asked.push(src);
      if (known.has(src)) return Promise.resolve(known.get(src));
      if (!waiting.has(src)) return Promise.resolve(null);
      return new Promise(resolve => waits.push({ src, resolve }));
    },
    /** Let the late entries answer (all of them, or just `src`). */
    arrive(src) {
      for (const w of waits.splice(0)) {
        if (src !== undefined && w.src !== src) { waits.push(w); continue; }
        known.set(w.src, waiting.get(w.src)); w.resolve(known.get(w.src));
      }
    },
  };
}
