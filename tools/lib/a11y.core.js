// The accessibility depth the smoke tier adds, as decisions: pure, so they run in Node tests and the browser half
// (a11y.mjs) only gathers facts. Five passes, each behind a flag of tools/smoke.mjs:
//
//   tree       the accessibility tree of the page (Playwright's ariaSnapshot), judged for what a reader relies on
//              (every control and image named, one main landmark, headings) and held against a recorded baseline
//   contrast   text drawn in DOM over a canvas, measured against the canvas pixels behind it
//   forced     the page under forced colours: controls keep a boundary or text, no text vanishes into its ground
//   registers  axe in every register and both themes, not only the page's default
//   open       axe on the open states (a dialog, drawer, popover or menu open)

// ── the tree ──────────────────────────────────────────────────────────────

/** Roles that must carry an accessible name for a reader to use them. */
export const NAMED_ROLES = new Set(['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'switch', 'slider', 'spinbutton', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'img']);

/**
 * Masks for text that changes from load to load or from machine to machine. Each rule has a name that is printed
 * with the page it fired on, so a mask is never silent. `pages` is a regular expression on the page path (omit it
 * for every page); `find` runs over the whole snapshot.
 */
export const MASK_RULES = [
  // the dev server picks a free port each run, and a few pages print an absolute address
  { name: 'server-port', find: /http:\/\/127\.0\.0\.1:\d+/g, with: 'http://127.0.0.1:PORT' },
  // the export demo names each figure with the size of the file it just made
  { name: 'file-size', pages: /^\/packages\/export\/demo\.html$/, find: /\d+(?:\.\d+)? (?:KB|MB|B)\b/g, with: 'SIZE' },
];

const INLINE_ROLES = new Set(['text', 'code', 'strong', 'emphasis', 'time', 'mark', 'deletion', 'insertion', 'subscript', 'superscript']);

/**
 * The skeleton of a snapshot: what a reader steers by. Running text is cut (inline text, code and emphasis lines go, and
 * a paragraph or list item keeps its line but not its words), so a copy edit does not turn a gate red. Names stay: a
 * heading, link, button, image or field whose accessible name changes is the very change this baseline exists to show.
 * This is the one rule applied to every page, and it is why a baseline reads as a map and not as the page's prose.
 */
export function skeleton(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = unwrap(raw);
    const el = parseLine(line);
    if (el && INLINE_ROLES.has(el.role)) continue;
    if (el && el.rest && !NAMED_ROLES.has(el.role)) { out.push(`${'  '.repeat(el.depth)}- ${el.role}${el.name != null ? ` "${el.name}"` : ''}${el.attrs ? ` ${el.attrs}` : ''}`); continue; }
    out.push(line);
  }
  return out.join('\n');
}

/** Cut the prose, apply the mask rules; returns the text and the names of the mask rules that changed it. */
export function normaliseSnapshot(text, path, rules = MASK_RULES) {
  const fired = [];
  let out = skeleton(String(text).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, ''));
  for (const r of rules) {
    if (r.pages && !r.pages.test(path)) continue;
    const next = out.replace(r.find, r.with);
    if (next !== out) { fired.push(r.name); out = next; }
  }
  return { text: `${out}\n`, masked: fired };
}

const LINE = /^(\s*)- ([a-zA-Z]+)(?: "((?:[^"\\]|\\.)*)")?((?: \[[^\]]+\])*)(?::(.*))?$/;

/** A name with a colon or a quote in it makes the snapshot quote the whole line ('heading "A: b" [level=1]'); put it back as it reads. */
export const unwrap = line => {
  const m = /^(\s*)- '(.*)'$/.exec(line) || /^(\s*)- "(.*)"$/.exec(line);
  return m && /^[a-zA-Z]+ /.test(m[2]) ? `${m[1]}- ${m[2].replace(/''/g, "'")}` : line;
};

