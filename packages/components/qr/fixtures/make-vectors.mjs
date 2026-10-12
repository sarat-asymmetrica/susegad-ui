// Writes vectors.json and sweep.json from a reference encoder. Run once, by hand; the results are committed.
//
//   npm i --no-save nayuki-qr-code-generator   (Project Nayuki's QR Code generator library, MIT,
//                                               https://www.nayuki.io/page/qr-code-generator-library, version 1.8.0)
//   node packages/components/qr/fixtures/make-vectors.mjs
//
// The reference is asked for exactly what our encoder is: one segment in the cheapest mode, the level as given
// (no automatic level boost), the lowest-penalty mask. vectors.json holds whole matrices; sweep.json holds a
// SHA-256 of the rows for every version at every level, with byte text that fills the version.

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const lib = require('nayuki-qr-code-generator');
const { QrCode, QrSegment } = lib.default ?? lib.qrcodegen ?? lib;
const LEVEL = { L: QrCode.Ecc.LOW, M: QrCode.Ecc.MEDIUM, Q: QrCode.Ecc.QUARTILE, H: QrCode.Ecc.HIGH };

export function reference(text, ecc, segs = QrSegment.makeSegments(text)) {
  const qr = QrCode.encodeSegments(segs, LEVEL[ecc], 1, 40, -1, false);
  const rows = [];
  for (let y = 0; y < qr.size; y++) { let s = ''; for (let x = 0; x < qr.size; x++) s += qr.getModule(x, y) ? '1' : '0'; rows.push(s); }
  return { version: qr.version, mask: qr.mask, rows };
}

const cases = [
  ['annex-numeric-1-M', '01234567', 'M'],
  ['alnum-hello-world-1-Q', 'HELLO WORLD', 'Q'],
  ['byte-url', 'https://susegad.dev/ui', 'L'],
  ['upi-link', 'upi://pay?pa=casaexemplo@okaxis&pn=Casa%20Exemplo&am=25500.00&cu=INR&tn=Booking%2012%20to%2015%20Oct', 'M'],
  ['upi-link-H', 'upi://pay?pa=casaexemplo@okaxis&pn=Casa%20Exemplo&am=25500.00&cu=INR&tn=Booking%2012%20to%2015%20Oct', 'H'],
  ['utf8-rupee-devanagari', '₹25,500 · राखून ठेवले · ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ', 'Q'],
  ['wifi', 'WIFI:T:WPA;S:Casa Exemplo guests;P:p\;ssw\:rd;;', 'M'],
  ['ticket-alnum', 'TICKET-GOA-2026-0001234', 'M'],
  ['numeric-long-7', '0123456789'.repeat(12), 'H'],
  ['empty', '', 'M'],
  ['one-char', 'A', 'L'],
  ['version-7-info', 'x'.repeat(100), 'Q'],
  ['version-10', 'The quick brown fox jumps over the lazy dog. '.repeat(5), 'M'],
  ['max-numeric-40-L', '8'.repeat(7089), 'L'],
];
const vectors = cases.map(([name, text, ecc]) => ({ name, text, ecc, ...reference(text, ecc) }));
const out = fileURLToPath(new URL('.', import.meta.url));
writeFileSync(out + 'vectors.json', JSON.stringify({ source: 'nayuki-qr-code-generator 1.8.0 (Project Nayuki), encodeSegments, boostEcl false', vectors }) + '\n');

const sweep = {};
const CAP = { L: 0, M: 1, Q: 2, H: 3 };
for (const ecc of Object.keys(CAP)) for (let v = 1; v <= 40; v++) {
  // the longest byte text that still fits: ask the reference for growing text until it moves to the next version
  let lo = 1, hi = 3000;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; let ok = false; try { ok = reference('a'.repeat(mid), ecc).version <= v; } catch { ok = false; } if (ok) lo = mid; else hi = mid - 1; }
  const text = 'a'.repeat(lo).split('').map((c, i) => String.fromCharCode(97 + ((i * 7 + v) % 26))).join('');
  const r = reference(text, ecc);
  if (r.version !== v) continue;
  sweep[`${v}-${ecc}`] = { length: lo, sha: createHash('sha256').update(r.rows.join('')).digest('hex'), mask: r.mask };
}
writeFileSync(out + 'sweep.json', JSON.stringify({ source: 'same reference; text for N is the N characters a-z cycling, see the test', sweep }) + '\n');
console.log(vectors.length, 'vectors,', Object.keys(sweep).length, 'sweep entries');
