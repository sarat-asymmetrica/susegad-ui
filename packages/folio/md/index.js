// Folio Markdown: from source to a Folio page. Pure, no dependencies.
//
//   import { toDocument } from './md/index.js';
//   const { html, warnings } = toDocument(src, { exists: path => fs.existsSync(root + path) });
//
// Directives (block level):
//   ::scene{name=paus register=warm}          a scene; or :::scene{...} with Markdown inside, slotted over it
//   :::diagram{title="How a booking flows"}   diagram source, one line per step (Guest -> Portal: books)
//   ::price-table{from=kernels-booking arrival=2026-11-16 departure=2026-11-20 guests=2}
//   :::timeline                               a list of "- when: what" lines
//   ::signature{name="Sarat Chandran" role="for Asymmetrica"}
//   :::note{tone=warning}[Before you sign]    a note, with Markdown inside
// Every directive is written so the page reads well even if its element never loads.

import { blocks, inline, source, escapeHtml, MarkdownError, parseAttrs } from './parse.js';
// the diagram's line grammar alone (no layout), so a diagram is checked line by line even unbuilt
import { parse as parseDiagram } from '../diagram/diagram.grammar.js';

export { MarkdownError, parseAttrs, inline };

const esc = escapeHtml;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A real calendar date in YYYY-MM-DD, as { y, m, d }, or null. */
export function isoDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number), dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? { y, m: mo, d, t: dt.getTime() } : null;
}
/** "16 November 2026", or "16 to 20 November 2026" for a range: the way people write dates. */
export function sayDate(a, b) {
  const A = isoDate(a);
  if (!b) return `${A.d} ${MONTHS[A.m - 1]} ${A.y}`;
  const B = isoDate(b);
  if (A.y !== B.y) return `${sayDate(a)} to ${sayDate(b)}`;
  if (A.m !== B.m) return `${A.d} ${MONTHS[A.m - 1]} to ${B.d} ${MONTHS[B.m - 1]} ${B.y}`;
  return `${A.d} to ${B.d} ${MONTHS[B.m - 1]} ${B.y}`;
}

// ── attribute checks: each returns a message, or null when the value is fine ──

const check = {
  string: v => (typeof v === 'string' && v.trim() ? null : 'needs a value'),
  name: v => (/^[a-z][a-z0-9-]*$/.test(String(v)) ? null : 'must be a lowercase name, like paus or kolam'),
  flag: v => (v === true || v === 'true' || v === 'false' ? null : 'is a flag: write it on its own, or as =true or =false'),
  date: v => (isoDate(v) ? null : 'must be a real date written YYYY-MM-DD, like 2026-11-16'),
  number: (v, s) => { const n = Number(v); return Number.isFinite(n) && (s.min == null || n >= s.min) && (s.max == null || n <= s.max) ? null : `must be a number${s.min != null ? ` from ${s.min}` : ''}${s.max != null ? ` to ${s.max}` : ''}`; },
  int: (v, s) => (Number.isInteger(Number(v)) ? check.number(v, s) : `must be a whole number${s.min != null ? ` from ${s.min}` : ''}${s.max != null ? ` to ${s.max}` : ''}`),
  enum: (v, s) => (s.values.includes(String(v)) ? null : `must be one of ${s.values.join(', ')}`),
};
const REGISTER = { type: 'enum', values: ['quiet', 'warm', 'playful'] };
const flagOn = v => v === true || v === 'true';

/** Where each element's code lives, relative to the repo root. Override with toDocument({ modules }). */
export const MODULES = {
  diagram: { js: '/packages/folio/diagram/diagram.js', css: '/packages/folio/diagram/diagram.css' },
  'price-table': { js: '/packages/recipes/proposal/price-table.js', css: '/packages/recipes/proposal/price-table.css' },
  timeline: { js: '/packages/recipes/proposal/timeline.js', css: '/packages/recipes/proposal/timeline.css' },
  signature: { js: '/packages/components/signature/signature.js', css: '/packages/components/signature/signature.css' },
};

let seq = 0;
const uid = p => `${p}-${++seq}`;

