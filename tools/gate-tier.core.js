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

    // Light: tools, docs, tests, copy, and the engine's own tests; nothing that renders
    if (LIGHT_PREFIXES.some(pre => p.startsWith(pre)) || LIGHT_SUFFIX.test(p)) {
      reasons.push(`light: ${p}`);
      continue;
    }

    raise('standard', `${p} is not in the Light list, so the default is Standard`);
  }

  return { tier, reasons };
}

// ---- Binding the tier: has a merged slice had the review its tier owes? ----
//
// A review is recognised in two places, and only by what it says:
//   docs/LEDGER.md    one LINE (a bullet) is a unit
//   docs/reviews/*.md one SECTION is a unit: the heading block that names the slice, down to the next heading of the
//                     same or a shallower level (a file with no such heading is one unit, the smallest block naming it)
// A unit is a review of a slice when it (1) names the slice, by its branch (`slice/palm`) or by any commit hash
// (7 or more hex digits) that is the merge or one of the slice's own commits; (2) gives a verdict bound to Rasika in
// one clause; and (3) declares a tier. The tier a unit declares is the highest in it (the heading's own first, when the
// heading declares one), so a file that reviews several slices credits each at its own section's tier.
//
// The one-line form new reviews use (the Rasika kernel carries it):
//
//     Rasika: <pass | pass with notes | changes needed | blocked>. Tier: <Light | Standard | Full>. Slice: <branch> (<hash>)
//
// Older shapes still read: `Tier: Full`, `Full; Rasika pass with notes`, `Rasika Standard, pass`, `Rasika, pass.
// Tier: Standard` in a heading. A review that says the work is still owed is not a verdict: the verdict phrase must
// sit in the same clause as the word Rasika, with nothing negating or postponing it (see verdictsOf). Only a pass
// satisfies the requirement; `changes needed` and `blocked` are reviews that were done and did not pass, and the
// re-review that passes is what satisfies it. A Light slice owes no review agent, so it is always satisfied.

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

/**
 * The reviews found in documents: [{ source, tier, verdict }] for each unit that reviews a slice (named by refs)
 * with a Rasika verdict at a declared tier. Includes verdicts that are not passes; enforce() reads which count.
 */
export function findReviews(documents, refs) {
  const found = [];
  for (const doc of documents) {
    if (doc.kind === 'ledger') {
      doc.text.split('\n').forEach((line, i) => {
        if (!namesSlice(line, refs) || LEDGER_OWED.test(line)) return;
        const j = judgeUnit(line, '');
        if (j) found.push({ source: `${doc.source}:${i + 1}`, ...j });
      });
      continue;
    }
    for (const b of reviewBlocks(doc.text, refs)) {
      const j = judgeUnit(b.text, b.heading);
      if (j) found.push({ source: b.level === 0 ? doc.source : `${doc.source}:${b.start + 1}`, ...j });
    }
  }
  return found;
}

/**
 * Judge merged slices. slices: [{ name, refs, tier, reasons }]. Each comes back with `reviews` (those found, with
 * their verdicts) and `ok`: true when it is Light, or a review that passed at its tier or above was found.
 * A changes-needed review is listed and does not satisfy it.
 */
export function enforce(slices, documents) {
  return slices.map(s => {
    const reviews = s.tier === 'light' ? [] : findReviews(documents, s.refs);
    const best = reviews.filter(r => r.verdict === 'pass').reduce((a, r) => Math.max(a, TIER_RANK[r.tier]), -1);
    return { ...s, reviews, ok: s.tier === 'light' || best >= TIER_RANK[s.tier] };
  });
}

/** One printed line for a judged slice (gate-tier --enforce and the rigour runner print the same). */
export function reviewLine(s) {
  const found = s.reviews.map(r => `${r.verdict === 'pass' ? '' : `${r.verdict}, `}${r.tier} at ${r.source}`).join('; ');
  const why = s.tier === 'light' ? 'no review owed'
    : s.ok ? found
    : found ? `${found}; owes a passing review at ${s.tier}` : 'no Rasika review in the ledger or docs/reviews';
  return `${s.ok ? 'ok     ' : 'MISSING'} ${s.tier.padEnd(8)} ${s.name}${s.merge ? ` (${s.merge})` : ''}: ${why}`;
}
