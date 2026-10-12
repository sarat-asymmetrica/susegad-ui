// QR: the pure core. Runs in Node. No dependency.
//
// text -> module matrix, written from ISO/IEC 18004: mode choice (numeric,
// alphanumeric, byte as UTF-8), the smallest version that fits, Reed-Solomon
// over GF(256), block interleaving, the eight masks scored with the four
// penalty rules, format and version information. The tests check the Annex
// example and matrices from a reference encoder (see qr.core.test.js).
// The payload helpers and the frame drawing are in qr.helpers.js.

/** The component adds no words of its own: the builder's text and label are the content. */
export const STRINGS = { label: 'QR code' };

export const ECC_LEVELS = ['L', 'M', 'Q', 'H'];
export const eccOf = v => (ECC_LEVELS.includes(String(v).toUpperCase()) ? String(v).toUpperCase() : 'M');

// Error-correction codewords per block and number of blocks, by level then version (index 0 unused).
const ECC_PER_BLOCK = [
  [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const BLOCKS = [
  [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const MODE = { numeric: 1, alphanumeric: 2, byte: 4 };
const COUNT_BITS = { numeric: [10, 12, 14], alphanumeric: [9, 11, 13], byte: [8, 16, 16] };

/** The cheapest mode that can carry the text: numeric, then alphanumeric (capitals), else byte. */
export function modeOf(text) {
  if (/^[0-9]*$/.test(text)) return 'numeric';
  for (const ch of text) if (!ALNUM.includes(ch)) return 'byte';
  return 'alphanumeric';
}

const utf8 = text => [...new TextEncoder().encode(text)];

// Modules in the symbol that carry data and error correction (everything but the function patterns).
function rawModules(v) {
  let n = (16 * v + 128) * v + 64;
  if (v >= 2) { const a = Math.floor(v / 7) + 2; n -= (25 * a - 10) * a - 55; if (v >= 7) n -= 36; }
  return n;
}
const dataCodewords = (v, ecc) => {
  const l = ECC_LEVELS.indexOf(ecc);
  return Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[l][v] * BLOCKS[l][v];
};

const dataBitCount = (mode, n) => mode === 'numeric' ? 10 * Math.floor(n / 3) + (n % 3 ? (n % 3) * 3 + 1 : 0)
  : mode === 'alphanumeric' ? 11 * Math.floor(n / 2) + 6 * (n % 2) : 8 * n;
const countBits = (mode, v) => COUNT_BITS[mode][v < 10 ? 0 : v < 27 ? 1 : 2];

/**
 * How many characters of a mode fit in a version at a level (bytes for byte mode).
 * @returns {number}
 */
export function capacity(version, ecc, mode = 'byte') {
  const bits = dataCodewords(version, eccOf(ecc)) * 8 - 4 - countBits(mode, version);
  if (bits < 0) return 0;
  return mode === 'numeric' ? 3 * Math.floor(bits / 10) + (bits % 10 >= 7 ? 2 : bits % 10 >= 4 ? 1 : 0)
    : mode === 'alphanumeric' ? 2 * Math.floor(bits / 11) + (bits % 11 >= 6 ? 1 : 0) : Math.floor(bits / 8);
}

// ── Reed-Solomon over GF(256), polynomial 0x11D ─────────────────────────
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function generator(degree) {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(g.length + 1).fill(0);
    g.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= mul(c, EXP[i]); });
    g = next;
  }
  return g; // highest degree first, leading 1
}
function remainder(data, degree) {
  const g = generator(degree), r = new Array(degree).fill(0);
  for (const b of data) {
    const f = b ^ r.shift();
    r.push(0);
    for (let i = 0; i < degree; i++) r[i] ^= mul(g[i + 1], f);
  }
  return r;
}

/** Data bits (mode, count, payload, terminator, padding) as codewords, then interleaved with their error correction (a test hook as well). */
export function codewords(text, mode, version, ecc) {
  const bits = [];
  const put = (value, len) => { for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  const bytes = mode === 'byte' ? utf8(text) : null;
  const count = bytes ? bytes.length : text.length;
  if (count) { put(MODE[mode], 4); put(count, countBits(mode, version)); }
  if (mode === 'numeric') for (let i = 0; i < count; i += 3) { const g = text.slice(i, i + 3); put(+g, g.length * 3 + 1); }
  else if (mode === 'alphanumeric') for (let i = 0; i < count; i += 2) {
    if (i + 1 < count) put(ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11); else put(ALNUM.indexOf(text[i]), 6);
  } else for (const b of bytes) put(b, 8);

  const total = dataCodewords(version, ecc) * 8;
  put(0, Math.min(4, total - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < total; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  const l = ECC_LEVELS.indexOf(ecc), nBlocks = BLOCKS[l][version], eccLen = ECC_PER_BLOCK[l][version];
  const shortBlocks = nBlocks - (Math.floor(rawModules(version) / 8) % nBlocks), shortLen = Math.floor(data.length / nBlocks);
  const blocks = [];
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const len = shortLen + (i < shortBlocks ? 0 : 1), d = data.slice(k, k + len);
    k += len;
    blocks.push({ d, e: remainder(d, eccLen) });
  }
  const out = [];
  for (let i = 0; i <= shortLen; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < eccLen; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}

const alignmentPositions = v => {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, size = v * 4 + 17;
  const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const pos = [6];
  for (let p = size - 7, i = n - 1; i >= 1; i--, p -= step) pos.splice(1, 0, p);
  return pos;
};

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** The four penalty rules of the standard, summed. Lower reads better to a scanner. */
export function penalty(m, size) {
  let score = 0, dark = 0;
  const line = at => {
    // runs of one colour along a line, from the first module to the last
    const runs = []; let colour = at(0), len = 1;
    for (let i = 1; i < size; i++) { if (at(i) === colour) len++; else { runs.push(len); colour = at(i); len = 1; } }
    runs.push(len);
    for (const r of runs) if (r >= 5) score += 3 + r - 5;
    // light border before and after, then the 1:1:3:1:1 finder shape with light on either side
    const p = at(0) ? [size, ...runs] : [size + runs[0], ...runs.slice(1)];
    if (at(size - 1)) p.push(size); else p[p.length - 1] += size;
    for (let j = 6; j < p.length; j += 2) {
      const n = p[j - 1];
      if (n > 0 && p[j - 2] === n && p[j - 3] === 3 * n && p[j - 4] === n && p[j - 5] === n) {
        if (p[j] >= 4 * n && p[j - 6] >= n) score += 40;
        if (p[j - 6] >= 4 * n && p[j] >= n) score += 40;
      }
    }
  };
  for (let i = 0; i < size; i++) { line(j => m[i * size + j]); line(j => m[j * size + i]); }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = m[y * size + x];
    dark += c;
    if (x < size - 1 && y < size - 1 && c === m[y * size + x + 1] && c === m[(y + 1) * size + x] && c === m[(y + 1) * size + x + 1]) score += 3;
  }
  const total = size * size;
  return score + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
}

/**
 * Encode text as a QR symbol.
 *
 * @param {string} text
 * @param {{ ecc?: 'L'|'M'|'Q'|'H', minVersion?: number, maxVersion?: number, mask?: number }} [opts]
 *   `mask` (0 to 7) forces a mask; by default the lowest-penalty mask is chosen.
 * @returns {{ version: number, size: number, ecc: string, mode: string, mask: number, rows: string[] }}
 *   `rows[y][x]` is '1' for a dark module.
 * @throws {RangeError} when the text does not fit in version 40 at that level
 */
export function encode(text, { ecc = 'M', minVersion = 1, maxVersion = 40, mask = -1 } = {}) {
  text = String(text ?? '');
  ecc = eccOf(ecc);
  const mode = modeOf(text), n = mode === 'byte' ? utf8(text).length : text.length, bits = dataBitCount(mode, n);
  let version = Math.max(1, minVersion);
  while (version <= maxVersion && (n ? 4 + countBits(mode, version) + bits : 0) > dataCodewords(version, ecc) * 8) version++;
  if (version > maxVersion) throw new RangeError(`That text is too long for a QR code at level ${ecc}: the most it holds is ${capacity(maxVersion, ecc, mode)} ${mode === 'byte' ? 'bytes' : 'characters'} (${n} given). Shorten it or lower the error correction.`);

  const size = version * 4 + 17, data = codewords(text, mode, version, ecc);
  const m = new Uint8Array(size * size), fn = new Uint8Array(size * size);
  const set = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y * size + x] = +dark; fn[y * size + x] = 1; } };
  const bit = (v, i) => ((v >>> i) & 1) === 1;

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); }
  }
  const al = alignmentPositions(version);
  for (let a = 0; a < al.length; a++) for (let b = 0; b < al.length; b++) {
    if ((a === 0 && b === 0) || (a === 0 && b === al.length - 1) || (a === al.length - 1 && b === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[a] + dx, al[b] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const format = mk => {
    const d = (FORMAT_BITS[ecc] << 3) | mk;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const f = ((d << 10) | r) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(f, i));
    set(8, 7, bit(f, 6)); set(8, 8, bit(f, 7)); set(7, 8, bit(f, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(f, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(f, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(f, i));
    set(8, size - 8, true);
  };
  format(0); // reserve the format area as function modules
  if (version >= 7) {
    let r = version;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const v = (version << 12) | r;
    for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, bit(v, i)); set(b, a, bit(v, i)); }
  }

  // data bits, in the standard's zigzag of two-module columns from the right
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - v : v;
      if (!fn[y * size + x] && k < data.length * 8) { m[y * size + x] = (data[k >>> 3] >>> (7 - (k & 7))) & 1; k++; }
    }
  }
  const apply = mk => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y * size + x] && MASKS[mk](x, y)) m[y * size + x] ^= 1; };
  if (mask < 0) {
    let best = Infinity;
    for (let mk = 0; mk < 8; mk++) {
      apply(mk); format(mk);
      const p = penalty(m, size);
      if (p < best) { best = p; mask = mk; }
      apply(mk);
    }
  }
  apply(mask); format(mask);
  const rows = [];
  for (let y = 0; y < size; y++) rows.push(Array.from(m.subarray(y * size, (y + 1) * size), c => c).join(''));
  return { version, size, ecc, mode, mask, rows };
}

/**
 * The dark modules as one SVG path in a square viewBox, with a quiet zone of
 * `quiet` light modules on every side (the standard asks for 4).
 * @returns {{ size: number, d: string }}
 */
export function pathData(rows, quiet = 4) {
  let d = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '1') continue;
      let end = x;
      while (end + 1 < row.length && row[end + 1] === '1') end++;
      const len = end - x + 1;
      d += `M${x + quiet} ${y + quiet}h${len}v1h-${len}z`;
      x = end;
    }
  });
  return { size: rows.length + 2 * quiet, d };
}
