// Folio build: the pure parts. No file system, no browser; tested in Node.

/** "12.4 KB", "1.20 MB": sizes the way people read them. */
export function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/** "3MB", "1.5 MB", "800KB", or a plain number of bytes. */
export function parseSize(s) {
  const m = /^\s*([\d.]+)\s*(b|kb|mb)?\s*$/i.exec(String(s));
  if (!m) throw new Error(`Couldn't read the size "${s}". Write it like 1.5MB or 800KB.`);
  const k = { b: 1, kb: 1024, mb: 1024 * 1024 }[(m[2] || 'b').toLowerCase()];
  return Math.round(parseFloat(m[1]) * k);
}

/** Parse a CSS unicode-range ("U+0000-02FF, U+0304") into [from, to] pairs. */
export function parseUnicodeRange(s) {
  return String(s).split(',').map(t => t.trim()).filter(Boolean).map(t => {
    const m = /^U\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i.exec(t);
    if (!m) return null;
    if (m[1].includes('?')) return [parseInt(m[1].replace(/\?/g, '0'), 16), parseInt(m[1].replace(/\?/g, 'f'), 16)];
    const a = parseInt(m[1], 16);
    return [a, m[2] ? parseInt(m[2], 16) : a];
  }).filter(Boolean);
}

/** The characters of `text` that fall inside the ranges, as a string of unique code points. */
export function charsIn(text, ranges) {
  const out = new Set();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (ranges.some(([a, b]) => cp >= a && cp <= b)) out.add(ch);
  }
  return [...out].sort().join('');
}

/** Every @font-face block in a stylesheet, with its descriptors. */
export function parseFontFaces(css) {
  const faces = [];
  const re = /@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const body = m[1], get = k => new RegExp(`${k}\\s*:\\s*([^;]+)`, 'i').exec(body)?.[1].trim() ?? '';
    const src = /url\(\s*(['"]?)([^'")]+)\1\s*\)/i.exec(get('src'))?.[2] ?? '';
    const weight = get('font-weight') || '400';
    const [w0, w1 = w0] = weight.split(/\s+/).map(Number);
    faces.push({
      block: m[0], start: m.index, end: m.index + m[0].length,
      family: get('font-family').replace(/^['"]|['"]$/g, ''),
      style: get('font-style') || 'normal',
      weight: [w0, w1],
      src,
      ranges: get('unicode-range') ? parseUnicodeRange(get('unicode-range')) : [[0, 0x10ffff]],
    });
  }
  return faces;
}

/**
 * Does a face serve text set in this family, weight and style? A face serves
 * its own weight range; when no face of the family covers a weight, the browser
 * takes the nearest, so the nearest is kept too (see pickFaces).
 */
export function pickFaces(faces, used) {
  const keep = new Set();
  for (const u of used) {
    const fam = faces.filter(f => f.family.toLowerCase() === u.family.toLowerCase() && f.style === (u.style === 'italic' ? 'italic' : 'normal'));
    if (!fam.length) continue;
    const covering = fam.filter(f => u.weight >= f.weight[0] && u.weight <= f.weight[1]);
    if (covering.length) covering.forEach(f => keep.add(f));
    else {
      const d = f => Math.min(Math.abs(u.weight - f.weight[0]), Math.abs(u.weight - f.weight[1]));
      const best = Math.min(...fam.map(d));
      fam.filter(f => d(f) === best).forEach(f => keep.add(f));
    }
  }
  return [...keep];
}

/** Every url(...) in a stylesheet, with where it sits, skipping data: and remote URLs. */
export function cssUrls(css) {
  const out = [];
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  let m;
  while ((m = re.exec(css))) {
    const url = m[2].trim();
    if (/^(data:|blob:|#)/i.test(url)) continue;
    out.push({ url, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** @import rules in a stylesheet (url() or a plain string). */
export function cssImports(css) {
  const out = [];
  const re = /@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1\s*\)?[^;]*;/g;
  let m;
  while ((m = re.exec(css))) out.push({ url: m[2], start: m.index, end: m.index + m[0].length });
  return out;
}

/** Replace spans in a string, given [{ start, end, text }]. */
export function splice(s, edits) {
  let out = '', at = 0;
  for (const e of [...edits].sort((a, b) => a.start - b.start)) { out += s.slice(at, e.start) + e.text; at = e.end; }
  return out + s.slice(at);
}

/** A remote URL a sealed document must not load. */
export const isRemote = url => /^(https?:)?\/\//i.test(url);

/**
 * The heavy-parts table: every inlined part, largest first, with its share,
 * and whether the document is inside its budget.
 * @param {{ kind: string, name: string, bytes: number }[]} parts
 */
export function budgetReport(parts, total, budget) {
  const rows = [...parts].sort((a, b) => b.bytes - a.bytes);
  const w = Math.max(10, ...rows.map(r => r.name.length));
  const lines = [
    `${'part'.padEnd(w)}  ${'kind'.padEnd(6)}  ${'size'.padStart(10)}  share`,
    ...rows.map(r => `${r.name.padEnd(w)}  ${r.kind.padEnd(6)}  ${formatBytes(r.bytes).padStart(10)}  ${((r.bytes / total) * 100).toFixed(1).padStart(5)}%`),
    `${'total'.padEnd(w)}  ${''.padEnd(6)}  ${formatBytes(total).padStart(10)}  of a ${formatBytes(budget)} budget`,
  ];
  return { ok: total <= budget, table: lines.join('\n'), rows };
}

/** Escape text for an HTML text node or attribute. */
export const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Make script source safe inside an inline <script>. */
export const safeScript = js => js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

/** Make CSS safe inside an inline <style>. */
export const safeStyle = css => css.replace(/<\/(style)/gi, '<\\/$1');

/**
 * Which face draws each character, the way a browser picks: for every run of
 * text (its font-family stack, weight and style), each character goes to the
 * first family in the stack with a face that covers it. Generic families
 * (serif, system-ui) have no face here and are skipped.
 * @param {ReturnType<typeof parseFontFaces>} faces
 * @param {{ stack: string[], weight: number, style: string, text: string }[]} runs
 * @returns {Map<object, Set<string>>} face -> the characters it draws
 */
export function assignChars(faces, runs) {
  const out = new Map();
  const served = (family, weight, style) => {
    const fam = faces.filter(f => f.family.toLowerCase() === family.toLowerCase() && f.style === (style === 'italic' ? 'italic' : 'normal'));
    if (!fam.length) return [];
    const covering = fam.filter(f => weight >= f.weight[0] && weight <= f.weight[1]);
    if (covering.length) return covering;
    const d = f => Math.min(Math.abs(weight - f.weight[0]), Math.abs(weight - f.weight[1]));
    const best = Math.min(...fam.map(d));
    return fam.filter(f => d(f) === best);
  };
  for (const run of runs) {
    const candidates = run.stack.map(fam => served(fam, run.weight, run.style));
    for (const ch of new Set(run.text)) {
      if (/\s/.test(ch)) continue;
      const cp = ch.codePointAt(0);
      for (const list of candidates) {
        const face = list.find(f => f.ranges.some(([a, b]) => cp >= a && cp <= b));
        if (face) { if (!out.has(face)) out.set(face, new Set()); out.get(face).add(ch); break; }
      }
    }
  }
  return out;
}