/** One snapshot line as { depth, role, name, attrs, rest }, or null when it is not an element line (a /url: line, text). */
export function parseLine(line) {
  const m = LINE.exec(unwrap(line));
  if (!m) return null;
  return { depth: m[1].length / 2, role: m[2], name: m[3] ?? null, attrs: m[4].trim(), rest: (m[5] ?? '').trim() };
}

/**
 * What the tree must show for a reader. `exempt` is { main?: reason, heading?: reason } for this page: a page that
 * has no main landmark or no heading by design says why in the exemption file, and the reason is returned so the
 * run can print it instead of passing in silence.
 * @returns {{ problems: string[], exempted: string[], counts: object }}
 */
export function treeInvariants(snapshot, exempt = {}) {
  const problems = [];
  const exempted = [];
  const counts = { main: 0, heading: 0, named: 0, unnamed: 0 };
  const seen = new Map();
  for (const line of snapshot.split('\n')) {
    const el = parseLine(line);
    if (!el) continue;
    if (el.role === 'main') counts.main++;
    if (el.role === 'heading') counts.heading++;
    if (NAMED_ROLES.has(el.role)) {
      if (el.name && el.name.trim()) counts.named++;
      else { counts.unnamed++; seen.set(el.role, (seen.get(el.role) ?? 0) + 1); }
    }
  }
  for (const [role, n] of seen) problems.push(`${n} ${role}${n > 1 ? 's' : ''} with no accessible name`);
  if (counts.main !== 1) {
    const why = counts.main === 0 ? 'no main landmark' : `${counts.main} main landmarks`;
    if (exempt.main) exempted.push(`${why}: ${exempt.main}`); else problems.push(why);
  }
  if (!counts.heading) {
    if (exempt.heading) exempted.push(`no heading: ${exempt.heading}`); else problems.push('no heading');
  }
  return { problems, exempted, counts };
}

/**
 * Exemptions for a page path from the exemption file's rules: [{ match: "regex on the path", main?, heading?, controls?: [labels], reason }].
 * `controls` are forced-colours findings the page is known to have (the control's label as the pass prints it).
 */
export function exemptionsFor(path, rules = []) {
  const out = { controls: [] };
  for (const r of rules) {
    if (!new RegExp(r.match).test(path)) continue;
    if (r.main) out.main = r.reason;
    if (r.heading) out.heading = r.reason;
    if (r.controls) out.controls.push(...r.controls);
  }
  if (!out.controls.length) delete out.controls;
  return out;
}

/** The file a page's baseline lives in: no slashes, so the folder stays flat and a merge touches one file per page. */
export const baselineName = path => `${path.replace(/^\//, '').replace(/[\\/]+/g, '__').replace(/[^A-Za-z0-9_.-]/g, '_')}.aria.yml`;

/** A short diff of two snapshots, line by line: the first few lines that were added or removed. */
export function diffSnapshots(before, after, limit = 6) {
  const a = before.split('\n'), b = after.split('\n');
  const inB = new Map(), inA = new Map();
  for (const l of b) inB.set(l, (inB.get(l) ?? 0) + 1);
  for (const l of a) inA.set(l, (inA.get(l) ?? 0) + 1);
  const out = [];
  for (const l of a) { if (inB.get(l)) inB.set(l, inB.get(l) - 1); else out.push(`- ${l.trim()}`); }
  for (const l of b) { if (inA.get(l)) inA.set(l, inA.get(l) - 1); else out.push(`+ ${l.trim()}`); }
  const more = out.length - limit;
  return out.slice(0, limit).join(' | ') + (more > 0 ? ` | and ${more} more` : '');
}

/** Judge a fresh snapshot against the recorded one: null when they agree, else the message. */
export function compareBaseline(recorded, fresh) {
  if (recorded == null) return 'no recorded baseline (record one with --record-a11y once you have read the tree)';
  if (recorded === fresh) return null;
  return `the accessibility tree changed: ${diffSnapshots(recorded, fresh)} (if it is meant, re-record with --record-a11y)`;
}

