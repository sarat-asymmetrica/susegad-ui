// The cases that hold header.core.js to what it is for, as functions of the module, so header.test.js runs them on
// the real file and mutants.test.js on broken copies. The bytes are built here (synthetic headers, written to the
// formats' specifications, so the odd corners can be reached) and, when sharp is installed, by real encoders
// (so the parser is also held to what libraries really write). Tests only; it does not ship.

import assert from 'node:assert/strict';

const u16 = n => [n >> 8 & 255, n & 255], u32 = n => [n >>> 24, n >> 16 & 255, n >> 8 & 255, n & 255];
const l16 = n => [n & 255, n >> 8 & 255], l24 = n => [n & 255, n >> 8 & 255, n >> 16 & 255], l32 = n => [n & 255, n >> 8 & 255, n >> 16 & 255, n >>> 24];
const ascii = s => [...s].map(c => c.charCodeAt(0));
const flat = parts => parts.flatMap(p => (Array.isArray(p) ? flat(p) : ArrayBuffer.isView(p) ? [...p] : [p]));
const bytes = (...parts) => Uint8Array.from(flat(parts));

// ── builders ───────────────────────────────────────────────────────────────
export const png = (w, h) => bytes(0x89, ascii('PNG'), 13, 10, 26, 10, u32(13), ascii('IHDR'), u32(w), u32(h), 8, 2, 0, 0, 0, u32(0), u32(0), ascii('IEND'));
export const gif = (w, h) => bytes(ascii('GIF89a'), l16(w), l16(h), 0xf7, 0, 0, new Array(40).fill(0));

/** An EXIF APP1 segment holding only the orientation tag. */
export function exif(orientation, little = true) {
  const e = little ? l16 : u16, f = little ? l32 : u32;
  const tiff = [ascii(little ? 'II' : 'MM'), e(42), f(8), e(1), e(0x0112), e(3), f(1), e(orientation), e(0), f(0)];
  const body = bytes(ascii('Exif'), 0, 0, tiff);
  return bytes(0xff, 0xe1, u16(body.length + 2), body);
}
/** A JPEG up to and including its frame header (and a stub of scan data). `frame` is the SOF marker's low byte. */
export function jpeg(w, h, { orientation, little = true, frame = 0xc0, before = [], afterExif = [] } = {}) {
  return bytes(0xff, 0xd8, 0xff, 0xe0, u16(16), ascii('JFIF'), 0, 1, 1, 0, u16(1), u16(1), 0, 0,
    orientation ? exif(orientation, little) : [], afterExif,
    0xff, 0xdb, u16(5), 0, 1, 2,                                  // a quantisation table stub
    before,
    0xff, frame, u16(11), 8, u16(h), u16(w), 1, 1, 0x11, 0,       // the frame header, one component
    0xff, 0xda, u16(4), 0, 0, 1, 2, 3);
}
/** WebP: 'lossy' (VP8), 'lossless' (VP8L) or 'extended' (VP8X). */
export function webp(kind, w, h) {
  const chunk = kind === 'lossy' ? [ascii('VP8 '), l32(10), 0, 0, 0, 0x9d, 0x01, 0x2a, l16(w), l16(h)]
    : kind === 'lossless' ? [ascii('VP8L'), l32(5), 0x2f, l32((w - 1) | ((h - 1) << 14))]
      : [ascii('VP8X'), l32(10), 0x10, 0, 0, 0, l24(w - 1), l24(h - 1)];
  const body = bytes(ascii('WEBP'), chunk, new Array(8).fill(0));
  return bytes(ascii('RIFF'), l32(body.length), body);
}
const box = (type, ...payload) => { const p = bytes(payload); return bytes(u32(p.length + 8), ascii(type), p); };
const full = (type, version, flags, ...payload) => box(type, version, 0, 0, flags, payload);
/**
 * AVIF's boxes. `items` are the images in the file as { id, w, h, rot? }, in property order; `primary` is the id
 * `pitm` names; `wide` writes 16-bit property associations and a version 1 `pitm`/`ipma`.
 */
