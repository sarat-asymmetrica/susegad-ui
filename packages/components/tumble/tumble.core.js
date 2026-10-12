// Tumble: the pure core. Runs in Node.
//
// A headline that arrives. The real heading stays in the page as one string of text; the skins lay an
// aria-hidden copy of its letters over it, in the places the browser put them, and move that copy. Everything
// here is data or a small pure function: splitting text into the letters a person sees, grouping them into the
// lines the browser laid out, and the plans and keyframes for the two ways of arriving. Warm slides each line
// in from alternate sides and settles. Playful drops each letter from above with a little spin, bounces it once
// and settles it, one after another.

import { rng } from '../../engine/src/rng.js';

/** More letters than this and the heading is left alone: a paragraph is not a headline, and 160 animations is plenty. */
export const MAX_LETTERS = 160;
/** How long a hold waits for a page to call play() before it lets the heading go. */
export const HOLD_MS = 8000;
/** The most any arrival may take from first move to last settle, in milliseconds. */
export const MAX_TOTAL_MS = 2600;

/** A colour with no ink in it: `transparent`, or an alpha of 0 (`rgba(..., 0)`, or `/ 0` in the newer syntaxes). Black is not clear. */
export const isClear = c => !c || c === 'transparent' || /(?:^rgba\([^)]*,|\/)\s*0(?:\.0+)?%?\s*\)$/.test(c);

/**
 * The letters a person sees in a piece of text, with where each starts in the string (UTF-16 offset) and
 * how long it is. Spaces and other whitespace are skipped: they draw nothing.
 * @param {string} text
 * @returns {{ ch: string, at: number, len: number }[]}
 */
export function letters(text) {
  const out = [];
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  if (seg) {
    for (const { segment, index } of seg.segment(text)) if (segment.trim()) out.push({ ch: segment, at: index, len: segment.length });
  } else {
    let at = 0;
    for (const ch of text) { if (ch.trim()) out.push({ ch, at, len: ch.length }); at += ch.length; }
  }
  return out;
}

/**
 * Group measured letters into the lines the browser laid out. A letter joins the line whose vertical middle is
 * within `tol` of its own height from the letter's middle; lines come back top to bottom, letters left to right
 * in the order given (reading order).
 * @param {{ y: number, h: number }[]} boxes
 * @returns {number[][]} indexes into `boxes`, one list per line
 */
export function groupLines(boxes, tol = 0.5) {
  /** @type {{ mid: number, h: number, idx: number[] }[]} */
  const lines = [];
  boxes.forEach((b, i) => {
    const mid = b.y + b.h / 2;
    const line = lines.find(l => Math.abs(l.mid - mid) <= Math.max(l.h, b.h) * tol);
    if (line) line.idx.push(i);
    else lines.push({ mid, h: b.h, idx: [i] });
  });
  return lines.sort((a, b) => a.mid - b.mid).map(l => l.idx);
}

// ── warm: lines slide in from alternate sides ───────────────────────────────

/**
 * One entry per line: which side it comes from (the first from the left, the next from the right, and so on),
 * how far, when it starts and how long it takes. Lines follow one another.
 * @param {number} lineCount @param {number} width the heading's width in px
 * @returns {{ from: number, delay: number, duration: number }[]}
 */
export function warmPlan(lineCount, width) {
  const distance = Math.max(140, Math.round(width * 0.55));
  const gap = lineCount > 4 ? 110 : 170;
  return Array.from({ length: lineCount }, (_, i) => ({ from: (i % 2 ? 1 : -1) * distance, delay: i * gap, duration: 1000 }));
}

/** A line's slide: in from the side, a little past, settled. */
export function warmFrames(from) {
  const s = Math.sign(from) || 1;
  return [
    { transform: `translateX(${from}px)`, opacity: 0, offset: 0, easing: 'cubic-bezier(.32,.4,.4,1)' },
    { transform: `translateX(${-s * 7}px)`, opacity: 1, offset: 0.72, easing: 'ease-in-out' },
    { transform: `translateX(${s * 2}px)`, opacity: 1, offset: 0.88, easing: 'ease-out' },
    { transform: 'translateX(0)', opacity: 1, offset: 1 },
  ];
}

// ── playful: letters drop, spin, bounce once and settle ────────────────────────

/**
 * One entry per letter in reading order: when it starts, how long it takes, how far above it begins (in ems of
 * its own height), how much it spins, and how high its one bounce goes (also in ems). The stagger is held so the
 * whole arrival never passes MAX_TOTAL_MS, however long the heading.
 * @param {number} count @param {string|number} [seed]
 */
export function playfulPlan(count, seed = 'tumble') {
  const r = rng(`tumble|${seed}`);
  const duration = 850;
  const step = count > 1 ? Math.min(46, (MAX_TOTAL_MS - duration) / (count - 1)) : 0;
  return Array.from({ length: count }, (_, i) => ({
    delay: Math.round(i * step),
    duration,
    drop: +r.range(1.3, 2.2).toFixed(2),
    spin: +(r.range(14, 34) * r.sign()).toFixed(1),
    bounce: +r.range(0.14, 0.26).toFixed(2),
  }));
}

/** A letter's drop: from above and turned, down fast, up in one small bounce, settled. `unit` is the letter's height in px. */
export function dropFrames(p, unit) {
  const px = v => `${+(v * unit).toFixed(1)}px`;
  return [
    { transform: `translateY(${px(-p.drop)}) rotate(${p.spin}deg)`, opacity: 0, offset: 0, easing: 'cubic-bezier(.5,0,.9,.6)' },
    { transform: `translateY(0) rotate(${+(-p.spin * 0.12).toFixed(1)}deg)`, opacity: 1, offset: 0.5, easing: 'cubic-bezier(.2,.7,.4,1)' },
    { transform: `translateY(${px(-p.bounce)}) rotate(${+(p.spin * 0.05).toFixed(1)}deg)`, opacity: 1, offset: 0.72, easing: 'cubic-bezier(.5,0,.8,.5)' },
    { transform: 'translateY(0) rotate(0deg)', opacity: 1, offset: 1 },
  ];
}

/** The time from the first move to the last settle of a set of plans. */
export const totalMs = plans => plans.reduce((m, p) => Math.max(m, p.delay + p.duration), 0);
