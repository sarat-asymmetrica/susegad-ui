// A small line diff (longest common subsequence) for `susegad diff`.
// Library files are a few hundred lines, so the plain O(n*m) table is fine;
// past LIMIT cells it falls back to counting lines without a patch.

const LIMIT = 4_000_000;

const lines = s => s.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');

/**
 * @param {string} a old text (the registry's)
 * @param {string} b new text (the builder's)
 * @returns {{ added: number, removed: number, ops: Array<[' ' | '+' | '-', string]> | null }}
 */
export function diffLines(a, b) {
  const x = lines(a), y = lines(b);
  let lo = 0;
  while (lo < x.length && lo < y.length && x[lo] === y[lo]) lo++;
  let hiX = x.length, hiY = y.length;
  while (hiX > lo && hiY > lo && x[hiX - 1] === y[hiY - 1]) { hiX--; hiY--; }
  const xs = x.slice(lo, hiX), ys = y.slice(lo, hiY);
  const n = xs.length, m = ys.length;

  if ((n + 1) * (m + 1) > LIMIT) return { added: m, removed: n, ops: null };

  const w = m + 1;
  const t = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i * w + j] = xs[i] === ys[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
    }
  }
  const ops = x.slice(0, lo).map(l => [' ', l]);
  let i = 0, j = 0, added = 0, removed = 0;
  while (i < n || j < m) {
    if (i < n && j < m && xs[i] === ys[j]) { ops.push([' ', xs[i++]]); j++; }
    else if (i < n && (j === m || t[(i + 1) * w + j] >= t[i * w + j + 1])) { ops.push(['-', xs[i++]]); removed++; }
    else { ops.push(['+', ys[j++]]); added++; }
  }
  for (const l of x.slice(hiX)) ops.push([' ', l]);
  return { added, removed, ops };
}

/** Unified-style hunks with `context` lines around each change. */
export function formatPatch(ops, context = 2) {
  const out = [];
  let lastShown = -1;
  let oldLine = 0, newLine = 0;
  const pos = ops.map(([k]) => { const p = [oldLine, newLine]; if (k !== '+') oldLine++; if (k !== '-') newLine++; return p; });
  const changed = ops.map(([k]) => k !== ' ');
  for (let i = 0; i < ops.length; i++) {
    const near = changed.slice(Math.max(0, i - context), i + context + 1).some(Boolean);
    if (!near) continue;
    if (i !== lastShown + 1) out.push(`@@ line ${pos[i][0] + 1} @@`);
    out.push(ops[i][0] + ' ' + ops[i][1]);
    lastShown = i;
  }
  return out;
}
