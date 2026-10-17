// Every `npx` command on the built site must name a package that exists on npm.
//
// Pure: text in, findings out. The list of names that exist is pinned in
// npx-packages.json and updated by the release step (docs/RELEASING.md), so the
// check needs no network. It would have caught the bare `susegad`, which is the
// command's name (bin) and not a package.

const FLAG = String.raw`(?:-{1,2}[A-Za-z][\w-]*(?:=\S+)?\s+)`;
const NAME = String.raw`(@[a-z0-9][\w.-]*\/[a-z0-9][\w.-]*|[a-z0-9][\w.-]*)`;
const NPX = new RegExp(String.raw`(?<![\w./-])npx\s+(?:${FLAG})*${NAME}`, 'g');

const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&');

/** `@susegad/cli@1.2.3` -> `@susegad/cli`; `esbuild@latest` -> `esbuild`. */
export function packageOf(spec) {
  const at = spec.indexOf('@', 1);
  return at > 0 ? spec.slice(0, at) : spec;
}

/** The package names an `npx ...` string asks for, in the order written. */
export function npxNames(text) {
  const out = [];
  for (const m of String(text).matchAll(NPX)) out.push({ name: packageOf(m[1]), snippet: m[0].replace(/\s+/g, ' ') });
  return out;
}

/**
 * The text of an HTML page where a command can live: what sits in <code> and <pre>.
 * Prose that says "npx" in a sentence is not a command.
 */
export function codeText(html) {
  const parts = [];
  for (const m of String(html).matchAll(/<(code|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi)) parts.push(decode(m[2].replace(/<[^>]+>/g, '')));
  // a separator that \s does not match: <code>npx</code> and <code>create</code> side by side are not one command
  return parts.join('\u0001');
}

/**
 * @param {Array<{ file: string, text: string, html?: boolean }>} files
 * @param {Iterable<string>} known the pinned list of names that exist on npm
 * @returns {Array<{ file: string, name: string, snippet: string }>} every `npx <name>` whose name is not in the list
 */
export function unknownNpx(files, known) {
  const ok = new Set(known);
  const bad = [];
  for (const f of files) {
    const text = f.html ? codeText(f.text) : f.text;
    for (const { name, snippet } of npxNames(text)) if (!ok.has(name)) bad.push({ file: f.file, name, snippet });
  }
  return bad;
}

// `npx @susegad/cli add <items...>`: every item named must be in the registry. The walkthrough once said `sg-badge`
// where the registry says `badge`, and a reader who pastes it gets "I do not have anything called sg-badge".
const ADD = /(?<![\w./-])npx\s+(?:-{1,2}[A-Za-z][\w-]*(?:=\S+)?\s+)*@susegad\/cli(?:@[\w.-]+)?\s+add\s+([^\n&|;\u0001]*)/g;

/** The item names an `add` command asks for, in order: the words after `add` up to the first flag. */
export function addNames(text) {
  const out = [];
  for (const m of String(text).matchAll(ADD)) {
    for (const word of m[1].trim().split(/\s+/)) {
      // an item name, then the command ends at a flag, at anything that is not a name, or at punctuation that closes a sentence
      const clean = word.replace(/[`'",.;:)]+$/, '');
      if (!clean || !/^[a-z0-9][a-z0-9-]*$/.test(clean)) break;
      out.push({ name: clean, snippet: m[0].replace(/\s+/g, ' ').trim() });
      if (clean !== word) break;
    }
  }
  return out;
}

/**
 * @param {Array<{ file: string, text: string, html?: boolean }>} files
 * @param {Iterable<string>} registryNames
 * @returns {Array<{ file: string, name: string, snippet: string }>} every item an `add` command names that the registry does not have
 */
export function unknownAddItems(files, registryNames) {
  const known = new Set(registryNames);
  const bad = [];
  for (const f of files) {
    const text = f.html ? codeText(f.text) : f.text;
    for (const { name, snippet } of addNames(text)) if (!known.has(name)) bad.push({ file: f.file, name, snippet });
  }
  return bad;
}
