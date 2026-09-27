// Dependency order for registry items. Pure: works on a Map of name -> { dependencies }.

/**
 * Every item the requested names need, dependencies before the things that use them.
 * Ties break alphabetically, so the order is the same on every run.
 * @param {Map<string, { dependencies?: string[] }>} items
 * @param {string[]} names
 * @returns {string[]}
 * @throws {GraphError} on an unknown name or a cycle
 */
export function resolveOrder(items, names) {
  const order = [];
  const done = new Set();
  const onPath = [];

  const visit = (name, from) => {
    if (done.has(name)) return;
    const at = onPath.indexOf(name);
    if (at !== -1) throw new GraphError('cycle', [...onPath.slice(at), name]);
    const item = items.get(name);
    if (!item) throw new GraphError('missing', from ? [from, name] : [name]);
    onPath.push(name);
    for (const dep of [...(item.dependencies ?? [])].sort()) visit(dep, name);
    onPath.pop();
    done.add(name);
    order.push(name);
  };

  for (const name of names) visit(name, null);
  return order;
}

/**
 * Check a whole graph. Returns every missing dependency and every distinct cycle.
 * @param {Map<string, { dependencies?: string[] }>} items
 * @returns {{ missing: Array<[string, string]>, cycles: string[][] }}
 */
export function checkGraph(items) {
  const missing = [];
  for (const [name, item] of [...items].sort(([a], [b]) => a.localeCompare(b))) {
    for (const dep of item.dependencies ?? []) if (!items.has(dep)) missing.push([name, dep]);
  }

  // Colour DFS; each back edge is one cycle, reported from its smallest name so duplicates fold.
  const cycles = new Map();
  const state = new Map(); // 1 = on the path, 2 = finished
  const path = [];
  const visit = name => {
    state.set(name, 1);
    path.push(name);
    for (const dep of [...(items.get(name)?.dependencies ?? [])].sort()) {
      if (!items.has(dep)) continue;
      if (state.get(dep) === 1) {
        const loop = path.slice(path.indexOf(dep));
        const start = loop.indexOf([...loop].sort()[0]);
        const canon = [...loop.slice(start), ...loop.slice(0, start)];
        cycles.set(canon.join('>'), [...canon, canon[0]]);
      } else if (!state.get(dep)) visit(dep);
    }
    path.pop();
    state.set(name, 2);
  };
  for (const name of [...items.keys()].sort()) if (!state.get(name)) visit(name);

  return { missing, cycles: [...cycles.values()] };
}

export class GraphError extends Error {
  /** @param {'cycle' | 'missing'} kind @param {string[]} chain */
  constructor(kind, chain) {
    super(kind === 'cycle'
      ? `These items depend on each other in a loop: ${chain.join(' -> ')}`
      : chain.length > 1
        ? `${chain[0]} depends on ${chain[1]}, which is not in the registry`
        : `There is no item called ${chain[0]} in the registry`);
    this.kind = kind;
    this.chain = chain;
  }
}
