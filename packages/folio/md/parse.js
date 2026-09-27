// Folio Markdown: the parser. Pure, no dependencies, runs in Node.
//
// A CommonMark-ish subset: ATX and setext headings, paragraphs, block quotes,
// ordered and unordered lists (nested, tight or loose), fenced code, pipe
// tables with alignment, thematic breaks, raw HTML blocks; inline emphasis,
// strong, code spans, links, images, autolinks, escapes and hard breaks.
// Plus directives: leaf `::name[label]{attrs}` and container
// `:::name[label]{attrs}` ... `:::` (nest with more colons).
//
// Every block keeps the line it started on, so errors can say where.

export class MarkdownError extends Error {
  /** @param {{ line: number, message: string }[]} problems */
  constructor(problems) {
    super(problems.map(p => `line ${p.line}: ${p.message}`).join('\n'));
    this.name = 'MarkdownError';
    this.problems = problems;
  }
}

// ── directive attributes: {key=value key="quoted" #id .class flag} ──────────

/** Parse `{...}` into { attrs, id, classes }, or throw a plain message. */
export function parseAttrs(src) {
  const out = { attrs: {}, id: null, classes: [] };
  if (!src) return out;
  const s = src.trim().replace(/^\{|\}$/g, '');
  const re = /\s*(?:#([\w-]+)|\.([\w-]+)|([a-zA-Z][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'}]+)))?)/y;
  let at = 0;
  while (at < s.length) {
    if (/^\s*$/.test(s.slice(at))) break;
    re.lastIndex = at;
    const m = re.exec(s);
    if (!m || m[0].length === 0) {
      const rest = s.slice(at).trim();
      throw new Error(/^[a-zA-Z][\w-]*\s*=\s*["']/.test(rest) ? `a quoted value is not closed in {${s}}` : `couldn't read "${rest}" in {${s}}. Write attributes as key=value, key="a value", #id or .class`);
    }
    at = re.lastIndex;
    if (m[3] && m[4] == null && m[5] == null && m[6] == null && /^\s*=/.test(s.slice(at))) {
      // a key followed by = whose value could not be read
      throw new Error(/^\s*=\s*["']/.test(s.slice(at)) ? `the quoted value of ${m[3]} is not closed in {${s}}` : `couldn't read the value of ${m[3]} in {${s}}. Write attributes as key=value, key="a value", #id or .class`);
    }
    if (m[1]) out.id = m[1];
    else if (m[2]) out.classes.push(m[2]);
    else out.attrs[m[3]] = m[4] ?? m[5] ?? m[6] ?? true;
  }
  return out;
}

// ::name[label]{attrs}; writers also put the label after the attributes, so both orders work
const DIRECTIVE = /^(:{2,})([a-z][\w-]*)(?:\[([^\]]*)\])?(\{.*?\})?(?:\[([^\]]*)\])?\s*$/;

// ── inline ───────────────────────────────────────────────────────────────

export const escapeHtml = s => String(s).replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escapeText = s => String(s).replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const safeUrl = u => (/^\s*(javascript|vbscript|data:text\/html)/i.test(u) ? '#' : u);

/**
 * Inline Markdown to HTML. Code spans, autolinks, images and links are taken
 * out first (as placeholders), so emphasis inside them is left alone.
 */
export function inline(text) {
  const held = [];
  const hold = html => `\u0000${held.push(html) - 1}\u0000`;
  let s = text;
  // escapes
  s = s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, (_, c) => hold(escapeText(c)));
  // hard breaks: backslash or two spaces at the end of a line
  s = s.replace(/(?: {2,}|\\)\n/g, () => hold('<br>\n'));
  // code spans
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, ticks, code) => hold(`<code>${escapeText(code.replace(/^ (.*) $/s, '$1'))}</code>`));
  // autolinks
  s = s.replace(/<((?:https?|mailto):[^\s<>]+)>/gi, (_, u) => hold(`<a href="${escapeHtml(u)}">${escapeText(u.replace(/^mailto:/i, ''))}</a>`));
  // images and links, with balanced brackets in the text
  s = replaceLinks(s, hold);
  s = escapeText(s);
  // strong, then emphasis; underscores only at word boundaries
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?![\w])/g, '$1<strong>$2</strong>')
    .replace(/\*(?=[^\s*])([\s\S]*?[^\s*])\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=\S)([\s\S]*?\S)_(?![\w])/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => held[+i]).replace(/\u0000(\d+)\u0000/g, (_, i) => held[+i]);
}

