// The mutant-rot guard's pure core. A browser check proves it can fail by planting a fault: it serves a target file
// with one string replaced (a needle), or patches it through a `--break` table. When someone rewrites the line a
// needle points at, the replace quietly does nothing and the planted fault is gone: the check still "goes red under
// --break" only in its comments. This module reads a check's source (no browser, no import of the check) and finds
// every needle-style mutation in it, so a Node test can assert each needle still occurs in its target.
//
// What it recognises:
//   - `.replace(LIT, …)` / `.replaceAll(LIT, …)` on a file body: inside a table row whose first element names the
//     file (`[/stage-element\.js$/, s => s.replace(…)]`), or on a receiver that holds a body (`s`, `src`, `body`, …);
//   - an identifier needle defined once as a literal in the same file (`const from = '…'; src.replace(from, …)`);
//   - a `[file, from, to]` row (`['packages/x/y.js', 'from', 'to']`, or `['css', 'from', 'to']` with a kind);
//   - `[from, to]` pairs inside a patch: `patch: [[from, to]]`, or `{ 'model.js': [[from, to]] }`.
// What it cannot see (a needle computed at run time, or a body replaced through a variable it can't resolve) it
// returns as `computed`, with the line and the call's text, for the caller to hold against an allowlist.

const PUNCT_BEFORE_REGEX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '=>', '&&', '||', '??', '...', '==', '===', '!=', '!==']);
const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await']);
const MULTI = ['===', '!==', '...', '=>', '==', '!=', '&&', '||', '??', '?.', '<=', '>=', '+=', '-=', '++', '--'];

/** Decode the escapes of a JS string body (the part between the quotes). */
export function unescapeJs(s) {
  return s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r\n|[\s\S])/g, (_, e) => {
    if (e[0] === 'u') return String.fromCodePoint(parseInt(e[1] === '{' ? e.slice(2, -1) : e.slice(1), 16));
    if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e === '\n' || e === '\r\n' || e === '\r') return '';
    return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }[e] ?? e;
  });
}

/**
 * Tokens of a JS module, enough to find calls and literals: strings (decoded), templates (decoded when they hold no
 * `${}`), regex literals, identifiers, numbers and punctuation. Comments are dropped.
 * @returns {{t: 'str'|'tpl'|'re'|'id'|'num'|'p', v: string, flags?: string, dyn?: boolean, start: number, end: number, line: number}[]}
 */
export function lex(src) {
  const out = [];
  let i = 0, line = 1;
  const lineAt = (() => { const starts = [0]; for (let k = 0; k < src.length; k++) if (src[k] === '\n') starts.push(k + 1); return pos => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; } return lo + 1; }; })();
  const prevSig = () => out[out.length - 1];
  const regexAllowed = () => {
    const p = prevSig();
    if (!p) return true;
    if (p.t === 'p') return PUNCT_BEFORE_REGEX.has(p.v) && p.v !== ')' && p.v !== ']';
    if (p.t === 'id') return KEYWORDS_BEFORE_REGEX.has(p.v);
    return false;
  };
  // A template literal starting at src[i] === '`'; nested `${}` are skipped by brace depth, honouring strings inside.
  const readTemplate = () => {
    const start = i; i++;
    let dyn = false, raw = '';
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') { raw += src.slice(i, i + 2); i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') { dyn = true; i += 2; skipBraces(); continue; }
      raw += src[i++];
    }
    i++;
    return { t: 'tpl', v: dyn ? null : unescapeJs(raw), dyn, start, end: i, line: lineAt(start) };
  };
  const skipQuoted = q => { i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; };
  const skipBraces = () => {
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '{') { depth++; i++; } else if (c === '}') { if (depth === 0) { i++; return; } depth--; i++; } else if (c === '"' || c === "'") skipQuoted(c);
      else if (c === '`') readTemplate();
      else i++;
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    const start = i;
    if (c === '"' || c === "'") { skipQuoted(c); out.push({ t: 'str', v: unescapeJs(src.slice(start + 1, i - 1)), start, end: i, line: lineAt(start) }); continue; }
    if (c === '`') { out.push(readTemplate()); continue; }
    if (c === '/' && regexAllowed()) {
      i++; let inClass = false;
      while (i < src.length && (inClass || src[i] !== '/')) { if (src[i] === '\\') i++; else if (src[i] === '[') inClass = true; else if (src[i] === ']') inClass = false; i++; }
      const body = src.slice(start + 1, i); i++;
      const f = /^[a-z]*/.exec(src.slice(i))[0]; i += f.length;
      out.push({ t: 're', v: body, flags: f, start, end: i, line: lineAt(start) });
      continue;
    }
    if (/[A-Za-z_$#]/.test(c)) { while (i < src.length && /[\w$#]/.test(src[i])) i++; out.push({ t: 'id', v: src.slice(start, i), start, end: i, line: lineAt(start) }); continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) { while (i < src.length && /[\w.]/.test(src[i])) i++; out.push({ t: 'num', v: src.slice(start, i), start, end: i, line: lineAt(start) }); continue; }
    const m = MULTI.find(s => src.startsWith(s, i));
    i += m ? m.length : 1;
    out.push({ t: 'p', v: m ?? c, start, end: i, line: lineAt(start) });
  }
  return out;
}

