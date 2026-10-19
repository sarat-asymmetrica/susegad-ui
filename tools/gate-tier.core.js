// The gate's risk tier, read from a diff (docs/requests/2026-10-02-lighter-gate.md, section A).
//
// classify(paths, registry) -> { tier: 'light' | 'standard' | 'full', reasons: string[] }
//
//   paths     the changed paths (repo-rooted, forward slashes)
//   registry  the registry index: { items: [...] } or a bare array; every item carries
//             name, type, files (repo-rooted paths), dependencies, and optionally motif
//   options
//     newPaths    set/array of paths that are newly added, not changed in place (so a
//                 brand-new piece in an existing family can be seen)
//     gateFullPaths  paths whose own header declares `gate: full`
//
// Generated files (the registry index, the two generated references, the custom-elements manifest, the accessibility
// reference) are neutral: they are rebuilt from other files, so they never raise a tier. The other files in references/
// are hand-written and are what the shipped skill tells an outside agent, so they are not neutral. Documentation under
// packages/ (README.md, docs.md, PROVENANCE.md, *.docs.md, *.prompt.md) is Light even inside a shared prefix: it cannot
// change behaviour. Other markdown there is content a demo renders or a native reader checks (a story, a proposal sample,
// Konkani for a reader) and takes the tier its item demands. The engine is shared
// (tools/lib/changed.core.js selects every check for it), so a change there is Standard at least, never Light.
//
// The tier is the highest one any rule fires; every rule that fired is reported, so a
// review can show why. A request can raise a tier and never lower one, which is why the
// answer only ever climbs.

const FULL_COMPONENTS = new Set([
  'dialog', 'drawer', 'menu', 'popover', 'combobox', 'select', 'form', 'field',
  'otp', 'file-drop', 'action-menu',
]);

const SHARED_PREFIXES = [
  'packages/core/', 'packages/core-component/', 'packages/core-movable/',
  'packages/core-orient/', 'packages/tokens/', 'packages/type/', 'packages/kernels/',
];

// Rebuilt from other files by registry/build.mjs, tools/cem.mjs and tools/skill-inventory.mjs (which rewrites only
// references/components.md and references/scenes.md); hand edits to these are overwritten.
export const GENERATED = [
  'registry/registry.json', 'custom-elements.json', 'docs/reference/accessibility.md',
  'references/components.md', 'references/scenes.md',
];
const isGenerated = p => GENERATED.some(g => (g.endsWith('/') ? p.startsWith(g) : p === g));

// Documentation beside a piece: it describes behaviour and cannot change it. Not every .md under packages/ is this.
const DOC_PROSE = /(^|\/)(README|docs|PROVENANCE|CHANGELOG)\.md$|\.(docs|prompt)\.md$/;

const LIGHT_PREFIXES = ['tools/', 'docs/', 'tests/', 'sketchbook/'];
const LIGHT_SUFFIX = /\.(test|check)\.[cm]?[jt]s$|\.test\.[cm]?[jt]s$|\.prompt\.md$|\.docs\.md$/;

// The binding, and the floor under it: the files that decide which checks run, what a red means and how a browser opens
// are the same class as the review recognition, so a change to one is Standard at least (it cannot show in its own tier).
const BINDING = /^(?:tools\/(?:gate-tier[^/]*|rigour\.mjs|lib\/rigour[^/]*|fixtures\/rigour\/.*|checks\.mjs|smoke\.mjs|lib\/(?:flakes|changed|harness|smoke)[^/]*|lib\/component-check\.mjs)|docs\/BROWSERS\.md)$/;

const RENDERING = /(^|\/)(render\.js|demo\.html)$|\/skins\/|\.css$/;
const FRONT_DOOR = new Set([
  'apps/docs/index.html', 'apps/docs/index-page.js',
]);

function normalise(registry) {
  if (Array.isArray(registry)) return registry;
  if (registry && Array.isArray(registry.items)) return registry.items;
  throw new TypeError('classify: registry must be an array of items or { items }');
}

