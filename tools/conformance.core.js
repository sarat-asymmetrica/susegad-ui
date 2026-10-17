// The conformance notes, as data (docs/contributing/conformance.md).
//
// Every component's docs file keeps, under `## Accessibility`, a `### Conformance (WCAG 2.2 AA)`
// table and the list of what the page author still owns. This file is the pure part: it knows
// which criteria are real, which a kind of component must address, and how to read and judge a
// docs file. It touches no disk: the caller says whether a named file exists. tools/conformance.mjs
// is the command line; tools/conformance.test.mjs holds the fixtures that must go red.

export const HEADING = '### Conformance (WCAG 2.2 AA)';
export const OWNS = '**The page author owns:**';
export const STATUSES = ['Meets', "Meets with author's part", 'Not applicable', 'Does not meet'];
export const HEADER = ['Criterion', 'Status', 'How it was checked'];

/** Every WCAG 2.2 success criterion at level A or AA. (4.1.1 Parsing is obsolete in 2.2 and is not here.) */
export const WCAG = {
  '1.1.1': ['Non-text content', 'A'],
  '1.2.1': ['Audio-only and video-only (prerecorded)', 'A'],
  '1.2.2': ['Captions (prerecorded)', 'A'],
  '1.2.3': ['Audio description or media alternative (prerecorded)', 'A'],
  '1.2.4': ['Captions (live)', 'AA'],
  '1.2.5': ['Audio description (prerecorded)', 'AA'],
  '1.3.1': ['Info and relationships', 'A'],
  '1.3.2': ['Meaningful sequence', 'A'],
  '1.3.3': ['Sensory characteristics', 'A'],
  '1.3.4': ['Orientation', 'AA'],
  '1.3.5': ['Identify input purpose', 'AA'],
  '1.4.1': ['Use of color', 'A'],
  '1.4.2': ['Audio control', 'A'],
  '1.4.3': ['Contrast (minimum)', 'AA'],
  '1.4.4': ['Resize text', 'AA'],
  '1.4.5': ['Images of text', 'AA'],
  '1.4.10': ['Reflow', 'AA'],
  '1.4.11': ['Non-text contrast', 'AA'],
  '1.4.12': ['Text spacing', 'AA'],
  '1.4.13': ['Content on hover or focus', 'AA'],
  '2.1.1': ['Keyboard', 'A'],
  '2.1.2': ['No keyboard trap', 'A'],
  '2.1.4': ['Character key shortcuts', 'A'],
  '2.2.1': ['Timing adjustable', 'A'],
  '2.2.2': ['Pause, stop, hide', 'A'],
  '2.3.1': ['Three flashes or below threshold', 'A'],
  '2.4.1': ['Bypass blocks', 'A'],
  '2.4.2': ['Page titled', 'A'],
  '2.4.3': ['Focus order', 'A'],
  '2.4.4': ['Link purpose (in context)', 'A'],
  '2.4.5': ['Multiple ways', 'AA'],
  '2.4.6': ['Headings and labels', 'AA'],
  '2.4.7': ['Focus visible', 'AA'],
  '2.4.11': ['Focus not obscured (minimum)', 'AA'],
  '2.5.1': ['Pointer gestures', 'A'],
  '2.5.2': ['Pointer cancellation', 'A'],
  '2.5.3': ['Label in name', 'A'],
  '2.5.4': ['Motion actuation', 'A'],
  '2.5.7': ['Dragging movements', 'AA'],
  '2.5.8': ['Target size (minimum)', 'AA'],
  '3.1.1': ['Language of page', 'A'],
  '3.1.2': ['Language of parts', 'AA'],
  '3.2.1': ['On focus', 'A'],
  '3.2.2': ['On input', 'A'],
  '3.2.3': ['Consistent navigation', 'AA'],
  '3.2.4': ['Consistent identification', 'AA'],
  '3.2.6': ['Consistent help', 'A'],
  '3.3.1': ['Error identification', 'A'],
  '3.3.2': ['Labels or instructions', 'A'],
  '3.3.3': ['Error suggestion', 'AA'],
  '3.3.4': ['Error prevention (legal, financial, data)', 'AA'],
  '3.3.7': ['Redundant entry', 'A'],
  '3.3.8': ['Accessible authentication (minimum)', 'AA'],
  '4.1.2': ['Name, role, value', 'A'],
  '4.1.3': ['Status messages', 'AA'],
};

