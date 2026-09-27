// A small WAV (RIFF/WAVE, PCM) reader and writer. Pure: bytes in, bytes or
// plain data out. Used two ways: reading a synthesised phrase's real
// duration from its header (never trust a provider's word count), and
// writing a silent WAV of a given length for the stub provider.

/** Read a little-endian uint32 or uint16 at `offset`. */
const u32 = (view, offset) => view.getUint32(offset, true);
const u16 = (view, offset) => view.getUint16(offset, true);
const asBuffer = bytes => (bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes);
const asView = bytes => new DataView(asBuffer(bytes).buffer, asBuffer(bytes).byteOffset, asBuffer(bytes).byteLength);
const ascii = (view, offset) => String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));

/**
 * Parse a WAV header, walking its chunks (fmt and data may not be adjacent;
 * some encoders write LIST or fact chunks first). Throws with a plain
 * message on a file that isn't RIFF/WAVE, or that has no fmt or data chunk.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {{ sampleRate: number, channels: number, bitsPerSample: number, dataOffset: number, dataBytes: number, durationSec: number }}
 */
export function parseWav(bytes) {
  const buf = asBuffer(bytes);
  const view = asView(buf);
  if (buf.length < 12 || ascii(view, 0) !== 'RIFF' || ascii(view, 8) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let offset = 12;
  let fmt = null, data = null;
  while (offset + 8 <= buf.length) {
    const id = ascii(view, offset);
    const size = u32(view, offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        channels: u16(view, body + 2),
        sampleRate: u32(view, body + 4),
        bitsPerSample: u16(view, body + 14),
      };
    } else if (id === 'data') {
      data = { offset: body, size };
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }
  if (!fmt) throw new Error('WAV has no fmt chunk');
  if (!data) throw new Error('WAV has no data chunk');
  const bytesPerFrame = fmt.channels * (fmt.bitsPerSample / 8) || 1;
  const durationSec = data.size / bytesPerFrame / fmt.sampleRate;
  return {
    sampleRate: fmt.sampleRate,
    channels: fmt.channels,
    bitsPerSample: fmt.bitsPerSample,
    dataOffset: data.offset,
    dataBytes: data.size,
    durationSec,
  };
}

/**
 * Write a silent 16-bit PCM WAV of the given length, for the stub provider
 * and for tests. Deterministic (all zero samples): two calls with the same
 * options give byte-identical files, which keeps the fixture cache stable.
 * @param {{ durationSec: number, sampleRate?: number, channels?: number }} opts
 * @returns {Uint8Array}
 */
export function writeSilentWav({ durationSec, sampleRate = 24000, channels = 1 }) {
  const bitsPerSample = 16;
  const frames = Math.max(1, Math.round(durationSec * sampleRate));
  const bytesPerFrame = channels * (bitsPerSample / 8);
  const dataBytes = frames * bytesPerFrame;
  const buf = new Uint8Array(44 + dataBytes);
  const view = new DataView(buf.buffer);
  const str = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerFrame, true); view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, bitsPerSample, true);
  str(36, 'data'); view.setUint32(40, dataBytes, true);
  // the rest is already zero: silence
  return buf;
}

/** A PCM header matching `info`'s format, `dataBytes` long, data left to the caller to fill. */
function pcmHeader({ sampleRate, channels, bitsPerSample, dataBytes }) {
  const bytesPerFrame = channels * (bitsPerSample / 8);
  const buf = new Uint8Array(44);
  const view = new DataView(buf.buffer);
  const str = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerFrame, true); view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, bitsPerSample, true);
  str(36, 'data'); view.setUint32(40, dataBytes, true);
  return buf;
}

/**
 * Concatenate several WAV clips into one track, with silence held between
 * them (`gapAfterSec`, seconds of silence after that clip). Every clip must
 * share the same sample rate, channel count and bit depth — the fixture
 * cache and the providers here always produce 16-bit PCM at one sample
 * rate, so this holds for a script synthesised in one pass; a mismatch
 * throws with a plain message rather than producing a garbled file.
 * @param {{ audio: Uint8Array|ArrayBuffer, gapAfterSec?: number }[]} parts
 * @returns {Uint8Array}
 */
export function concatWav(parts) {
  if (!parts.length) throw new Error('concatWav needs at least one part');
  const infos = parts.map(p => ({ ...parseWav(p.audio), bytes: asBuffer(p.audio), gapAfterSec: p.gapAfterSec || 0 }));
  const { sampleRate, channels, bitsPerSample } = infos[0];
  for (const info of infos) {
    if (info.sampleRate !== sampleRate || info.channels !== channels || info.bitsPerSample !== bitsPerSample) {
      throw new Error(`concatWav needs every clip to share format: ${sampleRate}Hz/${channels}ch/${bitsPerSample}bit vs. ${info.sampleRate}Hz/${info.channels}ch/${info.bitsPerSample}bit`);
    }
  }
  const bytesPerFrame = channels * (bitsPerSample / 8);
  const chunks = [];
  for (const info of infos) {
    chunks.push(info.bytes.subarray(info.dataOffset, info.dataOffset + info.dataBytes));
    if (info.gapAfterSec > 0) chunks.push(new Uint8Array(Math.round(info.gapAfterSec * sampleRate) * bytesPerFrame));
  }
  const dataBytes = chunks.reduce((s, c) => s + c.length, 0);
  const header = pcmHeader({ sampleRate, channels, bitsPerSample, dataBytes });
  const out = new Uint8Array(header.length + dataBytes);
  out.set(header, 0);
  let offset = header.length;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}
