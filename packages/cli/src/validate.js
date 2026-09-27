// A small JSON Schema validator: just the keywords registry/schema.json uses.
// type, enum, const, pattern, minLength, minimum, exclusiveMinimum, required,
// properties, additionalProperties, items, minItems, uniqueItems and local $ref.
// A schema may carry "x-hint", said instead of the raw pattern when a string does not match.
// Unknown keywords are ignored, the way JSON Schema asks.

/**
 * @param {unknown} value
 * @param {object} schema
 * @param {object} [root] the document local `$ref`s resolve against
 * @returns {string[]} problems, each "path: what is wrong"; empty when valid
 */
export function validate(value, schema, root = schema) {
  const errors = [];
  check(value, schema, root, '$', errors);
  return errors;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

function matchesType(v, type) {
  const t = typeOf(v);
  if (type === 'number') return t === 'number' || t === 'integer';
  return t === type;
}

function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) throw new Error(`Only local $ref is supported, got ${ref}`);
  let node = root;
  for (const part of ref.slice(2).split('/')) {
    node = node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (node === undefined) throw new Error(`$ref ${ref} points at nothing`);
  }
  return node;
}

function check(v, s, root, path, errors) {
  if (s === true || s === undefined) return;
  if (s === false) { errors.push(`${path}: is not allowed here`); return; }
  if (s.$ref) { check(v, resolveRef(s.$ref, root), root, path, errors); return; }

  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some(t => matchesType(v, t))) {
      errors.push(`${path}: should be ${types.join(' or ')}, got ${typeOf(v)}`);
      return;
    }
  }
  if ('const' in s && v !== s.const) errors.push(`${path}: should be ${JSON.stringify(s.const)}`);
  if (s.enum && !s.enum.includes(v)) {
    errors.push(`${path}: should be one of ${s.enum.map(e => JSON.stringify(e)).join(', ')}, got ${JSON.stringify(v)}`);
  }

  if (typeof v === 'string') {
    if (s.minLength !== undefined && v.length < s.minLength) errors.push(`${path}: should not be empty`);
    if (s.pattern && !new RegExp(s.pattern, 'u').test(v)) {
      errors.push(`${path}: ${JSON.stringify(v)} ${s['x-hint'] ?? `does not match ${s.pattern}`}`);
    }
  }

  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) errors.push(`${path}: should be at least ${s.minimum}`);
    if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) errors.push(`${path}: should be more than ${s.exclusiveMinimum}`);
  }

  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) errors.push(`${path}: should have at least ${s.minItems} item${s.minItems === 1 ? '' : 's'}`);
    if (s.uniqueItems) {
      const seen = new Set();
      for (const item of v) {
        const key = JSON.stringify(item);
        if (seen.has(key)) errors.push(`${path}: lists ${key} more than once`);
        seen.add(key);
      }
    }
    if (s.items) v.forEach((item, i) => check(item, s.items, root, `${path}[${i}]`, errors));
  }

  if (typeOf(v) === 'object') {
    for (const key of s.required ?? []) {
      if (!(key in v)) errors.push(`${path}: is missing "${key}"`);
    }
    const props = s.properties ?? {};
    for (const [key, val] of Object.entries(v)) {
      const sub = `${path}.${key}`;
      if (key in props) check(val, props[key], root, sub, errors);
      else if (s.additionalProperties === false) errors.push(`${sub}: is not a known field`);
      else if (typeof s.additionalProperties === 'object') check(val, s.additionalProperties, root, sub, errors);
    }
  }
}
