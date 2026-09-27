// annotations.core.js: timed ink annotations registered on the moving frame.
// Pure: which annotations are showing at a time, and where they sit, given a
// simple fade at each end so they don't snap on and off. No DOM; tested in Node.

/**
 * @typedef {{ type: 'circle'|'arrow', start: number, end: number, x: number, y: number,
 *   x2?: number, y2?: number, r?: number, label?: string }} Annotation
 *   x, y (and x2, y2 for an arrow) are normalised 0 to 1, independent of the video's pixel size.
 */

const FADE = 0.25; // seconds of fade in and out, capped at half the annotation's length

/**
 * The annotations showing at `time`, each with an `opacity` (0 to 1) for its fade.
 * @param {Annotation[]} list @param {number} time @returns {(Annotation & { opacity: number })[]}
 */
export function activeAnnotations(list, time) {
  if (!list?.length) return [];
  const out = [];
  for (const a of list) {
    if (time < a.start || time >= a.end) continue;
    const fade = Math.min(FADE, (a.end - a.start) / 2);
    const inO = fade > 0 ? Math.min(1, (time - a.start) / fade) : 1;
    const outO = fade > 0 ? Math.min(1, (a.end - time) / fade) : 1;
    out.push({ ...a, opacity: Math.min(inO, outO) });
  }
  return out;
}

/** Validate and normalise one annotation from loosely-typed input (JSON or a parsed VTT cue). Throws on a real problem. */
export function normalizeAnnotation(raw, i = 0) {
  const type = raw?.type === 'arrow' ? 'arrow' : raw?.type === 'circle' ? 'circle' : null;
  if (!type) throw new TypeError(`annotation ${i}: type must be "circle" or "arrow"`);
  const start = Number(raw.start), end = Number(raw.end);
  if (!(Number.isFinite(start) && Number.isFinite(end) && end > start)) throw new TypeError(`annotation ${i}: start and end must be numbers with end > start`);
  const num = (v, d) => (Number.isFinite(+v) ? +v : d);
  const out = { type, start, end, x: Math.min(1, Math.max(0, num(raw.x, 0.5))), y: Math.min(1, Math.max(0, num(raw.y, 0.5))) };
  if (raw.label) out.label = String(raw.label);
  if (type === 'circle') out.r = Math.min(0.5, Math.max(0.01, num(raw.r, 0.08)));
  else { out.x2 = Math.min(1, Math.max(0, num(raw.x2, out.x))); out.y2 = Math.min(1, Math.max(0, num(raw.y2, out.y))); }
  return out;
}

/** A list of raw annotation records, sorted by start time. Throws with the bad index on the first problem. */
export function normalizeAnnotations(list) {
  return (list ?? []).map(normalizeAnnotation).sort((a, b) => a.start - b.start);
}

/**
 * Parse a WebVTT metadata track of annotations: each cue's payload is one
 * JSON object (without `start`/`end`, taken from the cue timing instead).
 *   00:00:01.000 --> 00:00:03.500
 *   { "type": "circle", "x": 0.5, "y": 0.4, "r": 0.1 }
 * @param {string} vtt @param {(s: string) => number} parseVttTime a WebVTT `HH:MM:SS.mmm` parser (narration's `parseVtt.js`)
 */
export function parseAnnotationTrack(vtt, parseVttTime) {
  const body = String(vtt).replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const blocks = body.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
  const out = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines[0] === 'WEBVTT') continue;
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const [startStr, endStr] = timeLine.split('-->').map(s => s.trim().split(' ')[0]);
    const text = lines.slice(lines.indexOf(timeLine) + 1).join('\n').trim();
    if (!text) continue;
    let payload;
    try { payload = JSON.parse(text); } catch { continue; }
    out.push({ ...payload, start: parseVttTime(startStr), end: parseVttTime(endStr) });
  }
  return normalizeAnnotations(out);
}
