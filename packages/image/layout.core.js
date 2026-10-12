// The image tier's pure geometry: a picture's size in, boxes and shapes out (decisions 0029 and 0030).
//
// A picture's intrinsic size is the expensive fact (measure.js reads it early, from the header). Everything here is
// arithmetic over that size, so it runs in Node, in a gate, and on the first frame before a byte of the picture has
// arrived. This file imports nothing: the type tier's layout is passed in (`flowAround`), never imported.
//
// What it is for. The platform already owns `aspect-ratio` and `object-fit`: for a picture in a box, use them. This
// file fills the gap CSS leaves, JS-owned layout: text that a script lays line by line round a picture
// (the type tier's `layIntoShape`), and a canvas that has to place the same picture itself.
//
//   fitRect(dims, box, mode, opts)     where a picture lands in a box: contain, cover or none, with alignment and a focal point
//   reserve(dims, width, ratio)        the box a picture needs at a width, from its size alone
//   flowColumn(col, floats, opts)      a column with floated pictures: the reserved boxes, and the column's room as a
//                                      shape (top, bottom) -> { x, w } | null for layIntoShape
//   flowAround(layout, blocks, col, floats, opts)   the two together: text laid beside the floats

const finite = (...ns) => ns.every(Number.isFinite);
const ok = d => d && finite(d.w, d.h) && d.w > 0 && d.h > 0;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Where a picture of intrinsic size `dims` ({ w, h }) lands in `box` ({ x, y, w, h }), for `mode`:
 *   'contain'  the whole picture, as large as fits (letterboxed);
 *   'cover'    as small as fills the box (cropped);
 *   'none'     at its intrinsic size.
 * `align` ({ x, y }, 0 to 1, default the centre) is `object-position`: it divides the slack when the picture is smaller
 * than the box on an axis, and, for cover and none with no `focus`, the overflow when it is larger (so the result is
 * the same as CSS). `focus` ({ x, y }, a point in the picture, 0 to 1) is the part to keep in view: it is brought to
 * the middle of the box, as far as the picture still covers the box.
 *
 * @returns {{ x: number, y: number, w: number, h: number, scale: number, crop: { sx: number, sy: number, sw: number, sh: number } } | null}
 *   `x, y, w, h` is where the whole picture is drawn, in the box's coordinates (it can run outside the box); `crop` is
 *   the part of the picture inside the box, in picture pixels (the source rectangle for canvas `drawImage`).
 *   Null when the size or the box is not a positive number.
 */
export function fitRect(dims, box, mode = 'contain', { align = { x: 0.5, y: 0.5 }, focus } = {}) {
  if (!ok(dims) || !box || !finite(box.x, box.y, box.w, box.h) || box.w <= 0 || box.h <= 0) return null;
  const sx = box.w / dims.w, sy = box.h / dims.h;
  const scale = mode === 'cover' ? Math.max(sx, sy) : mode === 'none' ? 1 : mode === 'contain' ? Math.min(sx, sy) : NaN;
  if (!Number.isFinite(scale)) return null;
  const w = dims.w * scale, h = dims.h * scale;
  const place = (size, room, a, f) => {
    if (size <= room + 1e-9) return (room - size) * a;       // smaller than the box: the slack is shared by `align`
    if (f === undefined) return (room - size) * a;           // larger, no focal point: object-position
    return clamp(room / 2 - f * size, room - size, 0);       // larger, a focal point: bring it to the middle, keep the box covered
  };
  const ax = clamp(align?.x ?? 0.5, 0, 1), ay = clamp(align?.y ?? 0.5, 0, 1);
  const x = box.x + place(w, box.w, ax, focus && clamp(focus.x ?? 0.5, 0, 1));
  const y = box.y + place(h, box.h, ay, focus && clamp(focus.y ?? 0.5, 0, 1));
  const l = Math.max(box.x, x), t = Math.max(box.y, y), r = Math.min(box.x + box.w, x + w), b = Math.min(box.y + box.h, y + h);
  return { x, y, w, h, scale, crop: { sx: (l - x) / scale, sy: (t - y) / scale, sw: (r - l) / scale, sh: (b - t) / scale } };
}

/**
 * The box a picture needs at `width` (CSS px), from its intrinsic size alone: `{ w: width, h }` with the picture's own
 * proportions. With no size yet, `ratio` (width over height) stands in and the box is marked `guessed`, so the caller
 * knows it may change when the size arrives. Null when there is neither.
 */