/** The directives Folio knows: what they accept, what they check, what they write. */
export const DIRECTIVES = {
  scene: {
    kinds: ['leaf', 'container'],
    attrs: { name: { type: 'name', required: true }, register: REGISTER, seed: { type: 'string' }, label: { type: 'string' }, progress: { type: 'number', min: 0, max: 1 }, paused: { type: 'flag' } },
    extra: true, // scene params (grid, intensity, fog...) pass through
    render(n, ctx) {
      ctx.require({ js: `/packages/scenes/${n.attrs.name}/index.js` }, `::scene{name=${n.attrs.name}}`, n.line);
      const attrs = Object.entries(n.attrs).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join('');
      return `<sg-scene${attrs}${n.id ? ` id="${esc(n.id)}"` : ''}${n.classes.length ? ` class="${esc(n.classes.join(' '))}"` : ''}>${n.kind === 'container' ? '\n' + ctx.render(ctx.parse(n.lines)) : ''}</sg-scene>`;
    },
  },
  diagram: {
    kinds: ['container'],
    attrs: { title: { type: 'string' }, steps: { type: 'flag' }, register: REGISTER, direction: { type: 'enum', values: ['right', 'down'] } },
    body(n, ctx) {
      const lines = n.lines.filter(l => l.text.trim() && !l.text.trim().startsWith('#'));
      if (!lines.length) return [{ line: n.line, message: ':::diagram is empty. Write one line per connection, like Guest -> Portal: books' }];
      if (!lines.some(l => /<->|->|=>|--/.test(l.text))) return [{ line: n.line, message: ':::diagram has no arrows. Write connections like Guest -> Portal: books' }];
      // the grammar reads the source from its first non-blank line, as renderDiagram does (decision 0013)
      const lead = n.lines.findIndex(l => l.text.trim()), src = n.lines.slice(lead).map(l => l.text).join('\n');
      const found = parseDiagram(src).errors.map(e => ({ line: n.lines[lead + e.line - 1]?.line ?? n.line, message: `:::diagram: ${e.message}` }));
      n.checked = new Set(found.map(e => e.line));
      return found;
    },
    render(n, ctx) {
      ctx.require(MODULES_OF(ctx).diagram, ':::diagram', n.line);
      const src = n.lines.map(l => l.text).join('\n').replace(/^\n+|\n+$/g, '');
      const title = n.attrs.title ?? n.label;
      if (ctx.renderers.diagram) {
        const lead = n.lines.findIndex(l => l.text.trim()); // the source handed over starts at its first non-blank line
        const out = ctx.renderers.diagram({ source: src, attrs: n.attrs, title, id: n.id });
        for (const e of out.errors ?? []) {
          const line = n.lines[lead + (e.line ?? 1) - 1]?.line ?? n.line;
          if (!n.checked?.has(line)) ctx.problem(line, `:::diagram: ${e.message}`); // the grammar already said it
        }
        return out.html;
      }
      // No renderer (Markdown rendered in a page, not built): the same data-* contract as
      // renderDiagram's output (decision 0013), with the source as the no-JavaScript reading.
      // <sg-diagram> draws itself from data-src when it finds no SVG.
      const opts = JSON.stringify({ title: title || undefined, direction: n.attrs.direction || undefined });
      return `<sg-diagram${n.id ? ` id="${esc(n.id)}"` : ''} data-src="${esc(src)}" data-opts="${esc(opts)}"${n.attrs.register ? ` data-register-drawn="${esc(n.attrs.register)}"` : ''}${flagOn(n.attrs.steps) ? ' data-steps' : ''}${n.attrs.direction ? ` data-direction="${esc(n.attrs.direction)}" data-direction-set` : ''}>\n<figure class="sg-diagram folio-diagram">${title ? `<figcaption>${inline(title)}</figcaption>` : ''}<pre class="folio-diagram__source">${esc(src)}</pre></figure>\n</sg-diagram>`;
    },
  },
  'price-table': {
    kinds: ['leaf'],
    attrs: {
      from: { type: 'enum', values: ['kernels-booking'], required: true },
      view: { type: 'enum', values: ['stay', 'bands'] }, // bands: the whole rate card, with no dates
      arrival: { type: 'date' }, departure: { type: 'date' },
      guests: { type: 'int', min: 1, max: 20 }, room: { type: 'string' }, register: REGISTER,
    },
    check(a) {
      if (a.view === 'bands') return a.arrival || a.departure ? ['view=bands is the whole rate card, so it takes no arrival or departure'] : [];
      const missing = ['arrival', 'departure'].filter(k => a[k] == null);
      if (missing.length) return missing.map(k => `needs ${k}, like ::price-table{${k}=2026-11-16}, or view=bands for the whole rate card`);
      const A = isoDate(a.arrival), D = isoDate(a.departure);
      if (!A || !D) return [];
      const nights = Math.round((D.t - A.t) / 864e5);
      if (nights < 1) return ['departure must be after arrival'];
      if (nights > 90) return [`covers ${nights} nights; a price table shows at most 90`];
      return [];
    },
    render(n, ctx) {
      ctx.require(MODULES_OF(ctx)['price-table'], '::price-table', n.line);
      const a = n.attrs, bands = a.view === 'bands', guests = a.guests ?? 2;
      const attrs = Object.entries(bands ? a : { ...a, guests }).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
      if (ctx.renderers['price-table']) return `<sg-price-table${attrs}>\n${ctx.renderers['price-table'](bands ? a : { ...a, guests: String(guests) })}\n</sg-price-table>`;
      if (bands) return `<sg-price-table${attrs}>\n<p class="folio-fallback">The rate card, season by season, is worked out from the booking kernels when this document opens.</p>\n</sg-price-table>`;
      return `<sg-price-table${attrs}>\n<p class="folio-fallback">Prices for ${esc(sayDate(a.arrival, a.departure))}, for ${guests} ${guests === 1 ? 'guest' : 'guests'}${a.room ? `, in ${esc(a.room)}` : ''}, are worked out from the rate card when this document opens.</p>\n</sg-price-table>`;
    },
  },
  timeline: {
    kinds: ['container'],
    attrs: { title: { type: 'string' }, scrub: { type: 'flag' } },
    body(n, ctx) {
      if (ctx.renderers.timeline) return []; // the timeline reads its own lines, with line numbers
      const problems = [], items = [];
      for (const l of n.lines) {
        if (!l.text.trim()) continue;
        const step = /^\s*\d+[.)]\s+\*\*(.+?)\*\*\s*(.*)$/.exec(l.text); // the timeline's other form: 1. **Title.** Text
        if (step) { items.push({ when: null, title: step[1], what: step[2] }); continue; }
        const m = /^\s*[-*]\s+(.+?):\s+(.+)$/.exec(l.text);
        if (!m) { problems.push({ line: l.line, message: 'each timeline line is "- when: what", like - 2026-11-01: Survey the house, or "1. **Title.** What happens"' }); continue; }
        if (/^\d{4}-\d{2}/.test(m[1]) && !isoDate(m[1]) && !/^\d{4}-(0[1-9]|1[0-2])$/.test(m[1])) problems.push({ line: l.line, message: `"${m[1]}" is not a real date. Write YYYY-MM-DD or YYYY-MM, or a label like Week 1` });
        items.push({ when: m[1], what: m[2] });
      }
      if (!problems.length && items.some(i => i.when == null) && items.some(i => i.when != null)) problems.push({ line: n.line, message: ':::timeline mixes numbered steps ("1. **Title.** ...") and dated lines ("- when: what"). Use one form for every step' });
      if (!problems.length && items.length < 2) problems.push({ line: n.line, message: ':::timeline needs at least two "- when: what" lines' });
      n.items = items;
      return problems;
    },
    render(n, ctx) {
      ctx.require(MODULES_OF(ctx).timeline, ':::timeline', n.line);
      if (ctx.renderers.timeline) {
        const out = ctx.renderers.timeline({ lines: n.lines, attrs: n.attrs, title: n.attrs.title ?? n.label ?? '' });
        for (const p of out.problems ?? []) ctx.problem(p.line ?? n.line, `:::timeline: ${p.message}`);
        return out.html;
      }
      const when = w => {
        if (isoDate(w)) return `<time datetime="${w}">${sayDate(w)}</time>`;
        const mo = /^(\d{4})-(\d{2})$/.exec(w);
        if (mo) return `<time datetime="${w}">${MONTHS[+mo[2] - 1]} ${mo[1]}</time>`;
        return `<span class="folio-timeline__when">${inline(w)}</span>`;
      };
      const title = n.attrs.title ?? n.label;
      return `<sg-timeline${flagOn(n.attrs.scrub) ? ' scrub' : ''}${title ? ` label="${esc(title)}"` : ''}>\n${title ? `<p class="folio-timeline__title">${inline(title)}</p>\n` : ''}<ol class="folio-timeline">\n${n.items.map(it => `<li>${it.when == null ? `<strong class="folio-timeline__step">${inline(it.title)}</strong>` : when(it.when)} <span class="folio-timeline__what">${inline(it.what)}</span></li>`).join('\n')}\n</ol>\n</sg-timeline>`;
    },
  },
  signature: {
    kinds: ['leaf'],
    attrs: {
      name: { type: 'string' }, role: { type: 'string' }, for: { type: 'string' }, label: { type: 'string' }, field: { type: 'name' }, required: { type: 'flag' },
      option: { type: 'flag' }, // choose one of the document's "**Option 1, ...**" paragraphs before signing
      options: { type: 'string' }, // or name the choices: options="The launch|The launch with the engine"
    },
    render(n, ctx) {
      ctx.require(MODULES_OF(ctx).signature, '::signature', n.line);
      const a = n.attrs, id = n.id ?? uid('folio-signature');
      const who = [a.name, a.role, a.for && `for ${a.for}`].filter(Boolean).join(', ');
      const sig = `<sg-signature>\n<label for="${esc(id)}">${esc(a.label ?? 'Type your full name to sign')}</label>\n<input id="${esc(id)}" name="${esc(a.field ?? 'signature')}" autocomplete="name"${flagOn(a.required) ? ' required' : ''}${who ? ` aria-describedby="${esc(id)}-for"` : ''}>\n${who ? `<p class="folio-signature__for" id="${esc(id)}-for">${esc(who)}</p>\n` : ''}</sg-signature>`;
      if (!flagOn(a.option) && !a.options) return sig;
      // A choice to sign for, as native radios before the signature (outside it: <sg-signature>
      // takes its first input as the name). `option` alone finds the choices after rendering.
      const choices = a.options ? String(a.options).split('|').map(s => s.trim()).filter(Boolean) : null;
      const fieldset = choices ? optionsHTML(id, choices, flagOn(a.required)) : `<!--folio-options ${esc(id)} ${flagOn(a.required) ? 'required' : ''} ${n.line}-->`;
      return `<div class="folio-signature">\n${fieldset}\n${sig}\n</div>`;
    },
  },
  note: {
    kinds: ['container'],
    attrs: { tone: { type: 'enum', values: ['info', 'tip', 'warning', 'success'] } },
    render(n, ctx) {
      const tone = n.attrs.tone ?? 'info';
      const label = n.label ?? { info: 'Note', tip: 'Tip', warning: 'Take care', success: 'Done' }[tone];
      return `<aside class="folio-note" data-tone="${tone}" role="note"${n.id ? ` id="${esc(n.id)}"` : ''}>\n<p class="folio-note__label">${inline(label)}</p>\n${ctx.render(ctx.parse(n.lines))}\n</aside>`;
    },
  },
};
const MODULES_OF = ctx => ({ ...MODULES, ...ctx.modules });

