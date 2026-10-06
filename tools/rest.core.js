// The rest checks' pure core (docs/requests/2026-10-02-lighter-gate.md, C rows 1 and 2).
//
// Two axioms, checked:
//   reduced motion shows a finished still  -- after the scene is ready, nothing changes
//   warm rests after its show              -- after the declared settle time, the canvas is
//                                             identical between two moments 3 s apart
//
// Both are pure: they take recorded facts and decide. The runner (tools/rest.check.mjs)
// gathers the facts in a browser; the node tests feed the fixtures.

/** Did anything change on a strip taken under reduced motion, once the scene was ready?
 * `cells` is the strip's cell list: [{ at, ready, changedShare }] with changedShare in 0..1
 * the share of pixels that changed since the cell before. Every cell at or after the first
 * ready one must be unchanged; a cell before ready is the scene not yet mounted and is
 * allowed to differ. Returns the findings, empty when the still holds. */
export function stillAfterReady(cells, { maxShare = 0 } = {}) {
  const findings = [];
  let ready = false;
  for (const c of cells) {
    if (c.ready) ready = true;
    if (ready && c.changedShare > maxShare) {
      findings.push({ cell: c.at, changedShare: c.changedShare, rule: 'reduced motion: it kept moving after ready' });
    }
  }
  return findings;
}

/** Was the canvas at rest between two moments 3 s apart, after the declared settle time?
 * `record` is { changedPixels, total, settleMs, gapMs }; pass when the changed share is 0
 * (a share of a few antialiasing pixels is noise, hence maxShare). */
export function restBetweenMoments(record, { maxShare = 0 } = {}) {
  const { changedPixels, total, settleMs, gapMs } = record;
  if (!Number.isFinite(total) || total <= 0) return { pass: false, why: 'no pixels recorded' };
  if (!Number.isFinite(gapMs) || gapMs < 3000) return { pass: false, why: 'the two moments must be 3 s apart or more' };
  const share = changedPixels / total;
  return {
    pass: share <= maxShare,
    share,
    settleMs,
    gapMs,
    why: share <= maxShare
      ? `at rest: 0 of ${total} pixels changed over ${Math.round(gapMs / 1000)} s, ${Math.round(settleMs / 1000)} s after settle`
      : `still moving: ${changedPixels} of ${total} pixels changed over ${Math.round(gapMs / 1000)} s, ${Math.round(settleMs / 1000)} s after settle`,
  };
}