export function avif(items, primary, { wide = false } = {}) {
  const props = [], assoc = [];
  for (const it of items) {
    const mine = [];
    props.push(full('ispe', 0, 0, u32(it.w), u32(it.h))); mine.push(props.length);
    if (it.rot !== undefined) { props.push(box('irot', it.rot)); mine.push(props.length); }
    assoc.push(wide ? [u32(it.id), mine.length, mine.map(i => u16(0x8000 | i))] : [u16(it.id), mine.length, mine.map(i => 0x80 | i)]);
  }
  const iprp = box('iprp', box('ipco', props), full('ipma', wide ? 1 : 0, wide ? 1 : 0, u32(items.length), assoc));
  const pitm = full('pitm', wide ? 1 : 0, 0, wide ? u32(primary) : u16(primary));
  const meta = full('meta', 0, 0, full('hdlr', 0, 0, u32(0), ascii('pict'), new Array(12).fill(0), 0), pitm, iprp);
  return bytes(box('ftyp', ascii('avif'), u32(0), ascii('avif'), ascii('mif1')), meta, box('mdat', new Array(64).fill(7)));
}

const dims = (mod, b) => { const r = mod.readHeader(b); return r && !r.more ? [r.w, r.h] : r; };

// ── real encoder output (when sharp is there) ──────────────────────────────
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* the synthetic cases still run */ }
export const HAVE_SHARP = !!sharp;
const real = {};
if (sharp) {
  const base = (w, h, ch = 3) => sharp({ create: { width: w, height: h, channels: ch, background: ch === 4 ? { r: 200, g: 90, b: 40, alpha: 0.5 } : { r: 200, g: 90, b: 40 } } });
  const enc = async (name, img) => { try { real[name] = new Uint8Array(await img.toBuffer()); } catch { /* this build of sharp lacks the encoder */ } };
  await enc('png', base(321, 123).png());
  await enc('jpeg', base(333, 222).jpeg());
  await enc('jpeg-progressive', base(333, 222).jpeg({ progressive: true }));
  for (const o of [1, 2, 3, 4, 5, 6, 7, 8]) await enc(`jpeg-o${o}`, base(300, 200).withMetadata({ orientation: o }).jpeg());
  await enc('webp-lossy', base(310, 205).webp());
  await enc('webp-lossless', base(310, 205).webp({ lossless: true }));
  await enc('webp-alpha', base(310, 205, 4).webp());
  await enc('gif', base(111, 77).gif());
  await enc('avif', base(160, 90).avif({ effort: 0 }));
}
export const REAL = real;

