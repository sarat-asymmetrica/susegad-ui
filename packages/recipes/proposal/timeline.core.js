// The proposal's timeline, pure: steps read from the directive's body, the
// words for each step, and plain HTML that reads in order without scripts.
// <sg-timeline> adds a native range input that walks through the steps.

/** Every word the timeline uses. Kathakar edits these. */
export const STRINGS = {
  scrub: 'Walk through the plan',
  step: (i, n) => `Step ${i} of ${n}`,
  say: (i, n, title, text) => `Step ${i} of ${n}: ${title}${text ? ` ${text}` : ''}`,
};

/**
 * Steps from the body's lines. Two forms, one per line:
 *   1. **Title.** One or two sentences.      (an ordered list; no dates needed)
 *   - when: what                             (a date, a month or a label, then the step)
 * Returns { steps: [{ title, text, when }], problems: [{ line, message }] }.
 * @param {{ text: string, line?: number }[]} lines
 */
export function readSteps(lines) {
  const steps = [], problems = [];
  for (const l of lines) {
    const t = l.text.trim();
    if (!t) continue;
    let m = /^\d+[.)]\s+\*\*(.+?)\*\*\s*(.*)$/.exec(t);
    if (m) { steps.push({ title: m[1].trim(), text: m[2].trim(), when: null }); continue; }
    m = /^[-*]\s+(.+?):\s+(.+)$/.exec(t);
    if (m) { steps.push({ title: m[2].trim(), text: '', when: m[1].trim() }); continue; }
    if (steps.length && /^\s{2,}\S/.test(l.text)) { steps.at(-1).text = `${steps.at(-1).text} ${t}`.trim(); continue; } // a step's text wrapped onto the next line
    problems.push({ line: l.line, message: 'each timeline step is "1. **Title.** One or two sentences." or "- when: what"' });
  }
  // one form per timeline: numbered steps are the proposal's order, dated lines a calendar
  if (!problems.length && steps.some(s => s.when) && steps.some(s => !s.when)) {
    problems.push({ line: lines.find(l => l.text.trim())?.line ?? 0, message: 'this timeline mixes numbered steps ("1. **Title.** ...") and dated lines ("- when: what"). Use one form for every step' });
  }
  if (!problems.length && steps.length < 2) problems.push({ line: lines[0]?.line ?? 0, message: 'a timeline needs at least two steps' });
  return { steps, problems };
}

/** The words for step i (0-based), as read out when the scrubber reaches it. */
export function sayStep(steps, i) {
  const k = Math.max(0, Math.min(steps.length - 1, i)), s = steps[k];
  const plain = x => x.replace(/\*\*|__|[*_`]/g, '');
  return STRINGS.say(k + 1, steps.length, plain(s.when ? `${s.when}: ${s.title}` : s.title), plain(s.text));
}

/** Which step a scrubber value in [0, 1] falls on: steps share the range evenly. */
export const stepAt = (value, n) => Math.min(n - 1, Math.max(0, Math.round(Number(value) * (n - 1))));

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Steps as HTML: an ordered list inside <sg-timeline>. `inline` renders a
 * step's Markdown (bold, links); it defaults to escaping.
 */
export function timelineHTML(steps, { title = '', inline = esc } = {}) {
  const items = steps.map((s, i) => `<li class="timeline__step" data-step="${i + 1}">${s.when ? `<span class="timeline__when">${inline(s.when)}</span> ` : ''}<strong class="timeline__title">${inline(s.title)}</strong>${s.text ? ` <span class="timeline__text">${inline(s.text)}</span>` : ''}</li>`);
  return `<sg-timeline${title ? ` label="${esc(title)}"` : ''}>
${title ? `<p class="timeline__heading">${inline(title)}</p>\n` : ''}<ol class="timeline">
${items.join('\n')}
</ol>
</sg-timeline>`;
}
