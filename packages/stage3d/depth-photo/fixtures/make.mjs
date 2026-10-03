// Makes the demo's test drawing, depth map and layers map, with no photograph and no image model:
//
//   node packages/stage3d/depth-photo/fixtures/make.mjs
//
// A plate of speckled puffs on a red ledge, a grey-green sea and a pale sky, in the layout the story's
// drawing had (horizon 0.334, shore 0.478, plate at u 0.33-0.58, v 0.54-0.66, depths 0.21 and 0.874),
// so the check's geometry does not change. Painted per pixel and posterised to a 216-colour cube, so the
// PNGs are a few tens of KB. The output is deterministic (a hash, not Math.random).

import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const W = 384, H = 512, HORIZON = 0.334, SHORE = 0.478;
const PLATE = { u: 0.455, v: 0.6, rx: 0.125, ry: 0.06 };

const hash = (x, y, s = 0) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const hex = h => [h >> 16 & 255, h >> 8 & 255, h & 255];

const inPlate = (u, v) => ((u - PLATE.u) / PLATE.rx) ** 2 + ((v - PLATE.v) / PLATE.ry) ** 2;

function drawing(x, y) {
  const u = (x + 0.5) / W, v = (y + 0.5) / H;
  if (v < HORIZON) return mix(hex(0xe6e0cf), hex(0xf4efe0), v / HORIZON + 0.1 * vnoise(x / 40, y / 25, 1));
  const streak = vnoise(x / 60, y / 3, 2);
  if (v < SHORE) {
    const t = (v - HORIZON) / (SHORE - HORIZON);
    let c = mix(mix(hex(0x7fa3b0), hex(0x5f8b8c), t), hex(0x9fbfc0), streak * 0.5);
    if (vnoise(x / 14, y / 2.5, 3) > 0.8 - t * 0.15) c = mix(c, hex(0xf3f0e6), 0.6);
    return c;
  }
  if (v < SHORE + 0.022) return mix(hex(0x3b3a38), hex(0x74716a), vnoise(x / 9, y / 9, 4));
  // the ledge: coursed laterite, a lighter lip along its top edge
  const course = Math.abs(((y * 0.045) % 1) - 0.5) < 0.04 ? 0.78 : 1;
  let c = mix(hex(0x9c4a30), hex(0xc6704a), vnoise(x / 6, y / 5, 5) * 0.8);
  c = c.map(k => k * course);
  if (v < SHORE + 0.05) c = mix(c, hex(0xd99a72), 0.4);
  const q = inPlate(u, v);
  if (q < 1.55) { // the plate
    if (q < 1) {
      if (q > 0.72) return mix(hex(0xf6f1e3), hex(0xc9c0aa), (q - 0.72) / 0.28);
      // puffs and speckles: the detail the focus check reads
      const cx = Math.floor(x / 7), cy = Math.floor(y / 7);
      const r = hash(cx, cy, 6), inx = (x % 7) - 3, iny = (y % 7) - 3;
      if (r > 0.25 && inx * inx + iny * iny < 8 + r * 6) return mix(hex(0xe0a53a), hex(0xf7d78a), hash(cx, cy, 7));
      if (hash(x, y, 8) > 0.86) return hex(0x2e6b3a);
      if (hash(x, y, 9) > 0.93) return hex(0x8a1f1a);
      return hex(0xede2c2);
    }
    return mix(c, hex(0x2a1a12), 0.35 * (1.55 - q) / 0.55); // its shadow on the ledge
  }
  return c;
}

const depth = (x, y) => {
  const u = (x + 0.5) / W, v = (y + 0.5) / H;
  if (v < HORIZON) return 0;
  if (v < SHORE) return 0.21 + 0.04 * (v - HORIZON) / (SHORE - HORIZON);
  if (v < SHORE + 0.022) return 0.34;
  if (inPlate(u, v) < 1) return 0.874;
  return 0.78 + 0.08 * (v - SHORE) / (1 - SHORE);
};

const layers = (x, y) => {
  const u = (x + 0.5) / W, v = (y + 0.5) / H;
  const water = clamp(Math.min((v - HORIZON) / 0.01, (SHORE - v) / 0.01));
  return [water * 255, v < HORIZON ? 255 : 0, inPlate(u, v) < 1.02 ? 255 : 0];
};

// ── PNG ─────────────────────────────────────────────────────────────────────
const chunk = (type, data) => {
  const b = Buffer.alloc(12 + data.length);
  b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
  return b;
};
function png(w, h, colorType, rows, palette = null) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = colorType;
  const raw = Buffer.concat(rows.map(r => Buffer.concat([Buffer.from([0]), Buffer.from(r)])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), ...(palette ? [chunk('PLTE', palette)] : []), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const cube = Buffer.alloc(216 * 3);
for (let i = 0; i < 216; i++) { cube[i * 3] = Math.round(((i / 36 | 0) % 6) * 51); cube[i * 3 + 1] = Math.round(((i / 6 | 0) % 6) * 51); cube[i * 3 + 2] = Math.round((i % 6) * 51); }
const idx = ([r, g, b]) => Math.round(clamp(r, 0, 255) / 51) * 36 + Math.round(clamp(g, 0, 255) / 51) * 6 + Math.round(clamp(b, 0, 255) / 51);

const rows = f => Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => f(x, y)));
const dir = fileURLToPath(new URL('.', import.meta.url));
writeFileSync(dir + 'drawing.png', png(W, H, 3, rows((x, y) => idx(drawing(x, y))), cube));
writeFileSync(dir + 'depth.png', png(W, H, 0, rows((x, y) => Math.round(depth(x, y) * 255))));
writeFileSync(dir + 'layers.png', png(W, H, 2, Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => layers(x, y)).flat().map(Math.round))));
console.log('wrote drawing.png, depth.png, layers.png');