function posix(p) { return String(p).replaceAll('\\', '/'); }

/** The item a changed path belongs to: exact file match first, else the deepest folder match. */
export function ownerOf(p, items) {
  let best = null;
  for (const item of items) {
    const dir = itemDir(item);
    for (const f of item.files ?? []) {
      const fp = posix(f.path ?? f);
      if (fp === p) return item;
      if (fp.startsWith(p + '/')) best = best && bestDir(best).length >= item.name.length ? best : item; // the item itself is a path's child: skip
    }
    if (dir && (p.startsWith(dir + '/') || p === dir)) {
      if (!best || dir.length > bestDir(best).length) best = item;
    }
  }
  return best;
}

function itemDir(item) {
  const f = (item.files ?? [])[0];
  if (!f) return '';
  const fp = posix(f.path ?? f);
  const i = fp.lastIndexOf('/');
  return i < 0 ? '' : fp.slice(0, i);
}
function bestDir(item) { return itemDir(item) || item.name; }

/**
 * Which pieces depend on a given item, from the index's dependency lists. A piece the
 * others import is a shared primitive, whatever folder it sits in.
 */
export function dependedOnBy(items) {
  const map = new Map();
  for (const item of items) for (const d of item.dependencies ?? []) {
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(item.name);
  }
  return map;
}

export function classify(paths, registry, { newPaths = [], gateFullPaths = [] } = {}) {
  const items = normalise(registry);
  const deps = dependedOnBy(items);
  const byName = new Map(items.map(i => [i.name, i]));
  const added = new Set((Array.isArray(newPaths) ? newPaths : [...newPaths]).map(posix));
  const gateFull = new Set((Array.isArray(gateFullPaths) ? gateFullPaths : [...gateFullPaths]).map(posix));
  const isNewItem = item => [...added].some(a => a.endsWith('/registry.json') && ownerOf(a, items)?.name === item.name);

  const reasons = [];
  let tier = 'light';
  const raise = (t, reason) => {
    reasons.push(`${t}: ${reason}`);
    if (t === 'full') tier = 'full';
    else if (t === 'standard' && tier !== 'full') tier = 'standard';
  };

  for (const raw of paths) {
    const p = posix(raw);
    if (gateFull.has(p)) { raise('full', `${p} declares gate: full`); continue; }

    if (isGenerated(p)) { reasons.push(`neutral: ${p} is generated`); continue; }

    const item = ownerOf(p, items);
    const itemName = item ? item.name : null;
    const rendering = RENDERING.test(p);

    if (p.startsWith('docs/decisions/')) { raise('full', `${p} is a decision`); continue; }
    if (p.startsWith('packages/') && DOC_PROSE.test(p)) { reasons.push(`light: ${p} is prose`); continue; }

    // Full, in the order the request's table names them
    if (SHARED_PREFIXES.some(pre => p.startsWith(pre))) {
      raise('full', `${p} is a shared primitive (core, tokens, type or kernels)`);
      continue;
    }
    // The engine is imported by every scene but is Standard, not Full (see the Standard rules below); it is exempt here.
    if (item && itemName !== 'engine' && (deps.get(itemName)?.length ?? 0) > 0 && !LIGHT_PREFIXES.some(pre => p.startsWith(pre)) && !LIGHT_SUFFIX.test(p)) {
      const importers = deps.get(itemName);
      // A package born in this diff and imported only by pieces born in it has no other user to break.
      if (isNewItem(item) && importers.every(n => byName.has(n) && isNewItem(byName.get(n)))) {
        raise('standard', `${p} is ${itemName}, a new package imported only by new pieces in this diff (${importers.join(', ')})`);
        continue;
      }
      raise('full', `${p} is ${itemName}, which other pieces import (${importers.join(', ')})`);
      continue;
    }
    if (item && item.type === 'component' && FULL_COMPONENTS.has(item.name.replace(/^scene-/, '')) && !LIGHT_SUFFIX.test(p)) {
      raise('full', `${p} is a focus-managing overlay or form (${itemName})`);
      continue;
    }
    // Sacred always; regional only for a new piece (its manifest is added), so a fix to an
    // established regional scene is a Standard change.
    if (item?.motif && rendering && (item.motif.tier === 'sacred' || (item.motif.tier === 'regional' && isNewItem(item)))) {
      raise('full', `${p} renders ${itemName}, whose motif is ${item.motif.tier === 'sacred' ? 'sacred' : 'regional, in a new piece'}`);
      continue;
    }
    if (FRONT_DOOR.has(p)) { raise('full', `${p} is the home page / front door`); continue; }

    // Standard
    if (rendering && item) {
      raise('standard', `${p} is a rendering file of ${itemName}`);
      continue;
    }
    if (rendering && !item) { raise('standard', `${p} is a rendering file`); continue; }
    if (added.has(p) && item && ['components', 'scenes', 'recipes'].some(f => p.startsWith(`packages/${f}/`))) {
      raise('standard', `${p} is new, in an existing family (${itemName})`);
      continue;
    }

    // The engine is shared: tools/lib/changed.core.js selects every check for it, so a change that is not a test is Standard at least.
    if (p.startsWith('packages/engine/') && !LIGHT_SUFFIX.test(p)) {
      raise('standard', `${p} is engine, which every scene shares`);
      continue;
    }

    // The binding itself: a change to how a review is recognised or the tier is judged cannot show in its own tier, so never Light.
    if (BINDING.test(p)) { raise('standard', `${p} is the gate binding itself or decides what a check or a red means (the tier, the review recognition, the runner, the checks, the flake table)`); continue; }

    // Light: tools, docs, tests, copy, and the engine's own tests; nothing that renders
    if (LIGHT_PREFIXES.some(pre => p.startsWith(pre)) || LIGHT_SUFFIX.test(p)) {
      reasons.push(`light: ${p}`);
      continue;
    }

    raise('standard', `${p} is not in the Light list, so the default is Standard`);
  }

  return { tier, reasons };
}

