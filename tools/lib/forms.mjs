// Sample values and verdicts for tools/form-check.mjs. Pure; tested in forms.test.mjs.

/**
 * @typedef {{ tag: string, type: string, name?: string, id?: string, label?: string, autocomplete?: string,
 *   required?: boolean, min?: string, max?: string, step?: string, minLength?: number, maxLength?: number,
 *   pattern?: string, multiple?: boolean, options?: { value: string, disabled: boolean }[] }} Field
 */

const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Does value satisfy an HTML pattern attribute? The spec compiles it as ^(?:p)$ with the v flag. */
export function matchesPattern(pattern, value) {
  if (!pattern) return true;
  let re;
  try { re = new RegExp(`^(?:${pattern})$`, 'v'); } catch { return true; } // an invalid pattern is ignored by browsers
  return re.test(value);
}

/** Candidate strings for a text-like field, most plausible first, from its name, label and autocomplete. */
export function textCandidates(f) {
  const hint = `${f.autocomplete || ''} ${f.name || ''} ${f.id || ''} ${f.label || ''}`.toLowerCase();
  const c = [];
  if (/email/.test(hint)) c.push('guest@example.com');
  if (/tel|phone|mobile/.test(hint)) c.push('+91 98765 43210', '9876543210');
  if (/postal|post.?code|pin|zip/.test(hint)) c.push('403001', '560001', '10001');
  if (/given|first/.test(hint)) c.push('Asha');
  if (/family|last|surname/.test(hint)) c.push('Fernandes');
  if (/name/.test(hint)) c.push('Asha Fernandes');
  if (/city|town|locality|address-level2/.test(hint)) c.push('Panaji');
  if (/address|street/.test(hint)) c.push('12 Rua de Ourem, Fontainhas');
  if (/country/.test(hint)) c.push('India');
  if (/gst/.test(hint)) c.push('30AABCU9603R1ZM');
  if (/url|website|site/.test(hint)) c.push('https://example.com');
  if (/one-time-code|otp|code/.test(hint)) c.push('482913');
  if (/amount|price|qty|quantity|guests|number|count/.test(hint)) c.push('2');
  c.push('Sample text', 'Sample', '1', 'A1');
  return [...new Set(c)];
}

