// The pure side of <sg-lazy> (decision 0024): when a scene may start, and the poster's markup.
// Runs in Node. lazy.js is the only part that touches the DOM.

/** A device this small keeps the poster: the scene's cost is not worth the memory (deviceMemory is in GB, and only Chromium reports it). */
export const LOW_MEMORY_GB = 2;

/**
 * Why a scene must not start by itself, or null when it may. First match wins, in the order a reader
 * would care about: a stated preference (reduced motion, Save-Data), then the device, then the register.
 * `register` is the effective one (after Save-Data stepped it down), as `registerState` gives it.
 * @param {{ reducedMotion?: boolean, saveData?: boolean, register?: string, deviceMemory?: number|null }} env
 * @returns {'reduced-motion'|'save-data'|'low-memory'|'quiet'|null}
 */
export function holdReason({ reducedMotion = false, saveData = false, register = 'warm', deviceMemory = null } = {}) {
  if (reducedMotion) return 'reduced-motion';
  if (saveData) return 'save-data';
  if (typeof deviceMemory === 'number' && deviceMemory <= LOW_MEMORY_GB) return 'low-memory';
  if (register === 'quiet') return 'quiet';
  return null;
}

/** The module URLs in a `src` attribute (space separated), made absolute against `base`. Pure; bad entries are dropped. */
export function parseSrc(value, base) {
  const out = [];
  for (const part of String(value ?? '').split(/\s+/)) {
    if (!part) continue;
    try { out.push(new URL(part, base).href); } catch { /* not a URL: skip it */ }
  }
  return out;
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The three files of a poster, by the stem (the path without its extension). */
export const posterFiles = stem => ({ avif: `${stem}.avif`, webp: `${stem}.webp`, jpg: `${stem}.jpg` });

/**
 * A poster as decision 0023 says: AVIF, then WebP, then the JPG `<img>` that always renders and carries
 * the alt, the size, `loading` and `decoding`. `eager` is for the first picture on the page (it also
 * gets `fetchpriority="high"`); everything below it is lazy. `data` is extra attributes for the img, as
 * written HTML (the docs site's `data-poster`).
 */
export function posterPicture({ stem, alt = '', width, height, eager = false, sizes = '', cls = '', data = '' }) {
  const f = posterFiles(stem), s = sizes ? ` sizes="${esc(sizes)}"` : '';
  return `<picture><source type="image/avif" srcset="${esc(f.avif)}"${s}><source type="image/webp" srcset="${esc(f.webp)}"${s}>` +
    `<img${cls ? ` class="${esc(cls)}"` : ''} src="${esc(f.jpg)}"${data ? ` ${data}` : ''} width="${width}" height="${height}" alt="${esc(alt)}"` +
    `${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></picture>`;
}
