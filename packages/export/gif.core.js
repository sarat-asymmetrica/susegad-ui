// gif.core.js: a small, dependency-free GIF encoder. Palette quantisation
// (median cut) and LZW compression are pure byte-crunching; both run in
// Node and are tested there against known GIF structure, not against a
// reference decoder (none is a dependency of this repo).
//
// Scope: GIF89a, a global colour table (up to 256 colours), one or more
// image frames with per-frame delay via a Graphic Control Extension, and an
// optional Netscape loop extension. No local colour tables, no interlacing,
// no transparency (a scene export never needs it: it always paints a full
// frame). That covers every export this library makes.

/** RGBA (Uint8ClampedArray-like, 4 bytes per pixel) to an RGB colour count, ignoring alpha. */
function countColors(rgba) {
  const counts = new Map();
  for (let i = 0; i < rgba.length; i += 4) {
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/**
 * Median-cut palette: reduce an RGBA buffer to at most `maxColors` (2 to 256)
 * representative RGB colours. Returns `{ palette: [[r,g,b], ...], }`.
 * Exact colours (no dithering) map to the nearest palette entry by
 * `indexFor`. Deterministic: same input, same palette, every time.
 */
export function quantize(rgba, maxColors = 256) {
  const counts = countColors(rgba);
  const colors = [...counts.entries()].map(([key, n]) => ({ r: (key >> 16) & 255, g: (key >> 8) & 255, b: key & 255, n }));
  if (colors.length <= maxColors) return { palette: colors.map(c => [c.r, c.g, c.b]) };

  // Median cut: repeatedly split the bucket with the widest channel range at its median.
  let buckets = [colors];
  while (buckets.length < maxColors) {
    let bi = -1, bestRange = -1, bestChannel = 'r';
    buckets.forEach((bucket, i) => {
      if (bucket.length < 2) return;
      for (const ch of ['r', 'g', 'b']) {
        let lo = 255, hi = 0;
        for (const c of bucket) { if (c[ch] < lo) lo = c[ch]; if (c[ch] > hi) hi = c[ch]; }
        const range = hi - lo;
        if (range > bestRange) { bestRange = range; bi = i; bestChannel = ch; }
      }
    });
    if (bi < 0 || bestRange <= 0) break;
    const bucket = buckets[bi].slice().sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = bucket.length >> 1;
    buckets.splice(bi, 1, bucket.slice(0, mid), bucket.slice(mid));
  }
  const palette = buckets.filter(b => b.length).map(bucket => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const c of bucket) { r += c.r * c.n; g += c.g * c.n; b += c.b * c.n; n += c.n; }
    return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [0, 0, 0];
  });
  return { palette };
}

/** The palette index closest (squared Euclidean, RGB) to an RGB triplet. */
export function nearestIndex(palette, r, g, b) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** An RGBA buffer to a flat array of palette indices (one per pixel), by nearest colour. */
export function indexFrame(rgba, palette) {
  const n = rgba.length / 4, out = new Uint8Array(n);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) out[p] = nearestIndex(palette, rgba[i], rgba[i + 1], rgba[i + 2]);
  return out;
}

/** The colour-table size GIF wants: a power of two, 2 to 256, at least `n`. */
export function tableSize(n) { let s = 2; while (s < n && s < 256) s *= 2; return s; }

/**
 * LZW-encode a stream of palette indices, GIF's own variant: the code size
 * starts at `minCodeSize + 1`, grows as the table fills, and Clear (256) /
 * End (257) codes are reserved. Returns the encoded bytes, not yet
 * sub-block framed.
 * @param {Uint8Array} indices @param {number} minCodeSize the palette's bit depth, 2 to 8
 */
