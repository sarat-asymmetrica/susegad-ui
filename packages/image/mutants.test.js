// Teeth. Each entry breaks one thing in a copy of a source file, and the checks that guard that file must notice.
// A mutant that survives is a check that cannot fail (kernel A10); a `from` text that no longer matches the file
// fails loudly, so a refactor cannot quietly disarm a mutant. Run with `node --test packages/image/mutants.test.js`
// to see which check killed each one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHECKS } from './layout.props.js';
import { CASES } from './header.props.js';

const here = f => new URL(f, import.meta.url);
const LAYOUT = [
  ['cover takes the smaller scale', "mode === 'cover' ? Math.max(sx, sy)", "mode === 'cover' ? Math.min(sx, sy)"],
  ['contain takes the larger scale', "mode === 'contain' ? Math.min(sx, sy)", "mode === 'contain' ? Math.max(sx, sy)"],
  ['none scales to the box', "mode === 'none' ? 1", "mode === 'none' ? sx"],
  ['align ignored: slack always split in half', 'return (room - size) * a;       // smaller', 'return (room - size) / 2;       // smaller'],
  ['overflow ignores align (no object-position)', 'if (f === undefined) return (room - size) * a;', 'if (f === undefined) return (room - size) / 2;'],
  ['focus is not clamped: a gap can open', 'return clamp(room / 2 - f * size, room - size, 0);', 'return room / 2 - f * size;'],
  ['focus is measured from the wrong end', 'room / 2 - f * size', 'room / 2 - (1 - f) * size'],
  ['the crop forgets the scale', 'sw: (r - l) / scale', 'sw: (r - l)'],
  ['the crop starts at the picture corner', 'sx: (l - x) / scale', 'sx: 0'],
  ['an unknown mode is treated as contain', "mode === 'contain' ? Math.min(sx, sy) : NaN", "mode === 'contain' ? Math.min(sx, sy) : Math.min(sx, sy)"],
  ['a zero size passes', 'const ok = d => d && finite(d.w, d.h) && d.w > 0 && d.h > 0;', 'const ok = d => d && finite(d.w, d.h);'],
  ['reserve swaps width and height', '(width * dims.h) / dims.w', '(width * dims.w) / dims.h'],
  ['reserve forgets it guessed', 'guessed: true', 'guessed: false'],
  ['a float forgets which side it is on', "side === 'left' ? col.x : right - size.w", "side === 'left' ? right - size.w : col.x"],
  ['floats on a side overlap instead of stacking', 'lows[side] = y + size.h + g;', 'lows[side] = col.y;'],
  ['a stacked float forgets the margin', 'lows[side] = y + size.h + g;', 'lows[side] = y + size.h;'],
  ['floats on opposite sides never make room for each other', 'o.side !== side && y <', 'o.side === side && y <'],
  ['the gap beside a left float is dropped', 'l = Math.max(l, b.x + b.w + b.gap)', 'l = Math.max(l, b.x + b.w)'],
  ['the gap beside a right float is dropped', 'r = Math.min(r, b.x - b.gap)', 'r = Math.min(r, b.x)'],
  ['the bottom margin of a float stops blocking', 'top < b.y + b.h + b.gap - 1e-6 && bottom', 'top < b.y + b.h - 1e-6 && bottom'],
  ['a float blocks bands above it', 'bottom > b.y + 1e-6', 'bottom > b.y - 1e5'],
  ['the room is not null when nothing is left', 'return r - l > 1e-6 ? { x: l, w: r - l } : null;', 'return { x: l, w: Math.max(0, r - l) };'],
  ['the column has no start', 'if (top < col.y - 1e-6 ||', 'if ('],
  ['the column has no end', '(col.h !== undefined && bottom > col.y + col.h + 1e-6)', 'false'],
  ['the float offset y is ignored', 'col.y + (f.y ?? 0)', 'col.y'],
  ['the floats do not extend the bottom', 'bottom: Math.max(laid.bottom, flow.bottom)', 'bottom: laid.bottom'],
  ['minWidth is dropped', 'minWidth: opts.minWidth ?? 0', 'minWidth: 0'],
];
const HEADER = [
  ['PNG height read from the width', 'be32(b, 16), be32(b, 20)', 'be32(b, 16), be32(b, 16)'],
  ['GIF is big-endian', 'le16(b, 6), le16(b, 8)', 'be16(b, 6), be16(b, 8)'],
  ['JPEG frame markers include DHT (C4)', 'm !== 0xc4 && ', ''],
  ['JPEG height and width swapped', 'const w = be16(b, i + 7), h = be16(b, i + 5);', 'const w = be16(b, i + 5), h = be16(b, i + 7);'],
  ['EXIF turn ignored', 'turned(orientation) ? found', 'false ? found'],
  ['EXIF orientation 5 not counted as a turn', 'o >= 5 && o <= 8', 'o >= 6 && o <= 8'],
  ['EXIF orientation 8 not counted as a turn', 'o >= 5 && o <= 8', 'o >= 5 && o <= 7'],
  ['EXIF byte order ignored', 'const le = b[o] === 0x49;', 'const le = true;'],
  ['JPEG segments are stepped over by the wrong length', 'i += 2 + len;', 'i += len;'],
  ['WebP VP8 keeps the scale bits', 'le16(b, 26) & 0x3fff, le16(b, 28) & 0x3fff', 'le16(b, 26), le16(b, 28)'],
  ['WebP VP8L forgets the +1', '(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1', '(bits & 0x3fff), ((bits >>> 14) & 0x3fff)'],
  ['WebP VP8X forgets the +1', 'le24(b, 24) + 1, le24(b, 27) + 1', 'le24(b, 24), le24(b, 27)'],
  ["AVIF takes the first ispe, not the primary item's", 'const ispe = (assoc ? mine : props).find(p => p.ispe);', 'const ispe = props.find(p => p.ispe);'],
  ['AVIF irot ignored', 'return irot & 1 ? found', 'return false ? found'],
  ['AVIF irot reads 180 degrees as a turn', 'irot & 1 ?', 'irot ?'],
  ['AVIF 16-bit ipma ignored', 'const ver = b[p.data], wide = b[p.data + 3] & 1;', 'const ver = b[p.data], wide = 0;'],
  ['AVIF reads the wrong pitm width', 'const wide = b[m.data] > 0;', 'const wide = false;'],
  ['a truncated buffer is called not-an-image', 'return b.length === 0 || [0x89, 0xff, 0x47, 0x52, 0x00].includes(b[0]) ? MORE : null;', 'return null;'],
  ['a zero size is accepted', 'w > 0 && h > 0 ? { kind', 'true ? { kind'],
];

