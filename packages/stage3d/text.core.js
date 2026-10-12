// Words in z-space: what two painters need to put one layout on screen. The pure half.
//
// The type tier lays the lines (decision 0029); nothing here breaks one. A layout's `lines` become line boxes once
// (lineBoxes), and each painter reads those same boxes: the DOM spans (spanStyle) that stay the real text, and the textured
// quads (quadPlan, drawn by text.live.js) that give the words depth. This file is also the camera arithmetic that puts a
// quad on exactly the pixels its span occupies. No three, no DOM, no canvas: runs in Node.

/** The distance of the camera from the plane the object stands in, in the object's own units (a long lens, so near orthographic). */
export const CAM_D = 30;

/** Line boxes for the painters: the layout's lines moved to be relative to the column's corner. `tail` is the space a span keeps after a line, so copied text reads as a paragraph. */
export function lineBoxes(lines, col) {
  return lines.map((l, k) => ({ k, text: l.text, tail: k < lines.length - 1 && !/\s$/.test(l.text) ? ' ' : '', x: l.x - col.x, y: l.y - col.y, w: l.w, h: l.h }));
}

/**
 * The boxes with their tops moved (by half a pixel at most) so each line's baseline falls on a whole CSS pixel in page px, a hair
 * below it. The engine rounds a DOM line's baseline its own way (at 2x density it floors to a whole CSS pixel, and layout units
 * are sixteenths of a pixel that can truncate a value just under the line), and a baseline already on the grid has nothing to
 * round, so the span and the quad that stand on one box agree. `pageY` is the paragraph's top in page px, `base` the baseline's
 * distance from a line box's top.
 */
export function snapBoxes(boxes, { pageY, base }) {
  return boxes.map(b => ({ ...b, y: Math.round(pageY + b.y + base) + 0.02 - pageY - base }));
}

/** The style the DOM-span painter gives one line's span: the same font the layout measured, at the box. */
export function spanStyle(b, { font, lineHeight }) {
  return { position: 'absolute', whiteSpace: 'pre', left: `${b.x.toFixed(2)}px`, top: `${b.y.toFixed(2)}px`, font, lineHeight: `${lineHeight.toFixed(1)}px` };
}

/** Where the text's baseline falls in a line box, the way CSS places it: the half-leading is shared above and below. */
export const baselineOf = (h, ascent, descent) => (h - (ascent + descent)) / 2 + ascent;

/**
 * What the quad painter draws for each box: the box grown by `pad` px (so a glyph's overhang is not cut), the texture size
 * in device px, and a key that changes when the texture must be drawn again (the text, the font, the ink or the density).
 */
export function quadPlan(boxes, { font, ink, dpr = 1, pad = 2 }) {
  return boxes.map(b => {
    const w = Math.ceil((b.w + 2 * pad) * dpr), h = Math.ceil(b.h * dpr);
    return { k: b.k, text: b.text, x: b.x, y: b.y, w: b.w, h: b.h, pad, texW: w, texH: h, key: `${font}|${ink}|${dpr}|${b.text}|${w}x${h}` };
  });
}

/** The picture frame that covers a rectangle of interest: `rect` {x, y, w, h} in px from the anchor (the object's foot), `margin` px round it. */
export function frameCovering(rect, h, dpr, margin = 6) {
  const wc = Math.round(rect.w + 2 * margin), hc = Math.round(rect.h + 2 * margin);
  return { wc, hc, cx: margin - rect.x, cy: margin - rect.y, h, dpr };
}

/** How much a plane at depth z (toward the camera is positive) is magnified against the plane z = 0. */
export const depthScale = (z, D = CAM_D) => (D - z) / D;

/** The world point (z given) that lands on canvas px (sx, sy), for a camera at D looking at the anchor's plane with the anchor at (cx, cy). */
export function worldAt(sx, sy, f, z = 0, D = CAM_D) {
  const k = depthScale(z, D);
  return { x: ((sx - f.cx) / f.h) * k, y: ((f.cy - sy) / f.h) * k, z };
}

/** The camera's frustum edges at the near plane, so that the plane z = 0 maps `f.h` px to one unit with the anchor at (cx, cy). */
export function frustumOf(f, near = 1, D = CAM_D) {
  const s = near / D / f.h;
  return { left: -f.cx * s, right: (f.wc - f.cx) * s, top: f.cy * s, bottom: -(f.hc - f.cy) * s };
}
