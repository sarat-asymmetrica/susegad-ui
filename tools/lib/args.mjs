// Small, strict argument parser shared by the tools. Pure; tested in args.test.mjs.
//
// spec maps a flag name (without --) to its kind:
//   'bool'    --reduced                 -> true
//   'string'  --out dir                 -> 'dir'
//   'number'  --width 390               -> 390 (error if not a number)
//   'list'    --move 0.5,0.5@1 (repeat) -> ['0.5,0.5@1', ...]
//   'kv'      --param grid=7 (repeat)   -> { grid: '7' }
// --flag=value is accepted for every kind but 'bool'. Unknown flags are errors,
// so a typo never silently changes what a gate measures.

/**
 * @param {string[]} argv
 * @param {Record<string, 'bool'|'string'|'number'|'list'|'kv'>} spec
 * @param {Record<string, any>} [defaults]
 * @returns {{ opts: Record<string, any>, positional: string[] }}
 */
export function parseArgs(argv, spec, defaults = {}) {
  const opts = { ...defaults };
  for (const [k, kind] of Object.entries(spec)) {
    if (kind === 'list' && !(k in opts)) opts[k] = [];
    if (kind === 'kv' && !(k in opts)) opts[k] = {};
    if (kind === 'list') opts[k] = [...opts[k]];
    if (kind === 'kv') opts[k] = { ...opts[k] };
  }
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--') || a === '--') { positional.push(a); continue; }
    let name = a.slice(2), inline;
    const eq = name.indexOf('=');
    if (eq >= 0) { inline = name.slice(eq + 1); name = name.slice(0, eq); }
    const kind = spec[name];
    if (!kind) throw new Error(`unknown flag --${name}`);
    if (kind === 'bool') {
      if (inline !== undefined) throw new Error(`--${name} takes no value`);
      opts[name] = true;
      continue;
    }
    const value = inline !== undefined ? inline : argv[++i];
    if (value === undefined) throw new Error(`--${name} needs a value`);
    if (kind === 'string') opts[name] = value;
    else if (kind === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`--${name} expects a number, got "${value}"`);
      opts[name] = n;
    } else if (kind === 'list') opts[name].push(value);
    else if (kind === 'kv') {
      const k = value.indexOf('=');
      if (k <= 0) throw new Error(`--${name} expects key=value, got "${value}"`);
      opts[name][value.slice(0, k)] = value.slice(k + 1);
    }
  }
  return { opts, positional };
}

/**
 * Parse a timed action such as "0.25,0.75@1.5" or "reseed@2".
 * @param {'move'|'click'|'call'} kind
 * @param {string} s
 */
export function parseAction(kind, s) {
  const at = s.lastIndexOf('@');
  if (at < 0) throw new Error(`--${kind} expects what@seconds, got "${s}"`);
  const what = s.slice(0, at), t = Number(s.slice(at + 1));
  if (!Number.isFinite(t) || t < 0) throw new Error(`--${kind}: bad time in "${s}"`);
  if (kind === 'call') {
    if (!/^[A-Za-z_$][\w$]*$/.test(what)) throw new Error(`--call: bad method name "${what}"`);
    return { kind, method: what, at: t };
  }
  const xy = what.split(',').map(Number);
  if (xy.length !== 2 || xy.some(v => !Number.isFinite(v))) throw new Error(`--${kind} expects x,y fractions, got "${what}"`);
  return { kind, x: xy[0], y: xy[1], at: t };
}

