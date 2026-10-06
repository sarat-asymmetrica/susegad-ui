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

const LIGHT_PREFIXES = ['packages/engine/', 'tools/', 'docs/', 'tests/', 'sketchbook/'];
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

    const item = ownerOf(p, items);
    const itemName = item ? item.name : null;
    const rendering = RENDERING.test(p);

    // Full, in the order the request's table names them
    if (SHARED_PREFIXES.some(pre => p.startsWith(pre))) {
      raise('full', `${p} is a shared primitive (core, tokens, type or kernels)`);
      continue;
    }
    if (item && itemName !== 'engine' && (deps.get(itemName)?.length ?? 0) > 0 && !LIGHT_PREFIXES.some(pre => p.startsWith(pre)) && !LIGHT_SUFFIX.test(p)) {
      raise('full', `${p} is ${itemName}, which other pieces import (${deps.get(itemName).join(', ')})`);
      continue;
    }
    if (p.startsWith('docs/decisions/')) { raise('full', `${p} is a decision`); continue; }
    if (item && item.type === 'component' && FULL_COMPONENTS.has(item.name.replace(/^scene-/, '')) && !LIGHT_SUFFIX.test(p)) {
      raise('full', `${p} is a focus-managing overlay or form (${itemName})`);
      continue;
    }
    if (item?.motif && (item.motif.tier === 'sacred' || item.motif.tier === 'regional') && rendering) {
      raise('full', `${p} renders ${itemName}, whose motif is ${item.motif.tier}`);
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

    // Light: only engine with tests, tools, docs, tests, copy; nothing that renders
    if (p.startsWith('packages/engine/')) {
      const hasTest = [...paths].some(q => posix(q).startsWith('packages/engine/') && LIGHT_SUFFIX.test(posix(q)));
      if (hasTest) { reasons.push(`light: ${p} is engine, with tests`); continue; }
      raise('standard', `${p} is engine without a test beside it in the same diff`);
      continue;
    }
    if (LIGHT_PREFIXES.some(pre => p.startsWith(pre)) || LIGHT_SUFFIX.test(p)) {
      reasons.push(`light: ${p}`);
      continue;
    }

    raise('standard', `${p} is not in the Light list, so the default is Standard`);
  }

  return { tier, reasons };
}