/** The choices a signature is for, as native radios: one must be picked when the signature is required. */
function optionsHTML(id, choices, required) {
  const radios = choices.map((c, i) => {
    const value = /^Option\s+(\d+)/i.exec(c)?.[1] ?? String(i + 1), rid = `${esc(id)}-option-${i + 1}`;
    return `<div class="folio-signature__choice"><input type="radio" id="${rid}" name="option" value="${esc(value)}"${required ? ' required' : ''}><label for="${rid}">${esc(c)}</label></div>`;
  });
  return `<fieldset class="folio-signature__options">\n<legend>The option you choose</legend>\n${radios.join('\n')}\n</fieldset>`;
}
/** Paragraphs that open with a bold "Option 1, ..." label, in order, as plain text. */
const optionsIn = html => [...html.matchAll(/<p><strong>(Option\s+\d+\b[^<]*?)\.?<\/strong>/g)].map(m => m[1].replace(/&amp;/g, '&'));

/** Check one directive: known name, allowed form, attributes by schema, then its own checks. */
function validate(n, ctx) {
  const spec = DIRECTIVES[n.name];
  const colons = n.kind === 'leaf' ? '::' : ':::';
  if (!spec) return [{ line: n.line, message: `${colons}${n.name} is not a directive Folio knows. Use one of: ${Object.keys(DIRECTIVES).join(', ')}` }];
  if (!spec.kinds.includes(n.kind)) {
    return [{ line: n.line, message: spec.kinds.includes('container') ? `${n.name} holds content: write :::${n.name}, then its lines, then ::: on its own line` : `${n.name} stands on its own line: write ::${n.name}{...}, with two colons and no closing :::` }];
  }
  const problems = [];
  for (const [k, s] of Object.entries(spec.attrs)) if (s.required && n.attrs[k] == null) problems.push(`needs ${k}, like ${colons}${n.name}{${k}=${s.type === 'date' ? '2026-11-16' : s.values?.[0] ?? '...'}}`);
  for (const [k, v] of Object.entries(n.attrs)) {
    const s = spec.attrs[k];
    if (!s) {
      if (spec.extra && /^[a-z][a-z0-9-]*$/.test(k)) continue;
      problems.push(`doesn't take ${k}. It takes: ${Object.keys(spec.attrs).join(', ')}`);
      continue;
    }
    if (v === true && s.type !== 'flag') { problems.push(`${k} needs a value, like ${k}=...`); continue; }
    const msg = check[s.type](v, s);
    if (msg) problems.push(`${k} ${msg} (it is "${v}")`);
  }
  if (!problems.length && spec.check) problems.push(...spec.check(n.attrs));
  const out = problems.map(message => ({ line: n.line, message: `${colons}${n.name}: ${message}` }));
  if (spec.body) out.push(...spec.body(n, ctx));
  return out;
}

