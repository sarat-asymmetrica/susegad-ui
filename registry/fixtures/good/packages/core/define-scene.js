const definitions = new Map();
const waiting = new Map();

export function defineScene(def) {
  definitions.set(def.name, def);
  waiting.get(def.name)?.(def);
  return def;
}

export function whenScene(name) {
  if (definitions.has(name)) return Promise.resolve(definitions.get(name));
  return new Promise(resolve => waiting.set(name, resolve));
}
