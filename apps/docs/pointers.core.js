// No pointers a reader cannot follow.
//
// A page on the site is read by people who cannot open the briefs, the reviews,
// the requests or the ledger: those folders stay out of the public tree
// (tools/publish/export.mjs, PRIVATE). A page that says "see docs/requests/..." or
// "Rasika's review found..." sends the reader to something they cannot open.
//
// Pure: text in, findings out. The edge hands in `isPrivate` (the export's own
// rule, so the two can never disagree) and the texts the site renders.
// Agent names as credit ("the story is Kathakar's") are fine: the kernels are public.

// A repo path written in prose or code: docs/..., tools/..., .claude/...
const PATH = /(?<![\w./-])((?:docs|tools|\.claude)\/[\w@.+-]+(?:\/[\w@.+-]+)*)/g;

// The folders the request names, whether or not the export list gains or loses a line later.
const NAMED = /^docs\/(?:briefs|reviews|requests|runs|shots)(?:\/|$)|^docs\/(?:LEDGER|GOAL)/;

// An agent's own report or review used as a source: "Rasika's review", "the Karigar's report".
const REPORT = /\b(?:Rasika|Karigar|Kathakar|Sutradhar)['’]s\s+(?:review|report|brief|finding|findings|probe|ledger|verdict)\b/;

/**
 * @param {Array<{ file: string, text: string }>} entries
 * @param {(path: string) => boolean} isPrivate
 * @returns {Array<{ file: string, line: number, what: string, why: string }>}
 */
export function unfollowable(entries, isPrivate) {
  const out = [];
  for (const { file, text } of entries) {
    String(text).split('\n').forEach((line, i) => {
      for (const m of line.matchAll(PATH)) {
        const p = m[1].replace(/[.,;:)]+$/, '');
        if (NAMED.test(p) || isPrivate(p)) out.push({ file, line: i + 1, what: p, why: 'a private path' });
      }
      const r = REPORT.exec(line);
      if (r) out.push({ file, line: i + 1, what: r[0], why: "an agent's own report or review" });
    });
  }
  return out;
}