// ---- Lanes (decision 0031, RUNBOOK §4a): which review is owed now, and which at promotion ----
//
// A unit whose every changed path belongs to an experimental registry item (its folder: code, docs, demo, words; the
// demo's recorded accessibility tree in tools/a11y-baseline; generated files are neutral) is on the experimental lane:
// the review its tier owes is owed at promotion, not at the merge. Everything else is shared ground and binds as
// before: a path that belongs to no item, the shared prefixes, the engine and export, and any item above experimental.
// An item that other pieces import is shared too, whatever its stability, because one wrong primitive breaks them all.
// A `Gate: standard` or `Gate: full` trailer raises the unit's tier (mergedSlices) and does not move it off the lane.
const LANE_SHARED_PREFIXES = [...SHARED_PREFIXES, 'packages/engine', 'packages/export'];
const A11Y_BASELINE = /^tools\/a11y-baseline\/(.+)\.aria\.yml$/;

/** { lane: 'experimental' | 'shared', items: [names of the experimental items touched], shared: [paths that made it shared] } */
export function laneOf(paths, registry) {
  const items = normalise(registry);
  const deps = dependedOnBy(items);
  const touched = new Set();
  const shared = [];
  for (const raw of paths) {
    let p = posix(raw);
    if (isGenerated(p)) continue;
    const baseline = A11Y_BASELINE.exec(p);
    if (baseline) p = baseline[1].replaceAll('__', '/');
    const onShared = LANE_SHARED_PREFIXES.some(pre => p === pre || p.startsWith(`${pre}/`) || (pre === 'packages/engine' && p.startsWith('packages/engine-')));
    const item = onShared ? null : ownerOf(p, items);
    if (item && item.stability === 'experimental' && !(deps.get(item.name)?.length)) touched.add(item.name);
    else shared.push(posix(raw));
  }
  return { lane: shared.length || !touched.size ? 'shared' : 'experimental', items: [...touched].sort(), shared };
}

