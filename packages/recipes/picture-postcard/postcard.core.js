// The picture postcard: the pure core. Runs in Node.
//
// What a postcard is: a 3:2 landscape card with a picture of Goa on the left, a name written under it, a stamp
// and a postmark on the right, and a line saying where to make your own. This file decides where each thing goes
// and how big the name is, from `{ name, scene, seed, event }` and a `measure` function the caller supplies
// (canvas measureText in the browser, a stub in Node). It draws nothing and touches no page.
//
//   const L = layout({ name: 'Asha Naik', scene: 'ferry', event: CONCLAVE_2026, measure });
//
// Names of any length and any script: the name shrinks to a floor, then wraps (three lines at most), then, as a last
// resort, breaks inside a word. Every line it returns fits the width it was given; the check proves it on the real
// faces. The library's faces cover Latin, Devanagari and Kannada; any other script (Malayalam, Tamil, Bengali,
// Urdu) is drawn in whatever the machine has, which the font stacks below name, and still has to fit.

import { rng, hashSeed } from '../../engine/src/rng.js';

/** 3:2 landscape, like a real postcard, and the size a PNG is made at. */
export const CARD = Object.freeze({ width: 1800, height: 1200 });
export const MARGIN = 72;

/** A card is paper and ink, the same on a light page and a dark one: it is a thing to keep, not a part of the page. */
export const PALETTE = Object.freeze({
  paper: '#f3ebdc', ink: '#2b2118', soft: '#6b5a48', rule: '#c9b79a', frame: '#fbf7ee',
  laterite: '#a8452d', indigo: '#243a63', marigold: '#d98a1f', sea: '#2f6f86', stampPaper: '#f7efdc',
});

/** Where people make their own. Shown small on every card. */
export const MAKE_YOUR_OWN = Object.freeze({ lead: 'Make your own:', url: 'susegad.asymmetrica.ai/postcard' });

// Type stacks as canvas font strings. The library's display, hand and body faces come first (the same names tokens.css
// carries); then the system faces that cover what the library's do not. A canvas falls back glyph by glyph, so a name
// in Malayalam is drawn in the first face on the machine that has Malayalam, and a Latin word beside it in Castoro.
// Arabic faces: WebKit on Windows drops the 2nd word of a Noto Naskh or Nastaliq Urdu name; Geeza Pro, Segoe UI, Tahoma first.
const SYSTEM ="'Noto Sans Malayalam', 'Noto Serif Malayalam', Kartika, 'Malayalam Sangam MN', 'Noto Sans Tamil', 'Tamil Sangam MN', Latha, 'Nirmala UI', 'Noto Sans Bengali', 'Bangla Sangam MN', Vrinda, 'Geeza Pro', 'Segoe UI', Tahoma, 'Noto Naskh Arabic', 'Arial Unicode MS'";
export const STACKS = Object.freeze({
  display: `'Castoro', 'Tiro Devanagari Marathi', 'Tiro Kannada', 'Castoro Fallback', 'Iowan Old Style', Georgia, 'Noto Serif Devanagari', 'Noto Serif Kannada', 'Kohinoor Devanagari', 'Devanagari Sangam MN', 'Kannada Sangam MN', Tunga, ${SYSTEM}, serif`,
  hand: `'Kalam', 'Kalam Fallback', 'Segoe Print', 'Bradley Hand', 'Noto Sans Kannada', 'Kohinoor Devanagari', 'Devanagari Sangam MN', 'Noto Sans Devanagari', Mangal, 'Kannada Sangam MN', Tunga, ${SYSTEM}, cursive`,
  body: `'Mukta', 'Noto Sans Kannada', 'Mukta Fallback', 'Segoe UI', system-ui, 'Kohinoor Devanagari', 'Devanagari Sangam MN', 'Noto Sans Devanagari', Mangal, 'Kannada Sangam MN', Tunga, ${SYSTEM}, sans-serif`,
});
const WEIGHT = { display: 400, hand: 400, body: 400, label: 600 };
/** A canvas font string. `face` is 'display', 'hand', 'body' or 'label' (the body face at 600, for the stamp). */
export const fontOf = (face, size) => `${WEIGHT[face]} ${size}px ${STACKS[face === 'label' ? 'body' : face]}`;

// ── names ──────────────────────────────────────────────────────────────────

export const NAME_MAX = 60; // graphemes kept; the page's input says the same

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
/** A string's graphemes, so a break never lands inside a conjunct or a combining mark. */
export const graphemes = s => (segmenter ? Array.from(segmenter.segment(s), x => x.segment) : Array.from(s));

/**
 * A typed name made safe to lay out: normalised, controls and bidi overrides removed, runs of spaces made one,
 * trimmed, and cut at NAME_MAX graphemes. It is never "corrected": a name stays as written, case and all.
 */