/** Fit a string to minLength / maxLength by repeating or cutting it. */
export function fitLength(v, minLength, maxLength) {
  let s = v;
  if (minLength > 0) while (s.length < minLength) s += s.includes(' ') ? ' ' + v : v;
  if (maxLength >= 0 && maxLength !== undefined && s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

/** A valid number for min / max / step, or null when none exists. */
export function numberFor(min, max, step, fallback = 2) {
  const lo = min === '' || min == null ? null : Number(min);
  const hi = max === '' || max == null ? null : Number(max);
  const st = step === 'any' ? null : (step === '' || step == null ? 1 : Number(step));
  if (lo != null && hi != null && lo > hi) return null;
  let v = fallback;
  if (lo != null && v < lo) v = lo;
  if (hi != null && v > hi) v = hi;
  if (st) {
    // Valid values are base + k * step, where base is min (or 0).
    const base = lo ?? 0;
    const k = (v - base) / st;
    v = base + Math.round(k) * st;
    if (hi != null && v > hi) v -= st;
    if (lo != null && v < lo) v += st;
    v = Number(v.toFixed(10));
  }
  if ((hi != null && v > hi) || (lo != null && v < lo)) return null;
  return v;
}

/** A valid date string (yyyy-mm-dd) inside min / max, or null. Defaults to 15 October 2026. */
export function dateFor(min, max, fallback = '2026-10-15') {
  let v = fallback;
  if (min && v < min) v = min;
  if (max && v > max) v = max;
  if (min && max && min > max) return null;
  return v;
}

/**
 * What to put in a field. Returns { action: 'fill'|'select'|'check'|'skip', value?, reason? }.
 * 'select' values and radio choices are resolved from f.options; checkboxes and radios are checked.
 * @param {Field} f
 */
export function sampleFor(f) {
  const type = (f.type || 'text').toLowerCase();
  if (f.tag === 'select') {
    const opt = (f.options || []).find(o => !o.disabled && o.value !== '');
    return opt ? { action: 'select', value: opt.value } : { action: 'skip', reason: 'no enabled option with a value' };
  }
  if (type === 'checkbox' || type === 'radio') return { action: 'check' };
  if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset' || type === 'image') return { action: 'skip', reason: `${type} input` };
  if (type === 'file') return { action: 'skip', reason: 'file inputs are not filled' };
  if (type === 'number' || type === 'range') {
    const n = numberFor(f.min, f.max, f.step);
    return n == null ? { action: 'skip', reason: `no number fits min ${f.min}, max ${f.max}, step ${f.step}` } : { action: 'fill', value: String(n) };
  }
  if (type === 'date') {
    const d = dateFor(f.min, f.max);
    return d ? { action: 'fill', value: d } : { action: 'skip', reason: 'min is after max' };
  }
  const fixed = {
    email: 'guest@example.com', url: 'https://example.com', time: '10:30',
    'datetime-local': '2026-10-15T10:30', month: '2026-10', week: '2026-W42', color: '#b8412a', password: 'Monsoon-2026!',
  };
  if (type === 'datetime-local' || type === 'time' || type === 'month') {
    // Same shape as min / max, so a string compare orders them.
    let v = fixed[type];
    if (f.min && v < f.min) v = f.min;
    if (f.max && v > f.max) v = f.max;
    return { action: 'fill', value: v };
  }
  if (fixed[type]) return { action: 'fill', value: fixed[type] };
  // text, search, tel, textarea and anything unknown: the first candidate that meets the constraints.
  const candidates = type === 'tel' ? ['+91 98765 43210', '9876543210', ...textCandidates(f)] : textCandidates(f);
  for (const c of candidates) {
    const v = fitLength(c, f.minLength, f.maxLength);
    if (matchesPattern(f.pattern, v) && (!(f.minLength > 0) || v.length >= f.minLength)) return { action: 'fill', value: v };
  }
  return { action: 'skip', reason: `no sample value matches pattern ${f.pattern}` };
}

/**
 * The form-check.json beside a page: `/packages/recipes/booking/index.html` gives
 * `packages/recipes/booking/form-check.json`, relative to the repo root.
 * @param {string} url a page path, with or without a query
 */
export function samplesPathFor(url) {
  const path = new URL(url, 'http://x').pathname.replace(/^\/+/, '');
  const dir = path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1);
  return `${dir}form-check.json`;
}

/**
 * Read and check a form-check.json. The file maps a field's name (or id) to its value:
 *
 *   { "values": {
 *       "arrival": "2026-11-16",             text, date, select or radio: the value to use
 *       "rules": true,                       checkbox: checked or not
 *       "code": { "press": ".booking__send", then press this first, and read the value
 *                 "read": ".booking__code",  from this element's text, taking the
 *                 "match": "(\\d{3}) (\\d{3})" } }  match's groups joined (or the whole match)
 *   }
 *
 * An object may also carry "value" instead of "read". Unknown keys are an error, so a typo
 * never passes quietly.
 * @param {string} text
 * @returns {Map<string, { value?: string|boolean, press?: string, read?: string, match?: string }>}
 */
export function readSamples(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error(`form-check.json is not valid JSON: ${e.message}`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('form-check.json must be an object with "values"');
  for (const k of Object.keys(data)) if (k !== 'values' && k !== 'about') throw new Error(`form-check.json: unknown key "${k}" (expected "values", and optionally "about")`);
  const values = data.values ?? {};
  if (typeof values !== 'object' || Array.isArray(values)) throw new Error('form-check.json: "values" must be an object of field name to value');
  const out = new Map();
  for (const [name, v] of Object.entries(values)) {
    if (typeof v === 'string' || typeof v === 'boolean') { out.set(name, { value: v }); continue; }
    if (typeof v === 'number') { out.set(name, { value: String(v) }); continue; }
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`form-check.json: "${name}" must be a string, true or false, or an object`);
    for (const k of Object.keys(v)) if (!['value', 'press', 'read', 'match'].includes(k)) throw new Error(`form-check.json: "${name}" has an unknown key "${k}"`);
    if (('value' in v) === ('read' in v)) throw new Error(`form-check.json: "${name}" needs exactly one of "value" or "read"`);
    if (v.match != null && !v.read) throw new Error(`form-check.json: "${name}" has "match" without "read"`);
    if (v.match != null) { try { new RegExp(v.match); } catch (e) { throw new Error(`form-check.json: "${name}" has a bad "match": ${e.message}`); } }
    out.set(name, { ...v, value: typeof v.value === 'number' ? String(v.value) : v.value });
  }
  return out;
}

/** The value in some text, per a sample's "match": its groups joined, or the whole match, or null. */
export function valueFromText(text, match) {
  if (!match) return text.trim();
  const m = new RegExp(match).exec(text);
  if (!m) return null;
  return m.length > 1 ? m.slice(1).join('') : m[0];
}

/**
 * What to do with a field once the page's samples are known: the page's own value wins,
 * then the tool's guess for a required field. Optional fields with no sample are left alone.
 * @param {Field} f
 * @param {Map<string, object>} [samples]
 * @returns {{ action: 'fill'|'select'|'check'|'uncheck'|'skip'|'leave', value?: string, reason?: string,
 *   press?: string, read?: string, match?: string, from: 'page'|'tool'|null }}
 */
export function planFor(f, samples = new Map()) {
  const s = samples.get(f.name) ?? (f.id ? samples.get(f.id) : undefined);
  const type = (f.type || 'text').toLowerCase();
  if (s) {
    const extra = { press: s.press, read: s.read, match: s.match, from: 'page' };
    if (type === 'checkbox') return { action: s.value === false || s.value === 'false' ? 'uncheck' : 'check', ...extra };
    if (type === 'radio') return { action: 'check', value: String(s.value), ...extra };
    if (f.tag === 'select') return { action: 'select', value: s.value == null ? undefined : String(s.value), ...extra };
    return { action: 'fill', value: s.value == null ? undefined : String(s.value), ...extra };
  }
  if (!f.required) return { action: 'leave', from: null };
  return { ...sampleFor(f), from: 'tool' };
}

/**
 * Fields that carry a person's details, by type, autocomplete or name: a GET form would put
 * them in the address bar, the history and the server's logs.
 * @param {Field[]} fields
 * @returns {string[]} their names
 */
export function personalFields(fields) {
  const hint = /(^|[\s-])(name|given-name|family-name|tel|email|street-address|address-line\d|postal-code|bday)\b|phone|mobile|e-?mail|signature|^name$|full.?name/i;
  return fields
    .filter(f => f.type === 'tel' || f.type === 'email' || hint.test(f.autocomplete || '') || hint.test(f.name || ''))
    .map(f => f.name || f.id || f.tag);
}

/** Decode a form submission body into [name, value] pairs, where the encoding allows. */
export function decodeBody(contentType = '', body = '') {
  if (!body) return [];
  if (contentType.includes('application/x-www-form-urlencoded')) return [...new URLSearchParams(body)];
  if (contentType.includes('multipart/form-data')) {
    const out = [];
    for (const m of body.matchAll(/name="([^"]*)"(?:; filename="[^"]*")?\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*?)\r?\n--/g)) out.push([m[1], m[2]]);
    return out;
  }
  if (contentType.includes('json')) {
    try { return Object.entries(JSON.parse(body)).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]); } catch { return []; }
  }
  return [['(body)', body.slice(0, 200)]];
}

