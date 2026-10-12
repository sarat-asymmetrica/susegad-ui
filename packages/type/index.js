// The type tier (decision 0019): words set in the world, still real text.
//
// Never import this file statically from a scene. Load it with a dynamic
// import (from a scene folder, the path is ../../type/index.js) when an
// element that places words is about to be seen, then:
//
//   await type.fontReady('400 20px Kalam');
//   const laid = type.fitSize(sizes, build, type.arch(...), { top, bottom, scale });
//   type.project(laid.lines, blocks, { W, H });
//
// layout.core.js is the pure geometry (an oracle's lines in, line boxes out,
// tested in Node against oracle.fake.js); measure.js is the oracle, the one
// door to Pretext (decision 0029). This file binds the two for the scenes and
// is the side-effect edge: fonts, and one span per line in the DOM.

import { createLayout } from './layout.core.js';
import { createPretextOracle } from './measure.js';

export { rect, arch, slant, calmOf } from './layout.core.js';
export const { prepare, layIntoShape, fitSize, setBlocks, labelBox, shrinkWrap, balance, measure, forget } = createLayout(createPretextOracle());
// a face that finishes loading after something was measured in its fallback: forget what was measured, so the next lay-out is true
try { globalThis.document?.fonts?.addEventListener?.('loadingdone', forget); } catch { /* no font events: scenes relay out after fontReady anyway */ }

const PLAIN = /^(H[1-6]|P)$/;
const ACTIVE = 'a,button,input,select,textarea,img,svg,video,audio,iframe,[tabindex]';
/**
 * An element's slotted words as blocks [{ tag, text }]: headings and
 * paragraphs of plain text only. Null when there are none, or when any child
 * holds something to press or see (a link, an image): those stay in the panel.
 */
export function readBlocks(el) {
  const out = [];
  for (const c of el.children) {
    if (!PLAIN.test(c.tagName) || c.querySelector(ACTIVE)) return null;
    const text = c.textContent.replace(/\s+/g, ' ').trim();
    if (text) out.push({ tag: c.tagName.toLowerCase(), text });
  }
  return out.length ? out : null;
}

/** Wait for a face before measuring it: Pretext measures whatever the canvas has now. `text` makes the load fetch the faces that cover those characters (a stack's Kannada face is split by unicode-range). */
export async function fontReady(font, text) {
  try { if (globalThis.document?.fonts?.load) { await document.fonts.load(font, text); forget(); } } catch { /* measure with the fallback */ }
}

/**
 * Write each line as an absolutely placed span inside its block's element.
 * `blocks[i].el` is the element that carries the block's meaning (a heading, a
 * paragraph): its lines go inside it, in reading order, so assistive
 * technology reads the block as written. Positions are percentages of the
 * scene's logical size, so the layer scales with the drawing; `font` and
 * `lineHeight` are CSS. Spans are reused between layouts.
 */
export function project(lines, blocks, { W, H }) {
  const byBlock = blocks.map(() => []);
  for (const l of lines) byBlock[l.block].push(l);
  byBlock.forEach((mine, i) => {
    const { el, font, lineHeight } = blocks[i];
    const spans = [...el.children].filter(c => c.dataset.line !== undefined);
    while (spans.length > mine.length) spans.pop().remove();
    mine.forEach((l, k) => {
      let s = spans[k];
      if (!s) { s = document.createElement('span'); s.dataset.line = ''; el.append(s); }
      if (s.textContent !== l.text) s.textContent = l.text;
      Object.assign(s.style, {
        position: 'absolute', whiteSpace: 'pre', left: `${(l.x / W) * 100}%`, top: `${(l.y / H) * 100}%`,
        font, lineHeight: `${lineHeight}px`,
      });
    });
  });
}