const slug = t => t.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';

/**
 * Markdown to an HTML fragment. Throws a MarkdownError listing every problem
 * with its line number. `ctx.require` collects what the page must load.
 */
export function render(src, options = {}) {
  seq = 0; // ids are the same every time the same source is rendered
  const { front, lines } = source(src);
  const problems = [], requires = [], ids = new Set();
  const ctx = {
    modules: options.modules ?? {},
    // optional: directive -> a function that writes its markup at build time (see toDocument)
    renderers: options.renderers ?? {},
    problem: (line, message) => problems.push({ line, message }),
    parse: ls => blocks(ls, problems),
    require: (mod, what, line) => { if (mod) requires.push({ ...mod, what, line }); },
    render: nodes => nodes.map(node).join('\n'),
  };
  function node(n) {
    switch (n.type) {
      case 'heading': {
        let id = slug(n.text), k = 2;
        while (ids.has(id)) id = `${slug(n.text)}-${k++}`;
        ids.add(id);
        return `<h${n.level} id="${id}">${inline(n.text)}</h${n.level}>`;
      }
      case 'paragraph': return `<p>${inline(n.text)}</p>`;
      case 'hr': return '<hr>';
      case 'code': return `<pre><code${n.lang ? ` class="language-${esc(n.lang)}"` : ''}>${esc(n.text)}</code></pre>`;
      case 'html': return n.text;
      case 'quote': return `<blockquote>\n${ctx.render(n.children)}\n</blockquote>`;
      case 'list': {
        const tag = n.ordered ? 'ol' : 'ul';
        const items = n.items.map(item => {
          const inner = !n.loose && item.length && item[0].type === 'paragraph'
            ? [inline(item[0].text), ...item.slice(1).map(node)].join('\n')
            : ctx.render(item);
          return `<li>${inner}</li>`;
        });
        return `<${tag}${n.ordered && n.start !== 1 ? ` start="${n.start}"` : ''}>\n${items.join('\n')}\n</${tag}>`;
      }
      case 'table': {
        const cls = i => (n.align[i] ? ` class="align-${n.align[i]}"` : '');
        const row = (cells, tag) => `<tr>${n.head.map((_, i) => `<${tag}${cls(i)}>${inline(cells[i] ?? '')}</${tag}>`).join('')}</tr>`;
        return `<table>\n<thead>${row(n.head, 'th')}</thead>\n<tbody>\n${n.rows.map(r => row(r, 'td')).join('\n')}\n</tbody>\n</table>`;
      }
      case 'directive': {
        const found = validate(n, ctx);
        if (found.length) { problems.push(...found); return ''; }
        return DIRECTIVES[n.name].render(n, ctx);
      }
      default: return '';
    }
  }
  let html = ctx.render(ctx.parse(lines));
  html = html.replace(/<!--folio-options (\S+) (required)? ?(\d+)-->/g, (_, id, req, line) => {
    const found = optionsIn(html);
    if (found.length < 2) { ctx.problem(+line, '::signature: option looks for paragraphs that start with a bold "**Option 1, ...**", and found ' + (found.length ? 'only one' : 'none') + '. Write them, or name the choices with options="A|B"'); return ''; }
    return optionsHTML(id, found, !!req);
  });
  if (problems.length) throw new MarkdownError(problems.sort((a, b) => a.line - b.line));
  const firstH1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1].replace(/<[^>]+>/g, '');
  return { html, front, requires, title: front.title ?? firstH1 ?? '' };
}