/**
 * Judge one form from its two phases.
 * empty:  submitting with nothing filled. With required fields and no novalidate, the browser
 *         must block it; if it goes through, that fails.
 * filled: submitting with every required field filled with a valid sample. It must go through.
 * With an <sg-stepper>, the empty phase presses Next on the first step: it must not move on
 * (walkedOn). The filled phase walks every step; `stuck` says where it could not go on.
 * @param {{ required: number, novalidate: boolean, skipped: number,
 *   empty: { submitted: boolean, walkedOn?: boolean },
 *   filled: { submitted: boolean, invalid: any[], stuck?: { step: number, count: number, message?: string } } }} r
 * @returns {{ pass: boolean, notes: string[] }}
 */
export function formVerdict(r) {
  const notes = [];
  let pass = true;
  if (r.required === 0) notes.push('no required fields, so the empty submit proves nothing');
  else if (r.empty.submitted && !r.novalidate) { pass = false; notes.push('it submitted with every required field empty'); }
  else if (r.empty.submitted && r.novalidate) notes.push('novalidate: it submitted empty; the server must validate');
  else notes.push('the empty submit did not go through');
  if (r.personalInGet?.length) { pass = false; notes.push(`method GET would put ${r.personalInGet.join(', ')} in the address bar: use POST`); }
  if (r.empty.walkedOn) { pass = false; notes.push('the stepper moved on from a step with its required fields empty'); }
  if (r.filled.stuck) notes.push(`the stepper stayed on step ${r.filled.stuck.step} of ${r.filled.stuck.count}${r.filled.stuck.message ? `: "${r.filled.stuck.message}"` : ''}`);
  if (!r.filled.submitted) {
    pass = false;
    notes.push(r.filled.invalid.length
      ? `it did not submit when filled: ${r.filled.invalid.length} field(s) still invalid`
      : 'it did not submit when filled, and nothing is invalid: check the submit button and the action');
  } else notes.push('it submitted when filled');
  if (r.skipped) notes.push(`${r.skipped} required field(s) could not be filled by the tool`);
  return { pass, notes };
}
