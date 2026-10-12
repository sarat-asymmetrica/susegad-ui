// The image leg of the bake gate (tools/bake-gate.mjs, decision 0030): the pure reflow half of the image surface, run
// headless from cached dimensions. No browser, no oracle, no network: sizes come from the real fixtures' headers (read
// by the pure header parser) and from a fake dimension table, and everything after that is arithmetic.
//
// What it holds, judged against geometry the code under test does not decide:
//   - a box from fitRect never leaves its frame: contain stays inside; cover covers and its crop stays inside the picture;
//   - float-flow shapes never give a band wider than the column, or a room outside it;
//   - the reserved boxes of floats stay inside the column;
//   - an empty input fails (a leg that checked nothing proved nothing).
// `core` can be handed a module with the same exports (the test plants a fault in a copy and watches this go red).

import fs from 'node:fs';
import path from 'node:path';
import { readHeader } from './header.core.js';
import * as realCore from './layout.core.js';

const EPS = 1e-6;
const FRAMES = [{ x: 0, y: 0, w: 320, h: 240 }, { x: 10, y: 20, w: 100, h: 400 }, { x: 0, y: 0, w: 640, h: 90 }, { x: 5, y: 5, w: 48, h: 48 }];
const TABLE = { 'fake-wide': { w: 4000, h: 900 }, 'fake-tall': { w: 300, h: 2400 }, 'fake-square': { w: 512, h: 512 }, 'fake-tiny': { w: 24, h: 18 } };
const FOCUS = [undefined, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.15, y: 0.9 }, { x: 0.5, y: 0.5 }];
const ALIGN = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];

/** Sizes: the shipped fixtures, read from their own headers, and the fake table. */
export function cachedDims(root) {
  const out = Object.entries(TABLE).map(([name, d]) => ({ name, ...d }));
  const dir = path.join(root, 'packages/image/fixtures');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter(n => /\.(png|jpe?g|gif|webp|avif)$/i.test(n))) {
      const h = readHeader(new Uint8Array(fs.readFileSync(path.join(dir, f)).subarray(0, 4096)));
      if (h && !h.more) out.push({ name: f, w: h.w, h: h.h });
    }
  }
  return out;
}

export default async function imageLeg({ root = process.cwd(), core = realCore, dims = cachedDims(root) } = {}) {
  const failures = [];
  let checks = 0;
  const check = (ok, why) => { checks++; if (!ok && failures.length < 12) failures.push(why); };
  if (!dims.length) return { leg: 'image', ok: false, status: 'fail', checks: 0, failures: ['image: no cached dimensions to reflow, so nothing was proved (an empty input is a failure, not a pass)'], warnings: [], notes: [] };

  for (const d of dims) {
    for (const f of FRAMES) {
      for (const mode of ['contain', 'cover', 'none']) {
        for (const focus of FOCUS) {
          for (const align of ALIGN) {
            const r = core.fitRect(d, f, mode, { align, focus }), why = `${d.name} ${d.w}x${d.h} in ${f.w}x${f.h} ${mode} ${JSON.stringify({ align, focus })}`;
            if (!r) { check(false, `${why}: fitRect gave nothing for a valid size`); continue; }
            const l = Math.max(f.x, r.x), t = Math.max(f.y, r.y), rr = Math.min(f.x + f.w, r.x + r.w), b = Math.min(f.y + f.h, r.y + r.h);
            if (mode === 'contain') check(r.x >= f.x - EPS && r.y >= f.y - EPS && r.x + r.w <= f.x + f.w + EPS && r.y + r.h <= f.y + f.h + EPS, `${why}: the picture leaves its box (${r.x}, ${r.y}, ${r.w}x${r.h})`);
            if (mode === 'cover') check(r.x <= f.x + EPS && r.y <= f.y + EPS && r.x + r.w >= f.x + f.w - EPS && r.y + r.h >= f.y + f.h - EPS, `${why}: the picture leaves a gap in its box (${r.x}, ${r.y}, ${r.w}x${r.h})`);
            check(r.crop.sx >= -EPS && r.crop.sy >= -EPS && r.crop.sx + r.crop.sw <= d.w + EPS && r.crop.sy + r.crop.sh <= d.h + EPS, `${why}: the crop leaves the picture`);
            check(Math.abs((rr - l) - r.crop.sw * r.scale) < 1e-4 && Math.abs((b - t) - r.crop.sh * r.scale) < 1e-4, `${why}: the crop is not what the box shows`);
          }
        }
      }
    }
  }

  // floats from the cached sizes into columns of several widths
  for (const colW of [200, 342, 640, 1100]) {
    const col = { x: 8, y: 4, w: colW };
    const floats = dims.slice(0, 6).map((d, i) => ({ id: i, side: i % 2 ? 'left' : 'right', share: 0.15 + 0.12 * (i % 4), dims: d, y: i * 37 }));
    const flow = core.flowColumn(col, floats, { gap: 12 });
    for (const b of flow.boxes) check(b.x >= col.x - EPS && b.x + b.w <= col.x + col.w + EPS && b.w > 0 && b.h > 0, `column ${colW}: float ${b.id} leaves the column (${b.x}, ${b.w})`);
    for (let top = col.y; top < col.y + 1400; top += 11) {
      const room = flow.shape(top, top + 24);
      check(!room || (room.w > 0 && room.w <= colW + EPS && room.x >= col.x - EPS && room.x + room.w <= col.x + colW + EPS), `column ${colW}: the band at ${top} is wider than the column or outside it (${JSON.stringify(room)})`);
    }
  }

  return { leg: 'image', ok: failures.length === 0, status: failures.length ? 'fail' : 'pass', checks, failures, warnings: [], notes: [`${dims.length} cached sizes (${dims.filter(d => !d.name.startsWith('fake')).length} read from fixture headers), fitRect in 3 modes, flow shapes in 4 column widths`] };
}
