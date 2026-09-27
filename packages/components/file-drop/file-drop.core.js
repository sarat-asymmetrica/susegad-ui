// FileDrop: the pure half. Reading `accept` the way the browser does, sizes
// in words, sifting a set of files into kept and turned away, and every
// sentence a person reads. Runs in Node (files are plain { name, type, size }).

const NAMES = { pdf: 'PDF', jpg: 'JPG', jpeg: 'JPG', png: 'PNG', gif: 'GIF', webp: 'WebP', heic: 'HEIC', doc: 'Word file', docx: 'Word file', xls: 'Excel file', xlsx: 'Excel file', csv: 'CSV', txt: 'text', zip: 'zip' };
const KINDS = { image: 'an image', audio: 'an audio file', video: 'a video', text: 'a text file' };

/** Every word a person reads or hears. Kathakar owns these. */
export const STRINGS = {
  cue: multiple => (multiple ? 'Drop files here, or choose them' : 'Drop a file here, or choose one'),
  choose: multiple => (multiple ? 'Choose files' : 'Choose a file'),
  chosen: n => (n === 0 ? 'No file chosen yet' : n === 1 ? '1 file chosen' : `${n} files chosen`),
  type: (name, allowed) => `${name} isn’t ${allowed}, so it wasn’t added.`,
  size: (name, max) => `${name} is over ${max}, so it wasn’t added. Choose a smaller file.`,
  count: () => 'Only one file can go here, so the first one was kept.',
  remove: name => `Remove ${name}`,
  removed: name => `${name} removed.`,
};

/** "10 MB", "500KB", 1048576 → bytes; anything else → Infinity (no limit). */
export function parseSize(v) {
  if (typeof v === 'number') return v > 0 ? v : Infinity;
  const m = /^\s*([\d.]+)\s*(b|bytes?|kb|mb|gb)?\s*$/i.exec(String(v ?? ''));
  if (!m) return Infinity;
  const k = { kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[(m[2] || 'b').toLowerCase()] ?? 1;
  return Math.round(parseFloat(m[1]) * k);
}

const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
/** A size the way people say it: 850 KB, 2.4 MB. */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
  if (bytes < 1024 ** 2) return `${num.format(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${num.format(bytes / 1024 ** 2)} MB`;
  return `${num.format(bytes / 1024 ** 3)} GB`;
}

const tokens = accept => String(accept ?? '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

/** Does a file match an `accept` list, as the browser's picker reads it? Empty accepts anything. */
export function accepts(file, accept) {
  const list = tokens(accept);
  if (!list.length) return true;
  const name = file.name.toLowerCase(), type = (file.type || '').toLowerCase();
  return list.some(t => (t.startsWith('.') ? name.endsWith(t) : t.endsWith('/*') ? type.startsWith(t.slice(0, -1)) : type === t));
}

/** `accept` in words: ".pdf,image/jpeg" → "a PDF or JPG". */
export function describeAccept(accept) {
  const words = [...new Set(tokens(accept).map(t => {
    if (t.startsWith('.')) return NAMES[t.slice(1)] ?? t.slice(1).toUpperCase();
    if (t.endsWith('/*')) return KINDS[t.slice(0, -2)] ?? 'a file of that kind';
    const sub = t.split('/')[1] ?? t;
    return NAMES[sub] ?? sub.toUpperCase();
  }))];
  if (!words.length) return 'a file';
  const plain = words.filter(w => !/^an? /.test(w)), kinds = words.filter(w => /^an? /.test(w));
  const list = [plain.length ? `${/^[aeiou]/i.test(plain[0]) ? 'an' : 'a'} ${plain.join(', ').replace(/, ([^,]*)$/, ' or $1')}` : null, ...kinds].filter(Boolean);
  return list.join(' or ');
}

/**
 * Sort incoming files into those that can stay and those turned away, with a
 * sentence for each one turned away.
 * @param {{ name: string, type?: string, size: number }[]} files
 * @returns {{ kept: number[], messages: string[] }} kept holds indices into files
 */
export function sift(files, { accept = '', maxSize = Infinity, multiple = false } = {}) {
  const kept = [], messages = [], allowed = describeAccept(accept), max = formatSize(maxSize);
  files.forEach((f, i) => {
    if (!accepts(f, accept)) messages.push(STRINGS.type(f.name, allowed));
    else if (f.size > maxSize) messages.push(STRINGS.size(f.name, max));
    else kept.push(i);
  });
  if (!multiple && kept.length > 1) { kept.length = 1; messages.push(STRINGS.count()); }
  return { kept, messages };
}
