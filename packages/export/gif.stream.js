// gif.stream.js: a GIF encoder that takes its frames one at a time. Pure, runs in Node and the browser.
//
// gif.core.js turns a whole list of frames into bytes in one go, which is right for a short clip and wrong for a
// card made on a phone: thirty full frames in one call hold the page still for seconds, and nothing can stop it.
// This one is for a caller that works frame by frame and yields between them (and checks an AbortSignal):
//
//   const palette = paletteOf([rgbaA, rgbaB], 256);            // one shared colour table from sample pixels
//   const gif = createGifEncoder({ width, height, palette });
//   gif.addFrame(indexFrameFast(rgba, palette), 100);           // the first frame covers the whole picture
//   gif.addFrame(indexFrameFast(patch, palette), 100, { x, y, w, h }); // later ones may cover only what moved
//   const bytes = gif.finish();
//
// A frame that covers a sub-rectangle is plain GIF (an image descriptor with its own left, top, width and height,
// the previous frame left in place): a card whose picture moves under a still name and stamp encodes only the
// picture after the first frame, a third of the work and of the bytes. The LZW here writes the same bytes as
// `lzwEncode` in gif.core.js (the test proves it), through typed arrays instead of strings and a bit per array slot.

import { tableSize, subBlocks } from './gif.core.js';

const BINS = 64 ** 3; // the nearest-colour lookup: 6 bits a channel, 262,144 entries, filled as colours turn up
const HBINS = 32 ** 3; // the colour histogram: 5 bits a channel, 32,768 bins, each remembering the true mean of its pixels (cutting 262,144 took 150 ms in one step)

/**
 * A colour histogram that takes its pixels a buffer at a time, so a caller that yields between frames can feed it as it
 * goes and cut the table at the end: `add(rgba)` for each buffer, then `palette(maxColors)`.
 */
export function createHistogram() {
  const n = new Uint32Array(HBINS), sr = new Uint32Array(HBINS), sg = new Uint32Array(HBINS), sb = new Uint32Array(HBINS);
  return {
    /** @param {Uint8ClampedArray | Uint8Array} rgba */
    add(rgba) {
      for (let i = 0; i < rgba.length; i += 4) {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        n[k]++; sr[k] += r; sg[k] += g; sb[k] += b;
      }
    },
    palette: maxColors => cut(n, sr, sg, sb, maxColors),
  };
}

/**
 * A shared colour table (at most `maxColors`, 2 to 256) for the pixels of every buffer in `buffers`, by median cut
 * over a 5-bit histogram, weighted by how many pixels each colour has. Deterministic.
 * @param {(Uint8ClampedArray | Uint8Array)[]} buffers RGBA
 * @param {number} [maxColors]
 * @returns {number[][]} [[r, g, b], ...]
 */
export function paletteOf(buffers, maxColors = 256) {
  const h = createHistogram();
  for (const b of buffers) h.add(b);
  return h.palette(maxColors);
}

function cut(n, sr, sg, sb, maxColors) {
  const cols = [];
  for (let k = 0; k < HBINS; k++) if (n[k]) cols.push({ r: sr[k] / n[k], g: sg[k] / n[k], b: sb[k] / n[k], n: n[k] });
  if (!cols.length) return [[0, 0, 0], [255, 255, 255]];
  const out = [];
  const mean = list => { let r = 0, g = 0, b = 0, w = 0; for (const c of list) { r += c.r * c.n; g += c.g * c.n; b += c.b * c.n; w += c.n; } return [Math.round(r / w), Math.round(g / w), Math.round(b / w)]; };
  if (cols.length <= maxColors) return cols.map(c => [Math.round(c.r), Math.round(c.g), Math.round(c.b)]);
  // Split the box with the most pixels times the widest channel range at its weighted median, until there are maxColors.
  const box = list => {
    let lo = [255, 255, 255], hi = [0, 0, 0], w = 0;
    for (const c of list) { w += c.n; for (const [j, v] of [c.r, c.g, c.b].entries()) { if (v < lo[j]) lo[j] = v; if (v > hi[j]) hi[j] = v; } }
    const ch = [0, 1, 2].reduce((a, j) => (hi[j] - lo[j] > hi[a] - lo[a] ? j : a), 0);
    return { list, ch, range: hi[ch] - lo[ch], score: (hi[ch] - lo[ch]) * Math.sqrt(w) };
  };
  let boxes = [box(cols)];
  while (boxes.length < maxColors) {
    let bi = -1, best = 0;
    boxes.forEach((b, i) => { if (b.list.length > 1 && b.range > 0 && b.score > best) { best = b.score; bi = i; } });
    if (bi < 0) break;
    const { list, ch } = boxes[bi], key = ['r', 'g', 'b'][ch];
    const sorted = list.slice().sort((a, b) => a[key] - b[key]);
    let total = 0; for (const c of sorted) total += c.n;
    let acc = 0, cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) { acc += sorted[i].n; cut = i + 1; if (acc * 2 >= total) break; }
    boxes.splice(bi, 1, box(sorted.slice(0, cut)), box(sorted.slice(cut)));
  }
  out.push(...boxes.map(b => mean(b.list)));
  return out;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * An RGBA buffer to palette indices, one per pixel, through a 6-bit lookup that is filled as colours turn up (the
 * nearest palette entry is searched once per distinct colour, not once per pixel). With `dither`, an ordered 4 by 4
 * pattern nudges each pixel first, so a soft gradient reads as a gradient and not as bands; it depends only on the
 * pixel's place in the buffer, so a still region gives the same indices in every frame. `width` is the buffer's row
 * length, needed for the pattern.
 * @param {Uint8ClampedArray | Uint8Array} rgba @param {number[][]} palette
 * @param {{ width?: number, dither?: number }} [o] dither: amplitude in levels of 255 (0 is off, 10 is gentle)
 */