// ── contrast ──────────────────────────────────────────────────────────────

export const NORMAL_RATIO = 4.5;
export const LARGE_RATIO = 3;
/** A box is scored at this share of its pixels from the bottom: a quarter of the ground behind the words may be close in tone (a strike-through scribble, a particle, a hatch line) before the words fail. */
export const WORST_SHARE = 0.25;

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** WCAG contrast ratio of two opaque colours, [r, g, b] each. */
export function contrastRatio(a, b) {
  const la = luminance(a[0], a[1], a[2]), lb = luminance(b[0], b[1], b[2]);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The text colour [r, g, b, a] laid over one background pixel [r, g, b]. */
export const over = (fg, bg) => [0, 1, 2].map(i => fg[3] * fg[i] + (1 - fg[3]) * bg[i]);

/**
 * The ratio of one text box: the text colour over each sampled pixel behind it, scored at the WORST_SHARE-th
 * lowest. `samples` is a flat [r, g, b, r, g, b, ...] list.
 * @returns {{ ratio: number, n: number }}
 */
export function boxRatio(color, samples) {
  const ratios = [];
  for (let i = 0; i + 2 < samples.length; i += 3) {
    const bg = [samples[i], samples[i + 1], samples[i + 2]];
    ratios.push(contrastRatio(over(color, bg), bg));
  }
  if (!ratios.length) return { ratio: NaN, n: 0 };
  ratios.sort((x, y) => x - y);
  return { ratio: ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * WORST_SHARE))], n: ratios.length };
}

/** Large text by WCAG: 24 px, or 18.66 px and bold. */
export const isLarge = (px, weight) => px >= 24 || (px >= 18.66 && weight >= 700);

/**
 * Judge the measured boxes of a page. A box is { text, color: [r,g,b,a], large, samples }.
 * @returns {{ boxes: number, worst: null | { text: string, ratio: number, need: number }, failing: object[] }}
 */
export function judgeContrast(boxes) {
  const scored = boxes.map(b => {
    const { ratio, n } = boxRatio(b.color, b.samples);
    return { text: b.text, ratio: Math.round(ratio * 100) / 100, need: b.large ? LARGE_RATIO : NORMAL_RATIO, n };
  }).filter(b => b.n > 0);
  scored.sort((x, y) => x.ratio / x.need - y.ratio / y.need);
  return { boxes: scored.length, worst: scored[0] ?? null, failing: scored.filter(b => b.ratio < b.need) };
}

// ── forced colours ────────────────────────────────────────────────────────

/** Text and its ground closer than this under forced colours counts as the same colour. */
export const FORCED_MIN_RATIO = 1.1;

/**
 * Judge the facts the page gave under forced colours.
 * controls: { label, hasText, pseudo, border, outline, graphic, native }[]  (focusable, visible; `pseudo` is a glyph or a
 *           range's track or thumb drawn by a pseudo-element)
 * texts:    { text, color: [r,g,b,a], ground: [r,g,b] | null }[]
 * `exempt` is a list of control labels the page's exemption rule has named (with a DEBT row): they are listed, not failed.
 * @returns {{ problems: string[], exempted: string[], controls: number, texts: number }}
 */
export function judgeForced({ controls = [], texts = [] }, exempt = []) {
  const problems = [], exempted = [];
  const empty = controls.filter(c => !(c.hasText || c.pseudo || c.border || c.outline || c.graphic || c.native));
  const bare = empty.filter(c => !exempt.includes(c.label));
  for (const c of empty) if (exempt.includes(c.label)) exempted.push(`${c.label} has nothing left under forced colours`);
  if (bare.length) problems.push(`${bare.length} focusable control(s) with no text, border or graphic left: ${bare.slice(0, 3).map(c => c.label).join(', ')}`);
  const same = [];
  for (const t of texts) {
    if (!t.ground) continue;
    const ratio = contrastRatio(over(t.color, t.ground), t.ground);
    if (ratio < FORCED_MIN_RATIO) same.push(`"${t.text}" (${ratio.toFixed(2)}:1)`);
  }
  if (same.length) problems.push(`${same.length} text(s) the same colour as their ground: ${same.slice(0, 3).join(', ')}`);
  return { problems, exempted, controls: controls.length, texts: texts.length };
}

