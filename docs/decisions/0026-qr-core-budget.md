# 0026: the QR encoder's pure core may be 14 KB

*Karigar for the Sutradhar, 7 October 2026, rung 3. Status: accepted by the Sutradhar, 7 October 2026 (Rasika's finding 4 on `batch/qr`; the tables and the eight masks are the standard's, not ornament).*

Decision 0010 gives a component's pure core (`*.core.js`, no DOM, tested in Node) 12 KB. The QR code's core, `packages/components/qr/qr.core.js`, is 13,656 bytes with comments and about 11 KB without them. It holds what ISO/IEC 18004 makes unavoidable:
- the capacity tables: error-correction codewords per block and block counts, for 40 versions at 4 levels (about 1.4 KB of numbers);
- mode choice, the smallest-version search, and the data bit packing for numeric, alphanumeric and UTF-8 byte modes;
- Reed-Solomon over GF(256), block splitting and interleaving;
- the function patterns (finders, timing, alignment positions for every version, format and version information with their BCH codes) and the zigzag placement;
- the eight masks and the four penalty rules, run for every mask, because a mask chosen without scoring produces codes some scanners cannot read;
- the path writer that turns the matrix into one SVG path.

Nothing here is decoration: drop any item and some version or level stops scanning. The core is pure, it runs in Node, and its tests compare it with the standard's example, 14 whole matrices and a hash for every version at every level from a reference encoder, and a round trip through an independent decoder (`qr.core.test.js`). Splitting it further would only move the same tables into a second file. The payload helpers (UPI, Wi-Fi), the frame drawing and the size floor are already apart, in `qr.helpers.js` (5 KB).

Decision: `qr.core.js` may be up to **14 KB** (14,336 bytes), declared in `qr`'s manifest with the reason. This is a named exception for the encoder, not a new general allowance. Growth past it needs a new decision, and the first thing to try is moving the penalty scoring into its own module.