/** Run `runAll` on a copy of `file` with `from` replaced by `to`: the first failure's description, or null when everything passed. */
async function runMutant(file, from, to, runAll) {
  const src = readFileSync(here(file), 'utf8');
  assert.ok(src.includes(from), `${file}: the mutant's text is gone, so it tests nothing: ${JSON.stringify(from)}`);
  const dir = mkdtempSync(join(tmpdir(), 'sg-mutant-'));
  try {
    const path = join(dir, 'm.mjs');
    writeFileSync(path, src.replace(from, () => to));
    return runAll(await import(`${pathToFileURL(path).href}?${Math.random()}`));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const firstFailure = (list, mod) => {
  for (const [name, run] of list) {
    try { run(mod); } catch (e) { return `${name}\n        ${String(e.message).split('\n')[0].slice(0, 220)}`; }
  }
  return null;
};

for (const [name, from, to] of LAYOUT) {
  test(`layout mutant killed: ${name}`, async () => {
    const hit = await runMutant('./layout.core.js', from, to, mod => firstFailure(CHECKS, mod));
    assert.ok(hit, `SURVIVED: ${name}. No check in layout.props.js notices.`);
    console.log(`      killed by: ${hit}`);
  });
}
for (const [name, from, to] of HEADER) {
  test(`header mutant killed: ${name}`, async () => {
    const hit = await runMutant('./header.core.js', from, to, mod => firstFailure(CASES, mod));
    assert.ok(hit, `SURVIVED: ${name}. No case in header.props.js notices.`);
    console.log(`      killed by: ${hit}`);
  });
}

test('the harness can fail: a copy changed in no way survives nothing, and the real files pass every check', async () => {
  assert.equal(await runMutant('./layout.core.js', 'const finite', 'const finite', mod => firstFailure(CHECKS, mod)), null);
  assert.equal(await runMutant('./header.core.js', 'const MORE', 'const MORE', mod => firstFailure(CASES, mod)), null);
});