function replaceLinks(s, hold) {
  let out = '', i = 0;
  while (i < s.length) {
    const img = s[i] === '!' && s[i + 1] === '[';
    if (s[i] !== '[' && !img) { out += s[i++]; continue; }
    const open = img ? i + 1 : i;
    let depth = 0, j = open;
    for (; j < s.length; j++) {
      if (s[j] === '[') depth++;
      else if (s[j] === ']' && --depth === 0) break;
    }
    const d = j < s.length ? destination(s, j + 1) : null;
    if (!d) { out += s[i++]; continue; }
    const label = s.slice(open + 1, j), url = safeUrl(d.url), title = d.title != null ? ` title="${escapeHtml(d.title)}"` : '';
    out += hold(img
      ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(label.replace(/[*_`]/g, ''))}"${title}>`
      : `<a href="${escapeHtml(url)}"${title}>${inline(label)}</a>`);
    i = d.end;
  }
  return out;
}

/**
 * A link destination starting at `(`: `<url>` or a url with balanced
 * parentheses, then an optional "title". Returns { url, title, end } or null.
 */
function destination(s, at) {
  if (s[at] !== '(') return null;
  let k = at + 1;
  while (s[k] === ' ') k++;
  let url = '';
  if (s[k] === '<') {
    const close = s.indexOf('>', k);
    if (close < 0) return null;
    url = s.slice(k + 1, close); k = close + 1;
  } else {
    let depth = 0;
    for (; k < s.length; k++) {
      const c = s[k];
      if (c === ' ' || c === '\n') break;
      if (c === '(') depth++;
      else if (c === ')') { if (depth === 0) break; depth--; }
      url += c;
    }
  }
  while (s[k] === ' ') k++;
  let title = null;
  if (s[k] === '"') {
    const close = s.indexOf('"', k + 1);
    if (close < 0) return null;
    title = s.slice(k + 1, close); k = close + 1;
    while (s[k] === ' ') k++;
  }
  return s[k] === ')' ? { url, title, end: k + 1 } : null;
}

// ── blocks ───────────────────────────────────────────────────────────────

const BLANK = /^\s*$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const FENCE = /^( {0,3})(`{3,}|~{3,})\s*([^`]*)$/;
const QUOTE = /^ {0,3}> ?/;
const ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/;
const HTML_BLOCK = /^ {0,3}<(?:!--|\/?[a-zA-Z][\w-]*[\s/>]|\/?[a-zA-Z][\w-]*$)/;
const TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

/** Does this line start a block that ends a paragraph? */
const interrupts = (l, next) => ATX.test(l) || HR.test(l) || FENCE.test(l) || QUOTE.test(l) || DIRECTIVE.test(l.trim())
  || HTML_BLOCK.test(l) || (/^ {0,3}([-*+]|1[.)])[ \t]+\S/.test(l)) || (l.includes('|') && next != null && TABLE_SEP.test(next) && next.includes('-'));

const splitRow = l => {
  const cells = [];
  let cur = '', code = false;
  const t = l.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '\\' && t[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '`') code = !code;
    if (c === '|' && !code) { cells.push(cur.trim()); cur = ''; } else cur += c;
  }
  cells.push(cur.trim());
  return cells;
};

/**
 * Parse lines ({ text, line }) into block nodes. Problems (bad directives,
 * unclosed containers) are pushed to `problems`, never thrown here.
 */
