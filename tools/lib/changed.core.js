// Which browser checks does a diff need? The pure half of `node tools/checks.mjs --changed`
// (tools/lib/changed.mjs reads git and the registry, tools/checks.mjs runs the result).
//
// A diff selects a check when:
//   - it touches a shared primitive (SHARED): then it selects everything, because a changed
//     signature in a shared function broke a stage no folder rule would have found;
//   - it touches the folder the check lives in (not for the shared folders that only hold
//     checks of several pieces, see GENERIC), or the check itself;
//   - it touches a registry item that owns the check, or an item that item depends on,
//     however far down the chain (registry `dependencies` are item names, and `checkDeps` are the
//     items its demo, page modules and checks load without installing them: registry/edges.mjs derives them);
//   - it touches something the check is known to cover (COVERS);
//   - it touches a component, and the check is the microinteraction check (TOUCH_CHECK);
//   - it touches the registry index (a new or removed item), and the check walks every item (REGISTRY_WALKERS).
//
// With a `context` (what each check loads: tools/lib/changed-deps.mjs reads it from the imports and
// package-lock.json), two shared primitives are narrowed:
//   - a tools/lib/ file selects the checks that import it, at any depth; everything only when it is
//     part of the server, the harness, the slots, overflow or the runner (context.everyAll);
//   - package-lock.json or package.json selects everything only when a dependency that every check
//     runs inside changed: one the harness, the server or the runner loads (playwright, axe-core and
//     theirs: context.everyAllPackages). Any other changed dependency selects the checks that load it,
//     browser or Node-only, and a note names what no browser check loads.
// Without a context both still select everything, as before.
//
// Prose (.md) is the exception to all of this: it selects its own folder's checks and the docs site's, never
// everything and never an item's dependents; the run's private records select nothing.

/** A change under any of these selects every check. Entries ending in "/" are folders; the others are exact files. */
export const SHARED = [
  'packages/core/', 'packages/engine/', 'packages/tokens/', 'tools/lib/', 'package.json',
  // every check serves its page through these:
  'package-lock.json', 'tools/serve.mjs', 'tools/harness/',
];

/**
 * Files under SHARED that no browser check reads: the text gate's own tooling (Node only, see NODE_CHECKS). Editing these
 * must not make every browser check run. Entries are prefixes of the repo-relative path.
 */
export const NOT_SHARED = ['tools/lib/text-gate', 'tools/lib/hb-canvas', 'tools/lib/bake-gate'];

const TEXT_GATE_INPUTS = [
  'packages/type/', 'packages/tokens/fonts', 'packages/tokens/tokens.css',
  'packages/scenes/tinto/model.js', 'packages/scenes/vad/model.js', 'packages/scenes/veranda/matka.core.js',
  // the scene code whose lay-out options the manifest mirrors by hand (a change to a size list, a family or a shape argument there is a change to find here)
  'packages/scenes/tinto/words.js', 'packages/scenes/vad/render.js', 'packages/scenes/veranda/matka-view.js',
  'tools/text-gate', 'tools/lib/text-gate', 'tools/lib/hb-canvas',
];

/**
 * Checks that need no browser: tools/checks.mjs runs them itself, in a plain child process, and they never take a
 * browser slot. `inputs` are what selects one (folders end in "/", the rest are prefixes of the repo-relative path); a diff
 * that touches a shared primitive selects them all, like the browser checks.
 */
export const NODE_CHECKS = {
  // the text gate lays the gate copy into the scenes' shapes with the real fonts: its inputs are the type tier, the fonts and
  // token stacks, the pure scene models it reads, the gate's own tooling and the fixtures (copy, calibration)
  'tools/text-gate.mjs': TEXT_GATE_INPUTS,
  // the bake gate runs the text gate (its inputs, above) and the pure reflow half of colour, motion, sound and, later, image:
  // the tokens, transitions, sound and image packages, and its own tooling
  'tools/bake-gate.mjs': [
    ...TEXT_GATE_INPUTS, 'packages/tokens/', 'packages/transitions/', 'packages/sound/', 'packages/image/',
    'tools/bake-gate', 'tools/lib/bake-gate',
  ],
};