export function reserve(dims, width, ratio) {
  if (!(width > 0)) return null;
  if (ok(dims)) return { w: width, h: (width * dims.h) / dims.w, guessed: false };
  return ratio > 0 ? { w: width, h: width / ratio, guessed: true } : null;
}

/**
 * A column with pictures floated in it, as boxes and as a shape.
 *
 * `col` is { x, y, w, h? } (h, when given, ends the column). Each float is
 *   { id, side: 'left' | 'right', width | share, dims?, ratio?, y?, gap? }
 * `width` is the box's width in px, or `share` a fraction of the column; `dims` the picture's intrinsic size, from which
 * the reserved height follows (no `dims`: `ratio` stands in, default 4:3, and the box is `guessed`); `y` is how far down
 * the column it starts (default 0); `gap` is the margin kept round it (default `opts.gap`). Like CSS floats they are taken
 * in order, hug their side, and a float goes below any earlier one on the same side.
 *
 * Returns
 *   boxes   [{ id, side, x, y, w, h, guessed }]: the reserved boxes, in the column's coordinates: size the pictures to these
 *   shape   (top, bottom) -> { x, w } | null: the room beside the floats for that band of lines (null: none, step down)
 *   bottom  the lowest edge of any float plus its gap: the column is at least this tall
 *
 * @param {{ gap?: number, ratio?: number }} [opts] `gap` is the default margin (px, default 12)
 */
export function flowColumn(col, floats = [], { gap = 12, ratio = 4 / 3 } = {}) {
  const right = col.x + col.w, boxes = [], lows = { left: col.y, right: col.y };
  for (const f of floats) {
    const side = f.side === 'right' ? 'right' : 'left', g = f.gap ?? gap;
    const w = clamp(f.width ?? (f.share ?? 0.4) * col.w, 0, col.w);
    const size = reserve(f.dims, w, f.ratio ?? ratio);
    if (!size) continue;
    let y = Math.max(col.y + (f.y ?? 0), lows[side]);
    // a float that would meet one on the other side goes below it, as in CSS
    for (let again = true; again;) {
      again = false;
      for (const o of boxes) if (o.side !== side && y < o.y + o.h + o.gap - 1e-6 && y + size.h + g > o.y + 1e-6 && o.w + o.gap + size.w + g > col.w + 1e-6) { y = o.y + o.h + o.gap; again = true; }
    }
    const box = { id: f.id, side, x: side === 'left' ? col.x : right - size.w, y, w: size.w, h: size.h, guessed: size.guessed, gap: g };
    lows[side] = y + size.h + g;
    boxes.push(box);
  }
  const shape = (top, bottom) => {
    if (top < col.y - 1e-6 || (col.h !== undefined && bottom > col.y + col.h + 1e-6)) return null;
    let l = col.x, r = right;
    for (const b of boxes) {
      if (top < b.y + b.h + b.gap - 1e-6 && bottom > b.y + 1e-6) {
        if (b.side === 'left') l = Math.max(l, b.x + b.w + b.gap); else r = Math.min(r, b.x - b.gap);
      }
    }
    return r - l > 1e-6 ? { x: l, w: r - l } : null;
  };
  return { boxes: boxes.map(({ gap: _, ...b }) => b), shape, bottom: boxes.reduce((m, b) => Math.max(m, b.y + b.h + b.gap), col.y) };
}

/**
 * Text laid beside floated pictures, before any picture has arrived: `flowColumn`'s shape fed to the type tier's
 * `layIntoShape`. `layout` is a type-tier layout (createLayout(oracle)); `blocks` are as `layIntoShape` takes them
 * ({ prepared, lineHeight, gap?, align? }); `opts` are flowColumn's, plus `scale`, `minWidth` (logical; narrower bands are
 * stepped over, so no word is squeezed into a sliver beside a float) and `bottom` (the end of the room, default the column's
 * `h`, else unbounded).
 * @returns {{ lines: object[], fits: boolean, bottom: number, boxes: object[] }} `bottom` also clears the floats
 */
export function flowAround(layout, blocks, col, floats, opts = {}) {
  const flow = flowColumn(col, floats, opts);
  const end = opts.bottom ?? (col.h !== undefined ? col.y + col.h : 1e9);
  const laid = layout.layIntoShape(blocks, flow.shape, { top: col.y, bottom: end, scale: opts.scale ?? 1, minWidth: opts.minWidth ?? 0 });
  return { lines: laid.lines, fits: laid.fits, bottom: Math.max(laid.bottom, flow.bottom), boxes: flow.boxes };
}