/** [name, (mod) => void] */
export const CASES = [
  ['png: the size is in the first 24 bytes', mod => {
    assert.deepEqual(dims(mod, png(1920, 1080)), [1920, 1080]);
    assert.deepEqual(dims(mod, png(7, 9)), [7, 9]);
    assert.deepEqual(mod.readHeader(png(100, 50).subarray(0, 23)), { more: true }, 'one byte short');
    assert.equal(mod.readHeader(png(0, 50)), null, 'a zero width is broken');
  }],
  ['gif: little-endian size after the signature', mod => {
    assert.deepEqual(dims(mod, gif(640, 480)), [640, 480]);
    assert.deepEqual(dims(mod, gif(300, 2)), [300, 2], 'a byte above 255 and a byte below');
    assert.deepEqual(mod.readHeader(gif(1, 1).subarray(0, 9)), { more: true });
  }],
  ['jpeg: the size comes from the frame header, big-endian, height first', mod => {
    assert.deepEqual(dims(mod, jpeg(640, 480)), [640, 480]);
    assert.deepEqual(dims(mod, jpeg(4000, 3000)), [4000, 3000]);
    assert.deepEqual(dims(mod, jpeg(300, 1024)), [300, 1024], 'a byte above 255 in the height, none in the width');
  }],
  ['jpeg: every kind of frame header, and not the tables that look like one', mod => {
    for (const sof of [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]) assert.deepEqual(dims(mod, jpeg(111, 222, { frame: sof })), [111, 222], `SOF 0x${sof.toString(16)}`);
    const dht = bytes(0xff, 0xc4, u16(6), 0, 9, 9, 9);          // a Huffman table: marker C4 is not a frame
    assert.deepEqual(dims(mod, jpeg(80, 60, { before: dht })), [80, 60], 'DHT before the frame is stepped over');
    const fill = bytes(0xff, 0xff, 0xff, 0xff, 0xfe, u16(5), 65, 66, 67); // fill bytes, then a comment
    assert.deepEqual(dims(mod, jpeg(81, 61, { before: fill })), [81, 61]);
    assert.equal(mod.readHeader(bytes(0xff, 0xd8, 0xff, 0xda, u16(4), 0, 0, 0, 0, 0, 0, 0, 0, 0)), null, 'image data with no frame header');
  }],
  ['jpeg: EXIF orientation 5 to 8 turns the picture, in either byte order', mod => {
    for (const little of [true, false]) {
      for (const o of [1, 2, 3, 4]) assert.deepEqual(dims(mod, jpeg(640, 480, { orientation: o, little })), [640, 480], `orientation ${o} (${little ? 'II' : 'MM'}) does not turn`);
      for (const o of [5, 6, 7, 8]) assert.deepEqual(dims(mod, jpeg(640, 480, { orientation: o, little })), [480, 640], `orientation ${o} (${little ? 'II' : 'MM'}) turns`);
    }
    assert.equal(mod.readHeader(jpeg(640, 480, { orientation: 6 })).orientation, 6, 'and it says so');
    assert.deepEqual(dims(mod, jpeg(640, 480, { orientation: 9 })), [640, 480], 'an orientation out of range is ignored');
    assert.deepEqual(dims(mod, jpeg(640, 480, { orientation: 6, frame: 0xc2 })), [480, 640], 'progressive too');
  }],
  ['jpeg: a header cut short is "more", never wrong dimensions', mod => {
    const b = jpeg(640, 480, { orientation: 6 }), end = b.length - 13; // the answer is in the frame header's ninth byte; 13 bytes of frame header and scan stub follow it
    for (let n = 2; n < end; n++) {
      const r = mod.readHeader(b.subarray(0, n));
      assert.ok(r === null ? false : r.more === true, `a prefix of ${n} of ${end} bytes should ask for more, got ${JSON.stringify(r)}`);
    }
    assert.deepEqual(dims(mod, b.subarray(0, end)), [480, 640], 'at the end of the frame header it answers');
  }],
  ['webp: lossy, lossless and extended each keep their own size field', mod => {
    assert.deepEqual(dims(mod, webp('lossy', 640, 480)), [640, 480]);
    assert.deepEqual(dims(mod, webp('lossless', 640, 480)), [640, 480]);
    assert.deepEqual(dims(mod, webp('extended', 640, 480)), [640, 480]);
    assert.deepEqual(dims(mod, webp('lossless', 16384, 1)), [16384, 1], 'the 14-bit maximum');
    assert.deepEqual(dims(mod, webp('extended', 70000, 3)), [70000, 3], 'the 24-bit field');
    const lossy = webp('lossy', 300, 200); lossy[29] |= 0x40; // the top two bits of the height are a scale hint, not size
    assert.deepEqual(dims(mod, lossy), [300, 200 + 0], 'the scale bits are masked off');
    assert.deepEqual(mod.readHeader(webp('lossy', 5, 5).subarray(0, 29)), { more: true });
  }],
  ['avif: the size is the primary item\'s ispe, not the first one in the file', mod => {
    assert.deepEqual(dims(mod, avif([{ id: 1, w: 640, h: 480 }], 1)), [640, 480]);
    const thumbFirst = avif([{ id: 2, w: 160, h: 120 }, { id: 1, w: 1280, h: 720 }], 1);
    assert.deepEqual(dims(mod, thumbFirst), [1280, 720], 'the thumbnail comes first, the primary item second');
    assert.deepEqual(dims(mod, avif([{ id: 2, w: 160, h: 120 }, { id: 1, w: 1280, h: 720 }], 2)), [160, 120], 'and the other way round when pitm says so');
    assert.deepEqual(dims(mod, avif([{ id: 2, w: 160, h: 120 }, { id: 1, w: 1280, h: 720 }], 1, { wide: true })), [1280, 720], '16-bit associations and version 1 boxes');
  }],
  ['avif: irot turns the picture a quarter at 90 and 270, not at 180', mod => {
    for (const [rot, want] of [[0, [640, 480]], [1, [480, 640]], [2, [640, 480]], [3, [480, 640]]]) {
      assert.deepEqual(dims(mod, avif([{ id: 1, w: 640, h: 480, rot }], 1)), want, `irot ${rot}`);
    }
    const mixed = avif([{ id: 2, w: 160, h: 120, rot: 1 }, { id: 1, w: 640, h: 480 }], 1);
    assert.deepEqual(dims(mod, mixed), [640, 480], 'the thumbnail\'s rotation is not the primary item\'s');
  }],
  ['avif: cut inside the headers is "more"; other brands are not avif', mod => {
    const b = avif([{ id: 1, w: 640, h: 480 }], 1), end = b.length - 72; // 72 = the mdat box
    for (let n = 12; n < end; n += 3) {
      const r = mod.readHeader(b.subarray(0, n));
      assert.ok(r && (r.more || (r.w === 640 && r.h === 480)), `a prefix of ${n} bytes must not give a wrong answer: ${JSON.stringify(r)}`);
    }
    const heic = Uint8Array.from(b); heic.set(ascii('heic'), 8); heic.set(ascii('mif2'), 16); heic.set(ascii('msf1'), 20);
    assert.equal(mod.readHeader(heic), null, 'a HEIC file: no browser draws it');
  }],
  ['not a picture: empty, text and markup are null, and a start that could still be a picture waits', mod => {
    assert.deepEqual(mod.readHeader(new Uint8Array(0)), { more: true });
    assert.equal(mod.readHeader(Uint8Array.from(ascii('<!doctype html><html><body>hello</body></html>'))), null);
    assert.equal(mod.readHeader(Uint8Array.from(ascii('{"error":"not found"}'))), null);
    assert.equal(mod.readHeader(Uint8Array.from(ascii('hi'))), null, 'two bytes that rule every format out');
    assert.deepEqual(mod.readHeader(Uint8Array.from([0x89, 0x50])), { more: true }, 'two bytes that could be a PNG');
    assert.doesNotThrow(() => mod.readHeader(null));
    assert.doesNotThrow(() => mod.readHeader(Uint8Array.from({ length: 200 }, (_, i) => (i * 37) & 255)));
  }],
  ['real encoders: the sizes sharp writes (skipped without sharp)', mod => {
    const want = { png: [321, 123], jpeg: [333, 222], 'jpeg-progressive': [333, 222], 'webp-lossy': [310, 205], 'webp-lossless': [310, 205], 'webp-alpha': [310, 205], gif: [111, 77], avif: [160, 90] };
    for (const [k, w] of Object.entries(want)) if (real[k]) assert.deepEqual(dims(mod, real[k]), w, `${k}`);
    for (const o of [1, 2, 3, 4]) if (real[`jpeg-o${o}`]) assert.deepEqual(dims(mod, real[`jpeg-o${o}`]), [300, 200], `orientation ${o}`);
    for (const o of [5, 6, 7, 8]) if (real[`jpeg-o${o}`]) assert.deepEqual(dims(mod, real[`jpeg-o${o}`]), [200, 300], `orientation ${o}`);
  }],
];