/**
 * One AAA criterion is also accepted, because the library has a position on it and a compliance
 * reader looks for it: it is informative and never required.
 */
export const INFORMATIVE = { '2.3.3': ['Animation from interactions', 'AAA'] };

/** What every component addresses, whatever it is. */
export const BASE = ['1.1.1', '1.3.1', '1.4.1', '1.4.3', '1.4.4', '1.4.10', '1.4.11', '1.4.12', '4.1.2'];

/**
 * What each trait adds. A component says which traits it has (KINDS below); the required
 * criteria are BASE plus the union of its traits'. "Required" means the table has a row for it:
 * `Not applicable`, with the reason, is an answer. A missing row is not.
 */
export const TRAITS = {
  interactive: { about: 'takes input: a control, or a widget with several', add: ['2.1.1', '2.1.2', '2.4.3', '2.4.7', '2.4.11', '2.5.3', '2.5.8'] },
  field: { about: 'collects a value that is submitted or read back', add: ['1.3.5', '3.2.2', '3.3.1', '3.3.2'] },
  overlay: { about: 'opens above the page: a dialog, drawer, popover, tooltip, menu', add: ['1.4.13', '2.1.2', '2.4.3', '2.4.11'] },
  live: { about: 'says something changed without taking focus', add: ['4.1.3'] },
  motion: { about: 'moves or runs on its own, beyond answering a press', add: ['2.2.2', '2.3.1'] },
  drag: { about: 'can be dragged to or on', add: ['2.5.7'] },
  link: { about: 'carries links the reader follows', add: ['2.4.4'] },
  media: { about: 'plays audio', add: ['1.2.1'] },
};

/** The traits of every component. A component that is not here fails the check until someone decides. */
export const KINDS = {
  accordion: ['interactive'],
  'action-menu': ['interactive', 'overlay'],
  badge: ['motion'],
  banner: ['interactive', 'live', 'motion'],
  bloom: ['motion'],
  bubble: [],
  button: ['interactive'],
  'chat-thread': [],
  check: ['interactive', 'field'],
  combobox: ['interactive', 'field', 'overlay', 'live'],
  connecting: ['live', 'motion'],
  consent: ['interactive', 'field', 'live', 'motion'],
  'data-table': ['interactive'],
  'date-range': ['interactive', 'field'],
  dialog: ['interactive', 'overlay', 'motion'],
  doodle: ['motion'],
  drawer: ['interactive', 'overlay', 'motion'],
  empty: ['interactive', 'motion'],
  'event-card': ['interactive', 'link'],
  'event-list': ['interactive', 'link'],
  'field-note': ['live'],
  field: ['interactive', 'field'],
  'file-drop': ['interactive', 'field', 'drag', 'live'],
  form: ['interactive', 'field', 'live'],
  gallery: ['interactive', 'overlay'],
  lang: ['interactive', 'link'],
  link: ['interactive', 'link'],
  loader: ['live', 'motion'],
  menu: ['interactive', 'live'],
  'now-note': [],
  otp: ['interactive', 'field'],
  'person-card': ['interactive', 'link'],
  popover: ['interactive', 'overlay'],
  postcard: ['interactive', 'link'],
  progress: ['motion'],
  qr: ['motion'],
  quote: ['interactive', 'link'],
  radio: ['interactive', 'field'],
  reach: ['interactive', 'link', 'live'],
  'scroll-section': ['motion'],
  select: ['interactive', 'field'],
  signature: ['interactive', 'field'],
  'site-footer': ['interactive', 'link'],
  'site-nav': ['interactive', 'link'],
  skeleton: ['motion'],
  'sound-switch': ['interactive', 'field'],
  stamp: ['live'],
  stepper: ['interactive', 'field', 'live'],
  tabs: ['interactive'],
  'tile-band': [],
  ticket: ['interactive', 'live', 'motion'],
  toast: ['interactive', 'live', 'motion', 'overlay'],
  toggle: ['interactive', 'field', 'motion'],
  tooltip: ['interactive', 'overlay'],
  tumble: ['motion'],
  'voice-note': ['interactive', 'motion', 'media'],
  'wa-order': ['interactive', 'field', 'live', 'link'],
};