export function normaliseName(raw) {
  const s = String(raw ?? '').normalize('NFC')
    .replace(/[\p{Cc}​‎‏‪-‮⁠-⁩﻿]/gu, ' ')
    .replace(/\s+/gu, ' ').trim();
  const g = graphemes(s);
  return g.length > NAME_MAX ? g.slice(0, NAME_MAX).join('').trim() : s;
}

/** The card's seed: given, else the name's hash. Small, so every scene takes it as it would a number typed by hand. */
export function seedFor(name, seed) {
  if (seed !== undefined && seed !== null && seed !== '') return typeof seed === 'number' && Number.isFinite(seed) ? seed : (hashSeed(String(seed)) % 100000) + 1;
  return (hashSeed(normaliseName(name) || 'guest') % 100000) + 1;
}

const SCRIPTS = [
  ['devanagari', /\p{Script=Devanagari}/u], ['kannada', /\p{Script=Kannada}/u], ['malayalam', /\p{Script=Malayalam}/u],
  ['tamil', /\p{Script=Tamil}/u], ['bengali', /\p{Script=Bengali}/u], ['telugu', /\p{Script=Telugu}/u], ['gujarati', /\p{Script=Gujarati}/u],
  ['gurmukhi', /\p{Script=Gurmukhi}/u], ['arabic', /\p{Script=Arabic}/u], ['hebrew', /\p{Script=Hebrew}/u], ['cjk', /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u],
  ['cyrillic', /\p{Script=Cyrillic}/u], ['greek', /\p{Script=Greek}/u], ['thai', /\p{Script=Thai}/u],
];
const COVERED = new Set(['latin', 'devanagari', 'kannada']);
const TALL = new Set(['devanagari', 'kannada', 'malayalam', 'tamil', 'bengali', 'telugu', 'gujarati', 'gurmukhi', 'thai', 'arabic']);

/**
 * The script a name is mostly in, whether it runs right to left, and whether the library's own faces cover it.
 * A name in two scripts takes the first non-Latin one it finds: the Latin letters beside it are drawn in the
 * display face either way.
 * @returns {{ script: string, rtl: boolean, covered: boolean, tall: boolean }}
 */
export function scriptOf(text) {
  const s = String(text ?? '');
  const hit = SCRIPTS.find(([, re]) => re.test(s));
  const script = hit ? hit[0] : 'latin';
  return { script, rtl: script === 'arabic' || script === 'hebrew', covered: COVERED.has(script), tall: TALL.has(script) };
}

// ── breaking text into lines ───────────────────────────────────────────────

/**
 * Lines of `text` no wider than `width`, at most `maxLines`, or null when it cannot be done. Words stay whole unless
 * `breakWords`, which lets a word wider than the line be cut between graphemes.
 * @param {string} text @param {(s: string) => number} width measures a string
 * @param {number} maxWidth @param {number} maxLines @param {{ breakWords?: boolean }} [o]
 * @returns {string[] | null}
 */
export function breakLines(text, width, maxWidth, maxLines, { breakWords = false } = {}) {
  const words = String(text ?? '').split(' ').filter(Boolean), lines = [];
  let line = '';
  const flush = () => { if (line) lines.push(line); line = ''; };
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (width(next) <= maxWidth) { line = next; continue; }
    flush();
    if (width(w) <= maxWidth) { line = w; continue; }
    if (!breakWords) return null;
    for (const g of graphemes(w)) {
      if (!line || width(line + g) <= maxWidth) line += g; else { flush(); line = g; }
    }
  }
  flush();
  return lines.length <= maxLines ? lines : null;
}

/**
 * The biggest size from `max` down to `min` at which `text` fits in `maxLines` lines of `maxWidth`, and its lines.
 * Null when none does. `measure(text, size)` is the width of text at a size.
 */
export function fitLines(text, measure, { width, maxLines, max, min, breakWords = false, step = 2 }) {
  for (let size = max; size >= min; size -= step) {
    const lines = breakLines(text, t => measure(t, size), width, maxLines, { breakWords });
    if (lines) return { size, lines };
  }
  return null;
}

// ── where things go ────────────────────────────────────────────────────────

const PICTURE = { frame: { x: MARGIN, y: MARGIN, w: 1056, h: 720 }, border: 24 }; // inner: 1008 by 672, exactly 3:2
// the name keeps the picture mat's inset on both sides: its ends line up with the picture and clear the card edge and divider
const NAME_BOX = { x: MARGIN + PICTURE.border, y: 880, w: 1056 - 2 * PICTURE.border, h: 248 };
// ink can overhang its advance (a J, a Kannada vowel sign), so the size is fitted a little inside the inset box
const NAME_SLACK = 16;
const KICKER = { x: MARGIN + 1056 / 2, y: 846, size: 40 };
const RIGHT = { x: 1176, w: 552 };