const OPEN = { '(': ')', '[': ']', '{': '}' };
const CLOSE = { ')': '(', ']': '[', '}': '{' };
const isLit = tok => tok && (tok.t === 'str' || tok.t === 're' || (tok.t === 'tpl' && !tok.dyn));
const PATHLIKE = /\.(m?js|css|html|json|svg)$/;
const KINDS = new Set(['css', 'js', 'html', 'svg', 'json']);
// Receivers that hold a file's body (or a page built from one). A replace on anything else is reading text, not
// planting a fault: `textContent.replace(/\s+/g, ' ')`.
const BODY_RECEIVER = /^(s|src|source|body|css|html|h|hand|cut|code|js|text)$|\.text\(\)\)?$|readFileSync\(|^\(await (res|r|response)\.text\(\)\)$/;

/** Group a token list into its matching brackets: match[i] is the index of the partner of bracket token i. */
function matchBrackets(toks) {
  const match = new Array(toks.length).fill(-1), stack = [];
  toks.forEach((tok, i) => {
    if (tok.t !== 'p') return;
    if (OPEN[tok.v]) stack.push(i);
    else if (CLOSE[tok.v]) { const j = stack.pop(); if (j !== undefined) { match[i] = j; match[j] = i; } }
  });
  return match;
}

/** The top-level elements of the bracket opened at token `o`: arrays of token indices. */
function elements(toks, match, o) {
  const els = [[]];
  for (let k = o + 1; k < match[o]; k++) {
    const tok = toks[k];
    if (tok.t === 'p' && OPEN[tok.v]) { for (let j = k; j <= match[k]; j++) els[els.length - 1].push(j); k = match[k]; continue; }
    if (tok.t === 'p' && tok.v === ',') { els.push([]); continue; }
    els[els.length - 1].push(k);
  }
  return els.filter(e => e.length);
}

/** The expression text before a `.method(` call at token `dot`: walks back over identifiers, dots and bracket groups. */
function receiver(src, toks, match, dot) {
  let k = dot - 1;
  while (k >= 0) {
    const tok = toks[k];
    if (tok.t === 'p' && (tok.v === ')' || tok.v === ']') && match[k] >= 0) { k = match[k] - 1; continue; }
    if (tok.t === 'id' || tok.t === 'str' || tok.t === 'tpl' || tok.t === 're') {
      if (k > 0 && toks[k - 1].t === 'p' && (toks[k - 1].v === '.' || toks[k - 1].v === '?.')) { k -= 2; continue; }
      break;
    }
    k++; break;
  }
  k = Math.max(0, k);
  return src.slice(toks[k].start, toks[dot].start).replace(/\s+/g, ' ').trim();
}

const needleOf = tok => (tok.t === 're' ? { kind: 're', value: tok.v, flags: tok.flags } : { kind: 'str', value: tok.v });
const specOf = tok => (!tok ? null : tok.t === 're' ? { kind: 're', value: tok.v, flags: tok.flags } : tok.t === 'str' && (PATHLIKE.test(tok.v) || KINDS.has(tok.v)) ? { kind: PATHLIKE.test(tok.v) ? 'path' : 'kind', value: tok.v } : null);

/**
 * Every needle-style mutation in a check's source.
 * @returns {{mutations: {line: number, via: string, needle: {kind: 'str'|'re', value: string, flags?: string}, spec: object|null, expect: 'once'|'some', text: string}[], computed: {line: number, text: string}[]}}
 */
export function findMutations(src) {
  const toks = lex(src), match = matchBrackets(toks);
  // Identifiers bound once to a literal: `const from = '…'` (or `, bug = '…'` in the same declaration).
  const literals = new Map(), rebound = new Set();
  toks.forEach((tok, i) => {
    if (tok.t !== 'id' || toks[i + 1]?.v !== '=' || toks[i + 1]?.t !== 'p') return;
    const prev = toks[i - 1];
    if (!(prev && (prev.v === 'const' || prev.v === 'let' || prev.v === ',') )) return;
    const val = toks[i + 2], after = toks[i + 3];
    if (isLit(val) && after && after.t === 'p' && [',', ';', ')', '}'].includes(after.v)) { if (literals.has(tok.v)) rebound.add(tok.v); literals.set(tok.v, val); }
  });
  for (const r of rebound) literals.delete(r);

  // For each token, the innermost enclosing `[`.
  const parents = new Array(toks.length).fill(-1), stack = [];
  toks.forEach((tok, i) => {
    parents[i] = stack.length ? stack[stack.length - 1] : -1;
    if (tok.t === 'p' && OPEN[tok.v]) stack.push(i);
    else if (tok.t === 'p' && CLOSE[tok.v]) stack.pop();
  });
  const enclosingRowSpec = i => {
    for (let o = parents[i]; o >= 0; o = parents[o]) {
      if (toks[o].v !== '[') continue;
      const first = elements(toks, match, o)[0];
      if (first && first.length === 1 && first[0] !== i) { const s = specOf(toks[first[0]]); if (s) return s; }
    }
    return null;
  };
  // The key in front of a bracket: `key: [` or `'model.js': [`.
  const keyOf = o => (toks[o - 1]?.v === ':' && toks[o - 1]?.t === 'p' ? toks[o - 2] : null);
  const lineText = i => src.slice(src.lastIndexOf('\n', toks[i].start) + 1, src.indexOf('\n', toks[i].start) >>> 0).trim();

  const mutations = [], computed = [], seen = new Set();
  const add = m => { const key = `${m.line}:${m.needle.kind}:${m.needle.value}`; if (!seen.has(key)) { seen.add(key); mutations.push(m); } };

  toks.forEach((tok, i) => {
    // `.replace(` and `.replaceAll(`
    if (tok.t === 'id' && (tok.v === 'replace' || tok.v === 'replaceAll') && toks[i - 1]?.t === 'p' && (toks[i - 1].v === '.' || toks[i - 1].v === '?.') && toks[i + 1]?.v === '(') {
      const o = i + 1, args = elements(toks, match, o);
      if (!args.length) return;
      const recv = receiver(src, toks, match, i - 1);
      const rowSpec = enclosingRowSpec(i);
      const onBody = rowSpec || BODY_RECEIVER.test(recv.replace(/(\.replace(All)?\([\s\S]*\))+$/, '')) || /^[a-z]\w*\.replace/.test(recv) && BODY_RECEIVER.test(recv.split('.')[0]);
      if (!onBody) return;
      const a0 = args[0];
      const global = tok.v === 'replaceAll';
      if (a0.length === 1 && isLit(toks[a0[0]])) {
        const n = needleOf(toks[a0[0]]);
        if (n.kind === 're' && /^(\\s|\\n|\\W|\s)[+*]?$/.test(n.value)) return; // whitespace normalising, not a needle
        add({ line: tok.line, via: 'replace', needle: n, spec: rowSpec, expect: global || (n.kind === 're' && n.flags.includes('g')) ? 'some' : 'once', text: lineText(i) });
      } else if (a0.length === 1 && toks[a0[0]].t === 'id' && literals.has(toks[a0[0]].v)) {
        add({ line: tok.line, via: 'replace-const', needle: needleOf(literals.get(toks[a0[0]].v)), spec: rowSpec, expect: global ? 'some' : 'once', text: lineText(i) });
      } else {
        computed.push({ line: tok.line, text: src.slice(toks[i - 1].start, toks[match[o]].end).replace(/\s+/g, ' ') });
      }
      return;
    }
    if (tok.t !== 'p' || tok.v !== '[' || match[i] < 0) return;
    const els = elements(toks, match, i);
    const lits = els.every(e => e.length === 1 && isLit(toks[e[0]]));
    // `[file, from, to]`
    if (els.length === 3 && lits && toks[els[0][0]].t === 'str') {
      const spec = specOf(toks[els[0][0]]);
      if (spec && toks[els[1][0]].t !== 're' && !PATHLIKE.test(toks[els[1][0]].v)) add({ line: toks[els[1][0]].line, via: 'row', needle: needleOf(toks[els[1][0]]), spec, expect: 'once', text: lineText(els[1][0]) });
      return;
    }
    // `[from, to]` inside a patch list: `patch: [[…]]`, `{ 'x.js': [[…]] }`, or `[[…]]` bound to a name with patch in it
    if (els.length === 2 && lits && toks[els[0][0]].t === 'str' && toks[els[1][0]].t === 'str') {
      const list = parents[i];
      if (list < 0 || toks[list].v !== '[') return;
      const key = keyOf(list);
      const declName = toks[list - 1]?.v === '=' ? toks[list - 2] : null;
      const named = n => n && n.t === 'id' && /patch|breaks?|edits?|mutants?|no_/i.test(n.v);
      const spec = key && key.t === 'str' ? specOf(key) : null;
      const isPatch = spec || named(key) || named(declName);
      if (!isPatch) return;
      add({ line: toks[els[0][0]].line, via: 'pair', needle: needleOf(toks[els[0][0]]), spec, expect: 'once', text: lineText(els[0][0]) });
    }
  });
  return { mutations, computed };
}

/** How many times a needle occurs in a body. */
export function countNeedle(body, needle) {
  if (needle.kind === 're') return (body.match(new RegExp(needle.value, needle.flags.replace(/[gy]/g, '') + 'g')) ?? []).length;
  if (!needle.value) return 0;
  let n = 0;
  for (let at = body.indexOf(needle.value); at >= 0; at = body.indexOf(needle.value, at + needle.value.length)) n++;
  return n;
}

/**
 * The files a mutation may target, nearest first. `spec` narrows by a path (relative to the check, or to the repo) or
 * by a served-path regex; with no spec (or only a kind), the needle is looked for in the check's own folder, then its
 * package, then the repo, and the nearest level that holds it wins.
 * @param {{needle: object, spec: object|null}} m
 * @param {string} checkFile repo-relative, forward slashes
 * @param {string[]} files repo-relative code files a check may serve (no checks, no tests)
 * @param {(f: string) => string} read
 * @returns {{targets: {file: string, count: number}[], how: string}}
 */
export function resolveTargets(m, checkFile, files, read) {
  const dir = checkFile.split('/').slice(0, -1).join('/');
  const norm = p => { const out = []; for (const s of p.split('/')) { if (s === '..') out.pop(); else if (s !== '.' && s) out.push(s); } return out.join('/'); };
  const levels = [dir, packageRoot(dir), ''];
  const within = (f, root) => !root || f.startsWith(root + '/');
  const counted = list => list.map(file => ({ file, count: countNeedle(read(file), m.needle) }));
  if (m.spec?.kind === 'path') {
    // relative to the check, then to the repo, then the nearest file whose path ends with it (a route on `**/form.css`)
    let cands = [norm(`${dir}/${m.spec.value}`), norm(m.spec.value)].filter(f => files.includes(f));
    if (!cands.length) for (const root of levels) { cands = files.filter(f => within(f, root) && f.endsWith('/' + norm(m.spec.value))); if (cands.length) break; }
    return { targets: counted(cands.slice(0, 1)), how: `path ${m.spec.value}${cands[0] ? ' = ' + cands[0] : ': no such file'}` };
  }
  let pool = files;
  if (m.spec?.kind === 're') { const re = new RegExp(m.spec.value, m.spec.flags); pool = files.filter(f => re.test('/' + f)); }
  else if (m.spec?.kind === 'kind') pool = files.filter(f => f.endsWith('.' + m.spec.value));
  for (const root of levels) {
    const here = counted(pool.filter(f => within(f, root))).filter(t => t.count > 0);
    if (here.length) return { targets: here, how: `${m.spec ? m.spec.kind + ' ' + m.spec.value + ', ' : ''}found under ${root || 'the repo'}` };
  }
  return { targets: [], how: m.spec ? `${m.spec.kind} ${m.spec.value}: no file holds it` : 'no file holds it' };
}

/** `packages/scenes/veranda/x` → `packages/scenes/veranda`; `packages/core` → `packages/core`; `tools/x` → `tools`. */
export function packageRoot(dir) {
  const p = dir.split('/');
  if (p[0] === 'packages' && ['scenes', 'components', 'recipes', 'stage3d', 'templates'].includes(p[1]) && p.length >= 3) return p.slice(0, 3).join('/');
  if (p[0] === 'packages' || p[0] === 'apps') return p.slice(0, 2).join('/');
  return p[0];
}

/**
 * The whole audit. `allow` is the committed allowlist ({ computed, exempt, rotted }, each entry naming its check and
 * its call or needle, with a reason). Returns the problems, every one of which should fail the guard:
 *   - a needle that no longer occurs in its target as often as the mutation expects;
 *   - a computed mutation nobody has listed (the list must not grow silently);
 *   - an allowlist entry that no longer matches anything (a stale reason hides the next one);
 *   - a rotted entry that bites again (take it off the list, so the guard watches it).
 * @param {{checks: string[], files: string[], read: (f: string) => string, allow: {computed: object[], exempt: object[], rotted: object[]}}} o
 */
export function audit({ checks, files, read, allow }) {
  const problems = [], covered = [], computed = [], exempt = [], rotted = [];
  const used = { computed: new Set(), exempt: new Set(), rotted: new Set() };
  const find = (list, c, test) => list.findIndex(e => e.check === c && test(e));
  for (const c of checks) {
    const found = findMutations(read(c));
    for (const m of found.mutations) {
      const ex = find(allow.exempt ?? [], c, e => e.needle === m.needle.value);
      if (ex >= 0) { used.exempt.add(ex); exempt.push({ check: c, ...m }); continue; }
      const verdict = judge(m, resolveTargets(m, c, files, read));
      const rot = find(allow.rotted ?? [], c, e => e.needle === m.needle.value);
      if (rot >= 0) {
        used.rotted.add(rot); rotted.push({ check: c, ...m, why: verdict.why });
        if (verdict.ok) problems.push(`${c}:${m.line} is listed as rotted but its needle bites again (${verdict.why}): take it off the rotted list`);
        continue;
      }
      if (verdict.ok) covered.push({ check: c, ...m, why: verdict.why });
      else problems.push(`${c}:${m.line} ${m.via} ${JSON.stringify(m.needle.value).slice(0, 90)}: ${verdict.why}`);
    }
    for (const x of found.computed) {
      const k = find(allow.computed ?? [], c, e => e.call === x.text);
      if (k >= 0) { used.computed.add(k); computed.push({ check: c, ...x }); } else problems.push(`${c}:${x.line} a mutation the guard can't read statically, not on the allowlist: ${x.text.slice(0, 90)} (list it with a reason, or make its needle a literal)`);
    }
  }
  for (const kind of ['computed', 'exempt', 'rotted']) (allow[kind] ?? []).forEach((e, k) => { if (!used[kind].has(k)) problems.push(`allowlist ${kind} entry for ${e.check} matches nothing any more: ${(e.call ?? e.needle ?? '').slice(0, 90)}`); });
  return { problems, covered, computed, exempt, rotted };
}

/**
 * Judge one resolved mutation: ok when the needle occurs in its target as many times as the mutation expects
 * (`once`: exactly one in the target; `some`: at least one).
 */
export function judge(m, resolved) {
  const total = resolved.targets.reduce((s, t) => s + t.count, 0);
  if (!resolved.targets.length || total === 0) return { ok: false, why: `the needle is in no target (${resolved.how})` };
  if (m.expect === 'once' && resolved.targets.length === 1 && total !== 1) return { ok: false, why: `the needle occurs ${total} times in ${resolved.targets[0].file}; the mutation replaces only the first` };
  return { ok: true, why: resolved.targets.map(t => `${t.file} ×${t.count}`).join(', ') };
}