export function blocks(lines, problems) {
  const out = [];
  let i = 0;
  const at = k => lines[k]?.text;
  while (i < lines.length) {
    const { text: l, line } = lines[i];
    if (BLANK.test(l)) { i++; continue; }

    // fenced code
    let m = FENCE.exec(l);
    if (m) {
      const [, indent, fence, info] = m, body = [];
      let j = i + 1, closed = false;
      for (; j < lines.length; j++) {
        if (new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`).test(at(j))) { closed = true; break; }
        body.push(at(j).replace(new RegExp(`^ {0,${indent.length}}`), ''));
      }
      if (!closed) problems.push({ line, message: `this code block is not closed. Add a line with ${fence} after it.` });
      out.push({ type: 'code', lang: info.trim().split(/\s+/)[0] || '', text: body.join('\n'), line });
      i = closed ? j + 1 : j;
      continue;
    }

    // directives
    m = DIRECTIVE.exec(l.trim());
    if (m) {
      const [, colons, name, labelFirst, attrSrc, labelAfter] = m;
      const label = labelFirst ?? labelAfter;
      let parsed = { attrs: {}, id: null, classes: [] };
      try { parsed = parseAttrs(attrSrc); } catch (e) { problems.push({ line, message: `::${name}: ${e.message}` }); }
      if (colons.length === 2) { out.push({ type: 'directive', kind: 'leaf', name, label: label ?? null, ...parsed, line }); i++; continue; }
      const body = [];
      let j = i + 1, closed = false;
      for (; j < lines.length; j++) {
        if (new RegExp(`^\\s*:{${colons.length}}\\s*$`).test(at(j))) { closed = true; break; }
        body.push(lines[j]);
      }
      if (!closed) problems.push({ line, message: `:::${name} is not closed. Add a line with ${colons} after its content (nested containers use more colons).` });
      out.push({ type: 'directive', kind: 'container', name, label: label ?? null, ...parsed, lines: body, line });
      i = closed ? j + 1 : j;
      continue;
    }

    // ATX heading
    m = ATX.exec(l);
    if (m) { out.push({ type: 'heading', level: m[1].length, text: (m[2] ?? '').trim(), line }); i++; continue; }

    // thematic break
    if (HR.test(l)) { out.push({ type: 'hr', line }); i++; continue; }

    // block quote
    if (QUOTE.test(l)) {
      const inner = [];
      let j = i;
      while (j < lines.length && !BLANK.test(at(j)) && (QUOTE.test(at(j)) || (inner.length && !interrupts(at(j))))) {
        inner.push({ text: at(j).replace(QUOTE, ''), line: lines[j].line });
        j++;
      }
      out.push({ type: 'quote', children: blocks(inner, problems), line });
      i = j;
      continue;
    }

    // list
    m = ITEM.exec(l);
    if (m) { i = list(lines, i, out, problems); continue; }

    // raw HTML block
    if (HTML_BLOCK.test(l)) {
      const body = [];
      let j = i;
      while (j < lines.length && !BLANK.test(at(j))) body.push(at(j++));
      out.push({ type: 'html', text: body.join('\n'), line });
      i = j;
      continue;
    }

    // table
    if (l.includes('|') && at(i + 1) != null && TABLE_SEP.test(at(i + 1)) && at(i + 1).includes('-')) {
      const head = splitRow(l), align = splitRow(at(i + 1)).map(c => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null));
      if (align.length !== head.length) problems.push({ line: line + 1, message: `the table's second line has ${align.length} columns and its heading has ${head.length}. Give them the same number of | separators.` });
      const rows = [];
      let j = i + 2;
      while (j < lines.length && !BLANK.test(at(j)) && at(j).includes('|')) rows.push(splitRow(at(j++)));
      out.push({ type: 'table', head, align, rows, line });
      i = j;
      continue;
    }

    // paragraph (or a setext heading); trailing spaces stay until inline() has seen any hard breaks
    const para = [l.replace(/^\s+/, '')];
    let j = i + 1;
    while (j < lines.length && !BLANK.test(at(j))) {
      if (/^ {0,3}=+\s*$/.test(at(j)) || /^ {0,3}-+\s*$/.test(at(j))) break;
      if (interrupts(at(j), at(j + 1))) break;
      para.push(at(j).replace(/^\s+/, ''));
      j++;
    }
    if (j < lines.length && /^ {0,3}(=+|-+)\s*$/.test(at(j)) && !BLANK.test(at(j))) {
      out.push({ type: 'heading', level: at(j).trim()[0] === '=' ? 1 : 2, text: para.join(' '), line });
      i = j + 1;
      continue;
    }
    out.push({ type: 'paragraph', text: para.join('\n').trimEnd(), line });
    i = j;
  }
  return out;
}

/** Lists: items of one kind at one indent; each item's lines are parsed as blocks. */
function list(lines, start, out, problems) {
  const first = ITEM.exec(lines[start].text);
  const ordered = /\d/.test(first[2]), delim = first[2].slice(-1), indent = first[1].length;
  const node = { type: 'list', ordered, start: ordered ? parseInt(first[2], 10) : null, items: [], loose: false, line: lines[start].line };
  let i = start, sawBlank = false;
  while (i < lines.length) {
    const m = ITEM.exec(lines[i].text);
    if (!m || m[1].length !== indent || /\d/.test(m[2]) !== ordered || m[2].slice(-1) !== delim && ordered || (!ordered && m[2] !== first[2])) break;
    if (sawBlank) node.loose = true;
    const content = m[1].length + m[2].length + Math.min(Math.max(m[3].length, 1), 4);
    const itemLines = [{ text: m[4], line: lines[i].line }];
    let j = i + 1, blankInside = false;
    for (; j < lines.length; j++) {
      const t = lines[j].text;
      if (BLANK.test(t)) { itemLines.push({ text: '', line: lines[j].line }); continue; }
      const lead = t.match(/^ */)[0].length;
      const prevBlank = BLANK.test(lines[j - 1].text);
      if (lead >= content) { if (prevBlank) blankInside = true; itemLines.push({ text: t.slice(content), line: lines[j].line }); continue; }
      if (!prevBlank && !interrupts(t) && !ITEM.test(t)) { itemLines.push({ text: t.trim(), line: lines[j].line }); continue; } // lazy continuation
      break;
    }
    // trailing blank lines belong between items, not inside this one
    let k = itemLines.length;
    while (k > 1 && BLANK.test(itemLines[k - 1].text)) k--;
    sawBlank = k < itemLines.length;
    const itemBlocks = blocks(itemLines.slice(0, k), problems);
    if (blankInside && itemBlocks.length > 1) node.loose = true;
    node.items.push(itemBlocks);
    i = j;
  }
  out.push(node);
  return i;
}

/** Split source into numbered lines, dropping a front matter block at the top. */
export function source(src) {
  const all = String(src).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const front = {};
  let startAt = 0;
  if (all[0] === '---') {
    const end = all.indexOf('---', 1);
    if (end > 0) {
      for (const [k, raw] of all.slice(1, end).map(l => /^([\w-]+)\s*:\s*(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]])) front[k] = raw.replace(/^["']|["']$/g, '');
      startAt = end + 1;
    }
  }
  return { front, lines: all.slice(startAt).map((text, k) => ({ text, line: startAt + k + 1 })) };
}