// ---- Binding the tier: has a merged slice had the review its tier owes? ----
//
// A review counts ONLY through the canonical line, on a line of its own (a list bullet may lead it), in docs/LEDGER.md
// or any docs/reviews/*.md, outside fenced code blocks, blockquotes, inline code and HTML comments:
//
//     Rasika: <pass | pass with notes | changes needed | blocked>. Tier: <Light | Standard | Full>. Slice: <branch> (<hash>)
//     Rasika: <pass | pass with notes | changes needed | blocked>. Tier: <Light | Standard | Full>. Slice: commit <hash>
//
// The verdict, the tier and the slice come from that line alone; no prose anywhere can raise a tier or create a pass.
// The first form reviews a merged slice (the branch, whole, and a hash of seven or more digits that is the merge or
// the branch's tip, the commit the merge brought; an earlier commit of the slice is not what was merged); the second
// reviews one direct commit, one line per commit (see mergedSlices). Recognition is an allow-list: a near-miss is not
// a review, so nothing needs to be block-listed.
//
// The latest verdict wins. A unit's reviews are read in document order (the ledger, then docs/reviews/ by file name,
// so same-day files sort by name; within a file, by line). Only the passes after the last `changes needed` or `blocked`
// count: a later pass clears an earlier `changes needed`, a later `changes needed` withdraws an earlier pass. The best
// tier among those passes has to reach the unit's tier. A Light slice owes no review agent, so it is always satisfied.
//
// Legacy: reviews that git already held before LEGACY_BEFORE keep the old pattern recognition (verdictOf,
// declaredTier, reviewBlocks, LEDGER_OWED), so history still reads. Which ones is git's answer and not the author's
// (reviewDocuments sets doc.legacy for a file and doc.legacyLines for ledger lines): the snapshot is the last commit
// before the cutoff, and a file or a ledger line is legacy only if the snapshot has it. A name saying 2026-10-16 on a
// file that is new to git proves nothing, so a file written today is canonical-only. Why git and not a frozen list:
// there is no list to maintain, and every checkout gives the same answer.
//
// A merge commit can also raise its unit's tier: a line of its own, `Gate: standard` or `Gate: full`, in its message
// (gateTrailerTier). It only raises.

export const TIER_RANK = { light: 0, standard: 1, full: 2 };

const DECLARES = [
  /\btier\s*[:=]\s*(standard|full)\b/gi,                  // Tier: Full
  /\b(standard|full)\s+(?:rasika|review|pass)\b/gi,       // Full review, Standard pass, Full Rasika
  /\brasika\s+(?:pass\s+)?(?:at\s+|:\s*)?(standard|full)\b/gi, // Rasika Full, Rasika at Standard
  /\b(standard|full)\s*[;,]\s*rasika\b/gi,                // "... Full; Rasika pass with notes"
];

/** What a tier owes, in the words of docs/RUNBOOK.md section 5. */
export function reviewOwed(tier) {
  return {
    light: 'Light: no review agent. The Sutradhar reads the diff and the review pack.',
    standard: 'Standard: Rasika works from the review pack (one strip if it moves, the keyboard if it is interactive).',
    full: 'Full: Rasika does everything in its kernel, and Kathakar writes every string.',
  }[tier];
}

/** The tier a unit of text declares for its review, or null. The highest one anywhere in it wins. */
export function declaredTier(text) {
  let best = null;
  for (const re of DECLARES) {
    for (const m of text.matchAll(re)) {
      const t = m[1].toLowerCase();
      if (best === null || TIER_RANK[t] > TIER_RANK[best]) best = t;
    }
  }
  return best;
}

