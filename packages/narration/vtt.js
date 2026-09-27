// WebVTT: one cue per phrase for captions, with a `<HH:MM:SS.mmm>` timestamp
// tag before every word after the first so a player can highlight the
// current word as it plays (the karaoke-tag form the spec already defines;
// a caption renderer that ignores the tags still shows the plain words).
// Pure: strings in, strings out.

const pad = (n, len = 2) => String(n).padStart(len, '0');

/** Seconds to WebVTT's `HH:MM:SS.mmm`. */
export function formatVttTime(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(ss)}.${pad(ms, 3)}`;
}

/** `HH:MM:SS.mmm` (or `MM:SS.mmm`) to seconds. */
export function parseVttTime(str) {
  const m = str.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/);
  if (!m) throw new Error(`not a WebVTT timestamp: ${str}`);
  const [, h, mm, ss, ms] = m;
  return (Number(h) || 0) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms) / 1000;
}

/**
 * @typedef {{ start: number, end: number, words: { word: string, start: number, end: number }[] }} Phrase
 */

/** One cue's text: the first word plain, every later word preceded by its own start-time tag. */
function cueText(phrase) {
  return phrase.words
    .map((w, i) => (i === 0 ? w.word : `<${formatVttTime(w.start)}>${w.word}`))
    .join(' ');
}

/**
 * Write a WebVTT track: one cue per phrase, word-timestamp tags inside it.
 * @param {Phrase[]} phrases
 * @param {{ ids?: boolean }} [opts] set `ids: true` to number cues, useful for tests and debugging.
 * @returns {string}
 */
export function writeVtt(phrases, { ids = false } = {}) {
  const blocks = phrases.map((phrase, i) => {
    const header = ids ? `${i + 1}\n` : '';
    return `${header}${formatVttTime(phrase.start)} --> ${formatVttTime(phrase.end)}\n${cueText(phrase)}`;
  });
  return `WEBVTT\n\n${blocks.join('\n\n')}\n`;
}

/**
 * Parse a WebVTT track written by `writeVtt` back into phrases with word
 * timings. Tolerant of a cue id line and of blank lines between cues; not a
 * general VTT parser (no styling, regions or NOTE blocks).
 * @param {string} vtt
 * @returns {Phrase[]}
 */
export function parseVtt(vtt) {
  const body = vtt.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const blocks = body.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
  const phrases = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines[0] === 'WEBVTT') continue;
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const [startStr, endStr] = timeLine.split('-->').map(s => s.trim().split(' ')[0]);
    const start = parseVttTime(startStr), end = parseVttTime(endStr);
    const text = lines.slice(lines.indexOf(timeLine) + 1).join(' ');
    const words = [];
    // The first word has no tag and starts at the cue start; each later
    // word is preceded by a <timestamp> tag giving its own start.
    const re = /(?:<([^>]+)>)?([^<]+)/g;
    let m, wordStart = start;
    while ((m = re.exec(text))) {
      const [, tag, chunk] = m;
      if (tag) wordStart = parseVttTime(tag);
      const word = chunk.trim();
      if (!word) continue;
      words.push({ word, start: wordStart });
    }
    // A word's end is the next word's start, or the cue's end for the last one.
    words.forEach((w, i) => { w.end = i + 1 < words.length ? words[i + 1].start : end; });
    phrases.push({ start, end, words });
  }
  return phrases;
}
