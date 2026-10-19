// The pot's critical widths: where a line-break decision flips as the pot turns. The pure half.
//
// The type tier's break rule (what packages/type/layout.core.js runs, through
// an oracle) is greedy per line: a line takes words while their running ink
// width fits the room that line's band was given, then breaks after the last
// word that fit. So each candidate break's decision — "does the line up to
// word i fit the room?" — is a threshold test on ONE number, the room, and it
// flips exactly where the room crosses
//
//    w_crit(i) = w_0 + s + w_1 + s + ... + w_i     (the words plus their spaces)
//
// (the oracle keeps a line's trailing spaces out of its width, so a break
// after word i carries the space that follows it).
//
// A real corridor is not one width: the paragraph sits beside the pot, line
// after line, and each line's band asks the silhouette separately — a line
// beside the pot gets a cut width, a line above or below it the full column.
// matka-view's true relation is `flowShape` over the pot's silhouette bands:
// one width per line, and the vector changes with the pot's angle. The kernel
// takes that whole relation in: `corridor(angle)` returns the widths of the
// bands the paragraph actually occupies, first line first. A critical *angle*
// is one where any band's width crosses any critical width, i.e. where any
// break decision flips; between critical angles the whole layout is constant,
// so the view re-lays only there (quantize snaps into a break-stable step).
//
// The relation is only ever sampled, never assumed: piecewise, plateaued or
// band-wise all work. A flip found by sampling is sharpened by bisection on
// the crossed width; a tangent touch flips nothing and is left out.
//
// No DOM, no canvas, no dependencies: runs in Node (like layout.core.js).

const TAU = Math.PI * 2;

/**
 * Build the break-flip map for a paragraph.
 *
 * @param {Record<string, any>} words  the paragraph, prepared:
 *   { widths: number[], space?: number } — `widths` are the words' ink widths
 *   in reading order, in the same units `corridor` answers in (px); `space`
 *   is the width of the space between words (default 0).
 * @param {(angle: number) => number[] | number} corridor  the bands' widths at
 *   a pot angle, radians in [0, TAU): one number per line the paragraph could
 *   hold, first line first (a single number for a one-band caller). It may be
 *   any shape (piecewise, plateaued); it is only ever sampled.
 * @param {Object} [opts]
 * @param {number} [opts.samples=720]  how finely the corridor is sampled to
 *   bracket every crossing before bisection sharpens it
 * @returns {{ breaksAt, criticalAngles, quantize, breakStatesPerTurn }}
 */
