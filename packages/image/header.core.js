// A picture's size from its first bytes. Pure: bytes in, numbers out, no network and no decoder, so the
// image oracle (measure.js) and a Node gate can both read it, and a header is cheap to carry in a cache.
//
//   readHeader(bytes) -> { kind, w, h, orientation }   the size the browser will display (EXIF and irot applied)
//                      | { more: true }                a picture so far, but the header is not all here yet
//                      | null                          not a picture we can read (or a broken one)
//
// PNG, GIF, JPEG (every SOF marker; EXIF orientation 5 to 8 swaps width and height), WebP (VP8, VP8L, VP8X)
// and AVIF (the primary item's `ispe`, turned by its `irot`). SVG has no header to read; ask the browser.
// WebP's EXIF chunk comes after the image chunk and is not read: a rotated WebP is a limit, said in the README.

const be16 = (b, o) => (b[o] << 8) | b[o + 1];
const be32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const le16 = (b, o) => b[o] | (b[o + 1] << 8);
const le24 = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const le32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const fourcc = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

const MORE = Object.freeze({ more: true });
const found = (kind, w, h, orientation = 1) => (w > 0 && h > 0 ? { kind, w, h, orientation } : null);
/** Orientations 5 to 8 turn the picture a quarter, so the displayed width is the stored height. */
const turned = o => o >= 5 && o <= 8;

function png(b) {
  if (b.length < 24) return MORE;
  return fourcc(b, 12) === 'IHDR' ? found('png', be32(b, 16), be32(b, 20)) : null;
}

function gif(b) {
  return b.length < 10 ? MORE : found('gif', le16(b, 6), le16(b, 8));
}

/** The orientation tag of an EXIF segment's TIFF block (`o` is where the block starts), 1 when there is none. */
function exifOrientation(b, o, end) {
  const le = b[o] === 0x49;
  if (!((b[o] === 0x49 && b[o + 1] === 0x49) || (b[o] === 0x4d && b[o + 1] === 0x4d))) return 1;
  const u16 = p => (le ? le16(b, p) : be16(b, p)), u32 = p => (le ? le32(b, p) : be32(b, p));
  const ifd = o + u32(o + 4);
  if (ifd + 2 > end) return 1;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > end) return 1;
    if (u16(e) === 0x0112 && u16(e + 2) === 3) { const v = u16(e + 8); return v >= 1 && v <= 8 ? v : 1; }
  }
  return 1;
}

function jpeg(b) {
  let orientation = 1;
  for (let i = 2; ;) {
    if (i + 4 > b.length) return MORE;
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }                          // fill byte
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) { i += 2; continue; } // markers with no length
    if (m === 0xd9 || m === 0xda) return null;                   // the image data began with no frame header
    const len = be16(b, i + 2);
    if (len < 2) return null;
    const isFrame = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (isFrame) {
      if (i + 9 > b.length) return MORE;
      const w = be16(b, i + 7), h = be16(b, i + 5);
      return turned(orientation) ? found('jpeg', h, w, orientation) : found('jpeg', w, h, orientation);
    }
    if (m === 0xe1) {                                            // APP1: Exif, which comes before the frame (a cut one reads as no turn, and the walk then runs off the end: more)
      if (len >= 8 && fourcc(b, i + 4) === 'Exif' && b[i + 8] === 0 && b[i + 9] === 0) orientation = exifOrientation(b, i + 10, i + 2 + len);
    }
    i += 2 + len;
  }
}

