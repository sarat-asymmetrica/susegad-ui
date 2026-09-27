// Field note: the pure core. Which message to show, and when. Runs in Node.
//
// When: never while someone is typing into a field for the first time. The
// note appears when they leave a field they changed, or when they try to
// submit; once it is showing, it updates as they type and goes as soon as
// the value is valid ("reward early, punish late").

/** Every string a person reads or hears. Kathakar edits these. */
export const STRINGS = {
  prefix: { error: 'Error: ', hint: '' },
  valueMissing: ({ label }) => (label ? `Enter ${yours(label)}.` : 'Fill in this field.'),
  valueMissingChoice: ({ label }) => (label ? `Choose ${yours(label)}.` : 'Choose an option.'),
  valueMissingCheck: () => 'Tick this box to continue.',
  typeMismatch: ({ type }) =>
    type === 'email' ? 'Enter an email address like name@example.com.'
      : type === 'url' ? 'Enter a web address starting with https://.'
        : 'Check the format of this field.',
  patternMismatch: ({ title }) => (title ? `Use this format: ${title}` : 'Check the format of this field.'),
  tooShort: ({ minLength, length }) => `Use at least ${minLength} characters. You have ${length}.`,
  tooLong: ({ maxLength, length }) => `Use ${maxLength} characters or fewer. You have ${length}.`,
  rangeUnderflow: ({ min, max, type }) => (isNum(type) && has(max) ? `Enter a number from ${min} to ${max}.` : isDate(type) ? `Choose ${min} or later.` : `Enter ${min} or more.`),
  rangeOverflow: ({ min, max, type }) => (isNum(type) && has(min) ? `Enter a number from ${min} to ${max}.` : isDate(type) ? `Choose ${max} or earlier.` : `Enter ${max} or less.`),
  stepMismatch: ({ step }) => (step && Number(step) === 1 ? 'Enter a whole number.' : `Use steps of ${step}.`),
  badInput: ({ type }) => (type === 'number' ? 'Enter a number, using digits.' : 'Check what you entered here.'),
};

const lower = s => String(s).replace(/[:*]\s*$/, '').trim().replace(/^[A-Z](?![A-Z])/, c => c.toLowerCase());
// "Email" becomes "your email"; a label that already says whose ("Your email", "the room") is kept
const yours = s => (/^(your|my|our|the|a|an)\s/i.test(lower(s)) ? lower(s) : `your ${lower(s)}`);
const has = v => v !== undefined && v !== null && v !== '';
const isNum = t => t === 'number' || t === 'range';
const isDate = t => ['date', 'time', 'datetime-local', 'month', 'week'].includes(t);

/**
 * A date or time limit as a person would say it: "2026-10-16" is "16 October 2026".
 * A bare "en" (or no language) reads the Indian way, day before month. Pure.
 */
export function formatBound(value, type, lang) {
  if (!has(value) || !isDate(type)) return value;
  const loc = !lang || /^en$/i.test(lang) ? 'en-IN' : lang;
  const [d, t] = String(value).split('T');
  const [y, mo, day] = d.split('-').map(Number);
  const [h, mi] = (type === 'time' ? d : t ?? '').split(':').map(Number);
  const f = o => { try { return new Intl.DateTimeFormat(loc, { timeZone: 'UTC', ...o }).format(new Date(Date.UTC(y || 2000, (mo || 1) - 1, day || 1, h || 0, mi || 0))); } catch { return value; } };
  if (type === 'time') return Number.isFinite(h) ? f({ hour: 'numeric', minute: '2-digit' }) : value;
  if (type === 'month') return f({ month: 'long', year: 'numeric' });
  if (type === 'date') return f({ day: 'numeric', month: 'long', year: 'numeric' });
  if (type === 'datetime-local') return f({ day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  return value; // week: "2026-W42" is already plain
}

/** The order a person should fix things in: the first failing check wins. */
export const CHECKS = ['valueMissing', 'badInput', 'typeMismatch', 'patternMismatch', 'tooShort', 'tooLong', 'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'customError'];

/**
 * The message for a field's validity. A message the page gives for a check
 * (messages[check], or a data-<check> attribute) beats ours; a customError
 * uses the field's own validationMessage (set with setCustomValidity).
 * `f` carries the field's type, kind, label, limits, length, lang and messages.
 */
export function pickMessage(validity = {}, f = {}) {
  if (!validity || validity.valid) return { check: null, message: '' };
  const check = CHECKS.find(c => validity[c]) ?? 'customError';
  const own = f.messages?.[check];
  if (own) return { check, message: own };
  if (check === 'customError') return { check, message: f.validationMessage || STRINGS.typeMismatch({}) };
  if (check === 'valueMissing') {
    const fn = f.kind === 'choice' ? STRINGS.valueMissingChoice : f.kind === 'check' ? STRINGS.valueMissingCheck : STRINGS.valueMissing;
    return { check, message: fn(f) };
  }
  const fn = STRINGS[check];
  const g = { ...f, min: formatBound(f.min, f.type, f.lang), max: formatBound(f.max, f.type, f.lang) };
  return { check, message: fn ? fn(g) : f.validationMessage || '' };
}

/**
 * The showing state of a note: { dirty, shown }.
 * events: 'input' | 'change' | 'blur' | 'submit' | 'reset' | 'server'
 */
export function nextShown(prev, event, valid) {
  const s = { dirty: !!prev?.dirty, shown: !!prev?.shown };
  switch (event) {
    case 'input':
    case 'change':
      s.dirty = true;
      // already showing: follow the value, and let it go as soon as it is fixed
      if (s.shown) s.shown = !valid;
      return s;
    case 'blur':
      if (s.dirty) s.shown = !valid;
      return s;
    case 'submit':
    case 'server':
      s.dirty = true;
      s.shown = !valid;
      return s;
    case 'reset':
      return { dirty: false, shown: false };
    default:
      return s;
  }
}

/** Add or remove one id in a space-separated id list (aria-describedby), keeping the others. */
export function tokenList(list, id, on) {
  const ids = String(list ?? '').split(/\s+/).filter(Boolean).filter(x => x !== id);
  if (on) ids.push(id);
  return ids.join(' ');
}

// an email address, a web address, or a number (digits joined by spaces, commas, colons, slashes or dashes)
const VALUE = /[^\s@()]+@[^\s@]+\.[A-Za-z]{2,}|https?:\/\/[^\s,]*[^\s,.]|\+?\d(?:[\d ,.:/-]*\d)?/g;

/**
 * The message in runs: [text, isValue]. Values (what a person must copy) are set in the body
 * face in warm and playful, where the hand face would make a 1 read as an l. Pure.
 */
export function valueRuns(text) {
  const out = [];
  let at = 0;
  for (const m of String(text ?? '').matchAll(VALUE)) {
    if (m.index > at) out.push([text.slice(at, m.index), false]);
    out.push([m[0], true]);
    at = m.index + m[0].length;
  }
  if (at < String(text ?? '').length) out.push([text.slice(at), false]);
  return out;
}
