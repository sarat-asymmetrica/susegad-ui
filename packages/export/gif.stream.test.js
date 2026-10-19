import test from 'node:test';
import assert from 'node:assert/strict';
import { lzwEncode } from './gif.core.js';
import { paletteOf, indexFrameFast, createIndexer, lzwEncodeFast, createGifEncoder } from './gif.stream.js';

// A reference GIF reader, independent of the encoder: header, colour table, then each frame's rectangle painted
// over the picture so far (disposal "leave in place"), LZW decoded by the format's own rules.
function lzwDecode(bytes, minCodeSize) {
  const clear = 1 << minCodeSize, end = clear + 1;
  let size = minCodeSize + 1, pos = 0, table, prev = null;
  const out = [];
  const reset = () => { table = []; for (let i = 0; i < clear; i++) table.push([i]); table.push(null, null); size = minCodeSize + 1; };
  reset();
  const read = () => { let c = 0; for (let i = 0; i < size; i++, pos++) c |= ((bytes[pos >> 3] >> (pos & 7)) & 1) << i; return c; };
  while (pos + size <= bytes.length * 8) {
    const code = read();
    if (code === clear) { reset(); prev = null; continue; }
    if (code === end) break;
    let entry;
    if (code < table.length && table[code]) entry = table[code];
    else if (code === table.length && prev) entry = [...prev, prev[0]];
    else throw new Error(`bad code ${code}`);
    for (const v of entry) out.push(v);
    if (prev) table.push([...prev, entry[0]]);
    if (table.length === (1 << size) && size < 12) size++;
    prev = entry;
  }
  return Uint8Array.from(out);
}
function readGif(gif) {
  const w = gif[6] | (gif[7] << 8), h = gif[8] | (gif[9] << 8), n = 2 << (gif[10] & 7);
  const table = []; for (let i = 0; i < n; i++) table.push([gif[13 + i * 3], gif[14 + i * 3], gif[15 + i * 3]]);
  let i = 13 + n * 3, loops = false, delays = [];
  const canvas = new Uint8Array(w * h), shots = [];
  while (gif[i] !== 0x3B) {
    if (gif[i] === 0x21) {
      const label = gif[i + 1]; if (label === 0xFF) loops = true;
      if (label === 0xF9) delays.push((gif[i + 4] | (gif[i + 5] << 8)) * 10);
      i += 2; while (gif[i] !== 0) i += 1 + gif[i]; i++; continue;
    }
    assert.equal(gif[i], 0x2C);
    const x = gif[i + 1] | (gif[i + 2] << 8), y = gif[i + 3] | (gif[i + 4] << 8), fw = gif[i + 5] | (gif[i + 6] << 8), fh = gif[i + 7] | (gif[i + 8] << 8);
    const min = gif[i + 10]; let p = i + 11; const data = [];
    while (gif[p] !== 0) { data.push(...gif.subarray(p + 1, p + 1 + gif[p])); p += 1 + gif[p]; }
    const idx = lzwDecode(Uint8Array.from(data), min);
    assert.equal(idx.length, fw * fh, 'one index per pixel of the frame rectangle');
    for (let r = 0; r < fh; r++) for (let c = 0; c < fw; c++) canvas[(y + r) * w + x + c] = idx[r * fw + c];
    shots.push(canvas.slice()); i = p + 1;
  }
  return { w, h, table, loops, delays, shots };
}

test('lzwEncodeFast writes the same bytes as lzwEncode, including past a full dictionary', () => {
  let s = 12345; const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
  const cases = [
    [Uint8Array.from([5]), 3], [new Uint8Array(500).fill(2), 2], [Uint8Array.from({ length: 3000 }, (_, i) => i % 7), 3],
    [Uint8Array.from({ length: 30000 }, () => (rnd() * 16) | 0), 4],   // random: fills the 4096 codes and resets
    [Uint8Array.from({ length: 40000 }, (_, i) => ((i >> 3) ^ (rnd() < 0.1 ? 1 : 0)) & 255), 8],
  ];
  for (const [data, min] of cases) assert.deepEqual(lzwEncodeFast(data, min), lzwEncode(data, min), `${data.length} indices at ${min} bits`);
});

test('paletteOf: few colours pass through, many are cut to at most maxColors, and the result is the same twice', () => {
  const few = Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 255, 0, 0, 255]);
  assert.deepEqual(paletteOf([few]).sort(), [[0, 255, 0], [255, 0, 0]]);
  const many = new Uint8Array(4 * 4000); for (let i = 0; i < 4000; i++) { many[i * 4] = i % 256; many[i * 4 + 1] = (i * 7) % 256; many[i * 4 + 2] = (i * 13) % 256; many[i * 4 + 3] = 255; }
  const p = paletteOf([many], 32);
  assert.ok(p.length <= 32 && p.length > 8, `${p.length} colours`);
  assert.deepEqual(paletteOf([many], 32), p);
  // a palette that is dominated by one colour keeps that colour close
  const mostly = new Uint8Array(4 * 1000); for (let i = 0; i < 1000; i++) { mostly[i * 4] = i < 950 ? 243 : (i * 5) % 256; mostly[i * 4 + 1] = i < 950 ? 235 : (i * 9) % 256; mostly[i * 4 + 2] = i < 950 ? 220 : (i * 3) % 256; }
  const q = paletteOf([mostly], 4);
  assert.ok(q.some(([r, g, b]) => Math.abs(r - 243) < 6 && Math.abs(g - 235) < 6 && Math.abs(b - 220) < 6), JSON.stringify(q));
});