/**
 * A whole Folio page from Markdown, ready for `folio build`. Modules an element
 * needs are imported only when `exists(path)` says they are there; otherwise the
 * element's fallback content stands, and a warning says so.
 * @param {string} src
 * @param {{ exists?: (rootPath: string) => boolean, modules?: object, file?: string }} [o]
 * @returns {{ html: string, warnings: string[] }}
 */
export function toDocument(src, o = {}) {
  const exists = o.exists ?? (() => true);
  const r = render(src, o);
  const f = r.front, warnings = [];
  for (const k of Object.keys(f)) if (!['title', 'lang', 'register', 'theme', 'description'].includes(k)) warnings.push(`front matter: ${k} is not used. Folio reads title, lang, register, theme and description.`);
  if (f.register && !['quiet', 'warm', 'playful'].includes(f.register)) throw new MarkdownError([{ line: 1, message: `front matter: register must be quiet, warm or playful (it is "${f.register}")` }]);
  if (f.theme && !['light', 'dark'].includes(f.theme)) throw new MarkdownError([{ line: 1, message: `front matter: theme must be light or dark (it is "${f.theme}")` }]);
  if (!r.title) warnings.push('The document has no title: add title: in the front matter, or a # heading.');
  const js = [], css = [];
  for (const q of r.requires) {
    if (q.js && !js.includes(q.js)) { if (exists(q.js)) js.push(q.js); else warnings.push(`line ${q.line}: ${q.what} needs ${q.js}, which is not in this project yet, so the page shows its plain version.`); }
    if (q.css && !css.includes(q.css) && exists(q.css)) css.push(q.css);
  }
  const html = `<!doctype html>
<html lang="${esc(f.lang ?? 'en')}"${f.register ? ` data-register="${esc(f.register)}"` : ''}${f.theme ? ` data-theme="${esc(f.theme)}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.title || 'Untitled')}</title>
${f.description ? `<meta name="description" content="${esc(f.description)}">\n` : ''}<link rel="stylesheet" href="/packages/tokens/fonts.css">
<link rel="stylesheet" href="/packages/tokens/tokens.css">
<link rel="stylesheet" href="/packages/folio/md/folio-doc.css">
${css.map(h => `<link rel="stylesheet" href="${h}">`).join('\n')}
</head>
<body>
<main class="folio-doc">
${r.html}
</main>
${js.length ? `<script type="module">\n${js.map(p => `import '${p}';`).join('\n')}\n</script>\n` : ''}</body>
</html>
`;
  return { html, warnings };
}