/** Folders that hold the checks of several pieces side by side: a change next to them says nothing about them. */
const GENERIC = new Set(['packages', 'packages/components', 'packages/scenes', 'packages/recipes', 'packages/surfaces', 'packages/templates', 'recipes', 'tools']);

/** Checks that live in a shared folder but cover named registry items. */
export const COVERS = {
  'packages/components/overlays.check.mjs': ['popover', 'tooltip', 'action-menu', 'dialog', 'drawer', 'toast'],
};

/**
 * The registry index, and the checks that walk every item in it (apps/docs/site.check.mjs: every item reachable, one live drawing
 * per scene page). A new piece is a new entry in the index, so a change to it selects them; an edit inside an existing piece does not change
 * which pages exist and selects them only through the rules above.
 */
export const REGISTRY_INDEX = 'registry/registry.json';
export const REGISTRY_WALKERS = ['apps/docs/site.check.mjs'];

/** The library-wide microinteraction check: it presses every interactive component. */
export const TOUCH_CHECK = 'tools/touch.check.mjs';
const TOUCH_OWN = 'tools/touch.';

/** The docs site: it renders the repo's prose, so its checks run when any .md file changes. */
const DOCS_SITE = 'apps/docs';
/** Prose the site never renders (the run's own records and the agents' kernels): a change there selects nothing. */
const PRIVATE_PROSE = ['docs/LEDGER.md', 'docs/GOAL', 'docs/RUNBOOK.md', 'docs/runs/', 'docs/reviews/', 'docs/requests/', 'docs/briefs/', '.claude/'];

