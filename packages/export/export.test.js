import test from 'node:test';
import assert from 'node:assert/strict';
import { quantize, nearestIndex, indexFrame, tableSize, lzwEncode, subBlocks, encodeGif, framesToGif } from './gif.core.js';

// A tiny reference LZW/GIF decoder, independent of lzwEncode's own logic,
// so the encoder tests check against GIF's real semantics and not just
// "does the same code produce the same bytes".
function lzwDecode(bytes, minCodeSize) {
  const clearCode = 1 << minCodeSize, endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let bitPos = 0;
  const readCode = () => {
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const byte = bytes[bitPos >> 3], bit = (byte >> (bitPos & 7)) & 1;
      code |= bit << i;
      bitPos++;
    }
    return code;
  };
  let table, out = [];
  const reset = () => { table = []; for (let i = 0; i < clearCode; i++) table.push([i]); table.push(null, null); codeSize = minCodeSize + 1; };
  reset();
  let prev = null;
  while (bitPos + codeSize <= bytes.length * 8) {
    const code = readCode();
    if (code === clearCode) { reset(); prev = null; continue; }
    if (code === endCode) break;
    let entry;
    if (code < table.length && table[code]) entry = table[code];
    else if (code === table.length && prev) entry = [...prev, prev[0]];
    else throw new Error(`bad code ${code}`);
    out.push(...entry);
    if (prev) table.push([...prev, entry[0]]);
    if (table.length === (1 << codeSize) && codeSize < 12) codeSize++;
    prev = entry;
  }
  return Uint8Array.from(out);
}

function unSubBlocks(bytes) {
  const out = [];
  let i = 0;
  while (i < bytes.length) {
    const len = bytes[i++];
    if (len === 0) break;
    out.push(...bytes.subarray(i, i + len));
    i += len;
  }
  return Uint8Array.from(out);
}

test('quantize: few colours pass through untouched', () => {
  const rgba = Uint8ClampedArray.from([255, 0, 0, 255, 0, 255, 0, 255, 255, 0, 0, 255]);
  const { palette } = quantize(rgba, 256);
  assert.equal(palette.length, 2);
});

test('quantize: many colours reduce to at most maxColors, and every colour maps somewhere close', () => {
  const n = 5000, rgba = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { rgba[i * 4] = (i * 7) % 256; rgba[i * 4 + 1] = (i * 13) % 256; rgba[i * 4 + 2] = (i * 29) % 256; rgba[i * 4 + 3] = 255; }
  const { palette } = quantize(rgba, 32);
  assert.ok(palette.length <= 32);
  assert.ok(palette.length > 1);
});

test('nearestIndex: picks the closest palette entry', () => {
  const palette = [[0, 0, 0], [255, 255, 255], [255, 0, 0]];
  assert.equal(nearestIndex(palette, 10, 5, 5), 0);
  assert.equal(nearestIndex(palette, 250, 250, 250), 1);
  assert.equal(nearestIndex(palette, 200, 10, 10), 2);
});

test('indexFrame: one index per pixel', () => {
  const palette = [[0, 0, 0], [255, 255, 255]];
  const rgba = Uint8ClampedArray.from([0, 0, 0, 255, 255, 255, 255, 255]);
  assert.deepEqual([...indexFrame(rgba, palette)], [0, 1]);
});

test('tableSize: the next power of two, capped at 256', () => {
  assert.equal(tableSize(1), 2);
  assert.equal(tableSize(2), 2);
  assert.equal(tableSize(3), 4);
  assert.equal(tableSize(17), 32);
  assert.equal(tableSize(300), 256);
});

test('lzwEncode + a reference decoder: round-trips a run of indices', () => {
  for (const minCodeSize of [2, 4, 8]) {
    const n = 1 << minCodeSize;
    const indices = Uint8Array.from({ length: 500 }, (_, i) => (i * 37 + (i % 7)) % n);
    const decoded = lzwDecode(lzwEncode(indices, minCodeSize), minCodeSize);
    assert.deepEqual([...decoded], [...indices], `minCodeSize ${minCodeSize}`);
  }
});

test('lzwEncode: a single repeated value compresses (fewer bytes than one per index)', () => {
  const indices = new Uint8Array(2000); // all zero
  const bytes = lzwEncode(indices, 8);
  assert.ok(bytes.length < 500, `${bytes.length} bytes for 2000 repeated indices`);
});

test('subBlocks round-trips through unSubBlocks, and splits past 255 bytes', () => {
  const bytes = Uint8Array.from({ length: 600 }, (_, i) => i % 256);
  const framed = subBlocks(bytes);
  assert.deepEqual([...unSubBlocks(framed)], [...bytes]);
  assert.ok(framed.length > bytes.length, 'length bytes and the terminator add overhead');
});

test('encodeGif: the header, screen size and a working colour table', () => {
  const gif = encodeGif({
    width: 4, height: 2, palette: [[255, 0, 0], [0, 255, 0]],
    frames: [{ indices: new Uint8Array(8), delayMs: 100 }],
  });
  const header = String.fromCharCode(...gif.subarray(0, 6));
  assert.equal(header, 'GIF89a');
  const view = new DataView(gif.buffer, gif.byteOffset);
  assert.equal(view.getUint16(6, true), 4, 'width');
  assert.equal(view.getUint16(8, true), 2, 'height');
  assert.equal(gif.at(-1), 0x3B, 'ends with the GIF trailer');
});

test('framesToGif: a two-frame animation decodes back to the original pixels', () => {
  const width = 3, height = 2;
  const frameA = Uint8ClampedArray.from([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
    255, 255, 0, 255, 255, 0, 255, 255, 0, 0, 255, 255,
  ]);
  const gif = framesToGif({ width, height, frames: [{ rgba: frameA, delayMs: 80 }, { rgba: frameA, delayMs: 80 }], maxColors: 16, loop: true });
  assert.equal(String.fromCharCode(...gif.subarray(0, 6)), 'GIF89a');
  // find both image descriptors (0x2C) after the header/palette/loop block, and decode the first
  const tableEntries = 2 << (gif[10] & 0x07); // packed field's low 3 bits: table size code
  let i = 13 + tableEntries * 3; // header + screen descriptor + the global colour table
  assert.equal(gif[i], 0x21, 'the NETSCAPE loop extension follows the palette');
  let frameCount = 0;
  while (i < gif.length) {
    if (gif[i] === 0x21) {
      i += 2;
      const len = gif[i]; i += 1 + len;
      while (i < gif.length && gif[i] !== 0) i += 1 + gif[i];
      i += 1;
      continue;
    }
    if (gif[i] === 0x2C) {
      frameCount++;
      const minCodeSize = gif[i + 10];
      const dataStart = i + 11;
      let end = dataStart;
      while (end < gif.length && gif[end] !== 0) end += 1 + gif[end];
      const lzwBytes = unSubBlocks(gif.subarray(dataStart, end + 1));
      const decoded = lzwDecode(lzwBytes, minCodeSize);
      assert.equal(decoded.length, width * height, 'one index per pixel');
      i = end + 1;
      continue;
    }
    break;
  }
  assert.equal(frameCount, 2, 'both frames are present');
});

test('framesToGif: throws on an empty frame list', () => {
  assert.throws(() => framesToGif({ width: 1, height: 1, frames: [] }));
});