export function indexFrameFast(rgba, palette, { width = 0, dither = 0 } = {}) {
  return createIndexer(palette, { dither }).index(rgba, width);
}

/**
 * The same indexing as `indexFrameFast`, but the nearest-colour lookup lives as long as the indexer, so a clip's
 * second frame finds most of its colours already looked up instead of searching the palette for each again. For a
 * caller that indexes frame after frame against one palette. `index(rgba, width)` is one frame's indices.
 * @param {number[][]} palette @param {{ dither?: number }} [o]
 */
export function createIndexer(palette, { dither = 0 } = {}) {
  const lut = new Int16Array(BINS).fill(-1), P = palette.length;
  const pr = new Int16Array(P), pg = new Int16Array(P), pb = new Int16Array(P);
  palette.forEach(([r, g, b], i) => { pr[i] = r; pg[i] = g; pb[i] = b; });
  const find = (r, g, b) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < P; i++) { const d = (pr[i] - r) ** 2 + (pg[i] - g) ** 2 + (pb[i] - b) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const run = (rgba, out, width, from, to) => {
    for (let p = from, i = from * 4; p < to; p++, i += 4) {
      let r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      if (dither && width) {
        const t = (BAYER[((p / width | 0) & 3) * 4 + (p % width & 3)] - 7.5) * (dither / 7.5);
        r = r + t; g = g + t; b = b + t; r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      }
      const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      let v = lut[k];
      if (v < 0) v = lut[k] = find((r >> 2 << 2) + 2, (g >> 2 << 2) + 2, (b >> 2 << 2) + 2);
      out[p] = v;
    }
  };
  return {
    index(rgba, width = 0) {
      const out = new Uint8Array(rgba.length >> 2);
      run(rgba, out, width, 0, out.length);
      return out;
    },
    /** `index`, `slice` pixels at a time with `await pause()` between slices, so a whole picture does not hold the page still. */
    async indexSliced(rgba, width, pause, slice = 120_000) {
      const out = new Uint8Array(rgba.length >> 2);
      for (let p = 0; p < out.length; p += slice) { run(rgba, out, width, p, Math.min(out.length, p + slice)); if (p + slice < out.length) await pause(); }
      return out;
    },
  };
}

/**
 * LZW as GIF wants it, one run of indices at a time: `push(indices, from, to)` for each slice in order, then `finish()`
 * for the bytes. The dictionary lives between pushes, so a caller can stop between slices and let the page breathe.
 * @param {number} minCodeSize 2 to 8
 */
export function createLzw(minCodeSize, sizeHint = 1 << 16) {
  const clear = 1 << minCodeSize, end = clear + 1, HSIZE = 18013; // prime, over four times the 4096 codes
  const keys = new Int32Array(HSIZE).fill(-1), vals = new Int32Array(HSIZE);
  let out = new Uint8Array(Math.max(256, sizeHint)), len = 0, acc = 0, nbits = 0;
  const put = (code, size) => {
    acc |= code << nbits; nbits += size;
    while (nbits >= 8) {
      if (len === out.length) { const bigger = new Uint8Array(out.length * 2); bigger.set(out); out = bigger; }
      out[len++] = acc & 255; acc >>>= 8; nbits -= 8;
    }
  };
  let codeSize = minCodeSize + 1, next = end + 1, prefix = -1;
  put(clear, codeSize);
  return {
    push(indices, from = 0, to = indices.length) {
      let i = from;
      if (prefix < 0) { if (i >= to) return; prefix = indices[i++]; }
      for (; i < to; i++) {
        const c = indices[i], key = (prefix << 8) | c;
        let h = Math.imul(key, 2654435761) >>> 0; h %= HSIZE;
        while (keys[h] !== -1 && keys[h] !== key) h = h + 1 === HSIZE ? 0 : h + 1;
        if (keys[h] === key) { prefix = vals[h]; continue; }
        put(prefix, codeSize);
        if (next < 4096) {
          keys[h] = key; vals[h] = next++;
          if (next > (1 << codeSize) && codeSize < 12) codeSize++;
        } else { put(clear, codeSize); keys.fill(-1); next = end + 1; codeSize = minCodeSize + 1; }
        prefix = c;
      }
    },
    finish() {
      if (prefix >= 0) put(prefix, codeSize);
      put(end, codeSize);
      if (nbits) { if (len === out.length) { const bigger = new Uint8Array(out.length + 1); bigger.set(out); out = bigger; } out[len++] = acc & 255; }
      return out.slice(0, len);
    },
  };
}