// ---- The verdict ----
//
// Found in a clause (text between . ; or a line end) that holds the word Rasika followed within a few words by a
// verdict phrase. It is void when a word of doubt or postponement stands before the verdict in that clause
// ("no Rasika pass", "Rasika has not passed", "Rasika review still owed, nothing passed") or a word of postponement
// follows it ("Rasika pass pending", "pass to be booked", "pass not run").
const VERDICT = /\b(pass with notes|pass with findings|changes needed|blocked|approved|passes|passed|pass)\b/i;
const BEFORE_DOUBT = /\b(not|no|nothing|never|without|none|still|yet|owed|owe|owes|pending|awaiting|awaits|await|booked|book|will|would|should|could|may|might|once|until|unless|if|when|whether|need|needs|expected|expect|tbd|todo|to be|asked for)\b|n't/i;
const AFTER_DOUBT = /\b(yet|still|owed|owe|owes|pending|booked|book|tbd|todo|to be|not run|not yet|not done|not finished|expected|awaiting|once|until|unless|if|when|will|would)\b/i;

const CLAUSE = /[^.;\n]+/g;

/**
 * The verdicts Rasika gave in a text, in order: 'pass', 'changes needed' or 'blocked'. A review that has not
 * happened gives none.
 */
export function verdictsOf(text) {
  const out = [];
  for (const clause of text.match(CLAUSE) ?? []) {
    const r = /rasika/i.exec(clause);
    if (!r) continue;
    const after = clause.slice(r.index + r[0].length);
    const v = VERDICT.exec(after);
    if (!v || v.index > 48) continue;                        // the verdict stands next to the name
    const before = clause.slice(0, r.index).split(/[:,(]/).pop();      // back to the nearest break
    const between = after.slice(0, v.index);
    const tail = after.slice(v.index + v[0].length);
    if (BEFORE_DOUBT.test(before) || BEFORE_DOUBT.test(between) || AFTER_DOUBT.test(tail)) continue;
    const word = v[1].toLowerCase();
    out.push(word === 'changes needed' || word === 'blocked' ? word : 'pass');
  }
  return out;
}

/** The single verdict of a unit: a failing one beats a pass (a review that found changes did not pass); null when none. */
export function verdictOf(text) {
  const vs = verdictsOf(text);
  if (!vs.length) return null;
  return vs.find(v => v !== 'pass') ?? 'pass';
}

// A ledger line that carries any of these says some review is still to come: the whole line is void, whatever else it says.
const LEDGER_OWED = /\b(owed|owes|pending|to be booked|to book|not yet|nothing passed|awaiting)\b/i;

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Does the text name the slice? refs: branch names and commit hashes (any length of 7 or more is matched as a prefix). */
export function namesSlice(text, refs) {
  for (const ref of refs) {
    if (!ref) continue;
    if (/^[0-9a-f]{7,40}$/i.test(ref)) {
      for (const m of text.matchAll(/(?<![0-9a-f])[0-9a-f]{7,40}(?![0-9a-f])/gi)) {
        if (ref.toLowerCase().startsWith(m[0].toLowerCase())) return true;
      }
    } else if (new RegExp('(?<![\\w/.-])' + escapeRe(ref) + '(?![\\w/-])').test(text)) return true;
  }
  return false;
}

/**
 * The blocks of a markdown file: the whole file (level 0) and one per heading, which runs to the next heading of
 * the same or a shallower level. { level, start, end (line indexes, end exclusive), heading, text }.
 */
export function blocksOf(text) {
  const lines = text.split('\n');
  const heads = [];
  lines.forEach((l, i) => { const m = /^(#{1,6})\s+\S/.exec(l); if (m) heads.push({ level: m[1].length, start: i }); });
  const blocks = [{ level: 0, start: 0, end: lines.length, heading: '', text }];
  for (const h of heads) {
    let end = lines.length;
    for (const o of heads) if (o.start > h.start && o.level <= h.level) { end = o.start; break; }
    blocks.push({ level: h.level, start: h.start, end, heading: lines[h.start], text: lines.slice(h.start, end).join('\n') });
  }
  return blocks;
}

// a lies within b; two blocks over the same lines (a title that is the whole file) count once, the heading's
const inside = (a, b) => a !== b && a.start >= b.start && a.end <= b.end && (a.start > b.start || a.end < b.end || a.level < b.level);

/** The blocks of a review file that review a slice: the headings that name it (outermost), else the smallest blocks that do. */
export function reviewBlocks(text, refs) {
  const blocks = blocksOf(text);
  const headed = blocks.filter(b => b.level > 0 && namesSlice(b.heading, refs));
  if (headed.length) return headed.filter(b => !headed.some(o => inside(b, o)));
  const naming = blocks.filter(b => namesSlice(b.text, refs));
  return naming.filter(b => !naming.some(o => inside(o, b)));
}

function judgeUnit(text, heading) {
  // The heading is the review's header: its verdict and tier stand for the section when it gives them.
  const verdict = (heading && verdictOf(heading)) || verdictOf(text);
  if (!verdict) return null;
  const tier = (heading && declaredTier(heading)) || declaredTier(text);
  return tier ? { tier, verdict } : null;
}

// ---- The canonical line ----

/** Reviews dated on or after this day count only through the canonical line. */
export const LEGACY_BEFORE = '2026-10-17';

const HASH = /^[0-9a-f]{7,40}$/i;
const CANON = /^ {0,3}(?:[-*+] +)?Rasika: (pass with notes|pass|changes needed|blocked)\. Tier: (Light|Standard|Full)\. Slice: (?:commit ([0-9a-fA-F]{7,40})|([A-Za-z0-9][A-Za-z0-9_.\/-]*) \(([0-9a-fA-F]{7,40})\))$/;

/** The canonical review line parsed, or null when the text is anything else. { verdict, tier, branch, hash, commit } */
export function canonicalReviewLine(line) {
  const m = CANON.exec(line);
  if (!m) return null;
  return {
    verdict: m[1] === 'changes needed' || m[1] === 'blocked' ? m[1] : 'pass',
    tier: m[2].toLowerCase(), branch: m[4] ?? null, hash: (m[3] ?? m[5]).toLowerCase(), commit: m[3] !== undefined,
  };
}

/**
 * The lines of a markdown text with what a review line cannot be in blanked out, so line numbers still count:
 * HTML comments, fenced code blocks (an unclosed fence runs to the end) and blockquotes (with their lazy continuation
 * lines, up to a blank line, heading, bullet or fence). Inline code is not stripped: a line that starts with a backtick
 * already fails the grammar, and stripping would credit a canonical line with a code span in front of it.
 */
export function proseLines(text) {
  const bare = text.replace(/<!--[\s\S]*?(?:-->|$)/g, m => m.replace(/[^\n]/g, ''));
  const out = [];
  let fence = null, quoting = false;
  for (const line of bare.split('\n')) {
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = null;
      out.push(''); continue;
    }
    if (open) { fence = open[1]; quoting = false; out.push(''); continue; }
    if (/^ {0,3}>/.test(line)) { quoting = true; out.push(''); continue; }
    if (!line.trim() || /^ {0,3}(#{1,6}\s|[-*+]\s)/.test(line)) quoting = false;
    if (quoting) { out.push(''); continue; }
    out.push(line);
  }
  return out;
}

/** Does a canonical line review this unit? A branch line needs the branch and an accepted hash (the merge or the tip; any hash in refs when none is given); a commit line needs a direct commit. */
function canonicalNames(c, refs, direct, accept = refs) {
  const hashed = accept.some(r => HASH.test(r || '') && (r.toLowerCase().startsWith(c.hash) || c.hash.startsWith(r.toLowerCase())));
  if (c.commit) return direct && hashed;
  return !direct && hashed && refs.some(r => r === c.branch && !HASH.test(r));
}

/**
 * The reviews found in documents: [{ source, tier, verdict, canonical? }] for each review of a slice (named by
 * refs; direct: a single direct commit). Includes verdicts that are not passes; enforce() reads which count.
 */
export function findReviews(documents, refs, { direct = false, accept } = {}) {
  const found = [];
  const add = r => { if (!found.some(x => x.source === r.source && x.tier === r.tier && x.verdict === r.verdict)) found.push(r); };
  for (const doc of documents) {
    proseLines(doc.text).forEach((line, i) => {
      const c = canonicalReviewLine(line);
      if (c && canonicalNames(c, refs, direct, accept)) add({ source: `${doc.source}:${i + 1}`, tier: c.tier, verdict: c.verdict, canonical: true });
    });
    if (doc.kind === 'ledger') {
      doc.text.split('\n').forEach((line, i) => {
        if (!doc.legacyLines?.has(line.trim()) || !namesSlice(line, refs) || LEDGER_OWED.test(line)) return;
        const j = judgeUnit(line, '');
        if (j) add({ source: `${doc.source}:${i + 1}`, ...j });
      });
    } else if (doc.legacy) {
      for (const b of reviewBlocks(doc.text, refs)) {
        const j = judgeUnit(b.text, b.heading);
        if (j) add({ source: b.level === 0 ? doc.source : `${doc.source}:${b.start + 1}`, ...j });
      }
    }
  }
  return found;
}

/**
 * Judge merged slices. slices: [{ name, refs, tier, reasons, direct?, merge?, tip? }] (direct: one commit made straight on
 * the branch; merge and tip: the hashes a branch line may name; lane and laneItems: from laneOf). Each comes back with `reviews` (those found, in document
 * order, with their verdicts), `deferred` (no review, but on the experimental lane: owed at promotion) and `ok`: true when it is Light, or the passes after its last non-pass reach its tier
 * (the header above says why the latest verdict wins).
 */
export function enforce(slices, documents, opts = {}) {
  return slices.map(s => {
    const accept = s.tip ? [s.merge, s.tip].filter(Boolean) : undefined;
    const reviews = s.tier === 'light' ? [] : findReviews(documents, s.refs, { ...opts, direct: Boolean(s.direct), accept });
    const lastBad = reviews.findLastIndex(r => r.verdict !== 'pass');
    const best = reviews.slice(lastBad + 1).reduce((a, r) => Math.max(a, TIER_RANK[r.tier]), -1);
    const ok = s.tier === 'light' || best >= TIER_RANK[s.tier];
    // On the experimental lane a missing review is not red: it is owed at promotion, by item.
    return { ...s, reviews, ok, deferred: !ok && s.lane === 'experimental' };
  });
}

/** One printed line for a judged slice (gate-tier --enforce and the rigour runner print the same). */
export function reviewLine(s) {
  const found = s.reviews.map(r => `${r.verdict === 'pass' ? '' : `${r.verdict}, `}${r.tier} at ${r.source}`).join('; ');
  const why = s.tier === 'light' ? 'no review owed'
    : s.ok ? found
    : s.deferred ? `owed at promotion (${(s.laneItems ?? []).join(', ')})${found ? `; ${found}` : ''}`
    : found ? `${found}; owes a passing review at ${s.tier}` : 'no Rasika review in the ledger or docs/reviews';
  return `${s.ok ? 'ok     ' : s.deferred ? 'PROMOTE' : 'MISSING'} ${s.tier.padEnd(8)} ${s.name}${s.merge ? ` (${s.merge})` : ''}: ${why}`;
}

/** The tier a merge commit's message raises its unit to: a line of its own, `Gate: standard` or `Gate: full`. `Gate: light` is nothing: a trailer only raises. */
export function gateTrailerTier(message) {
  let best = null;
  for (const m of String(message ?? '').matchAll(/^Gate: *(standard|full) *$/gim)) {
    const t = m[1].toLowerCase();
    if (best === null || TIER_RANK[t] > TIER_RANK[best]) best = t;
  }
  return best;
}