/**
 * The name, laid out: the largest size at which it sits on one line (floor 84), else on two or three lines, else
 * broken inside a word. Every line is within `box.w`, and the block is within `box.h`.
 * @returns {{ size: number, lineHeight: number, lines: string[] }}
 */
export function fitName(text, measure, { w = NAME_BOX.w - 2 * NAME_SLACK, h = NAME_BOX.h, tall = false } = {}) {
  const lh = tall ? 1.5 : 1.22, max = tall ? 128 : 156;
  for (const n of [1, 2, 3]) {
    const hi = Math.min(max, Math.floor(h / (n * lh))), lo = n === 1 ? 84 : 56;
    if (hi < lo) continue;
    const fit = fitLines(text, (t, s) => measure(t, s, 'display'), { width: w, maxLines: n, max: hi, min: lo });
    if (fit) return { size: fit.size, lineHeight: Math.round(fit.size * lh), lines: fit.lines };
  }
  const fit = fitLines(text, (t, s) => measure(t, s, 'display'), { width: w, maxLines: 3, max: Math.floor(h / (3 * lh)), min: 18, breakWords: true });
  // at 18 px a grapheme is under 18 wide, so NAME_MAX of them fit three lines of 1056; the floor below is for a measure that is wildly off
  const size = fit?.size ?? 18, lines = fit?.lines ?? graphemes(text).slice(0, 3);
  return { size, lineHeight: Math.round(size * lh), lines };
}

/**
 * An alt text that reads the card, the name first so it is heard before the long clause:
 * "A postcard for Asha: the ferry crossing the Mandovi, with a jetty on each bank. Stamped Conclave 2026, postmarked Goa 22–23 Oct 2026."
 * With no name it says there is room for one.
 */
export function describe({ name, blurb, event }) {
  const what = blurb ?? 'Goa';
  const lead = name ? `A postcard for ${name}: ${what}.` : `A postcard with space for your name: ${what}.`;
  const stamped = event?.stamp ? `Stamped ${event.stamp}` : '';
  const marked = event?.place || event?.dates ? `postmarked ${[event.place, event.dates].filter(Boolean).join(' ')}` : '';
  const tail = [stamped, marked].filter(Boolean).join(', ');
  return tail ? `${lead} ${tail[0].toUpperCase()}${tail.slice(1)}.` : lead;
}

/**
 * Where everything on the card goes, in card pixels (CARD.width by CARD.height).
 * @param {{ name: string, placeholder?: string, scene?: string, blurb?: string, seed?: number | string, event?: object,
 *   measure: (text: string, size: number, face: 'display' | 'hand' | 'body' | 'label') => number }} o
 */