/**
 * LZW as GIF wants it, the same bytes as `lzwEncode` in gif.core.js, from a typed-array dictionary.
 * @param {Uint8Array} indices @param {number} minCodeSize 2 to 8
 * @returns {Uint8Array}
 */
export function lzwEncodeFast(indices, minCodeSize) {
  const z = createLzw(minCodeSize, indices.length >> 1);
  z.push(indices);
  return z.finish();
}

const u16 = n => [n & 255, (n >> 8) & 255];

/**
 * A GIF89a being written. `addFrame(indices, delayMs, rect)`: `indices` are palette indices for the `rect` (default
 * the whole picture), row by row. `finish()` returns the bytes. `size` is the byte count so far, for a caller that
 * wants to stop before a budget.
 * @param {{ width: number, height: number, palette: number[][], loop?: boolean }} o
 */
export function createGifEncoder({ width, height, palette, loop = true }) {
  const tSize = tableSize(palette.length), minCodeSize = Math.max(2, Math.log2(tSize) | 0);
  const parts = [];
  let size = 0, frames = 0;
  const add = a => { const u = a instanceof Uint8Array ? a : Uint8Array.from(a); parts.push(u); size += u.length; };
  const ascii = s => Array.from(s, ch => ch.charCodeAt(0));
  add([...ascii('GIF89a'), ...u16(width), ...u16(height), 0xF0 | (minCodeSize - 1), 0, 0]);
  const table = new Uint8Array((1 << minCodeSize) * 3); // declared as 2^minCodeSize entries, so a two-colour palette is padded to four
  palette.forEach(([r, g, b], i) => { table[i * 3] = r; table[i * 3 + 1] = g; table[i * 3 + 2] = b; });
  add(table);
  if (loop) add([0x21, 0xFF, 0x0B, ...ascii('NETSCAPE2.0'), 3, 1, 0, 0, 0]);
  return {
    get size() { return size; },
    get frames() { return frames; },
    addFrame(indices, delayMs = 100, { x = 0, y = 0, w = width, h = height } = {}) {
      if (indices.length !== w * h) throw new Error(`createGifEncoder: a ${w} by ${h} frame needs ${w * h} indices, got ${indices.length}`);
      const delay = Math.round(delayMs / 10);
      // disposal 1: leave the picture in place, so a sub-rectangle frame paints over the one before it
      add([0x21, 0xF9, 4, 0x04, delay & 255, (delay >> 8) & 255, 0, 0]);
      add([0x2C, ...u16(x), ...u16(y), ...u16(w), ...u16(h), 0, minCodeSize]);
      add(subBlocks(lzwEncodeFast(indices, minCodeSize)));
      frames++;
    },
    /**
     * `addFrame`, but the LZW is done `slice` pixels at a time with `pause()` awaited between slices, so a frame the
     * size of the whole picture does not hold the page still. The bytes are the same as `addFrame`'s.
     */
    async addFrameSliced(indices, delayMs, rect, pause, slice = 100_000) {
      const { x = 0, y = 0, w = width, h = height } = rect ?? {};
      if (indices.length !== w * h) throw new Error(`createGifEncoder: a ${w} by ${h} frame needs ${w * h} indices, got ${indices.length}`);
      const delay = Math.round(delayMs / 10), z = createLzw(minCodeSize, indices.length >> 1);
      for (let i = 0; i < indices.length; i += slice) { z.push(indices, i, Math.min(indices.length, i + slice)); if (i + slice < indices.length) await pause(); }
      add([0x21, 0xF9, 4, 0x04, delay & 255, (delay >> 8) & 255, 0, 0]);
      add([0x2C, ...u16(x), ...u16(y), ...u16(w), ...u16(h), 0, minCodeSize]);
      add(subBlocks(z.finish()));
      frames++;
    },
    finish() {
      add([0x3B]);
      const all = new Uint8Array(size); let at = 0;
      for (const p of parts) { all.set(p, at); at += p.length; }
      return all;
    },
  };
}
