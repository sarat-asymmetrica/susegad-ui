// File upload: the words, the rules and the state, all pure. The page shows
// what this says and nothing else, so the screen can never run ahead of the
// bytes the transport has actually reported.

/** Every string a person reads. Kathakar's copy pass edits these. */
export const STRINGS = {
  field: 'Photos and PDFs',
  hint: max => `JPG, PNG, WebP or PDF, up to ${max} each.`,
  choose: 'Choose files',
  empty: {
    heading: 'No files yet',
    text: 'Photos and PDFs you add start uploading straight away, and appear here with a progress bar each.',
  },
  tooLarge: (name, size, max) => `${name} is ${size}, over the ${max} limit, so it wasn't added. Choose a smaller file, or compress it first.`,
  tooLargeMany: (n, max) => `${n} files are over the ${max} limit, so they weren't added. Choose smaller files, or compress them first.`,
  wrongType: name => `${name} isn't a photo or a PDF, so it wasn't added. Choose a JPG, PNG, WebP or PDF.`,
  row: (name, size) => `${name}, ${size}`,
  checking: (name, size) => `${name}, ${size}: checking the file`,
  failedRow: (name, size) => `${name}, ${size}: didn't upload`,
  retry: 'Try again',
  retryNamed: name => `Try ${name} again`,
  toastFailed: name => `${name} didn't upload. Check your connection and try again.`,
  toastDone: (n, name) => (n === 1 ? `${name} uploaded.` : `${n} files uploaded.`),
  stamp: 'Received',
  stampDetail: (n, size) => `${n === 1 ? '1 file' : `${n} files`}, ${size}`,
};

export const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_BYTES = 10 * 1024 * 1024;

/** "2.4 MB", "640 KB", "12 bytes": one decimal above a megabyte, Indian digit grouping. */
export function formatBytes(n) {
  const f = (v, d) => v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
  if (n >= 1024 * 1024) return `${f(n / (1024 * 1024), 1)} MB`;
  if (n >= 1024) return `${f(Math.round(n / 1024), 0)} KB`;
  return `${n} ${n === 1 ? 'byte' : 'bytes'}`;
}

/** Pure: split chosen files into those we take and a note about the rest (or ''). */
export function vet(files, { maxBytes = MAX_BYTES, accept = ACCEPT } = {}) {
  const ok = [], big = [], wrong = [];
  for (const f of files) {
    if (accept.length && !accept.includes(f.type)) wrong.push(f);
    else if (f.size > maxBytes) big.push(f);
    else ok.push(f);
  }
  const max = formatBytes(maxBytes);
  const note = [
    big.length === 1 ? STRINGS.tooLarge(big[0].name, formatBytes(big[0].size), max) : big.length ? STRINGS.tooLargeMany(big.length, max) : '',
    ...wrong.map(f => STRINGS.wrongType(f.name)),
  ].filter(Boolean).join(' ');
  return { ok, rejected: [...big, ...wrong], note };
}

/**
 * A progress bar's value and max for one file. The max is the file's bytes plus
 * one step for the server's check, so a bar reaches its end, and the warm kolam
 * closes, only when the server has said the file is safe, never when the last
 * byte has merely left.
 */
export function barFor(file) {
  const max = file.size + 1;
  if (file.status === 'done') return { value: max, max };
  return { value: Math.min(file.loaded, file.size), max };
}

/**
 * The upload session: files, the transport's events, and what the page must do
 * next. `transport` is { start(file, at) => id, poll(now) => events, busy() }.
 */
export function createUploadSession({ transport, maxBytes = MAX_BYTES, accept = ACCEPT } = {}) {
  const files = [];
  let note = '', announced = 0;
  const byId = new Map();

  function begin(f, at) {
    f.status = 'uploading'; f.loaded = 0;
    f.id = transport.start({ name: f.name, size: f.size }, at);
    byId.set(f.id, f);
  }

  /** Add chosen files at `at`. Returns the note for the field (empty when all were taken). */
  function add(chosen, at) {
    const v = vet(chosen, { maxBytes, accept });
    for (const c of v.ok) {
      const f = { key: `${c.name}:${files.length}`, name: c.name, size: c.size, type: c.type, status: 'queued', loaded: 0, id: null };
      files.push(f);
      begin(f, at);
    }
    note = v.note;
    return note;
  }

  /** Start a failed file again. */
  function retry(key, at) {
    const f = files.find(x => x.key === key);
    if (f && f.status === 'failed') { byId.delete(f.id); begin(f, at); }
  }

  /** Apply everything the transport has reported by `now`. Returns what the page should say. */
  function tick(now) {
    const effects = [];
    for (const e of transport.poll(now)) {
      const f = byId.get(e.id);
      if (!f) continue;
      if (e.type === 'progress') { f.loaded = e.loaded; f.status = e.loaded >= f.size ? 'checking' : 'uploading'; }
      else if (e.type === 'done') { f.loaded = f.size; f.status = 'done'; }
      else if (e.type === 'failed') { f.loaded = e.loaded; f.status = 'failed'; effects.push({ type: 'toast', tone: 'error', message: STRINGS.toastFailed(f.name), retry: f.key, name: f.name }); }
    }
    // One success toast each time everything chosen so far has arrived.
    const done = files.filter(f => f.status === 'done');
    if (files.length && done.length === files.length && done.length > announced) {
      effects.push({ type: 'toast', tone: 'success', message: STRINGS.toastDone(done.length - announced, done.at(-1).name) });
      announced = done.length;
    }
    return effects;
  }

  /** Plain data for the page. */
  function view() {
    const done = files.filter(f => f.status === 'done');
    const all = files.length > 0 && done.length === files.length;
    return {
      empty: files.length === 0,
      note,
      busy: transport.busy(),
      rows: files.map(f => {
        const size = formatBytes(f.size);
        const label = f.status === 'failed' ? STRINGS.failedRow(f.name, size) : f.status === 'checking' ? STRINGS.checking(f.name, size) : STRINGS.row(f.name, size);
        return { key: f.key, name: f.name, status: f.status, label, ...barFor(f) };
      }),
      stamp: { show: all, detail: all ? STRINGS.stampDetail(done.length, formatBytes(done.reduce((s, f) => s + f.size, 0))) : '' },
    };
  }

  return { add, retry, tick, view, files };
}