export function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize, endCode = clearCode + 1;
  let codeSize = minCodeSize + 1, nextCode = endCode + 1;
  let table = new Map();
  const resetTable = () => { table = new Map(); for (let i = 0; i < clearCode; i++) table.set(String.fromCharCode(i), i); nextCode = endCode + 1; codeSize = minCodeSize + 1; };
  resetTable();

  const bits = [];
  const emit = (code, size) => { for (let i = 0; i < size; i++) bits.push((code >> i) & 1); };
  emit(clearCode, codeSize);

  let w = '';
  for (let i = 0; i < indices.length; i++) {
    const k = String.fromCharCode(indices[i]);
    const wk = w + k;
    if (table.has(wk)) { w = wk; continue; }
    emit(table.get(w), codeSize);
    if (nextCode < 4096) {
      table.set(wk, nextCode++);
      if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
    } else { emit(clearCode, codeSize); resetTable(); }
    w = k;
  }
  if (w !== '') emit(table.get(w), codeSize);
  emit(endCode, codeSize);

  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= 1 << (i & 7);
  return bytes;
}

/** LZW bytes to GIF's sub-block framing: length-prefixed chunks of up to 255 bytes, terminated by a zero-length block. */
export function subBlocks(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length; i += 255) { const chunk = bytes.subarray(i, i + 255); out.push(chunk.length, ...chunk); }
  out.push(0);
  return Uint8Array.from(out);
}

const u16 = n => [n & 255, (n >> 8) & 255];

/**
 * Encode one or more frames (each `{ rgba, delayMs }`, same width and
 * height, already indexed against a shared palette from `quantize`) as a
 * GIF89a byte stream.
 * @param {{ width: number, height: number, palette: number[][], frames: { indices: Uint8Array, delayMs: number }[], loop?: boolean }} opts
 * @returns {Uint8Array}
 */
export function encodeGif({ width, height, palette, frames, loop = true }) {
  const tSize = tableSize(palette.length), minCodeSize = Math.max(2, Math.log2(tSize) | 0);
  const padded = palette.concat(Array.from({ length: tSize - palette.length }, () => [0, 0, 0]));
  const out = [];
  const push = (...b) => out.push(...b);
  const pushStr = s => { for (let i = 0; i < s.length; i++) push(s.charCodeAt(i)); };
  // A real frame's LZW bytes can run to hundreds of thousands of entries;
  // spreading that into push(...bytes) overflows the call stack (spread
  // becomes one giant function call). Appending one at a time in a loop
  // has no such limit.
  const pushBytes = bytes => { for (let i = 0; i < bytes.length; i++) out.push(bytes[i]); };

  pushStr('GIF89a');
  push(...u16(width), ...u16(height), 0xF0 | (minCodeSize - 1), 0, 0); // global colour table present, resolution nominal
  for (const [r, g, b] of padded) push(r, g, b);

  if (loop && frames.length > 1) {
    push(0x21, 0xFF, 0x0B); // application extension: NETSCAPE2.0, looping forever
    pushStr('NETSCAPE2.0');
    push(3, 1, 0, 0, 0);
  }

  for (const frame of frames) {
    const delay = Math.round((frame.delayMs ?? 100) / 10);
    // Graphic Control Extension: introducer, label, block size (4), packed
    // fields (no transparency, no disposal method set), delay (LE), the
    // transparent colour index (unused, 0), then the block terminator.
    push(0x21, 0xF9, 4, 0x00, delay & 255, (delay >> 8) & 255, 0, 0);
    push(0x2C, ...u16(0), ...u16(0), ...u16(width), ...u16(height), 0); // image descriptor, no local colour table
    push(minCodeSize);
    pushBytes(subBlocks(lzwEncode(frame.indices, minCodeSize)));
  }
  push(0x3B);
  return Uint8Array.from(out);
}

/**
 * The whole pipeline: RGBA frames (all the same size) to a GIF byte stream,
 * with one shared palette built from the first frame (fast, and consistent
 * across the loop; good enough for the flat, few-colour art this library
 * exports).
 * @param {{ width: number, height: number, frames: { rgba: Uint8ClampedArray | Uint8Array, delayMs: number }[], maxColors?: number, loop?: boolean }} opts
 */
export function framesToGif({ width, height, frames, maxColors = 256, loop = true }) {
  if (!frames.length) throw new Error('framesToGif: at least one frame is needed');
  const { palette } = quantize(frames[0].rgba, maxColors);
  const indexed = frames.map(f => ({ indices: indexFrame(f.rgba, palette), delayMs: f.delayMs }));
  return encodeGif({ width, height, palette, frames: indexed, loop });
}
