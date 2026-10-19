// A GIF reader for the checks, in Node: independent of the encoder. Header, colour table, then every frame's rectangle
// painted over the picture so far (a frame is left in place, which is how the encoder writes the moving picture over
// the still card). Returns each frame as full-size RGB so a check can compare frames with each other and with a PNG.

function lzwDecode(bytes, min) {
  const clear = 1 << min, end = clear + 1;
  let size = min + 1, pos = 0, prev = null;
  const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), length = new Int32Array(4096);
  let next;
  const reset = () => { next = end + 1; size = min + 1; };
  for (let i = 0; i < clear; i++) { prefix[i] = -1; suffix[i] = i; length[i] = 1; }
  reset();
  const out = [];
  const emit = code => { const n = length[code], at = out.length; out.length += n; let c = code; for (let i = n - 1; i >= 0; i--) { out[at + i] = suffix[c]; c = prefix[c]; } return out[at]; };
  while (pos + size <= bytes.length * 8) {
    let code = 0; for (let i = 0; i < size; i++, pos++) code |= ((bytes[pos >> 3] >> (pos & 7)) & 1) << i;
    if (code === clear) { reset(); prev = null; continue; }
    if (code === end) break;
    let first;
    if (prev === null) first = emit(code);
    else if (code < next) first = emit(code);
    else if (code === next) { const f = (() => { let c = prev; while (prefix[c] >= 0) c = prefix[c]; return suffix[c]; })(); prefix[next] = prev; suffix[next] = f; length[next] = length[prev] + 1; next++; emit(code); first = f; if (next === (1 << size) && size < 12) size++; prev = code; continue; }
    else throw new Error(`bad LZW code ${code}`);
    if (prev !== null && next < 4096) { prefix[next] = prev; suffix[next] = first; length[next] = length[prev] + 1; next++; if (next === (1 << size) && size < 12) size++; }
    prev = code;
  }
  return Uint8Array.from(out);
}

/** @param {Uint8Array} gif @returns {{ w: number, h: number, loops: boolean, version: string, frames: { x: number, y: number, w: number, h: number, delay: number, rgb: Uint8Array }[] }} */
export function readGif(gif) {
  const version = String.fromCharCode(...gif.subarray(0, 6));
  const w = gif[6] | (gif[7] << 8), h = gif[8] | (gif[9] << 8), n = 2 << (gif[10] & 7);
  const table = gif.subarray(13, 13 + n * 3);
  let i = 13 + n * 3, loops = false, delay = 0;
  const canvas = new Uint8Array(w * h), frames = [];
  while (gif[i] !== 0x3B) {
    if (gif[i] === 0x21) {
      if (gif[i + 1] === 0xFF) loops = true;
      if (gif[i + 1] === 0xF9) delay = (gif[i + 4] | (gif[i + 5] << 8)) * 10;
      i += 2; while (gif[i] !== 0) i += 1 + gif[i]; i++; continue;
    }
    if (gif[i] !== 0x2C) throw new Error(`not a GIF block at ${i}: ${gif[i]}`);
    const x = gif[i + 1] | (gif[i + 2] << 8), y = gif[i + 3] | (gif[i + 4] << 8), fw = gif[i + 5] | (gif[i + 6] << 8), fh = gif[i + 7] | (gif[i + 8] << 8);
    const min = gif[i + 10]; let p = i + 11; const data = [];
    while (gif[p] !== 0) { for (let k = 0; k < gif[p]; k++) data.push(gif[p + 1 + k]); p += 1 + gif[p]; }
    const idx = lzwDecode(Uint8Array.from(data), min);
    if (idx.length !== fw * fh) throw new Error(`frame ${frames.length}: ${idx.length} indices for ${fw} by ${fh}`);
    for (let r = 0; r < fh; r++) for (let c = 0; c < fw; c++) canvas[(y + r) * w + x + c] = idx[r * fw + c];
    const rgb = new Uint8Array(w * h * 3);
    for (let k = 0; k < w * h; k++) { rgb[k * 3] = table[canvas[k] * 3]; rgb[k * 3 + 1] = table[canvas[k] * 3 + 1]; rgb[k * 3 + 2] = table[canvas[k] * 3 + 2]; }
    frames.push({ x, y, w: fw, h: fh, delay, rgb }); i = p + 1;
  }
  return { w, h, loops, version, frames };
}

/** Mean absolute difference per channel between two RGB buffers of one size, over `rect` ({ x, y, w, h }) of a `width`-wide picture or all of it. */
export function meanDiff(a, b, width, rect) {
  let sum = 0, n = 0;
  const rows = rect ? [rect.y, rect.y + rect.h] : [0, a.length / 3 / width], cols = rect ? [rect.x, rect.x + rect.w] : [0, width];
  for (let y = rows[0]; y < rows[1]; y++) for (let x = cols[0]; x < cols[1]; x++) for (let c = 0; c < 3; c++) { sum += Math.abs(a[(y * width + x) * 3 + c] - b[(y * width + x) * 3 + c]); n++; }
  return sum / n;
}

/** Mean absolute difference of two RGB pictures of one size after each is averaged in k by k blocks: dither and grain wash out, a moved word does not. */
export function blockDiff(a, b, width, k = 8, rect = null) {
  const height = a.length / 3 / width; let sum = 0, n = 0;
  for (let by = rect ? rect.y : 0; by + k <= (rect ? rect.y + rect.h : height); by += k) for (let bx = rect ? rect.x : 0; bx + k <= (rect ? rect.x + rect.w : width); bx += k) for (let c = 0; c < 3; c++) {
    let sa = 0, sb = 0;
    for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) { const i = ((by + y) * width + bx + x) * 3 + c; sa += a[i]; sb += b[i]; }
    sum += Math.abs(sa - sb) / (k * k); n++;
  }
  return sum / n;
}
