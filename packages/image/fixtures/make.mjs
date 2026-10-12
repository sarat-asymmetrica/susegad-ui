// Makes the demo's two test pictures, with no photograph and no image model:
//
//   node packages/image/fixtures/make.mjs
//
// jetty.png: a dusk sea off a wooden jetty, 960 x 640 (landscape; the demo gives it width and height attributes).
// laterite.png: a laterite wall with a lime-washed arched doorway, 600 x 800 (portrait; the demo gives it no
// attributes, so the oracle has to read its header). Painted per pixel, dithered into a 216-colour cube, so each
// PNG is tens of KB. Deterministic: a hash, not Math.random.

import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const hash = (x, y, s = 0) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const hex = h => [h >> 16 & 255, h >> 8 & 255, h & 255];
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ── jetty ──────────────────────────────────────────────────────────────────
const JW = 960, JH = 640, HORIZON = 0.52, SUN = { u: 0.68, v: 0.455, r: 0.058 };
function jetty(x, y) {
  const u = (x + 0.5) / JW, v = (y + 0.5) / JH;
  const sunD = Math.hypot((u - SUN.u) * JW, (v - SUN.v) * JH) / (SUN.r * JH);
  let c;
  if (v < HORIZON) {
    c = mix(mix(hex(0x27465e), hex(0x7a8f92), smooth(0, 0.35, v)), hex(0xeaa56c), smooth(0.3, HORIZON, v));
    c = mix(c, hex(0xf3d49a), clamp(1.4 - sunD * 0.35) * 0.55);
    if (sunD < 1) c = mix(c, hex(0xfbe7b8), smooth(1, 0.85, sunD));
  } else {
    const d = (v - HORIZON) / (1 - HORIZON);
    const streak = vnoise(x / 70, y / 1.7, 4);
    c = mix(mix(hex(0xc7845f), hex(0x35566a), smooth(0, 0.45, d)), hex(0x1d3544), smooth(0.3, 1, d));
    c = mix(c, hex(0xf1c98d), clamp((1 - Math.abs(u - SUN.u) * 5) * (0.5 + 0.6 * streak) * (1 - d) * 1.2) * 0.8);
    c = mix(c, hex(0x0f2230), clamp((streak - 0.55) * 0.9) * d);
  }
  // the jetty: a deck at 0.64 and posts every 0.055 of the width, going out to 0.56 and fading into the dusk
  const onDeck = v > 0.634 && v < 0.652 && u < 0.58;
  const post = u < 0.575 && v > 0.652 && v < 0.84 && Math.abs(((u * 18.2) % 1) - 0.5) < 0.1;
  const rail = u < 0.575 && v > 0.585 && v < 0.592;
  const rpost = u < 0.575 && v > 0.585 && v < 0.634 && Math.abs(((u * 18.2) % 1) - 0.5) < 0.05;
  if (onDeck || post || rail || rpost) c = mix(hex(0x2a1d1a), hex(0x4a3226), vnoise(x / 5, y / 30, 9) * 0.6);
  return c;
}

// ── laterite wall ──────────────────────────────────────────────────────────
const LW = 600, LH = 800;
function laterite(x, y) {
  const u = (x + 0.5) / LW, v = (y + 0.5) / LH;
  const row = Math.floor(y / 44), col = Math.floor((x + (row % 2) * 60) / 120), inCol = (x + (row % 2) * 60) % 120, inRow = y % 44;
  const grout = inRow < 3 || inCol < 3;
  let c = mix(hex(0xa4482a), hex(0xc1693a), vnoise(x / 9, y / 9, col * 7 + row) * 0.7 + 0.15 * hash(col, row, 3));
  c = mix(c, hex(0x6f2c1b), vnoise(x / 3, y / 3, 11) * 0.35);
  if (grout) c = mix(c, hex(0xd8c3a0), 0.55);
  // the doorway: an arch 0.46 wide, its top a half ellipse, with a lime-wash border
  const cx = 0.5, w = 0.23, springV = 0.36, bottom = 0.93;
  const dx = Math.abs(u - cx);
  const inArch = v > springV ? dx < w : dx < w * Math.sqrt(Math.max(0, 1 - ((springV - v) / 0.2) ** 2)) && v > springV - 0.2;
  const inFrame = (v > springV ? dx < w + 0.045 : dx < (w + 0.045) * Math.sqrt(Math.max(0, 1 - ((springV - v) / 0.27) ** 2)) && v > springV - 0.27);
  if (inFrame && v < bottom + 0.02) c = mix(hex(0xe9ddc2), hex(0xcdbf9d), vnoise(x / 6, y / 6, 5) * 0.8);
  if (inArch && v < bottom) c = mix(hex(0x241810), hex(0x4a3020), smooth(0.35, 0.95, v) * 0.5 + vnoise(x / 20, y / 20, 2) * 0.1);
  if (inArch && v > 0.55 && v < bottom && Math.abs(u - cx) < 0.003) c = mix(c, hex(0x120b07), 0.5); // the leaves' seam
  if (v >= bottom) c = mix(c, hex(0x3a2a22), 0.8); // the step
  return c;
}

// ── PNG: 216-colour cube, ordered dither ───────────────────────────────────
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const cube = Buffer.alloc(216 * 3);
for (let i = 0; i < 216; i++) { cube[i * 3] = Math.floor(i / 36) * 51; cube[i * 3 + 1] = Math.floor((i % 36) / 6) * 51; cube[i * 3 + 2] = (i % 6) * 51; }
const level = (v, d) => clamp(Math.floor(v / 51 + (d - 0.5) * 1.15 + 0.5), 0, 5);
function chunk(type, data) {
  const b = Buffer.alloc(12 + data.length);
  b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
  return b;
}
function png(w, h, paint) {
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = paint(x, y), d = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      raw[y * (w + 1) + 1 + x] = level(c[0], d) * 36 + level(c[1], d) * 6 + level(c[2], d);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('PLTE', cube), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const dir = fileURLToPath(new URL('.', import.meta.url));
writeFileSync(dir + 'jetty.png', png(JW, JH, jetty));
writeFileSync(dir + 'laterite.png', png(LW, LH, laterite));
console.log('wrote jetty.png and laterite.png');