export function potBreaks(words, corridor, { samples = 720 } = {}) {
  if (!words || !Array.isArray(words.widths) || !words.widths.length) throw new TypeError('potBreaks: words must be { widths: [...], space? } with a non-empty widths array');
  const widths = words.widths;
  if (widths.some(w => !Number.isFinite(w) || w < 0)) throw new TypeError('potBreaks: every word width must be a finite number >= 0');
  const space = words.space ?? 0;
  if (!Number.isFinite(space) || space < 0) throw new TypeError('potBreaks: space must be a finite number >= 0');
  if (typeof corridor !== 'function') throw new TypeError('potBreaks: corridor must be a function of angle');

  // The critical widths: the room at which a candidate break flips. A line
  // that starts at word s and breaks after word j (s <= j) has ink
  // sum_{k=s..j}(w_k) plus (j-s) spaces between, so its decision flips where
  // the room crosses exactly that. The candidate starts are every word (a
  // layout may begin a line anywhere the previous line ended); a pair whose
  // layout never occurs just yields a harmless extra flip — quantize makes a
  // smaller step there, never a wrong one. A break after the last word of a
  // line that ends the text is the text's own end, so j runs to n-2 only when
  // s = 0 covers it; for s > 0 every j up to n-1 counts (the line may be the
  // text's last).
  const crit = []; // [width, start, break]
  for (let s = 0; s < widths.length; s++) {
    let ink = 0;
    for (let j = s; j < widths.length; j++) {
      ink += widths[j] + (j > s ? space : 0);
      if (j + 1 < widths.length) crit.push([ink, s, j]); // a later word follows: this break is a real decision
    }
  }
  crit.sort((a, b) => a[0] - b[0]);

  /** Does a line that starts at word s and breaks after word j fit a room of width w? (the flip test) */
  const fits = (s, j, w) => {
    let acc = 0;
    for (let k = s; k <= j; k++) acc += widths[k] + (k > s ? space : 0);
    return acc <= w;
  };

  // The greedy layout's break indexes at an angle, as one comparable string.
  const breaksKey = angle => {
    const bands = asVec(corridor((((angle % TAU) + TAU) % TAU)));
    const out = [];
    let i = 0;
    for (let b = 0; b < bands.length && i + 1 < widths.length; b++) {
      const w = bands[b];
      if (!fits(i, i, w)) break;
      let j = i;
      while (j + 1 < widths.length && fits(i, j + 1, w)) j++;
      out.push(j);
      i = j + 1;
    }
    return out.join(',');
  };

  // Where any band's width strictly crosses any critical width. The corridor
  // is sampled on a fine ring (at the gaps' midpoints, so an exact boundary
  // hit is not a touch at both ends); a sample pair that brackets a width is
  // sharpened by bisection on w(th) - wc.
  const angles = [];
  const n = Math.max(64, samples);
  const close = (a, b) => Math.abs((((a - b) % TAU) + TAU) % TAU) < 1e-6 || Math.abs((((b - a) % TAU) + TAU) % TAU) < 1e-6;
  const asVec = v => (Array.isArray(v) ? v : [v]); // a one-band caller may answer one number
  const finite = v => v.length && v.every(Number.isFinite);
  // bisection on one band's width: the band's own function of angle is read
  // through `bandAt`, so the walk stays on the band that crossed
  const bisectBand = (bandAt, a0, a1, w0, w1, wc) => {
    let lo = a0, hi = a1, flo = w0 - wc;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2, fm = bandAt(mid) - wc;
      if ((flo < 0) === (fm < 0)) { lo = mid; flo = fm; } else hi = mid;
    }
    return (lo + hi) / 2;
  };
  for (let s = 0; s < n; s++) {
    const a0 = (s + 0.5) / n * TAU, a1 = (s + 1.5) / n * TAU;
    const v0 = asVec(corridor(a0)), v1 = asVec(corridor(a1));
    if (!finite(v0) || !finite(v1)) continue;
    const m = Math.max(v0.length, v1.length);
    for (let b = 0; b < m; b++) {
      const bandAt = th => { const v = asVec(corridor(th)); return v[Math.min(b, v.length - 1)]; };
      const w0 = v0[Math.min(b, v0.length - 1)], w1 = v1[Math.min(b, v1.length - 1)];
      if (w1 === w0) continue;
      const lo = Math.min(w0, w1), hi = Math.max(w0, w1);
      for (const wc of crit) {
        if (wc[0] <= lo || wc[0] >= hi) continue; // strictly crossed in this sample gap (a tangent touch flips nothing)
        const th = ((bisectBand(bandAt, a0, a1, w0, w1, wc[0]) % TAU) + TAU) % TAU;
        if (!angles.some(a => close(a, th))) angles.push(th); // one entry per crossing spot is enough for snapping
      }
    }
  }
  angles.sort((a, b) => a - b);

  // Keep only the flips that really change the greedy layout: a crossing of a
  // candidate pair the rule never uses flips nothing, and a view that re-laid
  // there would pay for no change. (Extra candidates are kept in the set above
  // because which pairs are used depends on the angle itself; the filter here
  // is exact, by sampling either side of each angle.)
  const real = angles.filter(th => {
    const e = 1e-4;
    return breaksKey(th - e) !== breaksKey(th + e);
  });

  return {
    /** Which words end each line at this pot angle (indexes of the words after which the greedy rule breaks), through the real per-band corridor. */
    breaksAt(angle) {
      const th = ((angle % TAU) + TAU) % TAU;
      const bands = asVec(corridor(th));
      const out = [];
      let i = 0;
      for (let b = 0; b < bands.length && i + 1 < widths.length; b++) {
        const w = bands[b];
        if (!fits(i, i, w)) break;                       // not even this line's first word fits: the oracle would cut inside it, which this model does not chase
        let j = i;
        while (j + 1 < widths.length && fits(i, j + 1, w)) j++; // the last word that still fits this band's room
        out.push(j);
        i = j + 1;
      }
      return out;
    },
    /** The angles (radians, [0, TAU)) where some line-break decision flips, sorted. */
    criticalAngles: () => real.slice(),
    /** Snap to the nearest break-stable angle: the middle of the step containing it (a layout done there holds to the next flip). */
    quantize(angle) {
      const th = ((angle % TAU) + TAU) % TAU;
      if (!real.length) return 0;
      // the step containing th is [angles[k-1], angles[k]); its representative is its mid, clear of both edges
      let k = 0;
      while (k < real.length && real[k] <= th) k++;
      const lo = real[(k - 1 + real.length) % real.length];
      let hi = k < real.length ? real[k] : real[0] + TAU;
      if (hi <= lo) hi += TAU; // the step across the turn's own end wraps
      return (((lo + (hi - lo) / 2) % TAU) + TAU) % TAU;
    },
    /** How many distinct line-break states one full turn holds (the gate's number). */
    breakStatesPerTurn() {
      if (!real.length) return 1;
      const seen = new Set();
      // a state per step: sample just inside each step
      for (let k = 0; k < real.length; k++) {
        const lo = real[k], hi = k + 1 < real.length ? real[k + 1] : real[0] + TAU;
        const mid = lo + ((hi - lo) / 2);
        seen.add(this.breaksAt(mid).join(','));
      }
      return seen.size;
    },
  };
}
