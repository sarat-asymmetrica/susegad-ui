// What the runner prints under a red check: every FAIL line from its output, then its last lines.
// A tail alone loses the FAIL clause whenever the check prints more than a tail's worth after it (DEBT 61: popover's two
// FAIL lines and door.check's one were cut in CI). FAIL lines already inside the tail are not printed twice.

/** @param {string} out  @param {number} [n]  @returns {string} */
export function redTail(out, n = 15) {
  const lines = String(out ?? '').trimEnd().split('\n');
  const start = Math.max(0, lines.length - n);
  const fails = lines.slice(0, start).filter(l => /^\s*(FAIL|not ok)\b/.test(l));
  if (!fails.length) return lines.slice(start).join('\n');
  return [...fails, `… (${start - fails.length} line(s) between)`, ...lines.slice(start)].join('\n');
}