const isProse = f => f.endsWith('.md');
const norm = p => p.replaceAll('\\', '/').replace(/^\.\//, '');
const dirOf = p => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const under = (p, dir) => p === dir || p.startsWith(`${dir}/`);

/** The folder an item's manifest lives in. */
export const itemDir = item => dirOf(norm(item.manifest));

/**
 * Items that depend on any of `roots`, transitively, by `dependencies` (installed with it) or `checkDeps` (only its
 * demo, pages or checks load it). Returns name -> { root, via, loads }: the changed item it ends in, the item it hangs
 * off one step down, and whether that last step is a demo/page/check edge. Unknown names are ignored; cycles are safe.
 */
export function dependentsOf(items, roots) {
  const users = new Map(); // name -> { name, loads } for each item that lists it as a dependency
  const use = (d, user, loads) => (users.get(d) ?? users.set(d, []).get(d)).push({ name: user, loads });
  for (const it of items) {
    for (const d of it.dependencies ?? []) use(d, it.name, false);
    for (const d of it.checkDeps ?? []) if (!(it.dependencies ?? []).includes(d)) use(d, it.name, true);
  }
  const out = new Map();
  const seen = new Set(roots);
  const queue = [...roots].map(r => ({ name: r, root: r }));
  while (queue.length) {
    const { name, root } = queue.shift();
    for (const { name: user, loads } of users.get(name) ?? []) {
      if (seen.has(user)) continue;
      seen.add(user);
      out.set(user, { root, via: name, loads });
      queue.push({ name: user, root });
    }
  }
  return out;
}

const MANIFESTS = new Set(['package.json', 'package-lock.json']);
const plural = (list, one, many) => (list.length === 1 ? one : many);

/**
 * Sort the diff's shared-primitive files into: the one that makes everything run (allReason), the
 * tools/lib files and dependencies to follow check by check (libs, packages), and notes for --dry.
 * context: see the header. Without one, every shared file makes everything run.
 */
export function sharedHits(files, { shared = SHARED, context } = {}) {
  const isShared = f => !NOT_SHARED.some(n => f.startsWith(n)) && shared.some(s => (s.endsWith('/') ? f.startsWith(s) : f === s));
  const libs = [], notes = [];
  let packages = [];
  for (const f of files.filter(isShared)) {
    if (context && f.startsWith('tools/lib/')) {
      if (context.everyAll?.has(f)) return { allReason: `${f} is ${context.everyAll.get(f)}: everything runs`, libs, packages, notes };
      libs.push(f);
      continue;
    }
    if (context && MANIFESTS.has(f)) {
      if (!context.changedPackages) return { allReason: `${f} changed and its dependency diff could not be read: everything runs`, libs, packages, notes };
      const every = context.changedPackages.find(p => context.everyAllPackages?.has(p));
      if (every) return { allReason: `${f}: ${every} changed, and every browser check loads it: everything runs`, libs, packages, notes };
      packages = context.changedPackages;
      continue;
    }
    return { allReason: `${f} is a shared primitive: everything runs`, libs, packages, notes };
  }
  if (context && files.some(f => MANIFESTS.has(f) && isShared(f))) {
    if (!packages.length) notes.push('package.json or package-lock.json changed, but no dependency did: no check runs for it');
    else {
      const unused = packages.filter(p => !context.browserPackages?.has(p));
      notes.push(`changed dependencies: ${packages.join(', ')}. The harness, server and runner load none of them, so only the checks that load one run`
        + (unused.length ? `; no browser check loads ${unused.join(', ')}` : ''));
    }
  }
  return { allReason: null, libs, packages, notes };
}

/** The fixture a file under tools/fixtures/ belongs to: a folder (tools/fixtures/touch) or a loose file. */
const FIXTURES = 'tools/fixtures/';
const fixtureOf = f => (f.startsWith(FIXTURES) ? `${FIXTURES}${f.slice(FIXTURES.length).split('/')[0]}` : null);

/**
 * Why a check loads a changed file or package (none: []). loads: context.loads(check). files: the diff's code files that are
 * not already followed some other way: tools/lib files, but also an app's core, a fixture folder or tools/publish, whatever
 * the check's imports reach. A file under tools/fixtures/ is read by name from a path string, so the fixture folder stands for it.
 */
function loadReasons(check, loads, files, packages) {
  if (!loads) return [];
  const out = [];
  for (const f of files) {
    const fx = fixtureOf(f);
    if (fx && loads.files.has(fx)) { out.push(`reads ${fx}/, which changed (${f})`); continue; }
    if (!loads.files.has(f)) continue;
    const from = loads.files.get(f);
    out.push(`imports ${f}${from && from !== check ? ` (through ${from})` : ''}, which changed`);
  }
  for (const p of packages) if (loads.packages.has(p)) out.push(`loads ${p}, which changed in the lockfile`);
  return out;
}

/**
 * @param {{ changed: string[], checks: string[], items: object[], shared?: string[], context?: object }} input
 *   changed: repo-relative paths in the diff; checks: repo-relative paths of every check;
 *   items: registry/registry.json items; context: what each check loads (see the header)
 * @returns {{ all: boolean, allReason: string|null, selected: { check: string, reasons: string[] }[], notes: string[] }}
 */
export function selectChecks({ changed, checks, items, shared = SHARED, context }) {
  const files = [...new Set(changed.map(norm))].filter(Boolean);
  // Prose is read by people, not imported by a page: it never selects everything and never reaches an item's
  // dependents. It selects the checks in its own folder (a sample document a check builds) and the docs site's
  // checks, which render it; the run's private records (PRIVATE_PROSE) never select the docs site.
  const code = files.filter(f => !isProse(f));
  const prose = files.filter(f => isProse(f) && !PRIVATE_PROSE.some(p => f.startsWith(p)));
  const { allReason, libs, packages, notes } = sharedHits(code, { shared, context });
  if (allReason) return { all: true, allReason, selected: checks.map(check => ({ check, reasons: [allReason] })), notes };

  // Which items did the diff touch (a file under the item's folder, or one of its listed files)?
  const touched = new Map(); // name -> first changed file
  for (const it of items) {
    const dir = itemDir(it);
    const own = new Set((it.files ?? []).map(f => norm(f.path)));
    const f = code.find(x => (dir && under(x, dir)) || own.has(x));
    if (f) touched.set(it.name, f);
  }
  const dependents = dependentsOf(items, [...touched.keys()]);
  const byName = new Map(items.map(i => [i.name, i]));
  const touchedComponent = [...touched].find(([name]) => byName.get(name).type === 'component')
    ?? code.map(f => [null, f]).find(([, f]) => /^packages\/components\/[^/]+\/./.test(f)); // a component folder not in the registry yet

  const dependencyReason = name => {
    const { root, via, loads } = dependents.get(name);
    return `${name}${loads ? "'s demo or page loads" : ' depends on'} ${root}${via === root ? '' : ` (via ${via})`}, which changed`;
  };

  const selected = [];
  for (const check of checks) {
    const reasons = [];
    const dir = dirOf(check);
    if (files.includes(check)) reasons.push('the check itself changed');
    reasons.push(...loadReasons(check, context?.loads?.(check), [...libs, ...code.filter(f => !libs.includes(f))], packages));
    // a check that loads a file of an item (import('/packages/components/badge/badge.js'), a page that names a scene)
    // runs when anything in that item changes, as for an item's own checks: the loaded file is not the only one that matters
    const loaded = context?.loads?.(check)?.files;
    if (loaded) {
      for (const [name, file] of touched) {
        const idir = itemDir(byName.get(name));
        const via = idir && [...loaded.keys()].find(f => under(f, idir));
        if (via && !under(check, idir)) reasons.push(`loads ${via}, in ${name}, which changed (${file})`);
      }
    }
    if (!GENERIC.has(dir)) {
      const f = files.find(x => under(x, dir));
      if (f) reasons.push(`${f} is in ${dir}/`);
    }
    for (const it of items) {
      const idir = itemDir(it);
      if (!idir || !under(dir, idir)) continue; // the check is not inside this item's folder
      if (touched.has(it.name) && !reasons.some(r => r.includes(`in ${dir}/`))) reasons.push(`${touched.get(it.name)} changed ${it.name}`);
      if (dependents.has(it.name)) reasons.push(dependencyReason(it.name));
    }
    if (prose.length && under(dir, DOCS_SITE)) reasons.push(`${prose[0]} is prose the docs site renders`);
    if (REGISTRY_WALKERS.includes(check) && files.includes(REGISTRY_INDEX)) reasons.push(`${REGISTRY_INDEX} (the registry index) changed: a new or removed item must show up on the site`);
    for (const name of COVERS[check] ?? []) {
      if (touched.has(name)) reasons.push(`covers ${name}, which changed (${touched.get(name)})`);
      else if (dependents.has(name)) reasons.push(`covers ${dependencyReason(name)}`);
    }
    if (check === TOUCH_CHECK) {
      if (touchedComponent) reasons.push(`a component changed (${touchedComponent[1]})`);
      const own = files.find(f => f.startsWith(TOUCH_OWN));
      if (own) reasons.push(`${own} is the touch check's own code`);
    }
    if (reasons.length) selected.push({ check, reasons: [...new Set(reasons)] });
  }
  return { all: false, allReason: null, selected, notes };
}

/**
 * Which Node-only checks (NODE_CHECKS) does a diff need? Same reasons-first shape as selectChecks.
 * @returns {{ check: string, reasons: string[] }[]}
 */
export function selectNodeChecks({ changed, shared = SHARED, nodeChecks = NODE_CHECKS, context }) {
  const files = [...new Set(changed.map(norm))].filter(f => f && !isProse(f)); // prose is no gate's input (see selectChecks)
  const { allReason, libs, packages } = sharedHits(files, { shared, context });
  const out = [];
  for (const [check, inputs] of Object.entries(nodeChecks)) {
    if (allReason) { out.push({ check, reasons: [allReason] }); continue; }
    const reasons = loadReasons(check, context?.loads?.(check), libs, packages);
    for (const f of files) {
      const input = inputs.find(i => f.startsWith(i));
      if (input) reasons.push(`${f} is an input of ${check} (${input})`);
    }
    reasons.splice(0, reasons.length, ...new Set(reasons));
    if (reasons.length) out.push({ check, reasons: reasons.slice(0, 4).concat(reasons.length > 4 ? [`and ${reasons.length - 4} more`] : []) });
  }
  return out;
}
