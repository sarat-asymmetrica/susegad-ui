// A fake oracle for Node: no Pretext, no canvas. Every grapheme is half the
// font size wide (as the old canvas shim made it); lines break at spaces, and
// inside a word only when that word alone is wider than the line (brokeWord).
// Trailing spaces stay on the line's text but not in its width, as Pretext
// does. Tests only: it does not ship (not in the registry's files).

const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const isSpace = g => /^\s/u.test(g);

export function createFakeOracle() {
  return {
    start: 0, // cursors are grapheme indexes
    prepare(text, font) {
      const px = parseFloat(/([\d.]+)px/.exec(font)?.[1] ?? '16');
      return { gs: [...seg.segment(text)].map(s => s.segment), unit: px * 0.5 };
    },
    nextLine({ gs, unit }, cursor, maxWidth) {
      const n = gs.length;
      if (cursor >= n) return null;
      let end = cursor, ink = cursor, i = cursor, brokeWord = false;
      while (i < n) {
        let a = i; while (a < n && isSpace(gs[a])) a++;      // leading spaces count toward the ink
        let b = a; while (b < n && !isSpace(gs[b])) b++;     // the word
        let c = b; while (c < n && isSpace(gs[c])) c++;      // its trailing spaces
        if ((b - cursor) * unit > maxWidth + 1e-9) break;
        ink = b; end = c; i = c;
      }
      if (end === cursor) { // not even the first word fits: cut inside it
        let b = cursor; while (b < n && isSpace(gs[b])) b++;
        let w = b; while (w < n && !isSpace(gs[w])) w++;
        const room = Math.max(1, Math.floor((maxWidth + 1e-9) / unit) - (b - cursor));
        end = ink = Math.min(w, b + room);
        brokeWord = end < w;
        if (!brokeWord) { end = w; while (end < n && isSpace(gs[end])) end++; }
      }
      return { text: gs.slice(cursor, end).join(''), width: (ink - cursor) * unit, end, brokeWord };
    },
    stats(prepared, maxWidth) {
      let cursor = 0, lineCount = 0, maxLineWidth = 0;
      for (let line; (line = this.nextLine(prepared, cursor, maxWidth)); cursor = line.end) {
        lineCount++; maxLineWidth = Math.max(maxLineWidth, line.width);
      }
      return { lineCount, maxLineWidth };
    },
  };
}
