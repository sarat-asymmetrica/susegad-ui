// A small reader for the tar files `git archive` writes (ustar, with pax headers
// for long paths). Pure; no dependencies. Tested in units.test.js.

const text = (b, at, n) => { const s = b.subarray(at, at + n), z = s.indexOf(0); return s.subarray(0, z < 0 ? n : z).toString('utf8'); };
const octal = (b, at, n) => parseInt(text(b, at, n).trim() || '0', 8);

/** Records of a pax extended header: "<length> <key>=<value>\n", repeated. */
export function parsePax(body) {
  const out = {};
  let at = 0;
  while (at < body.length) {
    const sp = body.indexOf(0x20, at);
    if (sp < 0) break;
    const len = parseInt(body.subarray(at, sp).toString('ascii'), 10);
    if (!(len > 0)) break;
    const rec = body.subarray(sp + 1, at + len - 1).toString('utf8'); // drop the trailing newline
    const eq = rec.indexOf('=');
    if (eq > 0) out[rec.slice(0, eq)] = rec.slice(eq + 1);
    at += len;
  }
  return out;
}

/** A path that stays inside the folder it is written to. */
export function safePath(p) {
  const parts = p.replace(/\\/g, '/').split('/').filter(s => s && s !== '.');
  if (!parts.length || p.startsWith('/') || /^[A-Za-z]:/.test(p) || parts.includes('..')) return null;
  return parts.join('/');
}

/**
 * The files and folders in a tar buffer.
 * @param {Buffer} buf
 * @returns {{ path: string, content?: Buffer, dir?: true }[]}
 */
export function untar(buf) {
  const out = [];
  let off = 0, pax = {};
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every(b => b === 0)) break;
    // the checksum counts its own field as spaces
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i];
    if (sum !== octal(h, 148, 8)) throw new Error(`the archive is damaged: a header at byte ${off} does not match its checksum`);
    const size = octal(h, 124, 12), type = h[156] ? String.fromCharCode(h[156]) : '0';
    const body = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === 'g') continue;                  // global header: the commit id, nothing to write
    if (type === 'x') { pax = parsePax(body); continue; }
    const prefix = text(h, 345, 155), name = text(h, 0, 100);
    const raw = pax.path ?? (prefix ? `${prefix}/${name}` : name);
    pax = {};
    const path = safePath(raw);
    if (!path) throw new Error(`the archive holds a path outside its folder: ${raw}`);
    if (type === '0' || type === '7') out.push({ path, content: Buffer.from(body) });
    else if (type === '5') out.push({ path, dir: true });
    // links and anything else: not part of a registry, skipped
  }
  return out;
}