export function layout({ name, placeholder = '', scene = 'posta', blurb, seed, event = {}, measure }) {
  const text = normaliseName(name);
  // an empty name leaves the place for it holding `placeholder`, which is drawn lighter and is never the card's name
  const shown = text || normaliseName(placeholder), empty = !text && !!shown;
  const sc = scriptOf(shown);
  const s = seedFor(text, seed), r = rng(s);
  const ev = { stamp: '', place: '', dates: '', line: '', url: MAKE_YOUR_OWN.url, ...event };

  const fit = shown ? fitName(shown, measure, { tall: sc.tall }) : { size: 0, lineHeight: 0, lines: [] };
  const blockH = fit.lines.length * fit.lineHeight, top = NAME_BOX.y + Math.round((NAME_BOX.h - blockH) / 2);
  const nameLines = fit.lines.map((t, i) => ({ text: t, x: NAME_BOX.x + NAME_BOX.w / 2, baseline: top + i * fit.lineHeight + Math.round(fit.lineHeight / 2 + fit.size * 0.3) }));

  // the stamp: a portrait rectangle with its words at the foot, over the top right corner of the card
  const stamp = { x: CARD.width - MARGIN - 220, y: MARGIN, w: 220, h: 268, rot: Math.round((r.range(-1.6, 1.6)) * 100) / 100 };
  const stampWords = ev.stamp ? fitLines(ev.stamp.toUpperCase(), (t, z) => measure(t, z, 'label'), { width: stamp.w - 56, maxLines: 2, max: 26, min: 14, breakWords: true }) : null;

  // the postmark: a ring over the stamp's left edge, place along the top, dates along the bottom, cancellation waves to the left
  const pm = { cx: stamp.x - 48, cy: stamp.y + 300, r: 104, rot: Math.round(r.range(-14, -4)) };
  const ringText = (str, maxLen, max) => {
    const t = str.toUpperCase(); if (!t) return null;
    let size = max; while (size > 12 && measure(t, size, 'label') > maxLen) size -= 1;
    return { text: t, size, tooLong: measure(t, size, 'label') > maxLen };
  };
  const arc = Math.PI * (pm.r - 32) * 0.86;
  const postmark = {
    ...pm, ringTop: ringText(ev.place, arc, 26), ringBottom: ringText(ev.dates, arc, 24),
    center: ev.stamp ? fitLines(ev.stamp.toUpperCase(), (t, z) => measure(t, z, 'label'), { width: (pm.r - 46) * 1.7, maxLines: 2, max: 20, min: 11, breakWords: true }) : null,
    waves: Array.from({ length: 5 }, (_, i) => ({ y: pm.cy - 44 + i * 22, x0: pm.cx - pm.r - 170, x1: pm.cx - pm.r + 6, amp: 7 + r.range(0, 3), phase: r.range(0, Math.PI * 2), period: 70 + r.range(-6, 6) })),
  };

  // the ruled lines on the right, where the optional line is written in the hand face
  const ruled = [610, 700, 790].map(y => ({ y, x0: RIGHT.x, x1: RIGHT.x + RIGHT.w }));
  const evFit = ev.line ? (fitLines(normaliseName(ev.line), (t, z) => measure(t, z, 'hand'), { width: RIGHT.w, maxLines: 3, max: 46, min: 28, breakWords: true })) : null;
  const eventLine = evFit ? { size: evFit.size, lines: evFit.lines.map((t, i) => ({ text: t, x: RIGHT.x, baseline: ruled[i].y - 10 })) } : null;

  const footerSize = 30;
  const footer = { size: footerSize, x: CARD.width - MARGIN, align: 'right', lines: [{ text: MAKE_YOUR_OWN.lead, baseline: 1062 }, { text: ev.url, baseline: 1102 }] };

  const { frame, border } = PICTURE;
  const inner = { x: frame.x + border, y: frame.y + border, w: frame.w - 2 * border, h: frame.h - 2 * border };
  return {
    card: CARD, seed: s, scene, script: sc.script, rtl: sc.rtl, covered: sc.covered,
    name: { text, empty, size: fit.size, lineHeight: fit.lineHeight, lines: nameLines, box: { ...NAME_BOX }, direction: sc.rtl ? 'rtl' : 'ltr' },
    kicker: ev.place ? { text: `Greetings from ${ev.place}`, x: KICKER.x, baseline: KICKER.y, size: KICKER.size } : null,
    picture: { frame: { ...frame }, inner, border },
    stamp: { ...stamp, words: stampWords, wordsRaw: ev.stamp },
    postmark, ruled, divider: { x: 1152, y0: MARGIN, y1: CARD.height - MARGIN }, eventLine, footer, right: { ...RIGHT },
    alt: describe({ name: text, blurb, event: ev }),
  };
}

/** The rectangle a picture of `srcW` by `srcH` fills in `inner` when covering it, centred: [sx, sy, sw, sh]. */
export function coverRect(srcW, srcH, inner, focus = { x: 0.5, y: 0.5 }) {
  const k = Math.max(inner.w / srcW, inner.h / srcH), sw = inner.w / k, sh = inner.h / k;
  return [(srcW - sw) * focus.x, (srcH - sh) * focus.y, sw, sh];
}

// ── files ──────────────────────────────────────────────────────────────────

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

/** The image type a run of bytes really is, by its first bytes. null when it is none we know. @param {Uint8Array} b */
export function sniff(b) {
  const at = (i, ...v) => v.every((x, k) => b[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x47, 0x49, 0x46, 0x38, 0x39, 0x61)) return 'image/gif'; // GIF89a: the one this recipe writes
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  return null;
}

/** A name as a file-name word: lower case, letters and digits kept in any script, the rest as single hyphens. */
export function slug(name) {
  const s = String(name ?? '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return s.slice(0, 40).replace(/-+$/g, '') || 'guest';
}

/** The file name for a card, its extension taken from the type the bytes really are. */
export const fileName = (name, type) => `postcard-${slug(name)}.${EXT[type] ?? 'bin'}`;

/** The GIF's frame times: `fps` frames a second for `seconds`, from `start` on the scene's own clock. */
export function gifTimes({ fps = 10, seconds = 3, start = 0 } = {}) {
  const n = Math.max(1, Math.round(fps * seconds));
  return Array.from({ length: n }, (_, i) => start + i / fps);
}

/** What to say while a GIF is made: the stage and a percentage that only ever goes up. @param {number} done @param {number} total */
export function progressText(stage, done, total, say = { drawing: 'Drawing the frames: {percent}%', encoding: 'Putting the frames together: {percent}%' }) {
  const percent = Math.min(100, Math.round((100 * done) / Math.max(1, total)));
  return (stage === 'encoding' ? say.encoding : say.drawing).replace('{percent}', String(percent));
}