// ── registers and open states ─────────────────────────────────────────────

export const REGISTER_CELLS = ['quiet', 'warm', 'playful'].flatMap(register => ['light', 'dark'].map(theme => ({ register, theme })));
export const cellName = c => `${c.register}/${c.theme}`;

/**
 * The open states smoke can reach by itself, a small named list per page: click `open`, wait for `expect` to match,
 * run axe, press Escape. `after` (optional) is a selector clicked first. A page can also name its own with
 * <meta name="smoke-open" content="name | open selector | expect selector"> (repeat the tag), which is how the
 * fixtures do it. The menu has its own open-state axe in menu.check.mjs for the three registers; here it is the
 * dark theme and the default as well.
 */
export const OPEN_ACTIONS = {
  '/packages/components/dialog/demo.html': [
    { name: 'dialog open', open: 'button[command="show-modal"]', expect: 'dialog[open]' },
    { name: 'dialog open from a link', open: 'a[data-sg-dialog="ask"]', expect: 'dialog[open]' },
  ],
  '/packages/components/drawer/demo.html': [
    { name: 'drawer open', open: 'button[command="show-modal"]', expect: 'dialog[open]' },
  ],
  '/packages/components/popover/demo.html': [
    { name: 'popover open', open: 'button[popovertarget="rates"]', expect: '#rates:popover-open' },
  ],
  '/packages/components/action-menu/demo.html': [
    { name: 'action menu open', open: '#account-trigger', expect: '#account-menu:popover-open' },
  ],
  '/packages/components/menu/demo.html': [
    { name: 'menu with an order in progress', open: '#menu [data-id=fettuccine] .sg-menu-plus', expect: '#menu [data-id=fettuccine]', keep: true },
  ],
};

/** Parse the <meta name="smoke-open"> contents the page declared: "name | open | expect". */
export function parseOpenMeta(contents) {
  return contents.map(c => c.split('|').map(s => s.trim())).filter(p => p.length === 3 && p.every(Boolean)).map(([name, open, expect]) => ({ name, open, expect }));
}

// ── what a run records, and what makes it red ─────────────────────────────

/**
 * The failures the accessibility passes add to a page's other failures.
 * @param {{ desktop?: object, forced?: object }} seen
 */
export function a11yFailures(seen) {
  const out = [];
  const add = (kind, list) => { for (const message of list) out.push({ kind, message }); };
  const d = seen.desktop;
  if (d) {
    if (d.treeError) add('tree-failed', [d.treeError]);
    if (d.tree) {
      add('tree', d.tree.problems);
      if (d.tree.baseline) add(/^no recorded/.test(d.tree.baseline) ? 'tree-missing' : 'tree-changed', [d.tree.baseline]);
    }
    if (d.contrastError) add('contrast-failed', [d.contrastError]);
    if (d.contrast) add('contrast', d.contrast.failing.map(f => `"${f.text}" is ${f.ratio}:1 over the canvas, needs ${f.need}:1`));
    // the default cell is what the page's own axe already said; only what is new is added
    const known = new Set(d.axe ?? []);
    for (const [cell, lines] of Object.entries(d.cells ?? {})) add('axe-cell', lines.filter(l => !known.has(l)).map(l => `${cell}: ${l}`));
    for (const [name, lines] of Object.entries(d.opens ?? {})) add('axe-open', lines.map(l => `${name}: ${l}`));
    if (d.cellsError) add('axe-failed', [d.cellsError]);
    if (d.openError) add('open-failed', [d.openError]);
    if (d.openErrors) add('open-failed', d.openErrors);
  }
  const f = seen.forced;
  if (f) {
    add('error', f.errors.map(e => `forced colours: ${e}`));
    if (f.axeError) add('axe-failed', [`forced colours: ${f.axeError}`]);
    add('axe', (f.axe ?? []).filter(l => !(d?.axe ?? []).includes(l)).map(l => `forced colours: ${l}`));
    if (f.factsError) add('forced-failed', [f.factsError]);
    add('forced', f.problems ?? []);
  }
  return out;
}