test('indexFrameFast picks the nearest entry, and a dither moves a flat grey between two entries without leaving the palette', () => {
  const palette = [[0, 0, 0], [255, 255, 255], [200, 30, 30]];
  const px = Uint8Array.from([250, 250, 250, 255, 10, 10, 10, 255, 190, 40, 40, 255]);
  assert.deepEqual([...indexFrameFast(px, palette)], [1, 0, 2]);
  const grey = new Uint8Array(4 * 16 * 16).fill(128);
  const flat = indexFrameFast(grey, [[0, 0, 0], [255, 255, 255]], { width: 16, dither: 0 });
  assert.equal(new Set(flat).size, 1);
  const dith = indexFrameFast(grey, [[0, 0, 0], [255, 255, 255]], { width: 16, dither: 80 });
  assert.equal(new Set(dith).size, 2, 'both entries used');
  assert.deepEqual(dith, indexFrameFast(grey, [[0, 0, 0], [255, 255, 255]], { width: 16, dither: 80 }), 'deterministic');
});

test('createGifEncoder: a whole first frame and two sub-rectangle frames read back as the pictures they were', () => {
  const width = 12, height = 8, palette = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]];
  const enc = createGifEncoder({ width, height, palette });
  const f0 = Uint8Array.from({ length: width * height }, (_, i) => i % 5);
  enc.addFrame(f0, 100);
  const rect = { x: 3, y: 2, w: 5, h: 4 };
  const f1 = Uint8Array.from({ length: 20 }, (_, i) => (i + 1) % 5), f2 = Uint8Array.from({ length: 20 }, (_, i) => (i * 3) % 4);
  enc.addFrame(f1, 100, rect); enc.addFrame(f2, 200, rect);
  assert.equal(enc.frames, 3);
  const bytes = enc.finish();
  assert.equal(String.fromCharCode(...bytes.subarray(0, 6)), 'GIF89a');
  assert.equal(bytes.at(-1), 0x3B);
  const g = readGif(bytes);
  assert.equal(g.w, width); assert.equal(g.h, height); assert.equal(g.loops, true);
  assert.deepEqual(g.delays, [100, 100, 200]);
  assert.deepEqual(g.table.slice(0, 5), palette);
  assert.deepEqual(g.shots[0], f0);
  const expect = (patch) => { const c = f0.slice(); for (let r = 0; r < rect.h; r++) for (let k = 0; k < rect.w; k++) c[(rect.y + r) * width + rect.x + k] = patch[r * rect.w + k]; return c; };
  assert.deepEqual(g.shots[1], expect(f1));
  assert.deepEqual(g.shots[2], expect(f2));
  assert.deepEqual(g.shots[2].slice(0, 12), f0.slice(0, 12), 'outside the rectangle the first frame stays');
});

test('createGifEncoder: a frame whose indices do not fill its rectangle is refused, and loop can be left out', () => {
  const enc = createGifEncoder({ width: 4, height: 4, palette: [[0, 0, 0], [1, 1, 1]], loop: false });
  assert.throws(() => enc.addFrame(new Uint8Array(15), 100), /needs 16/);
  enc.addFrame(new Uint8Array(16), 100);
  assert.equal(readGif(enc.finish()).loops, false);
});

test('createIndexer gives the same indices as indexFrameFast, frame after frame, with its lookup kept between frames', async () => {
  const palette = [[0, 0, 0], [255, 255, 255], [200, 30, 30], [30, 30, 200]];
  const a = Uint8ClampedArray.from({ length: 256 }, (_, i) => (i % 4 === 3 ? 255 : (i * 37) % 256));
  const b = Uint8ClampedArray.from({ length: 256 }, (_, i) => (i % 4 === 3 ? 255 : (i * 91 + 5) % 256));
  for (const dither of [0, 6]) {
    const ix = createIndexer(palette, { dither });
    assert.deepEqual(ix.index(a, 8), indexFrameFast(a, palette, { width: 8, dither }));
    assert.deepEqual(await createIndexer(palette, { dither }).indexSliced(a, 8, async () => {}, 9), ix.index(a, 8), 'in slices of 9 pixels, the same');
    assert.deepEqual(ix.index(b, 8), indexFrameFast(b, palette, { width: 8, dither }));
    assert.deepEqual(ix.index(a, 8), indexFrameFast(a, palette, { width: 8, dither }), 'a second pass over the first frame is unchanged');
  }
});

test('addFrameSliced writes the same bytes as addFrame, pausing between slices', async () => {
  const palette = [[0, 0, 0], [255, 255, 255], [200, 30, 30], [30, 30, 200]], W = 40, H = 30;
  const idx = Uint8Array.from({ length: W * H }, (_, i) => ((i * 7) ^ (i >> 3)) & 3);
  const whole = createGifEncoder({ width: W, height: H, palette }), sliced = createGifEncoder({ width: W, height: H, palette });
  whole.addFrame(idx, 100); whole.addFrame(idx.slice(0, 12 * 10), 100, { x: 5, y: 5, w: 12, h: 10 });
  let pauses = 0;
  await sliced.addFrameSliced(idx, 100, undefined, async () => { pauses++; }, 250);
  await sliced.addFrameSliced(idx.slice(0, 12 * 10), 100, { x: 5, y: 5, w: 12, h: 10 }, async () => { pauses++; }, 50);
  assert.deepEqual(sliced.finish(), whole.finish());
  assert.equal(pauses, 4 + 2, '1200 pixels in slices of 250 pause 4 times, 120 in slices of 50 pause twice');
});
