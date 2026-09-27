// defineScene(def): the scene contract as a registry. Pure: runs in Node.
// A scene module's default export is what defineScene returns.

const KEY = Symbol.for('susegad.scenes');
/** Shared across module copies, so two URLs for core still see one registry. */
const store = (globalThis[KEY] ??= { defs: new Map(), waiting: new Map() });

export const toKebab = s => s.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
export const toCamel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const TYPES = ['number', 'int', 'bool', 'string', 'enum'];
const FALSY = ['false', '0', 'off', 'no'];

/**
 * Coerce one raw value (an attribute string, or a value passed to set()) to
 * the param's type. Missing or unreadable values give the default; numbers
 * are clamped to [min, max]. A default of null means "unset" is meaningful
 * (for example, progress: when it is unset, time drives the scene).
 */
export function coerceParam(spec, raw) {
  const d = spec.default ?? null;
  if (raw === null || raw === undefined) return d;
  switch (spec.type) {
    case 'number':
    case 'int': {
      let n = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (!Number.isFinite(n)) return d;
      if (spec.type === 'int') n = Math.round(n);
      if (spec.min !== undefined) n = Math.max(spec.min, n);
      if (spec.max !== undefined) n = Math.min(spec.max, n);
      return n;
    }
    case 'bool':
      if (typeof raw === 'boolean') return raw;
      return !FALSY.includes(String(raw).trim().toLowerCase());
    case 'enum': {
      const s = String(raw).trim();
      return spec.values.includes(s) ? s : d;
    }
    default:
      return String(raw);
  }
}

/** Every param at its default. */
export const defaultParams = params => Object.fromEntries(Object.entries(params).map(([k, s]) => [k, s.default ?? null]));

/** Read params from attributes: `get(attrName)` returns a string or null. */
export const paramsFromAttributes = (params, get) =>
  Object.fromEntries(Object.entries(params).map(([k, s]) => [k, coerceParam(s, get(toKebab(k)))]));

/** Merge a partial update, coercing each known key and ignoring the rest. */
export function mergeParams(params, current, patch = {}) {
  const next = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    const key = params[k] ? k : toCamel(k);
    if (params[key]) next[key] = coerceParam(params[key], v);
  }
  return next;
}

/** A seed is a number when it looks like one, otherwise a string. */
export const coerceSeed = (raw, fallback = 1) =>
  raw === null || raw === undefined || raw === '' ? fallback : Number.isFinite(+raw) ? +raw : String(raw);

/**
 * Register a scene. Throws on a malformed definition, so mistakes show up at
 * import time rather than as a blank frame.
 * @param {{ name: string, meta: object, params?: object, model: Function,
 *   createRenderer: Function, kind?: 'canvas2d'|'svg'|'webgl',
 *   interactive?: string[], status?: Function }} def
 */
export function defineScene(def) {
  const fail = m => { throw new TypeError(`defineScene(${def?.name ?? '?'}): ${m}`); };
  if (!def || !/^[a-z][a-z0-9-]*$/.test(def.name ?? '')) fail('name must be kebab-case');
  if (typeof def.model !== 'function') fail('model must be a function');
  if (typeof def.createRenderer !== 'function') fail('createRenderer must be a function');
  if (!def.meta || !(def.meta.W > 0) || !(def.meta.H > 0)) fail('meta needs W and H');
  const params = def.params ?? {};
  for (const [k, s] of Object.entries(params)) {
    if (!TYPES.includes(s.type)) fail(`param ${k}: type must be one of ${TYPES.join(', ')}`);
    if (s.type === 'enum' && !(s.values?.length > 0)) fail(`param ${k}: enum needs values`);
    if (['name', 'register', 'seed', 'paused', 'label'].includes(toKebab(k))) fail(`param ${k} clashes with a built-in attribute`);
  }
  const scene = Object.freeze({
    kind: 'canvas2d',
    interactive: [],
    status: null,
    ...def,
    params: Object.freeze({ ...params }),
    attributes: Object.freeze(Object.keys(params).map(toKebab)),
  });
  store.defs.set(scene.name, scene);
  store.waiting.get(scene.name)?.forEach(resolve => resolve(scene));
  store.waiting.delete(scene.name);
  return scene;
}

export const getScene = name => store.defs.get(name) ?? null;
export const sceneNames = () => [...store.defs.keys()];

/** Resolves with the definition once `name` is defined (at once if it already is). */
export function whenSceneDefined(name) {
  const def = getScene(name);
  if (def) return Promise.resolve(def);
  return new Promise(resolve => {
    if (!store.waiting.has(name)) store.waiting.set(name, []);
    store.waiting.get(name).push(resolve);
  });
}
