// Strip comments from JavaScript source, for the "code without comments" size that
// decision 0002 asks the registry to report next to the full source size.
// A small scanner, not a parser: it knows strings, template literals (with nested ${}),
// regex literals (by the usual previous-token rule), line and block comments.
// Blank lines and trailing spaces left behind are dropped too.

const REGEX_AFTER = /[(,=:[!&|?{};+\-*%<>~^]$|^$|\b(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

/** @param {string} src @returns {string} */
export function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const braces = []; // for each open template ${, the brace depth to return at
  let depth = 0;

  const lastSignificant = () => {
    const t = out.replace(/\s+$/, '');
    const m = t.match(/[A-Za-z_$][\w$]*$/);
    return m ? m[0] : t.slice(-1);
  };

  const template = () => { // i is just past a backtick, or just past a closing } of ${ }
    while (i < n) {
      const c = src[i];
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === '`') { out += c; i++; return; }
      if (c === '$' && src[i + 1] === '{') { out += '${'; i += 2; braces.push(depth); depth++; return; }
      out += c; i++;
    }
  };

  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      out += ' ';
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '`') { out += c; i++; template(); continue; }
    if (c === '{') { depth++; out += c; i++; continue; }
    if (c === '}') {
      depth--;
      out += c; i++;
      if (braces.length && braces.at(-1) === depth) { braces.pop(); template(); }
      continue;
    }
    if (c === '/' && REGEX_AFTER.test(lastSignificant())) {
      let j = i + 1, inClass = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) break;
        j++;
      }
      j++;
      while (j < n && /[a-z]/.test(src[j])) j++;
      out += src.slice(i, j); i = j; continue;
    }
    out += c; i++;
  }
  return out.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.length).join('\n') + '\n';
}