/** The criteria a component with these traits must have a row for, in numeric order. */
export function required(traits) {
  const set = new Set(BASE);
  for (const t of traits) for (const c of TRAITS[t]?.add ?? []) set.add(c);
  return [...set].sort(byNumber);
}

export function byNumber(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

const norm = s => s.replace(/[‘’]/g, "'").trim();
const STATUS_BY_NORM = new Map(STATUSES.map(s => [norm(s).toLowerCase(), s]));
const FILE_TOKEN = /^[\w@./\\-]+\.(mjs|js|cjs|css|json|md|html|ts)$/;

/** The files a "how it was checked" cell names: the first word of each backticked span that looks like a file. */
export function filesNamed(how) {
  const out = [];
  for (const m of how.matchAll(/`([^`]+)`/g)) {
    const first = m[1].trim().split(/\s+/)[0].replace(/:\d+(-\d+)?$/, '');
    if (FILE_TOKEN.test(first) && (first.includes('/') || first.includes('.'))) out.push(first);
  }
  return out;
}

/** True when the cell cites a manual test, which needs no file. */
export const isManual = how => /^manual test\b/i.test(how.trim());

/**
 * A manual test with no file behind it must still be checkable by a reader: it carries a date (YYYY-MM-DD) and at
 * least one measured value (a digit) or a named observation (a quoted or backticked name) besides the date.
 * "Manual test: looked fine." says nothing, and fails. Returns the reason, or ''.
 */
export function vagueManual(how) {
  const DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
  if (!DATE.test(how)) return 'it has no date (write "Manual test, YYYY-MM-DD: ...")';
  const rest = how.replace(DATE, '');
  if (!/\d/.test(rest) && !/["`“]/.test(rest)) return 'it has no measured value or named observation, only a date';
  return '';
}

function splitRow(line) {
  const s = line.trim().replace(/\\\|/g, '\u0000');
  const inner = s.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map(c => c.replace(/\u0000/g, '|').trim());
}

/**
 * Read the conformance section out of a docs file.
 * Returns { found, line, rows: [{ number, name, status, how, line }], owns: [string]|null, problems: [{ rule, message, line }] }.
 */