function webp(b) {
  if (b.length < 30) return MORE;
  const chunk = fourcc(b, 12);
  if (chunk === 'VP8 ') return b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a ? found('webp', le16(b, 26) & 0x3fff, le16(b, 28) & 0x3fff) : null;
  if (chunk === 'VP8L') { if (b[20] !== 0x2f) return null; const bits = le32(b, 21); return found('webp', (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1); }
  if (chunk === 'VP8X') return found('webp', le24(b, 24) + 1, le24(b, 27) + 1);
  return null;
}

/**
 * Boxes of an ISO base media file between `start` and `end`, as { type, data, end, whole }: `data` is where the payload
 * starts, `end` is clipped to what we have, and `whole` says the box is all here.
 */
function* boxes(b, start, end) {
  const have = Math.min(end, b.length);
  for (let o = start; o + 8 <= have;) {
    let size = be32(b, o), head = 8;
    if (size === 1) { if (o + 16 > have || be32(b, o + 8) !== 0) return; size = be32(b, o + 12); head = 16; }
    else if (size === 0) size = end - o;
    if (size < head) return;
    yield { type: fourcc(b, o + 4), data: o + head, end: Math.min(o + size, have), whole: o + size <= b.length };
    o += size;
  }
}

function avif(b) {
  if (b.length < 16) return MORE;
  const ftypSize = be32(b, 0);
  let brand = fourcc(b, 8) === 'avif' || fourcc(b, 8) === 'avis';
  for (let o = 16; !brand && o + 4 <= Math.min(ftypSize, b.length); o += 4) brand = fourcc(b, o) === 'avif' || fourcc(b, o) === 'avis';
  if (!brand) return ftypSize > b.length ? MORE : null;
  let primary = null, props = null, assoc = null, cut = false;
  for (const top of boxes(b, ftypSize, Infinity)) {
    if (top.type !== 'meta') continue;
    if (!top.whole) cut = true;
    for (const m of boxes(b, top.data + 4, top.end)) {            // meta is a full box: four bytes of version and flags
      if (m.type === 'pitm') {                                      // the primary item's id: 16 bits, or 32 from version 1
        const wide = b[m.data] > 0;
        if (m.data + 4 + (wide ? 4 : 2) <= m.end) primary = wide ? be32(b, m.data + 4) : be16(b, m.data + 4);
      }
      if (m.type !== 'iprp') continue;
      for (const p of boxes(b, m.data, m.end)) {
        if (p.type === 'ipco') {
          props = [];
          for (const q of boxes(b, p.data, p.end)) {
            if (!q.whole) { cut = true; break; }
            if (q.type === 'ispe' && q.data + 12 <= q.end) props.push({ ispe: true, w: be32(b, q.data + 4), h: be32(b, q.data + 8) });
            else if (q.type === 'irot' && q.data + 1 <= q.end) props.push({ irot: b[q.data] & 3 });
            else props.push({});
          }
        } else if (p.type === 'ipma' && p.whole) {
          assoc = new Map();
          const ver = b[p.data], wide = b[p.data + 3] & 1;
          let o = p.data + 8;
          for (let n = be32(b, p.data + 4); n > 0 && o + 3 <= p.end; n--) {
            const id = ver ? be32(b, o) : be16(b, o); o += ver ? 4 : 2;
            const k = b[o++], list = [];
            for (let j = 0; j < k && o < p.end; j++) { list.push(wide ? be16(b, o) & 0x7fff : b[o] & 0x7f); o += wide ? 2 : 1; }
            assoc.set(id, list);
          }
        } else if (!p.whole) cut = true;
      }
    }
  }
  if (!props) return cut || b.length < 4096 ? MORE : null;
  if (!assoc && cut) return MORE;
  const mine = (assoc?.get(primary ?? assoc.keys().next().value) ?? []).map(i => props[i - 1] ?? {});
  const ispe = (assoc ? mine : props).find(p => p.ispe);
  if (!ispe) return cut ? MORE : null;
  const irot = mine.find(p => p.irot !== undefined)?.irot ?? 0;
  return irot & 1 ? found('avif', ispe.h, ispe.w, 6) : found('avif', ispe.w, ispe.h, irot === 2 ? 3 : 1);
}

/** Which family a run of bytes is, or null; fewer than twelve bytes give MORE unless the first bytes already rule every family out. */
function family(b) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return png;
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return gif;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return jpeg;
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return webp;
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return avif;
  return null;
}

/** The displayed size of the picture whose first bytes are `bytes` (a Uint8Array). See the top of the file for what comes back. */
export function readHeader(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? 0);
  if (b.length < 12) return b.length === 0 || [0x89, 0xff, 0x47, 0x52, 0x00].includes(b[0]) ? MORE : null;
  try { return family(b)?.(b) ?? null; } catch { return null; }
}