/** The lines a run prints about what the passes saw, whether or not anything failed. */
export function a11ySummary(results, on) {
  const lines = [];
  if (on.tree) {
    const rec = results.filter(r => r.a11y?.tree?.recorded).length;
    const ex = results.filter(r => r.a11y?.tree?.exempted?.length);
    const masked = results.filter(r => r.a11y?.tree?.masked?.length);
    const judged = results.filter(r => r.a11y?.tree);
    lines.push(rec ? `tree: recorded ${rec} baseline(s)` : judged.some(r => r.a11y.tree.compared === false) ? `tree: judged ${judged.length} page(s) for names, main and headings; baselines are Chromium's, so not compared in this engine` : `tree: compared ${judged.length} page(s) with their baselines`);
    for (const r of ex) lines.push(`  exempt  ${r.path}  ${r.a11y.tree.exempted.join('; ')}`);
    for (const r of masked) lines.push(`  masked  ${r.path}  by ${r.a11y.tree.masked.join(', ')}`);
  }
  if (on.contrast) {
    const withText = results.filter(r => r.a11y?.contrast?.boxes);
    const worst = withText.map(r => ({ r, w: r.a11y.contrast.worst })).filter(x => x.w).sort((a, b) => a.w.ratio / a.w.need - b.w.ratio / b.w.need);
    const measured = withText.reduce((n, r) => n + r.a11y.contrast.boxes, 0), found = withText.reduce((n, r) => n + (r.a11y.contrast.found ?? r.a11y.contrast.boxes), 0);
    lines.push(`contrast: ${withText.length} page(s) with words over a canvas, ${measured} of ${found} text boxes measured`);
    for (const r of withText) if ((r.a11y.contrast.found ?? 0) > r.a11y.contrast.boxes) lines.push(`  cut     ${r.path}  ${r.a11y.contrast.boxes} of ${r.a11y.contrast.found} text boxes measured, the rest were not judged`);
    for (const { r, w } of worst.slice(0, 5)) lines.push(`  worst   ${r.path}  "${w.text}" ${w.ratio}:1 (needs ${w.need}:1)`);
  }
  if (on.registers) {
    const ran = results.filter(r => r.a11y?.registers);
    lines.push(`registers: axe in ${ran.length ? ran[0].a11y.registers.cells : 6} cells (3 registers, 2 themes) on ${ran.length} page(s), ${ran.filter(r => r.a11y.registers.failing.length).length} with a violation the default cell did not show`);
  }
  if (on.open) {
    const ran = results.filter(r => r.a11y?.open?.reached.length);
    lines.push(`open states: axe ran in ${ran.reduce((n, r) => n + r.a11y.open.reached.length, 0)} open state(s) on ${ran.length} page(s)`);
    for (const r of ran) lines.push(`  opened  ${r.path}  ${r.a11y.open.reached.join('; ')}`);
  }
  if (on.forced) {
    const done = results.filter(r => r.a11y?.forced);
    lines.push(`forced colours: ${done.length} page(s), ${done.reduce((n, r) => n + r.a11y.forced.controls, 0)} controls and ${done.reduce((n, r) => n + r.a11y.forced.texts, 0)} texts judged`);
    for (const r of done) if (r.a11y.forced.exempted?.length) lines.push(`  exempt  ${r.path}  ${r.a11y.forced.exempted.join('; ')}`);
  }
  return lines;
}