export function parseDocs(text) {
  const lines = text.split('\n');
  const problems = [];
  const at = lines.findIndex(l => l.trim() === HEADING);
  if (at < 0) return { found: false, line: 0, rows: [], owns: null, problems: [{ rule: 'missing-table', message: `no "${HEADING}" subsection`, line: 0 }] };

  // it belongs under ## Accessibility
  let parent = null;
  for (let i = at - 1; i >= 0; i--) if (/^## /.test(lines[i])) { parent = lines[i].replace(/^## /, '').trim(); break; }
  if (parent !== 'Accessibility') problems.push({ rule: 'misplaced', message: `the subsection sits under "${parent ?? 'no heading'}", not "## Accessibility"`, line: at + 1 });

  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) if (/^#{1,3} /.test(lines[i])) { end = i; break; }
  const body = lines.slice(at + 1, end);
  const base = at + 2; // 1-based line number of body[0]

  const tableAt = body.findIndex(l => l.trim().startsWith('|'));
  const rows = [];
  if (tableAt < 0) problems.push({ rule: 'missing-table', message: 'the subsection has no table', line: at + 1 });
  else {
    const head = splitRow(body[tableAt]);
    if (head.join('|') !== HEADER.join('|')) problems.push({ rule: 'malformed-table', message: `header must be | ${HEADER.join(' | ')} |, found | ${head.join(' | ')} |`, line: base + tableAt });
    const sep = body[tableAt + 1] ?? '';
    if (!/^\s*\|?\s*:?-{2,}:?\s*\|/.test(sep)) problems.push({ rule: 'malformed-table', message: 'the second table line must be the --- separator row', line: base + tableAt + 1 });
    for (let i = tableAt + 2; i < body.length && body[i].trim().startsWith('|'); i++) {
      const cells = splitRow(body[i]);
      const line = base + i;
      if (cells.length !== 3) { problems.push({ rule: 'malformed-table', message: `a row needs 3 cells, found ${cells.length}`, line }); continue; }
      const m = cells[0].match(/^(\d\.\d{1,2}\.\d{1,2})\s+(.+)$/);
      if (!m) { problems.push({ rule: 'bad-criterion', message: `"${cells[0]}" is not "<number> <name>", for example "1.4.11 Non-text contrast"`, line }); continue; }
      rows.push({ number: m[1], name: m[2].trim(), status: cells[1], how: cells[2], line });
    }
    if (!rows.length && !problems.length) problems.push({ rule: 'malformed-table', message: 'the table has no rows', line: base + tableAt });
  }

  // **The page author owns:** then a bullet list
  const ownsAt = body.findIndex(l => l.trim() === OWNS);
  let owns = null;
  if (ownsAt < 0) problems.push({ rule: 'missing-owns', message: `no "${OWNS}" line after the table`, line: end });
  else {
    owns = [];
    for (let i = ownsAt + 1; i < body.length; i++) {
      if (/^\s*[-*] /.test(body[i])) owns.push(body[i].replace(/^\s*[-*] /, '').trim());
      else if (body[i].trim() === '' && !owns.length) continue;
      else if (/^\s+\S/.test(body[i]) && owns.length) owns[owns.length - 1] += ' ' + body[i].trim();
      else break;
    }
    if (!owns.length) problems.push({ rule: 'missing-owns', message: `"${OWNS}" has no bullets under it`, line: base + ownsAt });
  }
  return { found: true, line: at + 1, rows, owns, problems };
}

/**
 * Judge one docs file. `ctx`: { traits: [...], fileExists(path) => boolean }.
 * Returns the findings: [{ rule, message, line }]. No findings means it passes.
 */
export function validate(parsed, ctx) {
  const out = [...parsed.problems];
  if (!parsed.found) return out;
  const seen = new Set();
  for (const r of parsed.rows) {
    const known = WCAG[r.number] ?? INFORMATIVE[r.number];
    if (!known) {
      out.push({ rule: 'bad-criterion', message: `${r.number} is not a WCAG 2.2 level A or AA success criterion`, line: r.line });
      continue;
    }
    if (norm(known[0]).toLowerCase() !== norm(r.name).toLowerCase()) out.push({ rule: 'bad-criterion', message: `${r.number} is "${known[0]}", not "${r.name}"`, line: r.line });
    if (seen.has(r.number)) out.push({ rule: 'bad-criterion', message: `${r.number} appears twice`, line: r.line });
    seen.add(r.number);

    const status = STATUS_BY_NORM.get(norm(r.status).toLowerCase());
    if (!status) { out.push({ rule: 'bad-status', message: `"${r.status}" is not one of ${STATUSES.join(', ')}`, line: r.line }); continue; }
    if (!r.how) { out.push({ rule: 'missing-evidence', message: `${r.number}: "How it was checked" is empty`, line: r.line }); continue; }

    const files = filesNamed(r.how);
    for (const f of files) if (!ctx.fileExists(f)) out.push({ rule: 'missing-evidence', message: `${r.number} cites \`${f}\`, which does not exist`, line: r.line });
    if (isManual(r.how) && !files.length && status !== 'Not applicable') {
      const why = vagueManual(r.how);
      if (why) out.push({ rule: 'vague-evidence', message: `${r.number}: a manual test is not evidence yet: ${why}`, line: r.line });
    }
    if (status !== 'Not applicable' && status !== 'Does not meet' && !files.length && !isManual(r.how)) {
      out.push({ rule: 'missing-evidence', message: `${r.number} is "${status}" but names no file in backticks and is not a "Manual test: ..." (a claim needs evidence)`, line: r.line });
    }
  }
  for (const c of required(ctx.traits)) {
    if (!seen.has(c)) out.push({ rule: 'missing-required', message: `no row for ${c} ${WCAG[c][0]}, which this kind of component must address (answer "Not applicable" with the reason if it is)`, line: parsed.line });
  }
  return out;
}

/** Rank for the summary: what a reader sees first. */
export function tally(parsed) {
  const t = { meets: [], author: [], na: [], gaps: [] };
  for (const r of parsed.rows) {
    const s = STATUS_BY_NORM.get(norm(r.status).toLowerCase());
    if (s === 'Meets') t.meets.push(r.number);
    else if (s === "Meets with author's part") t.author.push(r.number);
    else if (s === 'Not applicable') t.na.push(r.number);
    else if (s === 'Does not meet') t.gaps.push(r.number);
  }
  for (const k of Object.keys(t)) t[k].sort(byNumber);
  return t;
}

/** The anchor GitHub-style Markdown gives the conformance heading. */
export const ANCHOR = '#conformance-wcag-22-aa';

/**
 * The summary page, from what every docs file says. `entries`: [{ name, traits, parsed|null }]
 * in alphabetical order; `parsed` is null (or has no rows) for a component whose table is not
 * written yet. Pure: the same entries give the same text.
 */
export function renderSummary(entries) {
  const done = entries.filter(e => e.parsed?.found && e.parsed.rows.length);
  const link = e => `[${e.name}](../../packages/components/${e.name}/${e.name}.docs.md${ANCHOR})`;
  const L = [];
  L.push('# Accessibility conformance');
  L.push('');
  L.push('<!-- Generated by `node tools/conformance.mjs --summary` from each component\'s `### Conformance (WCAG 2.2 AA)` table. Edit the tables, not this page. -->');
  L.push('');
  L.push('For each component: the WCAG 2.2 level A and AA criteria it meets, how that was checked, and what the page author still owns. A team auditing to GIGW 3.0 can start here and follow the links to the table in each component\'s docs.');
  L.push('');
  L.push(`${done.length} of ${entries.length} components have their conformance table written${done.length === entries.length ? '.' : '; the others are marked "not yet written" below.'}`);
  L.push('');
  L.push('## What the statuses mean');
  L.push('');
  L.push('| Status | Meaning |');
  L.push('|---|---|');
  L.push('| Meets | The component meets the criterion by itself, and a check in the repository shows it. |');
  L.push("| Meets with author's part | The component does its part and the criterion is met only when the page author does theirs (the label text, the heading, the language of a passage). The table row says what. |");
  L.push('| Not applicable | The criterion does not apply to this kind of component. The row says why. |');
  L.push('| Does not meet | A known gap. The row says what fails, measured, and the gap is listed below until it is fixed. |');
  L.push('');
  L.push('A criterion is never listed as met without evidence: a check file in the repository, an axe run, a contrast test, or a manual test written down with what was done. The kinds of component and the criteria each must address are in `docs/contributing/conformance.md`.');
  L.push('');
  L.push('## How the library tests');
  L.push('');
  L.push('- **axe-core**, with the rules for WCAG 2.0, 2.1 and 2.2 at levels A and AA, on component demos (`node tools/axe.mjs --url /packages/components/<name>/demo.html`; a table says when the check beside the component also runs it): in all three registers (quiet, warm, playful), in light and dark, at desktop width and at phone width (390 px, touch), and as a browser without JavaScript sees the page (`--no-js`). Components with a state that opens or changes (a menu with an order in progress, a dialog that is open) are also scanned in that state by their own check. axe finds roughly a third of WCAG problems; the rest is the checks below and the page author.');
  L.push('- **Component checks** (`npm run check`, one `*.check.mjs` per component): keyboard paths, focus, names and roles read from the browser\'s accessibility tree, live regions, target sizes, reflow at 390 px, and the page with JavaScript off. They run in Chromium, and in WebKit and Firefox with `--engine=` (see `docs/BROWSERS.md`). Screen reader behaviour is checked through the accessibility tree, not with a live screen reader.');
  L.push('- **Contrast**: every text role on every surface, in every palette and theme, is 4.5:1 or more (`packages/tokens/tokens.test.js`); components with drawn parts test those against 3:1 (WCAG 1.4.11), and some measure painted colours in the browser.');
  L.push('- **The touch check** (`node tools/touch.check.mjs`, part of `npm run check`): every interactive component answers a press within a frame, has a visible `:focus-visible` style, and keeps its colour change but drops movement under reduced motion, in all three registers (`docs/contributing/touch-contract.md`).');
  L.push('- **Forced colours and reduced motion**: checks emulate `forced-colors: active` and `prefers-reduced-motion: reduce` for the components that draw their own art. Reduced motion shows the finished still in every register. Forced colours brings back the browser\'s own control.');
  L.push('');
  L.push('This is a statement of how the library is tested, not a certificate. A conformance claim covers a page, not a component, and the page author owns the parts below.');
  L.push('');
  L.push('## Always the page author\'s');
  L.push('');
  L.push('- Alt text for every image, and the text of every label, heading, link and error message the page writes.');
  L.push('- One page heading, a sensible heading order, a page title and the page\'s language (`lang` on `html`), and `lang` on any passage in another language (3.1.2).');
  L.push('- Skip links and landmarks for the page as a whole (2.4.1), and consistent navigation and help across pages (3.2.3, 3.2.4, 3.2.6).');
  L.push('- Captions, transcripts and audio description for any video or audio the page brings (1.2.x).');
  L.push('- The colours the page sets itself on top of the library\'s tokens, and the content a reader types or uploads.');
  L.push('');
  L.push('## Components');
  L.push('');
  L.push("| Component | Traits | Meets | Meets with author's part | Not applicable | Does not meet |");
  L.push('|---|---|---|---|---|---|');
  for (const e of entries) {
    const traits = e.traits.length ? e.traits.join(', ') : 'content';
    if (!e.parsed?.found || !e.parsed.rows.length) { L.push(`| ${link(e)} | ${traits} | not yet written | | | |`); continue; }
    const t = tally(e.parsed);
    L.push(`| ${link(e)} | ${traits} | ${t.meets.join(', ') || 'none'} | ${t.author.join(', ') || 'none'} | ${t.na.join(', ') || 'none'} | ${t.gaps.join(', ') || 'none'} |`);
  }
  L.push('');
  const gaps = done.flatMap(e => e.parsed.rows.filter(r => STATUS_BY_NORM.get(norm(r.status).toLowerCase()) === 'Does not meet').map(r => ({ e, r })));
  L.push('## Known gaps');
  L.push('');
  if (!gaps.length) L.push('None recorded.');
  else {
    L.push('| Component | Criterion | What fails |');
    L.push('|---|---|---|');
    for (const { e, r } of gaps) L.push(`| ${link(e)} | ${r.number} ${r.name} | ${r.how.replace(/\|/g, '\\|')} |`);
  }
  L.push('');
  L.push('## What the page author owns, by component');
  L.push('');
  if (!done.length) L.push('Nothing is written yet.');
  else {
    L.push('| Component | The page author owns |');
    L.push('|---|---|');
    for (const e of done) L.push(`| ${link(e)} | ${(e.parsed.owns ?? []).map(s => s.replace(/\|/g, '\\|')).join('<br>')} |`);
  }
  L.push('');
  L.push('## GIGW 3.0');
  L.push('');
  L.push('GIGW 3.0 asks for conformance with WCAG 2.1 level AA for accessibility (the secondary sources we read say so, and also name IS 17802). WCAG 2.2 level AA adds six criteria at levels A and AA and removes 4.1.1, so a table written to 2.2 AA covers 2.1 AA. The mapping from GIGW checkpoints to WCAG criteria is in `docs/contributing/conformance.md`, with what we could and could not verify against the guideline text.');
  L.push('');
  return L.join('\n');
}
